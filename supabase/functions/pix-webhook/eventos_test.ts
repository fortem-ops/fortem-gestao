import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { extrairEventos, statusRec, statusCobr, podeAtualizarRec, mascararCpf } from "./eventos.ts";

Deno.test("aviso real do Inter: lista recs com APROVADA vira AUTORIZADA", () => {
  const ev = extrairEventos({ recs: [{ idRec: "RR1", status: "APROVADA", ativacao: { tipoJornada: "JORNADA_2" } }] });
  assertEquals(ev.length, 1);
  assertEquals(ev[0].origem, "rec");
  assertEquals(statusRec(ev[0].ev), "AUTORIZADA");
});

Deno.test("lista antiga rec e tipo REC_AUTORIZADA continuam aceitos", () => {
  assertEquals(extrairEventos({ rec: [{ idRec: "x" }] })[0].origem, "rec");
  assertEquals(statusRec({ tipo: "REC_AUTORIZADA" }), "AUTORIZADA");
});

Deno.test("cobrança: cobr, cobrs e cobsr são cobranças, não recorrências", () => {
  for (const k of ["cobr", "cobrs", "cobsr"]) {
    const ev = extrairEventos({ [k]: [{ txid: "t", status: "CANCELADA" }] });
    assertEquals(ev[0].origem, "cobr");
  }
});

Deno.test("status de cobrança: CONCLUIDA e LIQUIDADA liquidam; ATIVA agenda", () => {
  assertEquals(statusCobr({ status: "CONCLUIDA" }), "LIQUIDADA");
  assertEquals(statusCobr({ status: "LIQUIDADA" }), "LIQUIDADA");
  assertEquals(statusCobr({ status: "ATIVA" }), "AGENDADA");
  assertEquals(statusCobr({ status: "XYZ" }), null);
});

Deno.test("idempotência: mesmo status não atualiza; estado final não volta", () => {
  assertEquals(podeAtualizarRec("AUTORIZADA", "AUTORIZADA"), false);
  assertEquals(podeAtualizarRec("CRIADA", "AUTORIZADA"), true);
  assertEquals(podeAtualizarRec("CANCELADA", "AUTORIZADA"), false);
  assertEquals(podeAtualizarRec("AUTORIZADA", "CRIADA"), false);
});

Deno.test("CPF é mascarado no registro", () => {
  assertEquals(JSON.stringify(mascararCpf({ cpf: "12345678901" })), '{"cpf":"********901"}');
});
