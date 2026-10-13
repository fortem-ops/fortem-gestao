import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { ehCobrancaPlanos, valorEmCentavos, baixarPixProposta } from "./planos-baixa.ts";

Deno.test("desvio só para cobrança com proposta, sem pedido e sem corrida", () => {
  assertEquals(ehCobrancaPlanos({ id: "1", proposta_id: "p" }), true);
  assertEquals(ehCobrancaPlanos({ id: "1", proposta_id: "p", pedido_id: "x" }), false); // Loja
  assertEquals(ehCobrancaPlanos({ id: "1", proposta_id: "p", corrida_venda_id: "v" }), false); // Corrida
  assertEquals(ehCobrancaPlanos({ id: "1" }), false); // mensalidade
});

Deno.test("valor do aviso vira centavos exatos", () => {
  assertEquals(valorEmCentavos("1.00"), 100);
  assertEquals(valorEmCentavos("1234.56"), 123456);
  assertEquals(valorEmCentavos(""), null);
});

function falso(resultado: string) {
  const logs: any[] = [];
  return { logs, sup: { rpc: async () => ({ data: { resultado }, error: null }), from: () => ({ insert: async (r: any) => { logs.push(r); } }) } };
}

Deno.test("aviso repetido não gera erro nem log; divergência registra sem CPF", async () => {
  const a = falso("ja_processado");
  assertEquals(await baixarPixProposta(a.sup, "t1", { valor: "1.00" }), "ja_processado");
  assertEquals(a.logs.length, 0);
  const b = falso("valor_divergente");
  await baixarPixProposta(b.sup, "t1", { valor: "2.00", pagador: { cpf: "12345678901" } });
  assertEquals(b.logs.length, 1);
  assertEquals(JSON.stringify(b.logs[0]).includes("12345678901"), false);
});
