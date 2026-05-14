/**
 * Classificação central de erros Supabase/PostgREST + tradução PT-BR amigável.
 * Use junto com `toastError` para mensagens consistentes em todo o app.
 */

export type ErrorCategory =
  | "auth_required"
  | "permission_denied"
  | "validation"
  | "not_found"
  | "conflict"
  | "network"
  | "server"
  | "unknown";

export interface ClassifiedError {
  category: ErrorCategory;
  title: string;
  description: string;
  /** Mensagem técnica original (para logs). */
  raw: string;
}

const NETWORK_RE = /fetch|network|networkerror|load failed|timeout|aborted|econnrefused/i;

/** Códigos PostgreSQL/PostgREST relevantes. */
function categoryFromCode(code: string | undefined | null): ErrorCategory | null {
  if (!code) return null;
  // PostgREST/Supabase Auth
  if (code === "PGRST301" || code === "401") return "auth_required";
  if (code === "42501" || code === "PGRST116" || code === "403") return "permission_denied";
  if (code === "PGRST204" || code === "404") return "not_found";
  // Postgres
  if (code === "23505") return "conflict"; // unique_violation
  if (code === "23503") return "conflict"; // foreign_key_violation
  if (code === "23502") return "validation"; // not_null_violation
  if (code === "23514") return "validation"; // check_violation
  if (code === "22P02") return "validation"; // invalid_text_representation
  if (code.startsWith("5")) return "server";
  return null;
}

const COPY: Record<ErrorCategory, { title: string; description: string }> = {
  auth_required: {
    title: "Sessão expirada",
    description: "Faça login novamente para continuar.",
  },
  permission_denied: {
    title: "Acesso negado",
    description: "Você não tem permissão para executar esta ação.",
  },
  validation: {
    title: "Dados inválidos",
    description: "Verifique os campos preenchidos e tente novamente.",
  },
  not_found: {
    title: "Registro não encontrado",
    description: "O item que você tentou acessar não existe mais.",
  },
  conflict: {
    title: "Conflito de dados",
    description: "Já existe um registro com estes dados ou há vínculos impedindo a operação.",
  },
  network: {
    title: "Falha de conexão",
    description: "Não foi possível conectar ao servidor. Verifique sua conexão e tente novamente.",
  },
  server: {
    title: "Erro no servidor",
    description: "Algo deu errado no nosso lado. Tente novamente em instantes.",
  },
  unknown: {
    title: "Algo deu errado",
    description: "Tente novamente em instantes.",
  },
};

export function classifyError(err: unknown): ClassifiedError {
  const raw = err instanceof Error ? err.message : typeof err === "string" ? err : JSON.stringify(err ?? {});

  // Erros de rede
  if (NETWORK_RE.test(raw)) {
    return { category: "network", ...COPY.network, raw };
  }

  // PostgrestError-like
  const e = err as { code?: string; status?: number; message?: string; details?: string } | null;
  const code = e?.code ?? (e?.status ? String(e.status) : null);
  const cat = categoryFromCode(code);
  if (cat) {
    const copy = COPY[cat];
    return {
      category: cat,
      title: copy.title,
      description: e?.details || copy.description,
      raw,
    };
  }

  return { category: "unknown", ...COPY.unknown, raw };
}
