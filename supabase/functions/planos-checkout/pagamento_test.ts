import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { chavesLimite, cobrancaValida, gravarComRetentativa } from "./pagamento.ts";

const agora = Date.parse("2026-10-13T12:00:00Z");
const criada = (minAtras: number) => new Date(agora - minAtras * 60_000).toISOString();

Deno.test("reuso: cobrança ativa com 10 min é reaproveitada", () => {
  assertEquals(cobrancaValida({ status: "ATIVA", created_at: criada(10) }, agora), true);
});
Deno.test("reuso: com 29,5 min (dentro da margem de 60 s) já não é reaproveitada", () => {
  assertEquals(cobrancaValida({ status: "ATIVA", created_at: criada(29.5) }, agora), false);
});
Deno.test("reuso: vencida (31 min), EXPIRADA ou LIQUIDADA nunca é reaproveitada", () => {
  assertEquals(cobrancaValida({ status: "ATIVA", created_at: criada(31) }, agora), false);
  assertEquals(cobrancaValida({ status: "EXPIRADA", created_at: criada(1) }, agora), false);
  assertEquals(cobrancaValida({ status: "LIQUIDADA", created_at: criada(1) }, agora), false);
  assertEquals(cobrancaValida(null, agora), false);
});

Deno.test("polling: status_pagamento e estado não usam a cota de 120/h por IP", () => {
  for (const a of ["status_pagamento", "estado"]) {
    const l = chavesLimite(a, "1.2.3.4", "p1");
    assertEquals(l.some((x) => x.chave.startsWith("ckf:i:")), false);
    assertEquals(l.find((x) => x.chave === "ckc:p:p1")?.limite, 600);
  }
});
Deno.test("polling: 30 min a cada 8 s cabe na cota por proposta; 20 pessoas na mesma rede cabem na cota do IP", () => {
  const porVisitante = Math.ceil((30 * 60) / 8);
  const [porProposta, porIp] = chavesLimite("status_pagamento", "1.2.3.4", "p1");
  assertEquals(porVisitante <= porProposta.limite, true);
  assertEquals(20 * (3600 / 8) <= porIp.limite, true);
});
Deno.test("demais ações seguem 120/h por IP", () => {
  assertEquals(chavesLimite("pagar_pix", "1.2.3.4", "p1"), [{ chave: "ckf:i:1.2.3.4", limite: 120 }]);
});

Deno.test("registro: falha uma vez e grava na segunda tentativa", async () => {
  let n = 0;
  assertEquals(await gravarComRetentativa(async () => ({ error: ++n === 1 ? new Error("x") : null })), true);
  assertEquals(n, 2);
});
Deno.test("registro: falha duas vezes devolve false (gera aviso + log + mensagem neutra)", async () => {
  let n = 0;
  assertEquals(await gravarComRetentativa(async () => { n++; throw new Error("x"); }), false);
  assertEquals(n, 2);
});

import { ACOES_COBRANCA as _AC, temConsultas as _tc } from "./pagamento.ts";
Deno.test("site vende só o plano: proposta com consultas não cobra", () => {
  if (!_tc(["nutri_4"]) || _tc([]) || _tc(null) || _tc([""])) throw new Error("temConsultas");
  for (const a of ["pagar_pix", "pagar_cartao", "tokenizar_cartao", "cartao_combinar"]) if (!_AC.has(a)) throw new Error(a);
  if (_AC.has("estado") || _AC.has("status_pagamento")) throw new Error("consulta bloqueada");
});
