import { useMemo, useState, type ReactNode } from "react";
import { differenceInDays, format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { AlertCircle, ArrowRight, CalendarCheck, ChevronDown, ClipboardCheck, TrendingUp } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { BodyMapSVG } from "@/components/student/assessment/funcionalV2/BodyMapSVG";
import { useBodyMapShapes } from "@/components/student/assessment/funcionalV2/useBodyMapShapes";
import {
  analyze,
  ASSIMETRIA_NIVEL_LABEL,
  type Layer,
} from "@/components/student/assessment/funcionalV2/bodyMapLogic";
import {
  escolherResumoReferencia,
  type ResumoReferencia,
  type ResumoReferenciaPortal,
} from "./referenciaResumoPortal";
import {
  montarResumoAssimetriaEvolucao,
  type AssimetriaResumoEvolucao,
  type TendenciaAssimetria,
} from "@/components/avaliacoes-premium/assimetriaGrafico";
import type { ConsolidadoAluno } from "@/components/avaliacoes-premium/useAlunoAvaliacoesConsolidadas";
import type { FaixaEtaria } from "@/lib/faixaEtaria";
import {
  agruparMedidasPortal,
  deduplicarCadeias,
  filtrarComparativoMudou,
  montarAneisPortal,
  montarMedidasPortal,
  montarResumoPortal,
  portalMetricLabel,
  portalNivel,
  portalNivelLabel,
  type PortalMedida,
  type PortalNivel,
} from "./portalAssessmentLogic";

interface Props {
  data: ConsolidadoAluno;
  sexo?: "M" | "F";
  faixaEtaria?: FaixaEtaria | null;
  resumoReferencia?: ResumoReferenciaPortal;
}

const NIVEL_STYLE: Record<PortalNivel, { text: string; bg: string; stroke: string }> = {
  equilibrado: { text: "text-emerald-400", bg: "bg-emerald-400/10 border-emerald-400/25", stroke: "#34d399" },
  atencao: { text: "text-amber-400", bg: "bg-amber-400/10 border-amber-400/25", stroke: "#fbbf24" },
  prioridade: { text: "text-[#fb806c]", bg: "bg-[#fb806c]/10 border-[#fb806c]/25", stroke: "#fb806c" },
};

const MESES_IDEAL_REAVALIAR = 4;

function numero(value: number, casas = 1): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(casas).replace(".", ",");
}

