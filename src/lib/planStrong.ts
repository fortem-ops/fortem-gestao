/**
 * Plan Strong 50 — cascata de orçamento de volume (NL) em vários níveis.
 *
 * Níveis da cascata:
 *   1. Duração total (1..6 meses) → fases auto-atribuídas.
 *   2. Por levantamento, por mês: NL total + % de NL por zona de intensidade.
 *      (a zona 71-80% é SEMPRE o resto: 100% − soma das outras quatro)
 *   3. Por zona, o NL mensal se distribui nas 4 semanas via "variante"
 *      (50-60% e 61-70% compartilham a variante principal; 81-90% e 91-100%
 *      têm variante própria; 71-80% é obtido por subtração semanal).
 *   4. Por semana, o NL de cada zona se divide entre as sessões via "split".
 *   5. Por sessão/zona, séries e reps são SUGERIDAS (editáveis pelo professor).
 *
 * Nada é congelado: tudo é recalculado ao vivo a partir da configuração +
 * contagem de sessões concluídas (`treino_sessoes`), por levantamento.
 */

import type {
  AquecimentoBloco,
  PersonalizadoAquecimentoEx,
} from "@/components/student/workout/personalizadoTypes";

// ── Levantamentos ────────────────────────────────────────────

export type PSLevantamento =
  | "agachamento"
  | "terra"
  | "supino"
  | "press"
  | "remada";

export const PS_LEVANTAMENTOS: PSLevantamento[] = [
  "agachamento",
  "terra",
  "supino",
  "press",
  "remada",
];

export const PS_LEV_LABEL: Record<PSLevantamento, string> = {
  agachamento: "Agachamento",
  terra: "Terra",
  supino: "Supino",
  press: "Press",
  remada: "Remada Curvada",
};

/** Vínculo fixo com o Banco de Exercícios (mesmos IDs do 5-3-1/M102). */
export const PS_LEV_BASE: Record<
  PSLevantamento,
  { categoria: string; exercicio_id: string; nome: string; video_url: string | null }
> = {
  agachamento: {
    categoria: "DJS",
    exercicio_id: "0c0bdc0c-0df0-4999-bbe7-0c85471d4b34",
    nome: "Agachamento com Barra nas Costas",
    video_url: "https://youtube.com/shorts/LGnX-Tit8NY",
  },
  terra: {
    categoria: "DQ",
    exercicio_id: "64cf35a1-03b0-4b89-b46f-3a893dbf65cc",
    nome: "Levantamento Terra com Barra Reta",
    video_url: "https://www.youtube.com/watch?v=H6QBUUGcOo8",
  },
  supino: {
    categoria: "EH",
    exercicio_id: "2f8139b2-d0cc-4f34-8b2c-396b5e0a039f",
    nome: "Supino",
    video_url: "https://www.youtube.com/watch?v=Eas2ERzSBTs",
  },
  press: {
    categoria: "EV",
    exercicio_id: "304266f3-1a23-435b-9d21-703d00b0db8b",
    nome: "Press com Barra (SM)",
    video_url: "https://youtube.com/shorts/G9O1KSUUY7Q",
  },
  remada: {
    categoria: "PH",
    exercicio_id: "a12123f6-cd05-4cc9-a3d1-b77fa0d180d0",
    nome: "Remada Curvada com Barra",
    video_url: "https://www.youtube.com/watch?v=Jz4SXmEn_iw",
  },
};

/** Faixa sugerida de NL mensal (referência, não trava). */
export function faixaNlSugerida(lev: PSLevantamento): string {
  return lev === "agachamento" || lev === "terra" ? "200–400" : "300–500+";
}

// ── Zonas de intensidade (constantes do método) ──────────────

export type PSZona = "z50_60" | "z61_70" | "z71_80" | "z81_90" | "z91_100";

export interface ZonaDef {
  key: PSZona;
  label: string;
  /** %1RM central FIXO da zona — nunca calculado a partir do kg. */
  pctCentral: number;
}

