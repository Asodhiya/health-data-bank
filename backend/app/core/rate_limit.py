from __future__ import annotations

from collections import defaultdict, deque
from collections.abc import Callable
from datetime import datetime, timedelta, timezone
import inspect
import logging
from math import ceil
from time import monotonic

from fastapi import Depends, HTTPException, Request, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.dependency import set_rls_context
from app.db.models import AuditLog, Role, User, UserRole
from app.db.session import get_db
from app.services.audit_service import write_audit_log
from app.services.notification_service import create_notification, notification_exists_recent

try:
    from redis.asyncio import Redis
except ImportError:  # pragma: no cover - optional dependency
    Redis = None


logger = logging.getLogger(__name__)


class InMemoryRateLimiter:
    """Simple per-key sliding-window rate limiter for a single app instance."""

    def __init__(self) -> None:
        self._hits: dict[str, deque[float]] = defaultdict(deque)

    async def check(self, key: str, limit: int, window_seconds: int) -> tuple[bool, int]:
        now = monotonic()
        window_start = now - window_seconds
        hits = self._hits[key]

        while hits and hits[0] <= window_start:
            hits.popleft()

        if len(hits) >= limit:
            retry_after = max(1, int(hits[0] + window_seconds - now))
            return False, retry_after

        hits.append(now)
        return True, 0

    def reset(self) -> None:
        self._hits.clear()


class RedisRateLimiter:
    """Sliding-window limiter backed by Redis, safe across app instances."""

    def __init__(self, redis_url: str) -> None:
        if Redis is None:
            raise RuntimeError("redis package is not installed")
        self.redis = Redis.from_url(redis_url, decode_responses=True)

    async def check(self, key: str, limit: int, window_seconds: int) -> tuple[bool, int]:
        now = monotonic()
        member = f"{now}"
        window_start = now - window_seconds
        async with self.redis.pipeline(transaction=True) as pipe:
            (
                pipe.zremrangebyscore(key, 0, window_start)
                .zcard(key)
                .zadd(key, {member: now})
                .expire(key, window_seconds)
            )
            removed, count, _, _ = await pipe.execute()

        if count >= limit:
            await self.redis.zrem(key, member)
            oldest = await self.redis.zrange(key, 0, 0, withscores=True)
            if oldest:
                retry_after = max(1, int(oldest[0][1] + window_seconds - now))
            else:
                retry_after = window_seconds
            return False, retry_after

        return True, 0

    def reset(self) -> None:
        # No-op for production runtime; tests should replace the backend with a fake or memory limiter.
        return None


def _build_rate_limiter():
    backend = settings.RATE_LIMIT_BACKEND.strip().lower()
    if backend == "redis":
        if Redis is None:
            logger.warning(
                "RATE_LIMIT_BACKEND=redis but redis package is not installed; falling back to memory"
            )
            return InMemoryRateLimiter()
        try:
            return RedisRateLimiter(settings.REDIS_URL)
        except Exception as exc:  # pragma: no cover - defensive fallback
            logger.warning("Failed to initialize Redis rate limiter: %s. Falling back to memory.", exc)
            return InMemoryRateLimiter()
    return InMemoryRateLimiter()


rate_limiter = _build_rate_limiter()


def _get_client_identifier(request: Request) -> str:
    forwarded_for = request.headers.get("X-Forwarded-For")
    if forwarded_for:
        return forwarded_for.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


async def _resolve_key_suffix(request: Request, key_func: Callable | None) -> str:
    if key_func is None:
        return _get_client_identifier(request)
    value = key_func(request)
    if inspect.isawaitable(value):
        value = await value
    return str(value)


def _format_rate_limit_detail(scope: str) -> str:
    messages = {
        "auth:login:identifier": "Too many login attempts for this account. Please try again later.",
        "auth:login:ip": "Too many login attempts from this network. Please try again later.",
        "auth:forgot-password:identifier": "Too many password reset requests for this account. Please try again later.",
        "auth:forgot-password:ip": "Too many password reset requests from this network. Please try again later.",
        "auth:register": "Too many registration attempts. Please try again later.",
        "auth:reset-password": "Too many password reset attempts. Please try again later.",
        "auth:signup_invite": "Too many invite requests. Please try again later.",
        "admin:backup": "Too many backup requests. Please try again later.",
        "admin:restore": "Too many restore requests. Please try again later.",
    }
    return messages.get(scope, "Too many requests. Please try again later.")


