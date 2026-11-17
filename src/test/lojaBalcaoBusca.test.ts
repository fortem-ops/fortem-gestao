import { describe, it, expect } from "vitest";
import { filtrarProdutos } from "@/lib/lojaBalcao";

const itens = [
  { nome: "Camiseta Fortem", detalhe: "M · Preta" },
  { nome: "Garrafa de Água", detalhe: "" },
];

describe("filtrarProdutos", () => {
  it("ignora maiúsculas", () => expect(filtrarProdutos(itens, "CAMISETA")).toHaveLength(1));
  it("ignora acentos", () => expect(filtrarProdutos(itens, "agua")[0].nome).toBe("Garrafa de Água"));
  it("busca na variante", () => expect(filtrarProdutos(itens, "preta")[0].nome).toBe("Camiseta Fortem"));
  it("busca vazia mostra tudo", () => expect(filtrarProdutos(itens, "  ")).toHaveLength(2));
  it("sem resultado", () => expect(filtrarProdutos(itens, "tênis")).toHaveLength(0));
});
