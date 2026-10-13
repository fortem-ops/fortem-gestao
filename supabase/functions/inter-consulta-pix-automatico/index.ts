// Consulta SOMENTE-LEITURA ao Inter (Pix Automático): só GET, nada é criado no banco.
import { onlyDigits, jsonResponse, corsHeaders, interFetch, admin, requireAdminOrCoord, consultarEscoposInter, tokenDiagnostico, getDiagnostico, infoDiagnostico } from "../_shared/inter.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  // Acesso: admin logado, ou chamada interna do banco com o segredo interno (mesmo padrão das rotinas agendadas).
  const segredo = req.headers.get("x-webhook-secret");
  let interno = false;
  if (segredo) {
    const { data } = await admin().rpc("get_webhook_secret");
    interno = typeof data === "string" && data.length > 0 && data === segredo;
  }
  if (!interno) {
    const auth = await requireAdminOrCoord(req);
    if ("error" in auth) return auth.error;
    const { data: isA } = await admin().rpc("is_admin", { _user_id: auth.userId });
    if (!isA) return jsonResponse({ error: "Forbidden" }, 403);
  }

  let modo = new URL(req.url).searchParams.get("modo");
  let corpo: any = {};
  if (req.method === "POST") { try { corpo = (await req.clone().json()) ?? {}; } catch { /* sem corpo */ } }
  modo = modo ?? corpo.modo ?? null;
  if (modo === "previa_payload") return jsonResponse(await previaPayload());
  if (modo === "registrar_webhooks" && corpo.confirmar === "REGISTRAR_AVISOS") return jsonResponse(await registrarWebhooks());
  if (modo === "descobrir_escopos") return jsonResponse(await descobrir(corpo));

  const fim = new Date();
  const ini = new Date(fim.getTime() - 3 * 24 * 3600 * 1000);
  const periodo = `inicio=${encodeURIComponent(ini.toISOString())}&fim=${encodeURIComponent(fim.toISOString())}`;
  const chave = Deno.env.get("INTER_PIX_CHAVE") ?? "";

  let escopos: string | null = null;
  let oauth = "ok";
  try {
    escopos = (await consultarEscoposInter()).escopos;
  } catch (e) {
    oauth = String((e as Error)?.message ?? e).slice(0, 200);
  }

  const consultas: Record<string, string> = {
    rec: `/pix/v2/rec?${periodo}`,
    solicrec: `/pix/v2/solicrec?${periodo}`,
    cobr: `/pix/v2/cobr?${periodo}`,
    webhookrec: `/pix/v2/webhookrec`,
    webhookcobr: `/pix/v2/webhookcobr`,
    webhook_pix: chave ? `/pix/v2/webhook/${encodeURIComponent(chave)}` : "",
  };
  const resultados: Record<string, unknown> = {};
  for (const [nome, path] of Object.entries(consultas)) {
    if (!path) { resultados[nome] = { status: null, motivo: "sem chave Pix" }; continue; }
    try {
      const { status, data } = await interFetch(path, { method: "GET" });
      const resumo: Record<string, unknown> = { status };
      if (status >= 400) resumo.erro = typeof data === "object" ? (data?.title ?? data?.detail ?? data?.message ?? null) : String(data).slice(0, 120);
      else if (data && typeof data === "object") {
        const lista = data.recs ?? data.solicitacoes ?? data.cobsr ?? data.cobs ?? null;
        if (Array.isArray(lista)) resumo.itens = lista.length;
        if (nome.startsWith("webhook")) resumo.webhook_cadastrado = !!data.webhookUrl;
      }
      resultados[nome] = resumo;
    } catch (e) {
      resultados[nome] = { status: null, erro: String((e as Error)?.message ?? e).slice(0, 160) };
    }
  }
  return jsonResponse({ somente_leitura: true, oauth, escopos, resultados });
});

const CANDIDATOS = ["rec.write","rec.read","solicrec.write","solicrec.read","cobr.write","cobr.read","payloadrec.write","payloadrec.read","webhookrec.write","webhookrec.read","webhookcobr.write","webhookcobr.read","webhook.write","webhook.read","cob.write","cob.read","cobv.write","cobv.read","pix.write","pix.read"];

