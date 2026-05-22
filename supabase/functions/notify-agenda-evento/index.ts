import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function normalizeEmailSubject(subject: string) {
  return subject
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[–—]/g, "-")
    .replace(/[^\x20-\x7E]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

const DIAS = ["Domingo","Segunda-feira","Terça-feira","Quarta-feira","Quinta-feira","Sexta-feira","Sábado"];

const DEFAULT_CONFIG = {
  remetente_nome: "FORTEM",
  remetente_email: "contatofortem@gmail.com",
  atividades_monitoradas: ["Treino Experimental", "Avaliação Funcional"],
  enviar_em_agendamento: true,
  enviar_em_cancelamento: true,
  exigir_aluno_vinculado: true,
  destinatarios_regra: "profissional_vinculado",
  emails_extras: [] as string[],
};

async function sendGmailEmail(opts: { from: string; to: string; cc?: string[]; subject: string; html: string }) {
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
    from: opts.from,
    to: opts.to,
    cc: opts.cc && opts.cc.length ? opts.cc : undefined,
    subject: normalizeEmailSubject(opts.subject),
    content: "auto",
    html: opts.html,
  });
  await client.close();
}

function buildHtml(opts: {
  evento: string; atividade: string; aluno: string; profissional: string;
  quando: string; horario: string; local: string; observacoes: string | null;
  anamnese?: { limitacoes?: string | null; atividade_fisica?: string | null; objetivo_treinamento?: string | null } | null;
}) {
  const cancelado = opts.evento === "cancelado";
  const cor = cancelado ? "#dc2626" : "#16a34a";
  const titulo = cancelado ? "Agendamento cancelado" : "Novo agendamento";
  const a = opts.anamnese;
  const hasAnamnese = !cancelado && a && (a.limitacoes || a.atividade_fisica || a.objetivo_treinamento);
  const anamneseHtml = hasAnamnese ? `
    <hr style="border:none;border-top:1px solid #eee;margin:20px 0;" />
    <h2 style="font-size:14px;color:#1a1a2e;margin:0 0 12px;text-transform:uppercase;letter-spacing:1px;">Anamnese inicial</h2>
    <div style="font-size:13px;color:#333;line-height:1.5;">
      <p style="margin:0 0 4px;color:#888;">Limitações / patologias / dores / lesões</p>
      <p style="margin:0 0 12px;white-space:pre-wrap;">${(a!.limitacoes || "—").replace(/</g, "&lt;")}</p>
      <p style="margin:0 0 4px;color:#888;">Atividade física atual / tempo parado</p>
      <p style="margin:0 0 12px;white-space:pre-wrap;">${(a!.atividade_fisica || "—").replace(/</g, "&lt;")}</p>
      <p style="margin:0 0 4px;color:#888;">Objetivo com o treinamento funcional</p>
      <p style="margin:0;white-space:pre-wrap;">${(a!.objetivo_treinamento || "—").replace(/</g, "&lt;")}</p>
    </div>` : "";
  return `<!DOCTYPE html><html><body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:640px;margin:0 auto;padding:24px;background:#f8f9fa;">
  <div style="background:white;border-radius:16px;padding:32px;box-shadow:0 2px 8px rgba(0,0,0,.06);">
    <div style="text-align:center;margin-bottom:20px;">
      <span style="font-size:12px;font-weight:700;letter-spacing:2px;color:#1a1a2e;">FORTEM</span>
    </div>
    <h1 style="font-size:20px;color:${cor};margin:0 0 6px;text-align:center;">${titulo}</h1>
    <p style="font-size:14px;color:#555;text-align:center;margin:0 0 24px;">${opts.atividade}</p>
    <hr style="border:none;border-top:1px solid #eee;margin:16px 0;" />
    <table style="width:100%;border-collapse:collapse;font-size:14px;color:#333;">
      <tr><td style="padding:8px 0;color:#888;width:140px;">Aluno</td><td style="padding:8px 0;font-weight:600;">${opts.aluno}</td></tr>
      <tr><td style="padding:8px 0;color:#888;">Profissional</td><td style="padding:8px 0;">${opts.profissional}</td></tr>
      <tr><td style="padding:8px 0;color:#888;">Quando</td><td style="padding:8px 0;">${opts.quando}</td></tr>
      <tr><td style="padding:8px 0;color:#888;">Horário</td><td style="padding:8px 0;">${opts.horario}</td></tr>
      <tr><td style="padding:8px 0;color:#888;">Local</td><td style="padding:8px 0;">${opts.local}</td></tr>
      ${opts.observacoes ? `<tr><td style="padding:8px 0;color:#888;vertical-align:top;">Observações</td><td style="padding:8px 0;">${opts.observacoes}</td></tr>` : ""}
    </table>
    ${anamneseHtml}
    <p style="color:#aaa;font-size:11px;text-align:center;margin-top:28px;">FORTEM Gestão Técnica — notificação automática</p>
  </div></body></html>`;
}

