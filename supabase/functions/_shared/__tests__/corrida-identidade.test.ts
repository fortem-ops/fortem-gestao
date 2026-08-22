import { describe, it, expect } from "vitest";
import {
  TIER_MAP,
  AGREGADORAS,
  CPF_TESTE_HASH,
  VALOR_TESTE,
  sha256Hex,
  cpfDigits,
  cpfHashFromRaw,
  decidirRota,
  splitNome,
  resolverAlunoId,
  statusNovoAluno,
  isCpfTeste,
  aplicarValorTeste,
} from "../corrida-identidade";

describe("decidirRota - tiers", () => {
  it("start → aluno/start", () => {
    expect(decidirRota({ tipoPlano: "Start" })).toEqual({
      rota: "aluno",
      tier: "start",
      isAgregadora: false,
    });
  });

  it("start+ → aluno/start_plus", () => {
    expect(decidirRota({ tipoPlano: "START+" }).tier).toBe("start_plus");
  });

  it("power → aluno/power", () => {
    expect(decidirRota({ tipoPlano: " power " })).toEqual({
      rota: "aluno",
      tier: "power",
      isAgregadora: false,
    });
  });

  it("pro → aluno/pro", () => {
    expect(decidirRota({ tipoPlano: "Pro" }).tier).toBe("pro");
  });

  it("max agora é reconhecido: rota=aluno, tier=max (correção do TIER_MAP)", () => {
    expect(decidirRota({ tipoPlano: "Max" })).toEqual({
      rota: "aluno",
      tier: "max",
      isAgregadora: false,
    });
    expect(TIER_MAP["max"]).toBe("max");
  });
});

describe("decidirRota - agregadoras e desconhecidos", () => {
  it("gympass/wellhub → prospect sem tier", () => {
    expect(decidirRota({ tipoPlano: "Gympass/Wellhub" })).toEqual({
      rota: "prospect",
      tier: null,
      isAgregadora: true,
    });
  });

  it("total pass → prospect sem tier", () => {
    expect(decidirRota({ tipoPlano: "Total Pass" })).toEqual({
      rota: "prospect",
      tier: null,
      isAgregadora: true,
    });
    expect(AGREGADORAS.has("total pass")).toBe(true);
  });

  it("plano desconhecido → somente_corrida", () => {
    expect(decidirRota({ tipoPlano: "Plano Fantasia" })).toEqual({
      rota: "somente_corrida",
      tier: null,
      isAgregadora: false,
    });
  });

  it("plano nulo/vazio/ausente → somente_corrida", () => {
    expect(decidirRota({ tipoPlano: null }).rota).toBe("somente_corrida");
    expect(decidirRota({ tipoPlano: "" }).rota).toBe("somente_corrida");
    expect(decidirRota({}).rota).toBe("somente_corrida");
  });
});

describe("cpfDigits / cpfHashFromRaw", () => {
  it("remove máscara e caracteres não numéricos", () => {
    expect(cpfDigits("529.982.247-25")).toBe("52998224725");
    expect(cpfDigits(null)).toBe("");
  });

  it("CPF válido (11 dígitos) gera hash sha256 estável", async () => {
    const hash = await cpfHashFromRaw("52998224725");
    expect(hash).toBe(await sha256Hex("52998224725"));
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("CPF com máscara gera o mesmo hash do CPF sem máscara", async () => {
    expect(await cpfHashFromRaw("529.982.247-25")).toBe(
      await cpfHashFromRaw("52998224725"),
    );
  });

  it("CPF inválido (menos/mais dígitos, vazio, null) retorna null", async () => {
    expect(await cpfHashFromRaw("1234567890")).toBeNull();
    expect(await cpfHashFromRaw("123456789012")).toBeNull();
    expect(await cpfHashFromRaw("")).toBeNull();
    expect(await cpfHashFromRaw(null)).toBeNull();
  });
});

describe("resolverAlunoId", () => {
  it("usa o payload quando não há match por hash", () => {
    expect(
      resolverAlunoId({ alunoIdPayload: "payload-id", alunoIdPorHash: null }),
    ).toBe("payload-id");
  });

  it("hash tem precedência sobre o payload", () => {
    expect(
      resolverAlunoId({ alunoIdPayload: "payload-id", alunoIdPorHash: "hash-id" }),
    ).toBe("hash-id");
  });

  it("retorna null quando não há nenhum dos dois", () => {
    expect(resolverAlunoId({})).toBeNull();
    expect(resolverAlunoId({ alunoIdPayload: "", alunoIdPorHash: "" })).toBeNull();
  });
});

describe("splitNome", () => {
  it("nome simples", () => {
    expect(splitNome("Lucas")).toEqual({ primeiro_nome: "Lucas", sobrenome: "" });
  });

  it("nome composto", () => {
    expect(splitNome("Eric Tempass Hafemeister")).toEqual({
      primeiro_nome: "Eric",
      sobrenome: "Tempass Hafemeister",
    });
  });

  it("espaços extras são ignorados", () => {
    expect(splitNome("  Ana   Paula  Souza ")).toEqual({
      primeiro_nome: "Ana",
      sobrenome: "Paula Souza",
    });
  });

  it("nome vazio ou nulo", () => {
    expect(splitNome("")).toEqual({ primeiro_nome: "", sobrenome: "" });
    expect(splitNome(null)).toEqual({ primeiro_nome: "", sobrenome: "" });
  });
});

describe("statusNovoAluno", () => {
  it("somente_provas → avulso", () => {
    expect(statusNovoAluno("somente_provas")).toBe("avulso");
  });

  it("demais rotas → prospect", () => {
    expect(statusNovoAluno("prospect")).toBe("prospect");
    expect(statusNovoAluno("aluno")).toBe("prospect");
    expect(statusNovoAluno("somente_corrida")).toBe("prospect");
  });
});

describe("CPF de teste", () => {
  it("isCpfTeste reconhece apenas o hash de homologação", () => {
    expect(isCpfTeste(CPF_TESTE_HASH)).toBe(true);
    expect(isCpfTeste("outro-hash")).toBe(false);
    expect(isCpfTeste(null)).toBe(false);
  });

  it("aplicarValorTeste substitui o total pelo valor simbólico", () => {
    expect(aplicarValorTeste(499.9, CPF_TESTE_HASH)).toBe(VALOR_TESTE);
    expect(aplicarValorTeste(499.9, "outro-hash")).toBe(499.9);
    expect(aplicarValorTeste(499.9, null)).toBe(499.9);
  });
});
