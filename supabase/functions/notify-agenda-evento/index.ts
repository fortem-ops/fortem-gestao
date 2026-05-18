import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const DIAS = ["Domingo","Segunda-feira","Terça-feira","Quarta-feira","Quinta-feira","Sexta-feira","Sábado"];
const ATIVIDADES_PERMITIDAS = new Set(["Treino Experimental","Avaliação Funcional"]);

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
  await client.send({ from: "FORTEM <contatofortem@gmail.com>", to, subject, html: htmlBody });
  await client.close();
}

function buildHtml(opts: {
  evento: string; atividade: string; aluno: string; profissional: string;
  quando: string; horario: string; local: string; observacoes: string | null;
}) {
  const cancelado = opts.evento === "cancelado";
  const cor = cancelado ? "#dc2626" : "#16a34a";
  const titulo = cancelado ? "Agendamento cancelado" : "Novo agendamento";
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
    <p style="color:#aaa;font-size:11px;text-align:center;margin-top:28px;">FORTEM Gestão Técnica — notificação automática</p>
  </div></body></html>`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    const { evento, agenda_id, agenda: agendaFromBody, origem } = await req.json();
    if (!evento || !["agendado","cancelado"].includes(evento)) {
      return new Response(JSON.stringify({ error: "evento inválido" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (!agenda_id && !agendaFromBody?.id) {
      return new Response(JSON.stringify({ error: "agenda_id ausente" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const aId = agenda_id || agendaFromBody.id;

    // Idempotência (UNIQUE em (agenda_id, evento))
    const { error: lockErr } = await admin
      .from("agenda_notificacoes_log")
      .insert({ agenda_id: aId, evento, origem: origem || "desconhecido" });
    if (lockErr) {
      // Já enviado — sucesso silencioso
      return new Response(JSON.stringify({ skipped: true, reason: "duplicate" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Carrega agenda. No DELETE+trigger a linha pode não existir mais — usa fallback do body
    let agenda: any = null;
    const { data: ag } = await admin
      .from("agenda_servicos")
      .select("id, atividade, local, observacoes, profissional_id, aluno_id, dia_semana, data_especifica, horario_inicio, horario_fim, tipo")
      .eq("id", aId)
      .maybeSingle();
    agenda = ag || agendaFromBody;
    if (!agenda) throw new Error("agenda não encontrada");

    if (!ATIVIDADES_PERMITIDAS.has(agenda.atividade)) {
      return new Response(JSON.stringify({ skipped: true, reason: "atividade fora do escopo" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!agenda.aluno_id) {
      return new Response(JSON.stringify({ skipped: true, reason: "sem aluno" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!agenda.profissional_id) {
      return new Response(JSON.stringify({ skipped: true, reason: "sem profissional" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Email + nome do profissional
    const { data: userResp, error: userErr } = await admin.auth.admin.getUserById(agenda.profissional_id);
    if (userErr || !userResp?.user?.email) throw new Error("profissional sem email");
    const profEmail = userResp.user.email;

    const { data: profile } = await admin
      .from("profiles").select("full_name").eq("user_id", agenda.profissional_id).maybeSingle();
    const profNome = profile?.full_name || profEmail;

    const { data: aluno } = await admin
      .from("alunos").select("nome").eq("id", agenda.aluno_id).maybeSingle();
    const alunoNome = aluno?.nome || "Aluno";

    const quando = agenda.tipo === "avulso" && agenda.data_especifica
      ? new Date(agenda.data_especifica + "T12:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" })
      : `Toda ${DIAS[agenda.dia_semana] ?? ""} (horário fixo)`;

    const horario = `${(agenda.horario_inicio||"").slice(0,5)} - ${(agenda.horario_fim||"").slice(0,5)}`;

    const subject = `FORTEM — ${agenda.atividade} ${evento === "agendado" ? "agendado" : "cancelado"}: ${alunoNome}`;
    const html = buildHtml({
      evento, atividade: agenda.atividade, aluno: alunoNome, profissional: profNome,
      quando, horario, local: agenda.local || "—", observacoes: agenda.observacoes,
    });

    await sendGmailEmail(profEmail, subject, html);
    console.log(`Notificação ${evento} enviada para ${profEmail} (agenda ${aId})`);

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("notify-agenda-evento error:", err);
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