async function resolveExtraRecipients(admin: any, regra: string, profissionalId: string | null): Promise<string[]> {
  if (regra === "profissional_vinculado") return [];
  const roles: string[] = [];
  if (regra === "profissional_e_coordenadores") roles.push("coordinator");
  if (regra === "profissional_coord_admin") roles.push("coordinator", "admin");
  let userIds: string[] = [];
  if (regra === "todos_staff") {
    const { data } = await admin.from("user_roles").select("user_id");
    userIds = (data ?? []).map((r: any) => r.user_id);
  } else if (roles.length) {
    const { data } = await admin.from("user_roles").select("user_id").in("role", roles);
    userIds = (data ?? []).map((r: any) => r.user_id);
  }
  userIds = Array.from(new Set(userIds)).filter((id) => id !== profissionalId);
  const emails: string[] = [];
  for (const id of userIds) {
    try {
      const { data: u } = await admin.auth.admin.getUserById(id);
      if (u?.user?.email) emails.push(u.user.email);
    } catch { /* ignore */ }
  }
  return emails;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    const body = await req.json();
    const { evento, agenda_id, agenda: agendaFromBody, origem, teste } = body;

    // Carrega config dinâmica
    const { data: cfgRow } = await admin
      .from("notificacao_email_config").select("*").eq("id", 1).maybeSingle();
    const cfg = { ...DEFAULT_CONFIG, ...(cfgRow || {}) };
    const fromHeader = `${cfg.remetente_nome} <${cfg.remetente_email}>`;

    // === MODO TESTE ===
    if (teste) {
      const to = typeof teste === "string" ? teste : cfg.remetente_email;
      const html = buildHtml({
        evento: "agendado", atividade: "Teste de configuração", aluno: "Aluno de Teste",
        profissional: "Profissional de Teste",
        quando: new Date().toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" }),
        horario: "10:00 - 11:00", local: "Sala 1", observacoes: "Este é um disparo de teste enviado pela tela de configurações.",
      });
      await sendGmailEmail({ from: fromHeader, to, subject: "FORTEM — Teste de notificação por email", html });
      return new Response(JSON.stringify({ success: true, teste: true, to }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!evento || !["agendado","cancelado"].includes(evento)) {
      return new Response(JSON.stringify({ error: "evento inválido" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (!agenda_id && !agendaFromBody?.id) {
      return new Response(JSON.stringify({ error: "agenda_id ausente" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (evento === "agendado" && !cfg.enviar_em_agendamento) {
      return new Response(JSON.stringify({ skipped: true, reason: "agendamento desativado" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (evento === "cancelado" && !cfg.enviar_em_cancelamento) {
      return new Response(JSON.stringify({ skipped: true, reason: "cancelamento desativado" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const aId = agenda_id || agendaFromBody.id;

    // Idempotência (UNIQUE em (agenda_id, evento))
    const { error: lockErr } = await admin
      .from("agenda_notificacoes_log")
      .insert({ agenda_id: aId, evento, origem: origem || "desconhecido" });
    if (lockErr) {
      return new Response(JSON.stringify({ skipped: true, reason: "duplicate" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let agenda: any = null;
    const { data: ag } = await admin
      .from("agenda_servicos")
      .select("id, atividade, local, observacoes, profissional_id, aluno_id, dia_semana, data_especifica, horario_inicio, horario_fim, tipo")
      .eq("id", aId)
      .maybeSingle();
    agenda = ag || agendaFromBody;
    if (!agenda) throw new Error("agenda não encontrada");

    if (!cfg.atividades_monitoradas.includes(agenda.atividade)) {
      return new Response(JSON.stringify({ skipped: true, reason: "atividade fora do escopo" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (cfg.exigir_aluno_vinculado && !agenda.aluno_id) {
      return new Response(JSON.stringify({ skipped: true, reason: "sem aluno" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!agenda.profissional_id) {
      return new Response(JSON.stringify({ skipped: true, reason: "sem profissional" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: userResp, error: userErr } = await admin.auth.admin.getUserById(agenda.profissional_id);
    if (userErr || !userResp?.user?.email) throw new Error("profissional sem email");
    const profEmail = userResp.user.email;

    const { data: profile } = await admin
      .from("profiles").select("full_name").eq("user_id", agenda.profissional_id).maybeSingle();
    const profNome = profile?.full_name || profEmail;

    let alunoNome = "—";
    if (agenda.aluno_id) {
      const { data: aluno } = await admin
        .from("alunos").select("nome").eq("id", agenda.aluno_id).maybeSingle();
      alunoNome = aluno?.nome || "Aluno";
    }

    const quando = agenda.tipo === "avulso" && agenda.data_especifica
      ? new Date(agenda.data_especifica + "T12:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" })
      : `Toda ${DIAS[agenda.dia_semana] ?? ""} (horário fixo)`;

    const horario = `${(agenda.horario_inicio||"").slice(0,5)} - ${(agenda.horario_fim||"").slice(0,5)}`;

    let anamnese: any = null;
    if (evento === "agendado" && agenda.aluno_id) {
      const { data: an } = await admin
        .from("prospect_anamnese")
        .select("limitacoes, atividade_fisica, objetivo_treinamento")
        .eq("aluno_id", agenda.aluno_id)
        .maybeSingle();
      anamnese = an || null;
    }

    const subject = `FORTEM — ${agenda.atividade} ${evento === "agendado" ? "agendado" : "cancelado"}: ${alunoNome}`;
    const html = buildHtml({
      evento, atividade: agenda.atividade, aluno: alunoNome, profissional: profNome,
      quando, horario, local: agenda.local || "—", observacoes: agenda.observacoes,
      anamnese,
    });

    // Destinatários extra conforme regra + emails fixos
    const extras = await resolveExtraRecipients(admin, cfg.destinatarios_regra, agenda.profissional_id);
    const cc = Array.from(new Set([...extras, ...(cfg.emails_extras || [])])).filter(
      (e) => e && e.toLowerCase() !== profEmail.toLowerCase()
    );

    await sendGmailEmail({ from: fromHeader, to: profEmail, cc, subject, html });
    console.log(`Notificação ${evento} enviada para ${profEmail} (cc: ${cc.length}) — agenda ${aId}`);

    return new Response(JSON.stringify({ success: true, cc_count: cc.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("notify-agenda-evento error:", err);
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
