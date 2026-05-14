import { toast } from "@/hooks/use-toast";
import { classifyError } from "./errors";
import { logger } from "./logger";

/**
 * Helpers padronizados para toasts. Classificam o erro automaticamente
 * (rede, RLS, validação, conflito, etc.) e mostram mensagem amigável em PT-BR.
 */

export function toastSuccess(title: string, description?: string) {
  toast({ title, description });
}

export function toastError(err: unknown, fallbackTitle?: string) {
  const c = classifyError(err);
  logger.error(err, { category: c.category });
  toast({
    title: fallbackTitle && c.category === "unknown" ? fallbackTitle : c.title,
    description: c.description,
    variant: "destructive",
  });
}

/** Mantido por compatibilidade — prefira `classifyError(err).category === "network"`. */
export function isNetworkError(err: unknown): boolean {
  return classifyError(err).category === "network";
}
