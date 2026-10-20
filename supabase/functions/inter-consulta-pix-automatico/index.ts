// Consulta ao Inter (Pix Automático). Modos de escrita só com confirmação explícita; teste_3f_criar é temporário e só interno.
import { criarRecorrencia, solicitarConfirmacao, mascararCpf } from "../_shared/pix-rec.ts";
import { genTxid, onlyDigits, jsonResponse, corsHeaders, interFetch, admin, requireAdminOrCoord, consultarEscoposInter, tokenDiagnostico, getDiagnostico, infoDiagnostico } from "../_shared/inter.ts";

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
  if (modo === "testar_webhook_token") {
    const seg = Deno.env.get("PIX_WEBHOOK_SECRET") ?? "";
    const r = await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/pix-webhook?token=${encodeURIComponent(seg)}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ pix: [] }) });
    return jsonResponse({ status: r.status, corpo: (await r.text()).slice(0, 200) });
  }
  // TEMPORÁRIO (teste 3F): só via segredo interno, parâmetros fixos, nunca cria duas.
  if (modo === "teste_3f_criar") {
    if (!interno || corpo.confirmar !== "TESTE_3F") return jsonResponse({ error: "Forbidden" }, 403);
    return jsonResponse(await teste3fCriar());
  }
  if (modo === "teste_3f_qr") {
    if (!interno || corpo.confirmar !== "TESTE_3F_QR") return jsonResponse({ error: "Forbidden" }, 403);
    return jsonResponse(await teste3fQr());
  }
  // TEMPORÁRIO (teste 3F): UMA cobrança de R$ 1,00 com parâmetros fixos; recusa se já existir cobrança da idRec.
  if (modo === "teste_3f_cobr") {
    if (!interno || corpo.confirmar !== "TESTE_3F_COBR") return jsonResponse({ error: "Forbidden" }, 403);
    return jsonResponse(await teste3fCobr());
  }
  // Leitura de uma recorrência de teste; com atualizar=true grava status interno conforme o GET (conferência manual).
  if (modo === "conferir_rec_3f") {
    if (!interno || corpo.confirmar !== "CONFERIR_3F") return jsonResponse({ error: "Forbidden" }, 403);
    return jsonResponse(await conferirRec3f(!!corpo.atualizar));
  }
  // TEMPORÁRIO (teste 3F jornada 3): só chamada interna, NICOLAS TESTE, R$ 1,00, UMA tentativa.
  if (modo === "teste_3f_j3") {
    if (!interno || corpo.confirmar !== "TESTE_3F_J3") return jsonResponse({ error: "Forbidden" }, 403);
    return jsonResponse(await teste3fJornada3());
  }
  if (modo === "conferir_3f_j3") {
    if (!interno || corpo.confirmar !== "CONFERIR_3F_J3") return jsonResponse({ error: "Forbidden" }, 403);
    return jsonResponse(await conferir3fJornada3());
  }
  // Teste do pix-webhook com avisos simulados FIXOS (sem cobrança): rec de teste APROVADA e ids inexistentes.
  if (modo === "testar_webhook_avisos") {
    if (!interno) return jsonResponse({ error: "Forbidden" }, 403);
    const seg = Deno.env.get("PIX_WEBHOOK_SECRET") ?? "";
    const url = `${Deno.env.get("SUPABASE_URL")}/functions/v1/pix-webhook?token=${encodeURIComponent(seg)}`;
    const corpos: Record<string, unknown> = {
      b_rec_aprovada: { recs: [{ idRec: "RR0041696820261013xm6a6FzsywP", status: "APROVADA", ativacao: { tipoJornada: "JORNADA_2" } }] },
      c_inexistentes: { recs: [{ idRec: "RRTESTE3FINEXISTENTE", status: "APROVADA" }], cobrs: [{ txid: "TESTE3FINEXISTENTE000000000", idRec: "RRTESTE3FINEXISTENTE", status: "CONCLUIDA" }] },
    };
    const out: Record<string, unknown> = {};
    for (const [k, b] of Object.entries(corpos)) {
      const r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(b) });
      out[k] = { status: r.status, corpo: (await r.text()).slice(0, 200) };
    }
    return jsonResponse(out);
  }
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

