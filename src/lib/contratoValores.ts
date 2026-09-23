export type ContratoParaValores = {
  valor_cobrado: number | string | null;
  parcelas?: number | null;
  forma_pagamento?: string | null;
  data_inicio?: string | null;
  data_fim?: string | null;
  vigencia_tipo?: string | null;
};

export type VendaVinculada = {
  valor_final?: number | string | null;
  parcelas?: number | null;
  tipo_cobranca?: string | null;
};

export type ValoresContrato = {
  total: number;
  parcela: number;
  recorrente: boolean;
  quantidadeParcelas: number;
  meses: number;
};

const FORMAS_RECORRENCIA = new Set(["cartao_recorrencia", "pix_automatico"]);

function numeroPositivo(valor: number | string | null | undefined, fallback = 0): number {
  const numero = Number(valor);
  return Number.isFinite(numero) && numero >= 0 ? numero : fallback;
}

function mesesEntreDatas(inicio?: string | null, fim?: string | null): number | null {
  if (!inicio || !fim) return null;
  const inicioPartes = inicio.split("-").map(Number);
  const fimPartes = fim.split("-").map(Number);
  if (inicioPartes.length < 2 || fimPartes.length < 2) return null;
  const [anoInicio, mesInicio] = inicioPartes;
  const [anoFim, mesFim] = fimPartes;
  if (!anoInicio || !mesInicio || !anoFim || !mesFim) return null;
  const meses = (anoFim - anoInicio) * 12 + (mesFim - mesInicio);
  return meses > 0 ? meses : 1;
}

export function duracaoRealContrato(contrato: ContratoParaValores): number {
  const entreDatas = mesesEntreDatas(contrato.data_inicio, contrato.data_fim);
  if (entreDatas) return entreDatas;
  if (contrato.vigencia_tipo === "anual") return 12;
  if (contrato.vigencia_tipo === "semestral") return 6;
  return 1;
}

export function calcularValoresContrato(
  contrato: ContratoParaValores,
  venda?: VendaVinculada | null,
): ValoresContrato {
  const recorrente = venda?.tipo_cobranca
    ? venda.tipo_cobranca === "recorrencia"
    : FORMAS_RECORRENCIA.has(contrato.forma_pagamento ?? "");
  const meses = duracaoRealContrato(contrato);
  const valorContrato = numeroPositivo(contrato.valor_cobrado);

  if (recorrente) {
    const totalVenda = venda?.valor_final == null
      ? null
      : numeroPositivo(venda.valor_final);
    const total = totalVenda ?? valorContrato * meses;
    return {
      total,
      parcela: meses > 0 ? total / meses : valorContrato,
      recorrente: true,
      quantidadeParcelas: meses,
      meses,
    };
  }

  const quantidadeParcelas = Math.max(1, Math.trunc(numeroPositivo(venda?.parcelas ?? contrato.parcelas, 1)) || 1);
  const total = venda?.valor_final == null
    ? valorContrato
    : numeroPositivo(venda.valor_final);
  return {
    total,
    parcela: total / quantidadeParcelas,
    recorrente: false,
    quantidadeParcelas,
    meses,
  };
}