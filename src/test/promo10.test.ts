import { describe, expect, it } from "vitest";
import {
  PROMO10_UPGRADE_CHEIO_MES,
  PROMO10_UPGRADE_PROMO_MES,
  calcularCicloPromo10,
  classificarSegmentoPromo10,
} from "@/lib/promo10";

describe("Promoções 10 anos — cálculo de ciclo (espelho de fn_promo10_ciclo)", () => {
  it("Exemplo 1: metade de 1 ciclo de 30 dias, 1 degrau = R$ 40,00", () => {
    const r = calcularCicloPromo10("2026-11-01", "2026-12-01", "2026-11-16", 1, PROMO10_UPGRADE_PROMO_MES);
    expect(r.proporcional).toBe(40);
    expect(r.ciclos_completos).toBe(0);
    expect(r.total).toBe(40);
  });

  it("Exemplo 2: 21/30 do ciclo atual + 7 ciclos completos = R$ 616,00 / R$ 770,00 / economia R$ 154,00", () => {
    const promo = calcularCicloPromo10("2026-09-01", "2027-07-01", "2026-11-10", 1, PROMO10_UPGRADE_PROMO_MES);
    const cheio = calcularCicloPromo10("2026-09-01", "2027-07-01", "2026-11-10", 1, PROMO10_UPGRADE_CHEIO_MES);
    expect(promo.proporcional).toBe(56);
    expect(promo.ciclos_completos).toBe(7);
    expect(promo.total).toBe(616);
    expect(cheio.total).toBe(770);
    expect(Number((cheio.total - promo.total).toFixed(2))).toBe(154);
  });

  it("ciclo de 31 dias usa o denominador real de 31 dias", () => {
    const r = calcularCicloPromo10("2026-10-01", "2026-11-01", "2026-10-16", 1, 80);
    expect(r.dias_ciclo_atual).toBe(31);
    expect(r.dias_restantes_ciclo_atual).toBe(16);
    expect(r.total).toBe(41.29);
  });

  it("início dia 31 ajusta para 28 de fevereiro sem pular mês", () => {
    const r = calcularCicloPromo10("2026-01-31", "2026-04-30", "2026-02-14", 1, 80);
    // Ciclo 1: 31/01 -> 28/02 (28 dias), faltam 14 dias = R$ 40,00; depois 28/02->31/03 e 31/03->30/04 = 2 ciclos completos
    expect(r.dias_ciclo_atual).toBe(28);
    expect(r.proporcional).toBe(40);
    expect(r.ciclos_completos).toBe(2);
    expect(r.total).toBe(200);
  });

  it("dois degraus dobra o valor mensal", () => {
    const r = calcularCicloPromo10("2026-11-01", "2026-12-01", "2026-11-16", 2, 80);
    expect(r.total).toBe(80);
  });

  it("plano que termina no meio de um ciclo calcula o último pedaço proporcional", () => {
    // Ciclo 0: 01/11->01/12 (hoje=01/11, completo); Ciclo 1: 01/12->01/01 (31 dias), termina 16/12 (15 dias)
    const r = calcularCicloPromo10("2026-11-01", "2026-12-16", "2026-11-01", 1, 80);
    expect(r.ciclos_completos).toBe(1);
    expect(r.ultimo_proporcional).toBe(38.71);
    expect(r.total).toBe(118.71);
  });
});

