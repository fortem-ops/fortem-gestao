import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useStudentPortal } from "@/contexts/StudentPortalContext";
import { agendaOculta } from "@/lib/portalAgenda";

/** Redireciona /portal/agenda para Treinos só quando o aluno é confirmadamente só Consultoria Online. */
export function AgendaGuard({ children }: { children: ReactNode }) {
  const { somenteOnline, somenteOnlineLoading } = useStudentPortal();
  if (somenteOnlineLoading) return null;
  if (agendaOculta(somenteOnline)) return <Navigate to="/portal/treinos" replace />;
  return <>{children}</>;
}
