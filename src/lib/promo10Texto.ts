import type { FrequenciaPromo10, ResultadoCicloPromo10, SegmentoPromo10 } from "./promo10";

export const PROMO10_WHATSAPP_NUMERO = "555135199451";

/** Nome de exibição da oferta Corrida para o aluno: sempre "Corrida", sem o nome do catálogo. */
export const ROTULO_CORRIDA_PROMO10 = "Corrida";

export interface OfertaUpgradePromo10 {
  tipo: "upgrade";
  plano_atual: string;
  frequencia_atual: FrequenciaPromo10;
  frequencia_destino: FrequenciaPromo10;
  degraus: number;
  data_inicio_ciclo: string;
  data_fim_plano: string;
  valor_promocional: number;
  valor_sem_desconto: number;
  economia: number;
  calculo_promocional: ResultadoCicloPromo10;
  calculo_sem_desconto: ResultadoCicloPromo10;
}

export interface OfertaAgregadoraPromo10 {
  tipo: "semestral_agregadora";
  codigo: string;
  nome: string;
  agregadora: "wellhub" | "totalpass";
  frequencia: FrequenciaPromo10;
  valor_mensal: number;
  valor_promocional: number;
  valor_referencia_mes: number | null;
  valor_sem_desconto: number | null;
  economia_mes: number | null;
  economia_6_meses: number | null;
}

export interface OfertaExAlunoPromo10 {
  tipo: "ex_aluno";
  codigo: string;
  nome: string;
  familia: "power_2027" | "pro_2027";
  frequencia: FrequenciaPromo10;
  modalidade_cobranca: "anual" | "recorrencia_mensal";
  valor_sem_desconto: number;
  valor_promocional: number;
  parcela_12x: number;
  economia: number;
}

export type OfertaPrincipalPromo10 =
  | OfertaUpgradePromo10
  | OfertaAgregadoraPromo10
  | OfertaExAlunoPromo10;

export interface OfertaCorridaPromo10 {
  tipo: "corrida_6_mais_1";
  nome_catalogo: string;
  meses_pagos: number;
  meses_total: number;
  valor_promocional: number;
  valor_equivalente_mes: number;
  valor_sem_desconto: number;
  economia: number;
}

export interface RespostaOfertasPromo10 {
  encerrada: boolean;
  segmento: SegmentoPromo10 | null;
  principal: OfertaPrincipalPromo10[];
  corrida: OfertaCorridaPromo10 | null;
}

export interface InteressePromo10 {
  codigo_pedido: string;
  segmento: string;
  oferta: string;
  valor_promocional: number;
  valor_sem_desconto: number | null;
  detalhes: Record<string, unknown>;
  status: string;
}

export function formatarMoedaBr(valor: number): string {
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function formatarDataBr(iso: string | null | undefined): string {
  if (!iso || !/^\d{4}-\d{2}-\d{2}/.test(iso)) return "";
  const [y, m, d] = iso.slice(0, 10).split("-");
  return `${d}/${m}/${y}`;
}

export function diaDoCiclo(iso: string | null | undefined): string {
  if (!iso || !/^\d{4}-\d{2}-\d{2}/.test(iso)) return "";
  return String(Number(iso.slice(8, 10)));
}

export function rotuloFrequencia(freq: string): string {
  if (freq === "livre") return "Livre";
  return `${freq}/sem`;
}

export function mascararCpfInput(valor: string): string {
  const d = valor.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 3) return d;
  if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`;
  if (d.length <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`;
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
}

export function textoQuebraUpgrade(calc: ResultadoCicloPromo10): string[] {
  const linhas: string[] = [];
  if (calc.proporcional > 0 && calc.dias_ciclo_atual > 0) {
    linhas.push(
      `Ciclo atual proporcional (${calc.dias_restantes_ciclo_atual} de ${calc.dias_ciclo_atual} dias): ${formatarMoedaBr(calc.proporcional)}`,
    );
  }
  if (calc.ciclos_completos > 0) {
    const plural = calc.ciclos_completos === 1 ? "ciclo completo" : "ciclos completos";
    linhas.push(`${calc.ciclos_completos} ${plural}: ${formatarMoedaBr(calc.valor_completos)}`);
  }
  if (calc.ultimo_proporcional > 0) {
    linhas.push(`Último período proporcional: ${formatarMoedaBr(calc.ultimo_proporcional)}`);
  }
  return linhas;
}

export function descreverInteresse(item: InteressePromo10): { titulo: string; detalhe: string } {
  const d = item.detalhes ?? {};
  const tipo = String(d.tipo ?? "");

  if (tipo === "upgrade") {
    const freqAtual = rotuloFrequencia(String(d.frequencia_atual ?? ""));
    const freqDest = rotuloFrequencia(String(d.frequencia_destino ?? ""));
    const calc = d.calculo_promocional as ResultadoCicloPromo10 | undefined;
    const ciclos = calc?.ciclos_completos ?? 0;
    const prop = calc && calc.proporcional > 0 ? `${calc.dias_restantes_ciclo_atual}/${calc.dias_ciclo_atual} dias + ` : "";
    return {
      titulo: `Upgrade ${String(d.plano_atual ?? "")} (${freqAtual} para ${freqDest})`,
      detalhe: `${prop}${ciclos} ${ciclos === 1 ? "ciclo" : "ciclos"} · ${formatarMoedaBr(item.valor_promocional)}`,
    };
  }

  if (tipo === "semestral_agregadora") {
    const mensal = Number(d.valor_mensal ?? 0);
    return {
      titulo: String(d.nome ?? item.oferta),
      detalhe: `6 meses · ${formatarMoedaBr(mensal)}/mês (${formatarMoedaBr(item.valor_promocional)} no período)`,
    };
  }

  if (tipo === "ex_aluno") {
    const freq = rotuloFrequencia(String(d.frequencia ?? ""));
    const parc = Number(d.parcela_12x ?? item.valor_promocional / 12);
    return {
      titulo: `${String(d.nome ?? item.oferta)} (${freq})`,
      detalhe: `12x de ${formatarMoedaBr(parc)} · total ${formatarMoedaBr(item.valor_promocional)}`,
    };
  }

  if (tipo === "corrida_6_mais_1" || item.oferta === "corrida_6_mais_1") {
    const eq = Number(d.valor_equivalente_mes ?? item.valor_promocional / 7);
    return {
      titulo: `${ROTULO_CORRIDA_PROMO10} (6 meses + 1 grátis)`,
      detalhe: `7 meses · ${formatarMoedaBr(item.valor_promocional)} (${formatarMoedaBr(eq)}/mês)`,
    };
  }

  return {
    titulo: item.oferta,
    detalhe: formatarMoedaBr(item.valor_promocional),
  };
}

export function montarMensagemWhatsAppPromo10(primeiroNome: string, interesses: InteressePromo10[]): string {
  const linhas = [
    `Olá, equipe FORTEM. Sou ${primeiroNome} e tenho interesse nas condições de aniversário 10 anos:`,
  ];
  for (const item of interesses) {
    const { titulo, detalhe } = descreverInteresse(item);
    linhas.push(`- ${titulo} — ${detalhe} (Pedido ${item.codigo_pedido})`);
  }
  return linhas.join("\n");
}

export function linkWhatsAppPromo10(mensagem?: string): string {
  if (!mensagem) return `https://wa.me/${PROMO10_WHATSAPP_NUMERO}`;
  return `https://wa.me/${PROMO10_WHATSAPP_NUMERO}?text=${encodeURIComponent(mensagem)}`;
}