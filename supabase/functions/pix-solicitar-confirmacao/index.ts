import { corsHeaders, jsonResponse, admin, requireAdmin } from "../_shared/inter.ts";
import { solicitarConfirmacao } from "../_shared/pix-rec.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const auth = await requireAdmin(req);
    if ("error" in auth) return auth.error;

    const { idRec } = (await req.json().catch(() => null)) ?? {};
    if (!idRec) return jsonResponse({ error: "idRec é obrigatório" }, 400);

    const r = await solicitarConfirmacao(admin(), idRec);
    if (!r.ok) return jsonResponse({ error: r.erro, status: r.status, detail: r.detail }, r.httpStatus);
    return jsonResponse({ ok: true, idSolicRec: r.idSolicRec });
  } catch (e) {
    console.error("pix-solicitar-confirmacao error", e);
    return jsonResponse({ error: String((e as Error)?.message ?? e) }, 500);
  }
});
