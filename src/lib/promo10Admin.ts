import { formatarMoedaBr } from "./promo10Texto";

export type StatusInteressePromo10 = "novo" | "contatado" | "fechado" | "desistiu";
export type SegmentoFiltroPromo10 = "upgrade" | "wellhub" | "totalpass" | "ex_aluno" | "corrida";

export const STATUS_PROMO10_LISTA: { valor: StatusInteressePromo10; label: string }[] = [
  { valor: "novo", label: "Novo" },
  { valor: "contatado", label: "Contatado" },
  { valor: "fechado", label: "Fechado" },
  { valor: "desistiu", label: "Desistiu" },
];

export const SEGMENTOS_PROMO10_LISTA: { valor: SegmentoFiltroPromo10; label: string }[] = [
  { valor: "upgrade", label: "Upgrade" },
  { valor: "wellhub", label: "Wellhub" },
  { valor: "totalpass", label: "TotalPass" },
  { valor: "ex_aluno", label: "Ex-aluno" },
  { valor: "corrida", label: "Corrida" },
];

export interface InteressePromo10Admin {
  id: string;
  aluno_id: string;
  aluno_nome: string;
  aluno_telefone: string | null;
  segmento: string;
  oferta: string;
  detalhes: Record<string, unknown>;
  valor_promocional: number;
  valor_sem_desconto: number | null;
  codigo_pedido: string;
  status: StatusInteressePromo10;
  observacao: string | null;
  created_at: string;
  atualizado_por: string | null;
  atualizado_por_nome: string | null;
  atualizado_em: string | null;
}

export function primeiroNomePromo10(nome: string | null | undefined): string {
  const limpo = (nome ?? "").trim();
  if (!limpo) return "Aluno";
  return limpo.split(/\s+/)[0] ?? "Aluno";
}

export function segmentoEfetivoPromo10(
  segmento: string,
  oferta: string,
  detalhes?: Record<string, unknown>,
): SegmentoFiltroPromo10 {
  const tipo = String(detalhes?.tipo ?? "");
  if (oferta === "corrida_6_mais_1" || tipo === "corrida_6_mais_1") return "corrida";
  if (segmento === "wellhub") return "wellhub";
  if (segmento === "totalpass") return "totalpass";
  if (segmento === "ex_aluno") return "ex_aluno";
  return "upgrade";
}

export function rotuloSegmentoPromo10(seg: SegmentoFiltroPromo10): string {
  const achado = SEGMENTOS_PROMO10_LISTA.find((s) => s.valor === seg);
  return achado ? achado.label : seg;
}

function freqCurta(freq: string): string {
  if (freq === "livre") return "Livre";
  return freq;
}

function tabelaCorridaCurta(nomeCatalogo: string): string {
  const limpo = nomeCatalogo.replace(/^Corrida\s*[-–]\s*/i, "").trim();
  return limpo || nomeCatalogo.trim();
}

/** Texto legível da oferta para a equipe (inclui a tabela da Corrida). */
export function rotuloOfertaEquipePromo10(item: {
  segmento: string;
  oferta: string;
  detalhes?: Record<string, unknown>;
}): string {
  const d = item.detalhes ?? {};
  const tipo = String(d.tipo ?? "");

  if (tipo === "upgrade" || item.oferta.startsWith("upgrade_")) {
    const atual = freqCurta(String(d.frequencia_atual ?? ""));
    const dest = freqCurta(String(d.frequencia_destino ?? item.oferta.replace("upgrade_", "")));
    return atual ? `Upgrade ${atual} → ${dest}` : `Upgrade → ${dest}`;
  }

  if (tipo === "semestral_agregadora") {
    const nome = String(d.nome ?? item.oferta).replace(/\s*-\s*(Wellhub|TotalPass)$/i, "").trim();
    const agr = String(d.agregadora ?? item.segmento) === "totalpass" ? "TotalPass" : "Wellhub";
    const freqRaw = String(d.frequencia ?? "").trim()
      || (/_(2x|3x)$/i.exec(item.oferta)?.[1]?.toLowerCase() ?? "");
    return freqRaw ? `${nome} ${agr} ${freqCurta(freqRaw)}` : `${nome} ${agr}`;
  }

  if (tipo === "ex_aluno") {
    const fam = String(d.familia ?? "") === "pro_2027" ? "Pro" : "Power";
    const freq = freqCurta(String(d.frequencia ?? ""));
    return `${fam} ${freq} anual (ex-aluno)`;
  }

  if (tipo === "corrida_6_mais_1" || item.oferta === "corrida_6_mais_1") {
    const cat = String(d.nome_catalogo ?? "").trim();
    if (!cat) return "Corrida 6+1";
    return `Corrida 6+1 · tabela ${tabelaCorridaCurta(cat)}`;
  }

  return item.oferta;
}

