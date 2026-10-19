// Código de verificação por e-mail da identificação pública /planos.
// Nunca registra CPF, código ou e-mail completo em log.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { avaliarTurnstile, passeValido } from "../_shared/planos-turnstile.ts";
import {
  corpoEmailCodigo, cpfDigitosValidos, gerarCodigo, hashCodigo, mascararEmail, podeEnviarCodigo,
  respostaEnvioPublica, respostaValidacaoPublica, type Envio,
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

/** Turnstile: com a chave ligada, exige um passe emitido aqui depois da verificação na Cloudflare. */
async function passeOk(passe: unknown): Promise<boolean> {
  if ((await config("planos_turnstile_ativo")) !== true) return true;
  if (!passeValido(passe)) return false;
  const { data } = await admin.from("planos_turnstile_passes").select("id")
    .eq("id", passe).is("consumido_em", null).gt("expira_em", new Date().toISOString()).maybeSingle();
  return !!data;
}

// Envio do código de identificação via Resend (domínio soufortem.com.br verificado).
// Nunca registra o código, o e-mail completo nem a chave em log.
async function logEnvio(acao: string, mensagem: string, detalhes: Record<string, unknown>) {
  try {
    await admin.from("system_logs").insert({ modulo: "planos-codigo", acao, mensagem, detalhes });
  } catch { /* log nunca bloqueia o envio */ }
}

async function enviarEmail(to: string, assunto: string, html: string, verificacaoId: string) {
  const apiKey = Deno.env.get("RESEND_API_KEY");
  const base = { verificacao_id: verificacaoId, email_mascarado: mascararEmail(to) };
  if (!apiKey) {
    await logEnvio("falha_envio_email", "Envio do código sem chave do Resend", { ...base, status: null });
    throw new Error("email_indisponivel");
  }
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
    await logEnvio("falha_envio_email", `Resend recusou o envio do código (HTTP ${r.status}): ${msg}`, { ...base, status: r.status });
    throw new Error("email_indisponivel");
  }
  const resendId = await r.json().then((j) => String(j?.id ?? "")).catch(() => "");
  await logEnvio("codigo_enviado", "Resend aceitou o envio do código", { ...base, status: r.status, resend_id: resendId || null });
}

