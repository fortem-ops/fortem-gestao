import { useEffect, useState } from "react";

/**
 * Returns a debounced copy of `value`. Use to delay re-renders / queries
 * driven by fast-changing inputs (search boxes, filters).
 */
export function useDebounce<T>(value: T, delay = 300): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);

  return debounced;
}
