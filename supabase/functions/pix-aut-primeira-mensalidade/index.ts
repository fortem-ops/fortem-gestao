// Pix imediato (/cob) da 1ª mensalidade de um grupo de Pix Automático. Só admin; sem cobrança silenciosa:
// só roda quando a equipe clica em "Gerar Pix da 1ª mensalidade". Idempotente por grupo + mês + finalidade.
import { corsHeaders, jsonResponse, admin, requireAdmin, genTxid, onlyDigits } from "../_shared/inter.ts";
import { interCobFetch } from "../_shared/inter-cob.ts";
import { expiraEm, payloadCobPrimeira, type ItemComposicao } from "../_shared/pix-aut-primeira.ts";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface Reserva {
  ok: boolean; motivo?: string; acao?: "nova" | "retomada" | "reaproveitada"; id?: string; txid?: string;
  valor?: number | string; aluno?: string; pix_copia_cola?: string | null; expira_em?: string;
  composicao?: { itens?: ItemComposicao[] };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const auth = await requireAdmin(req);
    if (!("userId" in auth)) return auth.error ?? jsonResponse({ error: "Unauthorized" }, 401);
    const body: unknown = await req.json().catch(() => null);
    const grupoId = (body as { grupo_id?: unknown } | null)?.grupo_id;
    if (typeof grupoId !== "string" || !UUID.test(grupoId)) return jsonResponse({ error: "grupo_id inválido" }, 400);
    const chave = Deno.env.get("INTER_PIX_CHAVE");
    if (!chave) return jsonResponse({ error: "chave_pix_nao_configurada" }, 500);

    const sup = admin();
    const { data, error } = await sup.rpc("fn_pix_aut_primeira_reservar", { p_grupo: grupoId, p_txid: genTxid(), p_usuario: auth.userId });
    if (error) return jsonResponse({ error: error.message }, 500);
    const r = data as unknown as Reserva;
    if (!r?.ok) return jsonResponse({ error: r?.motivo ?? "nao_reservado", composicao: r?.composicao ?? null }, 409);
    if (r.acao === "reaproveitada") {
      return jsonResponse({ ok: true, acao: r.acao, txid: r.txid, valor: Number(r.valor), pix_copia_cola: r.pix_copia_cola, expira_em: r.expira_em, composicao: r.composicao });
    }

    const txid = r.txid!;
    const itens = r.composicao?.itens ?? [];
    const { data: aluno } = await sup.from("alunos").select("nome, cpf").eq("id", r.aluno!).maybeSingle();
    let payload;
    try {
      payload = payloadCobPrimeira({ valor: Number(r.valor), chave, cpf: onlyDigits(aluno?.cpf ?? ""), nome: aluno?.nome ?? "Aluno", itens });
    } catch (e) {
      await sup.rpc("fn_pix_aut_primeira_falha", { p_id: r.id, p_erro: String((e as Error).message) });
      return jsonResponse({ error: String((e as Error).message) }, 409);
    }

    let res = await interCobFetch(`/pix/v2/cob/${txid}`, { method: "PUT", json: payload });
    if (res.status >= 300 && r.acao === "retomada") {
      // Tentativa anterior pode ter criado a cobrança no Inter: consulta o mesmo txid antes de desistir.
      const g = await interCobFetch(`/pix/v2/cob/${txid}`, { method: "GET" });
      if (g.status < 300 && g.data?.status === "ATIVA") res = g;
    }
    const copia = res.status < 300 ? (res.data?.pixCopiaECola as string | undefined) : undefined;
    if (!copia) {
      await sup.rpc("fn_pix_aut_primeira_falha", { p_id: r.id, p_erro: `Inter /cob ${res.status}: ${String(res.raw ?? "").slice(0, 300)}` });
      return jsonResponse({ error: "Falha ao criar o Pix no Inter", status: res.status }, 502);
    }
    const expira = expiraEm(res.data?.calendario?.criacao, res.data?.calendario?.expiracao);
    const { error: aErr } = await sup.rpc("fn_pix_aut_primeira_ativar", {
      p_id: r.id, p_copia: copia, p_expira: expira,
      p_raw: { status: res.data?.status ?? null, calendario: res.data?.calendario ?? null, loc: res.data?.loc ?? null, revisao: res.data?.revisao ?? null },
    });
    if (aErr) return jsonResponse({ error: aErr.message }, 500);
    return jsonResponse({ ok: true, acao: r.acao, txid, valor: Number(r.valor), pix_copia_cola: copia, expira_em: expira, composicao: r.composicao });
  } catch (e) {
    console.error("pix-aut-primeira-mensalidade error", e);
    return jsonResponse({ error: String((e as Error)?.message ?? e) }, 500);
  }
});
