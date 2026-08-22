import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  cpfDigits,
  cpfHashFromRaw,
  decidirRota,
  splitNome,
} from "../_shared/corrida-identidade.ts";

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


Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const digits = String(body?.cpf ?? "").replace(/\D/g, "");
    if (digits.length !== 11) return json(400, { error: "cpf_invalido" });

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // --- rate limit por IP (janelas de 5 min) ---
    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      req.headers.get("cf-connecting-ip") ||
      req.headers.get("x-real-ip") ||
      "unknown";
    const janela_min = Math.floor(Date.now() / 1000 / 300);

    const { data: rl } = await admin
      .from("rate_limit_corrida_cpf")
      .select("contagem")
      .eq("ip_address", ip)
      .eq("janela_min", janela_min)
      .maybeSingle();

    const contagem = (rl?.contagem ?? 0) + 1;
    await admin
      .from("rate_limit_corrida_cpf")
      .upsert({ ip_address: ip, janela_min, contagem }, { onConflict: "ip_address,janela_min" });

    if (contagem > 8) return json(429, { error: "muitas_tentativas" });

    // --- lookup ---
    const hash = await sha256Hex(digits);
    const { data: aluno, error: alunoErr } = await admin
      .from("alunos")
      .select("id, nome, email, telefone, data_nascimento, cep, logradouro, numero, complemento, bairro, cidade, uf")
      .eq("cpf_hash", hash)
      .eq("status", "ativo")
      .limit(1)
      .maybeSingle();

    if (alunoErr) throw alunoErr;
    if (!aluno) return json(200, { found: false });

    const { data: plano } = await admin
      .from("planos")
      .select("tipo, created_at")
      .eq("aluno_id", aluno.id)
      .eq("ativo", true)
      .eq("atividade", "treinamento_funcional")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const tipoNorm = plano?.tipo ? String(plano.tipo).trim().toLowerCase() : null;
    const isAgregadora = tipoNorm ? AGREGADORAS.has(tipoNorm) : false;
    const tier = !isAgregadora && tipoNorm ? TIER_MAP[tipoNorm] ?? null : null;


    const partesNome = String(aluno.nome ?? "").trim().split(/\s+/).filter(Boolean);

    return json(200, {
      found: true,
      rota: isAgregadora ? "prospect" : tier ? "aluno" : "somente_corrida",
      tier,
      primeiro_nome: partesNome[0] ?? "",
      sobrenome: partesNome.slice(1).join(" "),
      email: aluno.email ?? null,
      telefone: aluno.telefone ?? null,
      data_nascimento: aluno.data_nascimento ?? null,
      cep: aluno.cep ?? null,
      logradouro: aluno.logradouro ?? null,
      numero: aluno.numero ?? null,
      complemento: aluno.complemento ?? null,
      bairro: aluno.bairro ?? null,
      cidade: aluno.cidade ?? null,
      uf: aluno.uf ?? null,
    });

  } catch (err) {
    console.error("corrida-lookup-cpf error:", err);
    return json(500, { error: "erro_interno" });
  }
});
