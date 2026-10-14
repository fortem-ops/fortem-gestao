// E-mail de confirmação de pagamento do /planos. Só servidor (chave de serviço) ou admin verificado.
// Envio uma vez por proposta (reserva atômica no banco); falha nunca desfaz a baixa.
// Desligado por sistema_config.planos_email_confirmacao_ativo. Nunca registra CPF, e-mail completo ou chave.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { enviarConfirmacao } from "./remetente.ts";
import { executarEnvio, type RegistroEmail } from "./envio.ts";
import type { DadosEmail } from "./texto.ts";
import { decidirEnvio, montarEmail } from "./texto.ts";

const cors = {
  ...corsHeaders,
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const sup = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "");

/** Chamada interna com a chave de serviço. O gateway pode trocar a chave por um JWT
 * de serviço no Authorization; por isso aceita a chave literal (Authorization ou apikey)
 * ou um JWT com assinatura verificada e role=service_role. */
async function ehServico(bearer: string, apikey: string): Promise<boolean> {
  const chave = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (chave && (bearer === chave || apikey === chave)) return true;
  if (bearer.split(".").length !== 3) return false;
  const { data, error } = await sup.auth.getClaims(bearer);
  return !error && data?.claims?.role === "service_role";
}

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
  const servico = await ehServico(bearer, req.headers.get("apikey") ?? "");
  if (!servico && !(await ehAdmin(bearer))) {
    // Só a forma da credencial, nunca o valor.
    await log("nao_autorizado", `sem servico/admin (bearer_jwt=${bearer.split(".").length === 3}, apikey=${req.headers.has("apikey")})`);
    return json(401, { ok: false });
  }

  const body = await req.json().catch(() => ({}));
  const id = typeof body?.proposta_id === "string" && UUID.test(body.proposta_id) ? body.proposta_id : "";
  if (!id) return json(400, { ok: false });

  const acao = body?.acao ?? "enviar";
  if (!["enviar", "rascunho", "reenviar", "teste_seguro"].includes(acao)) return json(400, { ok: false });
  if (acao !== "enviar" && servico) return json(403, { ok: false });
  if (acao === "rascunho") {
    const { data: d, error } = await sup.rpc("fn_checkout_2027_email_completo", { p_proposta_id: id });
    if (error || !d) return json(200, { ok: false, resultado: "aceite_indisponivel" });
    const e = montarEmail({ ...d, ensaio: !d.ativada_em });
    return json(200, { ok: true, assunto: e.assunto, texto: e.texto, html: e.html });
  }
  const chaveReenvio = body?.idempotency_key;
  if (acao === "reenviar" && (typeof chaveReenvio !== "string" || !UUID.test(chaveReenvio))) return json(400, { ok: false });
  const evento = acao === "teste_seguro" ? "teste_seguro" : acao === "reenviar" ? `reenvio:${chaveReenvio}` : "inicial";
  try {
    const resposta = await executarEnvio({
      reservar: async () => {
        const { data, error } = await sup.rpc("fn_planos_email_reservar", { p_proposta_id: id, p_evento: evento });
        if (error) throw new Error("reserva_falhou");
        if (!data) {
          const { data: completo, error: erroContrato } = await sup.rpc("fn_checkout_2027_email_completo", { p_proposta_id: id });
          if (erroContrato || !completo) throw new Error("aceite_indisponivel");
        }
        return data as RegistroEmail | null;
      },
      enviar: async (registro) => {
        const d = registro.dados as DadosEmail;
        const { data: cfg } = await sup.from("sistema_config").select("valor").eq("chave", "planos_email_confirmacao_ativo").maybeSingle();
        const ativa = String(cfg?.valor ?? "false").replace(/"/g, "") === "true";
        if (decidirEnvio(d, ativa, ["nicolas_ja@hotmail.com"]) !== "enviar" || !d.email || !d.contrato) return { ok: false, status: 0 };
        if (evento !== "teste_seguro" && !d.ativada_em) return { ok: false, status: 0 };
        const e = montarEmail(d);
        return await enviarConfirmacao(d.email, e.assunto, e.html, e.texto, registro.idempotency_key);
      },
      resultado: async (envioId, ok, erro) => {
        const { error } = await sup.rpc("fn_planos_email_resultado", { p_envio_id: envioId, p_enviado: ok, p_erro: erro });
        if (error) throw new Error("resultado_falhou");
        if (!ok) await log("falha_envio", `${id}: ${erro}`);
      },
    });
    return json(200, resposta);
  } catch {
    await log("falha_envio", `${id}: confirmação indisponível; pagamento e ativação preservados`);
    return json(200, { ok: false, resultado: "falha_envio" });
  }
});