async function enviarCodigo(body: any, ip: string): Promise<Envio | { enviado: false; motivo: "captcha" }> {
      const tipo = body.tipo === "cpf" ? "cpf" : body.tipo === "telefone" ? "telefone" : null;
      const valor = typeof body.valor === "string" ? body.valor.replace(/\D/g, "") : "";
      if (!tipo || !valor || (tipo === "cpf" && !cpfDigitosValidos(valor))) return ({ enviado: false, motivo: "indisponivel" });
      if (!(await passeOk(body.turnstile_passe))) return ({ enviado: false, motivo: "captcha" });
      if (!(await limite(`cod-ip:${ip}`, 10)) || !(await limite(`cod-ident:${await sha(tipo + valor)}`, 5))) {
        return ({ enviado: false, motivo: "limitado" });
      }
      const { data: alunoId } = await admin.rpc("fn_planos_resolver", { p_tipo: tipo, p_valor: valor });
      if (!alunoId) return ({ enviado: false, motivo: "indisponivel" });
      const { data: aluno } = await admin.from("alunos").select("id, email").eq("id", alunoId).maybeSingle();
      const email = (aluno?.email ?? "").trim().toLowerCase();
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return ({ enviado: false, motivo: "sem_email" });
      const liberado = (await config("planos_codigo_email_livre")) === true;
      if (!podeEnviarCodigo(alunoId as string, liberado, await config("planos_codigo_email_teste_ids"))) {
        return ({ enviado: false, motivo: "sem_email" });
      }
      if (!(await limite(`cod-email:${await sha(email)}`, 5))) return ({ enviado: false, motivo: "limitado" });

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
      await enviarEmail(email, assunto, html, id);
      console.log("[planos-codigo] código enviado", { verificacao_id: id });
      return { enviado: true, verificacao_id: id, email_mascarado: mascararEmail(email) };
    }

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  if (req.method !== "POST") return json(405, { error: "method_not_allowed" });
  const ip = (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || "sem-ip";
  const body = await req.json().catch(() => ({}));
  try {
    if (body?.acao === "turnstile_config") {
      const ativo = (await config("planos_turnstile_ativo")) === true;
      return json(200, { ativo, site_key: ativo ? await config("planos_turnstile_site_key") : null });
    }
    if (body?.acao === "turnstile") {
      // Verifica o token do widget no servidor e devolve um passe de uso único (20 min).
      if (!(await limite(`ts-ip:${ip}`, 30))) return json(200, { ok: false });
      const r = await avaliarTurnstile(await config("planos_turnstile_ativo"), Deno.env.get("TURNSTILE_SECRET_KEY"), body.token, ip);
      if (r === "livre") return json(200, { ok: true, passe: null });
      if (r !== "ok") return json(200, { ok: false });
      const { data, error } = await admin.from("planos_turnstile_passes").insert({}).select("id").single();
      return json(200, error ? { ok: false } : { ok: true, passe: data.id });
    }
    if (body?.acao === "enviar") {
      const inicio = Date.now();
      let r: Awaited<ReturnType<typeof enviarCodigo>>;
      try { r = await enviarCodigo(body, ip); } catch { r = { enviado: false, motivo: "indisponivel" }; }
      if (!r.enviado && r.motivo === "captcha") return json(200, { enviado: false, motivo: "captcha" });
      // Tempo parecido com o de um envio real, para não distinguir CPF com e sem cadastro.
      const espera = 700 + Math.floor(Math.random() * 300) - (Date.now() - inicio);
      if (espera > 0) await new Promise((ok) => setTimeout(ok, espera));
      return json(200, respostaEnvioPublica(r as Envio, crypto.randomUUID()));
    }
    if (body?.acao === "dados_verificados") {
      const id = typeof body.verificacao_id === "string" && /^[0-9a-f-]{36}$/i.test(body.verificacao_id) ? body.verificacao_id : null;
      if (!id || !(await limite(`cod-dados-ip:${ip}`, 40))) return json(200, { ok: false });
      const { data } = await admin.rpc("fn_planos_dados_verificados", { p_id: id });
      return json(200, data ?? { ok: false });
    }
    if (body?.acao === "previa_admin") {
      // Prévia: admin conferido no servidor preenche direto pelo CPF, sem código.
      const token = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
      const valor = typeof body.valor === "string" ? body.valor.replace(/\D/g, "") : "";
      if (!token || token === Deno.env.get("SUPABASE_ANON_KEY") || !cpfDigitosValidos(valor)) return json(200, { ok: false });
      const { data: u } = await admin.auth.getUser(token);
      const uid = u?.user?.id;
      if (!uid) return json(200, { ok: false });
      const { data: vid } = await admin.rpc("fn_planos_verificacao_admin", { p_cpf: valor, p_user_id: uid });
      if (!vid) return json(200, { ok: false });
      const { data } = await admin.rpc("fn_planos_dados_verificados", { p_id: vid });
      return json(200, data?.ok ? { ...data, verificacao_id: vid } : { ok: false });
    }
    if (body?.acao === "validar") {
      const id = typeof body.verificacao_id === "string" && /^[0-9a-f-]{36}$/i.test(body.verificacao_id) ? body.verificacao_id : null;
      const codigo = typeof body.codigo === "string" ? body.codigo.replace(/\D/g, "") : "";
      if (!id || codigo.length !== 6) return json(200, { ok: false, motivo: "errado" });
      if (!(await limite(`cod-val-ip:${ip}`, 40))) return json(200, { ok: false, motivo: "limitado" });
      const { data } = await admin.rpc("fn_planos_codigo_validar", { p_id: id, p_hash: await hashCodigo(id, codigo) });
      return json(200, respostaValidacaoPublica(data));
    }
    return json(400, { error: "acao_invalida" });
  } catch (e) {
    console.error("[planos-codigo] falha", (e as Error)?.message ?? "erro");
    return json(200, { enviado: false, ok: false, motivo: "indisponivel" });
  }
});
