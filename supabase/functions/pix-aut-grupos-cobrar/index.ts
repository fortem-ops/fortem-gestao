// Cobrança mensal Pix Automático por grupo (Etapa 2). Agendada diariamente; também aceita admin.
// Real só para grupos liberados em sistema_config e a partir da data liberada (checado no banco).
import { corsHeaders, jsonResponse, admin, interFetch, genTxid, onlyDigits } from "../_shared/inter.ts";
import { mascararCpf } from "../_shared/pix-rec.ts";
import { executar, type Deps, type Devido, type Reserva } from "./fluxo.ts";

const sup = admin();

async function autorizado(req: Request): Promise<boolean> {
  const sec = req.headers.get("x-webhook-secret");
  if (sec) {
    const { data } = await sup.rpc("get_webhook_secret");
    if (typeof data === "string" && data.length > 0 && data === sec) return true;
  }
  const h = req.headers.get("Authorization") ?? "";
  if (!h.startsWith("Bearer ")) return false;
  const { data: u } = await sup.auth.getUser(h.slice(7));
  if (!u?.user) return false;
  const { data: ok } = await sup.rpc("is_admin", { _user_id: u.user.id });
  return ok === true;
}

async function rpc<T>(fn: string, args: Record<string, unknown>): Promise<T> {
  const { data, error } = await sup.rpc(fn, args);
  if (error) throw new Error(`${fn}: ${error.message}`);
  return data as T;
}

function hojeBrasilia(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
}

const deps: Deps = {
  devidos: async (hoje) => (await rpc<Devido[]>("fn_pix_aut_ciclos_devidos", { p_hoje: hoje })) ?? [],
  simular: async (g, v) => { await rpc("fn_pix_aut_ciclo_simular", { p_grupo: g, p_venc: v }); },
  reservar: (g, v, hoje, txid) => rpc<Reserva>("fn_pix_aut_ciclo_reservar", { p_grupo: g, p_venc: v, p_hoje: hoje, p_txid: txid }),
  consultar: async (txid) => { const r = await interFetch(`/pix/v2/cobr/${txid}`, { method: "GET" }); return { status: r.status, data: r.data }; },
  enviar: async (r) => {
    const { data: aluno } = await sup.from("alunos").select("nome").eq("id", r.aluno!).maybeSingle();
    const { data: cpfRev } = await sup.rpc("fn_reveal_cpf_service", { p_aluno_id: r.aluno });
    const cpf = onlyDigits(cpfRev);
    if (cpf.length !== 11 || !aluno?.nome) return { status: 400, data: { status: "aluno_sem_cpf_ou_nome" } };
    const conta = Deno.env.get("INTER_CONTA_CORRENTE") ?? "";
    const payload = {
      idRec: r.id_rec, infoAdicional: `Mensalidades FORTEM ${r.vencimento}`, ajusteDiaUtil: false,
      calendario: { dataDeVencimento: r.vencimento },
      valor: { original: Number(r.valor).toFixed(2) },
      devedor: { cpf, nome: aluno.nome },
      ...(conta ? { recebedor: { conta, tipoConta: "CORRENTE", agencia: "0001" } } : {}),
    };
    const resp = await interFetch(`/pix/v2/cobr/${r.txid}`, { method: "PUT", json: payload });
    return { status: resp.status, data: mascararCpf(resp.data) as { status?: string } | null };
  },
  enviado: async (c, st, raw) => { await rpc("fn_pix_aut_ciclo_enviado", { p_ciclo: c, p_status_inter: st, p_raw: mascararCpf(raw) ?? {} }); },
  falha: async (c, e) => { await rpc("fn_pix_aut_ciclo_falha", { p_ciclo: c, p_erro: e }); },
  incerto: async (c, e) => { await rpc("fn_pix_aut_ciclo_incerto", { p_ciclo: c, p_erro: e }); },
  janelaPerdida: async (g, v, m) => { await rpc("fn_pix_aut_ciclo_janela_perdida", { p_grupo: g, p_venc: v, p_motivo: m }); },
  novoTxid: genTxid,
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (!(await autorizado(req))) return jsonResponse({ error: "Unauthorized" }, 401);
  try {
    const hoje = hojeBrasilia();
    const migracao = await rpc("fn_pix_aut_migrar_itens", {});
    const resumo = await executar(deps, hoje);
    await sup.from("system_logs").insert({ modulo: "pix-automatico-grupo", acao: "execucao_diaria", mensagem: `hoje ${hoje}`, payload: { resumo, migracao } });
    return jsonResponse({ ok: true, hoje, resumo, migracao });
  } catch (e) {
    await sup.from("system_logs").insert({ modulo: "pix-automatico-grupo", acao: "execucao_erro", mensagem: String(e).slice(0, 400) });
    return jsonResponse({ ok: false, error: "Falha na execução" }, 500);
  }
});
