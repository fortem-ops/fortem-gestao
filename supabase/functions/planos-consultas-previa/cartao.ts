// F3 — cartão das consultas: 2ª tokenização + captura própria (CIT, subscription=false),
// separada da assinatura. Número/CVV só em memória; nada é logado.
export type Cartao = { numero: string; nome: string; mes: string; ano: string; cvv: string };
export type Resultado = 'aprovado' | 'recusado' | 'desconhecido';
export type Obrigacao = { id: string; valor_centavos: number; parcelas: number; forma: string; status: string };
export type Rede = {
  tokenizar: (c: Cartao) => Promise<{ ok: boolean; tokenizationId: string | null; erroRede?: boolean }>;
  cobrar: (i: { tokenizationId: string; cartao: Cartao; centavos: number; parcelas: number; reference: string; subscription: false }) =>
    Promise<{ httpStatus: number; erroRede: boolean; parsed: any }>;
  consultarPorReferencia: (ref: string) => Promise<{ httpStatus: number; erroRede: boolean; parsed: any }>;
};
export type Db = {
  reservar: () => Promise<{ tentativa_id: string; reutilizada: boolean }>;
  tentativa: (id: string) => Promise<{ id: string; status: string; ref: string } | null>;
  resultado: (id: string, status: 'processando' | 'recusado' | 'desconhecido', motivo: string) => Promise<void>;
  liquidar: (id: string, a: { tid: string | null; nsu: string | null; autorizacao: string | null; returnCode: string; centavos: number; parcelas: number }) => Promise<void>;
};

export function luhn(n: string) {
  if (!/^\d{13,19}$/.test(n)) return false;
  let s = 0, d2 = false;
  for (let i = n.length - 1; i >= 0; i--) { let d = n.charCodeAt(i) - 48; if (d2) { d *= 2; if (d > 9) d -= 9; } s += d; d2 = !d2; }
  return s % 10 === 0;
}
export function validarCartao(c: Partial<Cartao>, agora = new Date()): Cartao | null {
  const numero = String(c.numero ?? '').replace(/\D/g, ''), cvv = String(c.cvv ?? '').replace(/\D/g, '');
  const nome = String(c.nome ?? '').trim().replace(/\s+/g, ' ').slice(0, 26);
  const mes = String(c.mes ?? '').padStart(2, '0'), ano = String(c.ano ?? '');
  const m = Number(mes), a = Number(ano);
  if (!luhn(numero) || nome.length < 3 || !/^\d{3,4}$/.test(cvv) || !(m >= 1 && m <= 12) || !/^\d{4}$/.test(ano) || new Date(a, m, 1) <= agora) return null;
  return { numero, nome, mes, ano, cvv };
}
/** Interpreta a resposta da transação: só "00" aprova; falha de rede/HTTP 5xx/sem returnCode = desconhecido. */
export function interpretar(r: { httpStatus: number; erroRede: boolean; parsed: any }): { resultado: Resultado; returnCode: string | null } {
  const rc = r.parsed?.returnCode ?? null;
  if (r.erroRede || r.httpStatus === 0 || r.httpStatus >= 500 || rc == null) return { resultado: 'desconhecido', returnCode: rc };
  return { resultado: rc === '00' ? 'aprovado' : 'recusado', returnCode: rc };
}

export async function cobrarConsultas(o: Obrigacao, planoAtivo: boolean, cartao: Cartao, rede: Rede, db: Db): Promise<{ resultado: Resultado | 'bloqueado'; motivo?: string }> {
  if (!planoAtivo) return { resultado: 'bloqueado', motivo: 'Ative o plano primeiro' };
  if (o.forma !== 'cartao_parcelado' || o.parcelas < 1 || o.parcelas > 6) return { resultado: 'bloqueado', motivo: 'Consultas no cartão em 1 a 6x' };
  if (o.status === 'desconhecido') return { resultado: 'bloqueado', motivo: 'Resultado desconhecido: concilie antes de nova cobrança' };
  if (o.status === 'pago' || o.status === 'vendido') return { resultado: 'aprovado' };
  const r = await db.reservar();
  const t = await db.tentativa(r.tentativa_id);
  if (!t) return { resultado: 'bloqueado', motivo: 'Tentativa indisponível' };
  if (t.status === 'aprovado') return { resultado: 'aprovado' };
  if (t.status !== 'pendente') return { resultado: 'bloqueado', motivo: 'Pagamento das consultas já em processamento' };
  await db.resultado(t.id, 'processando', 'tokenizando');
  const tk = await rede.tokenizar(cartao);
  if (!tk.ok || !tk.tokenizationId) { await db.resultado(t.id, 'recusado', 'tokenizacao_recusada'); return { resultado: 'recusado' }; }
  await db.resultado(t.id, 'processando', 'cobrando');
  const c = await rede.cobrar({ tokenizationId: tk.tokenizationId, cartao, centavos: o.valor_centavos, parcelas: o.parcelas, reference: t.ref, subscription: false });
  return aplicar(t.id, o, c, db);
}

async function aplicar(id: string, o: Obrigacao, c: { httpStatus: number; erroRede: boolean; parsed: any }, db: Db) {
  const i = interpretar(c);
  if (i.resultado === 'aprovado') {
    const p = c.parsed ?? {};
    await db.liquidar(id, { tid: p.tid ?? null, nsu: p.nsu ?? null, autorizacao: p.authorizationCode ?? null, returnCode: '00', centavos: Number(p.amount ?? o.valor_centavos), parcelas: Number(p.installments ?? o.parcelas) });
  } else await db.resultado(id, i.resultado, i.resultado === 'recusado' ? `recusado_${i.returnCode}` : 'sem_resposta');
  return { resultado: i.resultado };
}

/** Conciliação de desconhecido: só consulta pela referência; nunca cobra de novo. */
export async function conciliarConsultas(o: Obrigacao, tentativaId: string, ref: string, rede: Rede, db: Db) {
  const r = await rede.consultarPorReferencia(ref);
  if (r.httpStatus === 404) { await db.resultado(tentativaId, 'recusado', 'nao_encontrada_na_rede'); return { resultado: 'recusado' as Resultado }; }
  const tx = r.parsed?.authorization ?? r.parsed;
  return aplicar(tentativaId, o, { ...r, parsed: tx }, db);
}

/** Rede simulada para a prévia: nenhum acesso externo. O cenário escolhido pelo admin define a resposta. */
export function redeSimulada(cenario: Resultado): Rede {
  const resp = (ok: boolean, c: { amount?: number; installments?: number } = {}) => ({
    httpStatus: ok ? 200 : cenario === 'desconhecido' ? 0 : 200, erroRede: cenario === 'desconhecido' && !ok,
    parsed: cenario === 'desconhecido' && !ok ? null : { returnCode: cenario === 'aprovado' ? '00' : '05', tid: 'SIM' + Date.now(), nsu: 'SIM', authorizationCode: 'SIM', ...c },
  });
  return {
    tokenizar: async () => ({ ok: true, tokenizationId: 'sim-' + crypto.randomUUID() }),
    cobrar: async i => resp(false, { amount: i.centavos, installments: i.parcelas }),
    consultarPorReferencia: async () => cenario === 'desconhecido' ? { httpStatus: 0, erroRede: true, parsed: null } : resp(true),
  };
}
