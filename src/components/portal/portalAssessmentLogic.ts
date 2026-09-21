import {
  METRIC_META,
  ASSIMETRIA_NIVEL_LABEL,
  classificarAssimetria,
  classifyForca,
  FORCA_EXERCICIO_LABEL,
  getMetricDisplayLabel,
  nivelAssimetria,
  type AssimetriaNivel,
  type CompensationChain,
} from "@/components/student/assessment/funcionalV2/bodyMapLogic";
import {
  compararPreocupacaoAssimetria,
  limiaresAssimetria,
  type AssimetriaResumoEvolucao,
} from "@/components/avaliacoes-premium/assimetriaGrafico";
import {
  montarForcaComparativo,
  montarMobilidadeComparativo,
  type LinhaForcaComparativo,
  type LinhaMobilidadeComparativo,
} from "@/components/avaliacoes-premium/comparativoValores";
import type { FuncionalSnapshot } from "@/components/avaliacoes-premium/useAlunoAvaliacoesConsolidadas";

export type PortalNivel = "equilibrado" | "atencao" | "prioridade";
export type PortalCamada = "mobilidade" | "flexibilidade" | "forca";

export interface PortalMedida {
  id: string;
  origem: string;
  nome: string;
  camada: PortalCamada;
  esquerdo: number;
  direito: number;
  unidadeLados: "°" | "kg";
  diferenca: number;
  unidadeDiferenca: "°" | "%";
  nivel: PortalNivel;
  nivelMotor: AssimetriaNivel;
  razaoSevero: number;
}

export interface PortalAnel {
  camada: PortalCamada;
  label: string;
  pontos: number;
  total: number;
  piorNivel: PortalNivel | null;
}

export interface PortalResumo {
  titulo: string;
  frase: string;
  pontos: number;
  equilibradas: number;
}

export interface PortalGrupoMedidas {
  camada: PortalCamada;
  label: string;
  medidas: PortalMedida[];
}

export interface PortalSeloInicio {
  titulo: string;
  texto: string;
  medida: PortalMedida | null;
  nivel: PortalNivel;
  quantidade: number;
}

export interface PortalSelosInicio {
  atencao: PortalSeloInicio;
  equilibrado: PortalSeloInicio;
}

const NIVEL_ORDEM: Record<PortalNivel, number> = { equilibrado: 0, atencao: 1, prioridade: 2 };

export function portalMetricLabel(metric: string): string {
  return getMetricDisplayLabel(metric)
    .replace(/^Mobilidade\s+/i, "")
    .replace(/^Flexibilidade\s+/i, "")
    .replace(/\s+-\s+/g, " · ")
    .replace(/^Ombro ·/i, "Ombro ·")
    .replace(/^Quadril ·/i, "Quadril ·");
}

export function portalNivel(nivel: AssimetriaNivel): PortalNivel {
  if (nivel === "severa") return "prioridade";
  if (nivel === "moderada") return "atencao";
  return "equilibrado";
}

export function portalNivelLabel(nivel: PortalNivel): string {
  const nivelMotor: Record<PortalNivel, AssimetriaNivel> = {
    equilibrado: "nenhuma",
    atencao: "moderada",
    prioridade: "severa",
  };
  return ASSIMETRIA_NIVEL_LABEL[nivelMotor[nivel]];
}

