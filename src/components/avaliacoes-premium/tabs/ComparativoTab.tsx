import { useMemo, useState } from "react";
import { format, parseISO, differenceInCalendarDays } from "date-fns";
import { AlertCircle } from "lucide-react";
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

interface Props {
  data: ConsolidadoAluno;
}

type Modo = "auto" | "datas" | "intervalo";

/** Retorna o snapshot com data mais próxima da alvo (dentro do histórico). */
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
    if (d < bestDiff) {
      bestDiff = d;
      best = h;
    }
  }
  return { snap: best, diasDif: best ? bestDiff : null };
}

function funcRows(a: FuncionalSnapshot | null, b: FuncionalSnapshot | null): CompareRow[] {
  const compA = a ? computePremiumScores(a, null) : null;
  const compB = b ? computePremiumScores(b, null) : null;
  return [
    { label: "Score Mobilidade", a: compA?.mobilidade ?? null, b: compB?.mobilidade ?? null, suffix: "" },
    { label: "Score Flexibilidade", a: compA?.flexibilidade ?? null, b: compB?.flexibilidade ?? null, suffix: "" },
    { label: "Simetria", a: compA?.assimetria ?? null, b: compB?.assimetria ?? null, suffix: "" },
    { label: "Risco (100 = baixíssimo)", a: compA?.risco ?? null, b: compB?.risco ?? null, suffix: "" },
    { label: "Nº métricas registradas", a: a?.metricas.length ?? null, b: b?.metricas.length ?? null, higherIsBetter: true, format: (v) => `${Math.round(v)}` },
  ];
}

function forcaRows(a: FuncionalSnapshot | null, b: FuncionalSnapshot | null): CompareRow[] {
  const compA = a ? computePremiumScores(a, null) : null;
  const compB = b ? computePremiumScores(b, null) : null;
  const rows: CompareRow[] = [
    { label: "Score Força (0–100)", a: compA?.forca ?? null, b: compB?.forca ?? null },
  ];
  // por exercício
  const nomes = new Set<string>();
  a?.forca.forEach((e) => nomes.add(e.nome));
  b?.forca.forEach((e) => nomes.add(e.nome));
  nomes.forEach((nome) => {
    const ea = a?.forca.find((x) => x.nome === nome) ?? null;
    const eb = b?.forca.find((x) => x.nome === nome) ?? null;
    const mediaA = ea ? (ea.direito_kg + ea.esquerdo_kg) / 2 : null;
    const mediaB = eb ? (eb.direito_kg + eb.esquerdo_kg) / 2 : null;
    rows.push({ label: `${nome} (média kg)`, a: mediaA, b: mediaB, suffix: " kg" });
  });
  return rows;
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

export function ComparativoTab({ data }: Props) {
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
          indice: s.indiceFortem,
          mobilidade: s.mobilidade,
          forca: s.forca,
          composicao: s.composicao,
          bf: c?.bf ?? null,
          salto: p?.salto_vertical ?? null,
        };
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modo, intervaloDe, intervaloAte, data]);

  // Warnings quando o snapshot mais próximo diverge muito da data alvo
  const AVISO_DIAS = 7;

  return (
    <div className="space-y-4">
      {/* Header: seletor de modo */}
      <div className="bio-card p-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[180px]">
            <Label className="text-xs text-white/60">Modo</Label>
            <Select value={modo} onValueChange={(v) => setModo(v as Modo)}>
              <SelectTrigger className="mt-1 h-9 bg-white/5 border-white/10 text-white">
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
                <Label className="text-xs text-white/60">De</Label>
                <Input
                  type="date"
                  value={intervaloDe}
                  onChange={(e) => setIntervaloDe(e.target.value)}
                  className="mt-1 h-9 bg-white/5 border-white/10 text-white w-44"
                />
              </div>
              <div>
                <Label className="text-xs text-white/60">Até</Label>
                <Input
                  type="date"
                  value={intervaloAte}
                  onChange={(e) => setIntervaloAte(e.target.value)}
                  className="mt-1 h-9 bg-white/5 border-white/10 text-white w-44"
                />
              </div>
            </>
          )}

          {modo === "auto" && todasDatas.length >= 2 && (
            <p className="text-xs text-white/55">
              Comparando <b className="text-white/80">{format(parseISO(data.funcional.history[1]?.data ?? data.composicao.history[1]?.data ?? todasDatas[1]), "dd/MM/yy")}</b>{" "}
              → <b className="text-white/80">{format(parseISO(todasDatas[0]), "dd/MM/yy")}</b>
            </p>
          )}
        </div>
      </div>

      {/* Conteúdo por modo */}
      {modo === "auto" && (
        <ModoTabelas
          labelA="Anterior"
          labelB="Última"
          funcA={autoFunc.A}
          funcB={autoFunc.B}
          compA={autoComp.A}
          compB={autoComp.B}
          plioA={autoPlio.A}
          plioB={autoPlio.B}
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
            funcA={datasFuncA.snap}
            funcB={datasFuncB.snap}
            compA={datasCompA.snap}
            compB={datasCompB.snap}
            plioA={datasPlioA.snap}
            plioB={datasPlioB.snap}
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
      <Label className="text-xs text-white/60">{label}</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="mt-1 h-9 w-52 bg-white/5 border-white/10 text-white">
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
  funcA,
  funcB,
  compA,
  compB,
  plioA,
  plioB,
}: {
  labelA: string;
  labelB: string;
  funcA: FuncionalSnapshot | null;
  funcB: FuncionalSnapshot | null;
  compA: ComposicaoSnapshot | null;
  compB: ComposicaoSnapshot | null;
  plioA: PliometriaSnapshot | null;
  plioB: PliometriaSnapshot | null;
}) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <CompareTable
        titulo="Mobilidade / Flexibilidade"
        labelA={labelA}
        labelB={labelB}
        rows={funcRows(funcA, funcB)}
        emptyMessage="Sem dados de mobilidade suficientes."
      />
      <CompareTable
        titulo="Força"
        labelA={labelA}
        labelB={labelB}
        rows={forcaRows(funcA, funcB)}
        emptyMessage="Sem dados de força suficientes."
      />
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
        <AlertCircle className="w-4 h-4 text-amber-300 mt-0.5 flex-shrink-0" />
        <div className="text-xs text-white/75 space-y-0.5">
          <p className="font-medium text-amber-200">Datas aproximadas</p>
          {alertas.map((a) => (
            <p key={a.nome}>
              <b>{a.nome}</b>: usando {format(parseISO(a.snap!.data), "dd/MM/yy")} (a data escolhida
              foi {format(parseISO(a.alvo), "dd/MM/yy")}, diferença de {a.diasDif} dia(s)).
            </p>
          ))}
        </div>
      </div>
    </div>
  );
}

