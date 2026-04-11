from fastapi import FastAPI
from fastapi.routing import APIRoute
from app.seeds.rbac_seed import ROLE_PERMISSIONS


def _extract_perms_from_callable(call) -> list[str] | None:
    qualname = getattr(call, "__qualname__", "")
    if qualname != "require_permissions.<locals>.guard":
        return None

    closure = getattr(call, "__closure__", None)
    if not closure:
        return None

    freevars = call.__code__.co_freevars
    for i, varname in enumerate(freevars):
        if varname == "required":
            return list(closure[i].cell_contents)

    return None


def _is_check_current_user(call) -> bool:
    return getattr(call, "__name__", "") == "check_current_user"


def build_rbac_audit_report(app: FastAPI) -> list[dict]:
    results = []

    for route in app.routes:
        if not isinstance(route, APIRoute):
            continue

        methods = sorted(route.methods or [])
        path = route.path
        func_name = route.endpoint.__name__

        permissions_found: list[str] = []
        has_auth_only = False

        # 1. Route-level dependencies (dependencies=[Depends(...)])
        for dep in route.dependencies or []:
            call = dep.dependency
            perms = _extract_perms_from_callable(call)
            if perms is not None:
                permissions_found.extend(perms)
            elif _is_check_current_user(call):
                has_auth_only = True

        # 2. Parameter-level dependencies (param: T = Depends(...))
        if route.dependant:
            for sub_dep in route.dependant.dependencies or []:
                call = sub_dep.call
                perms = _extract_perms_from_callable(call)
                if perms is not None:
                    permissions_found.extend(perms)
                elif _is_check_current_user(call):
                    has_auth_only = True

        # Classify
        if permissions_found:
            unique_perms = sorted(set(permissions_found))
            role_access = [
                role
                for role, role_perms in ROLE_PERMISSIONS.items()
                if all(p in role_perms for p in unique_perms)
            ]
            auth_level = "permission-required"
            detail = {
                "permissions": unique_perms,
                "roles_with_access": sorted(role_access),
            }
        elif has_auth_only:
            auth_level = "authenticated-only"
            detail = {
                "permissions": [],
                "roles_with_access": sorted(ROLE_PERMISSIONS.keys()),
            }
        else:
            auth_level = "public"
            detail = {
                "permissions": [],
                "roles_with_access": ["*"],
            }

        for method in methods:
            results.append({
                "method": method,
                "path": path,
                "function": func_name,
                "auth_level": auth_level,
                **detail,
            })

    return results
