// OAuth 2.0 helper para e-Rede
// Endpoint OAuth: https://auth.userede.com.br/oauth2/token (prod)
// Grant type: client_credentials
// Token expira em ~24min — cache em memória do worker

let cachedToken: string | null = null;
let tokenExpiresAt = 0;

export async function getRedeAccessToken(
  clientId: string,
  clientSecret: string,
  ambiente: string,
): Promise<string> {
  const now = Date.now();

  if (cachedToken && now < tokenExpiresAt - 120_000) {
    return cachedToken;
  }

  // Sandbox e produção usam mesma URL — distinção pelas credenciais
  const authUrl = "https://api.userede.com.br/redelabs/oauth2/token";

  const body = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: clientId,
    client_secret: clientSecret,
  });

  const resp = await fetch(authUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`OAuth Rede falhou (${resp.status}): ${text.slice(0, 300)}`);
  }

  const data = await resp.json();
  cachedToken = data.access_token as string;
  tokenExpiresAt = now + (Number(data.expires_in) || 1440) * 1000;

  console.log("[rede-auth] novo access_token obtido, expira em", data.expires_in, "s");
  return cachedToken!;
}
