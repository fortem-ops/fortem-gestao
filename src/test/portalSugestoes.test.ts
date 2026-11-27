import { describe, expect, it } from "vitest";
import {
  podeGerenciarSugestoes,
  validarNovaSugestao,
  validarRespostaSugestao,
} from "@/lib/portalSugestoes";

describe("portalSugestoes", () => {
  it("valida nova sugestão corretamente", () => {
    expect(
      validarNovaSugestao({
        categoria: "treinos",
        titulo: "Mais horários à noite",
        descricao: "Seria ótimo ter uma turma às 20h30 nas terças e quintas.",
      }),
    ).toBeNull();

    expect(
      validarNovaSugestao({
        categoria: "invalida",
        titulo: "Teste",
        descricao: "Descrição suficientemente longa",
      }),
    ).toMatch(/categoria/i);

    expect(
      validarNovaSugestao({
        categoria: "app",
        titulo: "Oi",
        descricao: "Descrição suficientemente longa",
      }),
    ).toMatch(/título/i);

    expect(
      validarNovaSugestao({
        categoria: "app",
        titulo: "Ajuste no app",
        descricao: "Curta",
      }),
    ).toMatch(/10 caracteres/i);
  });

  it("exige resposta ao recusar e permite resposta opcional ao aprovar", () => {
    expect(validarRespostaSugestao({ status: "recusada", resposta: "   " })).toMatch(/obrig|resposta/i);
    expect(validarRespostaSugestao({ status: "recusada", resposta: "No momento não temos grade livre." })).toBeNull();
    expect(validarRespostaSugestao({ status: "aprovada", resposta: "" })).toBeNull();
    expect(validarRespostaSugestao({ status: "pendente", resposta: "ok" })).toMatch(/Aprovada ou Recusada/i);
  });

  it("permite gestão apenas para coordenador e admin", () => {
    expect(podeGerenciarSugestoes(["admin"])).toBe(true);
    expect(podeGerenciarSugestoes(["coordenador"])).toBe(true);
    expect(podeGerenciarSugestoes(["professor"])).toBe(false);
    expect(podeGerenciarSugestoes(["aluno"])).toBe(false);
    expect(podeGerenciarSugestoes([])).toBe(false);
  });
});