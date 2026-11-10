// Gera (ou renova, até 3 vezes) o código de autorização do Pix Automático de um grupo de itens.
// Só admin. NÃO cria cobrança nem débito: apenas a recorrência (autorização) no Inter.
import { corsHeaders, jsonResponse, admin, requireAdmin, interFetch } from "../_shared/inter.ts";
import { criarRecorrencia, solicitarConfirmacao } from "../_shared/pix-rec.ts";
import { dataInicioRecorrencia } from "../_shared/pix-aut-grupo.ts";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface Reserva {
  ok: boolean; erro?: string; aluno_id: string; teto: number | string; dia_debito: string | null;
  codigo_numero: number; id_rec_anterior: string | null; vinculo_ref: string;
}

function hojeBrasilia(): string {
  return new Date(Date.now() - 3 * 3600 * 1000).toISOString().slice(0, 10);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const auth = await requireAdmin(req);
    if ("error" in auth) return auth.error;

    const body: unknown = await req.json().catch(() => null);
    const grupoId = (body as { grupo_id?: unknown } | null)?.grupo_id;
    if (typeof grupoId !== "string" || !UUID.test(grupoId)) return jsonResponse({ error: "grupo_id inválido" }, 400);

    const sup = admin();
    const { data: resData, error: resErr } = await sup.rpc("fn_pix_aut_grupo_reservar_codigo", { p_grupo: grupoId });
    if (resErr) return jsonResponse({ error: resErr.message }, 500);
    const r = resData as unknown as Reserva;
    if (!r?.ok) return jsonResponse({ error: r?.erro ?? "nao_reservado" }, 409);

    // Código anterior ainda pendente: cancela no Inter antes de gerar outro, para nunca haver duas autorizações.
    if (r.id_rec_anterior) {
      const c = await interFetch(`/pix/v2/rec/${r.id_rec_anterior}`, { method: "PATCH", json: { status: "CANCELADA" } });
      if (c.status >= 300) return jsonResponse({ error: "Falha ao cancelar o código anterior no Inter", status: c.status }, 502);
      await sup.from("pix_recorrencias").update({ status: "CANCELADA", motivo_cancelamento: "Substituída por novo código" }).eq("id_rec", r.id_rec_anterior);
    }

    const l = await interFetch("/pix/v2/locrec", { method: "POST" });
    const locId = (l.data as { id?: number } | null)?.id;
    if (l.status >= 300 || locId == null) return jsonResponse({ error: "Falha ao criar o QR no Inter", status: l.status }, 502);

    const rec = await criarRecorrencia(sup, {
      aluno_id: r.aluno_id, valor: Number(r.teto), data_inicio: dataInicioRecorrencia(r.dia_debito, hojeBrasilia()),
      objeto: "Mensalidades FORTEM", loc: Number(locId), vinculo_ref: r.vinculo_ref,
    });
    if (!rec.ok) return jsonResponse({ error: rec.erro, status: rec.status, detail: rec.detail }, rec.httpStatus);
    const idRec = String(rec.idRec);
    const recRow = rec.recorrencia as { id: string; raw_response: Record<string, unknown> | null };

    const g = await interFetch(`/pix/v2/rec/${idRec}`, { method: "GET" });
    const dadosQR = (g.data as { dadosQR?: { pixCopiaECola?: string } } | null)?.dadosQR ?? null;
    const copiaCola = dadosQR?.pixCopiaECola ?? null;
    await sup.from("pix_recorrencias").update({ raw_response: { ...(recRow.raw_response ?? {}), loc: l.data, dadosQR } }).eq("id", recRow.id);

    // Também avisa no app do banco do aluno (Jornada 1). Falha aqui não impede o uso do QR.
    const s = await solicitarConfirmacao(sup, idRec);
    const expira = typeof s.expiracao === "string" ? s.expiracao : new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString();

    const { error: regErr } = await sup.rpc("fn_pix_aut_grupo_registrar_rec", {
      p_grupo: grupoId, p_rec: recRow.id, p_codigo: r.codigo_numero, p_expira: expira,
    });
    if (regErr) return jsonResponse({ error: regErr.message }, 500);

    return jsonResponse({ ok: true, idRec, pix_copia_cola: copiaCola, expira, codigo_numero: r.codigo_numero, solicitacao_app: s.ok });
  } catch (e) {
    console.error("pix-aut-grupo-codigo error", e);
    return jsonResponse({ error: String((e as Error)?.message ?? e) }, 500);
  }
});
