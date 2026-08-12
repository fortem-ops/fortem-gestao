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

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const ROTAS = ["aluno", "somente_corrida", "prospect", "somente_provas"];

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

    // --- validação ---
    const errors: string[] = [];
    const rota = str(body?.rota);
    if (!ROTAS.includes(rota)) errors.push("rota");

    const nome = str(body?.nome);
    const sobrenome = str(body?.sobrenome);
    const email = str(body?.email);
    const cpf = str(body?.cpf).replace(/\D/g, "");
    const data_nascimento = str(body?.data_nascimento);
    const telefone = str(body?.telefone);
    const endereco_completo = str(body?.endereco_completo);
    const ritmo_corrida = str(body?.ritmo_corrida);
    const local_nascimento = str(body?.local_nascimento);
    const marca_tenis = str(body?.marca_tenis);
    const como_soube = str(body?.como_soube);
    const provas = Array.isArray(body?.provas) ? body.provas : [];

    if (!nome) errors.push("nome");
    if (!sobrenome) errors.push("sobrenome");
    if (!EMAIL_RE.test(email)) errors.push("email");
    if (cpf.length !== 11) errors.push("cpf");
    if (!DATE_RE.test(data_nascimento)) errors.push("data_nascimento");
    if (!telefone) errors.push("telefone");
    if (!endereco_completo) errors.push("endereco_completo");
    if (!ritmo_corrida) errors.push("ritmo_corrida");
    if (!["RS", "Outros"].includes(local_nascimento)) errors.push("local_nascimento");
    if (!marca_tenis) errors.push("marca_tenis");
    if (!como_soube) errors.push("como_soube");
    if (provas.length === 0) errors.push("provas");
    if (body?.aceite_inscricao !== true) errors.push("aceite_inscricao");
    if (rota !== "somente_provas" && body?.aceite_termo_aptidao !== true) {
      errors.push("aceite_termo_aptidao");
    }

    if (errors.length > 0) return json(400, { error: "validacao", campos: errors });

    const { data: id, error } = await admin.rpc("fn_inserir_inscricao_prova", {
      p_rota: rota,
      p_aluno_id: str(body?.aluno_id) || null,
      p_nome: nome,
      p_sobrenome: sobrenome,
      p_email: email,
      p_cpf: cpf,
      p_data_nascimento: data_nascimento,
      p_telefone: telefone,
      p_endereco_completo: endereco_completo,
      p_ritmo_corrida: ritmo_corrida,
      p_local_nascimento: local_nascimento,
      p_participou_nb_2026:
        typeof body?.participou_nb_2026 === "boolean" ? body.participou_nb_2026 : null,
      p_participou_mipoa_2026:
        typeof body?.participou_mipoa_2026 === "boolean" ? body.participou_mipoa_2026 : null,
      p_marca_tenis: marca_tenis,
      p_como_soube: como_soube,
      p_camiseta_nb: str(body?.camiseta_nb) || null,
      p_camiseta_mipoa: str(body?.camiseta_mipoa) || null,
      p_provas: provas,
      p_aceite_inscricao: true,
      p_aceite_termo_aptidao:
        typeof body?.aceite_termo_aptidao === "boolean" ? body.aceite_termo_aptidao : null,
      p_pedido_resumo: body?.pedido_resumo ?? {},
    });

    if (error) throw error;

    return json(200, { ok: true, protocolo: id });
  } catch (err) {
    console.error("corrida-registrar-inscricao error:", err);
    return json(500, { error: "erro_interno" });
  }
});
