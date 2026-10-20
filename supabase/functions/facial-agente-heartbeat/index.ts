import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

function igualConstante(a: string, b: string): boolean {
  const enc = new TextEncoder();
  const x = enc.encode(a);
  const y = enc.encode(b);
  let diff = x.length ^ y.length;
  const n = Math.max(x.length, y.length);
  for (let i = 0; i < n; i++) diff |= (x[i] ?? 0) ^ (y[i] ?? 0);
  return diff === 0;
}

const inteiroOuNulo = (v: unknown, min: number, max: number): number | null =>
  typeof v === "number" && Number.isFinite(v) && v >= min && v <= max
    ? Math.trunc(v)
    : null;

serve(async (req) => {
  if (req.method !== "POST") return json({ error: "Método não permitido" }, 405);

  const esperado = Deno.env.get("FACIAL_AGENT_TOKEN") ?? "";
  if (esperado.length < 32) {
    console.error("[facial-agente-heartbeat] FACIAL_AGENT_TOKEN ausente ou curto demais");
    return json({ error: "Função não configurada" }, 500);
  }
  if (!igualConstante(req.headers.get("x-agent-token") ?? "", esperado)) {
    return json({ error: "Não autorizado" }, 401);
  }

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return json({ error: "Corpo inválido" }, 400);
  }
  if (typeof body.porta_ok !== "boolean") {
    return json({ error: "porta_ok deve ser booleano" }, 400);
  }

  const versao = typeof body.versao === "string" ? body.versao.slice(0, 40) : "";
  const d = body.detalhe && typeof body.detalhe === "object" && !Array.isArray(body.detalhe)
    ? body.detalhe
    : {};

  const detalhe = {
    ultimo_rec_no: inteiroOuNulo(d.ultimo_rec_no, 0, 2147483647),
    relogio_dif_seg: inteiroOuNulo(d.relogio_dif_seg, -86400, 86400),
    falhas_seguidas: inteiroOuNulo(d.falhas_seguidas, 0, 1000000),
    ultimo_erro: typeof d.ultimo_erro === "string" ? d.ultimo_erro.slice(0, 200) : null,
  };

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );

  const { error } = await supabase.rpc("fn_facial_agente_heartbeat", {
    p_versao: versao,
    p_porta_ok: body.porta_ok,
    p_detalhe: detalhe,
  });
  if (error) {
    console.error("[facial-agente-heartbeat] falha:", error.message);
    return json({ ok: false, error: "falha ao registrar" }, 503);
  }
  return json({ ok: true });
});
