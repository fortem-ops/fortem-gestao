import { describe, it, expect, beforeEach, vi } from "vitest";

/**
 * Mock builder encadeável e "thenable" — estende o padrão de
 * src/lib/__tests__/financeiro-queries.test.ts para cobrir
 * update/in/not/or, que são awaited direto no builder (sem maybeSingle).
 */
type Op = [string, ...unknown[]];

interface Spec {
  table: string;
  ops: Op[];
  payload?: Record<string, unknown>;
  terminal?: "maybeSingle" | "await";
}

const calls: Spec[] = [];
let respond: (spec: Spec) => { data: unknown; error: null };

function makeBuilder(table: string) {
  const spec: Spec = { table, ops: [] };
  const chain = ["select", "eq", "in", "not", "or", "order", "limit"] as const;
  const builder: Record<string, unknown> = {};

  for (const m of chain) {
    builder[m] = (...args: unknown[]) => {
      spec.ops.push([m, ...args]);
      return builder;
    };
  }
  builder.update = (payload: Record<string, unknown>) => {
    spec.payload = payload;
    spec.ops.push(["update", payload]);
    return builder;
  };
  builder.maybeSingle = () => {
    spec.terminal = "maybeSingle";
    calls.push(spec);
    return Promise.resolve(respond(spec));
  };
  // torna o builder awaitable (cadeias que terminam em .not()/.or()/.eq())
  builder.then = (res: (v: unknown) => unknown, rej?: (e: unknown) => unknown) => {
    if (spec.terminal !== "maybeSingle") {
      spec.terminal = "await";
      calls.push(spec);
    }
    return Promise.resolve(respond(spec)).then(res, rej);
  };

  return builder;
}

const mockFrom = vi.fn((table: string) => makeBuilder(table));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { from: (table: string) => mockFrom(table) },
}));

import { propagarBaixaParaVenda, propagarBaixaEmLote } from "@/lib/baixaVenda";
import { getFormaRecebimento } from "@/lib/formasRecebimento";

const PIX = getFormaRecebimento("pix")!;

/** Helpers de inspeção das chamadas registradas. */
const opNames = (spec: Spec) => spec.ops.map((o) => o[0]);
const updates = () => calls.filter((c) => opNames(c).includes("update"));
const selects = () => calls.filter((c) => !opNames(c).includes("update"));
const findOp = (spec: Spec, name: string) => spec.ops.find((o) => o[0] === name);

/** Resposta padrão: venda encontrada pelo vínculo direto. */
function respostaDireta(vendaIds: string[] = ["venda-1"]) {
  return (spec: Spec) => {
    if (spec.table === "vendas" && !opNames(spec).includes("update")) {
      return { data: vendaIds.map((id) => ({ id })), error: null };
    }
    return { data: null, error: null };
  };
}

beforeEach(() => {
  calls.length = 0;
  mockFrom.mockClear();
  respond = respostaDireta();
});

describe("propagarBaixaParaVenda — status_pagamento", () => {
  it("marca a venda como paga", async () => {
    await propagarBaixaParaVenda("cob-1");

    const upd = updates();
    expect(upd).toHaveLength(1);
    expect(upd[0].table).toBe("vendas");
    expect(upd[0].payload).toEqual({ status_pagamento: "pago" });
    expect(findOp(upd[0], "in")).toEqual(["in", "id", ["venda-1"]]);
  });

  it("aplica a guarda .not para não tocar em vendas canceladas/estornadas", async () => {
    await propagarBaixaParaVenda("cob-1");

    const guard = findOp(updates()[0], "not");
    expect(guard).toEqual(["not", "status_pagamento", "in", "(cancelado,estornado)"]);
  });

  it("atualiza todas as vendas vinculadas à cobrança", async () => {
    respond = respostaDireta(["venda-1", "venda-2", "venda-3"]);

    await propagarBaixaParaVenda("cob-1");

    expect(findOp(updates()[0], "in")).toEqual([
      "in",
      "id",
      ["venda-1", "venda-2", "venda-3"],
    ]);
  });
});

describe("propagarBaixaParaVenda — forma_pagamento", () => {
  it("não grava forma_pagamento quando nenhuma forma é informada", async () => {
    await propagarBaixaParaVenda("cob-1");

    expect(updates()).toHaveLength(1);
    expect(updates()[0].payload).toEqual({ status_pagamento: "pago" });
  });

  it("grava a forma da venda com a guarda .or (só quando nula ou pendente)", async () => {
    await propagarBaixaParaVenda("cob-1", PIX);

    const upd = updates();
    expect(upd).toHaveLength(2);
    expect(upd[1].payload).toEqual({ forma_pagamento: "pix" });
    expect(findOp(upd[1], "or")).toEqual([
      "or",
      "forma_pagamento.is.null,forma_pagamento.eq.pendente",
    ]);
  });

  it("usa vendaForma, não o value da forma de recebimento", async () => {
    const maquina = getFormaRecebimento("maquina_credito")!;

    await propagarBaixaParaVenda("cob-1", maquina);

    expect(updates()[1].payload).toEqual({ forma_pagamento: "cartao_credito" });
  });

  it("o update de status não carrega guarda .or (baixa vale sempre)", async () => {
    await propagarBaixaParaVenda("cob-1", PIX);

    expect(findOp(updates()[0], "or")).toBeUndefined();
    expect(findOp(updates()[1], "not")).toBeUndefined();
  });
});

