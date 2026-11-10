import { corsHeaders, jsonResponse, interFetch, admin, requireAdmin } from "../_shared/inter.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const auth = await requireAdmin(req);
    if ("error" in auth) return auth.error;

    const { idRec, motivo } = (await req.json().catch(() => null)) ?? {};
    if (!idRec) return jsonResponse({ error: "idRec é obrigatório" }, 400);

    const { status, data, raw } = await interFetch(`/pix/v2/rec/${idRec}`, {
      method: "PATCH",
      json: { status: "CANCELADA" },
    });
    if (status >= 300) {
      console.error("Inter PATCH /rec error", status, raw);
      return jsonResponse({ error: "Falha ao cancelar no Inter", status, detail: data }, 502);
    }

    await admin()
      .from("pix_recorrencias")
      .update({ status: "CANCELADA", motivo_cancelamento: motivo ?? null })
      .eq("id_rec", idRec);
    // Mantém o grupo de itens (se houver) coerente: libera itens / devolve forma de pagamento.
    await admin().rpc("fn_pix_aut_rec_status", { p_id_rec: idRec, p_status: "CANCELADA" });

    return jsonResponse({ ok: true });
  } catch (e) {
    console.error("pix-cancelar-recorrencia error", e);
    return jsonResponse({ error: String(e?.message ?? e) }, 500);
  }
});
