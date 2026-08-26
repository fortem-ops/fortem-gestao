import { describe, it, expect, beforeEach } from "vitest";
import {
  decidirSubstituicao,
  salvarCartaoComSubstituicao,
  respostaSalvarCartaoSucesso,
} from "../cartao-substituicao.ts";

/* ── mock de client encadeável (padrão de baixaVenda.test.ts) ───────── */
type Op = [string, ...unknown[]];
interface Spec {
  table: string;
  ops: Op[];
  payload?: Record<string, unknown>;
}

let calls: Spec[] = [];
let respond: (spec: Spec) => { data: unknown; error: unknown };

function makeBuilder(table: string) {
  const spec: Spec = { table, ops: [] };
  const chain = ["select", "eq", "in", "order", "limit"] as const;
  const builder: Record<string, unknown> = {};
  for (const m of chain) {
    builder[m] = (...args: unknown[]) => {
      spec.ops.push([m, ...args]);
      return builder;
    };
  }
  for (const m of ["insert", "update"] as const) {
    builder[m] = (payload: Record<string, unknown>) => {
      spec.payload = payload;
      spec.ops.push([m, payload]);
      return builder;
    };
  }
  let registered = false;
  const register = () => {
    if (!registered) {
      registered = true;
      calls.push(spec);
    }
  };
  builder.maybeSingle = () => {
    register();
    return Promise.resolve(respond(spec));
  };
  builder.then = (res: (v: unknown) => unknown, rej?: (e: unknown) => unknown) => {
    register();
    return Promise.resolve(respond(spec)).then(res, rej);
  };
  return builder;
}

const client = { from: (table: string) => makeBuilder(table) };

const has = (spec: Spec, op: string, ...args: unknown[]) =>
  spec.ops.some(([m, ...a]) => m === op && args.every((v, i) => a[i] === v));

const input = {
  alunoId: "aluno-1",
  last4: "4715",
  tokenRede: "tok-novo",
  brand: "Mastercard",
  expirationMonth: 9,
  expirationYear: 2029,
  holderName: "FULANO DE TAL",
  origem: "recepcao",
};

function setup(ativos: Array<{ id: string; last4: string }>, opts?: {
  contratos?: string[];
  planos?: string[];
  insertError?: string;
}) {
  calls = [];
  respond = (spec) => {
    if (spec.table === "cartoes_salvos" && has(spec, "select", "id, last4")) {
      return { data: ativos, error: null };
    }
    if (spec.table === "cartoes_salvos" && spec.ops[0][0] === "insert") {
      if (opts?.insertError) return { data: null, error: { message: opts.insertError } };
      return { data: { id: "cartao-novo" }, error: null };
    }
    if (spec.table === "contratos") {
      return { data: (opts?.contratos ?? []).map((id) => ({ id })), error: null };
    }
    if (spec.table === "planos") {
      return { data: (opts?.planos ?? []).map((id) => ({ id })), error: null };
    }
    return { data: null, error: null };
  };
}

/* ── função pura ───────────────────────────────────────────────────── */
describe("decidirSubstituicao", () => {
  it("sem cartões ativos: nada a substituir nem limpar", () => {
    expect(decidirSubstituicao([], "4715")).toEqual({
      substituirId: null,
      limparDefaultIds: [],
    });
  });

  it("cartão ativo com mesmo last4 é o substituído", () => {
    expect(decidirSubstituicao([{ id: "a", last4: "4715" }], "4715")).toEqual({
      substituirId: "a",
      limparDefaultIds: [],
    });
  });

  it("cartão ativo de last4 diferente só perde o is_default", () => {
    expect(decidirSubstituicao([{ id: "b", last4: "2970" }], "4715")).toEqual({
      substituirId: null,
      limparDefaultIds: ["b"],
    });
  });

  it("mistura: substitui o de mesmo last4 e limpa os outros", () => {
    const r = decidirSubstituicao(
      [{ id: "b", last4: "2970" }, { id: "a", last4: "4715" }, { id: "c", last4: "0112" }],
      "4715",
    );
    expect(r.substituirId).toBe("a");
    expect(r.limparDefaultIds.sort()).toEqual(["b", "c"]);
  });

  it("ignora o próprio cartão recém-inserido", () => {
    const r = decidirSubstituicao(
      [{ id: "cartao-novo", last4: "4715" }, { id: "a", last4: "4715" }],
      "4715",
      "cartao-novo",
    );
    expect(r.substituirId).toBe("a");
    expect(r.limparDefaultIds).toEqual([]);
  });

  it("mais de um ativo com o mesmo last4: substitui o primeiro e limpa o resto", () => {
    const r = decidirSubstituicao(
      [{ id: "a1", last4: "4715" }, { id: "a2", last4: "4715" }],
      "4715",
    );
    expect(r.substituirId).toBe("a1");
    expect(r.limparDefaultIds).toEqual(["a2"]);
  });
});

