// Envio pelo Resend (domínio soufortem.com.br). Nunca registra a chave nem o e-mail completo.
export type ResultadoEnvio = { ok: true } | { ok: false; status: number; mensagem: string };

export async function enviarResend(to: string, assunto: string, html: string, texto: string): Promise<ResultadoEnvio> {
  const apiKey = Deno.env.get("RESEND_API_KEY");
  if (!apiKey) return { ok: false, status: 0, mensagem: "RESEND_API_KEY ausente" };
  try {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: "FORTEM <nao-responda@soufortem.com.br>", to: [to], reply_to: "contatofortem@gmail.com",
        subject: assunto, html, text: texto,
      }),
    });
    if (r.ok) return { ok: true };
    const corpo = await r.text().catch(() => "");
    let msg = "erro_resend";
    try { msg = String(JSON.parse(corpo)?.message ?? msg).slice(0, 300); } catch { /* genérica */ }
    return { ok: false, status: r.status, mensagem: msg };
  } catch (e) {
    return { ok: false, status: 0, mensagem: String((e as Error)?.message ?? e).slice(0, 200) };
  }
}
