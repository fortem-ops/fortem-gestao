import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { z } from 'npm:zod@3';
import { autorizarPrevia, avancar, inicial, type EstadoPrevia } from './estado.ts';

const schema = z.object({
  proposta_id: z.string().uuid(), chave_sessao: z.string().regex(/^[a-f0-9]{64}$/i),
  acao: z.enum(['estado', 'termo', 'aceitar', 'simular']),
  forma: z.enum(['cartao_parcelado', 'pix_vista']).optional(), parcelas: z.number().int().min(1).max(6).optional(),
  termo_hash: z.string().regex(/^[a-f0-9]{64}$/i).optional(),
  parte: z.enum(['plano', 'consultas']).optional(), resultado: z.enum(['aprovado', 'recusado', 'desconhecido']).optional(),
});
const responder = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
const url = Deno.env.get('SUPABASE_URL');
const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
// This function has no provider dependencies and never calls activation/settlement/email.
Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST' || !url || !key) return responder(400, { erro: 'Prévia indisponível' });
  const db = createClient(url, key);
  try {
    const token = (req.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '');
    const { data: user, error: authError } = await db.auth.getUser(token);
    if (authError || !user.user) return responder(401, { erro: 'Prévia disponível somente para administrador autenticado' });
    const uid = user.user.id;
    const { data: adm, error: roleError } = await db.rpc('is_admin', { _user_id: uid });
    if (roleError || adm !== true) return responder(403, { erro: 'Prévia disponível somente para administrador' });
    const b = schema.parse(await req.json());
    const { data: p, error: sessionError } = await db.rpc('fn_checkout_2027_sessao', { p_proposta_id: b.proposta_id, p_chave: b.chave_sessao });
    const { data: config } = await db.from('sistema_config').select('valor').eq('chave', 'planos_pagamento_modo_teste').maybeSingle();
    if (sessionError || !p || !autorizarPrevia(true, p.previa === true, p.teste_admin === true, config?.valor === 'simulacao') || p.forma_plano !== 'recorrencia' || !['start_2027', 'power_2027', 'pro_2027'].includes(p.familia) || !p.servicos_codigos?.length)
      return responder(403, { erro: 'Prévia exige proposta de admin com recorrência, consultas e modo simulação' });
    const invoke = async (name: string, args: Record<string, unknown>) => {
      const { data, error } = await db.rpc(name, args);
      if (error) throw new Error('Aceite indisponível. Revise a proposta e as condições');
      return data;
    };
    const base = { p_proposta_id: b.proposta_id, p_chave: b.chave_sessao };
    const estadoF1 = await invoke('fn_consultas_2027_estado', base);
    const { data: obligation, error: obligationError } = await db.from('planos_2027_pagamentos_avulsos').select('id,itens,valor_centavos,forma,parcelas,termo_texto,termo_hash,retomar_ate').eq('proposta_id', b.proposta_id).order('revisao', { ascending: false }).limit(1).maybeSingle();
    if (obligationError) throw new Error('Prévia indisponível');
    const { data: log, error: logError } = await db.from('system_logs').select('payload').eq('modulo', 'consultas-previa-f2').eq('acao', b.proposta_id).order('created_at', { ascending: false }).limit(1).maybeSingle();
    if (logError) throw new Error('Não foi possível reconstruir a simulação');
    let e: EstadoPrevia = log?.payload as EstadoPrevia ?? inicial();
    const forma = b.forma ?? obligation?.forma ?? p.forma_servicos ?? 'cartao_parcelado';
    const parcelas = forma === 'pix_vista' ? 1 : b.parcelas ?? obligation?.parcelas ?? p.parcelas_servicos ?? 6;
    let termo = obligation;
    if (b.acao === 'termo' || b.acao === 'aceitar' || !termo) {
      termo = await invoke('fn_consultas_2027_termo', { ...base, p_forma: forma, p_parcelas: parcelas });
    }
    const gravar = async () => {
      const { error } = await db.from('system_logs').insert({ modulo: 'consultas-previa-f2', acao: b.proposta_id, mensagem: 'Simulação F2 — sem cobrança, ativação, créditos ou e-mail', user_id: uid, payload: e });
      if (error) throw new Error('Não foi possível guardar a simulação');
    };
    if (b.acao === 'aceitar') {
      if (e.consultas === 'desconhecido' || e.consultas === 'aprovado') throw new Error('Pagamento simulado em conciliação ou concluído');
      if (!b.termo_hash) throw new Error('Leia e aceite o termo das consultas');
      const a = await invoke('fn_consultas_2027_aceitar', { ...base, p_forma: forma, p_parcelas: parcelas, p_hash: b.termo_hash, p_user_agent: (req.headers.get('user-agent') ?? '').slice(0, 512) });
      if (a.obrigacao_id !== e.obrigacao_id) e = { ...e, consultas: 'pendente', obrigacao_id: a.obrigacao_id };
      await gravar();
    }
    if (b.acao === 'simular') {
      if (!b.parte || !b.resultado) throw new Error('Resultado inválido');
      e = avancar(e, b.parte, b.resultado, !!obligation && e.obrigacao_id === obligation.id, estadoF1.novo_aceite_exigido === true);
      await gravar();
    }
    const f1 = await invoke('fn_consultas_2027_estado', base);
    return responder(200, { habilitada: true, ...e, forma, parcelas, itens: termo?.itens ?? [], valor_centavos: termo?.valor_centavos ?? 0, termo_texto: termo?.termo_texto, termo_hash: termo?.termo_hash, retomar_ate: f1.retomar_ate ?? null, novo_aceite_exigido: f1.novo_aceite_exigido === true });
  } catch (err) {
    return responder(200, { erro: err instanceof z.ZodError ? 'Confira as opções da simulação' : err instanceof Error ? err.message : 'Prévia indisponível' });
  }
});