export const PS_ZONAS: ZonaDef[] = [
  { key: "z50_60", label: "50-60%", pctCentral: 55 },
  { key: "z61_70", label: "61-70%", pctCentral: 65 },
  { key: "z71_80", label: "71-80%", pctCentral: 75 },
  { key: "z81_90", label: "81-90%", pctCentral: 85 },
  { key: "z91_100", label: "91-100%", pctCentral: 92.5 },
];

export const PS_ZONA_MAP: Record<PSZona, ZonaDef> = PS_ZONAS.reduce(
  (acc, z) => ({ ...acc, [z.key]: z }),
  {} as Record<PSZona, ZonaDef>,
);

/** Zonas cuja % de NL é digitada pelo professor (71-80 é sempre derivada). */
export const PS_ZONAS_INPUT: PSZona[] = ["z50_60", "z61_70", "z81_90", "z91_100"];

// ── Variantes de distribuição semanal ────────────────────────

export type PSVariante =
  | "1" | "2a" | "2b" | "2c"
  | "3a" | "3b" | "3c"
  | "1-3a" | "1-3b" | "3-1a" | "3-1b"
  | "4" | "2-4a" | "2-4b" | "4-2a" | "4-2b";

/** % do NL mensal da zona em cada uma das 4 semanas (sempre soma 100). */
export const PS_VARIANTES: Record<PSVariante, [number, number, number, number]> = {
  "1": [35, 28, 22, 15],
  "2a": [15, 35, 28, 22],
  "2b": [28, 35, 22, 15],
  "2c": [22, 35, 28, 15],
  "3a": [15, 22, 35, 28],
  "3b": [22, 28, 35, 15],
  "3c": [15, 28, 35, 22],
  "1-3a": [35, 15, 28, 22],
  "1-3b": [35, 22, 28, 15],
  "3-1a": [28, 15, 35, 22],
  "3-1b": [28, 22, 35, 15],
  "4": [15, 22, 28, 35],
  "2-4a": [15, 35, 22, 28],
  "2-4b": [22, 35, 15, 28],
  "4-2a": [22, 28, 15, 35],
  "4-2b": [15, 28, 22, 35],
};

export const PS_VARIANTE_KEYS = Object.keys(PS_VARIANTES) as PSVariante[];

export function descreverVariante(v: PSVariante): string {
  const w = PS_VARIANTES[v];
  return `Sem 1 ${w[0]}% · Sem 2 ${w[1]}% · Sem 3 ${w[2]}% · Sem 4 ${w[3]}%`;
}

// ── Splits de sessão ─────────────────────────────────────────

export interface SplitDef {
  key: string;
  sessoes: 2 | 3;
  fracoes: number[]; // % por sessão (soma 100)
}

export const SPLITS_SESSAO: SplitDef[] = [
  { key: "40-60", sessoes: 2, fracoes: [40, 60] },
  { key: "35-65", sessoes: 2, fracoes: [35, 65] },
  { key: "30-70", sessoes: 2, fracoes: [30, 70] },
  { key: "25-75", sessoes: 2, fracoes: [25, 75] },
  { key: "20-80", sessoes: 2, fracoes: [20, 80] },
  { key: "25-33-42", sessoes: 3, fracoes: [25, 33, 42] },
  { key: "20-35-45", sessoes: 3, fracoes: [20, 35, 45] },
  { key: "22-28-50", sessoes: 3, fracoes: [22, 28, 50] },
  { key: "20-30-50", sessoes: 3, fracoes: [20, 30, 50] },
  { key: "15-35-50", sessoes: 3, fracoes: [15, 35, 50] },
  { key: "15-30-55", sessoes: 3, fracoes: [15, 30, 55] },
];

export function splitByKey(key: string): SplitDef | undefined {
  return SPLITS_SESSAO.find((s) => s.key === key);
}

