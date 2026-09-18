import { describe, it, expect } from "vitest";
import {
  dataParaISO,
  tituloDeSessao,
  dividirSessoes,
  montarSessoesParaConferencia,
} from "@/lib/fisioEvolucaoImport";

describe("leitura do histórico de fisioterapia", () => {
  it("converte data dd/mm/aaaa para o formato do banco", () => {
    expect(dataParaISO("23/02/2026")).toBe("2026-02-23");
    expect(dataParaISO("4/3/26")).toBe("2026-03-04");
    expect(dataParaISO("sem data")).toBeNull();
  });

  it("reconhece título com grau masculino, ordinal e marcadores", () => {
    expect(tituloDeSessao("**• **2° fisio 23/02/2026 (7a semana PO)**")).toEqual({
      n: 2,
      data: "2026-02-23",
    });
    expect(tituloDeSessao("● 5º fisio 04/03/2026 (8ª semana PO)")).toEqual({ n: 5, data: "2026-03-04" });
    expect(tituloDeSessao("- **45° fisio 17/07/2026 (27ª semana PO)**")).toEqual({
      n: 45,
      data: "2026-07-17",
    });
  });

  it("reconhece a variação com o número depois da palavra", () => {
    expect(tituloDeSessao("fisio 2 - 23/02/2026")).toEqual({ n: 2, data: "2026-02-23" });
    expect(tituloDeSessao("12ª sessão 10/03/2026")).toEqual({ n: 12, data: "2026-03-10" });
  });

  it("aceita sessão sem data no título", () => {
    expect(tituloDeSessao("7º fisio")).toEqual({ n: 7, data: null });
  });

  it("não confunde linhas comuns de conduta com título de sessão", () => {
    expect(tituloDeSessao("- ponte uni 2x10")).toBeNull();
    expect(tituloDeSessao("panturrilha bilateral 2x10")).toBeNull();
    expect(tituloDeSessao("")).toBeNull();
  });

  it("separa cabeçalho e sessões, ignorando marcas de página", () => {
    const texto = [
      "NOME: Ademar Fernandes Júnior",
      "AVALIAÇÃO: 20/02/2026",
      "QP: pós operatório de descompressão femoral do quadril direito",
      "## Page 2",
      "**2° fisio 23/02/2026 (7ª semana PO)**",
      "terapia manual",
      "ponte 2x10",
      "● 3º fisio 25/02/2026",
      "mobilizações passivas",
    ].join("\n");

    const r = dividirSessoes(texto);
    expect(r.dataCabecalho).toBe("2026-02-20");
    expect(r.cabecalho).toContain("QP:");
    expect(r.cabecalho).not.toContain("Page 2");
    expect(r.sessoes).toHaveLength(2);
    expect(r.sessoes[0]).toEqual({ n: 2, data: "2026-02-23", texto: "terapia manual\nponte 2x10" });
    expect(r.sessoes[1].n).toBe(3);
  });

  it("descarta sessões sem conteúdo", () => {
    const r = dividirSessoes("1º fisio 01/01/2026\n\n2º fisio 02/01/2026\nponte");
    expect(r.sessoes.map((s) => s.n)).toEqual([2]);
  });

  it("transforma a avaliação inicial na sessão 1", () => {
    const texto = [
      "NOME: Ademar Fernandes Júnior",
      "AVALIAÇÃO: 20/02/2026",
      "HDA: histórico bem longo do paciente para virar sessão 1",
      "**2° fisio 23/02/2026**",
      "terapia manual",
    ].join("\n");
    const lista = montarSessoesParaConferencia(texto);
    expect(lista.map((s) => s.n)).toEqual([1, 2]);
    expect(lista[0].data).toBe("2026-02-20");
    expect(lista[0].texto).toContain("HDA:");
  });

  it("não duplica a sessão 1 quando o documento já tem a primeira sessão numerada", () => {
    const texto = [
      "NOME: Paciente Exemplo com cabeçalho razoavelmente longo aqui",
      "AVALIAÇÃO: 20/02/2026",
      "1º fisio 20/02/2026",
      "terapia manual",
    ].join("\n");
    const lista = montarSessoesParaConferencia(texto);
    expect(lista.map((s) => s.n)).toEqual([1]);
    expect(lista[0].texto).toBe("terapia manual");
  });
});
