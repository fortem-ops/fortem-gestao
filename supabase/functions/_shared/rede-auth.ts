// OAuth 2.0 helper para e-Rede
// Ref: Tutorial oficial Rede — "Tutorial de autenticação e transação via OAuth 2.0"
//
// Fluxo:
// 1. POST ao endpoint OAuth com Authorization: Basic Base64(clientId:clientSecret)
//    e body: grant_type=client_credentials
// 2. Receber access_token (duração 24 minutos)
// 3. Usar Authorization: Bearer {access_token} nas chamadas transacionais
//
// Endpoints:
// Produção: https://api.userede.com.br/redelabs/oauth2/token
// Sandbox:  https://rl7sandbox-api.useredecloud.com.br/oauth2/token

let cachedToken: string | null = null;
let tokenExpiresAt = 0;

export async function getRedeAccessToken(
  clientId: string,
  clientSecret: string,
  ambiente: string,
): Promise<string> {
  const now = Date.now();

  // Retornar token em cache se ainda válido (com 2min de margem)
  if (cachedToken && now < tokenExpiresAt - 120_000) {
    console.log("[rede-auth] usando token em cache");
    return cachedToken;
  }

  // URL correta por ambiente (conforme tutorial oficial Rede)
  const authUrl = ambiente === "producao"
    ? "https://api.userede.com.br/redelabs/oauth2/token"
    : "https://rl7-sandbox-api.useredecloud.com.br/oauth2/token";

  // Authorization: Basic Base64(clientId:clientSecret) — conforme tutorial Rede
  const basicCredential = btoa(`${clientId}:${clientSecret}`);

  console.log("[rede-auth] obtendo token em:", authUrl);

  const resp = await fetch(authUrl, {
    method: "POST",
    headers: {
      "Authorization": `Basic ${basicCredential}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`OAuth Rede falhou (${resp.status}): ${text.slice(0, 300)}`);
  }

  const data = await resp.json();

  if (!data.access_token) {
    throw new Error(`OAuth Rede: access_token ausente na resposta: ${JSON.stringify(data).slice(0, 200)}`);
  }

  cachedToken = data.access_token as string;
  // expires_in em segundos (normalmente 1440 = 24 minutos)
  tokenExpiresAt = now + (Number(data.expires_in) || 1440) * 1000;

  console.log("[rede-auth] novo access_token obtido, expira em", data.expires_in ?? 1440, "segundos");
  return cachedToken!;
}
