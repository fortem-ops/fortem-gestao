import { describe, it, expect } from "vitest";
import {
  deveGerarDocumento2027,
  formaEfetiva2027,
  formasPermitidas2027,
  maxParcelas2027,
  montarPayloadVenda2027,
  mostrarChipConsultoria,
  selecionarItem2027,
  type EntradaPayload2027,
} from "@/lib/vendaConsultoria2027";
import { calcularVenda2027 } from "@/lib/vendas2027";

const catalogo = [
  { id: "s1", familia: "start_2027", frequencia: "1x", modalidade_cobranca: "recorrencia_mensal", periodo_meses: 1 },
  { id: "p2", familia: "power_2027", frequencia: "2x", modalidade_cobranca: "anual", periodo_meses: 12 },
  { id: "p2r", familia: "power_2027", frequencia: "2x", modalidade_cobranca: "recorrencia_mensal", periodo_meses: 12 },
  { id: "c1", familia: "consultoria_2027", frequencia: "livre", modalidade_cobranca: "recorrencia_mensal", periodo_meses: 1, valor: 189 },
  { id: "c4", familia: "consultoria_2027", frequencia: "livre", modalidade_cobranca: "pacote", periodo_meses: 4, valor: 676 },
  { id: "c6", familia: "consultoria_2027", frequencia: "livre", modalidade_cobranca: "pacote", periodo_meses: 6, valor: 894 },
];

/** Expressão exatamente como estava no componente antes da E4c. */
function payloadAntigo(e: EntradaPayload2027) {
  const ehStart = e.familia === "start_2027";
  return {
    aluno_id: e.alunoId, catalogo_id: e.catalogoId, servicos: e.servicosSel, forma: e.forma,
    parcelas: e.forma === "cartao_parcelado" ? e.parcelas : 1,
    forma_servicos: e.formaServicos,
    parcelas_servicos: e.formaServicos === "cartao_parcelado" ? e.parcelasServicos : 1,
    data_inicio: e.dataInicio, primeiro_vencimento: e.primeiroVenc, substituir: e.substituir,
    observacoes: e.observacoes, idempotency_key: e.idem, desconto: e.desconto || 0,
    desconto_recorrente: ehStart && e.desconto > 0 && e.descontoRecorrente === "todos",
  };
}

const base: EntradaPayload2027 = {
  alunoId: "a", catalogoId: "x", familia: "start_2027", duracao: 1, servicosSel: [], forma: "recorrencia",
  parcelas: 12, formaServicos: "pix_vista", parcelasServicos: 6, dataInicio: "2026-11-01",
  primeiroVenc: "2026-11-01", substituir: false, observacoes: "", idem: "k", desconto: 0, descontoRecorrente: "",
};

describe("seleção de item", () => {
  it("Consultoria por duração", () => {
    expect(selecionarItem2027(catalogo, "consultoria_2027", "2x", "anual", 1)?.id).toBe("c1");
    expect(selecionarItem2027(catalogo, "consultoria_2027", "2x", "anual", 4)?.id).toBe("c4");
    expect(selecionarItem2027(catalogo, "consultoria_2027", "2x", "recorrencia_mensal", 6)?.id).toBe("c6");
  });
  it("demais famílias por frequência e modalidade (igual a antes)", () => {
    expect(selecionarItem2027(catalogo, "power_2027", "2x", "anual", 4)?.id).toBe("p2");
    expect(selecionarItem2027(catalogo, "power_2027", "2x", "recorrencia_mensal", 1)?.id).toBe("p2r");
    expect(selecionarItem2027(catalogo, "start_2027", "1x", "recorrencia_mensal", 6)?.id).toBe("s1");
  });
});

describe("formas por duração", () => {
  it("Mensal só recorrência; pacotes cartão/Pix com máximo N", () => {
    expect(formasPermitidas2027("consultoria_2027", 1)).toEqual(["recorrencia"]);
    expect(formasPermitidas2027("consultoria_2027", 4)).toEqual(["cartao_parcelado", "pix_vista"]);
    expect(maxParcelas2027("consultoria_2027", 4)).toBe(4);
    expect(maxParcelas2027("consultoria_2027", 6)).toBe(6);
    expect(formaEfetiva2027("consultoria_2027", 6, "recorrencia")).toBe("cartao_parcelado");
  });
  it("Start/Power/Pro iguais a antes", () => {
    expect(formaEfetiva2027("start_2027", 1, "cartao_parcelado")).toBe("recorrencia");
    for (const f of ["power_2027", "pro_2027"] as const) {
      for (const fp of ["cartao_parcelado", "pix_vista", "recorrencia"] as const) {
        expect(formaEfetiva2027(f, 4, fp)).toBe(fp);
      }
      expect(maxParcelas2027(f, 4)).toBe(12);
    }
  });
});

describe("serviços no pacote", () => {
  it("cálculo recusa serviço no pacote", () => {
    expect(() =>
      calcularVenda2027({ item: catalogo[4] as any, forma: "cartao_parcelado", parcelas: 4, servicos: [{ codigo: "x", valor: 100 }] }),
    ).toThrow();
  });
});

describe("desconto recorrente e documento", () => {
  it("só Start e Consultoria Mensal", () => {
    const d = { ...base, desconto: 20, descontoRecorrente: "todos" as const };
    expect(montarPayloadVenda2027(d).desconto_recorrente).toBe(true);
    expect(montarPayloadVenda2027({ ...d, familia: "consultoria_2027", duracao: 1 }).desconto_recorrente).toBe(true);
    expect(montarPayloadVenda2027({ ...d, familia: "consultoria_2027", duracao: 4, forma: "cartao_parcelado" }).desconto_recorrente).toBe(false);
    expect(montarPayloadVenda2027({ ...d, familia: "power_2027", forma: "recorrencia" }).desconto_recorrente).toBe(false);
  });
  it("documento pulado só para consultoria_2027", () => {
    expect(deveGerarDocumento2027("consultoria_2027")).toBe(false);
    for (const f of ["start_2027", "power_2027", "pro_2027"]) expect(deveGerarDocumento2027(f)).toBe(true);
  });
  it("chip só com item liberado ou aluno de teste", () => {
    expect(mostrarChipConsultoria(false, false)).toBe(false);
    expect(mostrarChipConsultoria(true, false)).toBe(true);
    expect(mostrarChipConsultoria(false, true)).toBe(true);
  });
});

describe("payload Start/Power/Pro idêntico ao anterior", () => {
  const casos: EntradaPayload2027[] = [
    { ...base, desconto: 50, descontoRecorrente: "todos" },
    { ...base, desconto: 50, descontoRecorrente: "primeiro" },
    { ...base, familia: "power_2027", duracao: 4, forma: "cartao_parcelado", parcelas: 12, servicosSel: ["sv"], formaServicos: "cartao_parcelado" },
    { ...base, familia: "power_2027", forma: "pix_vista", desconto: 30, descontoRecorrente: "todos" },
    { ...base, familia: "pro_2027", duracao: 6, forma: "recorrencia", servicosSel: ["sv"], formaServicos: "cartao_parcelado", parcelasServicos: 3 },
  ];
  it.each(casos.map((c, i) => [i, c] as const))("caso %i", (_i, c) => {
    expect(montarPayloadVenda2027(c)).toStrictEqual(payloadAntigo(c));
  });
});
