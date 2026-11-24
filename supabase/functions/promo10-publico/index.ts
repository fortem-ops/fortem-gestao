// Página pública Promoções 10 anos (/10anos/promocoes).
// Nunca registra CPF, código, token de sessão ou e-mail completo em log.
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { z } from "npm:zod@3";
import { avaliarTurnstile, passeValido } from "../_shared/planos-turnstile.ts";
import {
  cpfDigitosValidos,
  gerarCodigo,
  hashCodigo,
  mascararEmail,
  podeEnviarCodigo,
} from "../_shared/planos-verificacao.ts";
import {
  corpoEmailPromo10,
  ehEquipePorPapel,
  hashTokenSessao,
  podeReenviar,
  primeiroNome,
  promo10Encerrada,
} from "../_shared/promo10-publico.ts";

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const admin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

async function shaCurto(s: string): Promise<string> {
  const b = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return Array.from(new Uint8Array(b)).map((x) => x.toString(16).padStart(2, "0")).join("").slice(0, 24);
}

async function config(chave: string): Promise<unknown> {
  const { data } = await admin.from("sistema_config").select("valor").eq("chave", chave).maybeSingle();
  return data?.valor;
}

async function limite(chave: string, n: number): Promise<boolean> {
  const { data } = await admin.rpc("fn_planos_limite", { p_chave: chave, p_limite: n });
  return data === true;
}

async function passeOk(passe: unknown): Promise<boolean> {
  if ((await config("planos_turnstile_ativo")) !== true) return true;
  if (!passeValido(passe)) return false;
  const { data } = await admin
    .from("planos_turnstile_passes")
    .select("id")
    .eq("id", passe)
    .is("consumido_em", null)
    .gt("expira_em", new Date().toISOString())
    .maybeSingle();
  if (!data) return false;
  await admin.from("planos_turnstile_passes").update({ consumido_em: new Date().toISOString() }).eq("id", passe);
  return true;
}

async function logEvento(acao: string, mensagem: string, detalhes: Record<string, unknown>) {
  try {
    await admin.from("system_logs").insert({ modulo: "promo10-publico", acao, mensagem, payload: detalhes });
  } catch {
    // Log nunca bloqueia o fluxo
  }
}

async function enviarEmail(to: string, codigo: string, verificacaoId: string): Promise<void> {
  const apiKey = Deno.env.get("RESEND_API_KEY");
  const base = { verificacao_id: verificacaoId, email_mascarado: mascararEmail(to) };
  if (!apiKey) {
    await logEvento("falha_envio_email", "Envio do código sem chave do Resend", { ...base, status: null });
    throw new Error("email_indisponivel");
  }
  const { assunto, html } = corpoEmailPromo10(codigo);
  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: "FORTEM <nao-responda@soufortem.com.br>",
      to: [to],
      reply_to: "contatofortem@gmail.com",
      subject: assunto,
      html,
      text: html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim(),
    }),
  });
  if (!r.ok) {
    const corpo = await r.text().catch(() => "");
    let msg = "erro_resend";
    try {
      msg = String(JSON.parse(corpo)?.message ?? msg).slice(0, 300);
    } catch {
      // mantém mensagem genérica
    }
    await logEvento("falha_envio_email", `Resend recusou envio (HTTP ${r.status}): ${msg}`, { ...base, status: r.status });
    throw new Error("email_indisponivel");
  }
  const resendId = await r.json().then((j) => String(j?.id ?? "")).catch(() => "");
  await logEvento("codigo_enviado", "Resend aceitou o envio do código", {
    ...base,
    status: r.status,
    resend_id: resendId || null,
  });
}

async function listarInteressesAtivos(alunoId: string) {
  const { data } = await admin
    .from("promo10_interesses")
    .select("codigo_pedido, segmento, oferta, valor_promocional, valor_sem_desconto, detalhes, status")
    .eq("aluno_id", alunoId)
    .in("status", ["novo", "contatado"])
    .order("created_at", { ascending: true });
  return data ?? [];
}

async function carregarSessao(token: string) {
  const tokenHash = await hashTokenSessao(token);
  const { data } = await admin
    .from("promo10_sessoes")
    .select("aluno_id, expira_em")
    .eq("token_hash", tokenHash)
    .gt("expira_em", new Date().toISOString())
    .maybeSingle();
  return data ? { alunoId: data.aluno_id as string, tokenHash } : null;
}

