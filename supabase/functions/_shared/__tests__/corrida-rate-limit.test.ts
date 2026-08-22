import { describe, it, expect, vi, afterEach } from "vitest";
import { checkRateLimit, getClientIp } from "../corrida-rate-limit";

type Filtro = { col: string; val: unknown };

interface FakeState {
  contagem: number | null;
  selectFiltros: Filtro[];
  upserts: Array<{ row: any; opts: any }>;
  tabelas: string[];
  throwOnSelect?: boolean;
  throwOnUpsert?: boolean;
  selectError?: unknown;
}

/** Client mínimo que imita a cadeia usada por checkRateLimit. */
function fakeAdmin(state: FakeState) {
  return {
    from(tabela: string) {
      state.tabelas.push(tabela);
      const chain: any = {
        select: () => chain,
        eq: (col: string, val: unknown) => {
          state.selectFiltros.push({ col, val });
          return chain;
        },
        maybeSingle: async () => {
          if (state.throwOnSelect) throw new Error("db offline");
          if (state.selectError) return { data: null, error: state.selectError };
          return {
            data: state.contagem === null ? null : { contagem: state.contagem },
            error: null,
          };
        },
        upsert: async (row: any, opts: any) => {
          if (state.throwOnUpsert) throw new Error("upsert falhou");
          state.upserts.push({ row, opts });
          return { data: null, error: null };
        },
      };
      return chain;
    },
  };
}

function novoState(contagem: number | null = null): FakeState {
  return { contagem, selectFiltros: [], upserts: [], tabelas: [] };
}

function req(headers: Record<string, string> = {}) {
  return new Request("https://fortem.test/corrida", { headers });
}

afterEach(() => {
  vi.useRealTimers();
});

describe("getClientIp", () => {
  it("usa o primeiro IP de x-forwarded-for quando há múltiplos", () => {
    expect(
      getClientIp(req({ "x-forwarded-for": "203.0.113.7, 70.41.3.18, 150.172.238.178" })),
    ).toBe("203.0.113.7");
  });

  it("faz trim de espaços no x-forwarded-for", () => {
    expect(getClientIp(req({ "x-forwarded-for": "  203.0.113.9  " }))).toBe("203.0.113.9");
  });

  it("cai para cf-connecting-ip quando não há x-forwarded-for", () => {
    expect(getClientIp(req({ "cf-connecting-ip": "198.51.100.4" }))).toBe("198.51.100.4");
  });

  it("cai para x-real-ip quando não há x-forwarded-for nem cf-connecting-ip", () => {
    expect(getClientIp(req({ "x-real-ip": "192.0.2.55" }))).toBe("192.0.2.55");
  });

  it("prioriza x-forwarded-for sobre os demais headers", () => {
    expect(
      getClientIp(
        req({
          "x-forwarded-for": "203.0.113.1",
          "cf-connecting-ip": "198.51.100.1",
          "x-real-ip": "192.0.2.1",
        }),
      ),
    ).toBe("203.0.113.1");
  });

  it("prioriza cf-connecting-ip sobre x-real-ip", () => {
    expect(
      getClientIp(req({ "cf-connecting-ip": "198.51.100.2", "x-real-ip": "192.0.2.2" })),
    ).toBe("198.51.100.2");
  });

  it('devolve "unknown" quando nenhum header de IP está presente', () => {
    expect(getClientIp(req())).toBe("unknown");
  });

  it('devolve "unknown" quando x-forwarded-for vem vazio', () => {
    expect(getClientIp(req({ "x-forwarded-for": "" }))).toBe("unknown");
  });
});

describe("checkRateLimit — limite", () => {
  it("permite a primeira requisição da janela (sem registro anterior)", async () => {
    const state = novoState(null);
    const r = await checkRateLimit(fakeAdmin(state), req({ "x-forwarded-for": "1.1.1.1" }), "lookup", 5);
    expect(r.ok).toBe(true);
    expect(r.ip).toBe("1.1.1.1");
    expect(state.upserts[0].row.contagem).toBe(1);
  });

  it("permite quando a contagem resultante ainda está dentro do limite", async () => {
    const state = novoState(3);
    const r = await checkRateLimit(fakeAdmin(state), req({ "x-forwarded-for": "1.1.1.1" }), "lookup", 5);
    expect(r.ok).toBe(true);
    expect(state.upserts[0].row.contagem).toBe(4);
  });

  it("permite exatamente na contagem igual ao limite (borda)", async () => {
    const state = novoState(4);
    const r = await checkRateLimit(fakeAdmin(state), req({ "x-forwarded-for": "1.1.1.1" }), "lookup", 5);
    expect(r.ok).toBe(true);
    expect(state.upserts[0].row.contagem).toBe(5);
  });

  it("bloqueia quando a contagem ultrapassa o limite", async () => {
    const state = novoState(5);
    const r = await checkRateLimit(fakeAdmin(state), req({ "x-forwarded-for": "1.1.1.1" }), "lookup", 5);
    expect(r.ok).toBe(false);
    expect(state.upserts[0].row.contagem).toBe(6);
  });

  it("continua bloqueando bem acima do limite", async () => {
    const state = novoState(42);
    const r = await checkRateLimit(fakeAdmin(state), req({ "x-forwarded-for": "1.1.1.1" }), "lookup", 5);
    expect(r.ok).toBe(false);
  });

  it("grava e filtra pela tabela, endpoint e IP corretos", async () => {
    const state = novoState(null);
    await checkRateLimit(fakeAdmin(state), req({ "x-real-ip": "9.9.9.9" }), "aceitar-contrato", 10);

    expect(state.tabelas).toEqual([
      "rate_limit_corrida_publico",
      "rate_limit_corrida_publico",
    ]);
    expect(state.selectFiltros.map((f) => f.col)).toEqual([
      "ip_address",
      "endpoint",
      "janela_min",
    ]);
    expect(state.selectFiltros[0].val).toBe("9.9.9.9");
    expect(state.selectFiltros[1].val).toBe("aceitar-contrato");
    expect(state.upserts[0].row).toMatchObject({
      ip_address: "9.9.9.9",
      endpoint: "aceitar-contrato",
      contagem: 1,
    });
    expect(state.upserts[0].opts).toEqual({
      onConflict: "ip_address,endpoint,janela_min",
    });
  });

  it('usa "unknown" como chave quando não há header de IP', async () => {
    const state = novoState(null);
    const r = await checkRateLimit(fakeAdmin(state), req(), "lookup", 3);
    expect(r.ip).toBe("unknown");
    expect(state.upserts[0].row.ip_address).toBe("unknown");
  });
});

