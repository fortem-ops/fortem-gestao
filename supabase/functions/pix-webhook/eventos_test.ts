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

import { mascararAvisoLog } from "./eventos.ts";

Deno.test("log do aviso bruto: CPF só 3 finais, nome só inicial, sem copia e cola nem token", () => {
  const aviso = {
    recs: [{ idRec: "RR1", status: "APROVADA", vinculo: { devedor: { cpf: "12345678909", nome: "Maria da Silva" } },
      dadosQR: { pixCopiaECola: "00020101021226...", jornada: "JORNADA_2" }, token: "abc" }],
    pix: [{ txid: "T1", valor: "1.00", pagador: { cpf: "123.456.789-09" }, infoPagador: "cpf 98765432100" }],
  };
  const s = JSON.stringify(mascararAvisoLog(aviso));
  for (const proibido of ["12345678909", "123.456.789-09", "98765432100", "Maria da Silva", "00020101", "\"abc\""]) {
    assertEquals(s.includes(proibido), false, proibido);
  }
  assertEquals(s.includes("********909"), true);
  assertEquals(s.includes("RR1") && s.includes("T1") && s.includes("JORNADA_2"), true);
  assertEquals(mascararAvisoLog(null), null);
});
