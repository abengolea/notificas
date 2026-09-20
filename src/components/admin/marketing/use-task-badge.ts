"use client";

import { useEffect, useState } from "react";

type TaskBadge = { overdue: number; dueToday: number };

let cache: TaskBadge | null = null;
let cacheTime = 0;
const CACHE_MS = 60_000; // refresh every minute

export function useTaskBadge(): TaskBadge {
  const [badge, setBadge] = useState<TaskBadge>(cache ?? { overdue: 0, dueToday: 0 });

  useEffect(() => {
    if (cache && Date.now() - cacheTime < CACHE_MS) {
      setBadge(cache);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/admin/marketing/overview", { credentials: "include" });
        if (!res.ok) return;
        const data = await res.json();
        const b: TaskBadge = {
          overdue: data.tasks?.overdue ?? 0,
          dueToday: data.tasks?.dueToday ?? 0,
        };
        cache = b;
        cacheTime = Date.now();
        if (!cancelled) setBadge(b);
      } catch {
        // silent — badge is a nicety
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return badge;
}