/** Split sugerido conforme o nº de sessões da semana. */
export function splitPadrao(sessoes: number): string {
  if (sessoes >= 3) return "25-33-42";
  if (sessoes === 2) return "40-60";
  return "";
}

/** Frações efetivas para N sessões (1 sessão = 100%; 2 ou 3 = split escolhido). */
export function fracoesSessoes(sessoes: number, splitKey: string): number[] {
  if (sessoes <= 1) return [100];
  const s = splitByKey(splitKey);
  if (s && s.sessoes === sessoes) return s.fracoes;
  const fallback = splitByKey(splitPadrao(sessoes));
  if (fallback) return fallback.fracoes;
  return Array.from({ length: sessoes }, () => 100 / sessoes);
}

// ── Fases ────────────────────────────────────────────────────

export type PSFase = "preparatorio" | "pre_competitivo" | "competitivo";

export const PS_FASE_LABEL: Record<PSFase, string> = {
  preparatorio: "Preparatório",
  pre_competitivo: "Pré-competitivo",
  competitivo: "Competitivo",
};

/** Último mês = competitivo; penúltimo (se N≥3) = pré-competitivo; resto = preparatório. */
export function fasePorMes(mesIdx: number, totalMeses: number): PSFase {
  if (mesIdx === totalMeses - 1) return "competitivo";
  if (totalMeses >= 3 && mesIdx === totalMeses - 2) return "pre_competitivo";
  return "preparatorio";
}

// ── Cálculos básicos ─────────────────────────────────────────

export function roundToNearest2_5(kg: number): number {
  if (!isFinite(kg) || kg <= 0) return 0;
  return Math.round(kg / 2.5) * 2.5;
}

/** KG da zona = 1RM × %central, arredondado ao múltiplo de 2,5kg. */
export function kgZona(rm1: number, pctCentral: number): number {
  if (!rm1) return 0;
  return roundToNearest2_5((rm1 * pctCentral) / 100);
}

/** Reps ideais por série conforme %1RM (tabela StrongFirst, interpolada). */
export function repsIdeal(pctCentral: number): number {
  if (pctCentral <= 60) return 8;
  if (pctCentral <= 67.5) return 6;
  if (pctCentral <= 77.5) return 5;
  if (pctCentral <= 82.5) return 4;
  if (pctCentral <= 87.5) return 3;
  if (pctCentral <= 92.5) return 2;
  return 1;
}

/**
 * Sugere a distribuição de reps por série para um NL de sessão numa zona.
 * Ex.: sugerirSeries(19, 4) → "4,4,4,4,3"
 */
export function sugerirSeries(nl: number, ideal: number): string {
  const total = Math.round(nl);
  if (!isFinite(total) || total <= 0 || ideal <= 0) return "";
  const series = Math.ceil(total / ideal);
  const base = Math.floor(total / series);
  const resto = total - base * series;
  // séries mais cheias primeiro; o resto cai nas últimas (ex.: 19/4 → 4,4,4,4,3)
  const arr = Array.from({ length: series }, (_, i) => (i < resto ? base + 1 : base));
  return arr.join(",");
}

// ── Estrutura de conteúdo ────────────────────────────────────

export interface PSSemana {
  /** Nº de sessões daquele levantamento na semana. */
  sessoes: number;
  splitSessao: string;
  /** Sobrescritas manuais: overrides[sessaoIdx][zona] = "5,5,4" */
  overrides?: Record<string, string>;
}

export interface PSMes {
  fase: PSFase;
  /** Referência visual apenas — não entra em nenhuma fórmula. */
  ariObjetivo: number;
  nlMensal: number;
  pct50_60: number;
  pct61_70: number;
  pct81_90: number;
  pct91_100: number;
  /** Variante compartilhada por 50-60% e 61-70%. */
  variantePrincipal: PSVariante;
  variante81_90: PSVariante;
  variante91_100: PSVariante;
  semanas: PSSemana[]; // sempre 4
  /** Ajuste manual de kg por zona (discos disponíveis). */
  kgOverride?: Partial<Record<PSZona, number>>;
}

