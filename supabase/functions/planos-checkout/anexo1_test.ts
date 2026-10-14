import { assertEquals, assertThrows, assert } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { ANEXO1_VERSAO, ErroAnexo, blocoAnexo, lerAnexo } from "./anexo1.ts";

const ok = { versao: ANEXO1_VERSAO, medical_status: "ok", image_usage: true, lgpd: true, termos_lidos: true,
  emergency_contact_name: "Maria Silva", emergency_contact_phone: "(51) 99999-1234" };
const ass = "data:image/png;base64,AAAA";

Deno.test("anexo válido normaliza telefone", () => {
  const r = lerAnexo(ok, ass);
  assertEquals(r.anexo.emergency_contact_phone, "51999991234");
  assertEquals(r.anexo.medical_status, "ok");
});

Deno.test("anexo exige as duas respostas, termos, contato e assinatura", () => {
  assertThrows(() => lerAnexo({ ...ok, medical_status: null }, ass), ErroAnexo, "Avaliação Médica");
  assertThrows(() => lerAnexo({ ...ok, image_usage: undefined }, ass), ErroAnexo, "Uso de Imagem");
  assertThrows(() => lerAnexo({ ...ok, lgpd: false }, ass), ErroAnexo, "termos");
  assertThrows(() => lerAnexo({ ...ok, emergency_contact_phone: "123" }, ass), ErroAnexo, "emergência");
  assertThrows(() => lerAnexo(ok, null), ErroAnexo, "Assine");
  assertThrows(() => lerAnexo({ ...ok, versao: "x" }, ass), ErroAnexo, "ANEXO I");
  assertThrows(() => lerAnexo(undefined, ass), ErroAnexo);
});

Deno.test("bloco do anexo traz respostas, versão e telefone mascarado", () => {
  const { anexo } = lerAnexo({ ...ok, medical_status: "restricao", image_usage: false }, ass);
  const h = blocoAnexo(anexo, "Fulano <b>", new Date("2026-10-14T17:00:00Z"));
  assert(h.includes("com restrições"));
  assert(h.includes("Direito de Uso de Imagem: Não autorizo"));
  assert(h.includes(ANEXO1_VERSAO));
  assert(h.includes("*****-1234") && !h.includes("51999991234"));
  assert(h.includes("Fulano &lt;b&gt;"));
});