export interface ResumoBlocoPromo10 {
  quantidade: number;
  valor: number;
}

export interface ResumoPromo10 {
  totalQuantidade: number;
  totalValor: number;
  porStatus: Record<StatusInteressePromo10, ResumoBlocoPromo10>;
  porSegmento: Record<SegmentoFiltroPromo10, ResumoBlocoPromo10>;
}

export function calcularResumoPromo10(
  itens: Pick<InteressePromo10Admin, "status" | "segmento" | "oferta" | "detalhes" | "valor_promocional">[],
): ResumoPromo10 {
  const porStatus: Record<StatusInteressePromo10, ResumoBlocoPromo10> = {
    novo: { quantidade: 0, valor: 0 },
    contatado: { quantidade: 0, valor: 0 },
    fechado: { quantidade: 0, valor: 0 },
    desistiu: { quantidade: 0, valor: 0 },
  };
  const porSegmento: Record<SegmentoFiltroPromo10, ResumoBlocoPromo10> = {
    upgrade: { quantidade: 0, valor: 0 },
    wellhub: { quantidade: 0, valor: 0 },
    totalpass: { quantidade: 0, valor: 0 },
    ex_aluno: { quantidade: 0, valor: 0 },
    corrida: { quantidade: 0, valor: 0 },
  };

  let totalValor = 0;
  for (const item of itens) {
    const v = Number(item.valor_promocional) || 0;
    totalValor = Math.round((totalValor + v) * 100) / 100;
    const st = porStatus[item.status];
    if (st) {
      st.quantidade += 1;
      st.valor = Math.round((st.valor + v) * 100) / 100;
    }
    const seg = segmentoEfetivoPromo10(item.segmento, item.oferta, item.detalhes);
    porSegmento[seg].quantidade += 1;
    porSegmento[seg].valor = Math.round((porSegmento[seg].valor + v) * 100) / 100;
  }

  return {
    totalQuantidade: itens.length,
    totalValor,
    porStatus,
    porSegmento,
  };
}

/** Só dispara aviso interno quando o interesse é novo ou substituiu a oferta principal. */
export function deveAvisarInteressePromo10(acao: string | undefined): boolean {
  return acao === "criado" || acao === "substituido";
}

/** Título curto do aviso interno (sem CPF nem e-mail, apenas primeiro nome). */
export function montarTituloAvisoPromo10(params: {
  codigoPedido: string;
  nomeAluno: string | null | undefined;
  ofertaLegivel: string;
  valorPromocional: number;
}): string {
  const primeiro = primeiroNomePromo10(params.nomeAluno);
  return `Promoções 10 anos: novo interesse ${params.codigoPedido} — ${primeiro} — ${params.ofertaLegivel} — ${formatarMoedaBr(params.valorPromocional)}`;
}

export function montarMensagemWhatsAppEquipePromo10(params: {
  nomeAluno: string | null | undefined;
  codigoPedido: string;
  ofertaLegivel: string;
}): string {
  const primeiro = primeiroNomePromo10(params.nomeAluno);
  return `Olá, ${primeiro}! Aqui é da equipe FORTEM. Recebemos seu interesse nas Promoções 10 anos (${params.ofertaLegivel}, pedido ${params.codigoPedido}). Podemos seguir com o fechamento?`;
}

export function linkWhatsAppAlunoPromo10(telefone: string | null | undefined, mensagem: string): string | null {
  const digitos = (telefone ?? "").replace(/\D/g, "");
  if (digitos.length < 10) return null;
  const comDdi = digitos.startsWith("55") ? digitos : `55${digitos}`;
  return `https://wa.me/${comDdi}?text=${encodeURIComponent(mensagem)}`;
}