import { corsHeaders, jsonResponse, interFetch, admin, requireAdminOrCoord, onlyDigits } from "../_shared/inter.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const auth = await requireAdminOrCoord(req);
    if ("error" in auth) return auth.error;

    const body = await req.json().catch(() => null);
    const { aluno_id, valor_minimo, data_inicio, data_fim } = body ?? {};
    if (!aluno_id || valor_minimo == null || !data_inicio) {
      return jsonResponse({ error: "aluno_id, valor_minimo e data_inicio são obrigatórios" }, 400);
    }
    const valor = Number(valor_minimo);
    if (!isFinite(valor) || valor <= 0) {
      return jsonResponse({ error: "valor_minimo inválido" }, 400);
    }

    const sup = admin();
    const { data: aluno, error: alunoErr } = await sup
      .from("alunos")
      .select("id, nome, cpf")
      .eq("id", aluno_id)
      .maybeSingle();
    if (alunoErr || !aluno) return jsonResponse({ error: "Aluno não encontrado" }, 404);
    const cpf = onlyDigits(aluno.cpf);
    if (cpf.length !== 11) return jsonResponse({ error: "Aluno sem CPF válido" }, 400);

    const payload: any = {
      vinculo: {
        objeto: "Plano mensal FORTEM",
        contrato: aluno_id.replace(/-/g, "").substring(0, 35),
        devedor: { cpf, nome: aluno.nome },
      },
      calendario: {
        dataInicial: data_inicio,
        ...(data_fim ? { dataFinal: data_fim } : {}),
        periodicidade: "MENSAL",
      },
      valor: { valorMinimoRecebedor: valor.toFixed(2) },
      politicaRetentativa: "PERMITE_3R_7D",
    };

    const { status, data, raw } = await interFetch("/pix/v2/rec", {
      method: "POST",
      json: payload,
    });

    if (status >= 300) {
      console.error("Inter /rec error", status, raw);
      return jsonResponse({ error: "Falha ao criar recorrência no Inter", status, detail: data }, 502);
    }
    const idRec: string = data?.idRec;
    if (!idRec) return jsonResponse({ error: "idRec não retornado", detail: data }, 502);

    const { data: inserted, error: insErr } = await sup
      .from("pix_recorrencias")
      .insert({
        aluno_id,
        id_rec: idRec,
        status: "CRIADA",
        valor_minimo: valor,
        periodicidade: "MENSAL",
        data_inicio,
        data_fim: data_fim ?? null,
        politica_retentativa: "PERMITE_3R_7D",
        raw_response: data,
      })
      .select()
      .single();
    if (insErr) return jsonResponse({ error: insErr.message }, 500);

    return jsonResponse({ recorrencia: inserted });
  } catch (e) {
    console.error("pix-criar-recorrencia error", e);
    return jsonResponse({ error: String(e?.message ?? e) }, 500);
  }
});
