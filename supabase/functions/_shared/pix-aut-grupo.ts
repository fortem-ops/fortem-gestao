// Regras puras do Pix Automático por grupo de itens (Etapa 1). Sem acesso a banco nem ao Inter.

/** Antecedência mínima (dias) entre hoje e a 1ª data da recorrência: o BCB exige que a cobrança
 * seja enviada de 2 a 10 dias antes; usamos 3 para dar folga à autorização do aluno. */
export const ANTECEDENCIA_MIN_DIAS = 3;

function ultimoDia(ano: number, mes0: number): number {
  return new Date(Date.UTC(ano, mes0 + 1, 0)).getUTCDate();
}

/** 1ª data da recorrência: o dia de débito (vencimento mais próximo), empurrado de mês em mês
 * até ficar a pelo menos ANTECEDENCIA_MIN_DIAS de hoje. Dias 29–31 viram o último dia do mês. */
export function dataInicioRecorrencia(diaDebito: string | null, hoje: string): string {
  const [hy, hm, hd] = hoje.split("-").map(Number);
  const minimo = Date.UTC(hy, hm - 1, hd + ANTECEDENCIA_MIN_DIAS);
  const base = diaDebito ?? hoje;
  const [by, bm, bd] = base.split("-").map(Number);
  let ano = by, mes0 = bm - 1;
  for (let i = 0; i < 24; i++) {
    const d = Math.min(bd, ultimoDia(ano, mes0));
    const t = Date.UTC(ano, mes0, d);
    if (t >= minimo) return new Date(t).toISOString().slice(0, 10);
    mes0 += 1; if (mes0 > 11) { mes0 = 0; ano += 1; }
  }
  return new Date(minimo).toISOString().slice(0, 10);
}

/** Identificador enviado ao Inter em vinculo.contrato (máx. 35): "G" + id do grupo sem hífens. */
export function vinculoRefGrupo(grupoId: string): string {
  return ("G" + grupoId.replace(/-/g, "")).slice(0, 35);
}
