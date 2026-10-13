/** Presentation of the accepted proposal. No provider integration. */
export function parcelasReservadas(total: number, quantidade: number): number[] {
  const n = Math.max(1, Math.min(12, Math.floor(quantidade || 1)));
  const base = Math.floor(total / n);
  return Array.from({ length: n }, (_, i) => i === n - 1 ? total - base * (n - 1) : base);
}

export function pagamentoReservado(r: Record<string, any>) {
  const junto = r.forma_plano === "cartao_parcelado" && !r.forma_servicos;
  return {
    reservado: true,
    validade_pix_segundos: 1800,
    formas_permitidas: [r.forma_plano],
    parcelas: parcelasReservadas(Number(r.plano_centavos) + (junto ? Number(r.servicos_centavos) : 0), Number(r.parcelas_plano)),
    parcelas_servicos: !junto && Number(r.servicos_centavos) > 0
      ? parcelasReservadas(Number(r.servicos_centavos), r.forma_servicos === "pix_vista" ? 1 : Number(r.parcelas_servicos)) : [],
  };
}