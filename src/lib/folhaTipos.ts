import { addMonths, format } from "date-fns";
import { ptBR } from "date-fns/locale";

/** Tipo do pagamento lançado pela tela "Lançar Folha". */
export type TipoFolha = "salario" | "13_1" | "13_2" | "ferias";

export const TIPOS_FOLHA: { valor: TipoFolha; rotulo: string }[] = [
  { valor: "salario", rotulo: "Salário" },
  { valor: "13_1", rotulo: "13º – 1ª parcela" },
  { valor: "13_2", rotulo: "13º – 2ª parcela" },
  { valor: "ferias", rotulo: "Férias" },
];

const PREFIXO: Record<TipoFolha, string> = {
  salario: "Salário",
  "13_1": "13º 1ª parcela",
  "13_2": "13º 2ª parcela",
  ferias: "Férias",
};

export const eh13 = (t: TipoFolha) => t === "13_1" || t === "13_2";

/** Rótulo da competência: 13º é por ano; os demais, por mês. */
export function rotuloCompetencia(tipo: TipoFolha, comp: Date): string {
  if (eh13(tipo)) return format(comp, "yyyy");
  return `${format(comp, "MMM", { locale: ptBR }).replace(".", "")}/${format(comp, "yyyy")}`;
}

export function descricaoFolha(tipo: TipoFolha, nome: string, comp: Date, comFerias = false): string {
  const base = tipo === "salario" && comFerias ? "Salário + Férias" : PREFIXO[tipo];
  return `${base} ${nome} (${rotuloCompetencia(tipo, comp)})`;
}

/** Padrão ilike para achar um lançamento já feito do MESMO tipo e competência. Tipos não se bloqueiam entre si. */
export function padraoTrava(tipo: TipoFolha, comp: Date): string {
  return `${PREFIXO[tipo]}%(${rotuloCompetencia(tipo, comp)})%`;
}

/** Vencimento sugerido quando o usuário não escolhe data. */
export function dataPadrao(tipo: TipoFolha, comp: Date): string {
  if (tipo === "13_1") return format(comp, "yyyy-11-30");
  if (tipo === "13_2") return format(comp, "yyyy-12-20");
  return format(addMonths(comp, 1), "yyyy-MM-05");
}

/** Data futura nasce pendente (fila Pix); hoje ou passado nasce paga. */
export const nascePendente = (data: string, hoje: string) => data > hoje;

/** Tipo detectado no holerite diverge do escolhido? (sem detecção, não avisa) */
export function divergeTipo(escolhido: TipoFolha, detectado?: "salario" | "13" | "ferias" | null): boolean {
  if (!detectado) return false;
  if (eh13(escolhido)) return detectado !== "13";
  if (escolhido === "ferias") return detectado !== "ferias";
  return detectado === "13";
}
