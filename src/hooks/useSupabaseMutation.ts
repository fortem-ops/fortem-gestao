import { useMutation, useQueryClient, type UseMutationOptions } from "@tanstack/react-query";
import { toastError, toastSuccess } from "@/lib/toast-helpers";

type InvalidateKey = readonly unknown[];

interface ExtraOptions {
  /** Toast de sucesso (título). Se omitido, nada é mostrado. */
  successMessage?: string;
  /** Título alternativo do toast de erro quando a categoria for "unknown". */
  errorTitle?: string;
  /** Lista de query keys a invalidar após sucesso. */
  invalidates?: InvalidateKey[];
  /** Suprime o toast de erro automático (use quando quiser tratar manualmente). */
  silent?: boolean;
}

/**
 * Wrapper sobre `useMutation` que padroniza:
 * - tratamento e exibição de erros (via classifyError + toastError)
 * - invalidação declarativa de cache via `invalidates`
 * - toast opcional de sucesso
 *
 * Mantém toda a API do react-query (onSuccess, onError continuam funcionando).
 */
export function useSupabaseMutation<TData, TVariables, TContext = unknown>(
  options: UseMutationOptions<TData, unknown, TVariables, TContext> & ExtraOptions,
) {
  const qc = useQueryClient();
  const { successMessage, errorTitle, invalidates, silent, onSuccess, onError, ...rest } = options;

  return useMutation<TData, unknown, TVariables, TContext>({
    ...rest,
    onSuccess: (data, vars, ctx) => {
      if (invalidates?.length) {
        for (const key of invalidates) {
          qc.invalidateQueries({ queryKey: key as unknown[] });
        }
      }
      if (successMessage) toastSuccess(successMessage);
      onSuccess?.(data, vars, ctx);
    },
    onError: (err, vars, ctx) => {
      if (!silent) toastError(err, errorTitle);
      onError?.(err, vars, ctx);
    },
  });
}
