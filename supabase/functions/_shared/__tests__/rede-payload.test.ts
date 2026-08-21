import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  REDE_URLS,
  TOKEN_SERVICE_URLS,
  TOKENIZATION_URLS,
  OAUTH_URLS,
  resolveRedeBaseUrl,
  resolveTokenServiceUrl,
  resolveTokenizationUrl,
  resolveOAuthUrl,
  luhn,
  normalizeCardholderName,
  formatExpirationMonth,
  formatExpirationYear,
  buildReference,
  toCentavos,
  calcularSubtotal,
  calcularValorMensal,
  normalizarPeriodoMeses,
  isRecorrencia,
  calcularAmountCentavos,
  mapReturnCode,
  loadSecrets,
} from "../rede-payload.ts";

// ─── URLs por ambiente ───────────────────────────────────────

describe("resolução de URLs por ambiente", () => {
  it("retorna produção quando ambiente = producao", () => {
    expect(resolveRedeBaseUrl("producao")).toBe(REDE_URLS.producao);
    expect(resolveTokenServiceUrl("producao")).toBe(TOKEN_SERVICE_URLS.producao);
    expect(resolveTokenizationUrl("producao")).toBe(TOKENIZATION_URLS.producao);
    expect(resolveOAuthUrl("producao")).toBe(OAUTH_URLS.producao);
  });

  it("retorna sandbox quando ambiente = sandbox", () => {
    expect(resolveRedeBaseUrl("sandbox")).toBe(REDE_URLS.sandbox);
    expect(resolveTokenServiceUrl("sandbox")).toBe(TOKEN_SERVICE_URLS.sandbox);
    expect(resolveOAuthUrl("sandbox")).toBe(OAUTH_URLS.sandbox);
  });

  it("cai em sandbox para ambiente desconhecido, null ou undefined", () => {
    expect(resolveRedeBaseUrl("homologacao")).toBe(REDE_URLS.sandbox);
    expect(resolveRedeBaseUrl(null)).toBe(REDE_URLS.sandbox);
    expect(resolveRedeBaseUrl(undefined)).toBe(REDE_URLS.sandbox);
    expect(resolveTokenServiceUrl("")).toBe(TOKEN_SERVICE_URLS.sandbox);
    expect(resolveOAuthUrl("PRODUCAO")).toBe(OAUTH_URLS.sandbox);
  });

  it("nunca aponta para produção por acidente (guarda de segurança financeira)", () => {
    for (const amb of ["", " producao", "prod", "Producao", null, undefined]) {
      if (amb === "producao") continue;
      expect(resolveRedeBaseUrl(amb as any)).toBe(REDE_URLS.sandbox);
    }
  });
});

// ─── Luhn ────────────────────────────────────────────────────

describe("luhn", () => {
  it("aceita cartões de teste válidos", () => {
    expect(luhn("4111111111111111")).toBe(true);   // Visa
    expect(luhn("5555555555554444")).toBe(true);   // Mastercard
    expect(luhn("376449047333005")).toBe(true);    // Amex (15 dígitos)
  });

  it("aceita números formatados com espaços e hífens", () => {
    expect(luhn("4111 1111 1111 1111")).toBe(true);
    expect(luhn("4111-1111-1111-1111")).toBe(true);
  });

  it("rejeita dígito verificador incorreto", () => {
    expect(luhn("4111111111111112")).toBe(false);
    expect(luhn("1234567890123456")).toBe(false);
  });

  it("rejeita números com menos de 12 dígitos mesmo que passem no cálculo", () => {
    // "18" passa no algoritmo Luhn, mas é curto demais
    expect(luhn("18")).toBe(false);
    expect(luhn("")).toBe(false);
    expect(luhn("42424242424")).toBe(false); // 11 dígitos
  });
});

// ─── Normalização de campos ──────────────────────────────────

describe("normalizeCardholderName", () => {
  it("faz trim, uppercase e remove acentos", () => {
    expect(normalizeCardholderName("  joão da silva ")).toBe("JOAO DA SILVA");
    expect(normalizeCardholderName("MARÍA ÂNGELA ÇÃO")).toBe("MARIA ANGELA CAO");
  });

  it("null, undefined e vazio viram string vazia (nunca 'null'/'undefined')", () => {
    expect(normalizeCardholderName(null)).toBe("");
    expect(normalizeCardholderName(undefined)).toBe("");
    expect(normalizeCardholderName("   ")).toBe("");
  });
});

