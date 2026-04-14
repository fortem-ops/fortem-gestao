import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Users, Pause, AlertCircle, Briefcase, CalendarDays, ClipboardList } from "lucide-react";
import { motion } from "framer-motion";

export function StatsCards() {
  const { data: alunosStats } = useQuery({
    queryKey: ["dashboard-alunos-stats"],
    queryFn: async () => {
      const { data } = await supabase.from("alunos").select("id, status");
      const all = data || [];
      return {
        ativos: all.filter((a) => a.status === "ativo").length,
        licenca: all.filter((a) => a.status === "licenca").length,
        total: all.length,
      };
    },
  });

  const { data: carteiraStats } = useQuery({
    queryKey: ["dashboard-carteira-stats"],
    queryFn: async () => {
      const { data: planos } = await supabase.from("planos").select("aluno_id").eq("ativo", true);
      return { comPlano: new Set((planos || []).map((p) => p.aluno_id)).size };
    },
  });

  const { data: tarefasStats } = useQuery({
    queryKey: ["dashboard-tarefas-stats"],
    queryFn: async () => {
      const { data } = await supabase.from("tarefas").select("id, status, data_limite");
      const all = data || [];
      const today = new Date().toISOString().split("T")[0];
      return {
        pendentes: all.filter((t) => t.status === "pendente").length,
        atrasadas: all.filter((t) => t.status === "pendente" && t.data_limite && t.data_limite < today).length,
      };
    },
  });

  const { data: agendaStats } = useQuery({
    queryKey: ["dashboard-agenda-stats"],
    queryFn: async () => {
      const today = new Date();
      const diaSemana = today.getDay();
      const todayStr = today.toISOString().split("T")[0];
      const { data } = await supabase
        .from("agenda_servicos")
        .select("id, tipo, dia_semana, data_especifica")
        .or(`dia_semana.eq.${diaSemana},data_especifica.eq.${todayStr}`);
      return { hoje: (data || []).length };
    },
  });

  const stats = [
    { label: "Alunos Ativos", value: alunosStats?.ativos ?? 0, icon: Users, color: "text-success" },
    { label: "Em Licença", value: alunosStats?.licenca ?? 0, icon: Pause, color: "text-warning" },
    { label: "Carteiras Ativas", value: carteiraStats?.comPlano ?? 0, icon: Briefcase, color: "text-primary" },
    { label: "Tarefas Pendentes", value: tarefasStats?.pendentes ?? 0, icon: ClipboardList, color: "text-info" },
    { label: "Tarefas Atrasadas", value: tarefasStats?.atrasadas ?? 0, icon: AlertCircle, color: "text-destructive" },
    { label: "Agenda Hoje", value: agendaStats?.hoje ?? 0, icon: CalendarDays, color: "text-accent-foreground" },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
      {stats.map((stat, i) => (
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
        </motion.div>
      ))}
    </div>
  );
}
