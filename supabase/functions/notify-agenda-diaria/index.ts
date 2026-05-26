import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
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

async function sendGmailEmail(opts: { from: string; to: string; subject: string; html: string }) {
  const password = Deno.env.get("GMAIL_APP_PASSWORD");
  if (!password) throw new Error("GMAIL_APP_PASSWORD not configured");
  const client = new SMTPClient({
    connection: { hostname: "smtp.gmail.com", port: 465, tls: true,
      auth: { username: "contatofortem@gmail.com", password } },
  });
  await client.send({ from: opts.from, to: opts.to, subject: normalizeEmailSubject(opts.subject), content: "auto", html: opts.html });
  await client.close();
}

function buildHtml(profNome: string, dataStr: string, eventos: any[]) {
  const rows = eventos.map((e) => `
    <tr style="border-top:1px solid #eee;">
      <td style="padding:10px 6px;font-weight:600;white-space:nowrap;">${(e.horario_inicio||"").slice(0,5)}–${(e.horario_fim||"").slice(0,5)}</td>
      <td style="padding:10px 6px;">${e.atividade}</td>
      <td style="padding:10px 6px;">${e.aluno_nome || "—"}</td>
      <td style="padding:10px 6px;color:#666;">${e.local || "—"}</td>
    </tr>`).join("");
  return `<!DOCTYPE html><html><body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:680px;margin:0 auto;padding:24px;background:#f8f9fa;">
  <div style="background:white;border-radius:16px;padding:32px;box-shadow:0 2px 8px rgba(0,0,0,.06);">
    <div style="text-align:center;margin-bottom:20px;"><span style="font-size:12px;font-weight:700;letter-spacing:2px;color:#1a1a2e;">FORTEM</span></div>
    <h1 style="font-size:20px;color:#16a34a;margin:0 0 6px;text-align:center;">Sua agenda de hoje</h1>
    <p style="font-size:14px;color:#555;text-align:center;margin:0 0 24px;">${dataStr} · ${eventos.length} agendamento(s)</p>
    <p style="font-size:14px;color:#333;margin:0 0 16px;">Olá, ${profNome}! Confira os agendamentos para hoje:</p>
    <table style="width:100%;border-collapse:collapse;font-size:14px;color:#333;">
      <thead><tr style="background:#f1f5f9;color:#475569;text-align:left;">
        <th style="padding:10px 6px;">Horário</th><th style="padding:10px 6px;">Atividade</th><th style="padding:10px 6px;">Aluno</th><th style="padding:10px 6px;">Local</th>
      </tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <p style="color:#aaa;font-size:11px;text-align:center;margin-top:28px;">FORTEM Gestão Técnica — notificação automática</p>
  </div></body></html>`;
}

let _cachedSecret: string | null = null;
async function authorize(req: Request, admin: any, opts: { requireStaff?: boolean; requireAdmin?: boolean } = {}): Promise<{ ok: true } | { ok: false; status: number }> {
  const provided = req.headers.get("x-webhook-secret");
  if (provided) {
    if (!_cachedSecret) {
      const { data } = await admin.rpc("get_webhook_secret");
      _cachedSecret = typeof data === "string" ? data : null;
    }
    if (_cachedSecret && provided === _cachedSecret) return { ok: true };
  }
  const authHeader = req.headers.get("Authorization");
  if (authHeader?.startsWith("Bearer ")) {
    const userClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } });
    const { data: u, error } = await userClient.auth.getUser();
    if (!error && u?.user) {
      if (opts.requireAdmin) {
        const { data: isA } = await admin.rpc("is_admin", { _user_id: u.user.id });
        if (!isA) return { ok: false, status: 403 };
      } else if (opts.requireStaff) {
        const { data: isS } = await admin.rpc("is_staff", { _user_id: u.user.id });
        if (!isS) return { ok: false, status: 403 };
      }
      return { ok: true };
    }
  }
  return { ok: false, status: 401 };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  const auth = await authorize(req, admin, { requireStaff: true });
  if (!auth.ok) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: auth.status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  try {
    const { data: cfg } = await admin.from("notificacao_email_config").select("*").eq("id", 1).maybeSingle();
    if (!cfg) throw new Error("config não encontrada");
    if (!cfg.enviar_agenda_diaria) {
      return new Response(JSON.stringify({ skipped: "desativado" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Calcular hoje em BRT (UTC-3)
    const now = new Date();
    const brt = new Date(now.getTime() - 3 * 60 * 60 * 1000);
    const hojeStr = brt.toISOString().slice(0, 10); // YYYY-MM-DD
    const diaSemana = brt.getUTCDay();

    // Buscar agendamentos: fixos do dia da semana + avulsos de hoje
    const { data: agendas } = await admin
      .from("agenda_servicos")
      .select("id, atividade, local, observacoes, profissional_id, aluno_id, dia_semana, data_especifica, horario_inicio, horario_fim, tipo")
      .or(`and(tipo.eq.fixo,dia_semana.eq.${diaSemana}),and(tipo.eq.avulso,data_especifica.eq.${hojeStr})`);

    if (!agendas?.length) {
      return new Response(JSON.stringify({ success: true, sent: 0, motivo: "sem agendamentos" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Agrupar por profissional
    const byProf = new Map<string, any[]>();
    for (const a of agendas) {
      if (!a.profissional_id) continue;
      if (!byProf.has(a.profissional_id)) byProf.set(a.profissional_id, []);
      byProf.get(a.profissional_id)!.push(a);
    }

    // Resolver nomes de alunos
    const alunoIds = Array.from(new Set(agendas.filter((a: any) => a.aluno_id).map((a: any) => a.aluno_id)));
    const alunoMap = new Map<string, string>();
    if (alunoIds.length) {
      const { data: alunos } = await admin.from("alunos").select("id, nome").in("id", alunoIds);
      (alunos || []).forEach((a: any) => alunoMap.set(a.id, a.nome));
    }

    const dataStr = brt.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long", year: "numeric" });
    const from = `${cfg.remetente_nome} <${cfg.remetente_email}>`;

    let sent = 0;
    for (const [profId, eventos] of byProf.entries()) {
      // Idempotência por profissional+data
      const { error: lockErr } = await admin.from("agenda_diaria_log")
        .insert({ profissional_id: profId, data: hojeStr, total_eventos: eventos.length });
      if (lockErr) continue;

      const { data: userResp } = await admin.auth.admin.getUserById(profId);
      const email = userResp?.user?.email;
      if (!email) continue;

      const { data: profile } = await admin.from("profiles").select("full_name").eq("user_id", profId).maybeSingle();
      const nome = profile?.full_name || email;

      eventos.sort((a, b) => (a.horario_inicio || "").localeCompare(b.horario_inicio || ""));
      const enriched = eventos.map((e) => ({ ...e, aluno_nome: e.aluno_id ? alunoMap.get(e.aluno_id) : null }));

      try {
        await sendGmailEmail({
          from, to: email,
          subject: `FORTEM — Agenda do dia (${eventos.length} ${eventos.length === 1 ? "evento" : "eventos"})`,
          html: buildHtml(nome, dataStr, enriched),
        });
        sent++;
      } catch (e) {
        console.error("send fail", email, e);
      }
    }

    return new Response(JSON.stringify({ success: true, sent, total_profissionais: byProf.size }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    console.error("notify-agenda-diaria error:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
