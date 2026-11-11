import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { beneficiosSemestral, planoTipoTemplate, semItensAgregadora } from "@/lib/semestral";

describe("Plano Semestral — listagem e contrato", () => {
  it("listas genéricas pedem ao banco só itens sem agregadora", () => {
    const chamadas: [string, null][] = [];
    const q = { is(c: string, v: null) { chamadas.push([c, v]); return q; } };
    semItensAgregadora(q);
    expect(chamadas).toEqual([["agregadora_requerida", null]]);
  });

  it.each([
    "src/components/student/venda/Venda2027Steps.tsx",
    "src/components/student/venda/VendaDialog.tsx",
  ])("%s lê o catálogo com o filtro de agregadora", (arquivo) => {
    const src = readFileSync(arquivo, "utf8");
    const leituras = src.match(/from\("planos_catalogo"\)[^;]*/g) ?? [];
    expect(leituras.length).toBeGreaterThan(0);
    for (const l of leituras) expect(src.slice(src.indexOf(l) - 40, src.indexOf(l))).toContain("semItensAgregadora(");
  });

  it("modelo de contrato do Semestral é o da agregadora do item", () => {
    expect(planoTipoTemplate({ familia: "semestral_2027", agregadora_requerida: "wellhub" })).toBe("semestral_wellhub");
    expect(planoTipoTemplate({ familia: "semestral_2027", agregadora_requerida: "totalpass" })).toBe("semestral_totalpass");
    expect(planoTipoTemplate({ familia: "start_2027", agregadora_requerida: null })).toBe("start_2027");
  });

  it("Pro mostra horários fixos e bota 4/ciclo; Start não", () => {
    const base = { id: "1", codigo: "x", nome: "Start Semestral", valor: 439, quantidade_creditos: 12, frequencia: "3x" };
    expect(beneficiosSemestral(base)).toEqual(["3x/semana", "12 créditos por ciclo"]);
    expect(beneficiosSemestral({ ...base, permite_fixar_horario: true, bota_compressao_mes: 4 }))
      .toEqual(["3x/semana", "12 créditos por ciclo", "Horários fixos", "Bota de compressão 4/ciclo"]);
  });

  it("ordem de ativação: plano da agregadora é encerrado depois de gravar o Semestral", () => {
    const sql = readFileSync("drizzle/migrations/0262_semestral_venda_ativacao.sql", "utf8");
    const corpo = sql.slice(sql.indexOf("FUNCTION public.fn_venda_semestral_criar"));
    const gravar = corpo.indexOf("fn_venda_2027_gravar(");
    const encerrar = corpo.indexOf("UPDATE public.planos SET ativo = false, data_fim = v_hoje");
    expect(gravar).toBeGreaterThan(0);
    expect(encerrar).toBeGreaterThan(gravar);
    expect(corpo).toContain("'substituir', false");
  });
});
