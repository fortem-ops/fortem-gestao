import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  tryParseKinologyDeterministic,
  normalizeDate,
  toNumber,
} from "../kinology-parser.ts";

const fixture = (name: string) =>
  readFileSync(
    fileURLToPath(new URL(`./fixtures/kinology/${name}.txt`, import.meta.url)),
    "utf8",
  );

/** Atalho: mapa nome → "D/E" de uma entrada de histórico. */
const porNome = (exs: { nome: string; direito_kg: number; esquerdo_kg: number }[]) =>
  Object.fromEntries(exs.map((e) => [e.nome, `${e.direito_kg}/${e.esquerdo_kg}`]));

describe("kinology-parser · helpers", () => {
  it("normalizeDate expande ano de 2 dígitos e preserva 4 dígitos", () => {
    expect(normalizeDate("20/03/25")).toBe("20/03/2025");
    expect(normalizeDate("20/03/2025")).toBe("20/03/2025");
  });

  it("toNumber aceita vírgula e ponto decimal", () => {
    expect(toNumber("14,4")).toBe(14.4);
    expect(toNumber("14.4")).toBe(14.4);
    expect(toNumber("56")).toBe(56);
  });
});

describe("kinology-parser · fixture Carla Luciane (bug: histórico ignorado)", () => {
  const r = tryParseKinologyDeterministic(fixture("carla"));

  it("lê a medição atual completa e a data de emissão", () => {
    expect(r.dataEmissao).toBe("20/08/2026");
    expect(r.exercicios).toHaveLength(6);
    expect(porNome(r.exercicios)).toEqual({
      rotacao_interna: "14.4/13",
      rotacao_externa: "10.2/7.8",
      abducao_quadril: "15.6/13",
      extensao_joelho: "45.2/43.4",
      flexao_joelho: "14.4/17.6",
      extensao_quadril: "14.4/17.8",
    });
  });

  it("captura o histórico completo (não marca como incerto)", () => {
    expect(r.historicoIncerto).toBe(false);
    expect(r.historico.map((h) => h.data)).toEqual(["17/08/2026", "20/03/2025"]);
  });

  it("atribui os 6 exercícios à medição antiga de 20/03/2025", () => {
    const antiga = r.historico.find((h) => h.data === "20/03/2025")!;
    expect(antiga.exercicios).toHaveLength(6);
    expect(porNome(antiga.exercicios)).toEqual({
      rotacao_interna: "7.8/7.8",
      rotacao_externa: "6.4/5.2",
      abducao_quadril: "12.8/12.6",
      extensao_joelho: "48/40.2",
      flexao_joelho: "11.6/14",
      extensao_quadril: "14.6/18.6",
    });
  });

  it("a última linha do histórico bate com a medição atual", () => {
    const atual = r.historico.find((h) => h.data === "17/08/2026")!;
    expect(porNome(atual.exercicios)).toEqual(porNome(r.exercicios));
  });
});

describe("kinology-parser · fixture Lucas Santolin (datas heterogêneas por exercício)", () => {
  const r = tryParseKinologyDeterministic(fixture("lucas"));

  it("lê os 9 exercícios da medição atual", () => {
    expect(r.historicoIncerto).toBe(false);
    expect(r.exercicios).toHaveLength(9);
    expect(r.exercicios.every((e) => e.data === "09/07/2026")).toBe(true);
  });

  it("não descarta o histórico mesmo com contagens diferentes por data", () => {
    expect(r.historico.map((h) => h.data)).toEqual([
      "09/07/2026",
      "26/08/2025",
      "18/03/2024",
    ]);
  });

  it("atribui 18/03/2024 apenas a dorsiflexão e flexão plantar", () => {
    const antiga = r.historico.find((h) => h.data === "18/03/2024")!;
    expect(porNome(antiga.exercicios)).toEqual({
      dorsiflexao: "31/25.2",
      flexao_plantar: "57.2/46.6",
    });
  });

  it("26/08/2025 tem os 6 exercícios que existiam naquela data (sem tornozelo)", () => {
    const meio = r.historico.find((h) => h.data === "26/08/2025")!;
    expect(meio.exercicios).toHaveLength(6);
    expect(Object.keys(porNome(meio.exercicios)).sort()).toEqual([
      "abducao_quadril",
      "extensao_joelho",
      "extensao_quadril",
      "flexao_joelho",
      "rotacao_externa",
      "rotacao_interna",
    ]);
    expect(porNome(meio.exercicios).extensao_joelho).toBe("54.2/58.2");
  });

  it("cada exercício aparece no histórico com suas próprias datas", () => {
    const datasPorExercicio = new Map<string, string[]>();
    for (const h of r.historico) {
      for (const e of h.exercicios) {
        datasPorExercicio.set(e.nome, [...(datasPorExercicio.get(e.nome) ?? []), h.data]);
      }
    }
    expect(datasPorExercicio.get("dorsiflexao")).toEqual(["09/07/2026", "18/03/2024"]);
    expect(datasPorExercicio.get("rotacao_interna")).toEqual(["09/07/2026", "26/08/2025"]);
  });
});