export function PortalAssessmentMobile({ data, sexo, faixaEtaria, resumoReferencia }: Props) {
  const latest = data.funcional.latest;
  const medidas = useMemo(() => montarMedidasPortal(latest), [latest]);
  const resumo = useMemo(() => montarResumoPortal(medidas), [medidas]);
  const gruposMedidas = useMemo(() => agruparMedidasPortal(medidas), [medidas]);
  const aneis = useMemo(() => montarAneisPortal(medidas), [medidas]);
  const pontos = medidas.filter((m) => m.nivel !== "equilibrado");
  const history = data.funcional.history;
  const datas = history.map((item) => item.data);
  const evolucaoMobilidade = useMemo(
    () => montarResumoAssimetriaEvolucao(history, "mobilidade", datas),
    [history, datas.join("|")],
  );
  const evolucaoForca = useMemo(
    () => montarResumoAssimetriaEvolucao(history, "forca", datas),
    [history, datas.join("|")],
  );
  const comparativo = useMemo(
    () => filtrarComparativoMudou(history[1] ?? null, history[0] ?? null),
    [history],
  );
  const analysis = useMemo(
    () => latest ? analyze(latest.metricas, "asymmetry", latest.forca, sexo, undefined, faixaEtaria) : null,
    [latest, sexo, faixaEtaria],
  );
  const chains = useMemo(() => deduplicarCadeias(analysis?.chains ?? []), [analysis]);

  if (!latest) return null;

  return (
    <div className="space-y-4 min-w-0">
      <header className="pt-2">
        <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground">Avaliação funcional</p>
        <h1 className="font-heading text-2xl font-black text-foreground">Minha avaliação</h1>
        <p className="mt-1 text-xs text-muted-foreground">
          {format(parseISO(`${latest.data}T12:00:00`), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
        </p>
      </header>

      <ReassessmentCard latestDate={latest.data} />

      <section className="rounded-2xl border border-border bg-card p-4">
        <p className="font-heading text-lg font-bold text-foreground">{resumo.titulo}</p>
        <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{resumo.frase}</p>
        <div className="mt-5 grid grid-cols-3 gap-2">
          {aneis.map((anel) => <CountRing key={anel.camada} {...anel} />)}
        </div>
      </section>

      <PortalBodyMap snapshot={latest} />

      {pontos.length > 0 && (
        <section className="space-y-2">
          <SectionHeading>Pontos de atenção</SectionHeading>
          <div className="overflow-hidden rounded-2xl border border-border bg-card px-4">
            {pontos.map((medida) => <MeasureRow key={medida.id} medida={medida} />)}
          </div>
        </section>
      )}

      <div className="space-y-2">
        <DetailsCard title="Todas as medidas" subtitle="Valores dos dois lados e nível de equilíbrio.">
          <div className="mb-4 rounded-xl bg-secondary/60 p-3 text-xs leading-relaxed text-muted-foreground">
            <div className="mb-2 flex flex-wrap gap-x-3 gap-y-1">
              <LegendDot nivel="equilibrado" label={`${ASSIMETRIA_NIVEL_LABEL.nenhuma}: abaixo de 10%`} />
              <LegendDot nivel="atencao" label={`${ASSIMETRIA_NIVEL_LABEL.moderada}: 10% a 20%`} />
              <LegendDot nivel="prioridade" label={`${ASSIMETRIA_NIVEL_LABEL.severa}: acima de 20%`} />
            </div>
            Psoas é medido em graus: {ASSIMETRIA_NIVEL_LABEL.moderada} a partir de 3° e {ASSIMETRIA_NIVEL_LABEL.severa} a partir de 5°.
          </div>
          <div className="space-y-5">
            {gruposMedidas.map((grupo) => (
              <section key={grupo.camada} aria-labelledby={`portal-grupo-${grupo.camada}`}>
                <h3 id={`portal-grupo-${grupo.camada}`} className="mb-1 text-xs font-bold uppercase text-muted-foreground">{grupo.label}</h3>
                <div className="divide-y divide-border">{grupo.medidas.map((m) => <MeasureRow key={m.id} medida={m} />)}</div>
              </section>
            ))}
          </div>
        </DetailsCard>

        {history.length >= 2 && (
          <DetailsCard title="Evolução" subtitle="Como a diferença entre os lados mudou no tempo.">
            <div className="space-y-5">
              {[...evolucaoMobilidade, ...evolucaoForca].map((item) => <EvolutionRow key={item.key} item={item} />)}
              {evolucaoForca.length === 0 && <EmptyLine>Nenhuma avaliação de força registrada ainda.</EmptyLine>}
            </div>
          </DetailsCard>
        )}

        {history.length >= 2 && (
          <DetailsCard title="Comparativo" subtitle="O que mudou desde a avaliação anterior.">
            <div className="space-y-4">
              {comparativo.mobilidade.map((row) => (
                <div key={row.metric} className="border-b border-border pb-4 last:border-0">
                  <p className="mb-2 text-sm font-semibold text-foreground">{portalMetricLabel(row.metric)}</p>
                  <ComparisonSide label="Esq." before={row.esquerdo.antes} after={row.esquerdo.depois} variation={row.esquerdo.variacao} tone={row.esquerdo.tom} unit="°" />
                  <ComparisonSide label="Dir." before={row.direito.antes} after={row.direito.depois} variation={row.direito.variacao} tone={row.direito.tom} unit="°" />
                </div>
              ))}
              <EmptyLine>{comparativo.mobilidadeSemMudanca} {comparativo.mobilidadeSemMudanca === 1 ? "medida sem mudança" : "medidas sem mudança"} nos dois lados.</EmptyLine>
              {comparativo.forca.map((row) => (
                <div key={row.nome} className="border-b border-border pb-4 last:border-0">
                  <p className="mb-2 text-sm font-semibold text-foreground">{row.label}</p>
                  <ComparisonSide label="Esq." before={row.esquerdo.antes} after={row.esquerdo.depois} variation={row.esquerdo.variacaoPct} tone={forceTone(row.esquerdo.movimento)} unit="kg" variationUnit="%" />
                  <ComparisonSide label="Dir." before={row.direito.antes} after={row.direito.depois} variation={row.direito.variacaoPct} tone={forceTone(row.direito.movimento)} unit="kg" variationUnit="%" />
                </div>
              ))}
              {comparativo.forca.length === 0 && comparativo.forcaSemMudanca === 0 && <EmptyLine>Nenhuma avaliação de força registrada nas duas datas.</EmptyLine>}
            </div>
          </DetailsCard>
        )}

        {chains.length > 0 && (
          <DetailsCard title="Relação entre regiões" subtitle="Possíveis cadeias compensatórias observadas.">
            <ul className="space-y-2 text-sm leading-relaxed text-muted-foreground">
              {chains.map((chain) => <li key={chain.reason} className="rounded-xl bg-secondary/60 p-3">{chain.reason}</li>)}
            </ul>
          </DetailsCard>
        )}

        <DetailsCard title="Como me comparo com a base Fortem" subtitle="Distribuição por sexo e faixa etária.">
          {!sexo ? (
            <EmptyLine>Comparação indisponível: informe o sexo no cadastro.</EmptyLine>
          ) : (
            <ReferenceCurves measures={medidas.filter((m) => m.camada !== "forca")} sexo={sexo} faixaEtaria={faixaEtaria} referenceData={referenceData} />
          )}
        </DetailsCard>

        {data.composicao.latest && (
          <DetailsCard title="Composição corporal" subtitle={`${data.composicao.history.length} ${data.composicao.history.length === 1 ? "medição registrada" : "medições registradas"}.`}>
            <CompositionContent data={data} />
          </DetailsCard>
        )}

        {assessmentHistory(data).length > 0 && (
          <DetailsCard title="Histórico de avaliações" subtitle="Todas as avaliações registradas por tipo e data.">
            <AssessmentHistory data={data} />
          </DetailsCard>
        )}
      </div>
    </div>
  );
}

function SectionHeading({ children }: { children: ReactNode }) {
  return <h2 className="font-heading text-base font-bold text-foreground">{children}</h2>;
}

function CountRing({ label, pontos, total, piorNivel }: ReturnType<typeof montarAneisPortal>[number]) {
  const size = 74;
  const r = 29;
  const circ = 2 * Math.PI * r;
  const progress = total ? pontos / total : 0;
  const color = piorNivel ? NIVEL_STYLE[piorNivel].stroke : "#555";
  return (
    <div className="flex min-w-0 flex-col items-center text-center">
      <div className="relative h-[74px] w-[74px]">
        <svg width={size} height={size} className="-rotate-90" aria-hidden>
          <circle cx={37} cy={37} r={r} fill="none" stroke="#333" strokeWidth={5} />
          {total > 0 && <circle cx={37} cy={37} r={r} fill="none" stroke={color} strokeWidth={5} strokeDasharray={`${progress * circ} ${circ}`} strokeLinecap="round" />}
        </svg>
        <span className="absolute inset-0 flex items-center justify-center font-heading text-xl font-bold text-foreground">{total ? pontos : "—"}</span>
      </div>
      <span className="mt-1 w-full truncate text-[11px] font-semibold text-muted-foreground">{label}</span>
      <span className="text-[10px] text-muted-foreground">{total ? `de ${total}` : "sem dado"}</span>
    </div>
  );
}

function MeasureRow({ medida }: { medida: PortalMedida }) {
  const style = NIVEL_STYLE[medida.nivel];
  return (
    <div className="flex min-w-0 items-center gap-3 border-b border-border py-3 last:border-b-0">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm font-semibold leading-snug text-foreground">{medida.nome}</p>
          {medida.camada === "forca" && <span className="rounded border border-border bg-secondary px-1.5 py-0.5 text-[9px] font-bold uppercase text-muted-foreground">Força</span>}
        </div>
        <p className="mt-1 text-xs text-muted-foreground">Esq. {numero(medida.esquerdo)}{medida.unidadeLados} · Dir. {numero(medida.direito)}{medida.unidadeLados}</p>
      </div>
      <div className="w-[76px] shrink-0 text-center">
        <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-bold ${style.text} ${style.bg}`}>
          {numero(medida.diferenca)}{medida.unidadeDiferenca}
        </span>
        <p className={`mt-1 text-[10px] font-semibold ${style.text}`}>{portalNivelLabel(medida.nivel)}</p>
      </div>
    </div>
  );
}

function DetailsCard({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <Collapsible open={open} onOpenChange={setOpen} className="overflow-hidden rounded-2xl border border-border bg-card">
      <CollapsibleTrigger className="flex min-h-16 w-full items-center gap-3 px-4 py-3 text-left">
        <div className="min-w-0 flex-1">
          <p className="font-heading text-sm font-bold text-foreground">{title}</p>
          <p className="mt-0.5 text-xs leading-snug text-muted-foreground">{subtitle}</p>
        </div>
        <ChevronDown className={`h-5 w-5 shrink-0 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} />
      </CollapsibleTrigger>
      <CollapsibleContent className="border-t border-border px-4 py-4">{children}</CollapsibleContent>
    </Collapsible>
  );
}

function LegendDot({ nivel, label }: { nivel: PortalNivel; label: string }) {
  return <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full" style={{ background: NIVEL_STYLE[nivel].stroke }} />{label}</span>;
}

function EmptyLine({ children }: { children: ReactNode }) {
  return <p className="rounded-xl bg-secondary/60 p-3 text-xs leading-relaxed text-muted-foreground">{children}</p>;
}

function PortalBodyMap({ snapshot }: { snapshot: NonNullable<ConsolidadoAluno["funcional"]["latest"]> }) {
  const { shapesMap } = useBodyMapShapes();
  const [layer, setLayer] = useState<Layer>("mobility");
  const [view, setView] = useState<"both" | "front" | "back">("both");
  const layers: Array<{ id: Layer; label: string }> = [
    { id: "mobility", label: "Mobilidade" },
    { id: "flexibility", label: "Flexibilidade" },
    { id: "strength", label: "Força" },
    { id: "asymmetry", label: "Tudo" },
  ];
  return (
    <section className="bodymap-surface min-w-0 overflow-hidden rounded-2xl p-3">
       <div className="mb-3 grid grid-cols-4 gap-1 pb-1">
        {layers.map((item) => <button key={item.id} onClick={() => setLayer(item.id)} className={`min-h-11 flex-1 whitespace-nowrap rounded-xl px-2 text-xs font-semibold ${layer === item.id ? "bg-white text-black" : "bg-white/5 text-white/60"}`}>{item.label}</button>)}
      </div>
      <BodyMapSVG viewFilter={view} layer={layer} metrics={snapshot.metricas} forcaExercises={snapshot.forca} shapesMap={shapesMap} />
      <div className="mt-3 grid grid-cols-3 gap-2">
        <button onClick={() => setView("both")} className={`min-h-11 rounded-xl text-xs font-semibold ${view === "both" ? "bg-white/15 text-white" : "bg-white/5 text-white/50"}`}>Ambas</button>
        <button onClick={() => setView("front")} className={`min-h-11 rounded-xl text-xs font-semibold ${view === "front" ? "bg-white/15 text-white" : "bg-white/5 text-white/50"}`}>Vista anterior</button>
        <button onClick={() => setView("back")} className={`min-h-11 rounded-xl text-xs font-semibold ${view === "back" ? "bg-white/15 text-white" : "bg-white/5 text-white/50"}`}>Vista posterior</button>
      </div>
    </section>
  );
}

function EvolutionRow({ item }: { item: AssimetriaResumoEvolucao }) {
  if (!item.ultima) return null;
  const trend: Record<TendenciaAssimetria, { label: string; className: string }> = {
    melhorou: { label: "Diminuiu a diferença", className: "text-emerald-400" },
    piorou: { label: "Aumentou a diferença", className: "text-[#fb806c]" },
    estavel: { label: "Sem mudança", className: "text-muted-foreground" },
  };
  const current = portalNivel(item.ultima.nivel);
  return (
    <div>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-foreground">{portalMetricLabel(item.nome)}</p>
          <p className={`mt-0.5 text-xs font-medium ${trend[item.tendencia].className}`}>{trend[item.tendencia].label}{item.inverteu ? " · lado mais fraco trocou" : ""}</p>
        </div>
        <span className={`shrink-0 rounded-full border px-2 py-1 text-xs font-bold ${NIVEL_STYLE[current].text} ${NIVEL_STYLE[current].bg}`}>{numero(item.ultima.valor)}{item.unidade}</span>
      </div>
      <MiniTrend item={item} />
    </div>
  );
}

function MiniTrend({ item }: { item: AssimetriaResumoEvolucao }) {
  const w = 320, h = 92, pad = 8;
  const firstTime = item.pontos[0]?.timestamp ?? 0;
  const lastTime = item.pontos[item.pontos.length - 1]?.timestamp ?? firstTime + 1;
  const maxY = Math.max(item.corteSevero * 1.5, ...item.pontos.map((p) => p.valor), 1);
  const x = (t: number) => pad + ((t - firstTime) / (lastTime - firstTime || 1)) * (w - pad * 2);
  const y = (v: number) => h - pad - (v / maxY) * (h - pad * 2);
  const points = item.pontos.map((p) => `${x(p.timestamp)},${y(p.valor)}`).join(" ");
  const last = item.pontos[item.pontos.length - 1];
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="mt-2 h-[92px] w-full overflow-hidden rounded-lg" role="img" aria-label={`Evolução de ${item.nome}`}>
      <rect x="0" y={y(item.corteModerado)} width={w} height={h - y(item.corteModerado)} fill="#34d399" opacity=".10" />
      <rect x="0" y={y(item.corteSevero)} width={w} height={y(item.corteModerado) - y(item.corteSevero)} fill="#fbbf24" opacity=".15" />
      <rect x="0" y="0" width={w} height={y(item.corteSevero)} fill="#fb806c" opacity=".12" />
      <line x1="0" x2={w} y1={y(item.corteModerado)} y2={y(item.corteModerado)} stroke="#fbbf24" strokeDasharray="3 3" opacity=".5" />
      <line x1="0" x2={w} y1={y(item.corteSevero)} y2={y(item.corteSevero)} stroke="#fb806c" strokeDasharray="3 3" opacity=".5" />
      <polyline points={points} fill="none" stroke="#d4d4d4" strokeWidth="2" />
      {item.pontos.map((p, index) => <circle key={`${p.data}-${index}`} cx={x(p.timestamp)} cy={y(p.valor)} r={p === last ? 4 : 2.5} fill={p === last ? NIVEL_STYLE[portalNivel(p.nivel)].stroke : "#a3a3a3"} />)}
    </svg>
  );
}

