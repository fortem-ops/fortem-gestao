import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { useStudentPortal } from "@/contexts/StudentPortalContext";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { SeloPlano } from "@/components/portal/SeloPlano";
import { ComoGanharConquistas } from "@/components/portal/ComoGanharConquistas";
import { useMeuPlanoClube, ultimasSemanas, EXPLICACAO_BADGE } from "@/lib/clubePlano";
import { dataClienteDesde } from "@/lib/clienteDesde";
import { cn } from "@/lib/utils";
import { Link } from "react-router-dom";
import { useMeusClubes } from "@/lib/comunidade";

const ROTULO = "text-[13px] font-bold uppercase tracking-[0.08em] text-[#B1B3B3]";
const DIAS_SEMANA = ["S", "T", "Q", "Q", "S", "S", "D"];

function hojeSP(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
}

function iniciais(nome?: string | null): string {
  const p = (nome ?? "").trim().split(/\s+/).filter(Boolean);
  if (!p.length) return "";
  return ((p[0][0] ?? "") + (p.length > 1 ? p[p.length - 1][0] : "")).toUpperCase();
}

type Treino = { data: string; modalidade: string | null };

export default function PortalPerfilProgresso() {
  const { student } = useStudentPortal();
  const [params, setParams] = useSearchParams();
  const abaParam = params.get("aba");
  const aba = abaParam === "conquistas" || abaParam === "clubes" ? abaParam : "progresso";
  const hoje = hojeSP();
  const [mes, setMes] = useState(() => hoje.slice(0, 7)); // aaaa-mm
  const [badgeAberto, setBadgeAberto] = useState<any>(null);

  const { data: meuPlano } = useMeuPlanoClube(!!student);

  const { data: treinos, isLoading } = useQuery({
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
      return (data ?? []).map((r: any) => ({ data: String(r.data).slice(0, 10), modalidade: r.treino_slots?.modalidade ?? null })) as Treino[];
    },
  });

  const { data: menorInicio } = useQuery({
    queryKey: ["portal-perfil-desde", student?.id],
    enabled: !!student,
    queryFn: async () => {
      const { data } = await supabase.from("planos").select("data_inicio")
        .eq("aluno_id", student!.id).order("data_inicio", { ascending: true }).limit(1).maybeSingle();
      return data?.data_inicio ?? null;
    },
  });

  const { data: badges } = useQuery({
    queryKey: ["portal-clube-badges", student?.id],
    enabled: !!student,
    queryFn: async () => {
      const [all, mine] = await Promise.all([
        supabase.from("clube_badges").select("*").eq("ativo", true),
        supabase.from("clube_aluno_badges").select("badge_id, conquistado_em").eq("aluno_id", student!.id),
      ]);
      const conq = new Map((mine.data || []).map((b: any) => [b.badge_id, b.conquistado_em]));
      return (all.data || []).map((b: any) => ({ ...b, conquistado: conq.has(b.id), conquistado_em: conq.get(b.id) }));
    },
  });

  const porDia = useMemo(() => {
    const m = new Map<string, { funcional: boolean; corrida: boolean }>();
    for (const t of treinos ?? []) {
      const cur = m.get(t.data) ?? { funcional: false, corrida: false };
      if (t.modalidade === "corrida") cur.corrida = true; else cur.funcional = true;
      m.set(t.data, cur);
    }
    return m;
  }, [treinos]);

  if (!student) return null;

  const desde = dataClienteDesde(menorInicio, (student as any).aluno_desde ?? null);
  const desdeFmt = desde ? format(new Date(`${desde}T12:00:00`), "MMMM 'de' yyyy", { locale: ptBR }) : null;
  const totalTreinos = treinos?.length ?? 0;
  const mesAtual = hoje.slice(0, 7);
  const treinosMes = (treinos ?? []).filter((t) => t.data.startsWith(mesAtual)).length;
  const consultoria = meuPlano?.chave === "consultoria";
  const meta = Math.max(1, meuPlano?.meta_semanal ?? 1);
  const semanas = ultimasSemanas((treinos ?? []).map((t) => t.data), meta, hoje, 12);

  // Calendário do mês selecionado (semana começa na segunda)
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

  const trocarAba = (v: "progresso" | "conquistas" | "clubes") => {
    const p = new URLSearchParams(params);
    if (v !== "progresso") p.set("aba", v); else p.delete("aba");
    setParams(p, { replace: true });
  };

  return (
    <div className="space-y-6 pb-8" style={{ fontFamily: "Archivo, sans-serif" }}>
      {/* Cabeçalho */}
      <section className="flex items-center gap-4 pt-2">
        <Avatar className="h-16 w-16 rounded-none">
          {student.foto_url && <AvatarImage src={student.foto_url} alt={student.nome} className="object-cover" />}
          <AvatarFallback className="rounded-none bg-[#2C2C2C] text-base font-black text-[#B1B3B3]">{iniciais(student.nome)}</AvatarFallback>
        </Avatar>
        <div className="min-w-0 space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-black uppercase leading-tight text-foreground">{student.nome}</h1>
            <SeloPlano chave={meuPlano?.chave} cantoneiras />
          </div>
          {desdeFmt && <p className="text-xs text-[#B1B3B3]">Treina na Fortem desde {desdeFmt}</p>}
        </div>
      </section>

      {/* Contadores */}
      <section className="grid grid-cols-3 border border-[#4A4B4B] divide-x divide-[#4A4B4B]">
        {[
          { valor: treinosMes, rotulo: "Treinos no mês" },
          { valor: consultoria ? "—" : (meuPlano?.semanas_seguidas ?? 0), rotulo: "Semanas seguidas" },
          { valor: totalTreinos, rotulo: "Treinos no total" },
        ].map((c) => (
          <div key={c.rotulo} className="px-2 py-3 text-center">
            <p className="text-2xl font-black text-foreground">{isLoading ? "…" : c.valor}</p>
            <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.06em] text-[#B1B3B3]">{c.rotulo}</p>
          </div>
        ))}
      </section>

      {/* Abas */}
      <div role="tablist" className="grid grid-cols-3 border-b border-[#4A4B4B]">
        {(["progresso", "conquistas", "clubes"] as const).map((v) => (
          <button
            key={v}
            role="tab"
            aria-selected={aba === v}
            onClick={() => trocarAba(v)}
            className={cn(
              "min-h-[44px] border-b-2 text-[13px] font-bold uppercase tracking-[0.08em]",
              aba === v ? "border-[#c8282a] text-foreground" : "border-transparent text-[#B1B3B3]",
            )}
          >
            {v === "progresso" ? "Progresso" : v === "conquistas" ? "Conquistas" : "Clubes"}
          </button>
        ))}
      </div>

      {aba === "clubes" ? <ClubesDoAluno /> : aba === "progresso" ? (
        <div className="space-y-6">
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <button onClick={() => mudarMes(-1)} aria-label="Mês anterior" className="flex h-11 w-11 items-center justify-center border border-[#4A4B4B]">
                <ChevronLeft className="h-4 w-4" />
              </button>
              <p className="text-sm font-black uppercase tracking-[0.08em] text-foreground">
                {format(primeiro, "MMMM yyyy", { locale: ptBR })}
              </p>
              <button onClick={() => mudarMes(1)} disabled={!podeAvancar} aria-label="Próximo mês" className="flex h-11 w-11 items-center justify-center border border-[#4A4B4B] disabled:opacity-30">
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
                  const t = porDia.get(dia);
                  const cor = t?.funcional ? "bg-[#c8282a] text-white" : t?.corrida ? "bg-white text-black" : "bg-[#1a1a1a] text-[#B1B3B3]";
                  return (
                    <div key={dia} className={cn("flex aspect-square items-center justify-center text-xs font-bold", cor, dia === hoje && "outline outline-1 outline-[#B1B3B3]")}>
                      {Number(dia.slice(8))}
                    </div>
                  );
                })
              )}
            </div>
            <div className="flex flex-wrap gap-4 text-[11px] text-[#B1B3B3]">
              <span className="flex items-center gap-1.5"><span className="h-3 w-3 bg-[#c8282a]" /> Funcional</span>
              <span className="flex items-center gap-1.5"><span className="h-3 w-3 bg-white" /> Corrida</span>
              <span className="flex items-center gap-1.5"><span className="h-3 w-3 bg-[#1a1a1a] border border-[#4A4B4B]" /> Sem treino</span>
            </div>
          </section>

          {!consultoria && (
            <section className="space-y-3">
              <p className={ROTULO}>Últimas 12 semanas</p>
              <div className="grid grid-cols-12 gap-1">
                {semanas.map((s) => (
                  <div
                    key={s.inicio}
                    title={`Semana de ${s.inicio.slice(8)}/${s.inicio.slice(5, 7)}: ${s.treinos} treino(s)`}
                    className={cn("aspect-square border", s.cumprida ? "border-[#c8282a] bg-[#c8282a]" : "border-[#4A4B4B] bg-transparent")}
                  />
                ))}
              </div>
              <p className="text-xs text-[#B1B3B3]">Cada quadrado é uma semana com pelo menos {meta} treinos.</p>
            </section>
          )}
        </div>
      ) : (
        <section className="space-y-3">
          <ComoGanharConquistas />
          {!badges ? <Skeleton className="h-32" /> : (
            <div className="grid grid-cols-3 gap-3">
              {badges.map((b: any) => (
                <button
                  key={b.id}
                  type="button"
                  onClick={() => setBadgeAberto(b)}
                  className={cn("min-h-[44px] border border-[#4A4B4B] bg-card p-3 text-center", !b.conquistado && "opacity-40 grayscale")}
                >
                  <p className="text-[11px] font-semibold leading-tight">{b.nome}</p>
                  <p className="text-[10px] text-muted-foreground">
                    {b.conquistado ? format(new Date(b.conquistado_em), "dd/MM/yy") : "Bloqueado"}
                  </p>
                </button>
              ))}
            </div>
          )}
        </section>
      )}

      {badgeAberto && (
        <div className="fixed inset-0 z-50 flex items-end bg-black/70" onClick={() => setBadgeAberto(null)}>
          <div
            role="dialog"
            aria-label={badgeAberto.nome}
            className="w-full space-y-3 border-t border-[#4A4B4B] bg-card p-6 pb-[max(1.5rem,env(safe-area-inset-bottom))]"
            onClick={(e) => e.stopPropagation()}
          >
            <p className={ROTULO}>Conquista</p>
            <p className="text-xl font-black uppercase text-foreground">{badgeAberto.nome}</p>
            <p className={cn("text-xs font-bold uppercase tracking-[0.08em]", badgeAberto.conquistado ? "text-[#4CC38A]" : "text-[#E3B341]")}>
              {badgeAberto.conquistado ? "Conquistada" : "Em andamento"}
            </p>
            <p className="text-sm text-muted-foreground">{EXPLICACAO_BADGE[badgeAberto.nome] ?? badgeAberto.descricao ?? ""}</p>
            <button onClick={() => setBadgeAberto(null)} className="min-h-[44px] w-full border border-[#4A4B4B] text-[13px] font-bold uppercase tracking-[0.08em] text-foreground">
              Fechar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function ClubesDoAluno() {
  const { data, isLoading } = useMeusClubes();
  const meus = (data ?? []).filter((c) => c.sou_membro && c.status === "ativo");
  if (isLoading) return <Skeleton className="h-24" />;
  if (!meus.length)
    return (
      <div className="space-y-3">
        <p className="text-sm text-[#B1B3B3]">Você ainda não participa de nenhum clube.</p>
        <Link to="/portal/comunidade?aba=clubes" className="flex min-h-[44px] items-center justify-center bg-[#C8282A] text-[13px] font-bold uppercase tracking-[0.08em] text-white">Ver clubes</Link>
      </div>
    );
  return (
    <ul className="divide-y divide-[#4A4B4B] border border-[#4A4B4B]">
      {meus.map((c) => (
        <li key={c.id}>
          <Link to={`/portal/comunidade?clube=${c.id}`} className="flex min-h-[56px] items-center gap-3 px-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center bg-[#2C2C2C] text-sm font-black text-[#B1B3B3]">{c.nome[0]?.toUpperCase()}</span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-bold text-foreground">{c.nome}</p>
              <p className="text-xs text-[#B1B3B3]">{c.meus_dias ?? 0} dias no mês</p>
            </div>
            <span className="text-lg font-black text-foreground">{c.minha_posicao ?? "—"}º</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
