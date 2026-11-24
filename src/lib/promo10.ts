export const PROMO10_DATA_LIMITE = "2026-12-31";
export const PROMO10_UPGRADE_PROMO_MES = 80;
export const PROMO10_UPGRADE_CHEIO_MES = 100;
export const PROMO10_DESCONTO_EX_ALUNO = 300;

export type FrequenciaPromo10 = "1x" | "2x" | "3x" | "livre";
export type SegmentoPromo10 = "upgrade" | "wellhub" | "totalpass" | "ex_aluno" | "so_corrida" | "equipe" | "sem_oferta";

export interface ResultadoCicloPromo10 {
  proporcional: number;
  ciclos_completos: number;
  valor_completos: number;
  ultimo_proporcional: number;
  total: number;
  dias_restantes_ciclo_atual: number;
  dias_ciclo_atual: number;
}

function parseIsoDate(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

function addMonthsClamped(baseIso: string, months: number): Date {
  const [y, m, d] = baseIso.split("-").map(Number);
  const totalMonths = (m - 1) + months;
  const targetYear = y + Math.floor(totalMonths / 12);
  const targetMonth = ((totalMonths % 12) + 12) % 12;
  const lastDay = new Date(Date.UTC(targetYear, targetMonth + 1, 0)).getUTCDate();
  return new Date(Date.UTC(targetYear, targetMonth, Math.min(d, lastDay)));
}

function diffDays(a: Date, b: Date): number {
  return Math.round((a.getTime() - b.getTime()) / 86400000);
}

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export function calcularCicloPromo10(
  dataInicio: string | null,
  dataFim: string | null,
  hoje: string,
  degraus: number,
  valorMes: number
): ResultadoCicloPromo10 {
  if (!dataInicio || !dataFim || degraus <= 0 || valorMes <= 0) {
    return {
      proporcional: 0,
      ciclos_completos: 0,
      valor_completos: 0,
      ultimo_proporcional: 0,
      total: 0,
      dias_restantes_ciclo_atual: 0,
      dias_ciclo_atual: 0,
    };
  }
  const dtInicio = parseIsoDate(dataInicio);
  const dtFim = parseIsoDate(dataFim);
  const dtHoje = parseIsoDate(hoje);

  if (dtHoje >= dtFim) {
    return {
      proporcional: 0,
      ciclos_completos: 0,
      valor_completos: 0,
      ultimo_proporcional: 0,
      total: 0,
      dias_restantes_ciclo_atual: 0,
      dias_ciclo_atual: 0,
    };
  }

  const efetivo = dtHoje > dtInicio ? dtHoje : dtInicio;
  let k = 0;
  let cicloIni = addMonthsClamped(dataInicio, 0);
  let cicloFim = addMonthsClamped(dataInicio, 1);
  while (efetivo >= cicloFim) {
    k += 1;
    cicloIni = addMonthsClamped(dataInicio, k);
    cicloFim = addMonthsClamped(dataInicio, k + 1);
  }

  if (dtFim <= cicloFim) {
    const diasCiclo = diffDays(cicloFim, cicloIni);
    const diasRest = diffDays(dtFim, efetivo);
    const proporcional = round2((valorMes * degraus * diasRest) / diasCiclo);
    return {
      proporcional,
      ciclos_completos: 0,
      valor_completos: 0,
      ultimo_proporcional: 0,
      total: proporcional,
      dias_restantes_ciclo_atual: diasRest,
      dias_ciclo_atual: diasCiclo,
    };
  }

  let diasCiclo = 0;
  let diasRest = 0;
  let proporcional = 0;
  if (efetivo > cicloIni) {
    diasCiclo = diffDays(cicloFim, cicloIni);
    diasRest = diffDays(cicloFim, efetivo);
    proporcional = round2((valorMes * degraus * diasRest) / diasCiclo);
    k += 1;
  }

  let ciclosCompletos = 0;
  cicloIni = addMonthsClamped(dataInicio, k);
  cicloFim = addMonthsClamped(dataInicio, k + 1);
  while (cicloFim <= dtFim) {
    ciclosCompletos += 1;
    k += 1;
    cicloIni = addMonthsClamped(dataInicio, k);
    cicloFim = addMonthsClamped(dataInicio, k + 1);
  }

  let ultimoProporcional = 0;
  if (cicloIni < dtFim) {
    ultimoProporcional = round2(
      (valorMes * degraus * diffDays(dtFim, cicloIni)) / diffDays(cicloFim, cicloIni)
    );
  }

  const valorCompletos = round2(valorMes * degraus * ciclosCompletos);
  const total = round2(proporcional + valorCompletos + ultimoProporcional);

  return {
    proporcional,
    ciclos_completos: ciclosCompletos,
    valor_completos: valorCompletos,
    ultimo_proporcional: ultimoProporcional,
    total,
    dias_restantes_ciclo_atual: diasRest,
    dias_ciclo_atual: diasCiclo,
  };
}

export interface EntradaElegibilidadePromo10 {
  hoje: string;
  isEquipe: boolean;
  planoPrincipal: {
    tipo: string;
    familia?: string | null;
    dataInicio: string;
    dataFim: string | null;
    frequencia: FrequenciaPromo10 | null;
  } | null;
  temHistoricoPlanos: boolean;
  temCorridaAtiva: boolean;
  semestralElegivel?: boolean;
}

export function classificarSegmentoPromo10(e: EntradaElegibilidadePromo10): {
  encerrada: boolean;
  segmento: SegmentoPromo10 | null;
  destinosUpgrade: FrequenciaPromo10[];
  elegivelCorrida: boolean;
  nomeCorridaCatalogo: string | null;
} {
  if (e.hoje > PROMO10_DATA_LIMITE) {
    return { encerrada: true, segmento: null, destinosUpgrade: [], elegivelCorrida: false, nomeCorridaCatalogo: null };
  }
  if (e.isEquipe) {
    return { encerrada: false, segmento: "equipe", destinosUpgrade: [], elegivelCorrida: false, nomeCorridaCatalogo: null };
  }

  const p = e.planoPrincipal;
  let segmento: SegmentoPromo10 = "sem_oferta";
  let destinosUpgrade: FrequenciaPromo10[] = [];

  if (p) {
    const elegivelUpgrade =
      (p.familia === "power_2027" || p.familia === "pro_2027" ||
        (!p.familia && (p.tipo === "Start+" || p.tipo === "Power" || p.tipo === "Pro"))) &&
      p.dataFim !== null &&
      p.dataFim > e.hoje;

    if (elegivelUpgrade) {
      segmento = "upgrade";
      const ordem: FrequenciaPromo10[] = ["1x", "2x", "3x", "livre"];
      const idx = p.frequencia ? ordem.indexOf(p.frequencia) : -1;
      if (idx >= 0 && idx < ordem.length - 1) {
        destinosUpgrade = ordem.slice(idx + 1);
      }
    } else if (p.tipo === "Gympass/Wellhub") {
      segmento = "wellhub";
    } else if (p.tipo === "Total Pass") {
      segmento = "totalpass";
    } else if (p.tipo.toLowerCase().startsWith("corrida")) {
      segmento = "so_corrida";
    }
  } else if (e.temHistoricoPlanos) {
    segmento = "ex_aluno";
  }

  const elegivelCorrida = !e.temCorridaAtiva;
  let nomeCorridaCatalogo: string | null = null;
  if (elegivelCorrida) {
    if (!p) {
      nomeCorridaCatalogo = "Corrida - Sem Plano";
    } else if (p.familia === "pro_2027" || (!p.familia && (p.tipo === "Pro" || p.tipo === "VIP"))) {
      nomeCorridaCatalogo = "Corrida - Pro";
    } else if (p.familia === "power_2027" || (!p.familia && p.tipo === "Power")) {
      nomeCorridaCatalogo = "Corrida - Power";
    } else if (!p.familia && p.tipo === "Start+") {
      nomeCorridaCatalogo = "Corrida - Start+";
    } else if (p.familia === "start_2027" || (!p.familia && p.tipo === "Start")) {
      nomeCorridaCatalogo = "Corrida - Start";
    } else {
      nomeCorridaCatalogo = "Corrida - Sem Plano";
    }
  }

  return { encerrada: false, segmento, destinosUpgrade, elegivelCorrida, nomeCorridaCatalogo };
}