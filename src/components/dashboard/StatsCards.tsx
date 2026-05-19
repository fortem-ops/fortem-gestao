import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Users, Pause, AlertCircle, ClipboardList, Dumbbell, ClipboardCheck, DollarSign, UserPlus } from "lucide-react";
import { motion } from "framer-motion";
import { useDashboardData } from "@/hooks/useDashboardData";

interface Props {
  professorId: string | null;
}

export function StatsCards({ professorId }: Props) {
  // Consolidated query: alunos, tarefas, agenda, aniversariantes via single RPC (cached 60s)
  const { data: dashboardData } = useDashboardData(professorId);
  const alunosStats = dashboardData?.alunos;
  const tarefasStats = dashboardData?.tarefas;
  const agendaHojeStats = dashboardData?.agenda
    ? {
        avaliacoes: dashboardData.agenda.avaliacoes_hoje,
        experimentais: dashboardData.agenda.experimentais_hoje,
      }
    : undefined;

  const { data: comissaoStats } = useQuery({
    queryKey: ["dashboard-comissao-stats", professorId],
    queryFn: async () => {
      const now = new Date();
      const mesInicio = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0];
      const mesFim = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split("T")[0];

      let q = supabase
        .from("comissionamentos" as any)
        .select("valor, tipo, status")
        .gte("data_referencia", mesInicio)
        .lte("data_referencia", mesFim)
        .neq("status", "cancelado");
      if (professorId) q = q.eq("profissional_id", professorId);
      const { data } = await q;

      const rows = (data || []) as Array<{ valor: number; tipo: string; status: string }>;
      let totalExp = 0;
      let totalAval = 0;
      let totalCart = 0;
      let experimentais = 0;
      let avaliacoes = 0;
      rows.forEach((r) => {
        const v = Number(r.valor) || 0;
        if (r.tipo === "treino_experimental") {
          totalExp += v;
          experimentais++;
        } else if (r.tipo === "avaliacao_funcional") {
          totalAval += v;
          avaliacoes++;
        } else {
          totalCart += v;
        }
      });

      return {
        experimentais,
        avaliacoes,
        totalExp,
        totalAval,
        totalCart,
        total: totalExp + totalAval + totalCart,
      };
    },
    staleTime: 60_000,
  });

  const row1 = [
    { label: "Alunos Ativos", value: alunosStats?.ativos ?? 0, icon: Users, color: "text-success" },
    { label: "Agregadores", value: alunosStats?.agregadores ?? 0, icon: UserPlus, color: "text-primary" },
    { label: "Em Licença", value: alunosStats?.licenca ?? 0, icon: Pause, color: "text-warning" },
  ];

  const row2 = [
    { label: "Tarefas Pendentes", value: tarefasStats?.pendentes ?? 0, icon: ClipboardList, color: "text-info" },
    { label: "Tarefas Atrasadas", value: tarefasStats?.atrasadas ?? 0, icon: AlertCircle, color: "text-destructive" },
  ];

  const row3 = [
    { label: "Avaliações Hoje", value: agendaHojeStats?.avaliacoes ?? 0, icon: ClipboardCheck, color: "text-accent-foreground" },
    { label: "Treino Exp. Hoje", value: agendaHojeStats?.experimentais ?? 0, icon: Dumbbell, color: "text-info" },
    {
      label: "Comissionamentos",
      value: `R$ ${(comissaoStats?.total ?? 0).toFixed(0)}`,
      icon: DollarSign,
      color: "text-success",
      subtitle: comissaoStats
        ? `${comissaoStats.experimentais} exp · ${comissaoStats.avaliacoes} aval`
        : undefined,
    },
  ];

  const renderCard = (stat: typeof row1[0] & { subtitle?: string }, i: number) => (
    <motion.div
      key={stat.label}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: i * 0.08 }}
      className="glass-card rounded-lg p-5"
    >
      <div className="flex items-center justify-between mb-2">
        <stat.icon className={`w-5 h-5 ${stat.color}`} />
      </div>
      <p className="text-2xl font-heading font-bold text-foreground">{stat.value}</p>
      <p className="text-xs text-muted-foreground mt-1">{stat.label}</p>
      {"subtitle" in stat && stat.subtitle && (
        <p className="text-[10px] text-muted-foreground mt-0.5">{stat.subtitle}</p>
      )}
    </motion.div>
  );

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-4">
        {row1.map((s, i) => renderCard(s, i))}
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-2 gap-4">
        {row2.map((s, i) => renderCard(s, i + row1.length))}
      </div>
      <div className="grid grid-cols-3 gap-4">
        {row3.map((s, i) => renderCard(s as any, i + row1.length + row2.length))}
      </div>
    </div>
  );
}
