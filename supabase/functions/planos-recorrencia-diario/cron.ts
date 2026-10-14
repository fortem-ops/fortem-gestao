// Helpers puros do acesso pelo cron (x-cron-secret). Sem log, sem I/O.
async function sha256Hex(s: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Compara o hash do segredo recebido com o hash guardado em tempo constante. */
export async function segredoConfere(segredo: string, hashEsperado: string): Promise<boolean> {
  const a = await sha256Hex(segredo);
  const b = (hashEsperado ?? "").toLowerCase();
  if (b.length !== a.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** O cron só pode rodar o modo real normal: nunca simulação nem teste real. */
export function modoCronPermitido(body: unknown): boolean {
  const modo = (body as { modo?: unknown } | null)?.modo;
  return modo === undefined || modo === null || modo === "real";
}
