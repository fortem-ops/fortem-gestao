import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { useStudentPortal } from "@/contexts/StudentPortalContext";
import { Skeleton } from "@/components/ui/skeleton";
import { useMeuPlanoClube, ultimasSemanas } from "@/lib/clubePlano";
import { contarDiasComTreinoNoMes } from "@/lib/portalReorganizacao";
import { cn } from "@/lib/utils";

const ROTULO = "text-[13px] font-bold uppercase tracking-[0.08em] text-[#B1B3B3]";
const DIAS_SEMANA = ["S", "T", "Q", "Q", "S", "S", "D"];

function hojeSP(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
}

interface TreinoRealizadoRow {
  data: string;
  modalidade: string | null;
}

export function EvolucaoFrequenciaAba() {
  const { student } = useStudentPortal();
  const hoje = hojeSP();
  const mesAtual = hoje.slice(0, 7);
  const [mes, setMes] = useState(() => mesAtual);

  const { data: meuPlano } = useMeuPlanoClube(!!student);

  const { data: treinos = [], isLoading } = useQuery<TreinoRealizadoRow[]>({
    queryKey: ["portal-perfil-treinos", student?.id],
    enabled: !!student,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("treino_agendamentos")
        .select("data, treino_slots(modalidade)")
        .eq("aluno_id", student!.id)
        .eq("status", "realizado")
        .order("data", { ascending: true });
      if (error) throw error;
      return (data ?? []).map((r) => {
        const slot = r.treino_slots as { modalidade?: string | null } | null;
        return { data: String(r.data).slice(0, 10), modalidade: slot?.modalidade ?? null };
      });
    },
  });

  const { data: servicosMes = 0 } = useQuery<number>({
    queryKey: ["portal-frequencia-servicos-mes", student?.id, mes],
    enabled: !!student,
    queryFn: async () => {
      const inicio = `${mes}-01`;
      const [anoNum, mesN] = mes.split("-").map(Number);
      const ultimoDia = new Date(anoNum, mesN, 0).getDate();
      const fim = `${mes}-${String(ultimoDia).padStart(2, "0")}`;
      const { count, error } = await supabase
        .from("consumo_servicos")
        .select("id", { count: "exact", head: true })
        .eq("aluno_id", student!.id)
        .gte("data_consumo", inicio)
        .lte("data_consumo", fim);
      if (error) return 0;
      return count ?? 0;
    },
  });

  const porDia = useMemo(() => {
    const m = new Set<string>();
    for (const t of treinos) m.add(t.data);
    return m;
  }, [treinos]);

  if (!student) return null;

  const totalTreinos = treinos.length;
  const treinosNoMesAtual = treinos.filter((t) => t.data.startsWith(mesAtual));
  const diasComTreinoMes = contarDiasComTreinoNoMes(treinos.map((t) => t.data), mesAtual);

  const treinosDoMesSelecionado = treinos.filter((t) => t.data.startsWith(mes));
  const funcionalMes = treinosDoMesSelecionado.filter((t) => t.modalidade !== "corrida").length;
  const corridaMes = treinosDoMesSelecionado.filter((t) => t.modalidade === "corrida").length;

  const consultoria = meuPlano?.chave === "consultoria";
  const meta = Math.max(1, meuPlano?.meta_semanal ?? 1);
  const semanas = ultimasSemanas(treinos.map((t) => t.data), meta, hoje, 12);

  const [ano, mesNum] = mes.split("-").map(Number);
  const primeiro = new Date(ano, mesNum - 1, 1);
  const diasNoMes = new Date(ano, mesNum, 0).getDate();
  const offset = (primeiro.getDay() + 6) % 7;
  const celulas: (string | null)[] = [
    ...Array.from({ length: offset }, () => null),
    ...Array.from({ length: diasNoMes }, (_, i) => `${mes}-${String(i + 1).padStart(2, "0")}`),
  ];
  const mudarMes = (delta: number) => {
    const d = new Date(ano, mesNum - 1 + delta, 1);
    setMes(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  };
  const podeAvancar = mes < mesAtual;

  return (
    <div className="space-y-6 pb-8 animate-fade-in" style={{ fontFamily: "Archivo, sans-serif" }}>
      {/* 3 números */}
      <section className="grid grid-cols-3 divide-x divide-[#4A4B4B] border border-[#4A4B4B] bg-card">
        {[
          { valor: treinosNoMesAtual.length, rotulo: "Treinos no mês" },
          { valor: diasComTreinoMes, rotulo: "Dias com treino" },
          { valor: totalTreinos, rotulo: "Treinos no total" },
        ].map((c) => (
          <div key={c.rotulo} className="px-2 py-3.5 text-center">
            <p className="text-2xl font-black text-foreground">{isLoading ? "…" : c.valor}</p>
            <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.06em] text-[#B1B3B3]">{c.rotulo}</p>
          </div>
        ))}
      </section>

      {/* Linha Semanas seguidas treinando */}
      {!consultoria && (
        <section className="space-y-3 border border-[#4A4B4B] bg-card p-4">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-bold text-foreground">Semanas seguidas treinando</p>
            <p className="text-lg font-black text-foreground">{meuPlano?.semanas_seguidas ?? 0}</p>
          </div>
          <div className="grid grid-cols-12 gap-1">
            {semanas.map((s) => (
              <div
                key={s.inicio}
                title={`Semana de ${s.inicio.slice(8)}/${s.inicio.slice(5, 7)}: ${s.treinos} treino(s)`}
                className={cn(
                  "aspect-square border",
                  s.cumprida ? "border-[#C8282A] bg-[#C8282A]" : "border-[#4A4B4B] bg-transparent",
                )}
              />
            ))}
          </div>
          <p className="text-xs text-[#B1B3B3]">Cada quadrado é uma semana com pelo menos {meta} treinos.</p>
        </section>
      )}

      {/* Calendário mensal */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => mudarMes(-1)}
            aria-label="Mês anterior"
            className="flex h-11 w-11 items-center justify-center border border-[#4A4B4B]"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <p className="text-sm font-black uppercase tracking-[0.08em] text-foreground">
            {format(primeiro, "MMMM yyyy", { locale: ptBR })}
          </p>
          <button
            type="button"
            onClick={() => mudarMes(1)}
            disabled={!podeAvancar}
            aria-label="Próximo mês"
            className="flex h-11 w-11 items-center justify-center border border-[#4A4B4B] disabled:opacity-30"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
        <div className="grid grid-cols-7 gap-1">
          {DIAS_SEMANA.map((d, i) => (
            <p key={i} className="text-center text-[10px] font-bold text-[#B1B3B3]">{d}</p>
          ))}
          {isLoading ? (
            <Skeleton className="col-span-7 h-40" />
          ) : (
            celulas.map((dia, i) => {
              if (!dia) return <div key={`v${i}`} />;
              const treinou = porDia.has(dia);
              return (
                <div
                  key={dia}
                  className={cn(
                    "flex aspect-square items-center justify-center text-xs font-bold",
                    treinou ? "bg-[#C8282A] text-white" : "bg-card text-[#B1B3B3]",
                    dia === hoje && "outline outline-1 outline-white",
                  )}
                >
                  {Number(dia.slice(8))}
                </div>
              );
            })
          )}
        </div>
      </section>

      {/* Por modalidade no mês */}
      <section className="space-y-3">
        <p className={ROTULO}>Por modalidade no mês</p>
        <div className="grid grid-cols-3 divide-x divide-[#4A4B4B] border border-[#4A4B4B] bg-card">
          {[
            { rotulo: "Funcional", valor: funcionalMes },
            { rotulo: "Corrida", valor: corridaMes },
            { rotulo: "Serviços", valor: servicosMes },
          ].map((m) => (
            <div key={m.rotulo} className="px-2 py-3 text-center">
              <p className="text-xl font-black text-foreground">{isLoading ? "…" : m.valor}</p>
              <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.06em] text-[#B1B3B3]">{m.rotulo}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}