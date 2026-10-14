export async function enviarConfirmacao(to: string, assunto: string, html: string, texto: string, chave: string) {
  const apiKey = Deno.env.get("RESEND_API_KEY");
  if (!apiKey) return { ok: false, status: 0 };
  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json", "Idempotency-Key": chave },
      body: JSON.stringify({ from: "FORTEM <nao-responda@soufortem.com.br>", reply_to: "contatofortem@gmail.com", to: [to], subject: assunto, html, text: texto }),
    });
    await response.text(); // Nunca registrar a resposta: pode conter endereço ou dados do destinatário.
    return { ok: response.ok, status: response.status };
  } catch { return { ok: false, status: 0 }; }
}