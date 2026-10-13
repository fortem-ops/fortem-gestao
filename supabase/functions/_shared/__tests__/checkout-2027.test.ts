import { describe, it, expect, vi } from "vitest";
import * as srv from "../checkout-2027";
import * as web from "@/lib/contratos2027";

const pro3x = {
  familia: "pro_2027", versao: 2027, nome_exibicao: "Pro", frequencia: "3x",
  valor: 599, taxa_recorrencia: 24.9, licenca_dias: 20, avaliacoes_funcionais_meses: [1, 6],
  permite_fixar_horario: true, bota_compressao_mes: 4, brindes: ["camiseta", "garrafinha"],
  nivel_clube: "diamante", reposicao_saldo_pct: 50,
};
const startLivre = {
  familia: "start_2027", versao: 2027, nome_exibicao: "Start", frequencia: "livre",
  valor: 289, taxa_recorrencia: 0, licenca_dias: null, reposicao_saldo_pct: 50, brindes: [],
};
const servicos = [{ nome: "Nutrição 4 (2027)", valor: 480 }, { nome: "Reabilitação 8 (2027)", valor: 960 }];
const contratante = {
  nome: "Nicolas Teste", email: "t@x.com", cpf: "01574308041", data_nascimento: "1990-05-02", cep: "90035000",
  logradouro: "Av. Independência", numero: "100", complemento: null, bairro: "Independência", cidade: "Porto Alegre", uf: "RS",
};

describe("checkout 2027 — servidor", () => {
  it("variáveis do servidor são iguais às de src/lib/contratos2027.ts", () => {
    for (const item of [pro3x, startLivre]) {
      expect(srv.montarVariaveis2027(item as any, servicos)).toEqual(web.montarVariaveis2027(item as any, servicos));
    }
  });

  it("template por família x forma: recorrência própria; 12x e Pix à vista no parcelado", () => {
    expect(srv.formaTemplate("recorrencia")).toBe("cartao_recorrencia");
    expect(srv.formaTemplate("cartao_parcelado")).toBe("cartao_parcelado");
    expect(srv.formaTemplate("pix_vista")).toBe("cartao_parcelado");
    for (const f of ["recorrencia", "cartao_parcelado", "pix_vista"]) expect(srv.formaTemplate(f)).toBe(web.formaTemplate(f));
  });

  it("transições de estado", () => {
    expect(srv.podeTransitar("identificada", "contrato_aceito")).toBe(true);
    expect(srv.podeTransitar("contrato_aceito", "identificada")).toBe(true);
    expect(srv.podeTransitar("identificada", "paga")).toBe(false);
    expect(srv.podeTransitar("paga", "identificada")).toBe(false);
    expect(srv.podeTransitar("expirada", "identificada")).toBe(true);
  });

  it("expira em 24 horas sem atividade", () => {
    const t0 = new Date("2026-10-13T12:00:00Z");
    expect(srv.expirada(t0, new Date("2026-10-14T11:59:59Z"))).toBe(false);
    expect(srv.expirada(t0, new Date("2026-10-14T12:00:01Z"))).toBe(true);
  });

  it("CPF obrigatório e com dígitos válidos", () => {
    expect(srv.cpfDigitosValidos("")).toBe(false);
    expect(srv.cpfDigitosValidos("015.743.080-41")).toBe(true);
    expect(srv.cpfDigitosValidos("01574308042")).toBe(false);
    expect(srv.cpfDigitosValidos("00000000000")).toBe(false);
  });

  it("texto montado é determinístico: mesmo hash = idempotência do aceite", async () => {
    const tpl = "<p>%NOME% %CPF% %NOME_CONTRATO% %VALOR_FINAL_CONTRATO% %DIA%/%MES%/%ANO%</p>%ASSINATURA%%IP_ACEITE%";
    const agora = new Date("2026-10-13T15:00:00Z");
    const montar = () => srv.preencherContrato(tpl, srv.montarVariaveisContrato({
      contratante, templateNome: "Pro - 12x", totalCentavos: 598800, item: pro3x as any, servicos, agora,
    }));
    const a = montar(), b = montar();
    expect(a).toBe("<p>Nicolas Teste 015.743.080-41 Pro 3x R$ 5.988,00 13/10/2026</p>");
    expect(await srv.hashTexto(a)).toBe(await srv.hashTexto(b));
    expect(await srv.hashTexto(a + " ")).not.toBe(await srv.hashTexto(a));
  });

  it("hash igual ao SHA-256 do banco (hex de 64)", async () => {
    // sha256('abc') conhecido
    expect(await srv.hashTexto("abc")).toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
  });

  it("dados do contratante são escapados no HTML", () => {
    const v = srv.montarVariaveisContrato({
      contratante: { ...contratante, nome: "<script>x</script>" }, templateNome: "X", totalCentavos: 100, item: pro3x as any, servicos: [],
    });
    expect(v.NOME).not.toContain("<script>");
  });

  it("CPF nunca vai para log nem para variáveis guardadas", () => {
    expect(srv.semCpf("erro com 015.743.080-41 e 01574308041")).toBe("erro com *** e ***");
    const g = srv.variaveisParaGuardar({ CPF: "015.743.080-41" });
    expect(g.CPF).not.toContain("01574308041");
    expect(g.CPF).not.toContain("015.743.080");
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    console.error(srv.semCpf("falha 01574308041"));
    expect(spy.mock.calls.flat().join(" ")).not.toMatch(/\d{11}/);
    spy.mockRestore();
  });
});
