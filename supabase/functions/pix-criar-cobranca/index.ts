import { corsHeaders, jsonResponse, interFetch, admin, requireAdminOrCoord, genTxid, onlyDigits } from "../_shared/inter.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const auth = await requireAdminOrCoord(req);
    if ("error" in auth) return auth.error;

    const { idRec, valor, dataVencimento, descricao } = (await req.json().catch(() => null)) ?? {};
    if (!idRec || valor == null || !dataVencimento) {
      return jsonResponse({ error: "idRec, valor e dataVencimento são obrigatórios" }, 400);
    }
    const v = Number(valor);
    if (!isFinite(v) || v <= 0) return jsonResponse({ error: "valor inválido" }, 400);

    const sup = admin();
    const { data: rec } = await sup
      .from("pix_recorrencias")
      .select("aluno_id, status")
      .eq("id_rec", idRec)
      .maybeSingle();
    if (!rec) return jsonResponse({ error: "Recorrência não encontrada" }, 404);
    if (rec.status !== "AUTORIZADA") {
      return jsonResponse({ error: `Recorrência não autorizada (status atual: ${rec.status})` }, 409);
    }
    const { data: aluno } = await sup
      .from("alunos")
      .select("nome, cpf")
      .eq("id", rec.aluno_id)
      .maybeSingle();
    if (!aluno) return jsonResponse({ error: "Aluno não encontrado" }, 404);

    const txid = genTxid();
    const payload: any = {
      calendario: { dataDeVencimento: dataVencimento, validadeAposVencimento: 0 },
      devedor: { cpf: onlyDigits(aluno.cpf), nome: aluno.nome },
      valor: { original: v.toFixed(2) },
      idRec,
      solicitacaoPagador: descricao ?? "Mensalidade Fortem",
    };

    const { status, data, raw } = await interFetch(`/pix/v2/cobr/${txid}`, {
      method: "PUT",
      json: payload,
    });
    if (status >= 300) {
      console.error("Inter /cobr error", status, raw);
      return jsonResponse({ error: "Falha ao criar cobrança", status, detail: data }, 502);
    }

    const { data: inserted, error: insErr } = await sup
      .from("pix_cobrancas")
      .insert({
        id_rec: idRec,
        aluno_id: rec.aluno_id,
        txid,
        valor: v,
        data_vencimento: dataVencimento,
        status: data?.status ?? "CRIADA",
        descricao: descricao ?? null,
        raw_response: data,
      })
      .select()
      .single();
    if (insErr) return jsonResponse({ error: insErr.message }, 500);

    return jsonResponse({ cobranca: inserted });
  } catch (e) {
    console.error("pix-criar-cobranca error", e);
    return jsonResponse({ error: String(e?.message ?? e) }, 500);
  }
});
