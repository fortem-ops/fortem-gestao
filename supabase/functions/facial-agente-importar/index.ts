import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

function igualConstante(a: string, b: string): boolean {
  const enc = new TextEncoder();
  const x = enc.encode(a);
  const y = enc.encode(b);
  let diff = x.length ^ y.length;
  const n = Math.max(x.length, y.length);
  for (let i = 0; i < n; i++) diff |= (x[i] ?? 0) ^ (y[i] ?? 0);
  return diff === 0;
}

const MAX_BYTES = 2 * 1024 * 1024;

function decodificarJpeg(b64: string): Uint8Array | null {
  try {
    const bin = atob(b64.replace(/\s+/g, ""));
    if (bin.length < 1000 || bin.length > MAX_BYTES) return null;
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    if (bytes[0] !== 0xff || bytes[1] !== 0xd8 || bytes[2] !== 0xff) return null;
    return bytes;
  } catch (_) {
    return null;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Método não permitido" }, 405);

  const esperado = Deno.env.get("FACIAL_AGENT_TOKEN") ?? "";
  if (esperado.length < 32) {
    console.error("[facial-agente-importar] FACIAL_AGENT_TOKEN ausente ou curto demais");
    return json({ error: "Função não configurada" }, 500);
  }
  if (!igualConstante(req.headers.get("x-agent-token") ?? "", esperado)) {
    return json({ error: "Não autorizado" }, 401);
  }

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return json({ error: "Corpo inválido" }, 400);
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );

  if (body.op === "listar") {
    const max = Number.isInteger(body.max) ? Math.min(Math.max(body.max, 1), 5) : 1;
    const { data, error } = await supabase.rpc("fn_facial_importar_listar", { p_max: max });
    if (error) {
      console.error("[facial-agente-importar] listar falhou:", error.message);
      return json({ ok: false, error: "falha ao listar" }, 503);
    }
    return json(data ?? { ids: [] });
  }

  if (body.op === "enviar") {
    const id = body.device_user_id;
    if (!Number.isInteger(id) || id <= 0) return json({ error: "device_user_id inválido" }, 400);

    const { data: alunoId, error: e1 } = await supabase.rpc("fn_facial_importar_aluno", { p_device_user_id: id });
    if (e1) {
      console.error("[facial-agente-importar] aluno falhou:", e1.message);
      return json({ ok: false, error: "falha ao localizar" }, 503);
    }
    if (!alunoId) return json({ ok: false, erro: "credencial não elegível" });

    if (body.ausente === true) {
      const { data, error } = await supabase.rpc("fn_facial_importar_gravar", {
        p_device_user_id: id, p_foto_path: null, p_ausente: true,
      });
      if (error) return json({ ok: false, error: "falha ao gravar" }, 503);
      return json(data);
    }

    if (typeof body.foto_base64 !== "string") return json({ error: "foto_base64 obrigatório" }, 400);
    const bytes = decodificarJpeg(body.foto_base64);
    if (!bytes) return json({ error: "foto inválida (precisa ser JPEG de até 2 MB)" }, 400);

    const caminho = `${alunoId}/porta.jpg`;
    const { error: e2 } = await supabase.storage.from("faciais")
      .upload(caminho, bytes, { contentType: "image/jpeg", upsert: true });
    if (e2) {
      console.error("[facial-agente-importar] upload falhou:", e2.message);
      return json({ ok: false, error: "falha ao guardar a foto" }, 503);
    }
    const { data, error } = await supabase.rpc("fn_facial_importar_gravar", {
      p_device_user_id: id, p_foto_path: caminho, p_ausente: false,
    });
    if (error) {
      console.error("[facial-agente-importar] gravar falhou:", error.message);
      return json({ ok: false, error: "falha ao gravar" }, 503);
    }
    return json(data);
  }

  return json({ error: "op inválida" }, 400);
});