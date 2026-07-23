// Public ICS feed for a student's calendar subscription (webcal://)
// Accessed directly by Google Calendar / Apple Calendar — no auth session.
import { createClient } from "npm:@supabase/supabase-js@2";

const TZ = "America/Sao_Paulo";
const PRODID = "-//Fortem//Agenda Aluno//PT-BR";

// SP is UTC-3 all year (no DST since 2019).
const SP_OFFSET_MIN = -180;

function pad(n: number) { return String(n).padStart(2, "0"); }

// Format a local (São Paulo) date+time (YYYY-MM-DD, HH:MM:SS) into ICS UTC (YYYYMMDDTHHMMSSZ)
function toIcsUtc(dateStr: string, timeStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const [hh, mm, ss] = (timeStr + ":00").split(":").map(Number);
  // Local SP time -> UTC by subtracting the offset (offset is -180)
  const utc = new Date(Date.UTC(y, m - 1, d, hh, mm, ss || 0) - SP_OFFSET_MIN * 60_000);
  return `${utc.getUTCFullYear()}${pad(utc.getUTCMonth() + 1)}${pad(utc.getUTCDate())}T${pad(utc.getUTCHours())}${pad(utc.getUTCMinutes())}${pad(utc.getUTCSeconds())}Z`;
}

// EXDATE for recurring weekly events: convert a date + HH:MM:SS to UTC stamp
function exdateUtc(dateStr: string, timeStr: string): string {
  return toIcsUtc(dateStr, timeStr);
}

