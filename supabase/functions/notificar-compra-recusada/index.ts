// Aviso interno à equipe quando uma tentativa de compra por cartão é recusada
// (Loja ou Corrida), tanto na tokenização quanto na cobrança.
// Chamada em fire-and-forget pelas funções de pagamento.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";
import { motivoAmigavel, motivoComCodigo } from "../_shared/pagamento-motivo.ts";

const DESTINO = "fortemtreinamento@gmail.com";
const JANELA_DEDUPE_MIN = 10;

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

function agoraBr(d?: string | null) {
  const dt = d ? new Date(d) : new Date();
  return dt.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
}

function htmlToText(html: string) {
  return html
    .replace(/<(br|\/tr|\/p|\/div|\/h[1-3]|\/li)\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/[ \t]{2,}/g, " ")
    .split("\n").map((l) => l.trim()).join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

async function sendGmailEmail(to: string, subject: string, html: string) {
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
    content: htmlToText(html),
    html,
  });
  await client.close();
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
    const fluxo = body?.fluxo === "corrida" ? "corrida" : "loja";
    const etapa = body?.etapa === "tokenizacao" ? "tokenizacao" : "cobranca";
    const pedidoId = typeof body?.pedido_id === "string" ? body.pedido_id.trim() : "";
    const vendaId = typeof body?.venda_id === "string" ? body.venda_id.trim() : "";
    let alunoId = typeof body?.aluno_id === "string" ? body.aluno_id.trim() : "";
    const returnCode = body?.return_code ? String(body.return_code) : null;
    const returnMessage = body?.return_message ? String(body.return_message) : null;
    const erro = body?.erro ? String(body.erro) : null;
    const simulacao = body?.simulacao === true;

    // ---------- deduplicação ----------
    const chave = [fluxo, etapa, pedidoId || vendaId || alunoId || "sem-ref", returnCode ?? erro ?? "-"].join("|");
    const desde = new Date(Date.now() - JANELA_DEDUPE_MIN * 60_000).toISOString();
    if (!simulacao) {
      const { data: recentes } = await supabase
        .from("system_logs")
        .select("payload")
        .eq("modulo", "notificar-compra-recusada")
        .eq("acao", "aviso_enviado")
        .gte("created_at", desde)
        .limit(50);
      const jaEnviado = (recentes ?? []).some((r: any) => r?.payload?.chave === chave);
      if (jaEnviado) return json(200, { ok: true, duplicado: true });
    }

    // ---------- inferência do contexto (recusa na tokenização) ----------
    // A tokenização é comum aos dois fluxos; descobre o que o aluno tentava
    // comprar olhando a tentativa aberta mais recente.
    let fluxoFinal: "loja" | "corrida" = fluxo;
    let pedidoRef = pedidoId;
    let vendaRef = vendaId;
    if (!pedidoRef && !vendaRef && alunoId) {
      const desde2h = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
      const [{ data: p }, { data: v }] = await Promise.all([
        supabase.from("pedidos").select("id, created_at").eq("aluno_id", alunoId)
          .eq("status", "aguardando_pagamento").gte("created_at", desde2h)
          .order("created_at", { ascending: false }).limit(1).maybeSingle(),
        supabase.from("vendas").select("id, created_at").eq("aluno_id", alunoId)
          .neq("status_pagamento", "pago").gte("created_at", desde2h)
          .order("created_at", { ascending: false }).limit(1).maybeSingle(),
      ]);
      const tP = p?.created_at ? new Date(p.created_at).getTime() : 0;
      const tV = v?.created_at ? new Date(v.created_at).getTime() : 0;
      if (tV > tP && v?.id) { vendaRef = v.id; fluxoFinal = "corrida"; }
      else if (p?.id) { pedidoRef = p.id; fluxoFinal = "loja"; }
    }

    // ---------- dados da tentativa ----------
    let nome = "";
    let email = "";
    let telefone = "";
    let valor: number | null = null;
    let parcelas: number | null = null;
    let itensHtml = "";
    let quando: string | null = null;
    let referencia = "";

    if (pedidoRef) {
      const { data: pedido } = await supabase
        .from("pedidos")
        .select("id, nome, email, telefone, aluno_id, valor_final, created_at")
        .eq("id", pedidoRef)
        .maybeSingle();
      if (pedido) {
        nome = pedido.nome ?? "";
        email = pedido.email ?? "";
        telefone = pedido.telefone ?? "";
        valor = Number(pedido.valor_final ?? 0);
        quando = pedido.created_at ?? null;
        alunoId = alunoId || (pedido.aluno_id ?? "");
        referencia = `Pedido da Loja ${pedido.id}`;
      }
      const { data: itens } = await supabase
        .from("pedido_itens")
        .select("quantidade, preco_unitario_snapshot, produtos_variantes(tamanho, cor, sku, produtos_catalogo(nome))")
        .eq("pedido_id", pedidoRef);
      itensHtml = (itens ?? []).map((it: any) => {
        const v = it?.produtos_variantes;
        const produto = v?.produtos_catalogo?.nome ?? "Produto";
        const variante = [v?.tamanho, v?.cor].filter(Boolean).join(" / ") || v?.sku || "";
        const total = Number(it?.preco_unitario_snapshot ?? 0) * Number(it?.quantidade ?? 0);
        return `<tr><td style="padding:6px 0;border-bottom:1px solid #eee;font-size:13px">${esc(produto)}${variante ? ` <span style="color:#777">(${esc(variante)})</span>` : ""} × ${esc(it?.quantidade)}</td><td style="padding:6px 0;border-bottom:1px solid #eee;font-size:13px;text-align:right">${brl(total)}</td></tr>`;
      }).join("");
    }

    if (vendaRef) {
      const { data: venda } = await supabase
        .from("vendas")
        .select("id, aluno_id, valor_final, parcelas, observacoes, created_at")
        .eq("id", vendaRef)
        .maybeSingle();
      if (venda) {
        valor = Number(venda.valor_final ?? 0);
        parcelas = Math.max(1, Number(venda.parcelas ?? 1));
        quando = venda.created_at ?? null;
        alunoId = alunoId || (venda.aluno_id ?? "");
        referencia = `Inscrição da Corrida (venda ${venda.id})`;
      }
      const { data: inscricao } = await supabase
        .from("corrida_inscricoes_prova")
        .select("nome, sobrenome, email, telefone, rota, pedido_resumo")
        .eq("venda_id", vendaRef)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (inscricao) {
        nome = nome || [inscricao.nome, inscricao.sobrenome].filter(Boolean).join(" ");
        email = email || (inscricao.email ?? "");
        telefone = telefone || (inscricao.telefone ?? "");
        const linhas = (inscricao as any)?.pedido_resumo?.linhas ?? [];
        itensHtml = (Array.isArray(linhas) ? linhas : []).map((l: any) =>
          `<tr><td style="padding:6px 0;border-bottom:1px solid #eee;font-size:13px">${esc(l?.label)}</td><td style="padding:6px 0;border-bottom:1px solid #eee;font-size:13px;text-align:right">${Number(l?.valor ?? 0) === 0 ? "Cortesia" : brl(l?.valor)}</td></tr>`
        ).join("");
      }
    }

    if (alunoId) {
      const { data: aluno } = await supabase
        .from("alunos")
        .select("nome, email, telefone")
        .eq("id", alunoId)
        .maybeSingle();
      if (aluno) {
        nome = nome || (aluno.nome ?? "");
        email = email || (aluno.email ?? "");
        telefone = telefone || (aluno.telefone ?? "");
      }
    }

    if (!nome) nome = "Comprador não identificado";
    if (!referencia) referencia = fluxoFinal === "corrida" ? "Inscrição da Corrida" : "Compra na Loja";

    const motivo = motivoComCodigo({ returnCode, returnMessage, erro });
    const motivoCurto = motivoAmigavel({ returnCode, returnMessage, erro });
    const etapaLabel = etapa === "tokenizacao"
      ? "Recusa na validação do cartão (tokenização)"
      : "Recusa na cobrança";
    const fluxoLabel = fluxoFinal === "corrida" ? "Corrida" : "Loja";

    const html = `<!doctype html><html><body style="margin:0;background:#f5f5f5;font-family:Arial,Helvetica,sans-serif">
<div style="max-width:620px;margin:0 auto;padding:24px">
  <div style="background:#fff;border-radius:14px;padding:28px">
    <div style="font-size:11px;letter-spacing:2px;font-weight:700;color:#1a1a2e">FORTEM</div>
    <h1 style="font-size:19px;color:#1a1a2e;margin:12px 0 4px">Tentativa de compra recusada</h1>
    <p style="font-size:13px;color:#777;margin:0 0 20px">${esc(fluxoLabel)} · ${esc(etapaLabel)}</p>
    <div style="background:#fef2f2;border-left:3px solid #e11d48;padding:12px 14px;border-radius:6px;margin-bottom:20px">
      <strong style="font-size:14px;color:#1a1a2e">${esc(motivoCurto)}</strong>
      <div style="font-size:12px;color:#666;margin-top:6px">${esc(motivo)}</div>
    </div>
    <table style="width:100%;border-collapse:collapse">
      <tr><td style="padding:6px 0;color:#888;font-size:13px">Aluno / comprador</td><td style="padding:6px 0;text-align:right;font-size:13px;font-weight:600">${esc(nome)}</td></tr>
      <tr><td style="padding:6px 0;color:#888;font-size:13px">E-mail</td><td style="padding:6px 0;text-align:right;font-size:13px">${esc(email || "—")}</td></tr>
      <tr><td style="padding:6px 0;color:#888;font-size:13px">Telefone</td><td style="padding:6px 0;text-align:right;font-size:13px">${esc(telefone || "—")}</td></tr>
      <tr><td style="padding:6px 0;color:#888;font-size:13px">Referência</td><td style="padding:6px 0;text-align:right;font-size:13px">${esc(referencia)}</td></tr>
      <tr><td style="padding:6px 0;color:#888;font-size:13px">Valor da tentativa</td><td style="padding:6px 0;text-align:right;font-size:13px;font-weight:600">${valor == null ? "—" : brl(valor)}${parcelas && parcelas > 1 ? ` em ${parcelas}x` : ""}</td></tr>
      <tr><td style="padding:6px 0;color:#888;font-size:13px">Horário da tentativa</td><td style="padding:6px 0;text-align:right;font-size:13px">${esc(agoraBr(quando))}</td></tr>
    </table>
    ${itensHtml ? `<h3 style="font-size:14px;color:#1a1a2e;margin:22px 0 6px">O que estava tentando comprar</h3><table style="width:100%;border-collapse:collapse">${itensHtml}</table>` : ""}
    <p style="font-size:12px;color:#888;margin-top:24px">Aviso automático — entre em contato com o aluno para ajudar a concluir a compra.</p>
  </div>
</div></body></html>`;

    await sendGmailEmail(DESTINO, `Tentativa de compra recusada - ${nome}`, html);

    try {
      await supabase.from("system_logs").insert({
        modulo: "notificar-compra-recusada",
        acao: "aviso_enviado",
        mensagem: `Aviso de recusa enviado (${fluxoLabel} / ${etapa}) — ${nome}`,
        payload: { chave, fluxo, etapa, pedido_id: pedidoId || null, venda_id: vendaId || null, aluno_id: alunoId || null, return_code: returnCode, erro },
      });
    } catch { /* ignore */ }

    return json(200, { ok: true, enviado: true });
  } catch (err) {
    console.error("notificar-compra-recusada error:", err);
    return json(500, { ok: false, error: "erro_interno" });
  }
});
