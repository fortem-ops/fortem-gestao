import { describe, it, expect } from "vitest";
import {
  FORMAS_RECEBIMENTO,
  getFormaRecebimento,
  labelFormaPagamento,
} from "@/lib/formasRecebimento";

describe("FORMAS_RECEBIMENTO", () => {
  it("expõe as 6 formas de recebimento", () => {
    expect(FORMAS_RECEBIMENTO).toHaveLength(6);
  });

  it("não tem valores duplicados", () => {
    const values = FORMAS_RECEBIMENTO.map((f) => f.value);
    expect(new Set(values).size).toBe(values.length);
  });

  it("todo gateway respeita o check constraint da tabela cobrancas", () => {
    const permitidos = ["dinheiro", "inter_pix", "maquina", "rede", "boleto"];
    for (const f of FORMAS_RECEBIMENTO) {
      expect(permitidos).toContain(f.gateway);
    }
  });

  it("toda forma tem label e vendaForma preenchidos", () => {
    for (const f of FORMAS_RECEBIMENTO) {
      expect(f.label.trim().length).toBeGreaterThan(0);
      expect(f.vendaForma.trim().length).toBeGreaterThan(0);
    }
  });
});

describe("getFormaRecebimento", () => {
  it("encontra a forma pelo value", () => {
    expect(getFormaRecebimento("pix")).toEqual({
      value: "pix",
      label: "Pix",
      gateway: "inter_pix",
      vendaForma: "pix",
    });
  });

  it("mapeia máquina de débito para o gateway maquina e venda cartao_debito", () => {
    const forma = getFormaRecebimento("maquina_debito")!;
    expect(forma.gateway).toBe("maquina");
    expect(forma.vendaForma).toBe("cartao_debito");
  });

  it("mapeia crédito online para o gateway rede", () => {
    const forma = getFormaRecebimento("cartao_credito_online")!;
    expect(forma.gateway).toBe("rede");
    expect(forma.vendaForma).toBe("cartao_credito");
  });

  it("retorna undefined para value desconhecido", () => {
    expect(getFormaRecebimento("cheque")).toBeUndefined();
  });

  it("retorna undefined para string vazia", () => {
    expect(getFormaRecebimento("")).toBeUndefined();
  });
});

describe("labelFormaPagamento", () => {
  it("usa o label da forma de recebimento conhecida", () => {
    expect(labelFormaPagamento("dinheiro")).toBe("Dinheiro");
    expect(labelFormaPagamento("cartao_credito_online")).toBe("Cartão de crédito (online)");
  });

  it("cai para EXTRA_LABELS quando não é forma de recebimento", () => {
    expect(labelFormaPagamento("pendente")).toBe("A definir");
    expect(labelFormaPagamento("cartao_recorrencia")).toBe("Cartão em Recorrência");
    expect(labelFormaPagamento("plataforma_agregadora")).toBe("Plataforma Agregadora");
    expect(labelFormaPagamento("debito")).toBe("Cartão de Débito");
  });

  it("prioriza FORMAS_RECEBIMENTO sobre EXTRA_LABELS em caso de colisão", () => {
    // "boleto" existe em FORMAS_RECEBIMENTO e não em EXTRA_LABELS.
    expect(labelFormaPagamento("boleto")).toBe("Boleto");
  });

  it("devolve o próprio valor quando desconhecido", () => {
    expect(labelFormaPagamento("permuta")).toBe("permuta");
  });

  it("devolve '—' para nulo, undefined e string vazia", () => {
    expect(labelFormaPagamento(null)).toBe("—");
    expect(labelFormaPagamento(undefined)).toBe("—");
    expect(labelFormaPagamento()).toBe("—");
    expect(labelFormaPagamento("")).toBe("—");
  });
});
