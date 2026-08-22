/**
 * Cálculo puro do resumo de preço da Campanha Corrida.
 * Extraído de CorridaConfigurator.tsx sem alteração de comportamento.
 */

export type Rota = "aluno" | "somente_corrida" | "prospect" | "somente_provas";
export type Tier = "start" | "start_plus" | "power" | "pro" | "max";
export type Distancia = "5K" | "10K" | "21K" | "42K";
export type ProvaKey = "NB" | "MIPOA";

export interface PlanoCatalogo {
  nome: string;
  periodo_meses: number;
  valor: number;
}

export interface CampanhaItem {
  id: string;
  tipo: string;
  rota: string | null;
  tier: string | null;
  nivel: string | null;
  prova_nome: string | null;
  distancia: string | null;
  descricao: string | null;
  valor: number;
  isento: boolean;
  condicao: string | null;
  imagem_url?: string | null;
}

/* Datas oficiais das provas */
export const PROVA_LABEL: Record<ProvaKey, string> = {
  NB: "NB 42k 2027",
  MIPOA: "42ª Maratona Internacional de Porto Alegre 2027",
};

export const PROVA_DATAS: Record<ProvaKey, { curtas: string; maratona: string }> = {
  NB: { curtas: "21 de agosto de 2027", maratona: "22 de agosto de 2027" },
  MIPOA: { curtas: "5 de junho de 2027", maratona: "6 de junho de 2027" },
};

export const dataProva = (prova: ProvaKey, distancia: Distancia) =>
  distancia === "42K" ? PROVA_DATAS[prova].maratona : PROVA_DATAS[prova].curtas;

export const brl = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

/* Nome do plano exibido ao cliente (esconde nomenclatura interna) */
export const PLANO_NOME_EXIBICAO: Record<string, string> = {
  "Corrida - Prospect": "Assessoria de Corrida Fortem",
  "Corrida - Sem Plano": "Corrida Fortem (sem plano de treino)",
};

export const nomePlanoExibicao = (nome: string) => PLANO_NOME_EXIBICAO[nome] ?? nome;

export interface OfertaCorrida {
  planoAnual?: PlanoCatalogo | null;
  planoMensal?: PlanoCatalogo | null;
  kits: CampanhaItem[];
  aval?: CampanhaItem | null;
  cortesia?: CampanhaItem | null;
  mipoaItem?: CampanhaItem | null;
  provaValor?: ((prova: ProvaKey, distancia: Distancia) => CampanhaItem | undefined) | null;
}

export interface ResumoParams {
  oferta: OfertaCorrida | null;
  rota: Rota | null;
  periodo: "mensal" | "anual";
  distanciaCortesia: Distancia;
  kitNivel: string | null;
  mipoa: boolean;
  distanciaMipoa: Distancia;
  avaliacao: boolean;
  provasSel: Record<ProvaKey, { ativo: boolean; distancia: Distancia }>;
  maxParcelas: number;
}

export interface ResumoLinha {
  label: string;
  valor: number;
  nota?: string;
}

export interface ResumoCorrida {
  linhas: ResumoLinha[];
  hoje: number;
  recorrente: number;
}

export function calcularResumoCorrida(params: ResumoParams): ResumoCorrida | null {
  const {
    oferta,
    rota,
    periodo,
    distanciaCortesia,
    kitNivel,
    mipoa,
    distanciaMipoa,
    avaliacao,
    provasSel,
    maxParcelas,
  } = params;

  if (!oferta || !rota) return null;
  const linhas: ResumoLinha[] = [];
  let hoje = 0;
  let recorrente = 0;

  if (rota === "somente_provas") {
    (["NB", "MIPOA"] as ProvaKey[]).forEach((pk) => {
      const sel = provasSel[pk];
      if (!sel.ativo) return;
      const item = oferta.provaValor?.(pk, sel.distancia);
      if (!item) return;
      linhas.push({
        label: `${PROVA_LABEL[pk]} — ${sel.distancia} · ${dataProva(pk, sel.distancia)}`,
        valor: Number(item.valor),
      });
      hoje += Number(item.valor);
    });
  } else {
    const anual = rota !== "prospect" || periodo === "anual";
    const p = anual ? oferta.planoAnual : oferta.planoMensal;
    if (p) {
      const nomeExib = nomePlanoExibicao(p.nome);
      if (anual) {
        linhas.push({
          label: `${nomeExib} — ${brl(Number(p.valor) / 12)}/mês (Plano Anual)`,
          valor: Number(p.valor),
          nota: `${brl(Number(p.valor))} em até ${maxParcelas}x`,
        });
        hoje += Number(p.valor);
      } else {
        linhas.push({ label: `${nomeExib} — Mensal`, valor: Number(p.valor), nota: "recorrência mensal no cartão" });
        hoje += Number(p.valor);
        recorrente = Number(p.valor);
      }
    }
    const cortesiaAtiva = oferta.cortesia && (rota !== "prospect" || periodo === "anual");
    if (cortesiaAtiva) {
      linhas.push({
        label: `Cortesia: ${oferta.cortesia!.descricao} — ${distanciaCortesia} · ${dataProva("NB", distanciaCortesia)}`,
        valor: 0,
      });
    }
  }

  if (kitNivel) {
    const kit = oferta.kits.find((k) => k.nivel === kitNivel);
    if (kit) {
      linhas.push({ label: `Kit Fortem — ${kit.descricao}`, valor: kit.isento ? 0 : Number(kit.valor) });
      if (!kit.isento) hoje += Number(kit.valor);
    }
  }
  if (mipoa && oferta.mipoaItem) {
    linhas.push({
      label: `+MIPOA 2027 — ${oferta.mipoaItem.descricao} — ${distanciaMipoa} · ${dataProva("MIPOA", distanciaMipoa)}`,
      valor: Number(oferta.mipoaItem.valor),
    });
    hoje += Number(oferta.mipoaItem.valor);
  }
  if (avaliacao && oferta.aval) {
    linhas.push({ label: oferta.aval.descricao ?? "Avaliação Funcional", valor: Number(oferta.aval.valor) });
    hoje += Number(oferta.aval.valor);
  }

  return { linhas, hoje, recorrente };
}
