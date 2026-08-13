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

    // --- validação (somente dados cadastrais) ---
    const errors: string[] = [];
    const rota = str(body?.rota);
    if (!ROTAS.includes(rota)) errors.push("rota");

    const nome = str(body?.nome);
    const sobrenome = str(body?.sobrenome);
    const email = str(body?.email);
    const cpf = str(body?.cpf).replace(/\D/g, "");
    const data_nascimento = str(body?.data_nascimento);
    const telefone = str(body?.telefone);
    const cep = str(body?.cep).replace(/\D/g, "");
    const logradouro = str(body?.logradouro);
    const numero = str(body?.numero);
    const complemento = str(body?.complemento);
    const bairro = str(body?.bairro);
    const cidade = str(body?.cidade);
    const uf = str(body?.uf).toUpperCase();
    const provas = Array.isArray(body?.provas) ? body.provas : [];

    if (!nome) errors.push("nome");
    if (!sobrenome) errors.push("sobrenome");
    if (!EMAIL_RE.test(email)) errors.push("email");
    if (cpf.length !== 11) errors.push("cpf");
    if (!DATE_RE.test(data_nascimento)) errors.push("data_nascimento");
    if (!telefone) errors.push("telefone");
    if (cep.length !== 8) errors.push("cep");
    if (!logradouro) errors.push("logradouro");
    if (!numero) errors.push("numero");
    if (!bairro) errors.push("bairro");
    if (!cidade) errors.push("cidade");
    if (uf.length !== 2) errors.push("uf");

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
      p_cep: cep,
      p_logradouro: logradouro,
      p_numero: numero,
      p_complemento: complemento || null,
      p_bairro: bairro,
      p_cidade: cidade,
      p_uf: uf,
      // campos específicos de prova ficam nulos: preenchidos na etapa final
      p_ritmo_corrida: null,
      p_local_nascimento: null,
      p_participou_nb_2026: null,
      p_participou_mipoa_2026: null,
      p_marca_tenis: null,
      p_como_soube: null,
      p_camiseta_nb: null,
      p_camiseta_mipoa: null,
      p_provas: provas,
      p_aceite_inscricao: null,
      p_aceite_termo_aptidao: null,
      p_pedido_resumo: body?.pedido_resumo ?? {},
    });

    if (error) throw error;

    return json(200, { ok: true, inscricao_id: id });
  } catch (err) {
    console.error("corrida-registrar-inscricao error:", err);
    return json(500, { error: "erro_interno" });
  }
});
