// Disparo de Mensagens — ações: teste, preparar, enviar, cancelar.
// Reutiliza send-whatsapp (modo template).
// Etapa 5: msg_config.real_liberado liberado por migração (rollback em scripts/msg-liberar-envio.rollback.sql).
// Sem a trava, `enviar` responde 423 sem tocar em nada. Ninguém liga a trava pela interface.
// Cada clique envia no máximo lote_limite (50).
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';
import { normalizarTelefone, sanitizeTextParam } from '../_shared/whatsapp.ts';

const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

type Variavel = { pos: number; fonte: 'campo' | 'fixo'; valor: string };
const LIMITE_HORA = 20;

function montarParametros(vars: Variavel[], nome: string): string[] {
  const n = nome.trim();
  const campo = (c: string) =>
    c === 'primeiro_nome' ? (n.split(/\s+/)[0] ?? '') : c === 'nome_aluno' ? n : c === 'link_festa' ? 'https://soufortem.com.br/10anos' : '';
  return [...vars].sort((a, b) => a.pos - b.pos).map((v) => sanitizeTextParam(v.fonte === 'fixo' ? v.valor : campo(v.valor)));
}

function erroLegivel(details: any, fallback: string): string {
  const e = details?.error ?? details;
  const code = e?.code;
  const msg = e?.error_user_msg || e?.error_data?.details || e?.message;
  const mapa: Record<number, string> = {
    131026: 'O número não tem WhatsApp ou não pode receber mensagens.',
    132001: 'Modelo não encontrado na Meta com esse nome/idioma.',
    132000: 'Quantidade de variáveis diferente da aprovada na Meta.',
    131047: 'Janela de 24h fechada; use um modelo aprovado.',
    130429: 'Limite de envios da Meta atingido; tente mais tarde.',
    190: 'Credencial do WhatsApp inválida ou expirada.',
  };
  if (code && mapa[code]) return `${mapa[code]} (código ${code})`;
  return msg ? `Meta: ${msg}${code ? ` (código ${code})` : ''}` : fallback;
}

type Modelo = { id: string; canal: string; status: string; ativo: boolean; meta_nome: string | null; idioma: string | null; variaveis: unknown };
const UUID = /^[0-9a-f-]{36}$/i;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function enviarWhats(m: Modelo, tel: string, nome: string): Promise<{ ok: boolean; wamid: string | null; erro: string | null }> {
  const params = montarParametros((m.variaveis ?? []) as Variavel[], nome);
  const components = params.length ? [{ type: 'body', parameters: params.map((text) => ({ type: 'text', text })) }] : [];
  try {
    const resp = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/send-whatsapp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
        'x-supabase-service-role': 'true',
      },
      body: JSON.stringify({ to: tel, template_name: m.meta_nome, language: m.idioma || 'pt_BR', components }),
    });
    const r = await resp.json().catch(() => ({}));
    const ok = resp.ok && !(r as any)?.error;
    const wamid: string | null = (r as any)?.result?.messages?.[0]?.id ?? null;
    const erro = ok ? null : erroLegivel((r as any)?.details, (r as any)?.error ?? `Falha HTTP ${resp.status}`);
    return { ok, wamid, erro };
  } catch (e) {
    return { ok: false, wamid: null, erro: 'Falha de rede ao chamar o WhatsApp: ' + (e as Error).message };
  }
}

const modeloOk = (m: Modelo | null) => !!m && m.canal === 'whatsapp' && m.status === 'aprovado' && m.ativo && !!m.meta_nome;

async function preparar(admin: any, body: any) {
  const id = typeof body?.campanha_id === 'string' ? body.campanha_id : '';
  if (!UUID.test(id)) return json({ error: 'Campanha inválida' }, 400);
  const { data: c } = await admin.from('msg_campanhas').select('*').eq('id', id).maybeSingle();
  if (!c) return json({ error: 'Campanha não encontrada' }, 404);
  if (!['rascunho', 'pronta'].includes(c.status)) return json({ error: 'Campanha não pode mais ser preparada' }, 409);
  const { count: jaFoi } = await admin.from('msg_campanha_destinatarios').select('id', { count: 'exact', head: true })
    .eq('campanha_id', id).in('status', ['enviado', 'enviando', 'falhou']);
  if ((jaFoi ?? 0) > 0) return json({ error: 'Campanha já tem envios; não pode ser preparada de novo' }, 409);
  if (!c.modelo_id) return json({ error: 'Escolha o modelo no passo Mensagem' }, 400);
  const { data: m } = await admin.from('msg_modelos').select('id, canal, status, ativo, meta_nome, idioma, variaveis').eq('id', c.modelo_id).maybeSingle();
  if (!modeloOk(m)) return json({ error: 'Modelo indisponível: precisa ser de WhatsApp, aprovado e ativo' }, 400);

  const { data: lista, error } = await admin.rpc('fn_msg_destinatarios', { p_filtro: c.filtro, p_selecao: c.selecao });
  if (error) { console.error('[disparo-campanha] destinatarios', error.message); return json({ error: 'Falha ao calcular o público' }, 500); }
  const todos = (lista ?? []) as { aluno_id: string; nome: string; telefone_norm: string; duplicado: boolean }[];
  const unicos = todos.filter((d) => !d.duplicado);
  const dups = todos.length - unicos.length;

  const del = await admin.from('msg_campanha_destinatarios').delete().eq('campanha_id', id).in('status', ['pendente', 'ignorado']);
  if (del.error) return json({ error: 'Falha ao limpar preparo anterior' }, 500);
  for (let i = 0; i < unicos.length; i += 500) {
    const ins = await admin.from('msg_campanha_destinatarios').insert(unicos.slice(i, i + 500).map((d) => ({
      campanha_id: id, aluno_id: d.aluno_id, canal: 'whatsapp', nome: d.nome, telefone_norm: d.telefone_norm, status: 'pendente',
    })));
    if (ins.error) { console.error('[disparo-campanha] insert', ins.error.message); return json({ error: 'Falha ao gravar destinatários' }, 500); }
  }
  await admin.from('msg_campanhas').update({
    total_preparado: unicos.length, deduplicados: dups, preparado_em: new Date().toISOString(), status: 'pronta',
  }).eq('id', id);
  return json({ total: unicos.length, deduplicados: dups, primeiro_lote: Math.min(c.lote_limite ?? 50, unicos.length) });
}

