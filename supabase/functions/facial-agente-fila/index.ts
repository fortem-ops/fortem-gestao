import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

function igualConstante(a: string, b: string): boolean {
  const enc = new TextEncoder();
  const x = enc.encode(a);
  const y = enc.encode(b);
  let diff = x.length ^ y.length;
  const n = Math.max(x.length, y.length);
  for (let i = 0; i < n; i++) diff |= (x[i] ?? 0) ^ (y[i] ?? 0);
  return diff === 0;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function nomeParaEquipamento(nome: unknown): string {
  const base = typeof nome === "string" ? nome : "";
  const limpo = base
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^A-Za-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase()
    .slice(0, 30)
    .trim();
  return limpo || "ALUNO";
}

serve(async (req) => {
  if (req.method !== "POST") return json({ error: "Método não permitido" }, 405);

  const esperado = Deno.env.get("FACIAL_AGENT_TOKEN") ?? "";
  if (esperado.length < 32) {
    console.error("[facial-agente-fila] FACIAL_AGENT_TOKEN ausente ou curto demais");
    return json({ error: "Função não configurada" }, 500);
  }
  if (!igualConstante(req.headers.get("x-agent-token") ?? "", esperado)) {
    return json({ error: "Não autorizado" }, 401);
  }

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return json({ error: "Corpo inválido" }, 400);
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );

  if (body.op === "concluir") {
    if (typeof body.id !== "string" || !UUID.test(body.id)) return json({ error: "id inválido" }, 400);
    if (typeof body.ok !== "boolean") return json({ error: "ok deve ser booleano" }, 400);
    const erro = typeof body.erro === "string" ? body.erro.slice(0, 300) : null;
    const { data, error } = await supabase.rpc("fn_facial_fila_concluir", {
      p_id: body.id, p_ok: body.ok, p_erro: erro,
    });
    if (error) {
      console.error("[facial-agente-fila] concluir falhou:", error.message);
      return json({ ok: false, error: "falha ao concluir" }, 503);
    }
    return json(data ?? { ok: true });
  }

  if (body.op === "reservar") {
    const max = Number.isInteger(body.max) ? Math.min(Math.max(body.max, 1), 10) : 5;
    const { data, error } = await supabase.rpc("fn_facial_fila_reservar", { p_max: max });
    if (error) {
      console.error("[facial-agente-fila] reservar falhou:", error.message);
      return json({ ok: false, error: "falha ao reservar" }, 503);
    }

    const jobs: unknown[] = [];
    for (const j of (data?.jobs ?? []) as any[]) {
      let fotoUrl: string | null = null;
      if (j.acao !== "remover") {
        const { data: s, error: e2 } = await supabase.storage
          .from("faciais").createSignedUrl(String(j.foto_path), 120);
        if (e2 || !s?.signedUrl) {
          console.error("[facial-agente-fila] url assinada falhou:", e2?.message);
          await supabase.rpc("fn_facial_fila_concluir", {
            p_id: j.id, p_ok: false, p_erro: "não foi possível gerar o endereço da foto",
          });
          continue;
        }
        fotoUrl = s.signedUrl;
      }
      jobs.push({
        id: j.id, acao: j.acao, device_user_id: j.device_user_id,
        nome: nomeParaEquipamento(j.nome), foto_url: fotoUrl,
      });
    }
    return json({ jobs });
  }

  return json({ error: "op inválida" }, 400);
});