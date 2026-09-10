import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function cpfValido(d: string) {
  if (d.length !== 11 || /^(\d)\1+$/.test(d)) return false;
  const calc = (n: number) => {
    let sum = 0;
    for (let i = 0; i < n; i++) sum += parseInt(d[i]) * (n + 1 - i);
    const r = (sum * 10) % 11;
    return r === 10 ? 0 : r;
  };
  return calc(9) === parseInt(d[9]) && calc(10) === parseInt(d[10]);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json(405, { ok: false, error: "method_not_allowed" });

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    const body = await req.json().catch(() => ({}));
    const alunoId = String(body?.aluno_id ?? "").trim();
    const cpfDigits = String(body?.cpf ?? "").replace(/\D/g, "");

    if (!alunoId) return json(200, { ok: false, error: "aluno_obrigatorio" });
    if (!cpfValido(cpfDigits)) return json(200, { ok: false, error: "cpf_invalido" });

    const jwt = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
    if (!jwt) return json(200, { ok: false, error: "nao_autorizado" });

    const { data: userRes } = await admin.auth.getUser(jwt);
    const userId = userRes?.user?.id ?? null;
    if (!userId) return json(200, { ok: false, error: "nao_autorizado" });

    const { data: aluno } = await admin
      .from("alunos")
      .select("id")
      .eq("id", alunoId)
      .eq("user_id", userId)
      .maybeSingle();
    if (!aluno?.id) return json(200, { ok: false, error: "nao_autorizado" });

    // CPF já usado por outro cadastro?
    const { data: hashRow } = await admin.rpc("fn_clube_hash_cpf", { _cpf: cpfDigits });
    if (hashRow) {
      const { data: existente } = await admin
        .from("alunos")
        .select("id")
        .eq("cpf_hash", hashRow as unknown as string)
        .neq("id", alunoId)
        .limit(1);
      if (existente && existente.length > 0) {
        return json(200, { ok: false, error: "cpf_duplicado" });
      }
    }

    const { error } = await admin.rpc("fn_service_set_cpf", {
      p_aluno_id: alunoId,
      p_cpf: cpfDigits,
    });
    if (error) {
      console.error("[portal-atualizar-cpf] fn_service_set_cpf falhou:", error.message);
      return json(200, { ok: false, error: "falha_gravar_cpf" });
    }

    return json(200, { ok: true, cpf_ultimos3: cpfDigits.slice(-3) });
  } catch (e) {
    console.error("[portal-atualizar-cpf] erro:", e);
    return json(200, { ok: false, error: "erro_inesperado" });
  }
});
