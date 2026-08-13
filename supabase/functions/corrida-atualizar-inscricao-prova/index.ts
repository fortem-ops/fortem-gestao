import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function str(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json(405, { error: "metodo_nao_permitido" });

  try {
    const body = await req.json().catch(() => ({}));

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // --- rate limit por IP (5 tentativas / janela de 5 min) ---
    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      req.headers.get("cf-connecting-ip") ||
      req.headers.get("x-real-ip") ||
      "unknown";
    const janela_min = Math.floor(Date.now() / 1000 / 300);

    const { data: rl } = await admin
      .from("rate_limit_corrida_inscricao")
      .select("contagem")
      .eq("ip_address", ip)
      .eq("janela_min", janela_min)
      .maybeSingle();

    const contagem = (rl?.contagem ?? 0) + 1;
    await admin
      .from("rate_limit_corrida_inscricao")
      .upsert({ ip_address: ip, janela_min, contagem }, { onConflict: "ip_address,janela_min" });

    if (contagem > 5) return json(429, { error: "muitas_tentativas" });

    const inscricaoId = str(body?.inscricao_id);
    if (!UUID_RE.test(inscricaoId)) return json(400, { error: "validacao", campos: ["inscricao_id"] });

    const { data: inscricao, error: buscaErr } = await admin
      .from("corrida_inscricoes_prova")
      .select("id, rota, provas")
      .eq("id", inscricaoId)
      .maybeSingle();
    if (buscaErr) throw buscaErr;
    if (!inscricao) return json(404, { error: "inscricao_nao_encontrada" });

    const provas = Array.isArray(inscricao.provas) ? (inscricao.provas as any[]) : [];
    const temNb = provas.some((p) => p?.prova === "NB");
    const temMipoa = provas.some((p) => p?.prova === "MIPOA");
    const exigeTermo = inscricao.rota !== "somente_provas";

    const errors: string[] = [];
    const ritmo_corrida = str(body?.ritmo_corrida);
    const local_nascimento = str(body?.local_nascimento);
    const marca_tenis = str(body?.marca_tenis);
    const como_soube = str(body?.como_soube);
    const camiseta_nb = str(body?.camiseta_nb);
    const camiseta_mipoa = str(body?.camiseta_mipoa);
    const participou_nb =
      typeof body?.participou_nb_2026 === "boolean" ? body.participou_nb_2026 : null;
    const participou_mipoa =
      typeof body?.participou_mipoa_2026 === "boolean" ? body.participou_mipoa_2026 : null;

    if (!ritmo_corrida) errors.push("ritmo_corrida");
    if (!["RS", "Outros"].includes(local_nascimento)) errors.push("local_nascimento");
    if (!marca_tenis) errors.push("marca_tenis");
    if (!como_soube) errors.push("como_soube");
    if (temNb && (participou_nb === null || !camiseta_nb)) errors.push("nb");
    if (temMipoa && (participou_mipoa === null || !camiseta_mipoa)) errors.push("mipoa");
    if (body?.aceite_inscricao !== true) errors.push("aceite_inscricao");
    if (exigeTermo && body?.aceite_termo_aptidao !== true) errors.push("aceite_termo_aptidao");

    if (errors.length > 0) return json(400, { error: "validacao", campos: errors });

    const { error: updErr } = await admin
      .from("corrida_inscricoes_prova")
      .update({
        ritmo_corrida,
        local_nascimento,
        participou_nb_2026: temNb ? participou_nb : null,
        participou_mipoa_2026: temMipoa ? participou_mipoa : null,
        marca_tenis,
        como_soube,
        camiseta_nb: temNb ? camiseta_nb : null,
        camiseta_mipoa: temMipoa ? camiseta_mipoa : null,
        aceite_inscricao: true,
        aceite_termo_aptidao: exigeTermo ? true : null,
        inscricao_prova_completa: true,
        updated_at: new Date().toISOString(),
      })
      .eq("id", inscricaoId);
    if (updErr) throw updErr;

    return json(200, { ok: true, protocolo: inscricaoId });
  } catch (err) {
    console.error("corrida-atualizar-inscricao-prova error:", err);
    return json(500, { error: "erro_interno" });
  }
});