describe("kinology-parser · fixtures extras (variedade de layout)", () => {
  it("Airton 2025: lê medição atual e histórico de 2024", () => {
    const r = tryParseKinologyDeterministic(fixture("airton-2025"));
    expect(r.dataEmissao).toBe("22/07/2025");
    expect(r.exercicios).toHaveLength(6);
    expect(r.historico.map((h) => h.data)).toEqual(["22/07/2025", "05/09/2024"]);
    expect(porNome(r.historico[1].exercicios).rotacao_interna).toBe("18.4/16.8");
  });

  it("Airton 2024: layout não reconhecido devolve vazio sem marcar incerto (cai pra IA)", () => {
    const r = tryParseKinologyDeterministic(fixture("airton-2024"));
    expect(r.exercicios).toEqual([]);
    expect(r.historico).toEqual([]);
    expect(r.historicoIncerto).toBe(false);
  });
});

describe("kinology-parser · casos sintéticos", () => {
  it("normaliza ano de 2 dígitos e decimais com vírgula no histórico", () => {
    const texto = [
      "Assimetria e Indicativos de Risco | Membros Superiores",
      "Rotação interna 17/08/2026 14,4 kg 13,0 kg 9,7 %",
      "Evolução de Assimetria",
      "Rotação interna",
      "20/03/25 7,8 kg 7,8 kg 0,0 %",
      "17/08/26 14,4 kg 13,0 kg 9,7 %",
    ].join("\n");

    const r = tryParseKinologyDeterministic(texto);
    expect(r.historicoIncerto).toBe(false);
    expect(r.exercicios).toEqual([
      { nome: "rotacao_interna", data: "17/08/2026", direito_kg: 14.4, esquerdo_kg: 13 },
    ]);
    expect(r.historico.map((h) => h.data)).toEqual(["17/08/2026", "20/03/2025"]);
    expect(porNome(r.historico[1].exercicios)).toEqual({ rotacao_interna: "7.8/7.8" });
  });

  it("ignora a ocorrência do índice (\"Evolução de Assimetria ... Disponível\")", () => {
    const texto = [
      "Índice",
      "Evolução de Assimetria .......... Disponível",
      "Assimetria e Indicativos de Risco | Membros Inferiores",
      "Flexão de joelho 17/08/2026 14,4 kg 17,6 kg 18,2 %",
      "Evolução de Assimetria",
      "Flexão de joelho",
      "20/03/2025 11,6 kg 14,0 kg 17,1 %",
      "17/08/2026 14,4 kg 17,6 kg 18,2 %",
    ].join("\n");

    const r = tryParseKinologyDeterministic(texto);
    expect(r.historicoIncerto).toBe(false);
    expect(r.historico.map((h) => h.data)).toEqual(["17/08/2026", "20/03/2025"]);
    expect(r.historico[1].exercicios[0].nome).toBe("flexao_joelho");
  });

  it("distribui bloco de 2 colunas e bloco final com rótulo isolado (nº ímpar)", () => {
    const texto = [
      "Assimetria e Indicativos de Risco | Membros Inferiores",
      "Flexão de joelho 17/08/2026 14,4 kg 17,6 kg 18,2 %",
      "Extensão de joelho 17/08/2026 45,2 kg 43,4 kg 4,0 %",
      "Abdução de quadril 17/08/2026 15,6 kg 13,0 kg 16,7 %",
      "Evolução de Assimetria",
      // bloco 1: duas mini-tabelas lado a lado, linhas intercaladas
      "Flexão de joelho",
      "Extensão de joelho",
      "20/03/2025 11,6 kg 14,0 kg 17,1 %",
      "20/03/2025 48,0 kg 40,2 kg 16,3 %",
      "17/08/2026 14,4 kg 17,6 kg 18,2 %",
      "17/08/2026 45,2 kg 43,4 kg 4,0 %",
      // bloco 2: rótulo isolado (número ímpar de tabelas)
      "Abdução de quadril",
      "20/03/2025 12,8 kg 12,6 kg 1,6 %",
      "17/08/2026 15,6 kg 13,0 kg 16,7 %",
    ].join("\n");

    const r = tryParseKinologyDeterministic(texto);
    expect(r.historicoIncerto).toBe(false);
    expect(r.historico.map((h) => h.data)).toEqual(["17/08/2026", "20/03/2025"]);
    const antiga = r.historico.find((h) => h.data === "20/03/2025")!;
    expect(porNome(antiga.exercicios)).toEqual({
      flexao_joelho: "11.6/14",
      extensao_joelho: "48/40.2",
      abducao_quadril: "12.8/12.6",
    });
  });

  it("marca histórico como incerto quando a última linha não bate com a medição atual", () => {
    const texto = [
      "Assimetria e Indicativos de Risco | Membros Superiores",
      "Rotação interna 17/08/2026 14,4 kg 13,0 kg 9,7 %",
      "Evolução de Assimetria",
      "Rotação interna",
      "20/03/2025 7,8 kg 7,8 kg 0,0 %",
      "17/08/2026 99,9 kg 88,8 kg 9,7 %",
    ].join("\n");

    const r = tryParseKinologyDeterministic(texto);
    expect(r.historicoIncerto).toBe(true);
    expect(r.historico).toEqual([]);
    // a medição atual continua válida — o caller usa ela e só o histórico vai pra IA
    expect(r.exercicios).toHaveLength(1);
  });

  it("sem seção de evolução: histórico vazio e não incerto", () => {
    const texto = [
      "Assimetria e Indicativos de Risco | Membros Superiores",
      "Rotação externa 17/08/2026 10,2 kg 7,8 kg 23,5 %",
    ].join("\n");

    const r = tryParseKinologyDeterministic(texto);
    expect(r.exercicios).toHaveLength(1);
    expect(r.historico).toEqual([]);
    expect(r.historicoIncerto).toBe(false);
  });
});
