import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-webhook-secret",
};

const INTER_ORIGIN = "https://cdpj.partners.bancointer.com.br";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function normalizePem(raw: string, nome: string): string {
  let s = raw.trim();
  if (s.includes("\\n")) s = s.replace(/\\r/g, "").replace(/\\n/g, "\n");
  if (!s.includes("-----BEGIN")) {
    try {
      const decoded = atob(s.replace(/\s+/g, ""));
      if (decoded.includes("-----BEGIN")) s = decoded;
    } catch { /* ignore */ }
  }
  s = s.replace(/\r\n/g, "\n").replace(/\r/g, "\n").trim();
  if (!s.includes("-----BEGIN")) throw new Error(`${nome} inválido: nenhum bloco PEM encontrado`);

  // Reescreve o bloco em formato canônico: cabeçalho e rodapé originais
  // (preservando o tipo declarado no BEGIN — CERTIFICATE vs PRIVATE KEY) e o
  // corpo base64 sem nenhum caractere fora do alfabeto, quebrado a cada 64
  // caracteres. Sem isso, um PEM colado em linha única (conteúdo grudado no
  // cabeçalho) faz o parser do Deno falhar com "Unable to decode certificate".
  const m = s.match(/-----BEGIN[ \t]*([A-Z0-9 _-]+?)[ \t]*-----([\s\S]*?)-----END[ \t]*([A-Z0-9 _-]+?)[ \t]*-----/);
  if (!m) throw new Error(`${nome} inválido: bloco PEM incompleto (cabeçalho sem rodapé correspondente)`);
  const tipo = m[1].trim();
  const corpo = m[2].replace(/[^A-Za-z0-9+/=]/g, "");
  if (!corpo) throw new Error(`${nome} inválido: bloco PEM sem conteúdo base64`);
  const linhas = corpo.match(/.{1,64}/g) ?? [];
  return `-----BEGIN ${tipo}-----\n${linhas.join("\n")}\n-----END ${tipo}-----\n`;
}

// Diagnóstico de integridade do payload base64 de um PEM.
// Nunca retorna (nem loga) o conteúdo real: só metadados — tamanho, validade do
// alfabeto, posição (não o caractere) do primeiro caractere inválido, tamanho em
// bytes da decodificação e o primeiro byte em hex (um DER válido começa com "30").
function diagBase64(normalizado: string | null): Record<string, unknown> {
  if (normalizado === null) return { base64_valido: null };
  const linhas = normalizado.split("\n").map((l) => l.trim()).filter((l) => l.length > 0);
  const corpo = linhas.filter((l) => !l.startsWith("-----"));
  const b64 = corpo.join("");
  const valido = /^[A-Za-z0-9+/=]*$/;
  let posInvalido = -1;
  for (let i = 0; i < b64.length; i++) {
    if (!valido.test(b64[i])) { posInvalido = i; break; }
  }
  const out: Record<string, unknown> = {
    base64_linhas: corpo.length,
    base64_maior_linha: corpo.length ? Math.max(...corpo.map((l) => l.length)) : 0,
    base64_chars: b64.length,
    base64_valido: posInvalido === -1,
  };
  if (posInvalido >= 0) out.caracter_invalido_pos = posInvalido;
  try {
    const bin = atob(b64);
    out.bytes_decodificados = bin.length;
    out.primeiro_byte_hex = bin.length ? bin.charCodeAt(0).toString(16).padStart(2, "0") : "";
  } catch (e) {
    out.erro_decode_base64 = (e as Error).message;
  }
  return out;
}

function fmtDate(d: Date): string {
  return d.toISOString().split("T")[0];
}

