import { toast } from "@/hooks/use-toast";

/**
 * Helpers padronizados para toasts. Diferenciam erros de rede de erros de
 * regra de negócio para reduzir mensagens genéricas tipo "Failed to fetch".
 */

const NETWORK_PATTERN = /fetch|network|networkerror|load failed|timeout|aborted/i;

export function isNetworkError(err: unknown): boolean {
  if (!err) return false;
  const msg = err instanceof Error ? err.message : String(err);
  return NETWORK_PATTERN.test(msg);
}

export function toastSuccess(title: string, description?: string) {
  toast({ title, description });
}

export function toastError(err: unknown, fallbackTitle = "Algo deu errado") {
  const network = isNetworkError(err);
  const msg = err instanceof Error ? err.message : typeof err === "string" ? err : "";
  toast({
    title: network ? "Falha de conexão" : fallbackTitle,
    description: network
      ? "Não foi possível conectar ao servidor. Verifique sua conexão, desative extensões ou tente em uma janela anônima."
      : msg || "Tente novamente em instantes.",
    variant: "destructive",
  });
}
