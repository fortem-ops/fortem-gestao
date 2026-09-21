import type { FuncionalSnapshot } from "./useAlunoAvaliacoesConsolidadas";
import {
  ASSIMETRIA_ABSOLUTA,
  ASSIMETRIA_PCT_LIMIARES,
  classificarAssimetria,
  FORCA_EXERCICIO_LABEL,
  getMetricDisplayLabel,
  metricaInvertida,
  nivelAssimetria,
  type AssimetriaNivel,
  type ForcaExercicio,
} from "@/components/student/assessment/funcionalV2/bodyMapLogic";

export type AssimetriaItemTipo = "metric" | "forca";
export type AssimetriaMedidaTipo = "mobilidade" | "forca";
export type AssimetriaLado = "esquerdo" | "direito" | "sem_diferenca";
export type TendenciaAssimetria = "melhorou" | "piorou" | "estavel";

export interface AssimetriaGraficoItem {
  key: string;
  label: string;
  tipo: AssimetriaItemTipo;
  origem: string;
  unidade: "°" | "%";
}

export interface ProtocoloAssimetriaMarco {
  tipo?: AssimetriaItemTipo;
  origem: string;
  data: string;
  rotulo: string;
}

export interface AssimetriaPontoEvolucao {
  data: string;
  timestamp: number;
  valor: number;
  unidade: "°" | "%";
  nivel: AssimetriaNivel;
  ladoMaisFraco: AssimetriaLado | null;
}

export interface AssimetriaResumoEvolucao extends AssimetriaGraficoItem {
  nome: string;
  pontos: AssimetriaPontoEvolucao[];
  primeira: AssimetriaPontoEvolucao | null;
  ultima: AssimetriaPontoEvolucao | null;
  variacao: number | null;
  tendencia: TendenciaAssimetria;
  primeiroLadoValido: AssimetriaLado | null;
  ultimoLadoValido: AssimetriaLado | null;
  inverteu: boolean;
  corteModerado: number;
  corteSevero: number;
  razaoSeveroAtual: number;
  foraFaixaVerde: boolean;
  marcos: ProtocoloAssimetriaMarco[];
}

export interface AssimetriaResumoStats {
  foraFaixaVerde: number;
  pioraram: number;
  inverteram: number;
}

/** Lista preparada para marcar mudanças de protocolo nos gráficos. Mantida vazia até haver data oficial. */
export const MARCOS_PROTOCOLO_ASSIMETRIA: ProtocoloAssimetriaMarco[] = [];

/** Paleta compartilhada para manter a mesma identidade visual entre abas. */
const ASSIMETRIA_CORES = [
  "hsl(var(--info))",
  "hsl(var(--destructive))",
  "hsl(var(--license))",
  "hsl(var(--warning))",
  "hsl(var(--success))",
  "hsl(var(--sev-weak))",
  "hsl(var(--sev-medium))",
  "hsl(var(--sev-excellent))",
] as const;

const NIVEL_ORDEM: Record<AssimetriaNivel, number> = { severa: 2, moderada: 1, nenhuma: 0 };
const CORTE_ESTAVEL_PCT = 1;
const CORTE_ESTAVEL_GRAUS = 0.5;

export function corAssimetria(indice: number): string {
  return ASSIMETRIA_CORES[indice % ASSIMETRIA_CORES.length];
}

