import { useQuery } from "@tanstack/react-query";
import type { Tables } from "@/integrations/supabase/types";
import { supabase } from "@/integrations/supabase/client";
import { Dumbbell, Upload, ClipboardList, CalendarCheck, MessageSquare, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface TimelineEntry {
  id: string;
  date: string;
  category: string;
  text: string;
  author: string;
  icon: React.ElementType;
  colorClass: string;
}

const categoryMeta: Record<string, { icon: React.ElementType; color: string }> = {
  treino: { icon: Dumbbell, color: "text-primary" },
  upload: { icon: Upload, color: "text-info" },
  avaliação: { icon: ClipboardList, color: "text-warning" },
  agendamento: { icon: CalendarCheck, color: "text-accent-foreground" },
  observação: { icon: MessageSquare, color: "text-muted-foreground" },
};

export function StudentHistory({ student }: { student: Tables<"alunos"> }) {
  const { data: profiles } = useQuery({
    queryKey: ["profiles-map"],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("user_id, full_name");
      return (data || []).reduce((m, p) => { m[p.user_id] = p.full_name; return m; }, {} as Record<string, string>);
    },
    staleTime: 60_000,
  });

  const { data: entries, isLoading } = useQuery({
    queryKey: ["historico-timeline", student.id],
    queryFn: async () => {
      const [treinos, uploads, avaliacoes, agenda, historico] = await Promise.all([
        supabase.from("treinos").select("*").eq("aluno_id", student.id).order("created_at", { ascending: false }),
        supabase.from("uploads").select("*").eq("aluno_id", student.id).order("created_at", { ascending: false }),
        supabase.from("avaliacoes").select("*").eq("aluno_id", student.id).order("created_at", { ascending: false }),
        supabase.from("agenda_servicos").select("*").eq("aluno_id", student.id).order("created_at", { ascending: false }),
        supabase.from("historico_profissional").select("*").eq("aluno_id", student.id).order("created_at", { ascending: false }),
      ]);

      const items: TimelineEntry[] = [];

      (treinos.data || []).forEach(t => items.push({
        id: `treino-${t.id}`,
        date: t.created_at,
        category: "treino",
        text: `${t.descricao} (v${t.versao}) — Status: ${t.status}`,
        author: t.autor_id,
        icon: categoryMeta.treino.icon,
        colorClass: categoryMeta.treino.color,
      }));

      (uploads.data || []).forEach(u => items.push({
        id: `upload-${u.id}`,
        date: u.created_at,
        category: "upload",
        text: `Arquivo enviado: ${u.nome_arquivo}${u.categoria ? ` (${u.categoria})` : ""}`,
        author: u.autor_id,
        icon: categoryMeta.upload.icon,
        colorClass: categoryMeta.upload.color,
      }));

      (avaliacoes.data || []).forEach(a => items.push({
        id: `avaliacao-${a.id}`,
        date: a.created_at,
        category: "avaliação",
        text: `Avaliação: ${a.tipo}${a.observacoes ? ` — ${a.observacoes}` : ""}`,
        author: a.avaliador_id,
        icon: categoryMeta["avaliação"].icon,
        colorClass: categoryMeta["avaliação"].color,
      }));

      (agenda.data || []).forEach(ag => items.push({
        id: `agenda-${ag.id}`,
        date: ag.created_at,
        category: "agendamento",
        text: `${ag.atividade} em ${ag.local} (${ag.horario_inicio.slice(0, 5)}–${ag.horario_fim.slice(0, 5)})${ag.data_especifica ? ` · ${ag.data_especifica}` : ""}`,
        author: ag.profissional_id,
        icon: categoryMeta.agendamento.icon,
        colorClass: categoryMeta.agendamento.color,
      }));

      (historico.data || []).forEach(h => items.push({
        id: `obs-${h.id}`,
        date: h.created_at,
        category: "observação",
        text: h.descricao,
        author: h.autor_id,
        icon: categoryMeta["observação"].icon,
        colorClass: categoryMeta["observação"].color,
      }));

      items.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      return items;
    },
    enabled: !!student.id,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const resolvedEntries = (entries || []).map(e => ({
    ...e,
    authorName: profiles?.[e.author] || "—",
    formattedDate: format(new Date(e.date), "dd/MM/yyyy HH:mm", { locale: ptBR }),
  }));

  return (
    <div className="space-y-4 mt-4">
      <h3 className="font-heading font-semibold text-foreground">Histórico Completo</h3>

      {resolvedEntries.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-8">Nenhum registro encontrado</p>
      ) : (
        <div className="relative">
          <div className="absolute left-4 top-0 bottom-0 w-px bg-border" />
          <div className="space-y-3">
            {resolvedEntries.map(entry => {
              const Icon = entry.icon;
              return (
                <div key={entry.id} className="relative pl-10">
                  <div className="absolute left-2.5 top-1.5 w-3 h-3 rounded-full border-2 border-background bg-muted" />
                  <div className="glass-card rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <Icon className={`w-3.5 h-3.5 ${entry.colorClass}`} />
                      <span className="text-xs font-medium text-foreground capitalize">{entry.category}</span>
                      <span className="text-xs text-muted-foreground">· {entry.formattedDate} · {entry.authorName}</span>
                    </div>
                    <p className="text-sm text-muted-foreground">{entry.text}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
