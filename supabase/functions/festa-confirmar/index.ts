// Festa 10 anos (/10anos): confirmação pública, voucher, status e PIX.
// Toda regra de valor, prazo, limite e voucher é decidida aqui; o navegador nunca define o total.
import { createClient } from "npm:@supabase/supabase-js@2";
import { z } from "npm:zod@3";
import { corsHeaders, jsonResponse, admin } from "../_shared/inter.ts";
import { FESTA_PRAZO_FIM, criarPixFesta, conferirPixFesta, cancelarPixFesta } from "../_shared/festa-pix.ts";
import { totalFesta } from "../_shared/festa-valor.ts";
const LIMITE_ACOMP = 3;

const consumo = z.array(z.enum(["nao_alcoolico", "chope", "drink"])).max(3).default([]);
const intol = z.array(z.enum(["lactose", "gluten"])).max(2).default([]);
const nome = z.string().trim().min(2).max(120);

const ConfirmarSchema = z.object({
  acao: z.literal("confirmar"),
  nome: z.string().trim().min(3).max(120),
  whatsapp: z.string().transform((v) => v.replace(/\D/g, "").replace(/^55(?=\d{11}$)/, "")).refine((v) => /^[1-9]{2}9\d{8}$/.test(v), "whatsapp"),
  email: z.string().trim().max(254).refine((v) => v === "" || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)).default(""),
  vinculo: z.enum(["aluno_atual", "ex_aluno", "amigo_fortem"]),
  consumo, intolerancias: intol,
  acompanhantes: z.array(z.object({ nome, consumo, intolerancias: intol })).max(LIMITE_ACOMP).default([]),
  voucher: z.string().trim().max(40).default(""),
});

async function sha256(s: string) {
  const b = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return Array.from(new Uint8Array(b), (x) => x.toString(16).padStart(2, "0")).join("");
}
const tokenAleatorio = () => Array.from(crypto.getRandomValues(new Uint8Array(24)), (x) => x.toString(16).padStart(2, "0")).join("");

