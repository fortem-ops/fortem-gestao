// Fluxo diário da cobrança mensal Pix Automático por grupo (Etapa 2). Sem dependências de rede: testável.
export type Devido = {
  grupo: string; aluno: string; vencimento: string; acao: "enviar" | "simular" | "janela_perdida";
  modo: string; ciclo?: string | null; ciclo_status: string | null; txid: string | null;
  composicao: { completo: boolean; valor: number; itens: unknown[]; faltando: unknown[] };
};
export type Reserva = { ok: boolean; motivo?: string; retomada?: boolean; ciclo?: string; txid?: string; valor?: number; vencimento?: string; id_rec?: string; aluno?: string };
export type RespInter = { status: number; data: { status?: string } | null };

export type Deps = {
  devidos(hoje: string): Promise<Devido[]>;
  simular(grupo: string, venc: string): Promise<void>;
  reservar(grupo: string, venc: string, hoje: string, txid: string): Promise<Reserva>;
  consultar(txid: string): Promise<RespInter>;
  enviar(r: Reserva): Promise<RespInter>;
  enviado(ciclo: string, statusInter: string | null, raw: unknown): Promise<void>;
  falha(ciclo: string, erro: string): Promise<void>;
  incerto(ciclo: string, erro: string): Promise<void>;
  janelaPerdida(grupo: string, venc: string, motivo: string): Promise<void>;
  novoTxid(): string;
};

export type Resumo = { simulados: string[]; enviados: string[]; falhas: string[]; incertos: string[]; aguardando: string[]; janela_perdida: string[] };

/** D-7 a D-3: envia; resultado incerto mantém reserva e txid; 4xx solta a reserva e avisa. */
export async function executar(deps: Deps, hoje: string): Promise<Resumo> {
  const s: Resumo = { simulados: [], enviados: [], falhas: [], incertos: [], aguardando: [], janela_perdida: [] };
  for (const d of await deps.devidos(hoje)) {
    const chave = `${d.grupo}:${d.vencimento}`;
    if (d.acao === "simular") { await deps.simular(d.grupo, d.vencimento); s.simulados.push(chave); continue; }
    if (d.acao === "janela_perdida") {
      if (d.ciclo_status === "reservado" && d.txid && d.ciclo) {
        const g = await deps.consultar(d.txid);
        if (g.status === 200) { await deps.enviado(d.ciclo, g.data?.status ?? null, g.data); s.enviados.push(chave); continue; }
      }
      await deps.janelaPerdida(d.grupo, d.vencimento, d.composicao.completo ? "envio não concluído até D-3" : "cobranças do mês incompletas até D-3");
      s.janela_perdida.push(chave); continue;
    }
    const r = await deps.reservar(d.grupo, d.vencimento, hoje, deps.novoTxid());
    if (!r.ok || !r.ciclo || !r.txid) { s.aguardando.push(`${chave}:${r.motivo ?? "?"}`); continue; }
    if (r.retomada) {
      const g = await deps.consultar(r.txid);
      if (g.status === 200) { await deps.enviado(r.ciclo, g.data?.status ?? null, g.data); s.enviados.push(chave); continue; }
    }
    let resp: RespInter;
    try { resp = await deps.enviar(r); } catch (e) { await deps.incerto(r.ciclo, String(e)); s.incertos.push(chave); continue; }
    if (resp.status < 300) { await deps.enviado(r.ciclo, resp.data?.status ?? null, resp.data); s.enviados.push(chave); }
    else if (resp.status >= 500 || resp.status === 429) { await deps.incerto(r.ciclo, `HTTP ${resp.status}`); s.incertos.push(chave); }
    else { await deps.falha(r.ciclo, `Inter recusou (HTTP ${resp.status}): ${JSON.stringify(resp.data).slice(0, 300)}`); s.falhas.push(chave); }
  }
  return s;
}