const TurnstileSchema = z.object({ acao: z.literal("turnstile"), token: z.string().min(1).max(4096) });
const EnviarSchema = z.object({
  acao: z.literal("enviar"),
  cpf: z.string().min(11).max(20),
  turnstile_passe: z.string().nullable().optional(),
});
const ReenviarSchema = z.object({
  acao: z.literal("reenviar"),
  verificacao_id: z.string().uuid(),
});
const ValidarSchema = z.object({
  acao: z.literal("validar"),
  verificacao_id: z.string().uuid(),
  codigo: z.string().min(6).max(10),
});
const OfertasSchema = z.object({
  acao: z.literal("ofertas"),
  sessao: z.string().min(16).max(128),
});
const InteresseSchema = z.object({
  acao: z.literal("interesse"),
  sessao: z.string().min(16).max(128),
  tipo: z.enum(["principal", "corrida"]),
  chave: z.string().min(1).max(80),
});

function rotuloOfertaAviso(oferta: string, segmento: string, detalhes: Record<string, unknown>): string {
  const tipo = String(detalhes?.tipo ?? "");
  if (tipo === "upgrade" || oferta.startsWith("upgrade_")) {
    const atual = String(detalhes?.frequencia_atual ?? "");
    const dest = String(detalhes?.frequencia_destino ?? oferta.replace("upgrade_", ""));
    const f = (v: string) => (v === "livre" ? "Livre" : v);
    return atual ? `Upgrade ${f(atual)} → ${f(dest)}` : `Upgrade → ${f(dest)}`;
  }
  if (tipo === "semestral_agregadora") {
    const nome = String(detalhes?.nome ?? oferta).replace(/\s*-\s*(Wellhub|TotalPass)$/i, "").trim();
    const agr = String(detalhes?.agregadora ?? segmento) === "totalpass" ? "TotalPass" : "Wellhub";
    return `${nome} ${agr}`;
  }
  if (tipo === "ex_aluno") {
    const fam = String(detalhes?.familia ?? "") === "pro_2027" ? "Pro" : "Power";
    const freq = String(detalhes?.frequencia ?? "");
    return `${fam} ${freq === "livre" ? "Livre" : freq} anual (ex-aluno)`;
  }
  if (tipo === "corrida_6_mais_1" || oferta === "corrida_6_mais_1") {
    const cat = String(detalhes?.nome_catalogo ?? "").replace(/^Corrida\s*[-–]\s*/i, "").trim();
    return cat ? `Corrida 6+1 · tabela ${cat}` : "Corrida 6+1";
  }
  return oferta;
}

