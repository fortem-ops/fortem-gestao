import { useEffect } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { registrarDiag } from "@/lib/diagnosticoApp";
import { useAuth } from "@/contexts/AuthContext";
import { Activity } from "lucide-react";

/** Guard que exige um usuário autenticado. Não-aluno é tratado pelo PortalLayout (unlinked). */
export function RequireStudent({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const { pathname } = useLocation();
  const semUsuario = !loading && !user;
  useEffect(() => {
    if (semUsuario) registrarDiag({ tipo: "redirecionamento", origem: "RequireStudent", de: pathname, para: "/portal/login", motivo: "sem_sessao" });
  }, [semUsuario, pathname]);
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Activity className="w-7 h-7 animate-pulse text-primary" />
      </div>
    );
  }
  if (!user) return <Navigate to="/portal/login" replace />;
  return <>{children}</>;
}

/** /portal → /portal/home, registrando no diagnóstico. */
export function PortalInicio() {
  useEffect(() => {
    registrarDiag({ tipo: "redirecionamento", origem: "rota /portal", de: "/portal", para: "/portal/home", motivo: "inicio_portal" });
  }, []);
  return <Navigate to="/portal/home" replace />;
}
