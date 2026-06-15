import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { StatsCards } from "@/components/dashboard/StatsCards";
import { AlertsWidget } from "@/components/dashboard/AlertsWidget";
import { AdminAlertsWidget } from "@/components/dashboard/AdminAlertsWidget";
import { TasksWidget } from "@/components/dashboard/TasksWidget";
import { BirthdaysWidget } from "@/components/dashboard/BirthdaysWidget";
import { PlansDistributionWidget } from "@/components/dashboard/PlansDistributionWidget";
import { PipelineWidget } from "@/components/dashboard/PipelineWidget";
import { ClubeWidget } from "@/components/dashboard/ClubeWidget";
import { PontoWidget } from "@/components/dashboard/PontoWidget";
import { LembretePontoBanner } from "@/components/ponto/LembretePontoBanner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export default function Dashboard() {
  const { user } = useAuth();
  const [selectedProfessorId, setSelectedProfessorId] = useState<string>("todos");

  const { data: isCoordAdmin } = useQuery({
    queryKey: ["dashboard-isCoordAdmin", user?.id],
    queryFn: async () => {
      const { data } = await supabase.rpc("is_coordinator_or_admin", { _user_id: user!.id });
      return !!data;
    },
    enabled: !!user,
    staleTime: 5 * 60_000,
  });

  const { data: isAdmin } = useQuery({
    queryKey: ["dashboard-isAdmin", user?.id],
    queryFn: async () => {
      const { data } = await supabase.rpc("is_admin", { _user_id: user!.id });
      return !!data;
    },
    enabled: !!user,
    staleTime: 5 * 60_000,
  });

  const { data: professors = [] } = useQuery({
    queryKey: ["dashboard-professors"],
    queryFn: async () => {
      const { data: roles } = await supabase
        .from("user_roles")
        .select("user_id")
        .in("role", ["professor", "coordenador", "admin"]);
      if (!roles?.length) return [];
      const userIds = roles.map((r) => r.user_id);
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, full_name")
        .in("user_id", userIds);
      return (profiles || []).sort((a, b) => a.full_name.localeCompare(b.full_name));
    },
    enabled: !!isCoordAdmin,
    staleTime: 5 * 60_000,
  });

  const effectiveProfessorId = isCoordAdmin
    ? (selectedProfessorId === "todos" ? null : selectedProfessorId)
    : user?.id || null;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-heading font-bold text-foreground">Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {isCoordAdmin ? "Visão geral da equipe técnica" : "Sua visão técnica do dia"}
          </p>
        </div>

        {isCoordAdmin && (
          <Select value={selectedProfessorId} onValueChange={setSelectedProfessorId}>
            <SelectTrigger className="w-[220px]">
              <SelectValue placeholder="Todos os professores" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os professores</SelectItem>
              {professors.map((p) => (
                <SelectItem key={p.user_id} value={p.user_id}>
                  {p.full_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      <LembretePontoBanner />

      {/* Top stats: Minha Carteira / Tarefas / Agenda do dia */}
      <StatsCards professorId={effectiveProfessorId} />

      {isCoordAdmin ? (
        // Coord/Admin layout (mantém Pipeline)
        <div className="grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <AlertsWidget professorId={effectiveProfessorId} />
            <PlansDistributionWidget />
            <AdminAlertsWidget />
          </div>
          <div className="space-y-6">
            {isAdmin && <PipelineWidget />}
            <PontoWidget />
            <ClubeWidget />
            <TasksWidget professorId={effectiveProfessorId} />
            <BirthdaysWidget professorId={effectiveProfessorId} />
          </div>
        </div>
      ) : (
        // Professor layout — ordem solicitada, sem Pipeline
        <div className="grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <AlertsWidget professorId={effectiveProfessorId} />
            <AdminAlertsWidget />
            <PlansDistributionWidget />
          </div>
          <div className="space-y-6">
            <TasksWidget professorId={effectiveProfessorId} />
            <PontoWidget />
            <BirthdaysWidget professorId={effectiveProfessorId} />
            <ClubeWidget />
          </div>
        </div>
      )}
    </div>
  );
}
