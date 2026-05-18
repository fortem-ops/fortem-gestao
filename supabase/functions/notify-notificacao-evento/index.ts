import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function sendGmailEmail(opts: { from: string; to: string; subject: string; html: string }) {
  const password = Deno.env.get("GMAIL_APP_PASSWORD");
  if (!password) throw new Error("GMAIL_APP_PASSWORD not configured");
  const client = new SMTPClient({
    connection: { hostname: "smtp.gmail.com", port: 465, tls: true,
      auth: { username: "contatofortem@gmail.com", password } },
  });
  await client.send({ from: opts.from, to: opts.to, subject: opts.subject, html: opts.html });
  await client.close();
}

const PRIO_COR: Record<string, string> = { urgente: "#dc2626", alta: "#ea580c", media: "#d97706", baixa: "#0891b2" };

function buildHtml(n: any, evento: string, comentario: string | null) {
  const cor = PRIO_COR[n.prioridade] || "#1a1a2e";
  const titulo = evento === "resposta" ? "Notificação respondida" : evento === "respondida" ? "Notificação marcada como respondida" : "Nova notificação";
  const prazo = n.prazo ? new Date(n.prazo).toLocaleString("pt-BR") : "—";
  return `<!DOCTYPE html><html><body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:640px;margin:0 auto;padding:24px;background:#f8f9fa;">
  <div style="background:white;border-radius:16px;padding:32px;box-shadow:0 2px 8px rgba(0,0,0,.06);">
    <div style="text-align:center;margin-bottom:20px;"><span style="font-size:12px;font-weight:700;letter-spacing:2px;color:#1a1a2e;">FORTEM</span></div>
    <h1 style="font-size:20px;color:${cor};margin:0 0 6px;text-align:center;">${titulo}</h1>
    <p style="font-size:14px;color:#555;text-align:center;margin:0 0 24px;">${n.titulo}</p>
    <hr style="border:none;border-top:1px solid #eee;margin:16px 0;" />
    <table style="width:100%;border-collapse:collapse;font-size:14px;color:#333;">
      <tr><td style="padding:8px 0;color:#888;width:140px;vertical-align:top;">Descrição</td><td style="padding:8px 0;">${n.descricao || "—"}</td></tr>
      <tr><td style="padding:8px 0;color:#888;">Categoria</td><td style="padding:8px 0;">${n.categoria || "—"}</td></tr>
      <tr><td style="padding:8px 0;color:#888;">Prioridade</td><td style="padding:8px 0;text-transform:capitalize;">${n.prioridade}</td></tr>
      <tr><td style="padding:8px 0;color:#888;">Tipo</td><td style="padding:8px 0;text-transform:capitalize;">${n.tipo}</td></tr>
      <tr><td style="padding:8px 0;color:#888;">Prazo</td><td style="padding:8px 0;">${prazo}</td></tr>
      ${comentario ? `<tr><td style="padding:8px 0;color:#888;vertical-align:top;">Resposta</td><td style="padding:8px 0;font-style:italic;">${comentario}</td></tr>` : ""}
    </table>
    <p style="color:#aaa;font-size:11px;text-align:center;margin-top:28px;">FORTEM Gestão Técnica — notificação automática</p>
  </div></body></html>`;
}

async function getEmail(admin: any, uid: string): Promise<string | null> {
  try {
    const { data } = await admin.auth.admin.getUserById(uid);
    return data?.user?.email || null;
  } catch { return null; }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  try {
    const { notificacao_id, evento, comentario_id, autor_id } = await req.json();
    if (!notificacao_id || !evento) throw new Error("parâmetros ausentes");

    const { data: cfg } = await admin.from("notificacao_email_config").select("*").eq("id", 1).maybeSingle();
    if (!cfg) throw new Error("config não encontrada");

    if ((evento === "nova" && !cfg.enviar_notificacao_nova) ||
        ((evento === "resposta" || evento === "respondida") && !cfg.enviar_notificacao_resposta)) {
      return new Response(JSON.stringify({ skipped: "desativado" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { data: n } = await admin.from("notificacoes").select("*").eq("id", notificacao_id).maybeSingle();
    if (!n) throw new Error("notificação não encontrada");

    let comentario: string | null = null;
    if (evento === "resposta" && comentario_id) {
      const { data: c } = await admin.from("notificacao_comentarios").select("comentario").eq("id", comentario_id).maybeSingle();
      comentario = c?.comentario || null;
    }

    // Determinar destinatários
    let recipientIds: string[] = [];
    if (evento === "nova") {
      const { data: dests } = await admin.from("notificacao_destinatarios").select("usuario_id").eq("notificacao_id", notificacao_id);
      recipientIds = (dests || []).map((d: any) => d.usuario_id);
    } else if (evento === "resposta") {
      // criador + outros destinatários, exceto autor do comentário
      const ids = new Set<string>([n.criado_por]);
      const { data: dests } = await admin.from("notificacao_destinatarios").select("usuario_id").eq("notificacao_id", notificacao_id);
      (dests || []).forEach((d: any) => ids.add(d.usuario_id));
      if (autor_id) ids.delete(autor_id);
      recipientIds = Array.from(ids);
    } else if (evento === "respondida") {
      recipientIds = [n.criado_por];
    }

    const from = `${cfg.remetente_nome} <${cfg.remetente_email}>`;
    const subject = `FORTEM — ${evento === "nova" ? "Nova notificação" : "Notificação respondida"}: ${n.titulo}`;
    const html = buildHtml(n, evento, comentario);

    let sent = 0;
    for (const uid of recipientIds) {
      if (!uid) continue;
      // Idempotência por destinatário
      const { error: lockErr } = await admin.from("notificacao_email_log")
        .insert({ notificacao_id, evento: evento + (comentario_id ? ":" + comentario_id : ""), usuario_id: uid });
      if (lockErr) continue;
      const email = await getEmail(admin, uid);
      if (!email) continue;
      try {
        await sendGmailEmail({ from, to: email, subject, html });
        sent++;
      } catch (e) {
        console.error("send fail to", email, e);
      }
    }

    return new Response(JSON.stringify({ success: true, sent }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    console.error("notify-notificacao-evento error:", err);
    return new Response(JSON.stringify({ error: (err as Error).message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
