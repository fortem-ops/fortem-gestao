// Código de verificação por e-mail da identificação pública /planos.
// Nunca registra CPF, código ou e-mail completo em log.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  corpoEmailCodigo, cpfDigitosValidos, gerarCodigo, hashCodigo, mascararEmail, podeEnviarCodigo,
} from "../_shared/planos-verificacao.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

async function sha(s: string) {
  const b = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return Array.from(new Uint8Array(b)).map((x) => x.toString(16).padStart(2, "0")).join("").slice(0, 24);
}
async function config(chave: string) {
  const { data } = await admin.from("sistema_config").select("valor").eq("chave", chave).maybeSingle();
  return data?.valor;
}
async function limite(chave: string, n: number) {
  const { data } = await admin.rpc("fn_planos_limite", { p_chave: chave, p_limite: n });
  return data === true;
}

/** Turnstile: só valida quando a chave está ligada E o segredo existe. Sem segredo, não bloqueia. */
async function turnstileOk(token: unknown, ip: string): Promise<boolean> {
  if ((await config("planos_turnstile_ativo")) !== true) return true;
  const secret = Deno.env.get("TURNSTILE_SECRET_KEY");
  if (!secret) { console.warn("[planos-codigo] Turnstile ligado sem TURNSTILE_SECRET_KEY; seguindo sem bloquear"); return true; }
  if (typeof token !== "string" || !token) return false;
  const form = new FormData();
  form.append("secret", secret); form.append("response", token); if (ip) form.append("remoteip", ip);
  const r = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", { method: "POST", body: form });
  return (await r.json().catch(() => ({})))?.success === true;
}

// Envio do código de identificação via Resend (domínio soufortem.com.br verificado).
// Nunca registra o código, o e-mail completo nem a chave em log.
async function enviarEmail(to: string, assunto: string, html: string) {
  const apiKey = Deno.env.get("RESEND_API_KEY");
  if (!apiKey) throw new Error("email_indisponivel");
  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: "FORTEM <nao-responda@soufortem.com.br>",
      to: [to],
      reply_to: "contatofortem@gmail.com",
      subject: assunto,
      html,
      text: html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim(),
    }),
  });
  if (!r.ok) {
    const corpo = await r.text().catch(() => "");
    let msg = "erro_resend";
    try { msg = String(JSON.parse(corpo)?.message ?? msg).slice(0, 300); } catch { /* mantém msg genérica */ }
    console.error("[planos-codigo] falha no envio do código", { status: r.status });
    await admin.from("system_logs").insert({
      modulo: "planos-codigo",
      acao: "falha_envio_email",
      mensagem: `Resend recusou o envio do código (HTTP ${r.status}): ${msg}`,
    });
    throw new Error("email_indisponivel");
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  if (req.method !== "POST") return json(405, { error: "method_not_allowed" });
  const ip = (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || "sem-ip";
  const body = await req.json().catch(() => ({}));
  try {
    if (body?.acao === "enviar") {
      const tipo = body.tipo === "cpf" ? "cpf" : body.tipo === "telefone" ? "telefone" : null;
      const valor = typeof body.valor === "string" ? body.valor.replace(/\D/g, "") : "";
      if (!tipo || !valor || (tipo === "cpf" && !cpfDigitosValidos(valor))) return json(200, { enviado: false, motivo: "indisponivel" });
      if (!(await turnstileOk(body.turnstile_token, ip))) return json(200, { enviado: false, motivo: "captcha" });
      if (!(await limite(`cod-ip:${ip}`, 10)) || !(await limite(`cod-ident:${await sha(tipo + valor)}`, 5))) {
        return json(200, { enviado: false, motivo: "limitado" });
      }
      const { data: alunoId } = await admin.rpc("fn_planos_resolver", { p_tipo: tipo, p_valor: valor });
      if (!alunoId) return json(200, { enviado: false, motivo: "indisponivel" });
      const { data: aluno } = await admin.from("alunos").select("id, email").eq("id", alunoId).maybeSingle();
      const email = (aluno?.email ?? "").trim().toLowerCase();
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return json(200, { enviado: false, motivo: "sem_email" });
      const liberado = (await config("planos_codigo_email_livre")) === true;
      if (!podeEnviarCodigo(alunoId as string, liberado, await config("planos_codigo_email_teste_ids"))) {
        return json(200, { enviado: false, motivo: "sem_email" });
      }
      if (!(await limite(`cod-email:${await sha(email)}`, 5))) return json(200, { enviado: false, motivo: "limitado" });

      // Invalida códigos anteriores ainda não usados deste cadastro.
      await admin.from("planos_verificacoes").update({ expira_em: new Date().toISOString() })
        .eq("aluno_id", alunoId).is("validado_em", null);
      const id = crypto.randomUUID();
      const codigo = gerarCodigo();
      const { error } = await admin.from("planos_verificacoes").insert({
        id, aluno_id: alunoId, email, codigo_hash: await hashCodigo(id, codigo),
        expira_em: new Date(Date.now() + 10 * 60_000).toISOString(),
      });
      if (error) throw new Error("falha_registro");
      const { assunto, html } = corpoEmailCodigo(codigo);
      await enviarEmail(email, assunto, html);
      console.log("[planos-codigo] código enviado", { verificacao_id: id });
      return json(200, { enviado: true, verificacao_id: id, email_mascarado: mascararEmail(email) });
    }
    if (body?.acao === "validar") {
      const id = typeof body.verificacao_id === "string" && /^[0-9a-f-]{36}$/i.test(body.verificacao_id) ? body.verificacao_id : null;
      const codigo = typeof body.codigo === "string" ? body.codigo.replace(/\D/g, "") : "";
      if (!id || codigo.length !== 6) return json(200, { ok: false, motivo: "errado" });
      if (!(await limite(`cod-val-ip:${ip}`, 40))) return json(200, { ok: false, motivo: "limitado" });
      const { data } = await admin.rpc("fn_planos_codigo_validar", { p_id: id, p_hash: await hashCodigo(id, codigo) });
      return json(200, data ?? { ok: false, motivo: "invalido" });
    }
    return json(400, { error: "acao_invalida" });
  } catch (e) {
    console.error("[planos-codigo] falha", (e as Error)?.message ?? "erro");
    return json(200, { enviado: false, ok: false, motivo: "indisponivel" });
  }
});