function resumir(status: number, data: any) {
  const r: Record<string, unknown> = { status };
  if (status >= 400) r.erro = typeof data === "object" && data ? (data.title ?? data.detail ?? data.message ?? JSON.stringify(data).slice(0, 200)) : String(data ?? "").slice(0, 200);
  else if (data && typeof data === "object") {
    const lista = data.recs ?? data.solicitacoes ?? data.cobsr ?? data.cobs ?? data.webhooks ?? null;
    if (Array.isArray(lista)) r.itens = lista.length;
    if (data.webhookUrl !== undefined) {
      r.webhook_cadastrado = !!data.webhookUrl;
      try { const u = new URL(String(data.webhookUrl)); r.webhook_destino = u.host + u.pathname; } catch { /* sem url */ }
    }
    r.chaves = Object.keys(data).slice(0, 8);
  }
  return r;
}

async function descobrir(corpo: any) {
  const cred = corpo.credencial === "cob" ? "cob" : "inter";
  const info = await infoDiagnostico(cred);
  const escopos: Record<string, unknown> = {};
  const aceitos: string[] = Array.isArray(corpo.consultar_com) ? corpo.consultar_com : [];
  const testar: string[] = Array.isArray(corpo.consultar_com) ? [] : (Array.isArray(corpo.escopos) ? corpo.escopos.filter((x: string) => CANDIDATOS.includes(x)) : CANDIDATOS);
  const pausa = Math.min(Number(corpo.pausa_ms ?? 15000), 30000);
  for (const [i, sc] of testar.entries()) {
    if (i > 0) await new Promise((r) => setTimeout(r, pausa));
    try {
      const t = await tokenDiagnostico(sc, cred);
      escopos[sc] = t.ok ? { aceito: true, concedido: t.scope } : { aceito: false, status: t.status, erro: t.erro };
      if (t.ok) aceitos.push(sc);
    } catch (e) { escopos[sc] = { aceito: false, erro: String((e as Error)?.message ?? e).slice(0, 160) }; }
  }
  const consultas: Record<string, unknown> = {};
  let token_combinado: unknown = null;
  if (aceitos.length) {
    const t = await tokenDiagnostico(aceitos.join(" "), cred);
    token_combinado = { ok: t.ok, status: t.status, concedido: t.scope, erro: t.erro };
    if (t.ok && t.token) {
      const fim = new Date(); const ini = new Date(fim.getTime() - 30 * 24 * 3600 * 1000);
      const iso = (d: Date) => d.toISOString().replace(/\.\d{3}Z$/, "Z");
      const per = `inicio=${encodeURIComponent(iso(ini))}&fim=${encodeURIComponent(iso(fim))}`;
      const paths: Record<string, string> = {
        rec: `/pix/v2/rec?${per}`,
        rec_pagina: `/pix/v2/rec?${per}&paginacao.paginaAtual=0&paginacao.itensPorPagina=10`,
        solicrec: `/pix/v2/solicrec?${per}`,
        cobr: `/pix/v2/cobr?${per}`,
        webhookrec: `/pix/v2/webhookrec`,
        webhookcobr: `/pix/v2/webhookcobr`,
      };
      const chave = Deno.env.get("INTER_PIX_CHAVE") ?? "";
      if (chave) paths.webhook_pix = `/pix/v2/webhook/${encodeURIComponent(chave)}`;
      for (const [n, p] of Object.entries(paths)) {
        try {
          const a = await getDiagnostico(p, t.token, true, cred);
          consultas[n] = resumir(a.status, a.data);
          if (n === "rec") { const b = await getDiagnostico(p, t.token, false, cred); consultas["rec_sem_conta"] = resumir(b.status, b.data); }
        } catch (e) { consultas[n] = { erro: String((e as Error)?.message ?? e).slice(0, 160) }; }
      }
    }
  }
  return { somente_leitura: true, info, escopos, aceitos, token_combinado, consultas };
}