const CANDIDATOS = ["rec.write","rec.read","solicrec.write","solicrec.read","cobr.write","cobr.read","payloadrec.write","payloadrec.read","payloadlocationrec.write","payloadlocationrec.read","payloadlocrec.write","payloadlocrec.read","webhookrec.write","webhookrec.read","webhookcobr.write","webhookcobr.read","webhook.write","webhook.read","cob.write","cob.read","cobv.write","cobv.read","pix.write","pix.read"];

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

const TESTE_3F = { aluno_id: "085acf57-2dbe-464d-9acc-e1b0f5b77032", valor: 1, data_inicio: "2026-10-14", data_fim: "2026-11-14", objeto: "Teste Pix Automatico FORTEM", teste: true };

async function teste3fCriar() {
  const sup = admin();
  const log = (acao: string, payload: unknown) => sup.from("system_logs").insert({ modulo: "pix-automatico-teste-3f", acao, mensagem: acao, payload: mascararCpf(payload) });
  const { count } = await sup.from("pix_recorrencias").select("id", { count: "exact", head: true }).eq("aluno_id", TESTE_3F.aluno_id);
  if ((count ?? 0) > 0) { await log("recusado_ja_existe", { count }); return { ok: false, erro: "Já existe recorrência para o aluno de teste; nada criado." }; }
  const rec = await criarRecorrencia(sup, TESTE_3F);
  await log("rec", rec);
  if (!rec.ok) return mascararCpf({ etapa: "rec", ...rec });
  const sol = await solicitarConfirmacao(sup, rec.idRec as string);
  await log("solicrec", sol);
  const { data: banco } = await sup.from("pix_recorrencias").select("id_rec, id_solic_rec, status, valor_minimo, data_inicio, data_fim").eq("id_rec", rec.idRec).maybeSingle();
  return mascararCpf({ rec: { status: rec.status, idRec: rec.idRec, statusInter: rec.statusInter }, solicrec: sol.ok ? { status: sol.status, idSolicRec: sol.idSolicRec, statusInter: sol.statusInter, expiracao: sol.expiracao } : sol, banco });
}

const TESTE_3F_QR = { ...TESTE_3F, data_inicio: "2026-10-13", data_fim: "2026-11-13" };
const REC_3F_ANTIGA = "RR0041696820261013GHAjHW1tmv3";

