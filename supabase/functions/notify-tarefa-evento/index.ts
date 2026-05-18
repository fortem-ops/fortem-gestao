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
  await client.send({ from: opts.from, to: opts.to, subject: opts.subject, content: "auto", html: opts.html });
  await client.close();
}

const PRIO_COR: Record<string, string> = { alta: "#dc2626", media: "#d97706", baixa: "#0891b2" };

function buildHtml(t: any, alunoNome: string | null, criadoPor: string | null) {
  const prazo = t.data_limite ? new Date(t.data_limite + "T12:00:00").toLocaleDateString("pt-BR") : "—";
  const cor = PRIO_COR[t.prioridade] || "#1a1a2e";
  return `<!DOCTYPE html><html><body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:640px;margin:0 auto;padding:24px;background:#f8f9fa;">
  <div style="background:white;border-radius:16px;padding:32px;box-shadow:0 2px 8px rgba(0,0,0,.06);">
    <div style="text-align:center;margin-bottom:20px;"><span style="font-size:12px;font-weight:700;letter-spacing:2px;color:#1a1a2e;">FORTEM</span></div>
    <h1 style="font-size:20px;color:${cor};margin:0 0 6px;text-align:center;">${t.automatica ? "Nova tarefa automática" : "Nova tarefa"}</h1>
    <p style="font-size:14px;color:#555;text-align:center;margin:0 0 24px;">${t.titulo}</p>
    <hr style="border:none;border-top:1px solid #eee;margin:16px 0;" />
    <table style="width:100%;border-collapse:collapse;font-size:14px;color:#333;">
      ${t.descricao ? `<tr><td style="padding:8px 0;color:#888;width:140px;vertical-align:top;">Descrição</td><td style="padding:8px 0;">${t.descricao}</td></tr>` : ""}
      <tr><td style="padding:8px 0;color:#888;">Prioridade</td><td style="padding:8px 0;font-weight:600;text-transform:capitalize;">${t.prioridade}</td></tr>
      <tr><td style="padding:8px 0;color:#888;">Prazo</td><td style="padding:8px 0;">${prazo}</td></tr>
      ${alunoNome ? `<tr><td style="padding:8px 0;color:#888;">Aluno</td><td style="padding:8px 0;">${alunoNome}</td></tr>` : ""}
      ${criadoPor ? `<tr><td style="padding:8px 0;color:#888;">Criada por</td><td style="padding:8px 0;">${criadoPor}</td></tr>` : ""}
    </table>
    <p style="color:#aaa;font-size:11px;text-align:center;margin-top:28px;">FORTEM Gestão Técnica — notificação automática</p>
  </div></body></html>`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  try {
    const { tarefa_id, evento } = await req.json();
    if (!tarefa_id) throw new Error("tarefa_id ausente");

    const { data: cfg } = await admin.from("notificacao_email_config").select("*").eq("id", 1).maybeSingle();
    if (!cfg) throw new Error("config não encontrada");

    if (!cfg.enviar_tarefa_criada) {
      return new Response(JSON.stringify({ skipped: "tarefa desativada" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { data: t } = await admin.from("tarefas").select("*").eq("id", tarefa_id).maybeSingle();
    if (!t) throw new Error("tarefa não encontrada");

    if (t.automatica && !cfg.enviar_tarefa_automatica) {
      return new Response(JSON.stringify({ skipped: "automática desativada" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { error: lockErr } = await admin.from("tarefa_notificacoes_log").insert({ tarefa_id, evento: evento || "criada" });
    if (lockErr) return new Response(JSON.stringify({ skipped: "duplicate" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const { data: userResp } = await admin.auth.admin.getUserById(t.responsavel_id);
    const profEmail = userResp?.user?.email;
    if (!profEmail) throw new Error("responsável sem email");

    let alunoNome: string | null = null;
    if (t.aluno_id) {
      const { data: a } = await admin.from("alunos").select("nome").eq("id", t.aluno_id).maybeSingle();
      alunoNome = a?.nome || null;
    }
    let criadoPorNome: string | null = null;
    if (t.criado_por_id) {
      const { data: p } = await admin.from("profiles").select("full_name").eq("user_id", t.criado_por_id).maybeSingle();
      criadoPorNome = p?.full_name || null;
    }

    const from = `${cfg.remetente_nome} <${cfg.remetente_email}>`;
    const subject = `FORTEM — Nova tarefa: ${t.titulo}`;
    await sendGmailEmail({ from, to: profEmail, subject, html: buildHtml(t, alunoNome, criadoPorNome) });

    return new Response(JSON.stringify({ success: true, to: profEmail }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    console.error("notify-tarefa-evento error:", err);
    return new Response(JSON.stringify({ error: (err as Error).message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