export function montarMedidasPortal(snapshot: FuncionalSnapshot | null | undefined): PortalMedida[] {
  if (!snapshot) return [];
  const metricas = snapshot.metricas.flatMap((m): PortalMedida[] => {
    if (m.left == null || m.right == null) return [];
    const info = classificarAssimetria(m.metric, m.left, m.right);
    if (!info) return [];
    const nivel = portalNivel(info.nivel);
    const { severo } = limiaresAssimetria(m.metric);
    return [{
      id: `metric:${m.metric}`,
      origem: m.metric,
      nome: portalMetricLabel(m.metric),
      camada: METRIC_META[m.metric]?.layer === "flexibility" ? "flexibilidade" : "mobilidade",
      esquerdo: m.left,
      direito: m.right,
      unidadeLados: "°",
      diferenca: Number(info.valor.toFixed(1)),
      unidadeDiferenca: info.unidade,
      nivel,
      nivelMotor: info.nivel,
      razaoSevero: severo > 0 ? info.valor / severo : 0,
    }];
  });

  const forca = snapshot.forca.flatMap((f): PortalMedida[] => {
    if (f.esquerdo_kg == null || f.direito_kg == null) return [];
    const diferenca = classifyForca(f.direito_kg, f.esquerdo_kg).assimetria;
    const nivelMotor = nivelAssimetria(undefined, diferenca);
    const { severo } = limiaresAssimetria();
    return [{
      id: `forca:${f.nome}`,
      origem: f.nome,
      nome: FORCA_EXERCICIO_LABEL[f.nome] ?? f.nome.replace(/_/g, " "),
      camada: "forca",
      esquerdo: f.esquerdo_kg,
      direito: f.direito_kg,
      unidadeLados: "kg",
      diferenca: Number(diferenca.toFixed(1)),
      unidadeDiferenca: "%",
      nivel: portalNivel(nivelMotor),
      nivelMotor,
      razaoSevero: severo > 0 ? diferenca / severo : 0,
    }];
  });

  return [...metricas, ...forca].sort((a, b) => {
    const porNivel = NIVEL_ORDEM[b.nivel] - NIVEL_ORDEM[a.nivel];
    if (porNivel !== 0) return porNivel;
    const porRazao = b.razaoSevero - a.razaoSevero;
    return porRazao !== 0 ? porRazao : a.nome.localeCompare(b.nome);
  });
}

export function agruparMedidasPortal(medidas: PortalMedida[]): PortalGrupoMedidas[] {
  const grupos: Array<{ camada: PortalCamada; label: string }> = [
    { camada: "mobilidade", label: "Mobilidade" },
    { camada: "flexibilidade", label: "Flexibilidade" },
    { camada: "forca", label: "Força" },
  ];
  return grupos.flatMap(({ camada, label }) => {
    const itens = medidas.filter((medida) => medida.camada === camada);
    return itens.length > 0 ? [{ camada, label, medidas: itens }] : [];
  });
}

export function montarAneisPortal(medidas: PortalMedida[]): PortalAnel[] {
  const definicoes: Array<{ camada: PortalCamada; label: string }> = [
    { camada: "mobilidade", label: "Mobilidade" },
    { camada: "flexibilidade", label: "Flexibilidade" },
    { camada: "forca", label: "Força" },
  ];
  return definicoes.map(({ camada, label }) => {
    const itens = medidas.filter((m) => m.camada === camada);
    const pontos = itens.filter((m) => m.nivel !== "equilibrado").length;
    const piorNivel = itens.length === 0
      ? null
      : itens.reduce<PortalNivel>((pior, item) => NIVEL_ORDEM[item.nivel] > NIVEL_ORDEM[pior] ? item.nivel : pior, "equilibrado");
    return { camada, label, pontos, total: itens.length, piorNivel };
  });
}

export function montarResumoPortal(medidas: PortalMedida[]): PortalResumo {
  const pontos = medidas.filter((m) => m.nivel !== "equilibrado");
  const equilibradas = medidas.length - pontos.length;
  if (pontos.length === 0) {
    return {
      titulo: "Tudo equilibrado",
      frase: "Nenhuma medida mostrou diferença importante entre os lados.",
      pontos: 0,
      equilibradas,
    };
  }
  const maior = pontos[0];
  const outras = equilibradas === 0
    ? "Nenhuma das demais medidas está equilibrada."
    : equilibradas === 1
      ? "A outra medida está equilibrada."
      : `As outras ${equilibradas} medidas estão equilibradas.`;
  return {
    titulo: `${pontos.length} ${pontos.length === 1 ? "ponto" : "pontos"} para acompanhar`,
    frase: `A maior diferença entre os lados está em ${maior.camada === "forca" ? "Força · " : ""}${maior.nome}. ${outras}`,
    pontos: pontos.length,
    equilibradas,
  };
}

