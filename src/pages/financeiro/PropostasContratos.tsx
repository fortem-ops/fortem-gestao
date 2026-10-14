import { Navigate } from "react-router-dom";
import { PropostasSite2027 } from "@/components/leads/PropostasSite2027";
import { useUserRoles } from "@/hooks/useUserRoles";
import { propostasAccess } from "@/lib/propostasContratos";

export default function PropostasContratos() {
  const { data: roles, isLoading, isError } = useUserRoles();
  if (isLoading) return <p className="text-sm text-muted-foreground">Carregando...</p>;
  if (isError) return <p className="text-sm text-destructive">Não foi possível verificar seu acesso.</p>;
  if (!propostasAccess(roles).canView) return <Navigate to="/" replace />;

  return (
    <div className="space-y-6 animate-fade-in">
      <h1 className="text-2xl font-heading font-bold text-foreground">Propostas de contratos</h1>
      <PropostasSite2027 />
    </div>
  );
}