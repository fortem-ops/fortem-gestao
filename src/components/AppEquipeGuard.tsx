import { useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { lerAmbienteApp, lerFontesAmbiente, redirecionarAppEquipe } from "@/lib/appInstalavel";
import { registrarDiag } from "@/lib/diagnosticoApp";

/** No app da equipe instalado, o portal nunca abre. Também registra a abertura para o diagnóstico. */
export function AppEquipeGuard() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const abriu = useRef(false);
  useEffect(() => {
    if (abriu.current) return;
    abriu.current = true;
    const f = lerFontesAmbiente();
    registrarDiag({
      tipo: "abertura",
      pagina: pathname,
      standalone_nav: f.navStandalone === true,
      display_standalone: f.displayStandalone,
      ios: f.ios,
      marca_local: f.marcaLocal,
      marca_sessao: f.marcaSessao,
    });
  }, [pathname]);
  useEffect(() => {
    const destino = redirecionarAppEquipe(pathname, lerAmbienteApp());
    if (destino) {
      registrarDiag({ tipo: "redirecionamento", origem: "AppEquipeGuard", de: pathname, para: destino, motivo: "app_equipe_sem_portal" });
      navigate(destino, { replace: true });
    }
  }, [pathname, navigate]);
  return null;
}
