// Verifica agenda_servicos e envia aviso 30 minutos antes de avaliações e treinos experimentais.
// Roda a cada 5 minutos via pg_cron e usa janela de 25–35 min para evitar perder eventos.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const TZ_OFFSET_MIN = -180; // America/Sao_Paulo (UTC-3, sem DST)

function normalizeSubject(s: string) {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[–—]/g, "-").replace(/[^\x20-\x7E]/g, "").replace(/\s+/g, " ").trim();
}

async function sendGmail(opts: { to: string; subject: string; html: string }) {
  const password = Deno.env.get("GMAIL_APP_PASSWORD");
  if (!password) {
    console.warn("GMAIL_APP_PASSWORD not configured — skipping email");
    return;
  }
  const client = new SMTPClient({
    connection: { hostname: "smtp.gmail.com", port: 465, tls: true, auth: { username: "contatofortem@gmail.com", password } },
  });
  await client.send({
    from: "FORTEM <contatofortem@gmail.com>",
    to: opts.to,
    subject: normalizeSubject(opts.subject),
    content: "auto",
    html: opts.html,
  });
  await client.close();
}

function buildHtml(opts: { atividade: string; aluno: string; horario: string; local: string }) {
  return `<!DOCTYPE html><html><body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:560px;margin:0 auto;padding:24px;background:#f8f9fa;">
    <div style="background:white;border-radius:16px;padding:28px;box-shadow:0 2px 8px rgba(0,0,0,.06);">
      <div style="text-align:center;margin-bottom:16px;"><span style="font-size:12px;font-weight:700;letter-spacing:2px;color:#1a1a2e;">FORTEM</span></div>
      <h1 style="font-size:20px;color:#16a34a;margin:0 0 6px;text-align:center;">⏰ Em 30 minutos</h1>
      <p style="text-align:center;color:#666;margin:0 0 20px;">Você tem um atendimento agendado em breve.</p>
      <div style="background:#f8f9fa;border-radius:12px;padding:18px;font-size:14px;color:#1a1a2e;">
        <p style="margin:0 0 8px;"><b>Atividade:</b> ${opts.atividade}</p>
        <p style="margin:0 0 8px;"><b>Aluno:</b> ${opts.aluno || "—"}</p>
        <p style="margin:0 0 8px;"><b>Horário:</b> ${opts.horario}</p>
        <p style="margin:0;"><b>Local:</b> ${opts.local || "—"}</p>
      </div>
    </div>
  </body></html>`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const sb = createClient(SUPABASE_URL, SERVICE_KEY);
  const now = new Date();
  // Janela local em São Paulo
  const localNow = new Date(now.getTime() - TZ_OFFSET_MIN * 60000);
  const yyyy = localNow.getUTCFullYear();
  const mm = String(localNow.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(localNow.getUTCDate()).padStart(2, "0");
  const todayLocal = `${yyyy}-${mm}-${dd}`;
  const diaSemana = localNow.getUTCDay(); // 0..6
  const minutesNow = localNow.getUTCHours() * 60 + localNow.getUTCMinutes();
  const lowerMin = minutesNow + 25;
  const upperMin = minutesNow + 35;
  const eventoTag = `proximo_30min_${todayLocal}`;

  // Busca agenda do dia
  const { data: itens, error } = await sb
    .from("agenda_servicos")
    .select("id, atividade, local, horario_inicio, profissional_id, aluno_id, tipo, data_especifica, dia_semana")
    .or(`and(tipo.eq.unico,data_especifica.eq.${todayLocal}),and(tipo.eq.fixo,dia_semana.eq.${diaSemana})`);
  if (error) {
    console.error("agenda query error", error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  // Exceções (cancelamentos)
  const { data: excecoes } = await sb
    .from("agenda_servicos_excecoes")
    .select("agenda_id")
    .eq("data", todayLocal);
  const canceladoIds = new Set((excecoes || []).map((e: any) => e.agenda_id));

  const candidatos = (itens || []).filter((i: any) => {
    if (canceladoIds.has(i.id)) return false;
    const a = (i.atividade || "").toLowerCase();
    if (!(a.includes("avalia") || a.includes("experimental"))) return false;
    const [h, m] = String(i.horario_inicio).split(":").map(Number);
    const mins = h * 60 + (m || 0);
    return mins >= lowerMin && mins < upperMin;
  });

  if (candidatos.length === 0) {
    return new Response(JSON.stringify({ checked: itens?.length ?? 0, sent: 0 }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  // Já notificados hoje
  const ids = candidatos.map((c: any) => c.id);
  const { data: jaLog } = await sb
    .from("agenda_notificacoes_log")
    .select("agenda_id, evento")
    .in("agenda_id", ids)
    .eq("evento", eventoTag);
  const jaSet = new Set((jaLog || []).map((l: any) => l.agenda_id));

  const pendentes = candidatos.filter((c: any) => !jaSet.has(c.id));
  if (pendentes.length === 0) {
    return new Response(JSON.stringify({ checked: itens?.length, sent: 0, skipped: candidatos.length }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  // Buscar alunos e profissionais
  const alunoIds = pendentes.map((p: any) => p.aluno_id).filter(Boolean) as string[];
  const profIds = pendentes.map((p: any) => p.profissional_id).filter(Boolean) as string[];
  const [{ data: alunosData }, { data: profilesData }] = await Promise.all([
    alunoIds.length ? sb.from("alunos").select("id, nome").in("id", alunoIds) : Promise.resolve({ data: [] as any[] }),
    profIds.length ? sb.from("profiles").select("user_id, full_name, email").in("user_id", profIds) : Promise.resolve({ data: [] as any[] }),
  ]);
  const alunoMap: Record<string, string> = {};
  (alunosData || []).forEach((a: any) => { alunoMap[a.id] = a.nome; });
  const profMap: Record<string, { nome: string; email: string | null }> = {};
  (profilesData || []).forEach((p: any) => { profMap[p.user_id] = { nome: p.full_name, email: p.email }; });

  // E-mails dos professores via auth.users (profiles pode não ter email)
  const { data: { users: authUsers } = { users: [] } } = await sb.auth.admin.listUsers({ page: 1, perPage: 1000 });
  const emailByUser: Record<string, string> = {};
  (authUsers || []).forEach((u: any) => { if (u.email) emailByUser[u.id] = u.email; });

  let sent = 0;
  for (const item of pendentes) {
    const aluno = item.aluno_id ? (alunoMap[item.aluno_id] || "—") : "—";
    const horario = String(item.horario_inicio).slice(0, 5);
    const titulo = `Em 30 min: ${item.atividade}`;
    const descricao = `${item.atividade} com ${aluno} às ${horario} — ${item.local || "local não informado"}`;

    // 1) Notificação interna (sino)
    const { data: notif, error: notifErr } = await sb.from("notificacoes").insert({
      titulo,
      descricao,
      categoria: "aluno",
      prioridade: "alta",
      tipo: "simples",
      criado_por: item.profissional_id,
      agenda_id: item.id,
      aluno_id: item.aluno_id,
    }).select("id").single();

    if (!notifErr && notif) {
      await sb.from("notificacao_destinatarios").insert({
        notificacao_id: notif.id,
        usuario_id: item.profissional_id,
      });
    } else if (notifErr) {
      console.error("notif insert error", notifErr);
    }

    // 2) E-mail
    const email = emailByUser[item.profissional_id] || profMap[item.profissional_id]?.email;
    if (email) {
      try {
        await sendGmail({
          to: email,
          subject: `Em 30 min: ${item.atividade} - ${horario}`,
          html: buildHtml({ atividade: item.atividade, aluno, horario, local: item.local }),
        });
      } catch (e) {
        console.error("email send error", e);
      }
    }

    // 3) Log para idempotência
    await sb.from("agenda_notificacoes_log").insert({
      agenda_id: item.id,
      evento: eventoTag,
      origem: "cron_proximos",
    });
    sent++;
  }

  return new Response(JSON.stringify({ checked: itens?.length, candidates: candidatos.length, sent }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
});