function moedaBr(valor: number): string {
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

/** Aviso interno aos admins via notificacoes (sem CPF nem e-mail). Falha não impede o registro. */
async function avisarAdminsInteresse(
  alunoId: string,
  res: { codigo_pedido: string; oferta: string; segmento: string; valor_promocional: number; detalhes?: Record<string, unknown> },
) {
  try {
    const [{ data: aluno }, { data: roles }] = await Promise.all([
      admin.from("alunos").select("nome").eq("id", alunoId).maybeSingle(),
      admin.from("user_roles").select("user_id").eq("role", "admin"),
    ]);
    const ids = [...new Set((roles ?? []).map((r: { user_id: string }) => r.user_id))];
    if (!ids.length) return;

    const primeiro = primeiroNome(aluno?.nome);
    const ofertaLegivel = rotuloOfertaAviso(res.oferta, res.segmento, res.detalhes ?? {});
    const titulo = `Promoções 10 anos: novo interesse ${res.codigo_pedido} — ${primeiro} — ${ofertaLegivel} — ${moedaBr(Number(res.valor_promocional))}`;

    const { data: notif } = await admin
      .from("notificacoes")
      .insert({
        titulo,
        descricao: `Novo interesse registrado na campanha de 10 anos (${res.codigo_pedido}). Acesse Comercial > Promoções 10 anos para acompanhar.`,
        categoria: "comercial",
        prioridade: "media",
        tipo: "simples",
        criado_por: ids[0],
      })
      .select("id")
      .single();

    if (notif?.id) {
      await admin
        .from("notificacao_destinatarios")
        .insert(ids.map((usuario_id) => ({ notificacao_id: notif.id, usuario_id })));
    }
  } catch {
    await logEvento("falha_aviso_interno", "Não foi possível criar aviso interno do interesse", {
      codigo_pedido: res.codigo_pedido,
    });
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json(405, { error: "method_not_allowed" });

  const ip = (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || "sem-ip";
  const body = await req.json().catch(() => ({}));

  try {
    if (body?.acao === "turnstile_config") {
      const ativo = (await config("planos_turnstile_ativo")) === true;
      return json(200, {
        encerrada: promo10Encerrada(),
        ativo,
        site_key: ativo ? await config("planos_turnstile_site_key") : null,
      });
    }

    if (promo10Encerrada()) {
      return json(200, { ok: false, encerrada: true, motivo: "encerrada" });
    }

    if (body?.acao === "turnstile") {
      const p = TurnstileSchema.safeParse(body);
      if (!p.success) return json(400, { ok: false });
      if (!(await limite(`p10-ts:${ip}`, 30))) return json(200, { ok: false });
      const r = await avaliarTurnstile(
        await config("planos_turnstile_ativo"),
        Deno.env.get("TURNSTILE_SECRET_KEY"),
        p.data.token,
        ip,
      );
      if (r === "livre") return json(200, { ok: true, passe: null });
      if (r !== "ok") return json(200, { ok: false });
      const { data, error } = await admin.from("planos_turnstile_passes").insert({}).select("id").single();
      return json(200, error ? { ok: false } : { ok: true, passe: data.id });
    }

    if (body?.acao === "enviar") {
      const inicio = Date.now();
      const p = EnviarSchema.safeParse(body);
      if (!p.success) return json(400, { enviado: false, motivo: "invalido" });
      const cpf = p.data.cpf.replace(/\D/g, "");
      if (!cpfDigitosValidos(cpf)) return json(200, { enviado: false, motivo: "cpf_invalido" });
      if (!(await passeOk(p.data.turnstile_passe))) return json(200, { enviado: false, motivo: "captcha" });
      if (!(await limite(`p10-ip:${ip}`, 10)) || !(await limite(`p10-cpf:${await shaCurto(cpf)}`, 5))) {
        return json(200, { enviado: false, motivo: "limitado" });
      }

      let verificacaoId: string = crypto.randomUUID();
      let emailMascarado: string | null = null;

      try {
        const { data: alunoId } = await admin.rpc("fn_planos_resolver", { p_tipo: "cpf", p_valor: cpf });
        if (alunoId) {
          const { data: aluno } = await admin
            .from("alunos")
            .select("id, email, is_equipe, user_id")
            .eq("id", alunoId)
            .maybeSingle();

          let isStaff = Boolean(aluno?.is_equipe);
          if (!isStaff && aluno?.user_id) {
            const { data: roles } = await admin
              .from("user_roles")
              .select("role")
              .eq("user_id", aluno.user_id);
            isStaff = ehEquipePorPapel((roles ?? []).map((r) => String(r.role)));
          }

          const email = (aluno?.email ?? "").trim().toLowerCase();
          const emailValido = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email);
          const liberado = (await config("promo10_codigo_email_livre")) === true;
          const permitido = podeEnviarCodigo(alunoId as string, liberado, await config("promo10_codigo_email_teste_ids"));

          if (!isStaff && emailValido && permitido && (await limite(`p10-email:${await shaCurto(email)}`, 5))) {
            await admin
              .from("promo10_verificacoes")
              .update({ expira_em: new Date().toISOString() })
              .eq("aluno_id", alunoId)
              .is("validado_em", null);

            const id = crypto.randomUUID();
            const codigo = gerarCodigo();
            const { error } = await admin.from("promo10_verificacoes").insert({
              id,
              aluno_id: alunoId,
              email,
              codigo_hash: await hashCodigo(id, codigo),
              expira_em: new Date(Date.now() + 10 * 60_000).toISOString(),
            });
            if (!error) {
              await enviarEmail(email, codigo, id);
              verificacaoId = id;
              emailMascarado = mascararEmail(email);
            }
          }
        }
      } catch {
        // Resposta uniforme para não distinguir cadastro válido de inválido
      }

      const espera = 700 + Math.floor(Math.random() * 300) - (Date.now() - inicio);
      if (espera > 0) await new Promise((ok) => setTimeout(ok, espera));
      return json(200, { enviado: true, verificacao_id: verificacaoId, email_mascarado: emailMascarado });
    }

    if (body?.acao === "reenviar") {
      const p = ReenviarSchema.safeParse(body);
      if (!p.success) return json(400, { ok: false, motivo: "invalido" });
      if (!(await limite(`p10-reenv-ip:${ip}`, 10))) return json(200, { ok: false, motivo: "limitado" });

      const { data: v } = await admin
        .from("promo10_verificacoes")
        .select("id, aluno_id, email, enviado_em, validado_em")
        .eq("id", p.data.verificacao_id)
        .maybeSingle();

      if (!v || v.validado_em) {
        return json(200, { ok: true, verificacao_id: p.data.verificacao_id, email_mascarado: null });
      }

      const check = podeReenviar(v.enviado_em);
      if (!check.ok) {
        return json(200, { ok: false, motivo: "aguarde", aguardar_segundos: check.aguardarSegundos });
      }

      if (!(await limite(`p10-email:${await shaCurto(v.email)}`, 5))) {
        return json(200, { ok: false, motivo: "limitado" });
      }

      await admin
        .from("promo10_verificacoes")
        .update({ expira_em: new Date().toISOString() })
        .eq("aluno_id", v.aluno_id)
        .is("validado_em", null);

      const novoId = crypto.randomUUID();
      const codigo = gerarCodigo();
      const { error } = await admin.from("promo10_verificacoes").insert({
        id: novoId,
        aluno_id: v.aluno_id,
        email: v.email,
        codigo_hash: await hashCodigo(novoId, codigo),
        expira_em: new Date(Date.now() + 10 * 60_000).toISOString(),
      });
      if (error) return json(200, { ok: false, motivo: "indisponivel" });

      await enviarEmail(v.email, codigo, novoId);
      return json(200, { ok: true, verificacao_id: novoId, email_mascarado: mascararEmail(v.email) });
    }

    if (body?.acao === "validar") {
      const p = ValidarSchema.safeParse(body);
      if (!p.success) return json(400, { ok: false, motivo: "errado" });
      const codigo = p.data.codigo.replace(/\D/g, "");
      if (codigo.length !== 6) return json(200, { ok: false, motivo: "errado" });
      if (!(await limite(`p10-val-ip:${ip}`, 40))) return json(200, { ok: false, motivo: "limitado" });

      const token = `${crypto.randomUUID()}${crypto.randomUUID()}`.replace(/-/g, "");
      const tokenHash = await hashTokenSessao(token);
      const { data: res } = await admin.rpc("fn_promo10_codigo_validar", {
        p_id: p.data.verificacao_id,
        p_hash: await hashCodigo(p.data.verificacao_id, codigo),
        p_token_hash: tokenHash,
      });

      if (!res?.ok) {
        const motivo = !res || res.motivo === "invalido" ? "errado" : res.motivo;
        return json(200, {
          ok: false,
          motivo,
          ...(typeof res?.restantes === "number" ? { restantes: res.restantes } : {}),
        });
      }

      const alunoId = res.aluno_id as string;
      const [{ data: aluno }, { data: ofertas }, interesses] = await Promise.all([
        admin.from("alunos").select("nome").eq("id", alunoId).maybeSingle(),
        admin.rpc("fn_promo10_ofertas", { p_aluno_id: alunoId }),
        listarInteressesAtivos(alunoId),
      ]);

      return json(200, {
        ok: true,
        sessao: token,
        primeiro_nome: primeiroNome(aluno?.nome),
        ofertas,
        interesses,
      });
    }

    if (body?.acao === "ofertas") {
      const p = OfertasSchema.safeParse(body);
      if (!p.success) return json(400, { ok: false, motivo: "sessao_invalida" });
      const sessao = await carregarSessao(p.data.sessao);
      if (!sessao) return json(200, { ok: false, motivo: "sessao_invalida" });

      const [{ data: aluno }, { data: ofertas }, interesses] = await Promise.all([
        admin.from("alunos").select("nome").eq("id", sessao.alunoId).maybeSingle(),
        admin.rpc("fn_promo10_ofertas", { p_aluno_id: sessao.alunoId }),
        listarInteressesAtivos(sessao.alunoId),
      ]);

      return json(200, {
        ok: true,
        primeiro_nome: primeiroNome(aluno?.nome),
        ofertas,
        interesses,
      });
    }

    if (body?.acao === "interesse") {
      const p = InteresseSchema.safeParse(body);
      if (!p.success) return json(400, { ok: false, motivo: "oferta_invalida" });
      if (!(await limite(`p10-int-ip:${ip}`, 30))) return json(200, { ok: false, motivo: "limitado" });

      const tokenHash = await hashTokenSessao(p.data.sessao);
      const { data: res, error } = await admin.rpc("fn_promo10_registrar_interesse", {
        p_token_hash: tokenHash,
        p_tipo: p.data.tipo,
        p_chave: p.data.chave,
      });
      if (error || !res) {
        await logEvento("falha_interesse", "Erro ao registrar interesse", { tipo: p.data.tipo });
        return json(200, { ok: false, motivo: "indisponivel" });
      }
      if (res.ok) {
        await logEvento("interesse_registrado", "Interesse registrado", {
          codigo_pedido: res.codigo_pedido,
          oferta: res.oferta,
        });
        if (res.acao === "criado" || res.acao === "substituido") {
          const sessao = await carregarSessao(p.data.sessao);
          if (sessao) {
            await avisarAdminsInteresse(sessao.alunoId, res);
          }
        }
      }
      return json(200, res);
    }

    return json(400, { error: "acao_invalida" });
  } catch (e) {
    console.error("[promo10-publico] falha", (e as Error)?.message ?? "erro");
    return json(200, { ok: false, enviado: false, motivo: "indisponivel" });
  }
});