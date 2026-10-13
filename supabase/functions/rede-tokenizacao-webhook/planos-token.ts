// Desvio do webhook para tokens do checkout /planos (proposta_id, sem aluno).
// Não cria cartoes_salvos, não mexe em contratos e não grava a consulta completa.
import { getRedeAccessToken } from "../_shared/rede-auth.ts";
import { aplicarConsultaToken } from "../_shared/planos-cartao-token.ts";

const URLS = {
  sandbox: "https://rl7-sandbox-api.useredecloud.com.br/token-service/oauth/v2/tokenization",
  producao: "https://api.userede.com.br/redelabs/token-service/oauth/v2/tokenization",
};

export async function tratarTokenPlanos(supabase: any, tokenizationId: string): Promise<void> {
  const amb = (Deno.env.get("REDE_AMBIENTE") ?? "sandbox").trim() === "producao" ? "producao" : "sandbox";
  const token = await getRedeAccessToken((Deno.env.get("REDE_PV") ?? "").trim(), (Deno.env.get("REDE_TOKEN") ?? "").trim(), amb);
  const r = await fetch(`${URLS[amb]}/${tokenizationId}`, { headers: { Authorization: "Bearer " + token, "Content-Type": "application/json" } });
  const consulta = await r.json().catch(() => null);
  const estado = await aplicarConsultaToken(supabase, tokenizationId, consulta);
  console.log("[rede-tokenizacao-webhook] token de proposta", { tokenizationId, estado });
}