describe("propagarBaixaParaVenda — resolução do alvo em duas etapas", () => {
  it("etapa 1: usa o vínculo direto vendas.cobranca_id", async () => {
    await propagarBaixaParaVenda("cob-1");

    const sel = selects();
    expect(sel).toHaveLength(1);
    expect(sel[0].table).toBe("vendas");
    expect(findOp(sel[0], "eq")).toEqual(["eq", "cobranca_id", "cob-1"]);
    // não precisou do fallback
    expect(calls.some((c) => c.table === "cobrancas")).toBe(false);
  });

  it("etapa 2: sem vínculo direto, cai para contrato_id → plano_id → (aluno_id, plano_id)", async () => {
    let vendasSelects = 0;
    respond = (spec) => {
      const isSelect = !opNames(spec).includes("update");
      if (spec.table === "vendas" && isSelect) {
        vendasSelects += 1;
        // 1ª busca (cobranca_id) vazia, 2ª busca (aluno_id + plano_id) encontra
        return vendasSelects === 1
          ? { data: [], error: null }
          : { data: [{ id: "venda-fallback" }], error: null };
      }
      if (spec.table === "cobrancas") {
        return { data: { aluno_id: "aluno-9", contrato_id: "contrato-9" }, error: null };
      }
      if (spec.table === "contratos") {
        return { data: { plano_id: "plano-9" }, error: null };
      }
      return { data: null, error: null };
    };

    await propagarBaixaParaVenda("cob-1");

    const tabelas = calls.map((c) => c.table);
    expect(tabelas).toEqual(["vendas", "cobrancas", "contratos", "vendas", "vendas"]);

    const buscaFallback = selects()[3];
    expect(buscaFallback.ops.filter((o) => o[0] === "eq")).toEqual([
      ["eq", "aluno_id", "aluno-9"],
      ["eq", "plano_id", "plano-9"],
    ]);

    expect(updates()).toHaveLength(1);
    expect(findOp(updates()[0], "in")).toEqual(["in", "id", ["venda-fallback"]]);
  });

  it("retorna sem update quando a cobrança não tem contrato_id", async () => {
    respond = (spec) => {
      if (spec.table === "vendas") return { data: [], error: null };
      if (spec.table === "cobrancas") {
        return { data: { aluno_id: "aluno-9", contrato_id: null }, error: null };
      }
      return { data: null, error: null };
    };

    await propagarBaixaParaVenda("cob-1", PIX);

    expect(updates()).toHaveLength(0);
    expect(calls.some((c) => c.table === "contratos")).toBe(false);
  });

  it("retorna sem update quando o contrato não tem plano_id", async () => {
    respond = (spec) => {
      if (spec.table === "vendas") return { data: [], error: null };
      if (spec.table === "cobrancas") {
        return { data: { aluno_id: "aluno-9", contrato_id: "contrato-9" }, error: null };
      }
      if (spec.table === "contratos") return { data: { plano_id: null }, error: null };
      return { data: null, error: null };
    };

    await propagarBaixaParaVenda("cob-1", PIX);

    expect(updates()).toHaveLength(0);
  });

  it("retorna sem update quando a cobrança não existe", async () => {
    respond = (spec) => {
      if (spec.table === "vendas") return { data: [], error: null };
      return { data: null, error: null };
    };

    await propagarBaixaParaVenda("cob-inexistente");

    expect(updates()).toHaveLength(0);
  });

  it("retorna sem update quando o fallback não encontra nenhuma venda", async () => {
    respond = (spec) => {
      const isSelect = !opNames(spec).includes("update");
      if (spec.table === "vendas" && isSelect) return { data: [], error: null };
      if (spec.table === "cobrancas") {
        return { data: { aluno_id: "aluno-9", contrato_id: "contrato-9" }, error: null };
      }
      if (spec.table === "contratos") return { data: { plano_id: "plano-9" }, error: null };
      return { data: null, error: null };
    };

    await propagarBaixaParaVenda("cob-1");

    expect(updates()).toHaveLength(0);
  });

  it("tolera data null na busca direta sem quebrar", async () => {
    respond = (spec) => {
      if (spec.table === "vendas") return { data: null, error: null };
      return { data: null, error: null };
    };

    await expect(propagarBaixaParaVenda("cob-1")).resolves.toBeUndefined();
    expect(updates()).toHaveLength(0);
  });
});

describe("propagarBaixaEmLote", () => {
  it("processa cada cobrança da lista", async () => {
    await propagarBaixaEmLote(["cob-1", "cob-2", "cob-3"]);

    const buscas = selects().filter((c) => c.table === "vendas");
    expect(buscas.map((c) => findOp(c, "eq"))).toEqual([
      ["eq", "cobranca_id", "cob-1"],
      ["eq", "cobranca_id", "cob-2"],
      ["eq", "cobranca_id", "cob-3"],
    ]);
    expect(updates()).toHaveLength(3);
  });

  it("repassa a forma de recebimento para cada cobrança", async () => {
    await propagarBaixaEmLote(["cob-1", "cob-2"], PIX);

    const upd = updates();
    expect(upd).toHaveLength(4); // 2 status + 2 forma
    expect(upd.filter((u) => u.payload?.forma_pagamento === "pix")).toHaveLength(2);
  });

  it("lista vazia não dispara nenhuma query", async () => {
    await propagarBaixaEmLote([]);

    expect(calls).toHaveLength(0);
    expect(mockFrom).not.toHaveBeenCalled();
  });
});