function ComparisonSide({ label, before, after, variation, tone, unit, variationUnit = unit }: { label: string; before: number | null; after: number | null; variation: number | null; tone: "melhora" | "piora" | "neutro"; unit: string; variationUnit?: string }) {
  const color = tone === "melhora" ? "text-emerald-400" : tone === "piora" ? "text-[#fb806c]" : "text-muted-foreground";
  const value = (v: number | null) => v == null ? "—" : `${numero(v)}${unit}`;
  return <p className="py-1 text-xs text-muted-foreground"><span className="inline-block w-9">{label}</span><span className="text-foreground">{value(before)} → {value(after)}</span>{variation != null && <span className={`ml-2 font-semibold ${color}`}>{variation > 0 ? "+" : ""}{numero(variation)}{variationUnit}</span>}</p>;
}

function forceTone(movement: string | null): "melhora" | "piora" | "neutro" {
  return movement === "Ganhou força" ? "melhora" : movement === "Perdeu força" ? "piora" : "neutro";
}

function ReferenceCurves({ measures, sexo, faixaEtaria, referenceData }: { measures: PortalMedida[]; sexo: "M" | "F"; faixaEtaria?: FaixaEtaria | null; referenceData?: MobilidadeReferenceData }) {
  const cards = measures.flatMap((measure) => {
    const bucket = referenceData?.[measure.origem]?.[sexo];
    const base = arrayReferencia(bucket, faixaEtaria);
    if (!base) return [];
    return [{ measure, base }];
  });
  if (!cards.length) return <EmptyLine>Sem base suficiente para esta faixa.</EmptyLine>;
  return <div className="space-y-3">{cards.map(({ measure, base }) => <ReferenceCurve key={measure.id} measure={measure} base={base} sexo={sexo} faixaEtaria={faixaEtaria} referenceData={referenceData} />)}</div>;
}