// Jornada 2: cancela a rec de teste antiga, cria locrec, nova rec com loc e lê o copia e cola. Uma tentativa por etapa.
async function teste3fQr() {
  const sup = admin();
  const log = (acao: string, payload: unknown) => sup.from("system_logs").insert({ modulo: "pix-automatico-teste-3f", acao, mensagem: acao, payload: mascararCpf(payload) });
  const out: Record<string, unknown> = {};

  const { data: antiga } = await sup.from("pix_recorrencias").select("status, raw_response").eq("id_rec", REC_3F_ANTIGA).maybeSingle();
  if (antiga && antiga.status !== "CANCELADA") {
    const c = await interFetch(`/pix/v2/rec/${REC_3F_ANTIGA}`, { method: "PATCH", json: { status: "CANCELADA" } });
    out.cancelar = { http: c.status, statusInter: c.data?.status ?? null, erro: c.status >= 300 ? c.data : undefined };
    await log("cancelar_antiga", out.cancelar);
    if (c.status >= 300) return mascararCpf(out);
    await sup.from("pix_recorrencias").update({ status: "CANCELADA", motivo_cancelamento: "teste 3F" }).eq("id_rec", REC_3F_ANTIGA);
  }

  // Trava: só segue se todas as recs do aluno forem CANCELADA com marca teste_3F.
  const { data: existentes } = await sup.from("pix_recorrencias").select("status, raw_response").eq("aluno_id", TESTE_3F.aluno_id);
  const bloqueia = (existentes ?? []).some((r: any) => !(r.status === "CANCELADA" && r.raw_response?._marcador === "teste_3F"));
  if (bloqueia) { await log("recusado_ja_existe", { n: existentes?.length }); return { ...out, ok: false, erro: "Já existe recorrência ativa para o aluno de teste; nada criado." }; }

  const l = await interFetch("/pix/v2/locrec", { method: "POST" });
  out.locrec = { http: l.status, id: l.data?.id ?? null, location: l.data?.location ?? null, erro: l.status >= 300 ? l.data : undefined };
  await log("locrec", out.locrec);
  if (l.status >= 300 || l.data?.id == null) return mascararCpf(out);

  const rec = await criarRecorrencia(sup, { ...TESTE_3F_QR, loc: Number(l.data.id) });
  out.rec = { http: rec.status, idRec: rec.idRec ?? null, statusInter: rec.statusInter ?? null, erro: rec.ok ? undefined : rec.detail ?? rec.erro };
  await log("rec_qr", out.rec);
  if (!rec.ok) return mascararCpf(out);

  const g = await interFetch(`/pix/v2/rec/${rec.idRec}`, { method: "GET" });
  const copiaECola = g.data?.dadosQR?.pixCopiaECola ?? null;
  out.get = { http: g.status, statusInter: g.data?.status ?? null, jornada: g.data?.dadosQR?.jornada ?? null, chaves: g.data ? Object.keys(g.data) : null, erro: g.status >= 300 ? g.data : undefined };
  await log("get_rec_qr", out.get);
  if (copiaECola) {
    await sup.from("pix_recorrencias").update({ raw_response: { ...(rec.recorrencia as any)?.raw_response, loc: l.data, dadosQR: g.data?.dadosQR } }).eq("id_rec", rec.idRec);
  }
  return { ...(mascararCpf(out) as object), pixCopiaECola: copiaECola };
}

const REC_3F_QR = "RR0041696820261013xm6a6FzsywP";
async function conferirRec3f(atualizar: boolean) {
  const sup = admin();
  const g = await interFetch(`/pix/v2/rec/${REC_3F_QR}`, { method: "GET" });
  const d = g.data ?? {};
  const out: any = { http: g.status, status: d.status ?? null, ativacao: d.ativacao ?? null, solicitacao: d.solicitacao ?? null, atualizacao: d.atualizacao ?? null, jornada: d.dadosQR?.jornada ?? null, erro: g.status >= 300 ? d : undefined };
  const wh = await interFetch("/pix/v2/webhookrec", { method: "GET" });
  out.webhookrec = { http: wh.status, url: String(wh.data?.webhookUrl ?? "").replace(/token=[^&]+/, "token=***"), criacao: wh.data?.criacao ?? null };
  const mapa: Record<string, string> = { APROVADA: "AUTORIZADA", REJEITADA: "REJEITADA", CANCELADA: "CANCELADA", EXPIRADA: "EXPIRADA" };
  if (atualizar && g.status === 200 && mapa[d.status]) {
    const { data: antes } = await sup.from("pix_recorrencias").select("status").eq("id_rec", REC_3F_QR).maybeSingle();
    await sup.from("pix_recorrencias").update({ status: mapa[d.status] }).eq("id_rec", REC_3F_QR);
    await sup.from("system_logs").insert({ modulo: "pix-automatico-teste-3f", acao: "conferencia_manual", mensagem: `Status atualizado por conferência manual (GET Inter: ${d.status})`, payload: { idRec: REC_3F_QR, antes: antes?.status, depois: mapa[d.status] } });
    out.banco = { antes: antes?.status, depois: mapa[d.status] };
  }
  return mascararCpf(out);
}