function numero(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

function itemMetrica(metric: string, unidade: "°" | "%"): AssimetriaGraficoItem {
  return {
    key: `assimetria:metric:${metric}`,
    label: `${getMetricDisplayLabel(metric)} (${unidade})`,
    tipo: "metric",
    origem: metric,
    unidade,
  };
}

function itemForca(nome: string): AssimetriaGraficoItem {
  return {
    key: `assimetria:forca:${nome}`,
    label: `${FORCA_EXERCICIO_LABEL[nome as ForcaExercicio] ?? nome} (%)`,
    tipo: "forca",
    origem: nome,
    unidade: "%",
  };
}

export function rotuloAssimetria(item: Pick<AssimetriaGraficoItem, "label">): string {
  return item.label.replace(/\s\([°%]\)$/u, "");
}

export function limiaresAssimetria(metric?: string): { moderado: number; severo: number; unidade: "°" | "%" } {
  const absoluto = metric ? ASSIMETRIA_ABSOLUTA[metric] : undefined;
  return absoluto
    ? { moderado: absoluto.moderado, severo: absoluto.severo, unidade: "°" }
    : { moderado: ASSIMETRIA_PCT_LIMIARES.moderado, severo: ASSIMETRIA_PCT_LIMIARES.severo, unidade: "%" };
}

export function listarItensAssimetria(history: FuncionalSnapshot[]): AssimetriaGraficoItem[] {
  const itens = new Map<string, AssimetriaGraficoItem>();

  history.forEach((snap) => {
    snap.metricas.forEach((m) => {
      const info = classificarAssimetria(m.metric, m.left, m.right);
      if (!info) return;
      const item = itemMetrica(m.metric, info.unidade);
      itens.set(item.key, item);
    });
    snap.forca.forEach((f) => {
      const esquerdo = numero(f.esquerdo_kg);
      const direito = numero(f.direito_kg);
      if (esquerdo === null || direito === null) return;
      const item = itemForca(f.nome);
      itens.set(item.key, item);
    });
  });

  return Array.from(itens.values()).sort((a, b) => rotuloAssimetria(a).localeCompare(rotuloAssimetria(b)));
}

export function ladoMaisFracoMetrica(
  metric: string,
  esquerdo: number | null | undefined,
  direito: number | null | undefined,
): AssimetriaLado | null {
  if (esquerdo === null || esquerdo === undefined || direito === null || direito === undefined) return null;
  if (esquerdo === direito) return "sem_diferenca";
  if (metricaInvertida(metric)) return esquerdo > direito ? "esquerdo" : "direito";
  return esquerdo < direito ? "esquerdo" : "direito";
}

export function ladoMaisFracoForca(
  esquerdo: number | null | undefined,
  direito: number | null | undefined,
): AssimetriaLado | null {
  if (esquerdo === null || esquerdo === undefined || direito === null || direito === undefined) return null;
  if (esquerdo === direito) return "sem_diferenca";
  return esquerdo < direito ? "esquerdo" : "direito";
}

export function calcularTendenciaAssimetria(variacao: number | null, unidade: "°" | "%"): TendenciaAssimetria {
  if (variacao === null) return "estavel";
  const corte = unidade === "°" ? CORTE_ESTAVEL_GRAUS : CORTE_ESTAVEL_PCT;
  if (Math.abs(variacao) < corte) return "estavel";
  return variacao < 0 ? "melhorou" : "piorou";
}

export function houveInversaoLado(
  primeiro: AssimetriaLado | null | undefined,
  ultimo: AssimetriaLado | null | undefined,
): boolean {
  if (!primeiro || !ultimo) return false;
  if (primeiro === "sem_diferenca" || ultimo === "sem_diferenca") return false;
  return primeiro !== ultimo;
}

export function razaoSeveroAssimetria(metric: string | undefined, valor: number | null | undefined): number {
  if (valor === null || valor === undefined) return 0;
  const { severo } = limiaresAssimetria(metric);
  return severo > 0 ? valor / severo : 0;
}

export function compararPreocupacaoAssimetria(
  a: Pick<AssimetriaResumoEvolucao, "ultima" | "razaoSeveroAtual" | "nome">,
  b: Pick<AssimetriaResumoEvolucao, "ultima" | "razaoSeveroAtual" | "nome">,
): number {
  const nivelA = a.ultima ? NIVEL_ORDEM[a.ultima.nivel] : -1;
  const nivelB = b.ultima ? NIVEL_ORDEM[b.ultima.nivel] : -1;
  if (nivelA !== nivelB) return nivelB - nivelA;
  if (a.razaoSeveroAtual !== b.razaoSeveroAtual) return b.razaoSeveroAtual - a.razaoSeveroAtual;
  return a.nome.localeCompare(b.nome);
}

function snapPorData(history: FuncionalSnapshot[]): Map<string, FuncionalSnapshot> {
  const map = new Map<string, FuncionalSnapshot>();
  history.forEach((snap) => map.set(snap.data, snap));
  return map;
}

export function valorAssimetria(snap: FuncionalSnapshot | null | undefined, item: AssimetriaGraficoItem): number | null {
  const ponto = avaliarAssimetriaNoSnapshot(snap, item);
  return ponto ? Number(ponto.valor.toFixed(1)) : null;
}

export function avaliarAssimetriaNoSnapshot(
  snap: FuncionalSnapshot | null | undefined,
  item: AssimetriaGraficoItem,
): Omit<AssimetriaPontoEvolucao, "data" | "timestamp"> | null {
  if (!snap) return null;
  if (item.tipo === "metric") {
    const m = snap.metricas.find((x) => x.metric === item.origem);
    const info = classificarAssimetria(item.origem, m?.left, m?.right);
    if (!info) return null;
    return {
      valor: Number(info.valor.toFixed(1)),
      unidade: info.unidade,
      nivel: info.nivel,
      ladoMaisFraco: ladoMaisFracoMetrica(item.origem, m?.left, m?.right),
    };
  }
  const f = snap.forca.find((x) => x.nome === item.origem);
  const esquerdo = numero(f?.esquerdo_kg);
  const direito = numero(f?.direito_kg);
  const info = classificarAssimetria(item.origem, esquerdo, direito);
  if (!info) return null;
  return {
    valor: Number(info.valor.toFixed(1)),
    unidade: "%",
    nivel: nivelAssimetria(undefined, info.valor),
    ladoMaisFraco: ladoMaisFracoForca(esquerdo, direito),
  };
}

export function ordenarResumosAssimetria(resumos: AssimetriaResumoEvolucao[]): AssimetriaResumoEvolucao[] {
  return [...resumos].sort(compararPreocupacaoAssimetria);
}

export function montarResumoAssimetriaEvolucao(
  history: FuncionalSnapshot[],
  tipo: AssimetriaMedidaTipo,
  selectedDates: string[],
): AssimetriaResumoEvolucao[] {
  const datas = [...selectedDates].sort();
  const byDate = snapPorData(history);
  const itens = listarItensAssimetria(history).filter((item) => (tipo === "forca" ? item.tipo === "forca" : item.tipo === "metric"));

  const resumos = itens
    .map((item): AssimetriaResumoEvolucao | null => {
      const pontos = datas
        .map((data) => {
          const ponto = avaliarAssimetriaNoSnapshot(byDate.get(data), item);
          if (!ponto) return null;
          return { ...ponto, data, timestamp: new Date(`${data}T00:00:00`).getTime() };
        })
        .filter((ponto): ponto is AssimetriaPontoEvolucao => ponto !== null);

      if (pontos.length === 0) return null;
      const primeira = pontos[0] ?? null;
      const ultima = pontos[pontos.length - 1] ?? null;
      const variacao = primeira && ultima ? Number((ultima.valor - primeira.valor).toFixed(1)) : null;
      const primeiroLadoValido = pontos.find((p) => p.ladoMaisFraco && p.ladoMaisFraco !== "sem_diferenca")?.ladoMaisFraco ?? null;
      const ultimoLadoValido = [...pontos].reverse().find((p) => p.ladoMaisFraco && p.ladoMaisFraco !== "sem_diferenca")?.ladoMaisFraco ?? null;
      const metric = item.tipo === "metric" ? item.origem : undefined;
      const limiares = limiaresAssimetria(metric);
      const marcos = MARCOS_PROTOCOLO_ASSIMETRIA.filter((marco) => {
        if (marco.origem !== item.origem) return false;
        if (marco.tipo && marco.tipo !== item.tipo) return false;
        return datas.includes(marco.data);
      });

      return {
        ...item,
        nome: rotuloAssimetria(item),
        pontos,
        primeira,
        ultima,
        variacao,
        tendencia: calcularTendenciaAssimetria(variacao, item.unidade),
        primeiroLadoValido,
        ultimoLadoValido,
        inverteu: houveInversaoLado(primeiroLadoValido, ultimoLadoValido),
        corteModerado: limiares.moderado,
        corteSevero: limiares.severo,
        razaoSeveroAtual: razaoSeveroAssimetria(metric, ultima?.valor),
        foraFaixaVerde: ultima ? ultima.nivel !== "nenhuma" : false,
        marcos,
      };
    })
    .filter((resumo): resumo is AssimetriaResumoEvolucao => resumo !== null);

  return ordenarResumosAssimetria(resumos);
}

export function calcularStatsAssimetria(resumos: AssimetriaResumoEvolucao[]): AssimetriaResumoStats {
  return {
    foraFaixaVerde: resumos.filter((r) => r.foraFaixaVerde).length,
    pioraram: resumos.filter((r) => r.tendencia === "piorou").length,
    inverteram: resumos.filter((r) => r.inverteu).length,
  };
}

export function selecionarDatasTabela(selectedDates: string[]): string[] {
  const datas = [...selectedDates].sort();
  if (datas.length <= 5) return datas;
  return [datas[0], ...datas.slice(-4)];
}

export function temAssimetriaPreenchida(history: FuncionalSnapshot[], item: AssimetriaGraficoItem): boolean {
  return history.some((snap) => valorAssimetria(snap, item) !== null);
}
