import { dataCompativel, escolherConciliadaManual, proximoDiaUtil } from "./index.ts";

Deno.test("vencimento no domingo vai para segunda", () => {
  if (proximoDiaUtil("2026-10-25") !== "2026-10-26") throw new Error("domingo 25/10 → 26/10");
  if (proximoDiaUtil("2026-10-24") !== "2026-10-26") throw new Error("sábado → segunda");
});

Deno.test("EDP vence 25 e debita 26", () => {
  if (!dataCompativel("2026-10-25", "2026-10-26")) throw new Error("deveria casar");
  if (dataCompativel("2026-10-15", "2026-10-26")) throw new Error("longe demais");
});

Deno.test("uma só correspondência liga; várias não", () => {
  const m = { valor: 743.5, data_entrada: "2026-10-26" };
  const a = { id: "a", valor: 743.5, data_pagamento: "2026-10-26", data_competencia: "2026-10-25" };
  const b = { id: "b", valor: 743.5, data_pagamento: null, data_competencia: "2026-10-24" };
  const c = { id: "c", valor: 671.59, data_pagamento: "2026-10-26", data_competencia: "2026-10-25" };
  if (escolherConciliadaManual([a, c], m, new Set()) !== "a") throw new Error("deveria escolher a");
  if (escolherConciliadaManual([a, b], m, new Set()) !== "multiplos") throw new Error("deveria recusar");
  if (escolherConciliadaManual([a], m, new Set(["a"])) !== null) throw new Error("já usada");
});