// Parâmetros fixos aprovados pelo dono (vencimento D+2 = 2026-10-15). Uma tentativa, sem variações.
async function teste3fCobr() {
  const sup = admin();
  const log = (acao: string, payload: unknown) => sup.from("system_logs").insert({ modulo: "pix-automatico-teste-3f", acao, mensagem: acao, payload: mascararCpf(payload) });
  const idRec = REC_3F_QR, venc = "2026-10-15", valor = 1, info = "Teste Pix Automatico FORTEM";
  const { data: exist } = await sup.from("pix_cobrancas").select("status, raw_response").eq("id_rec", idRec);
  const count = (exist ?? []).filter((c: any) => !(c.status === "REJEITADA" && c.raw_response?._marcador === "teste_3F")).length;
  if (count > 0) { await log("cobr_recusado_ja_existe", { count }); return { ok: false, erro: "Já existe cobrança para essa idRec; nada enviado." }; }
  const { data: rec } = await sup.from("pix_recorrencias").select("aluno_id, status").eq("id_rec", idRec).maybeSingle();
  if (!rec || rec.status !== "AUTORIZADA" || rec.aluno_id !== TESTE_3F.aluno_id) return { ok: false, erro: "Recorrência de teste não está AUTORIZADA para o aluno de teste." };
  const { data: aluno } = await sup.from("alunos").select("nome").eq("id", rec.aluno_id).maybeSingle();
  const { data: cpfRev } = await sup.rpc("fn_reveal_cpf_service", { p_aluno_id: rec.aluno_id });
  const cpf = onlyDigits(cpfRev);
  if (cpf.length !== 11 || !aluno) return { ok: false, erro: "Aluno de teste sem nome/CPF." };
  const txid = genTxid();
  const conta = Deno.env.get("INTER_CONTA_CORRENTE") ?? "";
  const payload: any = {
    idRec, infoAdicional: info, ajusteDiaUtil: false,
    calendario: { dataDeVencimento: venc },
    valor: { original: valor.toFixed(2) },
    devedor: { cpf, nome: aluno.nome },
    ...(conta ? { recebedor: { conta, tipoConta: "CORRENTE", agencia: "0001" } } : {}),
  };
  const r = await interFetch(`/pix/v2/cobr/${txid}`, { method: "PUT", json: payload });
  const ok = r.status < 300;
  const out: any = { http: r.status, txid, vencimento: venc, statusInter: r.data?.status ?? null, erro: ok ? undefined : (r.data ?? r.raw) };
  await log(ok ? "cobr_criada" : "cobr_recusada", out);
  const { data: banco, error } = await sup.from("pix_cobrancas").insert({
    id_rec: idRec, aluno_id: rec.aluno_id, txid, valor, data_vencimento: venc,
    status: ok ? (r.data?.status ?? "CRIADA") : "REJEITADA",
    descricao: info, motivo_rejeicao: ok ? null : JSON.stringify(mascararCpf(r.data ?? r.raw)).slice(0, 500),
    raw_response: { ...(ok ? r.data : { erro: mascararCpf(r.data ?? r.raw), http: r.status }), _marcador: "teste_3F" },
  }).select("txid, status, data_vencimento, motivo_rejeicao").single();
  out.banco = banco ?? { erro: error?.message };
  if (ok) out.inter = { calendario: r.data?.calendario ?? null, atualizacao: r.data?.atualizacao ?? null };
  return mascararCpf(out);
}

// ---------- Jornada 3 (autorização + cobrança imediata no mesmo QR). Parâmetros fixos aprovados pelo dono. ----------
const J3 = { aluno_id: "085acf57-2dbe-464d-9acc-e1b0f5b77032", valor: 1, data_inicio: "2026-11-20", data_fim: "2026-12-20", objeto: "Teste Pix Automatico FORTEM J3" };
const MOD_J3 = "pix-automatico-teste-3f-j3";