async function sha256Hex(s: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  // 1) Validação anti-spoof
  const expected = Deno.env.get("INTER_EXTRATO_WEBHOOK_SECRET");
  const provided = req.headers.get("x-webhook-secret");
  if (!expected || !provided || provided !== expected) {
    return json({ ok: false, error: "Unauthorized" }, 401);
  }

  // Período
  let dias = 10;
  try {
    const body = await req.json();
    if (body && body.dias !== undefined && body.dias !== null) dias = Number(body.dias);
  } catch { /* body vazio */ }
  if (!Number.isInteger(dias) || dias < 0) {
    return json({ ok: false, error: "Parâmetro 'dias' deve ser um inteiro >= 0" }, 400);
  }
  if (dias > 90) {
    return json({ ok: false, error: "O Inter permite no máximo 90 dias por consulta; envie 'dias' <= 90" }, 400);
  }
  const hoje = new Date();
  const inicioD = new Date(hoje.getTime() - dias * 86400000);
  const inicio = fmtDate(inicioD);
  const fim = fmtDate(hoje);

  // mTLS client
  let httpClient: any;
  try {
    const certRaw = Deno.env.get("INTER_EXTRATO_CERT");
    const keyRaw = Deno.env.get("INTER_EXTRATO_KEY");
    if (!certRaw || !keyRaw) throw new Error("Certificado/chave do extrato não configurados");

    // Diagnóstico sem expor conteúdo (coletado antes do createHttpClient,
    // incluído no JSON de erro só quando a etapa falhar)
    const coletarDiag = (nome: string, raw: string, normalizado: string | null, erroNorm?: string) => ({
      tamanho_bruto: raw.length,
      tamanho_normalizado: normalizado === null ? null : normalizado.length,
      qtd_begin: normalizado === null ? null : (normalizado.match(/-----BEGIN/g) || []).length,
      primeiros_27: normalizado === null ? null : normalizado.substring(0, 27),
      ultimos_25: normalizado === null ? null : normalizado.substring(normalizado.length - 25),
      tem_crlf_bruto: raw.includes("\r\n"),
      ...diagBase64(normalizado),
      ...(erroNorm ? { erro_normalizacao: erroNorm } : {}),
    });

    let cert: string | null = null;
    let key: string | null = null;
    const diagCert = { raw: certRaw!, valor: null as any };
    const diagKey = { raw: keyRaw!, valor: null as any };
    try {
      cert = normalizePem(certRaw, "INTER_EXTRATO_CERT");
      diagCert.valor = coletarDiag("cert", certRaw!, cert);
    } catch (e) {
      diagCert.valor = coletarDiag("cert", certRaw!, null, (e as Error).message);
      throw e;
    }
    try {
      key = normalizePem(keyRaw, "INTER_EXTRATO_KEY");
      diagKey.valor = coletarDiag("key", keyRaw!, key);
    } catch (e) {
      diagKey.valor = coletarDiag("key", keyRaw!, null, (e as Error).message);
      throw e;
    }
    console.log("[inter-extrato] diagnóstico PEM:", JSON.stringify({ cert: diagCert.valor, key: diagKey.valor }));

    // @ts-ignore Deno.createHttpClient disponível no Edge Runtime
    if (typeof Deno.createHttpClient !== "function") {
      throw new Error("Deno.createHttpClient não disponível neste runtime");
    }
    // @ts-ignore
    httpClient = Deno.createHttpClient({ cert: cert!, key: key! });
  } catch (e) {
    console.error("[inter-extrato] erro ao preparar mTLS:", (e as Error).message);
    const debug: Record<string, unknown> = {};
    try {
      const certRaw = Deno.env.get("INTER_EXTRATO_CERT");
      const keyRaw = Deno.env.get("INTER_EXTRATO_KEY");
      if (!certRaw) debug.cert = { configurado: false };
      else {
        let norm: string | null = null;
        let erroNorm: string | undefined;
        try { norm = normalizePem(certRaw, "cert"); } catch (er) { erroNorm = (er as Error).message; }
        debug.cert = {
          configurado: true,
          tamanho_bruto: certRaw.length,
          tamanho_normalizado: norm?.length ?? null,
          qtd_begin: norm ? (norm.match(/-----BEGIN/g) || []).length : null,
          primeiros_27: norm?.substring(0, 27) ?? null,
          ultimos_25: norm?.substring(norm.length - 25) ?? null,
          tem_crlf_bruto: certRaw.includes("\r\n"),
          ...diagBase64(norm),
          ...(erroNorm ? { erro_normalizacao: erroNorm } : {}),
        };
      }
      if (!keyRaw) debug.key = { configurado: false };
      else {
        let norm: string | null = null;
        let erroNorm: string | undefined;
        try { norm = normalizePem(keyRaw, "key"); } catch (er) { erroNorm = (er as Error).message; }
        debug.key = {
          configurado: true,
          tamanho_bruto: keyRaw.length,
          tamanho_normalizado: norm?.length ?? null,
          qtd_begin: norm ? (norm.match(/-----BEGIN/g) || []).length : null,
          primeiros_27: norm?.substring(0, 27) ?? null,
          ultimos_25: norm?.substring(norm.length - 25) ?? null,
          tem_crlf_bruto: keyRaw.includes("\r\n"),
          ...diagBase64(norm),
          ...(erroNorm ? { erro_normalizacao: erroNorm } : {}),
        };
      }
    } catch { debug.coleta_falhou = true; }
    return json({ ok: false, error: `Falha ao preparar certificado: ${(e as Error).message}`, debug }, 500);
  }

  // 2) OAuth
  let token: string;
  try {
    const clientId = Deno.env.get("INTER_EXTRATO_CLIENT_ID");
    const clientSecret = Deno.env.get("INTER_EXTRATO_CLIENT_SECRET");
    if (!clientId || !clientSecret) throw new Error("Client ID/Secret do extrato não configurados");
    const res = await fetch(`${INTER_ORIGIN}/oauth/v2/token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: "client_credentials",
        scope: "extrato.read",
      }),
      // @ts-ignore unstable option
      client: httpClient,
    });
    const text = await res.text();
    if (!res.ok) {
      console.error("[inter-extrato] OAuth status", res.status, text.substring(0, 300));
      throw new Error(`OAuth retornou ${res.status}`);
    }
    const parsed = JSON.parse(text);
    if (!parsed?.access_token) throw new Error("OAuth sem access_token na resposta");
    token = parsed.access_token;
  } catch (e) {
    return json({ ok: false, error: `Falha na autenticação com o Inter: ${(e as Error).message}` }, 502);
  }

  // 3) Extrato
  let transacoes: any[] = [];
  try {
    const url = `${INTER_ORIGIN}/banking/v2/extrato?dataInicio=${inicio}&dataFim=${fim}`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
      // @ts-ignore unstable option
      client: httpClient,
    });
    const text = await res.text();
    if (!res.ok) {
      console.error("[inter-extrato] extrato status", res.status, text.substring(0, 500));
      throw new Error(`Extrato retornou ${res.status}`);
    }
    const data = text ? JSON.parse(text) : null;
    if (Array.isArray(data)) transacoes = data;
    else if (Array.isArray(data?.transacoes)) transacoes = data.transacoes;
    else if (data && typeof data === "object") {
      const arr = Object.values(data).find((v) => Array.isArray(v)) as any[] | undefined;
      if (arr) {
        console.warn("[inter-extrato] formato inesperado; usando primeiro array encontrado. chaves:", Object.keys(data));
        transacoes = arr;
      } else {
        console.warn("[inter-extrato] nenhum array de transações encontrado. chaves:", Object.keys(data));
      }
    } else {
      console.warn("[inter-extrato] resposta vazia ou não-JSON");
    }
  } catch (e) {
    return json({ ok: false, error: `Falha ao consultar o extrato: ${(e as Error).message}` }, 502);
  }

  // 4) Upsert
  try {
    const rows = await Promise.all(transacoes.map(async (t: any) => {
      const dataEntrada = String(t.dataEntrada ?? t.dataLancamento ?? "");
      const valor = String(t.valor ?? "");
      const tipoOperacao = String(t.tipoOperacao ?? "");
      const numeroDocumento = String(t.numeroDocumento ?? "");
      const descricao = String(t.descricao ?? "");
      const chave = await sha256Hex(`${dataEntrada}|${valor}|${tipoOperacao}|${numeroDocumento}|${descricao}`);
      return {
        chave_natural: chave,
        data_entrada: dataEntrada || null,
        tipo_operacao: tipoOperacao || null,
        tipo_transacao: t.tipoTransacao ?? null,
        valor: valor === "" ? null : Number(valor),
        titulo: t.titulo ?? null,
        descricao: descricao || null,
        numero_documento: numeroDocumento || null,
        raw: t,
      };
    }));

    // Remove duplicatas dentro do mesmo lote
    const unicos = Array.from(new Map(rows.map((r) => [r.chave_natural, r])).values());

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } },
    );

    let novos = 0;
    for (let i = 0; i < unicos.length; i += 500) {
      const lote = unicos.slice(i, i + 500);
      const { data, error } = await supabase
        .from("inter_extrato_movimentos")
        .upsert(lote, { onConflict: "chave_natural", ignoreDuplicates: true })
        .select("id");
      if (error) throw new Error(error.message);
      novos += data?.length ?? 0;
    }

    return json({
      ok: true,
      periodo: { inicio, fim },
      total_lidos: transacoes.length,
      total_novos: novos,
      total_ja_existentes: transacoes.length - novos,
    });
  } catch (e) {
    console.error("[inter-extrato] erro ao gravar:", (e as Error).message);
    return json({ ok: false, error: `Falha ao gravar movimentos: ${(e as Error).message}` }, 500);
  }
});
