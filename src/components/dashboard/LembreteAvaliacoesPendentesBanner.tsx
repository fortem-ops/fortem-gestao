import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { ClipboardCheck, Dumbbell, X, ArrowRight } from "lucide-react";

type AtividadeTipo = "Treino Experimental" | "Avaliação Funcional";

interface PendingItem {
  key: string;
  agendaId: string;
  alunoId: string;
  alunoNome: string;
  atividade: AtividadeTipo;
  dataAgendamento: string; // YYYY-MM-DD
  faltam: ("funcional" | "forca" | "experimental")[];
}

const DISMISS_PREFIX = "lembrete-aval-dismiss:";
const DISMISS_MS = 24 * 60 * 60 * 1000;
const WINDOW_DAYS = 60;

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}
function addDaysISO(iso: string, days: number) {
  const d = new Date(iso + "T00:00:00");
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}
function isoDow(iso: string) {
  return new Date(iso + "T00:00:00").getDay();
}
function nowHHMM() {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

/** Banner persistente que lista avaliações pendentes do profissional logado. */
export function LembreteAvaliacoesPendentesBanner() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [, force] = useState(0);

  // Não exibir para coord/admin? — segue a regra do PRD: aparece para o profissional responsável.
  // Mesmo coord/admin podem ser profissional_id em algum agendamento, então mostramos quando há pendência atribuída a ele.

  const { data: items = [] } = useQuery({
    queryKey: ["lembrete-avaliacoes-pendentes", user?.id],
    enabled: !!user,
    refetchInterval: 60_000,
    queryFn: async (): Promise<PendingItem[]> => {
      const today = todayISO();
      const start = addDaysISO(today, -WINDOW_DAYS);

      // 1) Agendamentos do profissional dentro da janela
      const { data: agenda } = await supabase
        .from("agenda_servicos")
        .select("id, atividade, tipo, dia_semana, data_especifica, horario_inicio, aluno_id")
        .eq("profissional_id", user!.id)
        .in("atividade", ["Treino Experimental", "Avaliação Funcional"]);

      if (!agenda?.length) return [];

      // Exceções relevantes
      const ids = agenda.map((a) => a.id);
      const { data: excecoes } = await supabase
        .from("agenda_servicos_excecoes")
        .select("agenda_id, data_excecao")
        .in("agenda_id", ids);
      const excSet = new Set((excecoes || []).map((e: any) => `${e.agenda_id}:${e.data_excecao}`));

      // Expandir ocorrências (avulso direto, fixo expandido na janela)
      type Occ = { agenda: any; data: string };
      const occs: Occ[] = [];
      const hhmmNow = nowHHMM();
      for (const a of agenda as any[]) {
        if (!a.aluno_id) continue;
        if (a.tipo === "avulso") {
          if (!a.data_especifica) continue;
          if (a.data_especifica < start || a.data_especifica > today) continue;
          if (a.data_especifica === today && (a.horario_inicio || "00:00") > hhmmNow) continue;
          if (excSet.has(`${a.id}:${a.data_especifica}`)) continue;
          occs.push({ agenda: a, data: a.data_especifica });
        } else if (a.tipo === "fixo" && a.dia_semana != null) {
          for (let i = 0; i <= WINDOW_DAYS; i++) {
            const d = addDaysISO(start, i);
            if (d > today) break;
            if (isoDow(d) !== a.dia_semana) continue;
            if (d === today && (a.horario_inicio || "00:00") > hhmmNow) continue;
            if (excSet.has(`${a.id}:${d}`)) continue;
            occs.push({ agenda: a, data: d });
          }
        }
      }

      if (!occs.length) return [];

      const alunoIds = Array.from(new Set(occs.map((o) => o.agenda.aluno_id)));
      const minData = occs.reduce((m, o) => (o.data < m ? o.data : m), occs[0].data);

      const [{ data: alunos }, { data: avals }] = await Promise.all([
        supabase.from("alunos").select("id, nome").in("id", alunoIds),
        supabase
          .from("avaliacoes")
          .select("aluno_id, tipo, data")
          .in("aluno_id", alunoIds)
          .gte("data", minData),
      ]);

      const nameMap = new Map<string, string>((alunos || []).map((a: any) => [a.id, a.nome]));
      const avalList = (avals || []) as Array<{ aluno_id: string; tipo: string; data: string }>;

      const pending: PendingItem[] = [];
      // Deduplicar por (alunoId, atividade) — primeira ocorrência pendente mais antiga
      const seen = new Set<string>();
      occs.sort((a, b) => a.data.localeCompare(b.data));

      for (const o of occs) {
        const at = o.agenda.atividade as AtividadeTipo;
        const nome = nameMap.get(o.agenda.aluno_id);
        if (!nome) continue;
        const dedupKey = `${o.agenda.aluno_id}:${at}`;
        if (seen.has(dedupKey)) continue;

        const matches = avalList.filter(
          (v) => v.aluno_id === o.agenda.aluno_id && v.data >= o.data,
        );
        const has = new Set(matches.map((m) => (m.tipo || "").toLowerCase()));

        let faltam: PendingItem["faltam"] = [];
        if (at === "Treino Experimental") {
          if (!has.has("experimental")) faltam = ["experimental"];
        } else {
          if (!has.has("funcional")) faltam.push("funcional");
          if (!has.has("forca")) faltam.push("forca");
        }
        if (faltam.length === 0) {
          seen.add(dedupKey);
          continue;
        }

        seen.add(dedupKey);
        pending.push({
          key: `${o.agenda.aluno_id}:${o.data}:${at}`,
          agendaId: o.agenda.id,
          alunoId: o.agenda.aluno_id,
          alunoNome: nameMap.get(o.agenda.aluno_id) || "Aluno",
          atividade: at,
          dataAgendamento: o.data,
          faltam,
        });
      }
      return pending;
    },
  });

  // Re-render quando dismiss expira (a cada 5 min basta)
  useEffect(() => {
    const t = setInterval(() => force((n) => n + 1), 5 * 60_000);
    return () => clearInterval(t);
  }, []);

  if (!user || !items.length) return null;

  const visible = items.filter((it) => {
    const raw = localStorage.getItem(DISMISS_PREFIX + it.key);
    if (!raw) return true;
    const ts = Number(raw) || 0;
    return Date.now() - ts >= DISMISS_MS;
  });
  if (!visible.length) return null;

  const handleDismiss = (key: string, e: React.MouseEvent) => {
    e.stopPropagation();
    localStorage.setItem(DISMISS_PREFIX + key, String(Date.now()));
    force((n) => n + 1);
  };

  const handleClick = (alunoId: string) => navigate(`/avaliacoes?aluno=${alunoId}&new=1`);

  const renderText = (it: PendingItem) => {
    if (it.atividade === "Treino Experimental") {
      return (
        <>
          Você ainda não realizou a avaliação do treino experimental do aluno{" "}
          <span className="font-semibold text-foreground">{it.alunoNome}</span>
        </>
      );
    }
    const f = new Set(it.faltam);
    if (f.has("funcional") && f.has("forca")) {
      return (
        <>
          Você ainda não realizou a avaliação funcional (Funcional + Força) do aluno{" "}
          <span className="font-semibold text-foreground">{it.alunoNome}</span>
        </>
      );
    }
    if (f.has("forca")) {
      return (
        <>
          Falta registrar a avaliação de <span className="font-semibold">Força</span> do aluno{" "}
          <span className="font-semibold text-foreground">{it.alunoNome}</span>
        </>
      );
    }
    return (
      <>
        Falta registrar a avaliação <span className="font-semibold">Funcional</span> do aluno{" "}
        <span className="font-semibold text-foreground">{it.alunoNome}</span>
      </>
    );
  };

  return (
    <div className="space-y-2 animate-fade-in">
      {visible.map((it) => {
        const Icon = it.atividade === "Treino Experimental" ? Dumbbell : ClipboardCheck;
        return (
          <button
            key={it.key}
            type="button"
            onClick={() => handleClick(it.alunoId)}
            className="w-full text-left flex items-center gap-3 rounded-lg border border-warning/40 bg-warning/10 hover:bg-warning/15 transition-colors px-4 py-3 shadow-sm"
          >
            <div className="w-10 h-10 rounded-full bg-warning/20 flex items-center justify-center shrink-0">
              <Icon className="w-5 h-5 text-warning" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-muted-foreground">{renderText(it)}</p>
              <p className="text-xs text-muted-foreground/80 mt-0.5">
                Agendado em{" "}
                {new Date(it.dataAgendamento + "T00:00:00").toLocaleDateString("pt-BR")}
              </p>
            </div>
            <Button size="sm" className="gap-1">
              Avaliar <ArrowRight className="w-3.5 h-3.5" />
            </Button>
            <span
              role="button"
              tabIndex={0}
              onClick={(e) => handleDismiss(it.key, e)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleDismiss(it.key, e as any);
              }}
              className="p-1.5 rounded-md hover:bg-foreground/10 text-muted-foreground"
              aria-label="Dispensar lembrete"
            >
              <X className="w-4 h-4" />
            </span>
          </button>
        );
      })}
    </div>
  );
}