async function teste3fJornada3() {
  const sup = admin();
  const log = (acao: string, payload: unknown) => sup.from("system_logs").insert({ modulo: MOD_J3, acao, mensagem: acao, payload: mascararCpf(payload) });
  const out: Record<string, unknown> = {};
  // Uma única tentativa: recusa se já houve início.
  const { count: ja } = await sup.from("system_logs").select("id", { count: "exact", head: true }).eq("modulo", MOD_J3).eq("acao", "inicio");
  // 2ª e última tentativa só com registro de aprovação do dono; nunca uma 3ª.
  const { count: lib } = await sup.from("system_logs").select("id", { count: "exact", head: true }).eq("modulo", MOD_J3).eq("acao", "segunda_tentativa_aprovada");
  if ((ja ?? 0) >= 2 || ((ja ?? 0) === 1 && (lib ?? 0) === 0)) return { ok: false, erro: "Limite de tentativas da jornada 3 atingido; nada enviado." };
  await log("inicio", { aluno_id: J3.aluno_id, valor: J3.valor });

  // 1) Cancela a recorrência ativa de teste (sem cobrança).
  const { data: ativa } = await sup.from("pix_recorrencias").select("status, aluno_id").eq("id_rec", REC_3F_QR).maybeSingle();
  if (ativa && ativa.aluno_id === J3.aluno_id && ativa.status !== "CANCELADA") {
    const c = await interFetch(`/pix/v2/rec/${REC_3F_QR}`, { method: "PATCH", json: { status: "CANCELADA" } });
    out.cancelar = { http: c.status, statusInter: c.data?.status ?? null, erro: c.status >= 300 ? (c.data ?? c.raw) : undefined };
    await log("cancelar_rec_ativa", out.cancelar);
    if (c.status >= 300) return mascararCpf(out);
    await sup.from("pix_recorrencias").update({ status: "CANCELADA", motivo_cancelamento: "teste 3F jornada 3" }).eq("id_rec", REC_3F_QR);
  }
  const { data: existentes } = await sup.from("pix_recorrencias").select("status, raw_response").eq("aluno_id", J3.aluno_id);
  if ((existentes ?? []).some((r: any) => !(r.status === "CANCELADA" && r.raw_response?._marcador === "teste_3F"))) {
    await log("recusado_ja_existe", { n: existentes?.length });
    return { ...out, ok: false, erro: "Há recorrência não cancelada do aluno de teste; nada criado." };
  }

  const { data: aluno } = await sup.from("alunos").select("nome").eq("id", J3.aluno_id).maybeSingle();
  const { data: cpfRev } = await sup.rpc("fn_reveal_cpf_service", { p_aluno_id: J3.aluno_id });
  const cpf = onlyDigits(cpfRev);
  if (!aluno || cpf.length !== 11) return { ...out, ok: false, erro: "Aluno de teste sem nome/CPF." };
  const devedor = { cpf, nome: aluno.nome };
  const chave = "26502263000192";

  // 2) Cobrança imediata de R$ 1,00.
  const txid = genTxid();
  const cob = await interFetch(`/pix/v2/cob/${txid}`, { method: "PUT", json: {
    calendario: { expiracao: 86400 }, devedor, valor: { original: J3.valor.toFixed(2) }, chave,
    solicitacaoPagador: "Teste Pix Automatico FORTEM J3",
  } });
  out.cob = { http: cob.status, txid, statusInter: cob.data?.status ?? null, erro: cob.status >= 300 ? (cob.data ?? cob.raw) : undefined };
  await log(cob.status < 300 ? "cob_criada" : "cob_recusada", out.cob);
  if (cob.status >= 300) return mascararCpf(out);

  // 3) Location de recorrência + recorrência ligada ao txid (jornada 3).
  const l = await interFetch("/pix/v2/locrec", { method: "POST" });
  out.locrec = { http: l.status, id: l.data?.id ?? null, erro: l.status >= 300 ? (l.data ?? l.raw) : undefined };
  await log("locrec", out.locrec);
  if (l.status >= 300 || l.data?.id == null) return mascararCpf(out);

  const recPayload = {
    vinculo: { objeto: J3.objeto, contrato: J3.aluno_id.replace(/-/g, "").substring(0, 35), devedor },
    calendario: { dataInicial: J3.data_inicio, dataFinal: J3.data_fim, periodicidade: "MENSAL" },
    valor: { valorMinimoRecebedor: J3.valor.toFixed(2) },
    politicaRetentativa: "PERMITE_3R_7D",
    loc: Number(l.data.id),
    ativacao: { dadosJornada: { txid } },
  };
  const rec = await interFetch("/pix/v2/rec", { method: "POST", json: recPayload });
  const idRec = rec.data?.idRec ?? null;
  out.rec = { http: rec.status, idRec, statusInter: rec.data?.status ?? null, erro: rec.status >= 300 ? (rec.data ?? rec.raw) : undefined };
  await log(rec.status < 300 && idRec ? "rec_criada" : "rec_recusada", out.rec);
  if (rec.status >= 300 || !idRec) return mascararCpf(out);

  // 4) Lê o copia e cola (rec e cob) e grava no banco com marca de teste.
  const g = await interFetch(`/pix/v2/rec/${idRec}`, { method: "GET" });
  const gc = await interFetch(`/pix/v2/cob/${txid}`, { method: "GET" });
  const copiaRec = g.data?.dadosQR?.pixCopiaECola ?? null;
  const copiaCob = gc.data?.pixCopiaECola ?? cob.data?.pixCopiaECola ?? null;
  out.get = { rec_http: g.status, rec_status: g.data?.status ?? null, jornada: g.data?.dadosQR?.jornada ?? g.data?.ativacao?.tipoJornada ?? null, cob_http: gc.status, cob_status: gc.data?.status ?? null, tem_copia_rec: !!copiaRec, tem_copia_cob: !!copiaCob };
  await log("get_qr", out.get);

  const { error: e1 } = await sup.from("pix_recorrencias").insert({
    aluno_id: J3.aluno_id, id_rec: idRec, status: "AGUARDANDO_AUTORIZACAO", valor_minimo: J3.valor, periodicidade: "MENSAL",
    data_inicio: J3.data_inicio, data_fim: J3.data_fim, politica_retentativa: "PERMITE_3R_7D",
    raw_response: { ...rec.data, loc: l.data, dadosQR: g.data?.dadosQR ?? null, jornada3_txid: txid, _marcador: "teste_3F" },
  });
  const hoje = new Date(Date.now() - 3 * 3600 * 1000).toISOString().slice(0, 10);
  const { error: e2 } = await sup.from("pix_cobrancas").insert({
    id_rec: idRec, aluno_id: J3.aluno_id, txid, valor: J3.valor, data_vencimento: hoje,
    status: cob.data?.status ?? "ATIVA", descricao: "Teste Pix Automatico FORTEM J3 (cob imediata)",
    raw_response: { ...cob.data, _marcador: "teste_3F", jornada: 3 },
  });
  out.banco = { rec: e1?.message ?? "ok", cob: e2?.message ?? "ok" };
  await log("banco", out.banco);
  return { ...(mascararCpf(out) as object), pixCopiaECola: copiaRec ?? copiaCob, copiaRec, copiaCob };
}

async function conferir3fJornada3() {
  const sup = admin();
  const { data: r } = await sup.from("pix_recorrencias").select("id_rec, status, raw_response").eq("aluno_id", J3.aluno_id).not("raw_response->>jornada3_txid", "is", null).order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (!r) return { ok: false, erro: "Sem recorrência da jornada 3." };
  const txid = (r.raw_response as any).jornada3_txid;
  const g = await interFetch(`/pix/v2/rec/${r.id_rec}`, { method: "GET" });
  const gc = await interFetch(`/pix/v2/cob/${txid}`, { method: "GET" });
  const out = {
    idRec: r.id_rec, txid, banco_rec: r.status,
    inter_rec: { http: g.status, status: g.data?.status ?? null, ativacao: g.data?.ativacao ?? null },
    inter_cob: { http: gc.status, status: gc.data?.status ?? null, pix: (gc.data?.pix ?? []).map((p: any) => ({ e2e: p.endToEndId, valor: p.valor, horario: p.horario })) },
  };
  await sup.from("system_logs").insert({ modulo: MOD_J3, acao: "conferencia", mensagem: "conferencia", payload: mascararCpf(out) });
  return mascararCpf(out);
}
