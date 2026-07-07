/**
 * Cálculo de composição corporal — Protocolo de Pollock 7 dobras.
 * Fonte única de verdade da fórmula. Usado tanto pelo formulário legado
 * (AssessmentForm/BodyComposition) quanto pela aba Composição da tela
 * Avaliações Premium.
 */

export const DOBRAS_POLLOCK_7 = [
  "Peitoral",
  "Axilar média",
  "Tríceps",
  "Subescapular",
  "Abdominal",
  "Supra-ilíaca",
  "Coxa",
] as const;

export type DobraLabel = (typeof DOBRAS_POLLOCK_7)[number];
export type Sexo = "M" | "F";

export interface PollockClassification {
  label: string;
  color: string;
}

export interface PollockResult {
  sigma7: number;
  dc: number;
  bf: number;
  classification: PollockClassification;
  imc: number | null;
  massaMagra: number | null;
  massaGorda: number | null;
}

export function classifyBF(pct: number, sexo: Sexo): PollockClassification {
  if (sexo === "M") {
    if (pct <= 6) return { label: "Essencial", color: "text-info" };
    if (pct <= 13) return { label: "Excelente", color: "text-success" };
    if (pct <= 17) return { label: "Bom", color: "text-success" };
    if (pct <= 24) return { label: "Médio", color: "text-warning" };
    return { label: "Elevado", color: "text-destructive" };
  }
  if (pct <= 13) return { label: "Essencial", color: "text-info" };
  if (pct <= 20) return { label: "Excelente", color: "text-success" };
  if (pct <= 24) return { label: "Bom", color: "text-success" };
  if (pct <= 31) return { label: "Médio", color: "text-warning" };
  return { label: "Elevado", color: "text-destructive" };
}

export interface PollockInput {
  sexo: Sexo;
  idade: number;
  peso?: number | null;
  altura?: number | null;
  dobras: Record<string, string | number>;
}

/**
 * Retorna null se algum dado obrigatório (idade ou qualquer das 7 dobras)
 * não estiver preenchido/numérico. Peso e altura são opcionais (afetam
 * apenas IMC / massa magra / massa gorda).
 */
export function computePollock(input: PollockInput): PollockResult | null {
  const { sexo, idade, peso, altura, dobras } = input;
  if (!Number.isFinite(idade)) return null;
  const vals = DOBRAS_POLLOCK_7.map((d) => parseFloat(String(dobras[d] ?? "")));
  if (vals.some((v) => !Number.isFinite(v))) return null;

  const sigma7 = vals.reduce((a, b) => a + b, 0);
  const dc =
    sexo === "M"
      ? 1.112 - 0.00043499 * sigma7 + 0.00000055 * sigma7 * sigma7 - 0.00028826 * idade
      : 1.097 - 0.00046971 * sigma7 + 0.00000056 * sigma7 * sigma7 - 0.00012828 * idade;
  const bf = 495 / dc - 450;
  const classification = classifyBF(bf, sexo);

  const pesoNum = peso != null && Number.isFinite(peso) ? Number(peso) : NaN;
  const alturaNum = altura != null && Number.isFinite(altura) ? Number(altura) : NaN;
  const imc =
    !isNaN(pesoNum) && !isNaN(alturaNum) && alturaNum > 0
      ? pesoNum / (alturaNum / 100) ** 2
      : null;
  const massaMagra = !isNaN(pesoNum) ? pesoNum * (1 - bf / 100) : null;
  const massaGorda = !isNaN(pesoNum) ? pesoNum * (bf / 100) : null;

  return { sigma7, dc, bf, classification, imc, massaMagra, massaGorda };
}
