import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { executar, type Deps, type Devido } from "./fluxo.ts";

const dev = (p: Partial<Devido>): Devido => ({ grupo: "g", aluno: "a", vencimento: "2026-12-12", acao: "enviar", modo: "real",
  ciclo_status: null, txid: null, composicao: { completo: true, valor: 320, itens: [], faltando: [] }, ...p });

function mk(over: Partial<Deps>, log: string[]): Deps {
  return {
    devidos: async () => [], simular: async () => { log.push("simular"); },
    reservar: async () => ({ ok: true, ciclo: "c", txid: "t", valor: 320, vencimento: "2026-12-12", aluno: "a", id_rec: "r" }),
    consultar: async () => ({ status: 404, data: null }),
    enviar: async () => { log.push("enviar"); return { status: 201, data: { status: "CRIADA" } }; },
    enviado: async () => { log.push("enviado"); }, falha: async () => { log.push("falha"); },
    incerto: async () => { log.push("incerto"); }, janelaPerdida: async () => { log.push("janela"); }, novoTxid: () => "novo", ...over,
  };
}

Deno.test("simulação nunca chama o Inter", async () => {
  const log: string[] = [];
  await executar(mk({ devidos: async () => [dev({ acao: "simular", modo: "simulacao" })] }, log), "2026-12-05");
  assertEquals(log, ["simular"]);
});
Deno.test("erro 5xx mantém reserva (incerto), 4xx solta (falha)", async () => {
  const l1: string[] = [];
  await executar(mk({ devidos: async () => [dev({})], enviar: async () => ({ status: 503, data: null }) }, l1), "2026-12-05");
  assertEquals(l1, ["incerto"]);
  const l2: string[] = [];
  await executar(mk({ devidos: async () => [dev({})], enviar: async () => ({ status: 400, data: null }) }, l2), "2026-12-05");
  assertEquals(l2, ["falha"]);
});
Deno.test("retomada confere no Inter antes de reenviar (sem cobrança dupla)", async () => {
  const log: string[] = [];
  await executar(mk({ devidos: async () => [dev({})],
    reservar: async () => ({ ok: true, retomada: true, ciclo: "c", txid: "t" }),
    consultar: async () => ({ status: 200, data: { status: "ATIVA" } }) }, log), "2026-12-06");
  assertEquals(log, ["enviado"]);
});
Deno.test("reserva recusada (incompleto) não envia", async () => {
  const log: string[] = [];
  const r = await executar(mk({ devidos: async () => [dev({})], reservar: async () => ({ ok: false, motivo: "incompleto" }) }, log), "2026-12-05");
  assertEquals(log, []); assertEquals(r.aguardando.length, 1);
});
Deno.test("janela perdida com reserva: confere no Inter; se existe, registra enviado e não solta", async () => {
  const log: string[] = [];
  await executar(mk({ devidos: async () => [dev({ acao: "janela_perdida", ciclo: "c", ciclo_status: "reservado", txid: "t" })],
    consultar: async () => ({ status: 200, data: { status: "ATIVA" } }) }, log), "2026-12-10");
  assertEquals(log, ["enviado"]);
});
