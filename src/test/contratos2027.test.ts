import { describe, it, expect } from "vitest";
import {
  ehPlanoVersionado,
  formaTemplate,
  montarVariaveis2027,
  montarClausulaReposicao,
  type CatalogoPlano2027,
} from "@/lib/contratos2027";

const pro3x: CatalogoPlano2027 = {
  familia: "pro_2027", versao: 2027, nome_exibicao: "Pro", frequencia: "3x",
  valor: 599, taxa_recorrencia: 24.9, licenca_dias: 20, avaliacoes_funcionais_meses: [1, 6],
  permite_fixar_horario: true, bota_compressao_mes: 4, brindes: ["camiseta", "garrafinha"],
  nivel_clube: "diamante", reposicao_saldo_pct: 50,
};
const power1x: CatalogoPlano2027 = {
  familia: "power_2027", versao: 2027, nome_exibicao: "Power", frequencia: "1x",
  valor: 329, taxa_recorrencia: 24.9, licenca_dias: 10, avaliacoes_funcionais_meses: [1],
  brindes: ["camiseta"], nivel_clube: "ouro", reposicao_saldo_pct: 0,
};

describe("contratos 2027", () => {
  it("legado (versao nula) não usa template 2027", () => {
    expect(ehPlanoVersionado({ versao: null, familia: null })).toBe(false);
    expect(ehPlanoVersionado(pro3x)).toBe(true);
  });

  it("12x e PIX à vista usam o mesmo template parcelado", () => {
    expect(formaTemplate("tradicional")).toBe("cartao_parcelado");
    expect(formaTemplate("recorrencia")).toBe("cartao_recorrencia");
  });

  it("valor mensal da recorrência inclui a taxa de R$ 24,90", () => {
    const v = montarVariaveis2027(pro3x, []);
    expect(v.VALOR_MENSAL).toBe("R$ 623,90");
    expect(v.TAXA_RECORRENCIA).toBe("R$ 24,90");
  });

  it("licença: Power 10 dias, Pro 20 dias", () => {
    expect(montarVariaveis2027(power1x, []).LICENCA_DIAS).toBe("10");
    expect(montarVariaveis2027(pro3x, []).LICENCA_DIAS).toBe("20");
  });

  it("reposição de 50% só no Pro fora do Livre", () => {
    expect(montarClausulaReposicao(pro3x)).toContain("50%");
    expect(montarClausulaReposicao({ ...pro3x, frequencia: "livre" })).toBe("");
    expect(montarClausulaReposicao(power1x)).toBe("");
  });

  it("benefícios do Pro: 2 avaliações, bota 4/mês; Power: 1 avaliação", () => {
    const pro = montarVariaveis2027(pro3x, []).BENEFICIOS_PLANO;
    expect(pro).toContain("2 avaliações funcionais (1º e 6º mês)");
    expect(pro).toContain("4 sessões por mês de bota de compressão");
    const pw = montarVariaveis2027(power1x, []).BENEFICIOS_PLANO;
    expect(pw).toContain("1 (uma) avaliação funcional no 1º mês");
    expect(pw).not.toContain("bota");
  });

  it("tabela de serviços usa os preços do catálogo", () => {
    const t = montarVariaveis2027(pro3x, [{ nome: "Reabilitação - 4 sessões (2027)", valor: 600 }]).TABELA_SERVICOS;
    expect(t).toContain("Reabilitação - 4 sessões: R$ 600,00");
  });
});
