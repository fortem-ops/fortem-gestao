import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function normalizeEmailSubject(subject: string) {
  return subject
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[–—]/g, "-")
    .replace(/[^\x20-\x7E]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function minifyHtml(html: string) {
  return html
    .replace(/\r/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n\s*/g, "")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

function htmlToText(html: string) {
  return minifyHtml(html)
    .replace(/<(br|\/tr|\/p|\/div|\/h[1-3]|\/li)\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .split("\n")
    .map((l) => l.trim())
    .join("\n")
    .trim();
}

async function sendGmailEmail(to: string, subject: string, htmlBody: string) {
  const password = Deno.env.get("GMAIL_APP_PASSWORD");
  if (!password) throw new Error("GMAIL_APP_PASSWORD not configured");
  const html = minifyHtml(htmlBody);
  const client = new SMTPClient({
    connection: {
      hostname: "smtp.gmail.com",
      port: 465,
      tls: true,
      auth: { username: "contatofortem@gmail.com", password },
    },
  });
  await client.send({
    from: "contatofortem@gmail.com",
    to,
    subject: normalizeEmailSubject(subject),
    content: htmlToText(html),
    html,
  });
  await client.close();
}

function esc(s: unknown) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function brl(v: unknown) {
  const n = Number(v ?? 0);
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

const FORMA_LABEL: Record<string, string> = {
  cartao_credito: "Cartão de crédito",
  pix: "PIX",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json(405, { ok: false, error: "method_not_allowed" });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    const body = await req.json().catch(() => ({}));
    const pedidoId = typeof body?.pedido_id === "string" ? body.pedido_id.trim() : "";
    if (!pedidoId) return json(400, { ok: false, error: "pedido_id_obrigatorio" });

    const { data: pedido } = await supabase
      .from("pedidos")
      .select("id, nome, email, valor_final, forma_pagamento, eh_encomenda, created_at")
      .eq("id", pedidoId)
      .maybeSingle();
    if (!pedido) return json(404, { ok: false, error: "pedido_nao_encontrado" });
    if (!pedido.email) return json(400, { ok: false, error: "email_ausente" });

    const { data: itens } = await supabase
      .from("pedido_itens")
      .select(
        "quantidade, preco_unitario_snapshot, produtos_variantes(tamanho, cor, sku, produtos_catalogo(nome))",
      )
      .eq("pedido_id", pedidoId);

    const linhas = (itens ?? [])
      .map((it: any) => {
        const v = it?.produtos_variantes;
        const produto = v?.produtos_catalogo?.nome ?? "Produto";
        const variante = [v?.tamanho, v?.cor].filter(Boolean).join(" / ") || v?.sku || "";
        const total = Number(it?.preco_unitario_snapshot ?? 0) * Number(it?.quantidade ?? 0);
        return `<tr>
          <td style="padding:8px 0;border-bottom:1px solid #eee;font-size:14px;color:#111">
            ${esc(produto)}${variante ? `<br><span style="color:#777;font-size:12px">${esc(variante)}</span>` : ""}
          </td>
          <td style="padding:8px 0;border-bottom:1px solid #eee;font-size:14px;text-align:center;color:#111">${esc(it?.quantidade)}</td>
          <td style="padding:8px 0;border-bottom:1px solid #eee;font-size:14px;text-align:right;white-space:nowrap;color:#111">${brl(total)}</td>
        </tr>`;
      })
      .join("");

    const forma = FORMA_LABEL[String(pedido.forma_pagamento ?? "")] ?? "—";

    const html = `<!doctype html><html><body style="margin:0;background:#f5f5f5;font-family:Arial,Helvetica,sans-serif">
      <div style="max-width:640px;margin:0 auto;background:#ffffff">
        <div style="background:#111111;padding:20px 24px">
          <span style="color:#ffffff;font-size:20px;font-weight:bold;letter-spacing:2px">FORTEM</span>
        </div>
        <div style="height:4px;background:#E11D2E"></div>
        <div style="padding:24px">
          <h2 style="margin:0 0 4px;font-size:20px;color:#111">Pedido confirmado!</h2>
          <p style="margin:0 0 16px;font-size:13px;color:#777">Pedido: ${esc(pedido.id)}</p>
          <p style="font-size:15px;color:#111">Ola, ${esc(pedido.nome)}! Recebemos o pagamento do seu pedido na Loja Fortem.</p>
          ${pedido.eh_encomenda ? `<p style="font-size:14px;color:#111"><strong>Este pedido contem itens em encomenda</strong> — avisaremos assim que estiver disponivel para retirada.</p>` : ""}
          <h3 style="font-size:15px;margin:24px 0 8px;color:#111">Itens</h3>
          <table style="width:100%;border-collapse:collapse">
            ${linhas || `<tr><td style="font-size:14px;color:#111">Itens do pedido</td></tr>`}
            <tr>
              <td style="padding:10px 0;font-size:15px;font-weight:bold;color:#111">Total</td>
              <td></td>
              <td style="padding:10px 0;font-size:15px;font-weight:bold;text-align:right;color:#111">${brl(pedido.valor_final)}</td>
            </tr>
          </table>
          <p style="font-size:14px;color:#111;margin-top:16px">Forma de pagamento: <strong>${esc(forma)}</strong></p>
        </div>
        <div style="background:#111111;padding:16px 24px;color:#999;font-size:12px">
          Fortem Gestao Tecnica · contatofortem@gmail.com<br>
          Este e um e-mail automatico de confirmacao de pedido.
        </div>
      </div>
    </body></html>`;

    await sendGmailEmail(pedido.email, `Pedido confirmado - Loja Fortem`, html);
    return json(200, { ok: true });
  } catch (err) {
    console.error("loja-enviar-confirmacao-email error:", err);
    return json(500, { ok: false, error: String((err as Error)?.message ?? err) });
  }
});