async function limitar(sup: any, req: Request, acao: string, max: number, janelaMin: number) {
  const ip = (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || "sem-ip";
  const chave = `${acao}:${await sha256(ip)}`;
  const desde = new Date(Date.now() - janelaMin * 60_000).toISOString();
  const { count } = await sup.from("festa_rate_limit").select("chave", { count: "exact", head: true }).eq("chave", chave).gte("criado_em", desde);
  if ((count ?? 0) >= max) return false;
  await sup.from("festa_rate_limit").insert({ chave });
  return true;
}

async function voucherValido(sup: any, codigo: string) {
  if (!codigo) return null;
  const { data } = await sup.from("festa_vouchers").select("id, desconto_pct, usos, usos_max, ativo")
    .eq("codigo_hash", await sha256(codigo.trim().toLowerCase())).maybeSingle();
  if (!data?.ativo || data.desconto_pct !== 100) return null;
  if (data.usos_max != null && data.usos >= data.usos_max) return null;
  return data;
}

async function pessoasDe(sup: any, id: string) {
  const { count } = await sup.from("festa_acompanhantes").select("id", { count: "exact", head: true }).eq("confirmacao_id", id);
  return 1 + (count ?? 0);
}

function publico(c: any, pessoas: number, acesso?: string, existente = false) {
  const pend = c.status === "aguardando_pagamento";
  return {
    status: c.status, pessoas, total_centavos: c.total_centavos, existente,
    ...(acesso ? { acesso } : {}),
    pix: pend && c.pix_copia_e_cola ? { copia_e_cola: c.pix_copia_e_cola, expira_em: c.pix_expira_em } : null,
  };
}

async function gestao(req: Request) {
  const h = req.headers.get("Authorization") ?? "";
  if (!h.startsWith("Bearer ")) return null;
  const u = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: h } } });
  const { data } = await u.auth.getClaims(h.slice(7));
  const sub = data?.claims?.sub as string | undefined;
  if (!sub) return null;
  const { data: ok } = await admin().rpc("fn_festa_gestao", { _uid: sub });
  return ok ? sub : null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ erro: "Método não permitido." }, 405);
  const sup = admin();
  const body = await req.json().catch(() => null);
  const acao = body?.acao;

  try {
    if (acao === "voucher") {
      if (!(await limitar(sup, req, "voucher", 10, 60))) return jsonResponse({ erro: "Muitas tentativas. Aguarde alguns minutos." }, 429);
      const v = await voucherValido(sup, String(body?.codigo ?? ""));
      return jsonResponse({ valido: !!v });
    }

    if (acao === "status" || acao === "novo_pix") {
      const acesso = String(body?.acesso ?? "");
      if (acesso.length < 32) return jsonResponse({ erro: "Confirmação não encontrada." }, 404);
      const { data: c } = await sup.from("festa_confirmacoes").select("*").eq("acesso_hash", await sha256(acesso)).maybeSingle();
      if (!c) return jsonResponse({ erro: "Confirmação não encontrada." }, 404);
      let atual = c;
      if (c.status === "aguardando_pagamento" && c.txid && Date.now() - new Date(c.atualizado_em).getTime() > 20_000) {
        await sup.from("festa_confirmacoes").update({ atualizado_em: new Date().toISOString() }).eq("id", c.id);
        await conferirPixFesta(sup, c.txid);
        atual = (await sup.from("festa_confirmacoes").select("*").eq("id", c.id).single()).data ?? c;
      }
      if (acao === "novo_pix" && atual.status === "aguardando_pagamento") {
        if (!(await limitar(sup, req, "novo_pix", 5, 60))) return jsonResponse({ erro: "Muitas tentativas. Aguarde alguns minutos." }, 429);
        const vencido = !atual.pix_expira_em || new Date(atual.pix_expira_em).getTime() < Date.now();
        if (!atual.pix_copia_e_cola || vencido) {
          const r = await criarPixFesta(sup, atual);
          if (!r.ok) return jsonResponse({ erro: "Não foi possível gerar o código PIX agora. Tente novamente em alguns minutos." }, 502);
          atual = { ...atual, pix_copia_e_cola: r.copia_e_cola, pix_expira_em: r.expira_em };
        }
      }
      return jsonResponse(publico(atual, await pessoasDe(sup, c.id)));
    }

    if (acao === "pix_equipe") {
      const uid = await gestao(req);
      if (!uid) return jsonResponse({ erro: "Sem permissão." }, 403);
      const id = String(body?.id ?? "");
      const { data: c } = await sup.from("festa_confirmacoes").select("*").eq("id", id).maybeSingle();
      if (!c || c.status !== "aguardando_pagamento" || c.total_centavos <= 0) return jsonResponse({ erro: "Confirmação sem pagamento pendente." }, 400);
      const vencido = !c.pix_expira_em || new Date(c.pix_expira_em).getTime() < Date.now();
      if (c.pix_copia_e_cola && !vencido) return jsonResponse({ copia_e_cola: c.pix_copia_e_cola });
      const r = await criarPixFesta(sup, c);
      if (!r.ok) return jsonResponse({ erro: "Não foi possível gerar o código PIX agora." }, 502);
      await sup.from("festa_eventos").insert({ confirmacao_id: c.id, acao: "pix_gerado_equipe", usuario_id: uid });
      return jsonResponse({ copia_e_cola: r.copia_e_cola });
    }

    if (acao === "cancelar_equipe") {
      const uid = await gestao(req);
      if (!uid) return jsonResponse({ erro: "Sem permissão." }, 403);
      const { data: c } = await sup.from("festa_confirmacoes").select("*").eq("id", String(body?.id ?? "")).maybeSingle();
      if (!c) return jsonResponse({ erro: "Confirmação não encontrada." }, 404);
      const novoQr = body?.novo_qr === true;
      if (c.status === "aguardando_pagamento" && c.txid) {
        const r = await cancelarPixFesta(sup, c, uid);
        if (r.pago) return jsonResponse({ erro: "Este PIX já foi pago. A presença foi confirmada." }, 409);
        if (!r.ok) return jsonResponse({ erro: "Não foi possível cancelar o PIX no banco agora. Nada foi alterado." }, 502);
      }
      if (novoQr) {
        if (c.status !== "aguardando_pagamento" || c.total_centavos <= 0) return jsonResponse({ erro: "Confirmação sem pagamento pendente." }, 400);
        const r = await criarPixFesta(sup, { ...c, txid: null });
        if (!r.ok) return jsonResponse({ erro: "PIX antigo cancelado, mas não foi possível gerar o novo agora." }, 502);
        await sup.from("festa_eventos").insert({ confirmacao_id: c.id, acao: "pix_gerado_equipe", usuario_id: uid });
        return jsonResponse({ ok: true, copia_e_cola: r.copia_e_cola });
      }
      if (c.status !== "cancelado") {
        await sup.from("festa_confirmacoes").update({ status: "cancelado" }).eq("id", c.id);
        await sup.from("festa_eventos").insert({ confirmacao_id: c.id, acao: "cancelado_equipe", usuario_id: uid });
      }
      return jsonResponse({ ok: true });
    }

    if (acao === "confirmar") {
      if (Date.now() > FESTA_PRAZO_FIM.getTime()) return jsonResponse({ erro: "As confirmações foram encerradas." }, 410);
      const p = ConfirmarSchema.safeParse(body);
      if (!p.success) return jsonResponse({ erro: "Confira os dados informados." }, 400);
      const d = p.data;
      if (!(await limitar(sup, req, "confirmar", 6, 60))) return jsonResponse({ erro: "Muitas tentativas. Aguarde alguns minutos." }, 429);
      const whatsapp = `55${d.whatsapp}`;

      const devolverExistente = async () => {
        const { data: ex } = await sup.from("festa_confirmacoes").select("*").eq("whatsapp", whatsapp).neq("status", "cancelado").maybeSingle();
        if (!ex) return null;
        const acesso = tokenAleatorio();
        await sup.from("festa_confirmacoes").update({ acesso_hash: await sha256(acesso) }).eq("id", ex.id);
        return jsonResponse(publico(ex, await pessoasDe(sup, ex.id), acesso, true));
      };
      const ja = await devolverExistente();
      if (ja) return ja;

      const v = await voucherValido(sup, d.voucher);
      if (d.voucher && !v) return jsonResponse({ erro: "Voucher inválido." }, 400);
      const total = totalFesta(d.acompanhantes.length, !!v);
      const acesso = tokenAleatorio();
      const { data: c, error } = await sup.from("festa_confirmacoes").insert({
        nome: d.nome, whatsapp, email: d.email || null, vinculo: d.vinculo,
        consumo: d.consumo, intolerancias: d.intolerancias,
        acompanhantes: d.acompanhantes.map((a) => a.nome), total_pessoas: 1 + d.acompanhantes.length,
        status: v ? "isento" : "aguardando_pagamento", origem: "site",
        voucher_id: v?.id ?? null, total_centavos: total, acesso_hash: await sha256(acesso),
      }).select("*").single();
      if (error) {
        if (error.code === "23505") { const ex = await devolverExistente(); if (ex) return ex; }
        console.error("[festa-confirmar] insert", error.message);
        return jsonResponse({ erro: "Não foi possível confirmar agora. Tente novamente em alguns instantes." }, 500);
      }
      if (d.acompanhantes.length) {
        await sup.from("festa_acompanhantes").insert(d.acompanhantes.map((a) => ({ confirmacao_id: c.id, ...a })));
      }
      await sup.from("festa_eventos").insert({ confirmacao_id: c.id, acao: v ? "confirmado_voucher" : "criado_site" });
      if (v) await sup.from("festa_vouchers").update({ usos: v.usos + 1 }).eq("id", v.id);

      let atual = c;
      if (!v) {
        const r = await criarPixFesta(sup, c);
        if (r.ok) atual = { ...c, pix_copia_e_cola: r.copia_e_cola, pix_expira_em: r.expira_em };
      }
      return jsonResponse(publico(atual, 1 + d.acompanhantes.length, acesso));
    }

    return jsonResponse({ erro: "Ação inválida." }, 400);
  } catch (e) {
    console.error("[festa-confirmar]", String((e as Error)?.message ?? e));
    return jsonResponse({ erro: "Não foi possível concluir agora. Tente novamente em alguns instantes." }, 500);
  }
});
