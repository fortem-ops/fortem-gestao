import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { modoCronPermitido, segredoConfere } from "./cron.ts";

async function hash(s: string) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}
const SEG = "a".repeat(64);

Deno.test("cron: segredo certo confere", async () => {
  assertEquals(await segredoConfere(SEG, await hash(SEG)), true);
});
Deno.test("cron: segredo errado recusa", async () => {
  assertEquals(await segredoConfere("b".repeat(64), await hash(SEG)), false);
});
Deno.test("cron: sem segredo/hash vazio recusa", async () => {
  assertEquals(await segredoConfere("", await hash(SEG)), false);
  assertEquals(await segredoConfere(SEG, ""), false);
});
Deno.test("cron: só modo real; simulação e teste real recusados", () => {
  assertEquals(modoCronPermitido({}), true);
  assertEquals(modoCronPermitido({ trigger: "cron" }), true);
  assertEquals(modoCronPermitido({ modo: "real" }), true);
  assertEquals(modoCronPermitido({ modo: "simulacao" }), false);
  assertEquals(modoCronPermitido({ modo: "teste_real" }), false);
});
