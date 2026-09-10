import { useCallback, useEffect, useState } from "react";

export type StoreTheme = "light" | "dark";

const STORAGE_KEY = "fortem-loja-tema";
const listeners = new Set<(t: StoreTheme) => void>();

const readInitial = (): StoreTheme => {
  if (typeof window === "undefined") return "light";
  const stored = window.localStorage.getItem(STORAGE_KEY);
  return stored === "dark" ? "dark" : "light";
};

let current: StoreTheme = readInitial();

export interface StorePalette {
  bg: string;
  text: string;
  muted: string;
  border: string;
  surface: string;
  /** classes prontas para <Card> */
  card: string;
  /** classes prontas para <Input> */
  input: string;
}

export const storePalette = (theme: StoreTheme): StorePalette => {
  const light: StorePalette = {
    bg: "bg-white",
    text: "text-neutral-900",
    muted: "text-neutral-500",
    border: "border-neutral-200",
    surface: "bg-neutral-100",
    card: "bg-white text-neutral-900 border-neutral-200",
    input: "bg-white text-neutral-900 border-neutral-200 placeholder:text-neutral-400",
  };
  const dark: StorePalette = {
    bg: "bg-neutral-950",
    text: "text-neutral-50",
    muted: "text-neutral-400",
    border: "border-neutral-800",
    surface: "bg-neutral-900",
    card: "bg-neutral-900 text-neutral-50 border-neutral-800",
    input: "bg-neutral-900 text-neutral-50 border-neutral-800 placeholder:text-neutral-500",
  };
  return theme === "dark" ? dark : light;
};

export const useStoreTheme = () => {
  const [theme, setTheme] = useState<StoreTheme>(current);

  useEffect(() => {
    const listener = (t: StoreTheme) => setTheme(t);
    listeners.add(listener);
    setTheme(current);
    return () => {
      listeners.delete(listener);
    };
  }, []);

  const toggleTheme = useCallback(() => {
    current = current === "dark" ? "light" : "dark";
    try {
      window.localStorage.setItem(STORAGE_KEY, current);
    } catch {
      /* ignora storage indisponível */
    }
    listeners.forEach((l) => l(current));
  }, []);

  return { theme, toggleTheme, palette: storePalette(theme) };
};

export default useStoreTheme;
