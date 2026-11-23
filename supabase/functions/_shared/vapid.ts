// Configuração VAPID compartilhada pelo push do aluno e da equipe.
import webpush from "npm:web-push@3.6.7";

function b64urlToBytes(s: string): Uint8Array {
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(s.length / 4) * 4, "=");
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
}

/**
 * web-push exige a chave privada como escalar bruto de 32 bytes (base64url).
 * Se a chave configurada estiver em PKCS8, extraímos o escalar `d` sem trocar o par.
 */
async function normalizeVapidPrivateKey(privateKey: string, publicKey: string): Promise<string> {
  const bytes = b64urlToBytes(privateKey.trim());
  if (bytes.length === 32) return privateKey.trim();
  const key = await crypto.subtle.importKey("pkcs8", bytes, { name: "ECDSA", namedCurve: "P-256" }, true, ["sign"]);
  const jwk = await crypto.subtle.exportKey("jwk", key);
  if (!jwk.d) throw new Error("PKCS8 key without private scalar");
  if (jwk.x && jwk.y) {
    const derivedPub = new Uint8Array([4, ...b64urlToBytes(jwk.x), ...b64urlToBytes(jwk.y)]);
    const configuredPub = b64urlToBytes(publicKey.trim());
    const same = derivedPub.length === configuredPub.length && derivedPub.every((b, i) => b === configuredPub[i]);
    if (!same) console.warn("[vapid] VAPID_PUBLIC_KEY não corresponde à chave privada configurada");
  }
  return jwk.d;
}

let cached: string | null = null;

/** Configura o web-push; devolve a mensagem de erro ou null. */
export async function configurarVapid(): Promise<string | null> {
  const pub = Deno.env.get("VAPID_PUBLIC_KEY");
  const priv = Deno.env.get("VAPID_PRIVATE_KEY_RAW") ?? Deno.env.get("VAPID_PRIVATE_KEY");
  const subject = Deno.env.get("VAPID_SUBJECT") ?? "mailto:contato@fortem.app";
  if (!pub || !priv) return "VAPID keys not configured";
  try {
    cached ??= await normalizeVapidPrivateKey(priv, pub);
    webpush.setVapidDetails(subject, pub.trim(), cached);
    return null;
  } catch (e) {
    return "Invalid VAPID keys: " + (e as Error).message;
  }
}

export { webpush };
