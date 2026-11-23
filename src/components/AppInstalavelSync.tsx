import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { aplicarApp } from "@/lib/appInstalavel";

/** Troca manifest/ícone/título da tela inicial conforme a rota. */
export function AppInstalavelSync() {
  const { pathname } = useLocation();
  useEffect(() => {
    aplicarApp(pathname);
  }, [pathname]);
  return null;
}