async function enviar(admin: any, body: any, uid: string) {
  // TRAVA 1 — envio real só com msg_config.real_liberado = true (liberado apenas por migração na etapa 5).
  const { data: cfg } = await admin.from('msg_config').select('valor').eq('chave', 'real_liberado').maybeSingle();
  if (cfg?.valor !== true) return json({ error: 'Envio real bloqueado' }, 423);

  const id = typeof body?.campanha_id === 'string' ? body.campanha_id : '';
  if (!UUID.test(id)) return json({ error: 'Campanha inválida' }, 400);
  const { data: c } = await admin.from('msg_campanhas').select('*').eq('id', id).maybeSingle();
  if (!c) return json({ error: 'Campanha não encontrada' }, 404);
  // TRAVA 2 — estado da campanha.
  if (!['pronta', 'enviando', 'pausada'].includes(c.status)) return json({ error: 'Campanha não está pronta para envio' }, 409);
  // TRAVA 3 — total digitado precisa bater com o preparado.
  if (!Number.isInteger(body?.confirmacao_total) || body.confirmacao_total !== c.total_preparado)
    return json({ error: 'Total de confirmação diferente do preparado' }, 400);
  const { data: m } = await admin.from('msg_modelos').select('id, canal, status, ativo, meta_nome, idioma, variaveis').eq('id', c.modelo_id).maybeSingle();
  if (!modeloOk(m)) return json({ error: 'Modelo indisponível' }, 400);

  // TRAVA 4 — registra quem confirmou.
  await admin.from('msg_campanhas').update({
    confirmado_total: body.confirmacao_total, confirmado_por: uid, confirmado_em: new Date().toISOString(), status: 'enviando',
  }).eq('id', id);

  // Recupera presos: 'enviando' há mais de 10 min sem enviado_em → 'falhou' (NUNCA 'pendente': a mensagem pode ter saído).
  const limitePreso = new Date(Date.now() - PRESO_MIN * 60_000).toISOString();
  await admin.from('msg_campanha_destinatarios')
    .update({ status: 'falhou', erro: ERRO_PRESO })
    .eq('campanha_id', id).eq('status', 'enviando').is('enviado_em', null)
    .or(`reservado_em.is.null,reservado_em.lt.${limitePreso}`);

  // Reserva atômica (FOR UPDATE SKIP LOCKED): cada destinatário só sai uma vez, ordem nome, id.
  // Cada clique envia no máximo lote_limite (= 50; o primeiro lote é exatamente 50), sem auto-reinvocação.
  const { data: lote, error: le } = await admin.rpc('fn_msg_reservar_lote', { p_campanha: id, p_limite: c.lote_limite ?? 50 });
  if (le) return json({ error: 'Falha ao reservar lote' }, 500);
  let enviados = 0, falhas = 0, ignorados = 0, seguidas = 0, pausou = false;
  const reservados = (lote ?? []) as { id: string; aluno_id: string; nome: string | null; telefone_norm: string }[];
  for (let i = 0; i < reservados.length; i++) {
    const d = reservados[i];
    if (pausou) { await admin.from('msg_campanha_destinatarios').update({ status: 'pendente' }).eq('id', d.id); continue; }
    const { data: motivo } = await admin.rpc('fn_msg_revalidar', { p_aluno: d.aluno_id, p_tel: d.telefone_norm });
    if (motivo) {
      ignorados++;
      await admin.from('msg_campanha_destinatarios').update({ status: 'ignorado', erro: motivo }).eq('id', d.id);
      continue;
    }
    const r = await enviarWhats(m, d.telefone_norm, d.nome ?? '');
    if (r.ok) {
      enviados++; seguidas = 0;
      await admin.from('msg_campanha_destinatarios').update({ status: 'enviado', wa_message_id: r.wamid, enviado_em: new Date().toISOString(), erro: null }).eq('id', d.id);
    } else {
      falhas++; seguidas++;
      await admin.from('msg_campanha_destinatarios').update({ status: 'falhou', erro: r.erro }).eq('id', d.id);
      if (seguidas >= 5) pausou = true;
    }
    await sleep(1000); // ~1 mensagem/segundo
  }
  const { count: restantes } = await admin.from('msg_campanha_destinatarios').select('id', { count: 'exact', head: true })
    .eq('campanha_id', id).eq('status', 'pendente');
  const status = pausou ? 'pausada' : (restantes ?? 0) === 0 ? 'concluida' : 'enviando';
  await admin.from('msg_campanhas').update({ status }).eq('id', id);
  return json({ enviados, falhas, ignorados, restantes: restantes ?? 0, status });
}