// Monta, SEM ENVIAR, o payload da recorrência de teste de R$ 1,00 do aluno NICOLAS TESTE (CPF mascarado).
const ALUNO_TESTE = "085acf57-2dbe-464d-9acc-e1b0f5b77032";
async function previaPayload() {
  const sup = admin();
  const { data: aluno } = await sup.from("alunos").select("id, nome").eq("id", ALUNO_TESTE).maybeSingle();
  const { data: cpfRaw } = await sup.rpc("fn_reveal_cpf_service", { p_aluno_id: ALUNO_TESTE });
  const cpf = onlyDigits(cpfRaw);
  const mask = cpf.length === 11 ? `***.***.**${cpf.slice(8, 9)}-${cpf.slice(9)}` : null;
  const payload = {
    vinculo: {
      objeto: "Plano mensal FORTEM",
      contrato: ALUNO_TESTE.replace(/-/g, "").substring(0, 35),
      devedor: { cpf: mask, nome: aluno?.nome ?? null },
    },
    calendario: { dataInicial: "2026-10-14", dataFinal: "2026-11-14", periodicidade: "MENSAL" },
    valor: { valorMinimoRecebedor: "1.00" },
    politicaRetentativa: "PERMITE_3R_7D",
  };
  return { enviado: false, aluno_encontrado: !!aluno, cpf_valido: cpf.length === 11, cpf_final: cpf.slice(-3), payload };
}

// Registra os três avisos (Pix comum, recorrência, cobrança) com ?token=. Nunca devolve o segredo.
function mascarar(url: unknown): string | null {
  if (!url) return null;
  try {
    const u = new URL(String(url));
    for (const k of [...u.searchParams.keys()]) u.searchParams.set(k, "***");
    return u.toString().replace(/%2A/g, "*");
  } catch { return "(url inválida)"; }
}
async function registrarWebhooks() {
  const segredo = Deno.env.get("PIX_WEBHOOK_SECRET") ?? "";
  const chave = Deno.env.get("INTER_PIX_CHAVE") ?? "";
  if (segredo.length < 16) return { erro: "PIX_WEBHOOK_SECRET ausente ou curto" };
  if (!chave) return { erro: "INTER_PIX_CHAVE ausente" };
  const destino = `${Deno.env.get("SUPABASE_URL")}/functions/v1/pix-webhook?token=${encodeURIComponent(segredo)}`;
  const alvos: [string, string][] = [
    ["webhook_pix", `/pix/v2/webhook/${encodeURIComponent(chave)}`],
    ["webhookrec", `/pix/v2/webhookrec`],
    ["webhookcobr", `/pix/v2/webhookcobr`],
  ];
  const antes: Record<string, unknown> = {};
  for (const [n, p] of alvos) {
    const r = await interFetch(p, { method: "GET" });
    antes[n] = { status: r.status, url: mascarar(r.data?.webhookUrl), criacao: r.data?.criacao ?? null };
  }
  const registro: Record<string, unknown> = {};
  for (const [n, p] of alvos) {
    if ((antes[n] as any)?.url && String(Deno.env.get("SUPABASE_URL")) && (antes[n] as any).url.includes("?token=")) { registro[n] = { status: "ja_registrado" }; continue; }
    const r = await interFetch(p, { method: "PUT", json: { webhookUrl: destino }, headers: { Accept: "*/*" } });
    registro[n] = { status: r.status, erro: r.status >= 400 ? (r.data?.title ?? r.data?.detail ?? String(r.raw).slice(0, 200)) : null };
    if (r.status >= 400) break; // para na ordem pedida
    await new Promise((x) => setTimeout(x, 1500));
  }
  const depois: Record<string, unknown> = {};
  for (const [n, p] of alvos) {
    const r = await interFetch(p, { method: "GET" });
    const url = r.data?.webhookUrl ? String(r.data.webhookUrl) : "";
    depois[n] = { status: r.status, url: mascarar(url), token_confere: url === destino };
  }
  return { credencial: "cob", antes, registro, depois };
}
