import { useEffect, useRef, useCallback } from "react";

/**
 * usePolling — runs `fn` immediately on mount, then every `intervalMs`.
 *
 * Also triggers an immediate background refresh whenever the
 * "hdb:new-notification" custom event fires (e.g. unread count increases
 * in the NotificationBell), so data updates as soon as a notification lands.
 *
 * fn receives `{ background: boolean }` — true on every call after the first.
 * Use this to skip showing a loading spinner on background refreshes.
 *
 * Pauses polling when the browser tab is hidden; refetches immediately
 * when the tab becomes visible again. Cleans up on unmount.
 *
 * @param {({ background: boolean }) => void | Promise<void>} fn
 * @param {number} intervalMs
 */
export function usePolling(fn, intervalMs) {
  const fnRef = useRef(fn);
  const firstRef = useRef(true);
  useEffect(() => { fnRef.current = fn; }, [fn]);

  const run = useCallback(() => {
    const background = !firstRef.current;
    firstRef.current = false;
    fnRef.current({ background });
  }, []);

  const start = useCallback(() => {
    const id = setInterval(() => {
      if (!document.hidden) run();
    }, intervalMs);
    return id;
  }, [intervalMs, run]);

  useEffect(() => {
    run(); // immediate first call (background: false)

    let timerId = start();

    // Re-fetch immediately when tab regains focus
    const onVisibility = () => {
      if (!document.hidden) {
        run();
        clearInterval(timerId);
        timerId = start();
      }
    };

    // Re-fetch immediately when a new notification arrives
    const onNewNotification = () => {
      if (!document.hidden) run();
    };

    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("hdb:new-notification", onNewNotification);

    return () => {
      clearInterval(timerId);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("hdb:new-notification", onNewNotification);
    };
  }, [start, run]);
}
