import type { FuncionalSnapshot } from "./useAlunoAvaliacoesConsolidadas";
import {
  classificarAssimetria,
  classifyForca,
  FORCA_EXERCICIO_LABEL,
  getMetricDisplayLabel,
  type ForcaExercicio,
} from "@/components/student/assessment/funcionalV2/bodyMapLogic";

export type AssimetriaItemTipo = "metric" | "forca";

export interface AssimetriaGraficoItem {
  key: string;
  label: string;
  tipo: AssimetriaItemTipo;
  origem: string;
  unidade: "°" | "%";
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

  return Array.from(itens.values()).sort((a, b) => a.label.localeCompare(b.label));
}

export function valorAssimetria(snap: FuncionalSnapshot | null | undefined, item: AssimetriaGraficoItem): number | null {
  if (!snap) return null;
  if (item.tipo === "metric") {
    const m = snap.metricas.find((x) => x.metric === item.origem);
    const info = classificarAssimetria(item.origem, m?.left, m?.right);
    return info ? Number(info.valor.toFixed(1)) : null;
  }
  const f = snap.forca.find((x) => x.nome === item.origem);
  const esquerdo = numero(f?.esquerdo_kg);
  const direito = numero(f?.direito_kg);
  if (esquerdo === null || direito === null) return null;
  return Number(classifyForca(direito, esquerdo).assimetria.toFixed(1));
}

export function temAssimetriaPreenchida(history: FuncionalSnapshot[], item: AssimetriaGraficoItem): boolean {
  return history.some((snap) => valorAssimetria(snap, item) !== null);
}