function nomeCompletoMedida(medida: PortalMedida): string {
  return medida.camada === "forca" ? `Força · ${medida.nome}` : medida.nome;
}

export function montarSelosInicio(medidas: PortalMedida[]): PortalSelosInicio {
  const ordenadas = [...medidas].sort((a, b) => {
    const porNivel = NIVEL_ORDEM[b.nivel] - NIVEL_ORDEM[a.nivel];
    if (porNivel !== 0) return porNivel;
    const porRazao = b.razaoSevero - a.razaoSevero;
    return porRazao !== 0 ? porRazao : a.nome.localeCompare(b.nome);
  });
  const medidaAtencao = ordenadas.find((medida) => medida.nivel !== "equilibrado") ?? null;
  const menorRazao = medidas.reduce(
    (menor, medida) => Math.min(menor, medida.razaoSevero),
    Number.POSITIVE_INFINITY,
  );
  const maisEquilibradas = Number.isFinite(menorRazao)
    ? medidas.filter((medida) => Math.abs(medida.razaoSevero - menorRazao) < 1e-9)
    : [];
  const medidaEquilibrada = maisEquilibradas[0] ?? null;
  const empateEmZero = medidaEquilibrada?.diferenca === 0;

  return {
    atencao: medidaAtencao
      ? {
          titulo: "Ponto de atenção",
          texto: nomeCompletoMedida(medidaAtencao),
          medida: medidaAtencao,
          nivel: medidaAtencao.nivel,
          quantidade: 1,
        }
      : {
          titulo: "Ponto de atenção",
          texto: "Nenhum ponto de atenção",
          medida: null,
          nivel: "equilibrado",
          quantidade: 0,
        },
    equilibrado: maisEquilibradas.length > 1
      ? {
          titulo: "Mais equilibrado",
          texto: empateEmZero
            ? `${maisEquilibradas.length} medidas sem diferença entre os lados`
            : `${maisEquilibradas.length} medidas igualmente equilibradas`,
          medida: null,
          nivel: "equilibrado",
          quantidade: maisEquilibradas.length,
        }
      : {
          titulo: "Mais equilibrado",
          texto: medidaEquilibrada ? nomeCompletoMedida(medidaEquilibrada) : "Sem medidas comparáveis",
          medida: medidaEquilibrada,
          nivel: "equilibrado",
          quantidade: medidaEquilibrada ? 1 : 0,
        },
  };
}

export function deduplicarCadeias(chains: CompensationChain[]): CompensationChain[] {
  const vistos = new Set<string>();
  return chains.filter((chain) => {
    const chave = chain.reason.trim().toLocaleLowerCase("pt-BR");
    if (vistos.has(chave)) return false;
    vistos.add(chave);
    return true;
  });
}

export function filtrarComparativoMudou(
  anterior: FuncionalSnapshot | null,
  atual: FuncionalSnapshot | null,
): {
  mobilidade: LinhaMobilidadeComparativo[];
  mobilidadeSemMudanca: number;
  forca: LinhaForcaComparativo[];
  forcaSemMudanca: number;
} {
  const mobilidadeCompleta = montarMobilidadeComparativo(anterior, atual);
  const forcaCompleta = montarForcaComparativo(anterior, atual);
  const mobilidade = mobilidadeCompleta.filter((row) => row.resumo !== "Sem mudança");
  const forca = forcaCompleta.filter((row) => row.resumo !== "Estável");
  return {
    mobilidade,
    mobilidadeSemMudanca: mobilidadeCompleta.length - mobilidade.length,
    forca,
    forcaSemMudanca: forcaCompleta.length - forca.length,
  };
}

export function ordenarEvolucaoPortal(resumos: AssimetriaResumoEvolucao[]): AssimetriaResumoEvolucao[] {
  return [...resumos].sort(compararPreocupacaoAssimetria);
}