export interface PSLevantamentoConfig {
  tipo: PSLevantamento;
  rm1: number;
  /** Slots de treino compartilhados ocupados por este levantamento (ex.: ["T1", "T3"]). */
  diasTreino: string[];
  meses: PSMes[];
}

/** Mesmo shape do `Auxiliar531` — exercício fixo, sem % nem progressão. */
export interface PSAuxiliar {
  categoria: string;
  exercicio: string;
  exercicio_id?: string | null;
  video_url?: string | null;
  series: number;
  reps: string;
  /** Livre / opcional — não calculado. */
  kg?: string;
}

export interface PlanStrong50Conteudo {
  variante: "PLANSTRONG50";
  duracaoMeses: number;
  /** Quantos slots de treino (T1..Tn) existem na prescrição inteira (2 a 5). */
  diasTreinoSemana?: number;
  levantamentos: PSLevantamentoConfig[];
  aquecimento: Record<AquecimentoBloco, PersonalizadoAquecimentoEx[]>;
  /** Auxiliares por slot de dia — chave "T1", "T2", ... */
  auxiliaresPorSlot?: Record<string, PSAuxiliar[]>;
}

export const PS_DIAS_SEMANA_PADRAO = 3;

export function emptyAuxiliar(): PSAuxiliar {
  return {
    categoria: "",
    exercicio: "",
    exercicio_id: null,
    video_url: null,
    series: 3,
    reps: "10",
    kg: "",
  };
}

/** Auxiliares de um slot (sempre um array). */
export function psAuxiliaresDoSlot(
  data: Pick<PlanStrong50Conteudo, "auxiliaresPorSlot">,
  slot: string,
): PSAuxiliar[] {
  return data.auxiliaresPorSlot?.[slot] ?? [];
}

/** Lista de slots T1..Tn. */
export function psSlots(n: number | undefined): string[] {
  const total = Math.min(5, Math.max(2, n ?? PS_DIAS_SEMANA_PADRAO));
  return Array.from({ length: total }, (_, i) => `T${i + 1}`);
}

export function isPlanStrong50(c: unknown): c is PlanStrong50Conteudo {
  return (
    typeof c === "object" &&
    c !== null &&
    (c as { variante?: unknown }).variante === "PLANSTRONG50"
  );
}

export function emptySemana(sessoes = 2): PSSemana {
  return { sessoes, splitSessao: splitPadrao(sessoes), overrides: {} };
}

export function emptyMes(fase: PSFase, lev: PSLevantamento): PSMes {
  const pesado = lev === "agachamento" || lev === "terra";
  return {
    fase,
    ariObjetivo: fase === "competitivo" ? 72 : 65,
    nlMensal: pesado ? 300 : 400,
    pct50_60: 25,
    pct61_70: 30,
    pct81_90: fase === "preparatorio" ? 10 : 18,
    pct91_100: fase === "competitivo" ? 5 : 0,
    variantePrincipal: "2a",
    variante81_90: "3a",
    variante91_100: "3a",
    semanas: [emptySemana(), emptySemana(), emptySemana(), emptySemana()],
  };
}

export function emptyLevantamento(
  tipo: PSLevantamento,
  duracaoMeses: number,
): PSLevantamentoConfig {
  return {
    tipo,
    rm1: 0,
    diasTreino: [],
    meses: Array.from({ length: duracaoMeses }, (_, i) =>
      emptyMes(fasePorMes(i, duracaoMeses), tipo),
    ),
  };
}

export function emptyPlanStrong50(duracaoMeses = 3): PlanStrong50Conteudo {
  return {
    variante: "PLANSTRONG50",
    duracaoMeses,
    diasTreinoSemana: PS_DIAS_SEMANA_PADRAO,
    levantamentos: [emptyLevantamento("agachamento", duracaoMeses)],
    aquecimento: { LIB: [], MOB: [], ATI: [], PREV: [] },
  };
}

