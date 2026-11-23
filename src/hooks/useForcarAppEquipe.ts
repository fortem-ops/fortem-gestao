import { useLayoutEffect } from "react";
import { useLocation } from "react-router-dom";
import { aplicarApp, forcarApp } from "@/lib/appInstalavel";

/** Usado no AppLayout: toda tela da equipe instala o app da equipe. */
export function useForcarAppEquipe() {
  const { pathname } = useLocation();
  useLayoutEffect(() => {
    forcarApp("equipe");
    aplicarApp(pathname);
    return () => forcarApp(null);
  }, [pathname]);
}
