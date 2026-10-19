// Atualiza sob demanda o cache do IPCA (BCB SGS 433; reserva IBGE/SIDRA 1737).
// Só lê índices públicos e grava em ipca_indices. Não cobra nada.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

type Linha = { mes: string; variacao: number; fonte: string };

async function bcb(): Promise<Linha[]> {
  const r = await fetch("https://api.bcb.gov.br/dados/serie/bcdata.sgs.433/dados/ultimos/36?formato=json", { signal: AbortSignal.timeout(10000) });
  if (!r.ok) throw new Error(`BCB ${r.status}`);
  const d = (await r.json()) as { data: string; valor: string }[];
  return d.map((x) => {
    const [, mm, yyyy] = x.data.split("/");
    return { mes: `${yyyy}-${mm}-01`, variacao: Number(x.valor), fonte: "BCB SGS 433" };
  }).filter((l) => Number.isFinite(l.variacao));
}

async function sidra(): Promise<Linha[]> {
  const r = await fetch("https://apisidra.ibge.gov.br/values/t/1737/n1/all/v/63/p/last%2036", { signal: AbortSignal.timeout(10000) });
  if (!r.ok) throw new Error(`SIDRA ${r.status}`);
  const d = (await r.json()) as Record<string, string>[];
  return d.slice(1).map((x) => ({
    mes: `${x.D3C.slice(0, 4)}-${x.D3C.slice(4, 6)}-01`, variacao: Number(x.V), fonte: "IBGE SIDRA 1737",
  })).filter((l) => Number.isFinite(l.variacao));
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const auth = req.headers.get("Authorization") ?? "";
  const userClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: auth } },
  });
  const { data: u } = await userClient.auth.getUser();
  if (!u?.user) return json(401, { error: "nao_autenticado" });
  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data: roles } = await admin.from("user_roles").select("role").eq("user_id", u.user.id);
  if (!(roles ?? []).some((r) => r.role !== "aluno")) return json(403, { error: "sem_permissao" });

  const erros: string[] = [];
  let linhas: Linha[] = [];
  for (const fonte of [bcb, sidra]) {
    try {
      linhas = await fonte();
      if (linhas.length) break;
    } catch (e) {
      erros.push(String((e as Error).message ?? e));
    }
  }
  if (!linhas.length) return json(200, { ok: false, erros });
  const agora = new Date().toISOString();
  const { error } = await admin.from("ipca_indices").upsert(linhas.map((l) => ({ ...l, atualizado_em: agora })), { onConflict: "mes" });
  if (error) return json(200, { ok: false, erros: [...erros, error.message] });
  return json(200, { ok: true, fonte: linhas[0].fonte, meses: linhas.length, ultimo: linhas.map((l) => l.mes).sort().pop(), erros });
});