/* ── integração com client mockado ─────────────────────────────────── */
describe("salvarCartaoComSubstituicao", () => {
  beforeEach(() => { calls = []; });

  it("sem duplicata: insere com is_default true e não mexe em contratos/planos", async () => {
    setup([]);
    const r = await salvarCartaoComSubstituicao(client, input);

    expect(r).toEqual({
      cartaoId: "cartao-novo",
      substituiuId: null,
      contratosRepontados: 0,
      planosRepontados: 0,
      erro: null,
    });

    const ins = calls.find((c) => c.table === "cartoes_salvos" && c.ops[0][0] === "insert")!;
    expect(ins.payload).toMatchObject({
      aluno_id: "aluno-1",
      last4: "4715",
      token_rede: "tok-novo",
      ativo: true,
      is_default: true,
      origem: "recepcao",
      expiration_month: 9,
      expiration_year: 2029,
    });
    expect(calls.some((c) => c.table === "contratos")).toBe(false);
    expect(calls.some((c) => c.table === "planos")).toBe(false);
    expect(calls.some((c) => c.table === "system_logs")).toBe(false);
  });

  it("com duplicata: desativa antigo, repontua contratos e planos e loga", async () => {
    setup([{ id: "cartao-antigo", last4: "4715" }], {
      contratos: ["ct-1", "ct-2"],
      planos: ["pl-1"],
    });
    const r = await salvarCartaoComSubstituicao(client, input);

    expect(r.cartaoId).toBe("cartao-novo");
    expect(r.substituiuId).toBe("cartao-antigo");
    expect(r.contratosRepontados).toBe(2);
    expect(r.planosRepontados).toBe(1);
    expect(r.erro).toBeNull();

    const desativa = calls.find(
      (c) => c.table === "cartoes_salvos" && c.ops[0][0] === "update" &&
        (c.payload as any)?.ativo === false,
    )!;
    expect(desativa.payload).toMatchObject({ ativo: false, is_default: false });
    expect(has(desativa, "eq", "id", "cartao-antigo")).toBe(true);

    const ct = calls.find((c) => c.table === "contratos")!;
    expect(ct.payload).toMatchObject({ cartao_token_id: "cartao-novo" });
    expect(has(ct, "eq", "cartao_token_id", "cartao-antigo")).toBe(true);

    const pl = calls.find((c) => c.table === "planos")!;
    expect(pl.payload).toMatchObject({ cartao_token_id: "cartao-novo" });
    expect(has(pl, "eq", "cartao_token_id", "cartao-antigo")).toBe(true);

    const log = calls.find((c) => c.table === "system_logs")!;
    expect(log.payload).toMatchObject({
      acao: "cartao_substituido",
      payload: {
        aluno_id: "aluno-1",
        cartao_antigo_id: "cartao-antigo",
        cartao_novo_id: "cartao-novo",
        contratos_repontados: 2,
        planos_repontados: 1,
      },
    });
  });

  it("outro cartão ativo de last4 diferente: só perde o is_default, não é desativado", async () => {
    setup([{ id: "outro", last4: "2970" }]);
    const r = await salvarCartaoComSubstituicao(client, input);

    expect(r.substituiuId).toBeNull();
    const updates = calls.filter(
      (c) => c.table === "cartoes_salvos" && c.ops[0][0] === "update",
    );
    expect(updates).toHaveLength(1);
    expect(updates[0].payload).toEqual({ is_default: false });
    expect(has(updates[0], "eq", "id", "outro")).toBe(true);
    expect(calls.some((c) => c.table === "contratos")).toBe(false);
  });

  it("erro no insert: retorna erro e não altera mais nada", async () => {
    setup([{ id: "cartao-antigo", last4: "4715" }], { insertError: "boom" });
    const r = await salvarCartaoComSubstituicao(client, input);

    expect(r.cartaoId).toBeNull();
    expect(r.erro).toBe("boom");
    expect(calls.some((c) => c.table === "contratos")).toBe(false);
    expect(
      calls.filter((c) => c.table === "cartoes_salvos" && c.ops[0][0] === "update"),
    ).toHaveLength(0);
  });
});
