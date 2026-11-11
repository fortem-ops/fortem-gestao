import { assertEquals, assertThrows } from "jsr:@std/assert@1";
import { descricaoPagador, expiraEm, payloadCobPrimeira, valorPix } from "./pix-aut-primeira.ts";

const itens = [{ descricao: "Start", valor: 150 }, { descricao: "Corrida - Start", valor: "170.00" }];

Deno.test("payload soma Start 150 + Corrida 170 = 320 com validade de 48h", () => {
  const p = payloadCobPrimeira({ valor: 320, chave: "k", cpf: "12345678901", nome: "Enio", itens });
  assertEquals(p.valor.original, "320.00");
  assertEquals(p.calendario.expiracao, 172800);
  assertEquals(p.solicitacaoPagador, "FORTEM 1ª mensalidade: Start R$ 150,00 + Corrida - Start R$ 170,00");
});

Deno.test("total diferente da composição não gera cobrança", () => {
  assertThrows(() => payloadCobPrimeira({ valor: 300, chave: "k", cpf: "12345678901", nome: "E", itens }), Error, "composicao_diferente_do_total");
});

Deno.test("validade parte da criação do Inter", () => {
  assertEquals(expiraEm("2026-11-11T10:00:00Z", 172800), "2026-11-13T10:00:00.000Z");
});

Deno.test("valor do aviso pix", () => {
  assertEquals(valorPix("320.00"), 320);
  assertEquals(valorPix("abc"), null);
  assertEquals(descricaoPagador([]).startsWith("FORTEM"), true);
});
