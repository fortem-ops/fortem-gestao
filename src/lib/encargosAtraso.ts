// Encargos por atraso (Plano 1, E1) — cálculo puro, só para EXIBIÇÃO.
// Regras: correção pelo IPCA acumulado (fator mínimo 1, mês parcial pro rata die,
// meses sem divulgação usam o último índice publicado); multa 2% única e juros
// 1% a.m. simples pro rata die (dias/30), ambos sobre o principal corrigido.
// Data-base = dia seguinte ao vencimento. Valores em centavos inteiros.

export const MULTA_PCT = 2;
export const JUROS_PCT_MES = 1;

/** Mapa "AAAA-MM" → variação % do mês (ex.: 0.75). */
export type IndicesIpca = Record<string, number>;

export interface MesCorrecao {
  mes: string;
  dias: number;
  diasNoMes: number;
  variacao: number;
  /** true quando o mês não foi divulgado e usamos o último índice publicado. */
  estimado: boolean;
}

export interface EncargosResultado {
  diasAtraso: number;
  principal: number;
  fatorIpca: number;
  /** fator calculado antes do piso 1 (pode ser < 1). */
  fatorIpcaBruto: number;
  correcao: number;
  corrigido: number;
  multa: number;
  juros: number;
  total: number;
  meses: MesCorrecao[];
  semIndice: boolean;
}

const DIA = 86400000;
const utc = (iso: string) => {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  return Date.UTC(y, m - 1, d);
};
const chaveMes = (t: number) => new Date(t).toISOString().slice(0, 7);

function indiceDoMes(mes: string, indices: IndicesIpca): { v: number; estimado: boolean } | null {
  if (indices[mes] != null) return { v: indices[mes], estimado: false };
  const anteriores = Object.keys(indices).filter((k) => k < mes).sort();
  const ultimo = anteriores[anteriores.length - 1];
  return ultimo ? { v: indices[ultimo], estimado: true } : null;
}

export function calcularEncargosAtraso(params: {
  principalCentavos: number;
  vencimento: string; // AAAA-MM-DD
  dataCalculo: string; // AAAA-MM-DD
  indices: IndicesIpca;
}): EncargosResultado {
  const P = Math.round(params.principalCentavos);
  const diasAtraso = Math.max(0, Math.round((utc(params.dataCalculo) - utc(params.vencimento)) / DIA));
  const vazio: EncargosResultado = {
    diasAtraso, principal: P, fatorIpca: 1, fatorIpcaBruto: 1, correcao: 0, corrigido: P,
    multa: 0, juros: 0, total: P, meses: [], semIndice: false,
  };
  if (diasAtraso === 0 || P <= 0) return vazio;

  // Agrupa os dias do período (vencimento+1 .. dataCalculo) por mês.
  const porMes = new Map<string, number>();
  const inicio = utc(params.vencimento) + DIA;
  for (let i = 0; i < diasAtraso; i++) {
    const k = chaveMes(inicio + i * DIA);
    porMes.set(k, (porMes.get(k) ?? 0) + 1);
  }

  let fator = 1;
  let semIndice = false;
  const meses: MesCorrecao[] = [];
  for (const [mes, dias] of porMes) {
    const [y, m] = mes.split("-").map(Number);
    const diasNoMes = new Date(Date.UTC(y, m, 0)).getUTCDate();
    const idx = indiceDoMes(mes, params.indices);
    if (!idx) semIndice = true;
    const variacao = idx?.v ?? 0;
    fator *= 1 + (variacao / 100) * (dias / diasNoMes);
    meses.push({ mes, dias, diasNoMes, variacao, estimado: idx?.estimado ?? true });
  }

  const fatorIpca = Math.max(1, fator);
  const corrigido = Math.round(P * fatorIpca);
  const multa = Math.round((corrigido * MULTA_PCT) / 100);
  const juros = Math.round((corrigido * JUROS_PCT_MES * diasAtraso) / 100 / 30);
  return {
    diasAtraso, principal: P, fatorIpca, fatorIpcaBruto: fator, correcao: corrigido - P, corrigido,
    multa, juros, total: corrigido + multa + juros, meses, semIndice,
  };
}

/** Mensalidade 2027 entra no cálculo: vencida e ainda não paga/cancelada. */
export function mensalidadeEmAtraso(m: { status: string; vencimento: string }, hoje: string): boolean {
  return !["pago", "cancelado"].includes(m.status) && m.vencimento < hoje;
}
