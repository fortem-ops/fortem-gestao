/** Turnstile do cadastro /planos. Chave desligada = comportamento atual; ligada sem segredo = recusa (nunca libera). */
export type ResultadoTurnstile = "livre" | "ok" | "recusado";
type Verificador = (secret: string, token: string, ip: string) => Promise<boolean>;

export const verificarNaCloudflare: Verificador = async (secret, token, ip) => {
  const form = new FormData();
  form.append("secret", secret); form.append("response", token); if (ip) form.append("remoteip", ip);
  const r = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", { method: "POST", body: form });
  return (await r.json().catch(() => ({})))?.success === true;
};

export async function avaliarTurnstile(
  ativo: unknown, secret: string | undefined, token: unknown, ip: string, verificar: Verificador = verificarNaCloudflare,
): Promise<ResultadoTurnstile> {
  if (ativo !== true) return "livre";
  if (!secret || typeof token !== "string" || !token || token.length > 2048) return "recusado";
  try { return (await verificar(secret, token, ip)) ? "ok" : "recusado"; } catch { return "recusado"; }
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const passeValido = (v: unknown): v is string => typeof v === "string" && UUID.test(v);
