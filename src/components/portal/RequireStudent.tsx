import { Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Activity } from "lucide-react";

/** Guard que exige um usuário autenticado. Não-aluno é tratado pelo PortalLayout (unlinked). */
export function RequireStudent({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
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
