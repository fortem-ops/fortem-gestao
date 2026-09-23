import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface SaldoEstornavel {
  cobranca_id: string;
  tid: string | null;
  valor_pago: number;
  total_estornado: number;
  saldo_estornavel: number;
}

export interface EstornoRegistro {
  id: string;
  cobranca_id: string | null;
  tid: string | null;
  nsu: string | null;
  authorization_code: string | null;
  return_code: string | null;
  return_message: string | null;
  /** Valor do estorno em reais. */
  valor: number;
  created_at: string;
  created_by: string | null;
  motivo?: string | null;
  executado_por_nome?: string | null;
}

/** Saldo estornável calculado no servidor (nunca no cliente). */
export function useSaldoEstornavel(cobrancaId?: string | null, enabled = true) {
  return useQuery({
    queryKey: ["estorno-saldo", cobrancaId],
    enabled: !!cobrancaId && enabled,
    queryFn: async (): Promise<SaldoEstornavel | null> => {
      const { data, error } = await supabase.rpc("fn_cobranca_saldo_estornavel", {
        _cobranca_id: cobrancaId!,
      });
      if (error) throw error;
      const row = Array.isArray(data) ? data[0] : data;
      if (!row) return null;
      return {
        cobranca_id: row.cobranca_id,
        tid: row.tid,
        valor_pago: Number(row.valor_pago ?? 0),
        total_estornado: Number(row.total_estornado ?? 0),
        saldo_estornavel: Number(row.saldo_estornavel ?? 0),
      };
    },
  });
}

/** Estornos já confirmados de um contrato inteiro (para selo e comprovante). */
export function useEstornosDoContrato(cobrancaIds: string[]) {
  const ids = [...cobrancaIds].sort();
  return useQuery({
    queryKey: ["estornos-contrato", ids],
    enabled: ids.length > 0,
    queryFn: async (): Promise<Record<string, EstornoRegistro[]>> => {
      const { data, error } = await supabase
        .from("pagamentos_rede")
        .select("id, cobranca_id, tid, nsu, authorization_code, return_code, return_message, amount, created_at, created_by, motivo_estorno")
        .in("cobranca_id", ids)
        .eq("kind", "refund")
        .eq("status", "refunded")
        .order("created_at", { ascending: true });
      if (error) throw error;

      // O motivo vem do próprio registro do estorno (audit_log é só trilha extra),
      // para o comprovante reaberto não depender do acesso à auditoria.
      const registros = (data ?? []).map((r) => ({
        id: r.id,
        cobranca_id: r.cobranca_id,
        tid: r.tid,
        nsu: r.nsu,
        authorization_code: r.authorization_code,
        return_code: r.return_code,
        return_message: r.return_message,
        valor: Number(r.amount ?? 0) / 100,
        created_at: r.created_at,
        created_by: r.created_by,
        motivo: r.motivo_estorno ?? null,
      })) as EstornoRegistro[];

      // Nome de quem executou o estorno.
      const autores = Array.from(new Set(registros.map((r) => r.created_by).filter(Boolean))) as string[];
      if (autores.length) {
        const { data: perfis } = await supabase
          .from("profiles")
          .select("user_id, full_name")
          .in("user_id", autores);
        const nomes = new Map((perfis ?? []).map((p) => [p.user_id, p.full_name]));
        registros.forEach((r) => {
          r.executado_por_nome = (r.created_by && nomes.get(r.created_by)) || "Administrador";
        });
      }

      const porCobranca: Record<string, EstornoRegistro[]> = {};
      registros.forEach((r) => {
        if (!r.cobranca_id) return;
        (porCobranca[r.cobranca_id] ??= []).push(r);
      });
      return porCobranca;
    },
  });
}

/** Nome do usuário logado (usado no comprovante gerado logo após o estorno). */
export function useMeuNome() {
  return useQuery({
    queryKey: ["meu-nome-perfil"],
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<string | null> => {
      const { data: auth } = await supabase.auth.getUser();
      const uid = auth?.user?.id;
      if (!uid) return null;
      const { data } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("user_id", uid)
        .maybeSingle();
      return data?.full_name ?? null;
    },
  });
}



export interface ComprovanteEstorno {
  pagamento_id: string;
  cobranca_id: string;
  aluno_id?: string | null;
  numero_ciclo?: number | null;
  valor_estornado: number;
  valor_original: number;
  total_estornado: number;
  saldo_restante: number;
  integral: boolean;
  cobranca_status: string;
  tid: string | null;
  nsu: string | null;
  authorization_code: string | null;
  return_code: string | null;
  return_message: string | null;
  motivo: string;
  executado_em: string;
  executado_por?: string | null;
}

export function useEstornarCobranca() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      cobrancaId: string;
      tipo: "total" | "parcial";
      valor?: number;
      motivo: string;
      idempotencyKey: string;
    }): Promise<ComprovanteEstorno> => {
      const { data, error } = await supabase.functions.invoke("estornar-cobranca", {
        body: {
          cobranca_id: input.cobrancaId,
          tipo: input.tipo,
          valor: input.valor,
          motivo: input.motivo,
          idempotency_key: input.idempotencyKey,
        },
      });

      // Erros da função chegam com corpo JSON no contexto da resposta.
      if (error) {
        let msg = error.message;
        try {
          const ctx = (error as unknown as { context?: Response }).context;
          if (ctx && typeof ctx.json === "function") {
            const body = await ctx.json();
            if (body?.error) msg = body.error;
          }
        } catch { /* mantém a mensagem original */ }
        throw new Error(msg);
      }
      if (!data?.success) throw new Error(data?.error ?? "Não foi possível estornar a cobrança");
      return data.comprovante as ComprovanteEstorno;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["cobrancas"] });
      qc.invalidateQueries({ queryKey: ["contratos"] });
      qc.invalidateQueries({ queryKey: ["estorno-saldo"] });
      qc.invalidateQueries({ queryKey: ["estornos-contrato"] });
      qc.invalidateQueries({ queryKey: ["vendas"] });
    },
    onError: (e: unknown) => {
      toast.error(e instanceof Error ? e.message : "Falha ao estornar a cobrança");
    },
  });
}
