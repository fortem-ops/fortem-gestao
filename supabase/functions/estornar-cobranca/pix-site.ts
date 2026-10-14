// Devolução Pix de cobrança de compra do site (/planos). Regras puras + dependências injetadas.
// Ordem: reserva atômica no banco → endToEndId → PUT devolução no Inter → resultado no banco.
// Erro de comunicação vira "desconhecido" (bloqueia nova tentativa até conferência): nunca devolve duas vezes.

export type ReservaPix = {
  ok: boolean; erro?: string; duplicado?: boolean;
  estorno_id?: string; txid?: string; valor?: number; devolucao_id?: string;
  e2e_salvo?: string | null; aluno_id?: string; numero_ciclo?: number;
};
export type RespostaInter = { status: number; data?: any; raw?: string; transportError?: string };

export type DepsPix = {
  reservar(): Promise<ReservaPix>;
  consultarE2e(txid: string): Promise<string | null>;
  devolver(e2e: string, devolucaoId: string, valor: string): Promise<RespostaInter>;
  resultado(estornoId: string, status: "devolvido" | "recusado" | "desconhecido", e2e: string | null, retorno: unknown): Promise<void>;
};

export type ResultadoPix =
  | { ok: true; estorno_id: string; e2e: string; devolucao_id: string; valor: number; status_inter?: string; aluno_id?: string; numero_ciclo?: number }
  | { ok: false; erro: string; http: number; duplicado?: boolean };

export async function devolverPixSite(deps: DepsPix): Promise<ResultadoPix> {
  const r = await deps.reservar();
  if (!r.ok || !r.estorno_id || !r.txid || !r.devolucao_id || r.valor == null) {
    return { ok: false, erro: r.erro ?? "Não foi possível iniciar a devolução", http: 409, duplicado: r.duplicado === true };
  }
  let e2e = r.e2e_salvo ?? null;
  if (!e2e) {
    try { e2e = await deps.consultarE2e(r.txid); } catch { e2e = null; }
  }
  if (!e2e) {
    await deps.resultado(r.estorno_id, "recusado", null, { motivo: "e2e_nao_encontrado" });
    return { ok: false, erro: "Pix recebido não localizado no banco. Nada foi devolvido.", http: 422 };
  }
  let resp: RespostaInter;
  try {
    resp = await deps.devolver(e2e, r.devolucao_id, Number(r.valor).toFixed(2));
  } catch (e) {
    resp = { status: 0, transportError: String(e) };
  }
  if (resp.transportError || resp.status === 0 || resp.status >= 500) {
    await deps.resultado(r.estorno_id, "desconhecido", e2e, { http: resp.status, erro: resp.transportError ?? null });
    return { ok: false, erro: "Sem resposta clara do banco. A devolução ficou em conferência — não tente de novo; confira no Inter.", http: 502 };
  }
  if (resp.status >= 300) {
    const msg = resp.data?.violacoes?.[0]?.razao ?? resp.data?.detail ?? resp.data?.title ?? "sem detalhe";
    await deps.resultado(r.estorno_id, "recusado", e2e, { http: resp.status, msg: String(msg).slice(0, 200) });
    return { ok: false, erro: `O banco recusou a devolução: ${String(msg).slice(0, 200)}`, http: 422 };
  }
  await deps.resultado(r.estorno_id, "devolvido", e2e, { http: resp.status, status: resp.data?.status ?? null, id: resp.data?.id ?? null });
  return {
    ok: true, estorno_id: r.estorno_id, e2e, devolucao_id: r.devolucao_id, valor: Number(r.valor),
    status_inter: resp.data?.status, aluno_id: r.aluno_id, numero_ciclo: r.numero_ciclo,
  };
}

/** Cobrança de teste só segue com confirmação explícita do admin. */
export function bloqueioTeste(origem: string | null | undefined, confirmouTeste: boolean): string | null {
  if (origem === "teste_2027" && !confirmouTeste) {
    return "Esta cobrança é de TESTE. Confirme que quer devolver dinheiro real de um teste antes de continuar.";
  }
  return null;
}
