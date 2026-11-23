import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { lerAmbienteApp, redirecionarAppEquipe } from "@/lib/appInstalavel";

/** No app da equipe instalado, o portal nunca abre. */
export function AppEquipeGuard() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  useEffect(() => {
    const destino = redirecionarAppEquipe(pathname, lerAmbienteApp());
    if (destino) navigate(destino, { replace: true });
  }, [pathname, navigate]);
  return null;
}
