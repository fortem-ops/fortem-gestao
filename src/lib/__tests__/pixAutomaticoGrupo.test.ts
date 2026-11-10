import { describe, it, expect } from "vitest";
import { somaItens, tetoSugerido, diaDebito, podeGerarCodigo } from "../pixAutomaticoGrupo";
import { dataInicioRecorrencia, vinculoRefGrupo } from "../../../supabase/functions/_shared/pix-aut-grupo";

describe("Pix Automático por grupo", () => {
  it("soma Start R$ 150 + Corrida Start R$ 170 = R$ 320", () => {
    expect(somaItens([{ valor: 150 }, { valor: "170.00" }])).toBe(320);
  });
  it("teto sugerido é a soma +15%", () => {
    expect(tetoSugerido(320)).toBe(368);
    expect(tetoSugerido(149.9)).toBe(172.39);
  });
  it("dia do débito é o vencimento mais próximo", () => {
    expect(diaDebito([{ vencimento: "2026-12-12" }, { vencimento: "2026-11-12" }, { vencimento: null }])).toBe("2026-11-12");
    expect(diaDebito([{ vencimento: null }])).toBeNull();
  });
  it("no máximo 3 códigos e só antes de ativa/cancelada", () => {
    expect(podeGerarCodigo("rascunho", 0)).toBe(true);
    expect(podeGerarCodigo("aguardando_autorizacao", 2)).toBe(true);
    expect(podeGerarCodigo("aguardando_autorizacao", 3)).toBe(false);
    expect(podeGerarCodigo("ativa", 1)).toBe(false);
    expect(podeGerarCodigo("cancelada", 0)).toBe(false);
  });
  it("1ª data da recorrência fica a pelo menos 3 dias de hoje, no mesmo dia do mês", () => {
    expect(dataInicioRecorrencia("2026-11-12", "2026-11-10")).toBe("2026-12-12");
    expect(dataInicioRecorrencia("2026-11-20", "2026-11-10")).toBe("2026-11-20");
    expect(dataInicioRecorrencia("2026-01-31", "2026-02-10")).toBe("2026-02-28");
    expect(dataInicioRecorrencia("2026-01-31", "2026-01-30")).toBe("2026-02-28");
  });
  it("vínculo enviado ao Inter identifica o grupo e cabe em 35 caracteres", () => {
    const ref = vinculoRefGrupo("2a50faab-1684-4700-8a91-876604bbe8f8");
    expect(ref).toBe("G2a50faab168447008a91876604bbe8f8");
    expect(ref.length).toBeLessThanOrEqual(35);
  });
});
