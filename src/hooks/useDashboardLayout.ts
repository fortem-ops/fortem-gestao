import { useCallback, useEffect, useState } from "react";

export type DashboardLayout = { main: string[]; side: string[] };

const STORAGE_PREFIX = "dashboard:widget-order:";

function mergeWithDefaults(saved: Partial<DashboardLayout> | null, defaults: DashboardLayout): DashboardLayout {
  const merge = (savedArr: string[] | undefined, defArr: string[]) => {
    const filtered = (savedArr ?? []).filter((k) => defArr.includes(k));
    const missing = defArr.filter((k) => !filtered.includes(k));
    return [...filtered, ...missing];
  };
  return {
    main: merge(saved?.main, defaults.main),
    side: merge(saved?.side, defaults.side),
  };
}

export function useDashboardLayout(userId: string | null | undefined, defaults: DashboardLayout) {
  const storageKey = userId ? `${STORAGE_PREFIX}${userId}` : null;

  const read = useCallback((): DashboardLayout => {
    if (!storageKey) return defaults;
    try {
      const raw = localStorage.getItem(storageKey);
      if (!raw) return defaults;
      return mergeWithDefaults(JSON.parse(raw), defaults);
    } catch {
      return defaults;
    }
  }, [storageKey, defaults]);

  const [layout, setLayout] = useState<DashboardLayout>(read);

  // Reconcile when defaults change (e.g., role becomes available, new widget added)
  useEffect(() => {
    setLayout(read());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey, defaults.main.join("|"), defaults.side.join("|")]);

  const save = useCallback((next: DashboardLayout) => {
    setLayout(next);
    if (storageKey) {
      try { localStorage.setItem(storageKey, JSON.stringify(next)); } catch { /* noop */ }
    }
  }, [storageKey]);

  const reset = useCallback(() => {
    if (storageKey) {
      try { localStorage.removeItem(storageKey); } catch { /* noop */ }
    }
    setLayout(defaults);
  }, [storageKey, defaults]);

  return { layout, setLayout, save, reset };
}