async def _count_recent_rate_limit_exceedances(
    db: AsyncSession,
    *,
    scope: str,
    key_kind: str,
    key_value: str,
    window_seconds: int,
) -> int:
    since = datetime.now(timezone.utc) - timedelta(seconds=window_seconds)
    stmt = (
        select(func.count(AuditLog.audit_id))
        .where(AuditLog.action == "RATE_LIMIT_EXCEEDED")
        .where(AuditLog.created_at >= since)
        .where(AuditLog.details["scope"].astext == scope)
        .where(AuditLog.details["key_kind"].astext == key_kind)
        .where(AuditLog.details["key_value"].astext == key_value)
    )
    result = await db.execute(stmt)
    return int(result.scalar_one() or 0)


async def _get_admin_user_ids(db: AsyncSession) -> list:
    await set_rls_context(db, role="system")
    result = await db.execute(
        select(User.user_id)
        .join(UserRole, UserRole.user_id == User.user_id)
        .join(Role, Role.role_id == UserRole.role_id)
        .where(Role.role_name == "admin")
    )
    return [row[0] for row in result.all()]


async def _maybe_alert_admins_for_rate_limit_spike(
    db: AsyncSession,
    *,
    scope: str,
    key_kind: str,
    key_value: str,
    ip_address: str,
    window_seconds: int,
) -> None:
    recent_count = await _count_recent_rate_limit_exceedances(
        db,
        scope=scope,
        key_kind=key_kind,
        key_value=key_value,
        window_seconds=window_seconds,
    )
    if recent_count < settings.RATE_LIMIT_ALERT_THRESHOLD:
        return

    source_type = f"rate_limit_spike:{scope}:{key_kind}:{key_value}"
    within_hours = max(1, ceil(window_seconds / 3600))
    admin_ids = await _get_admin_user_ids(db)

    should_alert = False
    for admin_id in admin_ids:
        exists = await notification_exists_recent(
            db,
            user_id=admin_id,
            notification_type="flag",
            source_type=source_type,
            source_id=None,
            within_hours=within_hours,
        )
        if not exists:
            should_alert = True
            await create_notification(
                db=db,
                user_id=admin_id,
                notification_type="flag",
                title="Rate limit spike detected",
                message=(
                    f"Repeated rate limit blocks were detected for {key_kind} '{key_value}' "
                    f"on scope '{scope}'."
                ),
                link="/audit-logs",
                role_target="admin",
                source_type=source_type,
                source_id=None,
            )

    if should_alert:
        await write_audit_log(
            db,
            action="RATE_LIMIT_SPIKE_DETECTED",
            ip_address=ip_address,
            actor_user_id=None,
            entity_type="security",
            details={
                "scope": scope,
                "key_kind": key_kind,
                "key_value": key_value,
                "recent_count": recent_count,
                "window_seconds": window_seconds,
            },
        )


def rate_limit(
    *,
    scope: str,
    limit: int,
    window_seconds: int,
    key_func: Callable | None = None,
    key_kind: str = "ip",
) -> Callable:
    async def guard(request: Request, db: AsyncSession = Depends(get_db)) -> None:
        if not settings.RATE_LIMIT_ENABLED:
            return

        key_suffix = await _resolve_key_suffix(request, key_func)
        key = f"{scope}:{key_suffix}"
        allowed, retry_after = await rate_limiter.check(key, limit, window_seconds)
        if allowed:
            return

        ip_address = _get_client_identifier(request)
        await write_audit_log(
            db,
            action="RATE_LIMIT_EXCEEDED",
            ip_address=ip_address,
            actor_user_id=None,
            entity_type="security",
            details={
                "scope": scope,
                "path": str(request.url.path),
                "method": request.method,
                "key_kind": key_kind,
                "key_value": key_suffix,
                "limit": limit,
                "window_seconds": window_seconds,
            },
        )
        await _maybe_alert_admins_for_rate_limit_spike(
            db,
            scope=scope,
            key_kind=key_kind,
            key_value=key_suffix,
            ip_address=ip_address,
            window_seconds=window_seconds,
        )

        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=_format_rate_limit_detail(scope),
            headers={"Retry-After": str(retry_after)},
        )

    return guard
