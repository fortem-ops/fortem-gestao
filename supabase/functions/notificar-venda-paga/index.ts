import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-webhook-secret",
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
  return html.replace(/\r/g, "").replace(/\n\s*/g, "").replace(/[ \t]{2,}/g, " ").trim();
}

function htmlToText(html: string) {
  return minifyHtml(html)
    .replace(/<(br|\/tr|\/p|\/div|\/h[1-3]|\/li)\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/[ \t]{2,}/g, " ")
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
  return String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function brl(v: unknown) {
  return `R$ ${Number(v ?? 0).toFixed(2).replace(".", ",")}`;
}

const FORMA_LABEL: Record<string, string> = {
  cartao: "Cartao de credito",
  cartao_credito: "Cartao de credito",
  credito: "Cartao de credito",
  debito: "Cartao de debito",
  pix: "Pix",
  dinheiro: "Dinheiro",
  boleto: "Boleto",
  transferencia: "Transferencia",
};

async function authorized(req: Request, admin: any) {
  const provided = req.headers.get("x-webhook-secret");
  if (provided) {
    const { data } = await admin.rpc("get_webhook_secret");
    if (typeof data === "string" && data && provided === data) return true;
  }
  const authHeader = req.headers.get("Authorization");
  if (authHeader?.startsWith("Bearer ")) {
    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: u } = await userClient.auth.getUser();
    if (u?.user) {
      const { data: isS } = await admin.rpc("is_staff", { _user_id: u.user.id });
      if (isS) return true;
    }
  }
  return false;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  try {
    if (!(await authorized(req, admin))) return json(401, { ok: false, error: "unauthorized" });

    const { venda_id } = await req.json();
    if (!venda_id) return json(400, { ok: false, error: "venda_id ausente" });

    // Corrida ja envia o proprio aviso interno (mais detalhado) — nao duplicar.
    const { data: inscricao } = await admin
      .from("corrida_inscricoes_prova")
      .select("id")
      .eq("venda_id", venda_id)
      .limit(1)
      .maybeSingle();
    if (inscricao) return json(200, { ok: true, skipped: "corrida" });

    const { data: venda } = await admin
      .from("vendas")
      .select("id, nome_snapshot, valor, valor_final, desconto, forma_pagamento, parcelas, data_venda, created_at, tipo, origem, status_pagamento, aluno_id")
      .eq("id", venda_id)
      .maybeSingle();
    if (!venda) return json(404, { ok: false, error: "venda nao encontrada" });
    if (venda.status_pagamento !== "pago") return json(200, { ok: true, skipped: "nao_pago" });

    let aluno: any = null;
    if (venda.aluno_id) {
      const { data } = await admin
        .from("alunos")
        .select("nome, email, telefone")
        .eq("id", venda.aluno_id)
        .maybeSingle();
      aluno = data;
    }

    const nome = aluno?.nome ?? "Aluno nao identificado";
    const valor = Number(venda.valor_final ?? venda.valor ?? 0);
    const forma = FORMA_LABEL[String(venda.forma_pagamento ?? "")] ?? (venda.forma_pagamento ?? "—");
    const parcelas = Number(venda.parcelas ?? 1);
    const dataVenda = venda.data_venda
      ? new Date(String(venda.data_venda) + "T12:00:00").toLocaleDateString("pt-BR")
      : new Date(String(venda.created_at)).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });

    const linhaInfo = (label: string, val: string) =>
      `<tr><td style="padding:4px 12px 4px 0;font-size:13px;color:#777">${esc(label)}</td>
        <td style="padding:4px 0;font-size:13px;color:#111">${val}</td></tr>`;

    const html = `<!doctype html><html><body style="margin:0;background:#f5f5f5;font-family:Arial,Helvetica,sans-serif">
      <div style="max-width:640px;margin:0 auto;background:#ffffff">
        <div style="background:#111111;padding:16px 24px">
          <span style="color:#ffffff;font-size:16px;font-weight:bold;letter-spacing:2px">FORTEM · NOVA COMPRA</span>
        </div>
        <div style="height:4px;background:#E11D2E"></div>
        <div style="padding:24px">
          <table style="width:100%;border-collapse:collapse">
            ${linhaInfo("Venda", esc(venda.id))}
            ${linhaInfo("Data", esc(dataVenda))}
            ${linhaInfo("Aluno", esc(nome))}
            ${linhaInfo("E-mail", esc(aluno?.email ?? "—"))}
            ${linhaInfo("Telefone", esc(aluno?.telefone ?? "—"))}
            ${linhaInfo("Plano / produto", esc(venda.nome_snapshot ?? "—"))}
            ${linhaInfo("Forma de pagamento", esc(forma))}
            ${linhaInfo("Parcelas", esc(parcelas > 1 ? `${parcelas}x` : "A vista"))}
            ${Number(venda.desconto ?? 0) > 0 ? linhaInfo("Desconto", brl(venda.desconto)) : ""}
            ${linhaInfo("Valor recebido", `<strong>${brl(valor)}</strong>`)}
          </table>
        </div>
        <div style="background:#111111;padding:16px 24px;color:#999;font-size:12px">
          Aviso automatico interno - venda paga.
        </div>
      </div>
    </body></html>`;

    try {
      await sendGmailEmail("fortemtreinamento@gmail.com", `Nova compra — ${nome} — ${brl(valor)}`, html);
    } catch (errEmail) {
      console.error("[notificar-venda-paga] falha no envio:", String(errEmail));
      return json(200, { ok: false, error: "falha_envio" });
    }

    return json(200, { ok: true });
  } catch (err) {
    console.error("[notificar-venda-paga] erro:", String(err));
    return json(200, { ok: false, error: String((err as Error)?.message ?? err) });
  }
});
