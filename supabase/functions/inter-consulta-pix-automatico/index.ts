// Consulta SOMENTE-LEITURA ao Inter (Pix Automático): só GET, nada é criado no banco.
import { jsonResponse, corsHeaders, interFetch, admin, requireAdminOrCoord, consultarEscoposInter } from "../_shared/inter.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  // Acesso: admin logado, ou chamada interna do banco com o segredo interno (mesmo padrão das rotinas agendadas).
  const segredo = req.headers.get("x-webhook-secret");
  let interno = false;
  if (segredo) {
    const { data } = await admin().rpc("get_webhook_secret");
    interno = typeof data === "string" && data.length > 0 && data === segredo;
  }
  if (!interno) {
    const auth = await requireAdminOrCoord(req);
    if ("error" in auth) return auth.error;
    const { data: isA } = await admin().rpc("is_admin", { _user_id: auth.userId });
    if (!isA) return jsonResponse({ error: "Forbidden" }, 403);
  }

  const fim = new Date();
  const ini = new Date(fim.getTime() - 3 * 24 * 3600 * 1000);
  const periodo = `inicio=${encodeURIComponent(ini.toISOString())}&fim=${encodeURIComponent(fim.toISOString())}`;
  const chave = Deno.env.get("INTER_PIX_CHAVE") ?? "";

  let escopos: string | null = null;
  let oauth = "ok";
  try {
    escopos = (await consultarEscoposInter()).escopos;
  } catch (e) {
    oauth = String((e as Error)?.message ?? e).slice(0, 200);
  }

  const consultas: Record<string, string> = {
    rec: `/pix/v2/rec?${periodo}`,
    solicrec: `/pix/v2/solicrec?${periodo}`,
    cobr: `/pix/v2/cobr?${periodo}`,
    webhookrec: `/pix/v2/webhookrec`,
    webhookcobr: `/pix/v2/webhookcobr`,
    webhook_pix: chave ? `/pix/v2/webhook/${encodeURIComponent(chave)}` : "",
  };
  const resultados: Record<string, unknown> = {};
  for (const [nome, path] of Object.entries(consultas)) {
    if (!path) { resultados[nome] = { status: null, motivo: "sem chave Pix" }; continue; }
    try {
      const { status, data } = await interFetch(path, { method: "GET" });
      const resumo: Record<string, unknown> = { status };
      if (status >= 400) resumo.erro = typeof data === "object" ? (data?.title ?? data?.detail ?? data?.message ?? null) : String(data).slice(0, 120);
      else if (data && typeof data === "object") {
        const lista = data.recs ?? data.solicitacoes ?? data.cobsr ?? data.cobs ?? null;
        if (Array.isArray(lista)) resumo.itens = lista.length;
        if (nome.startsWith("webhook")) resumo.webhook_cadastrado = !!data.webhookUrl;
      }
      resultados[nome] = resumo;
    } catch (e) {
      resultados[nome] = { status: null, erro: String((e as Error)?.message ?? e).slice(0, 160) };
    }
  }
  return jsonResponse({ somente_leitura: true, oauth, escopos, resultados });
});