describe("checkRateLimit — cálculo da janela", () => {
  const T = 1_755_000_000_000; // ms fixos

  function janelaGravada(state: FakeState) {
    return state.upserts[0].row.janela_min;
  }

  it("usa janela de 60s por padrão", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(T);
    const state = novoState(null);
    await checkRateLimit(fakeAdmin(state), req({ "x-forwarded-for": "1.1.1.1" }), "lookup", 5);
    expect(janelaGravada(state)).toBe(Math.floor(T / 1000 / 60));
    expect(state.selectFiltros[2].val).toBe(Math.floor(T / 1000 / 60));
  });

  it("usa janela de 300s quando informada", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(T);
    const state = novoState(null);
    await checkRateLimit(fakeAdmin(state), req({ "x-forwarded-for": "1.1.1.1" }), "lookup", 5, 300);
    expect(janelaGravada(state)).toBe(Math.floor(T / 1000 / 300));
  });

  it("mantém a mesma janela dentro dos 60s e avança ao cruzar o minuto", async () => {
    vi.useFakeTimers();
    const base = Math.floor(T / 1000 / 60) * 60 * 1000; // início exato de uma janela

    vi.setSystemTime(base);
    const s1 = novoState(null);
    await checkRateLimit(fakeAdmin(s1), req({ "x-forwarded-for": "1.1.1.1" }), "lookup", 5);

    vi.setSystemTime(base + 59_999);
    const s2 = novoState(null);
    await checkRateLimit(fakeAdmin(s2), req({ "x-forwarded-for": "1.1.1.1" }), "lookup", 5);

    vi.setSystemTime(base + 60_000);
    const s3 = novoState(null);
    await checkRateLimit(fakeAdmin(s3), req({ "x-forwarded-for": "1.1.1.1" }), "lookup", 5);

    expect(janelaGravada(s2)).toBe(janelaGravada(s1));
    expect(janelaGravada(s3)).toBe(janelaGravada(s1) + 1);
  });

  it("janela de 300s só avança a cada 5 minutos", async () => {
    vi.useFakeTimers();
    const base = Math.floor(T / 1000 / 300) * 300 * 1000;

    vi.setSystemTime(base + 299_999);
    const s1 = novoState(null);
    await checkRateLimit(fakeAdmin(s1), req({ "x-forwarded-for": "1.1.1.1" }), "lookup", 5, 300);

    vi.setSystemTime(base + 300_000);
    const s2 = novoState(null);
    await checkRateLimit(fakeAdmin(s2), req({ "x-forwarded-for": "1.1.1.1" }), "lookup", 5, 300);

    expect(janelaGravada(s2)).toBe(janelaGravada(s1) + 1);
  });
});

describe("checkRateLimit — fallback (fail-open, comportamento atual)", () => {
  it("permite a requisição quando a leitura do contador lança exceção", async () => {
    const state = novoState(null);
    state.throwOnSelect = true;
    const r = await checkRateLimit(fakeAdmin(state), req({ "x-forwarded-for": "1.1.1.1" }), "lookup", 5);
    expect(r.ok).toBe(true);
    expect(r.ip).toBe("1.1.1.1");
    expect(state.upserts).toHaveLength(0);
  });

  it("permite a requisição quando o upsert lança exceção", async () => {
    const state = novoState(1);
    state.throwOnUpsert = true;
    const r = await checkRateLimit(fakeAdmin(state), req({ "x-forwarded-for": "1.1.1.1" }), "lookup", 5);
    expect(r.ok).toBe(true);
  });

  it("permite mesmo estourado quando o upsert falha depois de contar acima do limite", async () => {
    const state = novoState(99);
    state.throwOnUpsert = true;
    const r = await checkRateLimit(fakeAdmin(state), req({ "x-forwarded-for": "1.1.1.1" }), "lookup", 5);
    expect(r.ok).toBe(true);
  });

  it("trata erro retornado (não lançado) como contagem zero e permite", async () => {
    const state = novoState(null);
    state.selectError = { message: "row not found" };
    const r = await checkRateLimit(fakeAdmin(state), req({ "x-forwarded-for": "1.1.1.1" }), "lookup", 5);
    expect(r.ok).toBe(true);
    expect(state.upserts[0].row.contagem).toBe(1);
  });

  it("devolve o IP corretamente mesmo no caminho de falha sem headers", async () => {
    const state = novoState(null);
    state.throwOnSelect = true;
    const r = await checkRateLimit(fakeAdmin(state), req(), "lookup", 5);
    expect(r).toEqual({ ok: true, ip: "unknown" });
  });
});
