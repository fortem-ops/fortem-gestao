import { supabase } from "@/integrations/supabase/client";

function maxDate(a: string | null, b: string | null): string | null {
  if (!a) return b;
  if (!b) return a;
  return a > b ? a : b;
}

export async function fetchLastFuncionalDateBatch(
  alunoIds: string[],
): Promise<Record<string, Date | null>> {
  const result: Record<string, Date | null> = {};
  alunoIds.forEach((id) => (result[id] = null));
  if (alunoIds.length === 0) return result;

  const todayISO = new Date().toISOString().slice(0, 10);

  const CHUNK = 300;
  const chunk = <T,>(arr: T[], size: number): T[][] => {
    const out: T[][] = [];
    for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
    return out;
  };

  const latest: Record<string, string | null> = {};
  alunoIds.forEach((id) => (latest[id] = null));

  for (const part of chunk(alunoIds, CHUNK)) {
    const [avalRes, agendaRes] = await Promise.all([
      supabase
        .from("avaliacoes")
        .select("aluno_id, data, tipo")
        .in("aluno_id", part)
        .ilike("tipo", "%funcional%"),
      supabase
        .from("agenda_servicos")
        .select("aluno_id, data_especifica, atividade")
        .in("aluno_id", part)
        .ilike("atividade", "%funcional%")
        .not("data_especifica", "is", null)
        .lte("data_especifica", todayISO),
    ]);

    (avalRes.data || []).forEach((r: any) => {
      if (!r.aluno_id || !r.data) return;
      latest[r.aluno_id] = maxDate(latest[r.aluno_id], r.data);
    });
    (agendaRes.data || []).forEach((r: any) => {
      if (!r.aluno_id || !r.data_especifica) return;
      latest[r.aluno_id] = maxDate(latest[r.aluno_id], r.data_especifica);
    });
  }


  for (const id of alunoIds) {
    const iso = latest[id];
    result[id] = iso ? new Date(iso + "T00:00:00") : null;
  }
  return result;
}

export async function fetchLastFuncionalDate(alunoId: string): Promise<Date | null> {
  const map = await fetchLastFuncionalDateBatch([alunoId]);
  return map[alunoId] ?? null;
}

export function severityForLastFuncional(date: Date | null, today = new Date()): {
  label: string;
  className: string;
  monthsAgo: number | null;
} {
  if (!date) return { label: "Nunca realizada", className: "status-urgent", monthsAgo: null };
  const months = (today.getTime() - date.getTime()) / (1000 * 60 * 60 * 24 * 30);
  if (months >= 6) return { label: "Atrasada", className: "status-urgent", monthsAgo: months };
  if (months >= 4) return { label: "Pendente", className: "status-warning", monthsAgo: months };
  return { label: "Em dia", className: "status-active", monthsAgo: months };
}
