import {
  METRIC_META,
  ASSIMETRIA_NIVEL_LABEL,
  classificarAssimetria,
  classifyForca,
  getMetricDisplayLabel,
  nivelAssimetria,
  type AssimetriaNivel,
  type CompensationChain,
  type ForcaExercicio,
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
      nome: getForcaLabel(f.nome),
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

function getForcaLabel(nome: string): string {
  const labels: Partial<Record<ForcaExercicio, string>> = {
    rotacao_interna: "Ombro · Rotação Interna",
    rotacao_externa: "Ombro · Rotação Externa",
    flexao_ombro: "Ombro · Flexão",
    extensao_ombro: "Ombro · Extensão",
    abducao_ombro: "Ombro · Abdução",
    aducao_ombro: "Ombro · Adução",
    flexao_cotovelo: "Cotovelo · Flexão",
    extensao_cotovelo: "Cotovelo · Extensão",
    pronacao_antebraco: "Antebraço · Pronação",
    supinacao_antebraco: "Antebraço · Supinação",
    flexao_punho: "Punho · Flexão",
    extensao_punho: "Punho · Extensão",
    dorsiflexao: "Tornozelo · Dorsiflexão",
    flexao_plantar: "Tornozelo · Flexão Plantar",
    inversao: "Tornozelo · Inversão",
    flexao_joelho: "Joelho · Flexão",
    extensao_joelho: "Joelho · Extensão",
    flexao_quadril: "Quadril · Flexão",
    extensao_quadril: "Quadril · Extensão",
    abducao_quadril: "Quadril · Abdução",
    aducao_quadril: "Quadril · Adução",
  };
  return labels[nome as ForcaExercicio] ?? nome.replace(/_/g, " ");
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
    frase: `A maior diferença entre os lados está em ${maior.nome}. ${outras}`,
    pontos: pontos.length,
    equilibradas,
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