async function cancelar(admin: any, body: any) {
  const id = typeof body?.campanha_id === 'string' ? body.campanha_id : '';
  if (!UUID.test(id)) return json({ error: 'Campanha inválida' }, 400);
  const { data: c } = await admin.from('msg_campanhas').select('id, status').eq('id', id).maybeSingle();
  if (!c) return json({ error: 'Campanha não encontrada' }, 404);
  const { count } = await admin.from('msg_campanha_destinatarios').select('id', { count: 'exact', head: true })
    .eq('campanha_id', id).in('status', ['enviado', 'enviando']);
  if ((count ?? 0) > 0 || ['concluida', 'cancelada'].includes(c.status)) return json({ error: 'Campanha já teve envio e não pode ser cancelada' }, 409);
  await admin.from('msg_campanha_destinatarios').update({ status: 'ignorado', erro: 'Disparo cancelado' }).eq('campanha_id', id).eq('status', 'pendente');
  await admin.from('msg_campanhas').update({ status: 'cancelada' }).eq('id', id);
  return json({ ok: true });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const auth = req.headers.get('Authorization');
    if (!auth?.startsWith('Bearer ')) return json({ error: 'Não autenticado' }, 401);
    const userCli = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: auth } } });
    const { data: cl, error: ce } = await userCli.auth.getClaims(auth.replace('Bearer ', ''));
    const uid = cl?.claims?.sub as string | undefined;
    if (ce || !uid) return json({ error: 'Não autenticado' }, 401);
    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const { data: isAdmin } = await admin.rpc('has_role', { _user_id: uid, _role: 'admin' });
    if (!isAdmin) return json({ error: 'Acesso restrito a administradores' }, 403);

    const body = await req.json().catch(() => null);
    const action = body?.action;
    if (action === 'preparar') return await preparar(admin, body);
    if (action === 'enviar') return await enviar(admin, body, uid);
    if (action === 'cancelar') return await cancelar(admin, body);
    if (!body || action !== 'teste') return json({ error: 'ação indisponível' }, 400);

    const modeloId = typeof body.modelo_id === 'string' ? body.modelo_id : '';
    const nome = typeof body.nome === 'string' && body.nome.trim() ? body.nome.trim().slice(0, 80) : 'Teste';
    const tel = normalizarTelefone(typeof body.telefone === 'string' ? body.telefone : '');
    if (!UUID.test(modeloId)) return json({ error: 'Modelo inválido' }, 400);
    if (!tel || tel.length < 12 || tel.length > 15) return json({ error: 'Telefone inválido para WhatsApp' }, 400);

    const { data: m } = await admin.from('msg_modelos').select('id, canal, status, ativo, meta_nome, idioma, variaveis').eq('id', modeloId).maybeSingle();
    if (!modeloOk(m as Modelo | null))
      return json({ error: 'Modelo indisponível: precisa ser de WhatsApp, aprovado e ativo' }, 400);

    const desde = new Date(Date.now() - 3600_000).toISOString();
    const { count } = await admin.from('msg_testes').select('id', { count: 'exact', head: true }).eq('criado_por', uid).gte('criado_em', desde);
    if ((count ?? 0) >= LIMITE_HORA) return json({ error: `Limite de ${LIMITE_HORA} testes por hora atingido` }, 429);

    const { ok, wamid, erro } = await enviarWhats(m as Modelo, tel, nome);
    if (!ok) console.error('[disparo-campanha] teste falhou', erro);

    await admin.from('msg_testes').insert({
      modelo_id: m.id, telefone_norm: tel, nome_teste: nome, status: ok ? 'enviado' : 'falhou',
      erro, wa_message_id: wamid, criado_por: uid,
    });
    return json(ok ? { ok: true, wa_message_id: wamid } : { ok: false, error: erro });
  } catch (e) {
    console.error('[disparo-campanha] erro', (e as Error).message);
    return json({ error: 'Erro inesperado' }, 500);
  }
});
