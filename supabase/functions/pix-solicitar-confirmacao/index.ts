import { corsHeaders, jsonResponse, interFetch, admin, requireAdminOrCoord, onlyDigits } from "../_shared/inter.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const auth = await requireAdminOrCoord(req);
    if ("error" in auth) return auth.error;

    const { idRec } = (await req.json().catch(() => null)) ?? {};
    if (!idRec) return jsonResponse({ error: "idRec é obrigatório" }, 400);

    const sup = admin();
    const { data: rec } = await sup
      .from("pix_recorrencias")
      .select("aluno_id, id_rec")
      .eq("id_rec", idRec)
      .maybeSingle();
    if (!rec) return jsonResponse({ error: "Recorrência não encontrada" }, 404);

    const { data: aluno } = await sup
      .from("alunos")
      .select("nome, cpf")
      .eq("id", rec.aluno_id)
      .maybeSingle();
    if (!aluno) return jsonResponse({ error: "Aluno não encontrado" }, 404);
    const cpf = onlyDigits(aluno.cpf);

    const payload = {
      idRec,
      calendario: { dataExpiracaoSolicitacao: new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString() },
      destinatario: { cpf, nome: aluno.nome },
    };

    const { status, data, raw } = await interFetch("/pix-automatico/v1/solicrec", {
      method: "POST",
      json: payload,
    });
    if (status >= 300) {
      console.error("Inter /solicrec error", status, raw);
      return jsonResponse({ error: "Falha ao solicitar confirmação", status, detail: data }, 502);
    }
    const idSolicRec: string | undefined = data?.idSolicRec;

    await sup
      .from("pix_recorrencias")
      .update({
        status: "AGUARDANDO_AUTORIZACAO",
        id_solic_rec: idSolicRec ?? null,
      })
      .eq("id_rec", idRec);

    return jsonResponse({ ok: true, idSolicRec });
  } catch (e) {
    console.error("pix-solicitar-confirmacao error", e);
    return jsonResponse({ error: String(e?.message ?? e) }, 500);
  }
});
