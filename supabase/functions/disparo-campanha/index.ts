// Disparo de Mensagens — etapa 3: somente envio de TESTE para telefone digitado.
// Reutiliza send-whatsapp (modo template); envio em lote não existe nesta etapa.
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
    if (!body || body.action !== 'teste') return json({ error: 'ação indisponível' }, 400);

    const modeloId = typeof body.modelo_id === 'string' ? body.modelo_id : '';
    const nome = typeof body.nome === 'string' && body.nome.trim() ? body.nome.trim().slice(0, 80) : 'Teste';
    const tel = normalizarTelefone(typeof body.telefone === 'string' ? body.telefone : '');
    if (!/^[0-9a-f-]{36}$/i.test(modeloId)) return json({ error: 'Modelo inválido' }, 400);
    if (!tel || tel.length < 12 || tel.length > 15) return json({ error: 'Telefone inválido para WhatsApp' }, 400);

    const { data: m } = await admin.from('msg_modelos').select('id, canal, status, ativo, meta_nome, idioma, variaveis').eq('id', modeloId).maybeSingle();
    if (!m || m.canal !== 'whatsapp' || m.status !== 'aprovado' || !m.ativo || !m.meta_nome)
      return json({ error: 'Modelo indisponível: precisa ser de WhatsApp, aprovado e ativo' }, 400);

    const desde = new Date(Date.now() - 3600_000).toISOString();
    const { count } = await admin.from('msg_testes').select('id', { count: 'exact', head: true }).eq('criado_por', uid).gte('criado_em', desde);
    if ((count ?? 0) >= LIMITE_HORA) return json({ error: `Limite de ${LIMITE_HORA} testes por hora atingido` }, 429);

    const params = montarParametros((m.variaveis ?? []) as Variavel[], nome);
    const components = params.length ? [{ type: 'body', parameters: params.map((text) => ({ type: 'text', text })) }] : [];

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
    if (!ok) console.error('[disparo-campanha] teste falhou', resp.status, erro);

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