describe("Promoções 10 anos — elegibilidade e segmentos", () => {
  it("upgrade: Power 2x recebe 3x e livre; Livre não recebe destinos", () => {
    const p2 = classificarSegmentoPromo10({
      hoje: "2026-11-24",
      isEquipe: false,
      planoPrincipal: { tipo: "Power", dataInicio: "2026-06-01", dataFim: "2027-06-01", frequencia: "2x" },
      temHistoricoPlanos: true,
      temCorridaAtiva: false,
    });
    expect(p2.segmento).toBe("upgrade");
    expect(p2.destinosUpgrade).toEqual(["3x", "livre"]);
    expect(p2.nomeCorridaCatalogo).toBe("Corrida - Power");

    const livre = classificarSegmentoPromo10({
      hoje: "2026-11-24",
      isEquipe: false,
      planoPrincipal: { tipo: "Pro", dataInicio: "2026-06-01", dataFim: "2027-06-01", frequencia: "livre" },
      temHistoricoPlanos: true,
      temCorridaAtiva: false,
    });
    expect(livre.destinosUpgrade).toEqual([]);
  });

  it("Start antigo, Start 2027, VIP e Consultoria ficam fora do upgrade; Start 2027 usa Corrida - Start", () => {
    for (const plano of [
      { tipo: "Start", familia: null, corrida: "Corrida - Start" },
      { tipo: "Start", familia: "start_2027", corrida: "Corrida - Start" },
      { tipo: "VIP", familia: null, corrida: "Corrida - Pro" },
      { tipo: "Consultoria Online", familia: null, corrida: "Corrida - Sem Plano" },
    ]) {
      const r = classificarSegmentoPromo10({
        hoje: "2026-11-24",
        isEquipe: false,
        planoPrincipal: { tipo: plano.tipo, familia: plano.familia, dataInicio: "2026-06-01", dataFim: "2027-06-01", frequencia: "2x" },
        temHistoricoPlanos: true,
        temCorridaAtiva: false,
      });
      expect(r.segmento).toBe("sem_oferta");
      expect(r.destinosUpgrade).toEqual([]);
      expect(r.nomeCorridaCatalogo).toBe(plano.corrida);
    }
  });

  it("Wellhub, TotalPass, ex-aluno, só Corrida, equipe e após 31/12/2026", () => {
    expect(
      classificarSegmentoPromo10({
        hoje: "2026-11-24",
        isEquipe: false,
        planoPrincipal: { tipo: "Gympass/Wellhub", dataInicio: "2026-11-01", dataFim: "2026-11-30", frequencia: null },
        temHistoricoPlanos: true,
        temCorridaAtiva: false,
      }).segmento
    ).toBe("wellhub");

    expect(
      classificarSegmentoPromo10({
        hoje: "2026-11-24",
        isEquipe: false,
        planoPrincipal: { tipo: "Total Pass", dataInicio: "2026-11-01", dataFim: "2026-11-30", frequencia: null },
        temHistoricoPlanos: true,
        temCorridaAtiva: false,
      }).segmento
    ).toBe("totalpass");

    expect(
      classificarSegmentoPromo10({
        hoje: "2026-11-24",
        isEquipe: false,
        planoPrincipal: null,
        temHistoricoPlanos: true,
        temCorridaAtiva: false,
      })
    ).toMatchObject({ segmento: "ex_aluno", elegivelCorrida: true, nomeCorridaCatalogo: "Corrida - Sem Plano" });

    expect(
      classificarSegmentoPromo10({
        hoje: "2026-11-24",
        isEquipe: false,
        planoPrincipal: { tipo: "Corrida - Sem Plano", dataInicio: "2026-10-01", dataFim: "2027-04-01", frequencia: "livre" },
        temHistoricoPlanos: true,
        temCorridaAtiva: true,
      })
    ).toMatchObject({ segmento: "so_corrida", elegivelCorrida: false, nomeCorridaCatalogo: null });

    expect(
      classificarSegmentoPromo10({
        hoje: "2026-11-24",
        isEquipe: true,
        planoPrincipal: { tipo: "Power", dataInicio: "2026-06-01", dataFim: "2027-06-01", frequencia: "2x" },
        temHistoricoPlanos: true,
        temCorridaAtiva: false,
      })
    ).toMatchObject({ segmento: "equipe", elegivelCorrida: false });

    expect(
      classificarSegmentoPromo10({
        hoje: "2027-01-01",
        isEquipe: false,
        planoPrincipal: { tipo: "Power", dataInicio: "2026-06-01", dataFim: "2027-06-01", frequencia: "2x" },
        temHistoricoPlanos: true,
        temCorridaAtiva: false,
      })
    ).toMatchObject({ encerrada: true, segmento: null, elegivelCorrida: false });
  });
});