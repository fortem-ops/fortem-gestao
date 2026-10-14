// Cobrança mensal automática dos planos 2027 (só planos_2027_mensalidades). Regras puras + dependências injetadas.
// Ordem: concilia incertas (nunca recobra) → devidas (máx 50) → pode_cobrar → reservar → cobrar → resultado.
// Nada de número/CVV/CPF/nome aqui: o nome do titular só é lido do token na hora da chamada à Rede.

export type Mensalidade = {
  id: string; proposta_id: string; tokenizacao_id: string; numero: number; valor_centavos: number;
  status: string; tentativas: number; referencia: string | null; simulado: boolean;
};
export type Cobranca = { res: "aprovado" | "recusado" | "desconhecido"; tid?: string | null; motivo?: string };
export type Consulta = { res: "aprovado" | "recusado" | "nao_encontrado" | "desconhecido"; tid?: string | null };

export type DepsRec = {
  simulacao: boolean;
  devidas(hoje: string): Promise<Mensalidade[]>;
  incertas(): Promise<Mensalidade[]>;
  podeCobrar(id: string): Promise<string>;
  reservar(id: string): Promise<Mensalidade | null>;
  cobrar(m: Mensalidade): Promise<Cobranca>;
  consultar(m: Mensalidade): Promise<Consulta>;
  resultado(id: string, res: string, tid: string | null, motivo: string | null, hoje: string): Promise<string>;
  alerta(mensagem: string): Promise<void>;
};

/** Teto de valor cobrado por execução (R$ 15.000,00); passou disso, para e avisa a equipe. */
export const TETO_EXECUCAO_CENTAVOS = 1_500_000;

export type Resumo = {
  conciliadas: number; cobradas: number; aprovadas: number; recusadas: number; incertas: number;
  inadimplentes: number; puladas: Record<string, number>; teto_atingido: boolean;
};

export async function executar(deps: DepsRec, hoje: string): Promise<Resumo> {
  const s: Resumo = { conciliadas: 0, cobradas: 0, aprovadas: 0, recusadas: 0, incertas: 0, inadimplentes: 0, puladas: {}, teto_atingido: false };
  const pular = (m: string) => { s.puladas[m] = (s.puladas[m] ?? 0) + 1; };

  // 1) Incertas: só consulta pela referência; nunca nova cobrança.
  for (const m of await deps.incertas()) {
    if (m.simulado !== deps.simulacao) continue;
    if (m.status === "processando") await deps.resultado(m.id, "desconhecido", null, "travado", hoje);
    let c: Consulta;
    try { c = await deps.consultar(m); } catch { continue; }
    if (c.res === "aprovado" || c.res === "recusado") {
      const st = await deps.resultado(m.id, c.res, c.tid ?? null, c.res === "recusado" ? "conciliado_recusado" : null, hoje);
      s.conciliadas++;
      if (st === "inadimplente") s.inadimplentes++;
    }
  }

  // 2) Devidas.
  let total = 0;
  for (const m of await deps.devidas(hoje)) {
    if (m.simulado !== deps.simulacao) { pular("modo_divergente"); continue; }
    if (!deps.simulacao) {
      const ok = await deps.podeCobrar(m.id);
      if (ok !== "ok") { pular(ok); continue; }
    }
    if (total + m.valor_centavos > TETO_EXECUCAO_CENTAVOS) {
      s.teto_atingido = true;
      await deps.alerta(`Teto da execução atingido (R$ ${(TETO_EXECUCAO_CENTAVOS / 100).toFixed(2)}); restantes ficam para a próxima.`);
      break;
    }
    const r = await deps.reservar(m.id);
    if (!r) { pular("ja_reservada"); continue; }
    total += r.valor_centavos;
    s.cobradas++;
    let c: Cobranca;
    try { c = await deps.cobrar(r); } catch { c = { res: "desconhecido", motivo: "erro_execucao" }; }
    const st = await deps.resultado(r.id, c.res, c.tid ?? null, c.motivo ?? null, hoje);
    if (c.res === "aprovado") s.aprovadas++;
    else if (c.res === "recusado") s.recusadas++;
    else s.incertas++;
    if (st === "inadimplente") s.inadimplentes++;
  }
  return s;
}
