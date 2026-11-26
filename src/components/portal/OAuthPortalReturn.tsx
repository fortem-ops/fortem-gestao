import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { checarPapelEquipe } from "@/lib/authAccess";
import { consumirRetornoOAuthPortal } from "@/lib/oauthPortalReturn";
import { registrarDiag } from "@/lib/diagnosticoApp";

/**
 * Após retorno de login social (Google/Apple) em redirect_uri = window.location.origin,
 * leva o aluno direto para /portal e equipe para /equipe, inclusive no app instalado (PWA).
 */
export function OAuthPortalReturn() {
  const { user, isReady } = useAuth();
  const { pathname } = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    if (!isReady || !user) return;
    if (!consumirRetornoOAuthPortal()) return;
    let cancelado = false;
    checarPapelEquipe(user.id).then((r) => {
      if (cancelado || r.status === "erro") return;
      const para = r.status === "equipe" ? "/equipe" : "/portal";
      registrarDiag({
        tipo: "redirecionamento",
        origem: "OAuthPortalReturn",
        de: pathname,
        para,
        motivo: r.status,
      });
      navigate(para, { replace: true });
    });
    return () => {
      cancelado = true;
    };
  }, [isReady, user, pathname, navigate]);

  return null;
}