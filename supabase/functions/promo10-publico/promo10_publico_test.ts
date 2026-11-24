import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  ehEquipePorPapel,
  podeReenviar,
  primeiroNome,
  promo10Encerrada,
} from "../_shared/promo10-publico.ts";

Deno.test("promo10-publico: prazo de encerramento em Brasília", () => {
  assertEquals(promo10Encerrada(new Date("2027-01-01T02:59:59Z")), false);
  assertEquals(promo10Encerrada(new Date("2027-01-01T03:00:00Z")), true);
});

Deno.test("promo10-publico: reenvio exige 60 segundos", () => {
  const t0 = Date.parse("2026-11-24T12:00:00Z");
  assertEquals(podeReenviar("2026-11-24T12:00:00Z", t0 + 59_000).ok, false);
  assertEquals(podeReenviar("2026-11-24T12:00:00Z", t0 + 60_000).ok, true);
});

Deno.test("promo10-publico: primeiro nome e equipe por papel", () => {
  assertEquals(primeiroNome("MARIA SILVA"), "Maria");
  assertEquals(ehEquipePorPapel(["admin"]), true);
  assertEquals(ehEquipePorPapel(["aluno"]), false);
});