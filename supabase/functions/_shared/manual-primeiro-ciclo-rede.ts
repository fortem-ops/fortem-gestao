import { getRedeAccessToken } from "./rede-auth.ts";
import { loadSecrets, resolveRedeBaseUrl, resolveTokenServiceUrl, buildReference, normalizeCardholderName, formatExpirationMonth } from "./rede-payload.ts";
import { cobrarComToken } from "./rede-recorrencia-core.ts";

// Só usa o cartão pertencente à venda, sem aceitar valor do navegador.
export async function cobrarTokenManual(db: any, vendaId: string, cartaoId: string, centavos: number) {
  const { data: cartao } = await db.from("cartoes_salvos").select("token_rede,holder_name,expiration_month,expiration_year,ativo").eq("id", cartaoId).single();
  const { data: token } = await db.from("rede_tokenizacoes").select("tokenization_id").eq("cartao_salvo_id", cartaoId).eq("status", "active").order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (!cartao?.ativo || !token?.tokenization_id) throw new Error("Cartão ou token inativo; nada foi cobrado");
  const s = await loadSecrets(db);
  const amb = s.rede_ambiente === "producao" ? "producao" : "sandbox";
  const accessToken = await getRedeAccessToken(s.rede_pv, s.rede_token, amb);
  return cobrarComToken({ tokenizationId: token.tokenization_id, amountCentavos: centavos, installments: 1, reference: buildReference(vendaId), cardNumber: cartao.token_rede, cardholderName: normalizeCardholderName(cartao.holder_name), expirationMonth: formatExpirationMonth(cartao.expiration_month), expirationYear: String(cartao.expiration_year), accessToken, baseUrl: resolveRedeBaseUrl(amb), tokenServiceBaseUrl: resolveTokenServiceUrl(amb) });
}