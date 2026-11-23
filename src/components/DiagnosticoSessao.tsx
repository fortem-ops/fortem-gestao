import { useEffect, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { registrarDiag } from "@/lib/diagnosticoApp";

/** Registra uma vez, ao abrir, o estado da sessão restaurada (sem token: só e-mail, validade e nível do 2FA). */
export function DiagnosticoSessao() {
  const { isReady, session } = useAuth();
  const feito = useRef(false);
  useEffect(() => {
    if (!isReady || feito.current) return;
    feito.current = true;
    const expira = session?.expires_at ? Math.round((session.expires_at * 1000 - Date.now()) / 60_000) : undefined;
    const base = { tipo: "sessao", tem_sessao: !!session, email: session?.user.email ?? undefined, token_min: expira };
    if (!session) {
      registrarDiag(base);
      return;
    }
    supabase.auth.mfa
      .getAuthenticatorAssuranceLevel()
      .then(({ data }) => registrarDiag({ ...base, aal: data?.currentLevel ?? undefined }))
      .catch(() => registrarDiag(base));
  }, [isReady, session]);
  return null;
}