describe("formatExpirationMonth", () => {
  it("preenche com zero à esquerda", () => {
    expect(formatExpirationMonth(3)).toBe("03");
    expect(formatExpirationMonth("7")).toBe("07");
  });
  it("mantém dois dígitos", () => {
    expect(formatExpirationMonth(12)).toBe("12");
    expect(formatExpirationMonth("11")).toBe("11");
  });
});

describe("formatExpirationYear", () => {
  it("expande ano de 2 dígitos", () => {
    expect(formatExpirationYear("29")).toBe("2029");
    expect(formatExpirationYear(30)).toBe("2030");
  });
  it("mantém ano de 4 dígitos", () => {
    expect(formatExpirationYear("2031")).toBe("2031");
  });
  it("aplica trim antes de decidir", () => {
    expect(formatExpirationYear(" 28 ")).toBe("2028");
  });
});

describe("buildReference", () => {
  it("remove hífens do uuid e mantém os 32 caracteres completos", () => {
    const ref = buildReference("3f1a2b4c-5d6e-7f80-9a1b-2c3d4e5f6071");
    expect(ref).toBe("3f1a2b4c5d6e7f809a1b2c3d4e5f6071");
    expect(ref).toHaveLength(32);
  });
  it("mantém referências curtas intactas", () => {
    expect(buildReference("abc-123")).toBe("abc123");
  });
});

// ─── Valores monetários ──────────────────────────────────────

describe("toCentavos", () => {
  it("converte reais em centavos inteiros", () => {
    expect(toCentavos(100)).toBe(10000);
    expect(toCentavos(99.9)).toBe(9990);
    expect(toCentavos("249.90")).toBe(24990);
  });
  it("arredonda meio centavo", () => {
    expect(toCentavos(10.005)).toBe(1001);
  });
  it("valores inválidos viram 0", () => {
    expect(toCentavos(null)).toBe(0);
    expect(toCentavos(undefined)).toBe(0);
    expect(toCentavos("abc")).toBe(0);
  });
});

describe("calcularSubtotal", () => {
  it("subtrai desconto do valor", () => {
    expect(calcularSubtotal({ valor: 1200, desconto: 200 })).toBe(1000);
  });
  it("nunca retorna negativo", () => {
    expect(calcularSubtotal({ valor: 100, desconto: 500 })).toBe(0);
  });
  it("trata campos ausentes como zero", () => {
    expect(calcularSubtotal({ valor: 300 })).toBe(300);
    expect(calcularSubtotal(null)).toBe(0);
  });
});

describe("normalizarPeriodoMeses", () => {
  it("garante mínimo de 1 mês", () => {
    expect(normalizarPeriodoMeses(0)).toBe(1);
    expect(normalizarPeriodoMeses(null)).toBe(1);
    expect(normalizarPeriodoMeses("x")).toBe(1);
    expect(normalizarPeriodoMeses(-5)).toBe(1);
  });
  it("respeita períodos válidos", () => {
    expect(normalizarPeriodoMeses(12)).toBe(12);
    expect(normalizarPeriodoMeses("6")).toBe(6);
  });
});

describe("calcularValorMensal", () => {
  it("divide o subtotal pelo período e soma a taxa mensal", () => {
    const venda = { valor: 1200, desconto: 0, taxa_mensal: 10 };
    expect(calcularValorMensal(venda, 12)).toBe(110);
  });
  it("aplica desconto antes de dividir", () => {
    const venda = { valor: 1200, desconto: 240, taxa_mensal: 0 };
    expect(calcularValorMensal(venda, 12)).toBe(80);
  });
  it("período inválido não gera divisão por zero", () => {
    const venda = { valor: 500, desconto: 0, taxa_mensal: 0 };
    expect(calcularValorMensal(venda, 0)).toBe(500);
  });
});