function escapeIcs(text: string): string {
  return (text || "")
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

function foldLine(line: string): string {
  // RFC 5545: fold lines longer than 75 octets
  if (line.length <= 75) return line;
  const parts: string[] = [];
  let i = 0;
  while (i < line.length) {
    parts.push((i === 0 ? "" : " ") + line.slice(i, i + 73));
    i += 73;
  }
  return parts.join("\r\n");
}

function buildCalendar(name: string, events: string[]): string {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    `PRODID:${PRODID}`,
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${escapeIcs(name)}`,
    `X-WR-TIMEZONE:${TZ}`,
    "BEGIN:VTIMEZONE",
    `TZID:${TZ}`,
    "BEGIN:STANDARD",
    "DTSTART:19700101T000000",
    "TZOFFSETFROM:-0300",
    "TZOFFSETTO:-0300",
    "TZNAME:-03",
    "END:STANDARD",
    "END:VTIMEZONE",
    ...events,
    "END:VCALENDAR",
    "",
  ];
  return lines.map(foldLine).join("\r\n");
}

const ICAL_HEADERS = {
  "Content-Type": "text/calendar; charset=utf-8",
  "Cache-Control": "public, max-age=900",
  "Access-Control-Allow-Origin": "*",
};

function emptyCalendar(name = "Fortem — Agenda"): Response {
  return new Response(buildCalendar(name, []), { headers: ICAL_HEADERS, status: 200 });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: { ...ICAL_HEADERS, "Access-Control-Allow-Headers": "*", "Access-Control-Allow-Methods": "GET, OPTIONS" } });
  }

  try {
    const url = new URL(req.url);
    const token = url.searchParams.get("token");
    if (!token || token.length < 16) return emptyCalendar();

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } },
    );

    const { data: tokenRow } = await supabase
      .from("aluno_calendar_tokens")
      .select("aluno_id")
      .eq("token", token)
      .maybeSingle();

    if (!tokenRow?.aluno_id) return emptyCalendar();
    const alunoId = tokenRow.aluno_id as string;

    const { data: aluno } = await supabase
      .from("alunos")
      .select("nome")
      .eq("id", alunoId)
      .maybeSingle();

    const calName = `Fortem — ${aluno?.nome ?? "Agenda"}`;

    // ---- Treinos ----
    const today = new Date();
    const past = new Date(today.getTime() - 14 * 86400_000);
    const future = new Date(today.getTime() + 90 * 86400_000);
    const dateFmt = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

    const { data: treinos } = await supabase
      .from("treino_agendamentos")
      .select("id,data,horario_inicio,horario_fim,status")
      .eq("aluno_id", alunoId)
      .neq("status", "cancelado")
      .gte("data", dateFmt(past))
      .lte("data", dateFmt(future));

    const events: string[] = [];
    const nowStamp = toIcsUtc(dateFmt(today), `${pad(today.getUTCHours())}:${pad(today.getUTCMinutes())}:${pad(today.getUTCSeconds())}`);

    for (const t of treinos ?? []) {
      const dt = t.data as string;
      const hi = String(t.horario_inicio).slice(0, 8);
      const hf = String(t.horario_fim).slice(0, 8);
      events.push(
        "BEGIN:VEVENT",
        `UID:treino-${t.id}@fortem`,
        `DTSTAMP:${nowStamp}`,
        `DTSTART:${toIcsUtc(dt, hi)}`,
        `DTEND:${toIcsUtc(dt, hf)}`,
        `SUMMARY:${escapeIcs("Treino — Fortem")}`,
        `LOCATION:${escapeIcs("Fortem")}`,
        "END:VEVENT",
      );
    }

    // ---- agenda_servicos ----
    const { data: servicos } = await supabase
      .from("agenda_servicos")
      .select("id,atividade,local,dia_semana,horario_inicio,horario_fim,data_especifica")
      .eq("aluno_id", alunoId);

    // Fetch exceptions for the recurring ones
    const recorrentesIds = (servicos ?? []).filter((s: any) => !s.data_especifica).map((s: any) => s.id);
    let excecoesByAgenda = new Map<string, string[]>();
    if (recorrentesIds.length > 0) {
      const { data: excs } = await supabase
        .from("agenda_servicos_excecoes")
        .select("agenda_id,data_excecao")
        .in("agenda_id", recorrentesIds);
      for (const e of excs ?? []) {
        const arr = excedoesGet(excecoesByAgenda, e.agenda_id);
        arr.push(e.data_excecao);
      }
    }

    const BYDAY = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"];

    for (const s of servicos ?? []) {
      const summary = `${s.atividade ?? "Serviço"} — Fortem`;
      const loc = s.local ?? "";
      const hi = String(s.horario_inicio).slice(0, 8);
      const hf = String(s.horario_fim).slice(0, 8);

      if (s.data_especifica) {
        events.push(
          "BEGIN:VEVENT",
          `UID:servico-${s.id}@fortem`,
          `DTSTAMP:${nowStamp}`,
          `DTSTART:${toIcsUtc(s.data_especifica, hi)}`,
          `DTEND:${toIcsUtc(s.data_especifica, hf)}`,
          `SUMMARY:${escapeIcs(summary)}`,
          `LOCATION:${escapeIcs(loc)}`,
          "END:VEVENT",
        );
        continue;
      }

      // Recurring weekly. Find next occurrence of dia_semana >= today (bounded).
      const dia = Number(s.dia_semana);
      if (!Number.isInteger(dia) || dia < 0 || dia > 6) continue;
      const start = new Date(past);
      // advance to first matching weekday
      while (start.getDay() !== dia) start.setDate(start.getDate() + 1);
      const firstDate = dateFmt(start);

      const lines = [
        "BEGIN:VEVENT",
        `UID:servico-${s.id}@fortem`,
        `DTSTAMP:${nowStamp}`,
        `DTSTART:${toIcsUtc(firstDate, hi)}`,
        `DTEND:${toIcsUtc(firstDate, hf)}`,
        `RRULE:FREQ=WEEKLY;BYDAY=${BYDAY[dia]}`,
        `SUMMARY:${escapeIcs(summary)}`,
        `LOCATION:${escapeIcs(loc)}`,
      ];
      const excs = excecoesByAgenda.get(s.id) ?? [];
      if (excs.length > 0) {
        lines.push(`EXDATE:${excs.map((d) => exdateUtc(d, hi)).join(",")}`);
      }
      lines.push("END:VEVENT");
      events.push(...lines);
    }

    return new Response(buildCalendar(calName, events), { headers: ICAL_HEADERS, status: 200 });
  } catch (err) {
    console.error("agenda-ics error:", err);
    return emptyCalendar();
  }
});

function excedoesGet(map: Map<string, string[]>, key: string): string[] {
  const cur = map.get(key);
  if (cur) return cur;
  const arr: string[] = [];
  map.set(key, arr);
  return arr;
}
