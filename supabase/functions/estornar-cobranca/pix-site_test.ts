import { assertEquals } from "jsr:@std/assert@1";
import { bloqueioTeste, devolverPixSite, type DepsPix } from "./pix-site.ts";

function deps(over: Partial<DepsPix> = {}) {
  const log: string[] = [];
  const d: DepsPix = {
    reservar: async () => ({ ok: true, estorno_id: "e1", txid: "tx1", valor: 51.48, devolucao_id: "dev1", e2e_salvo: "E2E" }),
    consultarE2e: async () => "E2E-CONSULTA",
    devolver: async (e2e, id, valor) => { log.push(`devolver:${e2e}:${id}:${valor}`); return { status: 201, data: { status: "EM_PROCESSAMENTO" } }; },
    resultado: async (_id, st) => { log.push(`resultado:${st}`); },
    ...over,
  };
  return { d, log };
}

Deno.test("devolve com e2e salvo e registra devolvido", async () => {
  const { d, log } = deps();
  const r = await devolverPixSite(d);
  assertEquals(r.ok, true);
  assertEquals(log, ["devolver:E2E:dev1:51.48", "resultado:devolvido"]);
});

Deno.test("reserva recusada (duplicado) não chama o banco", async () => {
  const { d, log } = deps({ reservar: async () => ({ ok: false, duplicado: true, erro: "já enviada" }) });
  const r = await devolverPixSite(d);
  assertEquals(r.ok, false);
  assertEquals(log, []);
});

Deno.test("erro de comunicação fica desconhecido (nunca libera nova devolução)", async () => {
  const { d, log } = deps({ devolver: async () => { throw new Error("timeout"); } });
  const r = await devolverPixSite(d);
  assertEquals(r.ok, false);
  assertEquals(log, ["resultado:desconhecido"]);
});

Deno.test("recusa do banco registra recusado", async () => {
  const { d, log } = deps({ devolver: async () => ({ status: 400, data: { detail: "saldo" } }) });
  const r = await devolverPixSite(d);
  assertEquals(r.ok, false);
  assertEquals(log, ["resultado:recusado"]);
});

Deno.test("sem e2e não devolve", async () => {
  const { d, log } = deps({ reservar: async () => ({ ok: true, estorno_id: "e1", txid: "tx1", valor: 1, devolucao_id: "d", e2e_salvo: null }), consultarE2e: async () => null });
  const r = await devolverPixSite(d);
  assertEquals(r.ok, false);
  assertEquals(log, ["resultado:recusado"]);
});

Deno.test("cobrança de teste exige confirmação", () => {
  assertEquals(typeof bloqueioTeste("teste_2027", false), "string");
  assertEquals(bloqueioTeste("teste_2027", true), null);
  assertEquals(bloqueioTeste("site_2027", false), null);
  assertEquals(bloqueioTeste(null, false), null);
});