/** Ajusta o array de meses de cada levantamento à nova duração e refaz as fases. */
export function ajustarDuracao(
  data: PlanStrong50Conteudo,
  duracaoMeses: number,
): PlanStrong50Conteudo {
  return {
    ...data,
    duracaoMeses,
    levantamentos: data.levantamentos.map((l) => {
      const meses = Array.from({ length: duracaoMeses }, (_, i) => {
        const fase = fasePorMes(i, duracaoMeses);
        const existente = l.meses[i];
        return existente ? { ...existente, fase } : emptyMes(fase, l.tipo);
      });
      return { ...l, meses };
    }),
  };
}

// ── Cascata de cálculo ───────────────────────────────────────

/** % da zona 71-80% = 100 − soma das outras quatro (nunca editável). */
export function pct71_80(mes: PSMes): number {
  const soma =
    (mes.pct50_60 || 0) + (mes.pct61_70 || 0) + (mes.pct81_90 || 0) + (mes.pct91_100 || 0);
  return Math.round((100 - soma) * 100) / 100;
}

export function pctPorZona(mes: PSMes): Record<PSZona, number> {
  return {
    z50_60: mes.pct50_60 || 0,
    z61_70: mes.pct61_70 || 0,
    z71_80: pct71_80(mes),
    z81_90: mes.pct81_90 || 0,
    z91_100: mes.pct91_100 || 0,
  };
}

/** ARI real = Σ(%NL da zona × %1RM central da zona). Sempre calculado. */
export function ariReal(mes: PSMes): number {
  const pcts = pctPorZona(mes);
  const soma = PS_ZONAS.reduce((acc, z) => acc + (pcts[z.key] / 100) * z.pctCentral, 0);
  return Math.round(soma * 10) / 10;
}

/** NL mensal por zona. */
export function nlPorZonaMes(mes: PSMes): Record<PSZona, number> {
  const pcts = pctPorZona(mes);
  const out = {} as Record<PSZona, number>;
  PS_ZONAS.forEach((z) => {
    out[z.key] = ((mes.nlMensal || 0) * pcts[z.key]) / 100;
  });
  return out;
}

function varianteDaZona(mes: PSMes, zona: PSZona): PSVariante | null {
  if (zona === "z50_60" || zona === "z61_70") return mes.variantePrincipal;
  if (zona === "z81_90") return mes.variante81_90;
  if (zona === "z91_100") return mes.variante91_100;
  return null; // 71-80 é por subtração
}

/**
 * NL semanal por zona (semanaIdx 0..3).
 * 71-80% = NL total da semana − as outras quatro zonas naquela semana.
 * O NL total da semana segue a variante principal do mês.
 */
export function nlPorZonaSemana(mes: PSMes, semanaIdx: number): Record<PSZona, number> {
  const mensal = nlPorZonaMes(mes);
  const out = {} as Record<PSZona, number>;
  let somaOutras = 0;
  (["z50_60", "z61_70", "z81_90", "z91_100"] as PSZona[]).forEach((z) => {
    const v = varianteDaZona(mes, z)!;
    const val = (mensal[z] * PS_VARIANTES[v][semanaIdx]) / 100;
    out[z] = val;
    somaOutras += val;
  });
  const nlTotalSemana =
    ((mes.nlMensal || 0) * PS_VARIANTES[mes.variantePrincipal][semanaIdx]) / 100;
  out.z71_80 = Math.max(0, nlTotalSemana - somaOutras);
  return out;
}

export function nlTotalSemana(mes: PSMes, semanaIdx: number): number {
  const z = nlPorZonaSemana(mes, semanaIdx);
  return PS_ZONAS.reduce((acc, d) => acc + z[d.key], 0);
}

