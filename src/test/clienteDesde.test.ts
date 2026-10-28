import { describe, it, expect } from "vitest";
import { dataClienteDesde, menorInicioPorAluno, matchClienteDesde } from "@/lib/clienteDesde";

describe("dataClienteDesde", () => {
  it("aluno_desde mais antiga que o plano usa aluno_desde", () => {
    expect(dataClienteDesde("2019-03-01", "2016-01-10")).toBe("2016-01-10");
  });
  it("plano mais antigo que aluno_desde usa o plano", () => {
    expect(dataClienteDesde("2016-01-10", "2019-03-01")).toBe("2016-01-10");
  });
  it("só plano usa o plano", () => {
    expect(dataClienteDesde("2019-03-01", null)).toBe("2019-03-01");
  });
  it("só aluno_desde usa aluno_desde", () => {
    expect(dataClienteDesde(null, "2016-01-10")).toBe("2016-01-10");
  });
  it("sem nada retorna null", () => {
    expect(dataClienteDesde(null, null)).toBeNull();
  });
  it("ignora a hora e compara só os primeiros 10 caracteres", () => {
    expect(dataClienteDesde("2019-03-01T10:00:00", "2016-01-10T23:59:59")).toBe("2016-01-10");
  });
});

describe("menorInicioPorAluno", () => {
  it("fica com a menor data de cada aluno", () => {
    expect(menorInicioPorAluno([
      { aluno_id: "a", data_inicio: "2021-05-01" },
      { aluno_id: "a", data_inicio: "2018-02-03" },
      { aluno_id: "b", data_inicio: null },
    ])).toEqual({ a: "2018-02-03" });
  });
});

describe("matchClienteDesde", () => {
  it("sem limites aceita todos, inclusive sem data", () => {
    expect(matchClienteDesde(null)).toBe(true);
  });
  it("com limite exclui quem não tem data", () => {
    expect(matchClienteDesde(null, new Date(2016, 0, 1))).toBe(false);
  });
  it("intervalo inclusivo nas bordas", () => {
    const de = new Date(2018, 0, 1), ate = new Date(2018, 11, 31);
    expect(matchClienteDesde("2018-01-01", de, ate)).toBe(true);
    expect(matchClienteDesde("2018-12-31", de, ate)).toBe(true);
    expect(matchClienteDesde("2017-12-31", de, ate)).toBe(false);
    expect(matchClienteDesde("2019-01-01", de, ate)).toBe(false);
  });
});