function ReferenceCurve({ measure, base }: { measure: PortalMedida; base: number[]; sexo: "M" | "F"; faixaEtaria?: FaixaEtaria | null; referenceData?: MobilidadeReferenceData }) {
  const mean = base.reduce((sum, value) => sum + value, 0) / base.length;
  const sigma = Math.sqrt(base.reduce((sum, value) => sum + (value - mean) ** 2, 0) / base.length) || 1;
  const min = Math.max(0, mean - 3 * sigma), max = mean + 3 * sigma;
  const w = 280, h = 78, baseY = 62;
  const x = (v: number) => 8 + ((v - min) / (max - min || 1)) * 264;
  const gaussian = (v: number) => Math.exp(-((v - mean) ** 2) / (2 * sigma * sigma));
  const pts = Array.from({ length: 41 }, (_, i) => {
    const value = min + (max - min) * i / 40;
    return `${x(value)},${baseY - gaussian(value) * 48}`;
  }).join(" ");
  const markers = [{ label: "E", value: measure.esquerdo, color: "#60a5fa" }, { label: "D", value: measure.direito, color: "#fb923c" }];
  return (
    <div className="rounded-xl bg-secondary/50 p-3">
      <p className="text-xs font-semibold text-foreground">{measure.nome}</p>
      <svg viewBox={`0 0 ${w} ${h}`} className="mt-2 h-[78px] w-full">
        <polyline points={pts} fill="none" stroke="#8a8a8a" strokeWidth="1.5" />
        {markers.map((marker) => <g key={marker.label}><line x1={x(marker.value)} x2={x(marker.value)} y1="10" y2={baseY} stroke={marker.color} strokeWidth="2" /><text x={x(marker.value)} y="8" textAnchor="middle" fill={marker.color} fontSize="9">{marker.label} {numero(marker.value)}°</text></g>)}
      </svg>
      <p className="text-center text-[10px] text-muted-foreground">média da base {numero(mean)}°</p>
    </div>
  );
}

