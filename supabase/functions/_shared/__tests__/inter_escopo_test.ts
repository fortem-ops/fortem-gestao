import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { escopoContido, SCOPES_PIX_AUTOMATICO, CRED_PIX_AUTOMATICO } from "../inter.ts";

const LOJA = "cob.write cob.read webhook.write webhook.read pix.write pix.read";

Deno.test("Pix Automático usa por padrão as credenciais INTER_COB_*", () => {
  assertEquals(CRED_PIX_AUTOMATICO, "cob");
});
Deno.test("Pix Automático pede os 18 escopos", () => {
  assertEquals(SCOPES_PIX_AUTOMATICO.split(" ").length, 18);
});
Deno.test("token da Loja (6 escopos) não serve ao Pix Automático", () => {
  assert(!escopoContido(SCOPES_PIX_AUTOMATICO, LOJA));
});
Deno.test("token do Pix Automático cobre o pedido de 18 escopos", () => {
  assert(escopoContido(SCOPES_PIX_AUTOMATICO, SCOPES_PIX_AUTOMATICO));
});
Deno.test("token sem escopo não é reaproveitado", () => {
  assert(!escopoContido("rec.read", null));
});
