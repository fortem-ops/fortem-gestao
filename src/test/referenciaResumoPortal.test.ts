import { describe, expect, it } from "vitest";
import {
  escolherResumoReferencia,
  montarResumoReferencia,
} from "@/components/portal/referenciaResumoPortal";

const resumo = (n: number) => ({ n, media: 50, desvio: 5 });

describe("Resumo da base Fortem no portal", () => {
  it("usa a faixa etária quando tem amostra suficiente", () => {
    const escolha = escolherResumoReferencia({ "30-44": resumo(20), todos: resumo(300) }, "30-44");
    expect(escolha?.n).toBe(20);
  });

  it("cai no grupo todos quando a faixa tem amostra pequena", () => {
    const escolha = escolherResumoReferencia({ "30-44": resumo(14), todos: resumo(300) }, "30-44");
    expect(escolha?.n).toBe(300);
  });

  it("não devolve referência quando nem a faixa nem o todos atingem o mínimo", () => {
    expect(escolherResumoReferencia({ "30-44": resumo(14), todos: resumo(14) }, "30-44")).toBeNull();
    expect(escolherResumoReferencia(undefined, "30-44")).toBeNull();
  });

  it("agrupa as linhas por métrica, sexo e faixa", () => {
    const mapa = montarResumoReferencia([
      { metrica: "Mobilidade Ombro RI", sexo: "F", faixa: "todos", n: 40, media: "62.5", desvio: "8" },
      { metrica: "Mobilidade Ombro RI", sexo: "F", faixa: "18-29", n: 16, media: 64, desvio: 7 },
    ]);
    expect(mapa["Mobilidade Ombro RI"].F.todos).toEqual({ n: 40, media: 62.5, desvio: 8 });
    expect(escolherResumoReferencia(mapa["Mobilidade Ombro RI"].F, "18-29")?.n).toBe(16);
  });
});