function ReassessmentCard({ latestDate }: { latestDate: string }) {
  const monthsSince = Math.floor(differenceInDays(new Date(), parseISO(latestDate)) / 30);
  const overdue = monthsSince >= MESES_IDEAL_REAVALIAR;
  const nextIn = Math.max(0, MESES_IDEAL_REAVALIAR - monthsSince);
  if (overdue) {
    return (
      <section className="space-y-3 rounded-2xl border border-primary/30 bg-card p-4">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10"><AlertCircle className="h-5 w-5 text-primary" /></div>
          <div><p className="text-sm font-bold text-foreground">Hora de comparar sua evolução!</p><p className="mt-1 text-xs text-muted-foreground">Sua última avaliação foi há {monthsSince} {monthsSince === 1 ? "mês" : "meses"}.</p></div>
        </div>
        <Button asChild className="min-h-11 w-full font-bold"><Link to="/portal/agenda">Agendar reavaliação <ArrowRight className="ml-2 h-4 w-4" /></Link></Button>
      </section>
    );
  }
  return (
    <section className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10"><CalendarCheck className="h-5 w-5 text-primary" /></div>
      <div><p className="text-sm font-bold text-foreground">Avaliação em dia</p><p className="text-xs text-muted-foreground">Próxima reavaliação em aproximadamente {nextIn} {nextIn === 1 ? "mês" : "meses"}</p></div>
    </section>
  );
}

