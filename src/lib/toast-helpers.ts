import { toast } from "sonner";
import { classifyError } from "./errors";
import { logger } from "./logger";

/**
 * Helpers padronizados para toasts. Classificam o erro automaticamente
 * (rede, RLS, validação, conflito, etc.) e mostram mensagem amigável em PT-BR.
 */

export function toastSuccess(title: string, description?: string) {
  toast.success(title, { description: description });
}

export function toastError(err: unknown, fallbackTitle?: string) {
  const c = classifyError(err);
  logger.error(err, { category: c.category });
  toast.error(fallbackTitle && c.category === "unknown" ? fallbackTitle : c.title, { description: c.description });
}

/** Mantido por compatibilidade — prefira `classifyError(err).category === "network"`. */
export function isNetworkError(err: unknown): boolean {
  return classifyError(err).category === "network";
}