describe("isRecorrencia", () => {
  it("identifica apenas tipo_cobranca = recorrencia", () => {
    expect(isRecorrencia({ tipo_cobranca: "recorrencia" })).toBe(true);
    expect(isRecorrencia({ tipo_cobranca: "tradicional" })).toBe(false);
    expect(isRecorrencia({})).toBe(false);
    expect(isRecorrencia(null)).toBe(false);
  });
});

describe("calcularAmountCentavos", () => {
  it("recorrência cobra apenas a 1ª mensalidade (mensal + taxa)", () => {
    const venda = {
      tipo_cobranca: "recorrencia",
      valor: 1200, desconto: 0, taxa_mensal: 9.9,
      valor_final: 1200,
    };
    expect(calcularAmountCentavos(venda, 12)).toBe(10990); // 100 + 9,90
  });

  it("recorrência ignora valor_final", () => {
    const venda = {
      tipo_cobranca: "recorrencia",
      valor: 600, desconto: 0, taxa_mensal: 0,
      valor_final: 999999,
    };
    expect(calcularAmountCentavos(venda, 6)).toBe(10000);
  });

  it("venda tradicional cobra valor_final integral", () => {
    const venda = { tipo_cobranca: "tradicional", valor: 1200, desconto: 100, valor_final: 1100 };
    expect(calcularAmountCentavos(venda, 12)).toBe(110000);
  });

  it("venda sem valor_final resulta em 0 (bloqueado a jusante)", () => {
    expect(calcularAmountCentavos({ tipo_cobranca: "tradicional" })).toBe(0);
    expect(calcularAmountCentavos(null)).toBe(0);
  });

  it("recorrência com período ausente cobra o subtotal inteiro (fallback 1 mês)", () => {
    const venda = { tipo_cobranca: "recorrencia", valor: 300, desconto: 0, taxa_mensal: 0 };
    expect(calcularAmountCentavos(venda, undefined)).toBe(30000);
  });

  it("arredonda centavos de divisões não exatas", () => {
    const venda = { tipo_cobranca: "recorrencia", valor: 100, desconto: 0, taxa_mensal: 0 };
    expect(calcularAmountCentavos(venda, 3)).toBe(3333); // 33,3333...
  });
});

// ─── returnCode ──────────────────────────────────────────────

describe("mapReturnCode", () => {
  it("00 = aprovado", () => {
    expect(mapReturnCode("00")).toEqual({
      returnCode: "00", approved: true, status: "approved",
      statusVenda: "pago", desativarCartao: false,
    });
  });

  it("54 = cartão expirado → nega e sinaliza desativação", () => {
    const r = mapReturnCode("54");
    expect(r.approved).toBe(false);
    expect(r.status).toBe("denied");
    expect(r.statusVenda).toBe("falha");
    expect(r.desativarCartao).toBe(true);
  });

  it("outros códigos negam sem desativar o cartão", () => {
    for (const code of ["51", "05", "78", "99"]) {
      const r = mapReturnCode(code);
      expect(r.approved).toBe(false);
      expect(r.desativarCartao).toBe(false);
    }
  });

  it("código ausente vira XX negado", () => {
    expect(mapReturnCode(undefined).returnCode).toBe("XX");
    expect(mapReturnCode(null).returnCode).toBe("XX");
    expect(mapReturnCode(undefined).approved).toBe(false);
  });

  it("não aprova por coerção de tipo (0 ou '0' não são '00')", () => {
    expect(mapReturnCode(0).approved).toBe(false);
    expect(mapReturnCode("0").approved).toBe(false);
    expect(mapReturnCode(" 00").approved).toBe(false);
  });
});

// ─── loadSecrets ─────────────────────────────────────────────

function makeSupabaseVault(result: { data?: any; error?: any }) {
  const inSpy = vi.fn().mockResolvedValue({ data: result.data ?? null, error: result.error ?? null });
  const client = {
    schema: vi.fn(() => client),
    from: vi.fn(() => client),
    select: vi.fn(() => client),
    in: inSpy,
  } as any;
  return { client, inSpy };
}

function setDenoEnv(vars: Record<string, string>) {
  (globalThis as any).Deno = { env: { get: (k: string) => vars[k] } };
}

