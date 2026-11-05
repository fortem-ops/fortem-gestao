// Ranking único do portal: dias com treino realizado no mês (fn_comunidade_ranking_geral).
import { Link } from "react-router-dom";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { useRankingGeral, type LinhaRankingGeral } from "@/lib/clubePlano";

const ROTULO = "text-[13px] font-bold uppercase tracking-[0.08em] text-[#B1B3B3]";

function Linha({ l, destaque }: { l: Pick<LinhaRankingGeral, "posicao" | "nome" | "treinos_mes" | "treinos_total">; destaque?: boolean }) {
  return (
    <li className={cn("flex min-h-[52px] items-center gap-3 border px-3 py-2", destaque ? "border-[#C8282A] bg-[#C8282A]/10" : "border-[#4A4B4B] bg-card")}>
      <span className="w-9 shrink-0 text-base font-black text-foreground">{l.posicao ? `#${l.posicao}` : "—"}</span>
      <span className="flex-1 truncate text-sm font-bold text-foreground">{l.nome}{destaque ? " (você)" : ""}</span>
      <span className="text-right">
        <span className="block text-base font-black text-foreground">{l.treinos_mes}</span>
        <span className="block text-[11px] text-[#B1B3B3]">{l.treinos_total} no total</span>
      </span>
    </li>
  );
}

export function RankingGeralLista() {
  const { data, isLoading } = useRankingGeral();
  if (isLoading) return <Skeleton className="h-64" />;
  const top = data?.top ?? [];
  const eu = data?.eu;
  const euNoTop = top.some((l) => l.eh_voce);
  return (
    <section className="space-y-3" style={{ fontFamily: "Archivo, sans-serif" }}>
      <div>
        <h1 className="text-xl font-black uppercase text-foreground">Ranking FORTEM</h1>
        <p className="text-sm text-[#B1B3B3]">Dias com treino realizado neste mês. Zera todo dia 1. Treinos no total são só informativos.</p>
      </div>
      <div className="flex justify-between px-3"><span className={ROTULO}>Aluno</span><span className={ROTULO}>Treinos no mês</span></div>
      {top.length === 0 ? (
        <p className="border border-[#4A4B4B] p-4 text-sm text-[#B1B3B3]">Nenhum treino registrado neste mês ainda.</p>
      ) : (
        <ol className="space-y-2">
          {top.map((l, i) => <Linha key={i} l={l} destaque={l.eh_voce} />)}
          {eu?.participa && !euNoTop && (
            <Linha l={{ posicao: eu.posicao ?? 0, nome: eu.nome, treinos_mes: eu.treinos_mes, treinos_total: eu.treinos_total }} destaque />
          )}
        </ol>
      )}
      {eu && !eu.participa && (
        <div className="border border-[#4A4B4B] p-4 text-sm text-[#B1B3B3]">
          Você tem {eu.treinos_mes} {eu.treinos_mes === 1 ? "treino" : "treinos"} este mês. Para aparecer no ranking, participe da Comunidade.
        </div>
      )}
    </section>
  );
}

/** Resumo para Benefícios: carrega ao abrir e leva à aba Ranking da Comunidade. */
export function ResumoRankingGeral() {
  const { data, isLoading } = useRankingGeral();
  const eu = data?.eu;
  const n = eu?.treinos_mes ?? 0;
  const treinos = `${n} ${n === 1 ? "treino" : "treinos"} este mês`;
  const texto = isLoading ? "Carregando..." : eu?.participa && eu.posicao ? `#${eu.posicao} no ranking FORTEM · ${treinos}` : treinos;
  return (
    <Link to="/portal/comunidade?aba=ranking" className="flex min-h-[64px] items-center gap-3 border border-[#4A4B4B] bg-card p-4" style={{ fontFamily: "Archivo, sans-serif" }}>
      <div className="flex-1">
        <p className={ROTULO}>Ranking FORTEM</p>
        <p className="font-black text-foreground">{texto}</p>
        {!isLoading && eu && !eu.participa && <p className="text-xs text-[#B1B3B3]">Participe da Comunidade para entrar no ranking.</p>}
      </div>
      <span className="text-[13px] font-bold uppercase tracking-[0.08em] text-[#C8282A]">Ver</span>
    </Link>
  );
}
