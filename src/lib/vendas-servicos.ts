// Regras de serviços bônus por plano (matriz aprovada)

export type OpcaoConsulta = {
  id: string;
  label: string;
  nutricao: number;
  reabilitacao: number;
  definir_depois?: boolean;
};

export type ServicosBase = {
  avaliacao_funcional: number; // sempre fixo
  // Opções de consulta — quando vazio, não há escolha (plano sem opção)
  opcoes_consulta: OpcaoConsulta[];
  // Quando há um set fixo (ex.: Max), as quantidades aqui são aplicadas direto
  consultas_fixas?: { nutricao: number; reabilitacao: number };
};

export type ServicosInclusos = {
  avaliacao_funcional: number;
  nutricao: number;
  reabilitacao: number;
  definir_depois: boolean;
};

const REGRAS: Record<string, ServicosBase | null> = {
  "Start": null,
  "Start+": { avaliacao_funcional: 1, opcoes_consulta: [] },
  "Power": {
    avaliacao_funcional: 1,
    opcoes_consulta: [
      { id: "nutri2", label: "2 Consultas de Nutrição", nutricao: 2, reabilitacao: 0 },
      { id: "reab2", label: "2 Consultas de Reabilitação", nutricao: 0, reabilitacao: 2 },
      { id: "definir", label: "Definir depois", nutricao: 0, reabilitacao: 0, definir_depois: true },
    ],
  },
  "Pro": {
    avaliacao_funcional: 2,
    opcoes_consulta: [
      { id: "nutri4", label: "4 Consultas de Nutrição", nutricao: 4, reabilitacao: 0 },
      { id: "reab4", label: "4 Consultas de Reabilitação", nutricao: 0, reabilitacao: 4 },
      { id: "mix22", label: "2 Nutrição + 2 Reabilitação", nutricao: 2, reabilitacao: 2 },
      { id: "definir", label: "Definir depois", nutricao: 0, reabilitacao: 0, definir_depois: true },
    ],
  },
  "Max": {
    avaliacao_funcional: 3,
    opcoes_consulta: [],
    consultas_fixas: { nutricao: 5, reabilitacao: 5 },
  },
};

export function getRegrasServicosPorPlano(nomePlano: string | undefined | null): ServicosBase | null {
  if (!nomePlano) return null;
  return REGRAS[nomePlano] ?? null;
}

export function planoTemEtapaServicos(nomePlano: string | undefined | null): boolean {
  return getRegrasServicosPorPlano(nomePlano) !== null;
}

export function montarServicosInclusos(
  regra: ServicosBase | null,
  opcaoSelecionada: OpcaoConsulta | null,
): ServicosInclusos {
  if (!regra) {
    return { avaliacao_funcional: 0, nutricao: 0, reabilitacao: 0, definir_depois: false };
  }
  if (regra.consultas_fixas) {
    return {
      avaliacao_funcional: regra.avaliacao_funcional,
      nutricao: regra.consultas_fixas.nutricao,
      reabilitacao: regra.consultas_fixas.reabilitacao,
      definir_depois: false,
    };
  }
  if (regra.opcoes_consulta.length === 0) {
    return {
      avaliacao_funcional: regra.avaliacao_funcional,
      nutricao: 0,
      reabilitacao: 0,
      definir_depois: false,
    };
  }
  const op = opcaoSelecionada;
  return {
    avaliacao_funcional: regra.avaliacao_funcional,
    nutricao: op?.nutricao ?? 0,
    reabilitacao: op?.reabilitacao ?? 0,
    definir_depois: !!op?.definir_depois,
  };
}

export function requerEscolhaServico(regra: ServicosBase | null): boolean {
  if (!regra) return false;
  return regra.opcoes_consulta.length > 0;
}

export function mapModalidadeParaContrato(modalidade: string, canal: string | null = null): string {
  switch (modalidade) {
    case "cartao_credito":
      return canal === "maquininha" ? "maquina_credito" : "cartao_recorrencia";
    case "pix_automatico": return "pix_automatico";
    case "boleto": return "boleto";
    case "debito": return "maquina_debito";
    case "dinheiro": return "dinheiro";
    case "pix_avista": return "dinheiro";
    case "pendente": return "pendente";
    default: return "pendente";
  }
}