describe("loadSecrets", () => {
  beforeEach(() => {
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    delete (globalThis as any).Deno;
    vi.restoreAllMocks();
  });

  it("usa env vars quando PV e TOKEN estão presentes, sem tocar no Vault", async () => {
    setDenoEnv({ REDE_PV: "pv123", REDE_TOKEN: "tok123", REDE_AMBIENTE: "producao" });
    const { client, inSpy } = makeSupabaseVault({ data: [] });
    const m = await loadSecrets(client);
    expect(m).toEqual({ rede_pv: "pv123", rede_token: "tok123", rede_ambiente: "producao" });
    expect(inSpy).not.toHaveBeenCalled();
  });

  it("env vars sem ambiente definem sandbox por default", async () => {
    setDenoEnv({ REDE_PV: "pv", REDE_TOKEN: "tok" });
    const { client } = makeSupabaseVault({ data: [] });
    const m = await loadSecrets(client);
    expect(m.rede_ambiente).toBe("sandbox");
  });

  it("cai no Vault quando falta o token nas env vars", async () => {
    setDenoEnv({ REDE_PV: "pv-env" });
    const { client, inSpy } = makeSupabaseVault({
      data: [
        { name: "rede_pv", decrypted_secret: "pv-vault" },
        { name: "rede_token", decrypted_secret: "tok-vault" },
        { name: "rede_ambiente", decrypted_secret: "producao" },
      ],
    });
    const m = await loadSecrets(client);
    expect(inSpy).toHaveBeenCalledWith("name", ["rede_pv", "rede_token", "rede_ambiente"]);
    // Vault sobrescreve o valor parcial vindo das env vars
    expect(m).toEqual({ rede_pv: "pv-vault", rede_token: "tok-vault", rede_ambiente: "producao" });
  });

  it("ignora segredos vazios retornados pelo Vault", async () => {
    const { client } = makeSupabaseVault({
      data: [
        { name: "rede_pv", decrypted_secret: "pv" },
        { name: "rede_token", decrypted_secret: "" },
      ],
    });
    const m = await loadSecrets(client);
    expect(m.rede_pv).toBe("pv");
    expect(m.rede_token).toBeUndefined();
    expect(m.rede_ambiente).toBe("sandbox");
  });

  it("erro do Vault não lança — retorna apenas o ambiente default", async () => {
    const { client } = makeSupabaseVault({ error: { message: "permission denied" } });
    const m = await loadSecrets(client);
    expect(m).toEqual({ rede_ambiente: "sandbox" });
  });

  it("exceção do Vault é capturada", async () => {
    const client = {
      schema: () => { throw new Error("boom"); },
    } as any;
    const m = await loadSecrets(client);
    expect(m).toEqual({ rede_ambiente: "sandbox" });
  });

  it("funciona fora do runtime Deno (sem globalThis.Deno)", async () => {
    const { client } = makeSupabaseVault({ data: [{ name: "rede_pv", decrypted_secret: "pv" }] });
    const m = await loadSecrets(client);
    expect(m.rede_pv).toBe("pv");
  });

  it("silencioso por default (nenhum log)", async () => {
    setDenoEnv({ REDE_PV: "pv", REDE_TOKEN: "tok" });
    const { client } = makeSupabaseVault({ data: [] });
    await loadSecrets(client);
    expect(console.log).not.toHaveBeenCalled();
    expect(console.warn).not.toHaveBeenCalled();
  });

  it("verbose: true loga diagnóstico sem expor segredos", async () => {
    setDenoEnv({ REDE_PV: "pv-super-secreto", REDE_TOKEN: "tok-super-secreto" });
    const { client } = makeSupabaseVault({ data: [] });
    await loadSecrets(client, { verbose: true });
    expect(console.log).toHaveBeenCalled();
    const todosOsLogs = JSON.stringify((console.log as any).mock.calls);
    expect(todosOsLogs).not.toContain("pv-super-secreto");
    expect(todosOsLogs).not.toContain("tok-super-secreto");
  });

  it("verbose: true também loga o status final no caminho do Vault", async () => {
    const { client } = makeSupabaseVault({ error: { message: "sem acesso" } });
    await loadSecrets(client, { verbose: true });
    expect(console.warn).toHaveBeenCalled();
    const statusLog = (console.log as any).mock.calls.at(-1);
    expect(statusLog[1]).toEqual({ pv_ok: false, token_ok: false, ambiente: "sandbox" });
  });
});
