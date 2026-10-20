// ─────────────────────────────────────────────────────────────
// facial-checkin — recebe as passagens da porta (Intelbras SS 3532 MF W)
// enviadas pelo agente local da Fortem.
//
// Toda a regra de negócio (janela, status, modo log/ativo, idempotência)
// mora em public.fn_facial_registrar_passagem. Aqui só há autenticação,
// validação do formato e repasse.
//
// CONTRATO com o agente (POST, header x-agent-token):
//   { "eventos": [ {
//       "device_user_id": 1787 | null,          // null = rosto não reconhecido
//       "evento_em": "2026-10-21T09:58:03-03:00", // ISO 8601 com fuso
//       "sucesso": true,                        // false = acesso negado
//       "metodo": "face",                       // opcional; só "face" é processado
//       "bruto": { ... }                        // opcional; evento original
//   } ] }                                       // de 1 a 100 por chamada
//
// Resposta 200: { ok, processados, duplicados, ignorados, resultados[], erros[] }
//   erros[].retentavel = true -> o agente reenvia só esses eventos.
// Resposta 503: todos os eventos falharam no banco -> reenviar o lote inteiro.
// ─────────────────────────────────────────────────────────────

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const MAX_EVENTOS = 100;
const MAX_FUTURO_MS = 5 * 60 * 1000;               // relógio do agente adiantado
const MAX_PASSADO_MS = 30 * 24 * 60 * 60 * 1000;   // reenvio após queda longa
const MAX_BRUTO_CHARS = 8000;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

// Comparação em tempo constante (evita vazar o token por tempo de resposta).
function igualConstante(a: string, b: string): boolean {
  const enc = new TextEncoder();
  const x = enc.encode(a);
  const y = enc.encode(b);
  let diff = x.length ^ y.length;
  const n = Math.max(x.length, y.length);
  for (let i = 0; i < n; i++) diff |= (x[i] ?? 0) ^ (y[i] ?? 0);
  return diff === 0;
}

type EventoValido = {
  indice: number;
  device_user_id: number | null;
  evento_em: string;
  ts: number;
  sucesso: boolean;
  metodo: string | null;
  bruto: Record<string, unknown>;
};

function validar(ev: any, indice: number, agora: number): EventoValido | string {
  if (!ev || typeof ev !== "object" || Array.isArray(ev)) return "evento inválido";

  const uid = ev.device_user_id;
  if (uid !== null && !(Number.isInteger(uid) && uid > 0 && uid <= 2147483647)) {
    return "device_user_id inválido";
  }
  if (typeof ev.sucesso !== "boolean") return "sucesso deve ser booleano";
  if (typeof ev.evento_em !== "string") return "evento_em ausente";

  const ts = Date.parse(ev.evento_em);
  if (Number.isNaN(ts)) return "evento_em inválido";
  if (ts > agora + MAX_FUTURO_MS) return "evento_em no futuro";
  if (ts < agora - MAX_PASSADO_MS) return "evento_em muito antigo";

  const metodo = typeof ev.metodo === "string" ? ev.metodo.toLowerCase() : null;

  let bruto: Record<string, unknown> = {};
  if (ev.bruto && typeof ev.bruto === "object" && !Array.isArray(ev.bruto)) {
    bruto = JSON.stringify(ev.bruto).length <= MAX_BRUTO_CHARS
      ? ev.bruto
      : { truncado: true };
  }

  return {
    indice,
    device_user_id: uid,
    evento_em: new Date(ts).toISOString(),
    ts,
    sucesso: ev.sucesso,
    metodo,
    bruto,
  };
}

serve(async (req) => {
  if (req.method !== "POST") return json({ error: "Método não permitido" }, 405);

  // ── 1. Autenticação do agente ─────────────────────────────
  const esperado = Deno.env.get("FACIAL_AGENT_TOKEN") ?? "";
  if (esperado.length < 32) {
    console.error("[facial-checkin] FACIAL_AGENT_TOKEN ausente ou curto demais");
    return json({ error: "Função não configurada" }, 500);
  }
  const recebido = req.headers.get("x-agent-token") ?? "";
  if (!igualConstante(recebido, esperado)) return json({ error: "Não autorizado" }, 401);

  // ── 2. Entrada ────────────────────────────────────────────
  const body = await req.json().catch(() => null);
  const eventos = body?.eventos;
  if (!Array.isArray(eventos) || eventos.length === 0 || eventos.length > MAX_EVENTOS) {
    return json({ error: `Envie de 1 a ${MAX_EVENTOS} eventos` }, 400);
  }

  const agora = Date.now();
  const validos: EventoValido[] = [];
  const erros: { indice: number; erro: string; retentavel: boolean }[] = [];
  let ignorados = 0;

  eventos.forEach((ev: unknown, indice: number) => {
    const r = validar(ev, indice, agora);
    if (typeof r === "string") {
      erros.push({ indice, erro: r, retentavel: false });
    } else if (r.metodo !== null && r.metodo !== "face") {
      ignorados++; // senha, cartão, botão: não confirmam presença
    } else {
      validos.push(r);
    }
  });

  // ── 3. Processa em ordem cronológica ──────────────────────
  validos.sort((a, b) => a.ts - b.ts);

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );

  const resultados: { indice: number; resultado?: string; aplicado?: boolean; duplicado: boolean }[] = [];
  let duplicados = 0;
  let falhasBanco = 0;

  for (const ev of validos) {
    const { data, error } = await supabase.rpc("fn_facial_registrar_passagem", {
      p_device_user_id: ev.device_user_id,
      p_evento_em: ev.evento_em,
      p_sucesso: ev.sucesso,
      p_bruto: ev.bruto,
      p_simular: false,
    });

    if (error) {
      falhasBanco++;
      console.error("[facial-checkin] falha ao registrar passagem:", error.message);
      erros.push({ indice: ev.indice, erro: "falha ao registrar", retentavel: true });
      continue;
    }
    if (data?.duplicado) {
      duplicados++;
      resultados.push({ indice: ev.indice, duplicado: true });
    } else {
      resultados.push({
        indice: ev.indice,
        resultado: data?.resultado,
        aplicado: data?.aplicado === true,
        duplicado: false,
      });
    }
  }

  // Banco fora do ar para todos os eventos: pede reenvio do lote inteiro.
  if (validos.length > 0 && falhasBanco === validos.length) {
    return json({ ok: false, erro: "banco indisponível", erros }, 503);
  }

  return json({
    ok: erros.length === 0,
    processados: resultados.length - duplicados,
    duplicados,
    ignorados,
    resultados,
    erros,
  });
});