// E-mail de confirmação de pagamento do /planos. Só servidor (chave de serviço) ou admin verificado.
// Envio uma vez por proposta (reserva atômica no banco); falha nunca desfaz a baixa.
// Desligado por sistema_config.planos_email_confirmacao_ativo. Nunca registra CPF, e-mail completo ou chave.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { enviarResend } from "../_shared/resend.ts";
import { decidirEnvio, montarEmail } from "./texto.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const sup = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

async function ehAdmin(bearer: string): Promise<boolean> {
  if (!bearer) return false;
  const { data } = await sup.auth.getUser(bearer);
  if (!data?.user) return false;
  const { data: ok } = await sup.rpc("is_admin", { _user_id: data.user.id });
  return ok === true;
}

async function log(acao: string, mensagem: string) {
  await sup.from("system_logs").insert({ modulo: "planos-confirmacao", acao, mensagem: mensagem.slice(0, 400) });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json(405, { ok: false });
  const bearer = req.headers.get("Authorization")?.replace(/^Bearer /, "") ?? "";
  const servico = bearer !== "" && bearer === Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!servico && !(await ehAdmin(bearer))) return json(401, { ok: false });

  const body = await req.json().catch(() => ({}));
  const id = typeof body?.proposta_id === "string" && UUID.test(body.proposta_id) ? body.proposta_id : "";
  if (!id) return json(400, { ok: false });

  // Rascunho (só admin): mostra o texto sem reservar nem enviar.
  if (body?.acao === "rascunho") {
    if (servico) return json(403, { ok: false });
    const { data: d } = await sup.rpc("fn_checkout_2027_email_dados", { p_proposta_id: id });
    if (!d) return json(200, { ok: false });
    const e = montarEmail(d);
    return json(200, { ok: true, assunto: e.assunto, texto: e.texto });
  }

  const { data: d, error } = await sup.rpc("fn_checkout_2027_email_reservar", { p_proposta_id: id });
  if (error) { await log("erro", `${id}: reservar falhou`); return json(200, { ok: false, resultado: "erro" }); }
  if (!d) return json(200, { ok: true, resultado: "ja_enviado_ou_em_andamento" });

  const { data: cfg } = await sup.from("sistema_config").select("valor").eq("chave", "planos_email_confirmacao_ativo").maybeSingle();
  const ativa = String(cfg?.valor ?? "false").replace(/"/g, "") === "true";
  const { data: testes } = await sup.from("alunos").select("email").eq("nome", "NICOLAS TESTE");
  const decisao = decidirEnvio(d, ativa, (testes ?? []).map((t: any) => t.email).filter(Boolean));

  if (decisao !== "enviar") {
    // Libera a reserva para enviar depois (quando a chave for ligada) e registra o motivo.
    await sup.rpc("fn_checkout_2027_email_resultado", { p_proposta_id: id, p_enviado: false, p_erro: decisao });
    await log(decisao, `${id}: não enviado (${decisao})`);
    const e = montarEmail(d);
    return json(200, { ok: true, resultado: decisao, ...(decisao === "teste_rascunho" || (d.teste_admin && decisao === "desligado") ? { rascunho: { assunto: e.assunto, texto: e.texto } } : {}) });
  }

  const e = montarEmail(d);
  const r = await enviarResend(d.email, e.assunto, e.html, e.texto);
  if (r.ok) {
    await sup.rpc("fn_checkout_2027_email_resultado", { p_proposta_id: id, p_enviado: true, p_erro: null });
    return json(200, { ok: true, resultado: "enviado" });
  }
  await sup.rpc("fn_checkout_2027_email_resultado", { p_proposta_id: id, p_enviado: false, p_erro: `HTTP ${r.status}: ${r.mensagem}` });
  await log("falha_envio", `${id}: Resend HTTP ${r.status}: ${r.mensagem}`);
  return json(200, { ok: false, resultado: "falha_envio" });
});