export interface PSZonaSessao {
  zona: PSZona;
  label: string;
  pctCentral: number;
  nl: number;
  kg: number;
  series: string;
  /** true quando o professor sobrescreveu manualmente as séries. */
  manual: boolean;
}

export interface PSSessaoCalculada {
  mesIdx: number;
  semanaIdx: number;
  sessaoIdx: number;
  fase: PSFase;
  zonas: PSZonaSessao[];
  nlTotal: number;
}

/** Calcula uma sessão específica (zonas com NL > 0). */
export function calcularSessao(
  lev: PSLevantamentoConfig,
  mesIdx: number,
  semanaIdx: number,
  sessaoIdx: number,
): PSSessaoCalculada | null {
  const mes = lev.meses[mesIdx];
  if (!mes) return null;
  const semana = mes.semanas[semanaIdx] ?? emptySemana();
  const fr = fracoesSessoes(semana.sessoes || 1, semana.splitSessao);
  const frac = (fr[sessaoIdx] ?? 0) / 100;
  const nlSemana = nlPorZonaSemana(mes, semanaIdx);

  const zonas: PSZonaSessao[] = [];
  PS_ZONAS.forEach((z) => {
    const nl = nlSemana[z.key] * frac;
    if (nl < 0.5) return;
    const kg = mes.kgOverride?.[z.key] ?? kgZona(lev.rm1, z.pctCentral);
    const key = `${sessaoIdx}:${z.key}`;
    const override = semana.overrides?.[key];
    zonas.push({
      zona: z.key,
      label: z.label,
      pctCentral: z.pctCentral,
      nl: Math.round(nl * 100) / 100,
      kg,
      series: override && override.trim() ? override : sugerirSeries(nl, repsIdeal(z.pctCentral)),
      manual: !!(override && override.trim()),
    });
  });

  return {
    mesIdx,
    semanaIdx,
    sessaoIdx,
    fase: mes.fase,
    zonas,
    nlTotal: Math.round(zonas.reduce((a, z) => a + z.nl, 0) * 100) / 100,
  };
}

/** Total de sessões planejadas para o levantamento (todos os meses/semanas). */
export function totalSessoes(lev: PSLevantamentoConfig): number {
  return lev.meses.reduce(
    (acc, m) => acc + m.semanas.reduce((a, s) => a + (s.sessoes || 0), 0),
    0,
  );
}

export type PSStatus =
  | { phase: "sessao"; done: number; total: number; sessao: PSSessaoCalculada }
  | { phase: "concluido"; done: number; total: number }
  | { phase: "vazio"; done: number; total: number };

/** Localiza a sessão atual a partir do nº de sessões concluídas do levantamento. */
export function statusLevantamento(
  lev: PSLevantamentoConfig,
  done: number,
): PSStatus {
  const total = totalSessoes(lev);
  if (total === 0) return { phase: "vazio", done, total };
  if (done >= total) return { phase: "concluido", done, total };
  let restante = done;
  for (let m = 0; m < lev.meses.length; m++) {
    const mes = lev.meses[m];
    for (let w = 0; w < mes.semanas.length; w++) {
      const n = mes.semanas[w].sessoes || 0;
      if (restante < n) {
        const sessao = calcularSessao(lev, m, w, restante);
        return sessao
          ? { phase: "sessao", done, total, sessao }
          : { phase: "vazio", done, total };
      }
      restante -= n;
    }
  }
  return { phase: "concluido", done, total };
}

/** Chave usada em `treino_sessoes.variacao` para cada levantamento. */
export function variacaoKey(tipo: PSLevantamento): string {
  return `PS_${tipo.toUpperCase()}`;
}

export function tipoFromVariacao(v: string): PSLevantamento | null {
  const t = v.replace(/^PS_/, "").toLowerCase();
  return (PS_LEVANTAMENTOS as string[]).includes(t) ? (t as PSLevantamento) : null;
}
