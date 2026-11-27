import { describe, expect, it } from "vitest";
import {
  calcularDisponibilidadeProduto,
  textoEscolhaPendente,
} from "@/lib/lojaDisponibilidade";

describe("calcularDisponibilidadeProduto", () => {
  it("não marca como esgotado antes de escolher tamanho quando há estoque em alguma variação", () => {
    const resultado = calcularDisponibilidadeProduto({
      variantes: [
        { estoque_atual: 0 },
        { estoque_atual: 4 },
        { estoque_atual: 2 },
      ],
      varianteSelecionada: null,
      precisaEscolher: true,
      permiteEncomenda: false,
    });

    expect(resultado.esgotado).toBe(false);
    expect(resultado.semEstoque).toBe(false);
    expect(resultado.encomenda).toBe(false);
  });

  it("marca como esgotado antes de escolher quando todas as variações estão zeradas", () => {
    const resultado = calcularDisponibilidadeProduto({
      variantes: [{ estoque_atual: 0 }, { estoque_atual: 0 }],
      varianteSelecionada: null,
      precisaEscolher: true,
      permiteEncomenda: false,
    });

    expect(resultado.esgotado).toBe(true);
    expect(resultado.semEstoque).toBe(true);
  });

  it("marca como esgotado quando a variação escolhida não tem estoque", () => {
    const resultado = calcularDisponibilidadeProduto({
      variantes: [{ estoque_atual: 0 }, { estoque_atual: 3 }],
      varianteSelecionada: { estoque_atual: 0 },
      precisaEscolher: false,
      permiteEncomenda: false,
    });

    expect(resultado.esgotado).toBe(true);
    expect(resultado.estoqueMax).toBe(0);
  });

  it("nunca marca como esgotado quando o produto permite encomenda", () => {
    const semEscolha = calcularDisponibilidadeProduto({
      variantes: [{ estoque_atual: 0 }],
      varianteSelecionada: null,
      precisaEscolher: true,
      permiteEncomenda: true,
    });
    const comEscolha = calcularDisponibilidadeProduto({
      variantes: [{ estoque_atual: 0 }],
      varianteSelecionada: { estoque_atual: 0 },
      precisaEscolher: false,
      permiteEncomenda: true,
    });

    expect(semEscolha.esgotado).toBe(false);
    expect(semEscolha.encomenda).toBe(true);
    expect(comEscolha.esgotado).toBe(false);
    expect(comEscolha.encomenda).toBe(true);
    expect(comEscolha.estoqueMax).toBe(10);
  });

  it("define o texto do botão conforme a opção pendente", () => {
    expect(textoEscolhaPendente(true, false)).toBe("Escolha o tamanho");
    expect(textoEscolhaPendente(false, true)).toBe("Escolha a cor");
    expect(textoEscolhaPendente(true, true)).toBe("Escolha as opções");
  });
});