function CompositionContent({ data }: { data: ConsolidadoAluno }) {
  const composition = data.composicao.latest;
  if (!composition) return null;
  const metrics = [
    { label: "% Gordura", value: `${numero(composition.bf)}%`, detail: composition.classificacao },
    { label: "Massa magra", value: composition.massaMagra == null ? "—" : `${numero(composition.massaMagra)} kg` },
    { label: "Peso", value: `${numero(composition.peso)} kg` },
    { label: "IMC", value: composition.imc == null ? "—" : numero(composition.imc) },
  ];
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2">{metrics.map((metric) => <div key={metric.label} className="rounded-xl border border-border bg-secondary/50 p-3 text-center"><p className="text-[10px] font-bold uppercase text-muted-foreground">{metric.label}</p><p className="mt-1 text-lg font-black text-foreground">{metric.value}</p>{metric.detail && <p className="text-[10px] text-muted-foreground">{metric.detail}</p>}</div>)}</div>
      <div className="flex items-center gap-2 rounded-xl bg-secondary/60 p-3"><TrendingUp className="h-4 w-4 shrink-0 text-primary" /><p className="text-xs text-muted-foreground">Você tem <strong className="text-foreground">{data.composicao.history.length} {data.composicao.history.length === 1 ? "medição" : "medições"}</strong> de composição corporal.</p></div>
    </div>
  );
}

function assessmentHistory(data: ConsolidadoAluno): Array<{ id: string; type: string; date: string }> {
  const labels: Record<string, string> = { funcional_v2: "Avaliação Funcional", funcional: "Avaliação Funcional", composicao_corporal: "Composição Corporal", pliometria: "Pliometria" };
  return data.raw
    .filter((item) => labels[item.tipo])
    .map((item) => ({ id: item.id, type: labels[item.tipo], date: item.data }));
}

function AssessmentHistory({ data }: { data: ConsolidadoAluno }) {
  return <div className="divide-y divide-border">{assessmentHistory(data).map((item) => <div key={item.id} className="flex min-h-14 items-center gap-3 py-2"><div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-secondary"><ClipboardCheck className="h-4 w-4 text-primary" /></div><div><p className="text-sm font-semibold text-foreground">{item.type}</p><p className="text-xs text-muted-foreground">{format(parseISO(`${item.date}T12:00:00`), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}</p></div></div>)}</div>;
}