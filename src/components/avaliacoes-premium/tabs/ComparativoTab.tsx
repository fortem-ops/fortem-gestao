import { useMemo, useState } from "react";
import { format, parseISO, differenceInCalendarDays, differenceInCalendarMonths } from "date-fns";
import { AlertCircle, ArrowRight } from "lucide-react";
import {
  LineChart,
  Line,
  ResponsiveContainer,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from "recharts";
import type {
  ComposicaoSnapshot,
  ConsolidadoAluno,
  FuncionalSnapshot,
  PliometriaSnapshot,
} from "../useAlunoAvaliacoesConsolidadas";
import { computePremiumScores } from "../scoringPremium";
import { CompareTable, type CompareRow } from "./CompareTable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ComparacoesSalvas, type ComparativoSalvo } from "./ComparacoesSalvas";
import { SalvarComparacaoDialog } from "./SalvarComparacaoDialog";
import { getMetricDisplayLabel, metricaInvertida, type MobilidadeReferenceData, type Severity } from "@/components/student/assessment/funcionalV2/bodyMapLogic";
import type { FaixaEtaria } from "@/lib/faixaEtaria";
import {
  calcularStatsComparativoValores,
  CORTE_VARIACAO_FORCA_PCT,
  montarForcaComparativo,
  montarMobilidadeComparativo,
  type LadoForcaComparativo,
  type LadoMobilidadeComparativo,
  type LinhaForcaComparativo,
  type LinhaMobilidadeComparativo,
  type ResumoForca,
  type ResumoMobilidade,
  type TomVariacao,
} from "../comparativoValores";

interface Props {
  data: ConsolidadoAluno;
  alunoId: string;
  onGoEvolucao?: () => void;
  sexo?: "M" | "F";
  faixaEtaria?: FaixaEtaria | null;
  referenceData?: MobilidadeReferenceData;
}

type Modo = "auto" | "datas" | "intervalo";

/** Quantidade de dados preenchidos num snapshot funcional (desempate). */
function riqueza(s: unknown): number {
  const snap = s as Partial<FuncionalSnapshot> | null;
  if (!snap) return 0;
  return (snap.metricas?.length ?? 0) + (snap.forca?.length ?? 0);
}

/**
 * Retorna o snapshot com data mais próxima da alvo (dentro do histórico).
 * Em caso de empate de data, prefere a linha com mais dados preenchidos.
 */
function nearest<T extends { data: string }>(
  history: T[],
  targetISO: string | null,
): { snap: T | null; diasDif: number | null } {
  if (!targetISO || history.length === 0) return { snap: null, diasDif: null };
  const target = parseISO(targetISO);
  let best: T | null = null;
  let bestDiff = Infinity;
  for (const h of history) {
    const d = Math.abs(differenceInCalendarDays(parseISO(h.data), target));
    if (d < bestDiff || (d === bestDiff && riqueza(h) > riqueza(best))) {
      bestDiff = d;
      best = h;
    }
  }
  return { snap: best, diasDif: best ? bestDiff : null };
}

function compRows(a: ComposicaoSnapshot | null, b: ComposicaoSnapshot | null): CompareRow[] {
  return [
    { label: "% Gordura", a: a?.bf ?? null, b: b?.bf ?? null, suffix: "%", higherIsBetter: false },
    { label: "Massa Magra", a: a?.massaMagra ?? null, b: b?.massaMagra ?? null, suffix: " kg", higherIsBetter: true },
    { label: "Massa Gorda", a: a?.massaGorda ?? null, b: b?.massaGorda ?? null, suffix: " kg", higherIsBetter: false },
    { label: "Peso", a: a?.peso ?? null, b: b?.peso ?? null, suffix: " kg", higherIsBetter: false, toleranciaEstavel: 1 },
    { label: "IMC", a: a?.imc ?? null, b: b?.imc ?? null, higherIsBetter: false },
    { label: "Σ 7 Dobras", a: a?.sigma7 ?? null, b: b?.sigma7 ?? null, suffix: " mm", higherIsBetter: false },
  ];
}

function plioRows(a: PliometriaSnapshot | null, b: PliometriaSnapshot | null): CompareRow[] {
  return [
    { label: "Salto Vertical", a: a?.salto_vertical ?? null, b: b?.salto_vertical ?? null, suffix: " cm" },
    { label: "Salto Horizontal", a: a?.salto_horizontal ?? null, b: b?.salto_horizontal ?? null, suffix: " cm" },
    { label: "RSI", a: a?.rsi ?? null, b: b?.rsi ?? null },
    { label: "Tempo de contato", a: a?.tempo_contato ?? null, b: b?.tempo_contato ?? null, suffix: " ms", higherIsBetter: false },
    { label: "Potência", a: a?.potencia ?? null, b: b?.potencia ?? null, suffix: " W" },
    { label: "Stiffness", a: a?.stiffness ?? null, b: b?.stiffness ?? null },
    { label: "Assimetria", a: a?.assimetria ?? null, b: b?.assimetria ?? null, suffix: "%", higherIsBetter: false },
  ];
}

function mesesEntre(a: string | null, b: string | null): number | null {
  if (!a || !b) return null;
  return Math.abs(differenceInCalendarMonths(parseISO(b), parseISO(a)));
}

function dataCurta(data: string | null): string | null {
  return data ? format(parseISO(data), "dd/MM/yyyy") : null;
}

export function ComparativoTab({ data, alunoId, onGoEvolucao, sexo, faixaEtaria, referenceData }: Props) {
  const [modo, setModo] = useState<Modo>("auto");

  // União de datas disponíveis (para modo "datas")
  const todasDatas = useMemo(() => {
    const s = new Set<string>();
    data.funcional.history.forEach((x) => s.add(x.data));
    data.composicao.history.forEach((x) => s.add(x.data));
    data.pliometria.history.forEach((x) => s.add(x.data));
    return Array.from(s).sort((a, b) => b.localeCompare(a));
  }, [data]);

  const [dataA, setDataA] = useState<string>(todasDatas[1] ?? "");
  const [dataB, setDataB] = useState<string>(todasDatas[0] ?? "");

  const [intervaloDe, setIntervaloDe] = useState<string>(
    todasDatas[todasDatas.length - 1] ?? "",
  );
  const [intervaloAte, setIntervaloAte] = useState<string>(todasDatas[0] ?? "");

  // --- Modo AUTO: última vs. anterior por categoria ---
  const autoFunc = { A: data.funcional.history[1] ?? null, B: data.funcional.history[0] ?? null };
  const autoComp = { A: data.composicao.history[1] ?? null, B: data.composicao.history[0] ?? null };
  const autoPlio = { A: data.pliometria.history[1] ?? null, B: data.pliometria.history[0] ?? null };
  const autoDataA = autoFunc.A?.data ?? autoComp.A?.data ?? autoPlio.A?.data ?? null;
  const autoDataB = autoFunc.B?.data ?? autoComp.B?.data ?? autoPlio.B?.data ?? null;

  // --- Modo DATAS: escolhe A/B e cada categoria pega o mais próximo ---
  const datasFuncA = nearest(data.funcional.history, dataA);
  const datasFuncB = nearest(data.funcional.history, dataB);
  const datasCompA = nearest(data.composicao.history, dataA);
  const datasCompB = nearest(data.composicao.history, dataB);
  const datasPlioA = nearest(data.pliometria.history, dataA);
  const datasPlioB = nearest(data.pliometria.history, dataB);

  // --- Modo INTERVALO: filtra pontos dentro do range ---
  const filtro = (dt: string) =>
    (!intervaloDe || dt >= intervaloDe) && (!intervaloAte || dt <= intervaloAte);

  const serieIntervalo = useMemo(() => {
    if (modo !== "intervalo") return [];
    const datesSet = new Set<string>();
    data.funcional.history.forEach((f) => filtro(f.data) && datesSet.add(f.data));
    data.composicao.history.forEach((c) => filtro(c.data) && datesSet.add(c.data));
    return Array.from(datesSet)
      .sort()
      .map((dt) => {
        const f = data.funcional.history.find((x) => x.data === dt) ?? null;
        const c = data.composicao.history.find((x) => x.data === dt) ?? null;
        const p = data.pliometria.history.find((x) => x.data === dt) ?? null;
        const s = computePremiumScores(f, c);
        return {
          data: format(parseISO(dt), "dd/MM/yy"),
          composicao: s.composicao,
          bf: c?.bf ?? null,
          salto: p?.salto_vertical ?? null,
        };
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modo, intervaloDe, intervaloAte, data]);

  const AVISO_DIAS = 7;

  const aplicarSalvo = (c: ComparativoSalvo) => {
    setModo(c.modo);
    if (c.modo === "datas") {
      setDataA(c.data_a ?? "");
      setDataB(c.data_b ?? "");
    } else if (c.modo === "intervalo") {
      setIntervaloDe(c.intervalo_de ?? "");
      setIntervaloAte(c.intervalo_ate ?? "");
    }
  };

  return (
    <div className="space-y-4">
      <ComparacoesSalvas alunoId={alunoId} onAplicar={aplicarSalvo} />

      <div className="bio-card p-4 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
          <div>
            <p className="bio-label">Comparativo</p>
            <h2 className="bio-heading text-xl">Comparativo de valores</h2>
            <PeriodoComparado
              modo={modo}
              dataA={modo === "auto" ? autoDataA : dataA || null}
              dataB={modo === "auto" ? autoDataB : dataB || null}
              intervaloDe={intervaloDe || null}
              intervaloAte={intervaloAte || null}
            />
          </div>

          <div className="flex flex-wrap items-end gap-3">
            <div className="min-w-[180px]">
              <Label className="text-xs text-[hsl(var(--bio-ink-muted))]">Modo</Label>
              <Select value={modo} onValueChange={(v) => setModo(v as Modo)}>
                <SelectTrigger className="mt-1 h-9 bg-[hsl(var(--bio-surface-2))] border-[hsl(var(--bio-line))] text-[hsl(var(--bio-ink))]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="auto">Automático (última vs. anterior)</SelectItem>
                  <SelectItem value="datas">Duas datas específicas</SelectItem>
                  <SelectItem value="intervalo">Intervalo (gráfico)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {modo === "datas" && (
              <>
                <DataSelector
                  label="Data A (referência)"
                  value={dataA}
                  onChange={setDataA}
                  options={todasDatas}
                />
                <DataSelector
                  label="Data B (comparação)"
                  value={dataB}
                  onChange={setDataB}
                  options={todasDatas}
                />
              </>
            )}

            {modo === "intervalo" && (
              <>
                <div>
                  <Label className="text-xs text-[hsl(var(--bio-ink-muted))]">De</Label>
                  <Input
                    type="date"
                    value={intervaloDe}
                    onChange={(e) => setIntervaloDe(e.target.value)}
                    className="mt-1 h-9 bg-[hsl(var(--bio-surface-2))] border-[hsl(var(--bio-line))] text-[hsl(var(--bio-ink))] w-44"
                  />
                </div>
                <div>
                  <Label className="text-xs text-[hsl(var(--bio-ink-muted))]">Até</Label>
                  <Input
                    type="date"
                    value={intervaloAte}
                    onChange={(e) => setIntervaloAte(e.target.value)}
                    className="mt-1 h-9 bg-[hsl(var(--bio-surface-2))] border-[hsl(var(--bio-line))] text-[hsl(var(--bio-ink))] w-44"
                  />
                </div>
              </>
            )}

            {modo !== "auto" && (
              <SalvarComparacaoDialog
                alunoId={alunoId}
                params={{
                  modo,
                  data_a: modo === "datas" ? dataA || null : null,
                  data_b: modo === "datas" ? dataB || null : null,
                  intervalo_de: modo === "intervalo" ? intervaloDe || null : null,
                  intervalo_ate: modo === "intervalo" ? intervaloAte || null : null,
                }}
              />
            )}
          </div>
        </div>
      </div>

      {modo === "auto" && (
        <ModoTabelas
          labelA="Anterior"
          labelB="Última"
          dataA={autoDataA}
          dataB={autoDataB}
          funcA={autoFunc.A}
          funcB={autoFunc.B}
          compA={autoComp.A}
          compB={autoComp.B}
          plioA={autoPlio.A}
          plioB={autoPlio.B}
          onGoEvolucao={onGoEvolucao}
          sexo={sexo}
          faixaEtaria={faixaEtaria}
          referenceData={referenceData}
        />
      )}

      {modo === "datas" && (
        <>
          <AvisosProximidade
            avisoDias={AVISO_DIAS}
            itens={[
              { nome: "Mobilidade/Força (A)", diasDif: datasFuncA.diasDif, snap: datasFuncA.snap, alvo: dataA },
              { nome: "Mobilidade/Força (B)", diasDif: datasFuncB.diasDif, snap: datasFuncB.snap, alvo: dataB },
              { nome: "Composição (A)", diasDif: datasCompA.diasDif, snap: datasCompA.snap, alvo: dataA },
              { nome: "Composição (B)", diasDif: datasCompB.diasDif, snap: datasCompB.snap, alvo: dataB },
              { nome: "Pliometria (A)", diasDif: datasPlioA.diasDif, snap: datasPlioA.snap, alvo: dataA },
              { nome: "Pliometria (B)", diasDif: datasPlioB.diasDif, snap: datasPlioB.snap, alvo: dataB },
            ]}
          />
          <ModoTabelas
            labelA={dataA ? format(parseISO(dataA), "dd/MM/yy") : "A"}
            labelB={dataB ? format(parseISO(dataB), "dd/MM/yy") : "B"}
            dataA={dataA || null}
            dataB={dataB || null}
            funcA={datasFuncA.snap}
            funcB={datasFuncB.snap}
            compA={datasCompA.snap}
            compB={datasCompB.snap}
            plioA={datasPlioA.snap}
            plioB={datasPlioB.snap}
            onGoEvolucao={onGoEvolucao}
            sexo={sexo}
            faixaEtaria={faixaEtaria}
            referenceData={referenceData}
          />
        </>
      )}

      {modo === "intervalo" && (
        <IntervaloGrafico serie={serieIntervalo} />
      )}
    </div>
  );
}

/* ============ Sub-componentes ============ */

function PeriodoComparado({
  modo,
  dataA,
  dataB,
  intervaloDe,
  intervaloAte,
}: {
  modo: Modo;
  dataA: string | null;
  dataB: string | null;
  intervaloDe: string | null;
  intervaloAte: string | null;
}) {
  if (modo === "intervalo") {
    const inicio = dataCurta(intervaloDe);
    const fim = dataCurta(intervaloAte);
    if (!inicio || !fim) return null;
    return <p className="mt-1 text-sm text-[hsl(var(--bio-ink-muted))]">{inicio} → {fim}</p>;
  }

  const inicio = dataCurta(dataA);
  const fim = dataCurta(dataB);
  if (!inicio || !fim) {
    return <p className="mt-1 text-sm text-[hsl(var(--bio-ink-muted))]">Selecione duas avaliações para comparar.</p>;
  }
  const meses = mesesEntre(dataA, dataB);
  const textoMeses = meses === 1 ? "1 mês entre as avaliações" : `${meses ?? 0} meses entre as avaliações`;
  return <p className="mt-1 text-sm text-[hsl(var(--bio-ink-muted))]">{inicio} → {fim} · {textoMeses}</p>;
}

function DataSelector({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: string[];
}) {
  return (
    <div>
      <Label className="text-xs text-[hsl(var(--bio-ink-muted))]">{label}</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="mt-1 h-9 w-52 bg-[hsl(var(--bio-surface-2))] border-[hsl(var(--bio-line))] text-[hsl(var(--bio-ink))]">
          <SelectValue placeholder="Selecione" />
        </SelectTrigger>
        <SelectContent>
          {options.map((d) => (
            <SelectItem key={d} value={d}>
              {format(parseISO(d), "dd/MM/yyyy")}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function ModoTabelas({
  labelA,
  labelB,
  dataA,
  dataB,
  funcA,
  funcB,
  compA,
  compB,
  plioA,
  plioB,
  onGoEvolucao,
  sexo,
  faixaEtaria,
  referenceData,
}: {
  labelA: string;
  labelB: string;
  dataA: string | null;
  dataB: string | null;
  funcA: FuncionalSnapshot | null;
  funcB: FuncionalSnapshot | null;
  compA: ComposicaoSnapshot | null;
  compB: ComposicaoSnapshot | null;
  plioA: PliometriaSnapshot | null;
  plioB: PliometriaSnapshot | null;
  onGoEvolucao?: () => void;
  sexo?: "M" | "F";
  faixaEtaria?: FaixaEtaria | null;
  referenceData?: MobilidadeReferenceData;
}) {
  const mobilidadeRows = useMemo(
    () => montarMobilidadeComparativo(funcA, funcB, { sexo, faixaEtaria, referenceData }),
    [funcA, funcB, sexo, faixaEtaria, referenceData],
  );
  const forcaRows = useMemo(() => montarForcaComparativo(funcA, funcB), [funcA, funcB]);
  const stats = useMemo(() => calcularStatsComparativoValores(mobilidadeRows, forcaRows), [mobilidadeRows, forcaRows]);
  const possuiDuasAvaliacoes = Boolean(dataA && dataB && (funcA || compA || plioA) && (funcB || compB || plioB));

  if (!possuiDuasAvaliacoes) {
    return (
      <div className="bio-card p-8 text-center text-[hsl(var(--bio-ink-muted))] text-sm">
        Necessário ao menos 2 avaliações para comparar.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <ResumoCards stats={stats} />
      <AtalhoEvolucao onGoEvolucao={onGoEvolucao} />
      <TabelaMobilidadeValores rows={mobilidadeRows} />
      <TabelaForcaValores rows={forcaRows} />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <CompareTable
          titulo="Composição Corporal"
          labelA={labelA}
          labelB={labelB}
          rows={compRows(compA, compB)}
          emptyMessage="Sem dados de composição suficientes."
        />
        <CompareTable
          titulo="Pliometria"
          labelA={labelA}
          labelB={labelB}
          rows={plioRows(plioA, plioB)}
          emptyMessage="Sem dados de pliometria suficientes."
        />
      </div>
    </div>
  );
}

function ResumoCards({ stats }: { stats: ReturnType<typeof calcularStatsComparativoValores> }) {
  const items = [
    { label: "Lados que subiram de faixa", value: stats.mobilidadeSubiu, tone: "text-[hsl(var(--sev-excellent))]" },
    { label: "Lados que caíram de faixa", value: stats.mobilidadeCaiu, tone: "text-[hsl(var(--sev-weak))]" },
    { label: "Lados que ganharam força", value: stats.forcaGanhou, tone: "text-[hsl(var(--sev-excellent))]" },
    { label: "Lados que perderam força", value: stats.forcaPerdeu, tone: "text-[hsl(var(--sev-weak))]" },
  ];
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
      {items.map((item) => (
        <div key={item.label} className="bio-card p-4">
          <p className="text-xs text-[hsl(var(--bio-ink-muted))]">{item.label}</p>
          <p className={`mt-1 text-2xl font-semibold ${item.tone}`}>{item.value}</p>
        </div>
      ))}
    </div>
  );
}

function AtalhoEvolucao({ onGoEvolucao }: { onGoEvolucao?: () => void }) {
  return (
    <div className="bio-card px-4 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-l-2 border-[hsl(var(--info))]">
      <p className="text-sm text-[hsl(var(--bio-ink-muted))]">
        A diferença entre os lados nessas datas está na aba Evolução.
      </p>
      <Button type="button" size="sm" variant="outline" onClick={onGoEvolucao} disabled={!onGoEvolucao}>
        Abrir Evolução
        <ArrowRight className="w-4 h-4 ml-2" />
      </Button>
    </div>
  );
}

function TabelaMobilidadeValores({
  rows,
}: {
  rows: LinhaMobilidadeComparativo[];
}) {
  if (rows.length === 0) {
    return <EmptyCard titulo="Mobilidade / Flexibilidade" message="Sem dados de mobilidade suficientes." />;
  }

  return (
    <div className="bio-card overflow-hidden">
      <div className="px-5 py-3 border-b border-[hsl(var(--bio-line))]">
        <h3 className="bio-heading text-base">Mobilidade / Flexibilidade</h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[980px]">
          <thead>
            <tr className="border-b border-[hsl(var(--bio-line))] text-[11px] uppercase tracking-wide text-[hsl(var(--bio-ink-muted))]">
              <th className="text-left p-3 w-[22%]">Métrica</th>
              <th className="text-left p-3">Esquerdo</th>
              <th className="text-left p-3">Direito</th>
              <th className="text-center p-3 w-44">Posição na base</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.metric} className="border-b border-[hsl(var(--bio-line))] align-top">
                <td className="p-3 text-sm text-[hsl(var(--bio-ink))]">
                  <p className="font-medium">{getMetricDisplayLabel(row.metric)}</p>
                  {metricaInvertida(row.metric) && (
                    <p className="mt-1 text-[11px] text-[hsl(var(--bio-ink-muted))]">Menor valor é melhor</p>
                  )}
                </td>
                <td className="p-3"><CelulaMobilidade lado={row.esquerdo} /></td>
                <td className="p-3"><CelulaMobilidade lado={row.direito} /></td>
                <td className="p-3 text-center"><ResumoMobilidadeBadge resumo={row.resumo} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function TabelaForcaValores({
  rows,
}: {
  rows: LinhaForcaComparativo[];
}) {
  if (rows.length === 0) {
    return <EmptyCard titulo="Força" message="Não há força registrada nas duas datas." />;
  }

  return (
    <div className="bio-card overflow-hidden">
      <div className="px-5 py-3 border-b border-[hsl(var(--bio-line))]">
        <h3 className="bio-heading text-base">Força</h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[980px]">
          <thead>
            <tr className="border-b border-[hsl(var(--bio-line))] text-[11px] uppercase tracking-wide text-[hsl(var(--bio-ink-muted))]">
              <th className="text-left p-3 w-[22%]">Exercício</th>
              <th className="text-left p-3">Esquerdo</th>
              <th className="text-left p-3">Direito</th>
              <th className="text-center p-3 w-40">Resumo</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.nome} className="border-b border-[hsl(var(--bio-line))] align-top">
                <td className="p-3 text-sm font-medium text-[hsl(var(--bio-ink))]">{row.label}</td>
                <td className="p-3"><CelulaForca lado={row.esquerdo} /></td>
                <td className="p-3"><CelulaForca lado={row.direito} /></td>
                <td className="p-3 text-center"><ResumoForcaBadge resumo={row.resumo} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="px-5 py-3 text-xs text-[hsl(var(--bio-ink-muted))] border-t border-[hsl(var(--bio-line))]">
        Variações abaixo de {CORTE_VARIACAO_FORCA_PCT}% contam como estáveis; este corte é provisório.
      </p>
    </div>
  );
}

function CelulaMobilidade({ lado }: { lado: LadoMobilidadeComparativo }) {
  if (!lado.antes || !lado.depois) return <span className="text-sm text-[hsl(var(--bio-ink-muted))]">—</span>;
  return (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      <ValorGrausBadge ponto={lado.antes} />
      <ArrowRight className="w-4 h-4 text-[hsl(var(--bio-ink-muted))]" />
      <ValorGrausBadge ponto={lado.depois} />
      <VariacaoGrausBadge variacao={lado.variacao} tom={lado.tom} />
    </div>
  );
}

function CelulaForca({ lado }: { lado: LadoForcaComparativo }) {
  if (lado.antes === null || lado.depois === null || lado.variacaoPct === null) return <span className="text-sm text-[hsl(var(--bio-ink-muted))]">—</span>;
  return (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      <span className="rounded-md border border-[hsl(var(--bio-line))] bg-[hsl(var(--bio-surface-2))] px-2 py-1 text-[hsl(var(--bio-ink))]">{lado.antes.toFixed(1)} kg</span>
      <ArrowRight className="w-4 h-4 text-[hsl(var(--bio-ink-muted))]" />
      <span className="rounded-md border border-[hsl(var(--bio-line))] bg-[hsl(var(--bio-surface-2))] px-2 py-1 text-[hsl(var(--bio-ink))]">{lado.depois.toFixed(1)} kg</span>
      <VariacaoPctBadge variacao={lado.variacaoPct} resumo={lado.movimento} />
    </div>
  );
}

function PercentilBadge({ ponto }: { ponto: NonNullable<LadoMobilidadeComparativo["antes"]> }) {
  const texto = ponto.percentil === null ? `${ponto.valor.toFixed(1)}°` : `${ponto.valor.toFixed(1)}° · P${ponto.percentil}`;
  return (
    <span className={`rounded-md border px-2 py-1 ${classePercentil(ponto.severity)}`}>
      {texto}
    </span>
  );
}

function VariacaoGrausBadge({ variacao, tom }: { variacao: number | null; tom: TomVariacao }) {
  if (variacao === null) return <span className="text-[hsl(var(--bio-ink-muted))]">—</span>;
  const cls = tom === "melhora"
    ? "text-[hsl(var(--sev-excellent))] bg-[hsl(var(--sev-excellent)/0.12)] border-[hsl(var(--sev-excellent)/0.35)]"
    : tom === "piora"
      ? "text-[hsl(var(--sev-weak))] bg-[hsl(var(--sev-weak)/0.12)] border-[hsl(var(--sev-weak)/0.35)]"
      : "text-[hsl(var(--bio-ink-muted))] bg-[hsl(var(--bio-surface-2))] border-[hsl(var(--bio-line))]";
  return <span className={`rounded-md border px-2 py-1 font-medium ${cls}`}>{formatDelta(variacao)}°</span>;
}


function VariacaoPercentilBadge({ variacao }: { variacao: number | null }) {
  if (variacao === null) return null;
  const cls = variacao > 0
    ? "text-[hsl(var(--sev-excellent))] bg-[hsl(var(--sev-excellent)/0.12)] border-[hsl(var(--sev-excellent)/0.35)]"
    : variacao < 0
      ? "text-[hsl(var(--sev-weak))] bg-[hsl(var(--sev-weak)/0.12)] border-[hsl(var(--sev-weak)/0.35)]"
      : "text-[hsl(var(--bio-ink-muted))] bg-[hsl(var(--bio-surface-2))] border-[hsl(var(--bio-line))]";
  return <span className={`rounded-md border px-2 py-1 font-medium ${cls}`}>{formatDelta(variacao)} pp</span>;
}

function VariacaoPctBadge({ variacao, resumo }: { variacao: number; resumo: ResumoForca | null }) {
  const cls = resumo === "Ganhou força"
    ? "text-[hsl(var(--sev-excellent))] bg-[hsl(var(--sev-excellent)/0.12)] border-[hsl(var(--sev-excellent)/0.35)]"
    : resumo === "Perdeu força"
      ? "text-[hsl(var(--sev-weak))] bg-[hsl(var(--sev-weak)/0.12)] border-[hsl(var(--sev-weak)/0.35)]"
      : "text-[hsl(var(--bio-ink-muted))] bg-[hsl(var(--bio-surface-2))] border-[hsl(var(--bio-line))]";
  return <span className={`rounded-md border px-2 py-1 font-medium ${cls}`}>{formatDelta(variacao)}%</span>;
}

function ResumoMobilidadeBadge({ resumo }: { resumo: ResumoMobilidade }) {
  const cls = resumo === "Subiu de faixa"
    ? "text-[hsl(var(--sev-excellent))] bg-[hsl(var(--sev-excellent)/0.12)] border-[hsl(var(--sev-excellent)/0.35)]"
    : resumo === "Caiu de faixa"
      ? "text-[hsl(var(--sev-weak))] bg-[hsl(var(--sev-weak)/0.12)] border-[hsl(var(--sev-weak)/0.35)]"
      : resumo === "Sem base de comparação"
        ? "text-[hsl(var(--bio-ink-muted))] bg-[hsl(var(--bio-surface-2))] border-[hsl(var(--bio-line))]"
        : "text-[hsl(var(--bio-ink-muted))] bg-[hsl(var(--bio-surface-2))] border-[hsl(var(--bio-line))]";
  return <span className={`inline-flex rounded-md border px-2 py-1 text-xs font-medium ${cls}`}>{resumo}</span>;
}

function ResumoForcaBadge({ resumo }: { resumo: ResumoForca }) {
  const cls = resumo === "Ganhou força"
    ? "text-[hsl(var(--sev-excellent))] bg-[hsl(var(--sev-excellent)/0.12)] border-[hsl(var(--sev-excellent)/0.35)]"
    : resumo === "Perdeu força"
      ? "text-[hsl(var(--sev-weak))] bg-[hsl(var(--sev-weak)/0.12)] border-[hsl(var(--sev-weak)/0.35)]"
      : "text-[hsl(var(--bio-ink-muted))] bg-[hsl(var(--bio-surface-2))] border-[hsl(var(--bio-line))]";
  return <span className={`inline-flex rounded-md border px-2 py-1 text-xs font-medium ${cls}`}>{resumo}</span>;
}

function classePercentil(severity: Severity): string {
  switch (severity) {
    case "weak":
      return "text-[hsl(var(--sev-weak))] bg-[hsl(var(--sev-weak)/0.12)] border-[hsl(var(--sev-weak)/0.35)]";
    case "attention":
      return "text-[hsl(var(--sev-attention))] bg-[hsl(var(--sev-attention)/0.12)] border-[hsl(var(--sev-attention)/0.35)]";
    case "medium":
      return "text-[hsl(var(--sev-medium))] bg-[hsl(var(--sev-medium)/0.12)] border-[hsl(var(--sev-medium)/0.35)]";
    case "good":
      return "text-[hsl(var(--sev-good))] bg-[hsl(var(--sev-good)/0.12)] border-[hsl(var(--sev-good)/0.35)]";
    case "excellent":
      return "text-[hsl(var(--sev-excellent))] bg-[hsl(var(--sev-excellent)/0.12)] border-[hsl(var(--sev-excellent)/0.35)]";
    case "none":
      return "text-[hsl(var(--bio-ink-muted))] bg-[hsl(var(--bio-surface-2))] border-[hsl(var(--bio-line))]";
  }
}

function formatDelta(valor: number): string {
  if (Math.abs(valor) < 0.05) return "0.0";
  return `${valor > 0 ? "+" : ""}${valor.toFixed(1)}`;
}

function EmptyCard({ titulo, message }: { titulo: string; message: string }) {
  return (
    <div className="bio-card p-5">
      <h3 className="bio-heading text-base mb-2">{titulo}</h3>
      <p className="text-sm text-[hsl(var(--bio-ink-muted))]">{message}</p>
    </div>
  );
}

function AvisosProximidade({
  itens,
  avisoDias,
}: {
  avisoDias: number;
  itens: { nome: string; diasDif: number | null; snap: { data: string } | null; alvo: string }[];
}) {
  const alertas = itens.filter(
    (i) => i.snap && i.diasDif !== null && i.diasDif > avisoDias && i.alvo,
  );
  if (alertas.length === 0) return null;
  return (
    <div className="bio-card p-3 border-l-2 border-amber-500/60 bg-amber-500/5">
      <div className="flex items-start gap-2">
        <AlertCircle className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
        <div className="text-xs text-[hsl(var(--bio-ink-muted))] space-y-0.5">
          <p className="font-medium text-amber-700">Datas aproximadas</p>
          {alertas.map((a) => (
            <p key={a.nome}>
              <b>{a.nome}</b>: usando {a.snap ? format(parseISO(a.snap.data), "dd/MM/yy") : "—"} (a data escolhida
              foi {format(parseISO(a.alvo), "dd/MM/yy")}, diferença de {a.diasDif} dia(s)).
            </p>
          ))}
        </div>
      </div>
    </div>
  );
}

function IntervaloGrafico({
  serie,
}: {
  serie: Array<Record<string, unknown>>;
}) {
  if (serie.length < 2) {
    return (
      <div className="bio-card p-8 text-center text-[hsl(var(--bio-ink-muted))] text-sm">
        Necessário ao menos 2 pontos dentro do intervalo selecionado.
      </div>
    );
  }
  return (
    <div className="space-y-4">
      <div className="bio-card p-5">
        <h3 className="bio-heading text-base mb-3">Evolução no intervalo</h3>
        <ResponsiveContainer width="100%" height={320}>
          <LineChart data={serie as Record<string, string | number | null>[]}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--bio-line))" />
            <XAxis dataKey="data" stroke="hsl(var(--bio-ink-muted))" tick={{ fontSize: 11 }} />
            <YAxis stroke="hsl(var(--bio-ink-muted))" tick={{ fontSize: 11 }} />
            <Tooltip contentStyle={{ background: "hsl(var(--bio-surface-2))", border: "1px solid hsl(var(--bio-line))", borderRadius: 8, color: "hsl(var(--bio-ink))" }} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Line type="monotone" dataKey="composicao" name="Composição" stroke="hsl(var(--sev-attention))" strokeWidth={2} connectNulls />
            <Line type="monotone" dataKey="bf" name="% Gordura" stroke="hsl(var(--sev-excellent))" strokeWidth={2} strokeDasharray="4 4" connectNulls />
            <Line type="monotone" dataKey="salto" name="Salto Vertical (cm)" stroke="hsl(var(--sev-medium))" strokeWidth={2} strokeDasharray="4 4" connectNulls />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
