import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { checkRateLimit } from "../_shared/loja-rate-limit.ts";

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

async function sha256Hex(input: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json(405, { error: "method_not_allowed" });

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    const { ok } = await checkRateLimit(admin, req, "criar-pedido", 10, 60);
    if (!ok) return json(429, { ok: false, error: "muitas_tentativas" });

    const body = await req.json().catch(() => ({}));
    const itens = Array.isArray(body?.itens) ? body.itens : [];
    const dp = body?.dadosPessoais ?? {};
    const parcelas = Math.max(1, Number(body?.parcelas ?? 1));
    const idempotencyKey = String(body?.idempotency_key ?? "").trim() || null;
    const alunoIdBody = String(body?.aluno_id ?? "").trim() || null;

    let nome = String(dp?.nome ?? "").trim();
    let cpfDigits = String(dp?.cpf ?? "").replace(/\D/g, "");
    let telefone = String(dp?.telefone ?? "").trim();
    let email = String(dp?.email ?? "").trim();

    // Aluno logado (Portal): confirma o vínculo pelo JWT e usa o cadastro real,
    // inclusive o CPF (que fica criptografado e nunca trafega pelo cliente).
    let alunoId: string | null = null;
    if (alunoIdBody) {
      const jwt = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
      if (jwt) {
        const { data: userRes } = await admin.auth.getUser(jwt);
        const userId = userRes?.user?.id ?? null;
        if (userId) {
          const { data: aluno } = await admin
            .from("alunos")
            .select("id, nome, email, telefone")
            .eq("id", alunoIdBody)
            .eq("user_id", userId)
            .maybeSingle();
          if (aluno?.id) {
            alunoId = aluno.id;
            nome = String(aluno.nome ?? nome).trim();
            email = String(aluno.email ?? email).trim();
            telefone = String(aluno.telefone ?? telefone).replace(/\D/g, "");
            const { data: cpfRevelado, error: cpfErr } = await admin.rpc("fn_reveal_cpf_service", {
              p_aluno_id: aluno.id,
            });
            if (cpfErr) {
              console.error("[loja-criar-pedido] falha revelar CPF do aluno:", cpfErr.message);
            }
            const cpfAluno = String(cpfRevelado ?? "").replace(/\D/g, "");
            if (cpfAluno.length === 11) {
              cpfDigits = cpfAluno;
            } else {
              console.error("[loja-criar-pedido] CPF do aluno indisponível", { aluno_id: aluno.id });
              return json(200, { ok: false, error: "cpf_aluno_indisponivel" });
            }
          }
        }
      }
      if (!alunoId) return json(200, { ok: false, error: "aluno_nao_autorizado" });
    }

    if (!itens.length) return json(200, { ok: false, error: "itens_obrigatorios" });
    if (!nome || cpfDigits.length !== 11 || !telefone || !email.includes("@")) {
      console.error("[loja-criar-pedido] dados pessoais inválidos", {
        nome_ok: !!nome,
        cpf_ok: cpfDigits.length === 11,
        telefone_ok: !!telefone,
        email_ok: email.includes("@"),
        aluno_id: alunoId,
      });
      return json(200, { ok: false, error: "dados_pessoais_invalidos" });
    }


    const itensNormalizados = itens.map((i: any) => ({
      variante_id: String(i?.variante_id ?? "").trim(),
      quantidade: Number(i?.quantidade ?? 0),
    }));
    if (itensNormalizados.some((i) => !i.variante_id || !Number.isInteger(i.quantidade) || i.quantidade <= 0)) {
      return json(200, { ok: false, error: "item_invalido" });
    }

    // ---------- 1. pedido + itens + reserva de estoque (atômico no banco) ----------
    const { data: resultado, error: rpcErr } = await admin.rpc("fn_loja_criar_pedido", {
      p_payload: {
        idempotency_key: idempotencyKey,
        aluno_id: alunoId,
        dadosPessoais: { nome, cpf: cpfDigits, telefone, email },
        itens: itensNormalizados,
      },
    });

    if (rpcErr) {
      console.error("[loja-criar-pedido] rpc erro:", rpcErr.message);
      if (/estoque_insuficiente/i.test(rpcErr.message)) {
        return json(200, { ok: false, error: "estoque_insuficiente" });
      }
      return json(200, { ok: false, error: "falha_criar_pedido" });
    }

    const r = (Array.isArray(resultado) ? resultado[0] : resultado) as any;
    if (!r?.ok) {
      const erro = String(r?.error ?? "falha_criar_pedido");
      return json(200, { ok: false, error: erro, variante_id: r?.variante_id ?? null });
    }

    const pedidoId = r.pedido_id as string;

    // ---------- 2. cadastro-base do comprador (necessário para tokenizar o cartão) ----------
    const cpfHash = await sha256Hex(cpfDigits);
    let compradorId: string | null = alunoId;

    const { data: alunoExistente } = compradorId
      ? { data: { id: compradorId } }
      : await admin
          .from("alunos")
          .select("id")
          .eq("cpf_hash", cpfHash)
          .limit(1)
          .maybeSingle();

    if (alunoExistente?.id) {
      compradorId = alunoExistente.id;
    } else {
      const { data: novo, error: novoErr } = await admin
        .from("alunos")
        .insert({
          nome,
          email,
          telefone,
          status: "avulso",
          observacoes: "Cadastro criado pelo checkout público da Loja",
        })
        .select("id")
        .single();
      if (novoErr || !novo) {
        console.error("[loja-criar-pedido] falha criar comprador:", novoErr?.message);
        return json(500, { ok: false, error: "falha_criar_comprador" });
      }
      compradorId = novo.id;
    }

    // ---------- 3. token de sessão para cadastro do cartão ----------
    const bytes = new Uint8Array(24);
    crypto.getRandomValues(bytes);
    const cartaoToken = Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");

    const { error: linkErr } = await admin.from("links_cartao").insert({
      aluno_id: compradorId,
      token: cartaoToken,
      origem: "link_cadastro",
      criado_por: null,
      expira_em: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    });
    if (linkErr) {
      console.error("[loja-criar-pedido] falha criar link de cartão:", linkErr.message);
      return json(500, { ok: false, error: "falha_criar_link_cartao" });
    }

    return json(200, {
      ok: true,
      reused: Boolean(r.reused),
      pedido_id: pedidoId,
      valor_final: Number(r.valor_final ?? 0),
      parcelas,
      cartao_token: cartaoToken,
    });
  } catch (err) {
    console.error("loja-criar-pedido error:", err);
    return json(500, { ok: false, error: "erro_interno" });
  }
});
