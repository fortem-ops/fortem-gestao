// Busca pública (sem login) de dados cadastrais por CPF, usada no fluxo /assinar.
// Retorna somente os campos necessários para preencher o formulário de assinatura.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { checkRateLimit } from "../_shared/corrida-rate-limit.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function jsonResp(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function isValidCPF(cpf: string): boolean {
  const d = cpf.replace(/\D/g, "");
  if (d.length !== 11 || /^(\d)\1{10}$/.test(d)) return false;
  const calc = (n: number) => {
    let sum = 0;
    for (let i = 0; i < n; i++) sum += parseInt(d[i]) * (n + 1 - i);
    const r = (sum * 10) % 11;
    return r === 10 ? 0 : r;
  };
  return calc(9) === parseInt(d[9]) && calc(10) === parseInt(d[10]);
}

async function hashCpf(cpf: string): Promise<string> {
  const digits = cpf.replace(/\D/g, "");
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(digits));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { ok } = await checkRateLimit(admin, req, "lookup-cadastro-publico", 10, 600);
    if (!ok) {
      return jsonResp(429, { error: "Muitas consultas. Aguarde alguns minutos e tente novamente." });
    }

    const body = await req.json().catch(() => ({}));
    const cpf = typeof body?.cpf === "string" ? body.cpf : "";
    if (!isValidCPF(cpf)) return jsonResp(400, { error: "CPF inválido" });

    const hash = await hashCpf(cpf);

    // 1) aluno / prospect já cadastrado
    const { data: aluno } = await admin
      .from("alunos")
      .select("nome, data_nascimento, telefone, email")
      .eq("cpf_hash", hash)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    // 2) último documento assinado (traz também contato de emergência)
    const { data: anexo } = await admin
      .from("legal_annexes")
      .select("nome, data_nascimento, telefone, email, emergency_contact_name, emergency_contact_phone")
      .eq("cpf_hash", hash)
      .order("signed_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!aluno && !anexo) return jsonResp(200, { found: false, data: null });

    const data = {
      nome: aluno?.nome ?? anexo?.nome ?? null,
      data_nascimento: aluno?.data_nascimento ?? anexo?.data_nascimento ?? null,
      telefone: aluno?.telefone ?? anexo?.telefone ?? null,
      email: aluno?.email ?? anexo?.email ?? null,
      emergency_contact_name: anexo?.emergency_contact_name ?? null,
      emergency_contact_phone: anexo?.emergency_contact_phone ?? null,
    };

    return jsonResp(200, { found: true, data });
  } catch (err) {
    console.error("lookup-cadastro-publico error:", err);
    return jsonResp(500, { error: "Internal server error" });
  }
});
