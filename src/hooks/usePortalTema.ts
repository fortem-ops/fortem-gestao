import { useCallback, useEffect, useState } from "react";

export type PortalTema = "escuro" | "claro";

export const PORTAL_TEMA_STORAGE_KEY = "fortem_portal_tema";
const PORTAL_TEMA_EVENT = "fortem:portal-tema";

export function lerPortalTema(): PortalTema {
  try {
    const valor = window.localStorage.getItem(PORTAL_TEMA_STORAGE_KEY);
    return valor === "claro" ? "claro" : "escuro";
  } catch {
    return "escuro";
  }
}

export function salvarPortalTema(tema: PortalTema): void {
  try {
    window.localStorage.setItem(PORTAL_TEMA_STORAGE_KEY, tema);
  } catch {
    // Ignora falha de armazenamento em modo privado restrito
  }
  window.dispatchEvent(new CustomEvent<PortalTema>(PORTAL_TEMA_EVENT, { detail: tema }));
}

export function usePortalTema() {
  const [tema, setTemaState] = useState<PortalTema>(() => lerPortalTema());

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === PORTAL_TEMA_STORAGE_KEY) {
        setTemaState(lerPortalTema());
      }
    };
    const onCustom = (e: Event) => {
      const detail = (e as CustomEvent<PortalTema>).detail;
      setTemaState(detail === "claro" ? "claro" : "escuro");
    };
    window.addEventListener("storage", onStorage);
    window.addEventListener(PORTAL_TEMA_EVENT, onCustom);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener(PORTAL_TEMA_EVENT, onCustom);
    };
  }, []);

  const setTema = useCallback((novoTema: PortalTema) => {
    setTemaState(novoTema);
    salvarPortalTema(novoTema);
  }, []);

  return { tema, setTema };
}