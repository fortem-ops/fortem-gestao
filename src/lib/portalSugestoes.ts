import type { Database } from "@/integrations/supabase/types";

export type SugestaoCategoria = "treinos" | "agenda" | "app" | "estrutura" | "atendimento" | "outro";
export type SugestaoStatus = "pendente" | "aprovada" | "recusada";
export type SugestaoRow = Database["public"]["Tables"]["portal_sugestoes"]["Row"];

export const SUGESTAO_CATEGORIAS: { value: SugestaoCategoria; label: string }[] = [
  { value: "treinos", label: "Treinos" },
  { value: "agenda", label: "Agenda" },
  { value: "app", label: "App" },
  { value: "estrutura", label: "Estrutura" },
  { value: "atendimento", label: "Atendimento" },
  { value: "outro", label: "Outro" },
];

export const SUGESTAO_STATUS_LABEL: Record<SugestaoStatus, string> = {
  pendente: "Em análise",
  aprovada: "Aprovada",
  recusada: "Recusada",
};

export function labelCategoriaSugestao(categoria: string): string {
  return SUGESTAO_CATEGORIAS.find((c) => c.value === categoria)?.label ?? categoria;
}

export function labelStatusSugestao(status: string): string {
  if (status === "pendente" || status === "aprovada" || status === "recusada") {
    return SUGESTAO_STATUS_LABEL[status];
  }
  return status;
}

export function podeGerenciarSugestoes(roles: readonly string[]): boolean {
  return roles.includes("admin") || roles.includes("coordenador");
}

export function validarNovaSugestao(input: {
  categoria: string;
  titulo: string;
  descricao: string;
}): string | null {
  const categoriasValidas = SUGESTAO_CATEGORIAS.map((c) => c.value) as readonly string[];
  if (!categoriasValidas.includes(input.categoria)) {
    return "Selecione uma categoria válida.";
  }
  const titulo = input.titulo.trim();
  if (titulo.length < 3) {
    return "Informe um título com pelo menos 3 caracteres.";
  }
  if (titulo.length > 120) {
    return "O título pode ter no máximo 120 caracteres.";
  }
  const descricao = input.descricao.trim();
  if (descricao.length < 10) {
    return "Descreva sua sugestão com pelo menos 10 caracteres.";
  }
  if (descricao.length > 2000) {
    return "A descrição pode ter no máximo 2000 caracteres.";
  }
  return null;
}

export function validarRespostaSugestao(input: {
  status: string;
  resposta: string;
}): string | null {
  if (input.status !== "aprovada" && input.status !== "recusada") {
    return "Escolha Aprovada ou Recusada.";
  }
  if (input.status === "recusada" && input.resposta.trim().length === 0) {
    return "Informe uma resposta ao recusar a sugestão.";
  }
  if (input.resposta.trim().length > 2000) {
    return "A resposta pode ter no máximo 2000 caracteres.";
  }
  return null;
}