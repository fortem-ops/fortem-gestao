import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Users, Pause, AlertCircle, ClipboardList, Dumbbell, ClipboardCheck, DollarSign, UserPlus } from "lucide-react";
import { motion } from "framer-motion";

interface Props {
  professorId: string | null;
}

const PLANOS_AGREGADORES = new Set(["Gympass/Wellhub", "Total Pass"]);

export function StatsCards({ professorId }: Props) {
  const { data: alunosStats } = useQuery({
    queryKey: ["dashboard-alunos-stats", professorId],
    queryFn: async () => {
      let q = supabase.from("alunos").select("id, status, responsavel_id");
      if (professorId) q = q.eq("responsavel_id", professorId);
      const { data } = await q;
      const all = data || [];
      const ativos = all.filter((a) => a.status === "ativo");
      const ativoIds = ativos.map((a) => a.id);

      // Get planos for active students
      let regularCount = 0;
      let agregadorCount = 0;
      if (ativoIds.length > 0) {
        const { data: planos } = await supabase
          .from("planos")
          .select("aluno_id, tipo")
          .eq("ativo", true)
          .in("aluno_id", ativoIds);
        const seen = new Set<string>();
        (planos || []).forEach((p) => {
          if (seen.has(p.aluno_id)) return;
          seen.add(p.aluno_id);
          if (PLANOS_AGREGADORES_SET.has(p.tipo)) agregadorCount++;
          else regularCount++;
        });
      }

      return {
        ativos: regularCount,
        agregadores: agregadorCount,
        licenca: all.filter((a) => a.status === "licenca").length,
      };
    },
  });

  const { data: tarefasStats } = useQuery({
    queryKey: ["dashboard-tarefas-stats", professorId],
    queryFn: async () => {
      let q = supabase.from("tarefas").select("id, status, data_limite, responsavel_id");
      if (professorId) q = q.eq("responsavel_id", professorId);
      const { data } = await q;
      const all = data || [];
      const today = new Date().toISOString().split("T")[0];
      return {
        pendentes: all.filter((t) => t.status === "pendente").length,
        atrasadas: all.filter((t) => t.status === "pendente" && t.data_limite && t.data_limite < today).length,
      };
    },
  });

  const { data: agendaHojeStats } = useQuery({
    queryKey: ["dashboard-agenda-hoje-stats", professorId],
    queryFn: async () => {
      const today = new Date();
      const diaSemana = today.getDay();
      const todayStr = today.toISOString().split("T")[0];

      let q = supabase
        .from("agenda_servicos")
        .select("id, atividade, profissional_id, dia_semana, data_especifica, horario_fim")
        .or(`dia_semana.eq.${diaSemana},data_especifica.eq.${todayStr}`);
      if (professorId) q = q.eq("profissional_id", professorId);
      const { data } = await q;
      const events = data || [];

      return {
        avaliacoes: events.filter((e) =>
          e.atividade === "Avaliação Funcional" || e.atividade === "Avaliação Física"
        ).length,
        experimentais: events.filter((e) => e.atividade === "Treino Experimental").length,
      };
    },
  });

  const { data: comissaoStats } = useQuery({
    queryKey: ["dashboard-comissao-stats", professorId],
    queryFn: async () => {
      const now = new Date();
      const mesInicio = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0];
      const mesFim = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split("T")[0];

      // 1) Comissão treino experimental: agenda concluída (horário passado) + relatório experimental
      const diaSemanaHoje = now.getDay();
      const todayStr = now.toISOString().split("T")[0];
      const nowTime = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}:00`;

      // Get all experimental training events this month that are concluded (time passed)
      let expQ = supabase
        .from("agenda_servicos")
        .select("id, aluno_id, profissional_id, horario_fim, dia_semana, data_especifica, tipo")
        .eq("atividade", "Treino Experimental");
      if (professorId) expQ = expQ.eq("profissional_id", professorId);
      const { data: expEvents } = await expQ;

      // Get experimental reports this month
      const { data: expReports } = await supabase
        .from("avaliacoes")
        .select("aluno_id, data")
        .eq("tipo", "experimental")
        .gte("data", mesInicio)
        .lte("data", mesFim);

      const expReportAlunos = new Set((expReports || []).map((r) => r.aluno_id));

      // Count concluded experimental trainings this month with reports
      let comissaoExp = 0;
      (expEvents || []).forEach((ev) => {
        if (!ev.aluno_id || !expReportAlunos.has(ev.aluno_id)) return;
        // Check if event is in this month and concluded
        if (ev.tipo === "avulso" && ev.data_especifica) {
          if (ev.data_especifica >= mesInicio && ev.data_especifica <= mesFim) {
            // Check if time passed
            if (ev.data_especifica < todayStr || (ev.data_especifica === todayStr && ev.horario_fim <= nowTime)) {
              comissaoExp++;
            }
          }
        }
        // For fixed events, approximate: count occurrences this month that have passed
        if (ev.tipo === "fixo") {
          const start = new Date(mesInicio + "T00:00:00");
          const end = new Date(mesFim + "T23:59:59");
          for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
            if (d.getDay() === ev.dia_semana) {
              const dStr = d.toISOString().split("T")[0];
              if (dStr < todayStr || (dStr === todayStr && ev.horario_fim <= nowTime)) {
                comissaoExp++;
              }
            }
          }
        }
      });

      // 2) Comissão avaliação funcional: avaliação funcional + upload avaliação de força
      const { data: funcAvals } = await supabase
        .from("avaliacoes")
        .select("aluno_id, avaliador_id, data")
        .eq("tipo", "funcional")
        .gte("data", mesInicio)
        .lte("data", mesFim);

      let filteredAvals = funcAvals || [];
      if (professorId) {
        filteredAvals = filteredAvals.filter((a) => a.avaliador_id === professorId);
      }

      const { data: forcaUploads } = await supabase
        .from("uploads")
        .select("aluno_id, created_at")
        .eq("categoria", "avaliacao_forca")
        .gte("created_at", mesInicio + "T00:00:00")
        .lte("created_at", mesFim + "T23:59:59");

      const forcaAlunos = new Set((forcaUploads || []).map((u) => u.aluno_id));
      const comissaoAval = filteredAvals.filter((a) => forcaAlunos.has(a.aluno_id)).length;

      const totalExp = comissaoExp * 30;
      const totalAval = comissaoAval * 35;

      return {
        experimentais: comissaoExp,
        avaliacoes: comissaoAval,
        totalExp,
        totalAval,
        total: totalExp + totalAval,
      };
    },
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
