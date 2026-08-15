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

async function sendGmailEmail(to: string, subject: string, htmlBody: string) {
  const password = Deno.env.get("GMAIL_APP_PASSWORD");
  if (!password) throw new Error("GMAIL_APP_PASSWORD not configured");
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
    content: "auto",
    html: htmlBody,
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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json(405, { ok: false, error: "method_not_allowed" });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    const body = await req.json().catch(() => ({}));
    const vendaId = typeof body?.venda_id === "string" ? body.venda_id.trim() : "";
    const overrideEmail = typeof body?.email_override === "string" ? body.email_override.trim() : "";
    if (!vendaId) return json(400, { ok: false, error: "venda_id_obrigatorio" });

    const { data: venda } = await supabase
      .from("vendas")
      .select("id, aluno_id, nome_snapshot, valor_final, parcelas, forma_pagamento, observacoes")
      .eq("id", vendaId)
      .maybeSingle();
    if (!venda) return json(404, { ok: false, error: "venda_nao_encontrada" });

    const { data: aluno } = await supabase
      .from("alunos")
      .select("id, nome, email, telefone")
      .eq("id", venda.aluno_id)
      .maybeSingle();

    const { data: inscricao } = await supabase
      .from("corrida_inscricoes_prova")
      .select("id, email, nome, sobrenome, telefone, rota, provas, pedido_resumo, inscricao_prova_completa")
      .eq("venda_id", vendaId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const destino = overrideEmail || aluno?.email || inscricao?.email || "";
    if (!destino) return json(400, { ok: false, error: "email_do_aluno_ausente" });

    // contratos vinculados
    let contratoId: string | null = typeof body?.contrato_id === "string" && body.contrato_id.trim() ? body.contrato_id.trim() : null;
    if (!contratoId) {
      const { data: c } = await supabase
        .from("contratos")
        .select("id")
        .eq("aluno_id", venda.aluno_id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      contratoId = c?.id ?? null;
    }
    let documentos: any[] = [];
    if (contratoId) {
      const { data: docs } = await supabase
        .from("contratos_documentos")
        .select("conteudo_gerado, contrato_templates(nome)")
        .eq("contrato_id", contratoId);
      documentos = docs ?? [];
    }

    // resumo do pedido
    let resumo: any = inscricao?.pedido_resumo ?? null;
    if (!resumo && venda.observacoes) {
      try {
        resumo = JSON.parse(venda.observacoes)?.pedidoResumo ?? null;
      } catch { /* ignore */ }
    }

    const provas = Array.isArray(inscricao?.provas) ? inscricao!.provas : [];
    const temProva = provas.length > 0;
    const faltaInscricao = inscricao?.inscricao_prova_completa === false && temProva;

    const nome = aluno?.nome || inscricao?.nome || "Atleta";
    const parcelas = Math.max(1, Number(venda.parcelas ?? 1));

    const linhasHtml = (resumo?.linhas ?? [])
      .map(
        (l: any) => `<tr>
          <td style="padding:8px 0;border-bottom:1px solid #eee;font-size:14px;color:#111">
            ${esc(l?.label)}${l?.nota ? `<br><span style="color:#777;font-size:12px">${esc(l.nota)}</span>` : ""}
          </td>
          <td style="padding:8px 0;border-bottom:1px solid #eee;font-size:14px;text-align:right;white-space:nowrap;color:#111">
            ${Number(l?.valor ?? 0) === 0 ? "Cortesia" : brl(l?.valor)}
          </td>
        </tr>`,
      )
      .join("");

    const contratosHtml = documentos
      .map(
        (d) => `
        <div style="margin-top:28px">
          <h3 style="font-size:15px;margin:0 0 8px;color:#111;border-bottom:2px solid #E11D2E;padding-bottom:6px">
            ${esc(d?.contrato_templates?.nome ?? "Contrato")}
          </h3>
          <div style="font-size:12px;line-height:1.5;color:#333">${d?.conteudo_gerado ?? ""}</div>
        </div>`,
      )
      .join("");

    const avisoHtml = faltaInscricao
      ? `<div style="margin:24px 0;padding:16px;border-left:4px solid #E11D2E;background:#FFF3F4;border-radius:6px">
           <strong style="color:#B91021;font-size:15px">Falta completar sua inscrição na prova</strong>
           <p style="margin:8px 0 12px;font-size:14px;color:#333">
             Seu pagamento está confirmado, mas ainda precisamos dos dados da sua inscrição na prova
             (tamanho de camiseta, ritmo, etc.). Leva menos de 2 minutos.
           </p>
           <a href="https://www.soufortem.com.br/corrida"
              style="display:inline-block;background:#E11D2E;color:#fff;text-decoration:none;padding:10px 18px;border-radius:6px;font-size:14px;font-weight:bold">
             Completar inscrição
           </a>
         </div>`
      : "";

    const html = `<!doctype html><html><body style="margin:0;background:#f5f5f5;font-family:Arial,Helvetica,sans-serif">
      <div style="max-width:680px;margin:0 auto;background:#ffffff">
        <div style="background:#111111;padding:20px 24px">
          <span style="color:#ffffff;font-size:20px;font-weight:bold;letter-spacing:2px">FORTEM</span>
        </div>
        <div style="height:4px;background:#E11D2E"></div>
        <div style="padding:24px">
          <h2 style="margin:0 0 4px;font-size:20px;color:#111">Pagamento confirmado!</h2>
          <p style="margin:0 0 16px;font-size:13px;color:#777">Protocolo: ${esc(venda.id)}</p>
          <p style="font-size:15px;color:#111">Olá, ${esc(nome)}! Recebemos seu pagamento e sua vaga está garantida.</p>

          ${avisoHtml}

          <h3 style="font-size:15px;margin:24px 0 8px;color:#111">Resumo do pedido</h3>
          <table style="width:100%;border-collapse:collapse">
            ${linhasHtml || `<tr><td style="font-size:14px;color:#111">${esc(venda.nome_snapshot)}</td></tr>`}
            <tr>
              <td style="padding:10px 0;font-size:15px;font-weight:bold;color:#111">Total</td>
              <td style="padding:10px 0;font-size:15px;font-weight:bold;text-align:right;color:#111">
                ${brl(venda.valor_final)}${parcelas > 1 ? ` em ${parcelas}x` : ""}
              </td>
            </tr>
          </table>

          ${contratosHtml}
        </div>
        <div style="background:#111111;padding:16px 24px;color:#999;font-size:12px">
          Fortem Gestão Técnica · contatofortem@gmail.com<br>
          Este é um e-mail automático de confirmação de pedido.
        </div>
      </div>
    </body></html>`;

    // ---- e-mail interno (operacional) — fire-and-forget, nunca afeta o fluxo ----
    const enviarInterno = async () => {
      try {
        let obs: any = null;
        try { obs = venda.observacoes ? JSON.parse(venda.observacoes) : null; } catch { /* ignore */ }
        const rota = inscricao?.rota || obs?.rota || "—";
        const rotaLabel: Record<string, string> = {
          aluno: "Aluno",
          somente_corrida: "Somente Corrida",
          prospect: "Prospect",
          somente_provas: "Somente Provas",
        };
        const tier = obs?.tier ?? null;
        const telefone = aluno?.telefone || inscricao?.telefone || "—";
        const emailComprador = destino;
        const provasTxt = temProva
          ? provas.map((p: any) => `${esc(p?.nome ?? p?.prova)}${p?.distancia ? ` (${esc(p.distancia)})` : ""}`).join(", ")
          : "Nenhuma";
        const itensHtml = (resumo?.linhas ?? [])
          .map((l: any) => `<li>${esc(l?.label)} — ${Number(l?.valor ?? 0) === 0 ? "Cortesia" : brl(l?.valor)}</li>`)
          .join("") || `<li>${esc(venda.nome_snapshot)}</li>`;

        const internoHtml = `<!doctype html><html><body style="margin:0;background:#f5f5f5;font-family:Arial,Helvetica,sans-serif">
          <div style="max-width:640px;margin:0 auto;background:#fff;padding:24px">
            <h2 style="margin:0 0 12px;font-size:18px;color:#111">Nova compra — Corrida</h2>
            <p style="margin:0 0 16px;font-size:13px;color:#777">Protocolo: ${esc(venda.id)}</p>
            <table style="width:100%;border-collapse:collapse;font-size:14px;color:#111">
              <tr><td style="padding:4px 0;color:#777">Comprador</td><td style="padding:4px 0">${esc(nome)}</td></tr>
              <tr><td style="padding:4px 0;color:#777">Telefone</td><td style="padding:4px 0">${esc(telefone)}</td></tr>
              <tr><td style="padding:4px 0;color:#777">E-mail</td><td style="padding:4px 0">${esc(emailComprador)}</td></tr>
              <tr><td style="padding:4px 0;color:#777">Rota</td><td style="padding:4px 0">${esc(rotaLabel[rota] ?? rota)}${tier ? ` · tier ${esc(tier)}` : ""}</td></tr>
              <tr><td style="padding:4px 0;color:#777">Pagamento</td><td style="padding:4px 0">${brl(venda.valor_final)}${parcelas > 1 ? ` em ${parcelas}x` : " à vista"} · ${esc(venda.forma_pagamento ?? "—")}</td></tr>
              <tr><td style="padding:4px 0;color:#777">Provas</td><td style="padding:4px 0">${provasTxt}</td></tr>
              <tr><td style="padding:4px 0;color:#777">Inscrição na prova</td><td style="padding:4px 0">${temProva ? (faltaInscricao ? "PENDENTE" : "Completa") : "Não se aplica"}</td></tr>
            </table>
            <h3 style="font-size:14px;margin:20px 0 6px;color:#111">Itens do pedido</h3>
            <ul style="font-size:14px;color:#111;padding-left:18px;margin:0">${itensHtml}</ul>
          </div>
        </body></html>`;

        await sendGmailEmail(
          "fortemtreinamento@gmail.com",
          `Nova compra Corrida — ${nome} — ${brl(venda.valor_final)}`,
          internoHtml,
        );
      } catch (e) {
        console.error("[corrida-enviar-confirmacao-email] falha no e-mail interno:", String(e));
      }
    };

    try {
      await sendGmailEmail(destino, `Fortem Corrida — Pagamento confirmado (${String(venda.id).slice(0, 8)})`, html);
      await enviarInterno();
    } catch (e) {
      await enviarInterno();
      console.error("[corrida-enviar-confirmacao-email] falha no envio:", String(e));
      try {
        await supabase.from("system_logs").insert({
          modulo: "corrida-enviar-confirmacao-email",
          acao: "falha_envio",
          mensagem: `Falha ao enviar e-mail de confirmação da venda ${vendaId}: ${String(e)}`,
          payload: { venda_id: vendaId },
        });
      } catch { /* ignore */ }
      return json(200, { ok: false, enviado: false, error: "falha_envio_email" });
    }

    return json(200, { ok: true, enviado: true, to: destino, falta_inscricao: faltaInscricao });
  } catch (err) {
    console.error("corrida-enviar-confirmacao-email error:", err);
    return json(200, { ok: false, enviado: false, error: "erro_interno" });
  }
});
