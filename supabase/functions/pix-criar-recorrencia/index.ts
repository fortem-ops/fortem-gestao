import { corsHeaders, jsonResponse, admin, requireAdmin } from "../_shared/inter.ts";
import { criarRecorrencia } from "../_shared/pix-rec.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const auth = await requireAdmin(req);
    if ("error" in auth) return auth.error;

    const body = await req.json().catch(() => null);
    const { aluno_id, valor_minimo, data_inicio, data_fim, objeto, teste } = body ?? {};
    if (!aluno_id || valor_minimo == null || !data_inicio) {
      return jsonResponse({ error: "aluno_id, valor_minimo e data_inicio são obrigatórios" }, 400);
    }
    const valor = Number(valor_minimo);
    if (!isFinite(valor) || valor <= 0) return jsonResponse({ error: "valor_minimo inválido" }, 400);

    const r = await criarRecorrencia(admin(), { aluno_id, valor, data_inicio, data_fim, objeto, teste: !!teste });
    if (!r.ok) return jsonResponse({ error: r.erro, status: r.status, detail: r.detail }, r.httpStatus);
    return jsonResponse({ recorrencia: r.recorrencia });
  } catch (e) {
    console.error("pix-criar-recorrencia error", e);
    return jsonResponse({ error: String((e as Error)?.message ?? e) }, 500);
  }
});
