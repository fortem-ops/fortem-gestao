export interface ProjecaoMes {
  mes: string; // yyyy-MM
  renovacao_liquido: number | string | null;
  vendas_novas_liquido: number | string | null;
}

const n = (v: unknown) => Number(v ?? 0) || 0;

/** Valor mensal projetado de uma renovação: mensal × taxa de renovação × (1 − taxa do cartão). */
export function valorRenovacaoProjetada(mensal: number, taxaRenovacao: number, taxaCartaoPct = 0) {
  return Math.round(mensal * taxaRenovacao * (1 - taxaCartaoPct / 100) * 100) / 100;
}

/** Soma a projeção dos meses que começam depois de hoje e até hoje + dias. */
export function somaProjecaoJanela(meses: ProjecaoMes[], hoje: string, dias: number) {
  const fim = new Date(`${hoje}T12:00:00`);
  fim.setDate(fim.getDate() + dias);
  const fimIso = fim.toISOString().slice(0, 10);
  return meses
    .filter((m) => `${m.mes}-01` > hoje && `${m.mes}-01` <= fimIso)
    .reduce((s, m) => s + n(m.renovacao_liquido) + n(m.vendas_novas_liquido), 0);
}

/** Data limite (inclusive) de uma janela de N dias a partir de hoje. */
export function limiteJanela(hoje: string, dias: number) {
  const d = new Date(`${hoje}T12:00:00`);
  d.setDate(d.getDate() + dias);
  return d.toISOString().slice(0, 10);
}