function IntervaloGrafico({ serie }: { serie: Array<Record<string, unknown>> }) {
  if (serie.length < 2) {
    return (
      <div className="bio-card p-8 text-center text-white/55 text-sm">
        Necessário ao menos 2 pontos dentro do intervalo selecionado.
      </div>
    );
  }
  return (
    <div className="bio-card p-5">
      <h3 className="bio-heading text-base mb-3">Evolução no intervalo</h3>
      <ResponsiveContainer width="100%" height={320}>
        <LineChart data={serie as Record<string, string | number | null>[]}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(0 0% 100% / 0.06)" />
          <XAxis dataKey="data" stroke="hsl(0 0% 100% / 0.4)" tick={{ fontSize: 11 }} />
          <YAxis stroke="hsl(0 0% 100% / 0.4)" tick={{ fontSize: 11 }} />
          <Tooltip contentStyle={{ background: "hsl(220 18% 12%)", border: "1px solid hsl(0 0% 100% / 0.1)", borderRadius: 8 }} />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          <Line type="monotone" dataKey="indice" name="Índice Fortem" stroke="hsl(0 84% 60%)" strokeWidth={3} dot={{ r: 4 }} connectNulls />
          <Line type="monotone" dataKey="mobilidade" name="Mobilidade" stroke="hsl(var(--sev-medium))" strokeWidth={2} connectNulls />
          <Line type="monotone" dataKey="forca" name="Força" stroke="hsl(var(--sev-good))" strokeWidth={2} connectNulls />
          <Line type="monotone" dataKey="composicao" name="Composição" stroke="hsl(var(--sev-attention))" strokeWidth={2} connectNulls />
          <Line type="monotone" dataKey="bf" name="% Gordura" stroke="hsl(30 90% 60%)" strokeWidth={2} strokeDasharray="4 4" connectNulls />
          <Line type="monotone" dataKey="salto" name="Salto Vertical (cm)" stroke="hsl(200 80% 60%)" strokeWidth={2} strokeDasharray="4 4" connectNulls />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
