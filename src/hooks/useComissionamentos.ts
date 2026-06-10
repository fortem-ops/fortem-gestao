import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Comissionamento, ComissaoPendencia, ComissaoConfig, ComissaoStatus } from "@/lib/comissionamentos";
import { isAutoRenewPlan } from "@/lib/planTipo";
import { addMonths } from "date-fns";
import { toast } from "sonner";

export function useIsCoordAdmin(userId: string | undefined) {
  return useQuery({
    queryKey: ["is-coord-admin", userId],
    queryFn: async () => {
      if (!userId) return false;
      const { data } = await supabase.rpc("is_coordinator_or_admin", { _user_id: userId });
      return !!data;
    },
    enabled: !!userId,
    staleTime: 5 * 60_000,
  });
}

export function useIsAdmin(userId: string | undefined) {
  return useQuery({
    queryKey: ["is-admin", userId],
    queryFn: async () => {
      if (!userId) return false;
      const { data } = await supabase.rpc("is_admin", { _user_id: userId });
      return !!data;
    },
    enabled: !!userId,
    staleTime: 5 * 60_000,
  });
}

export function useComissionamentos(filtros?: { profissionalId?: string | null; status?: ComissaoStatus[]; mesInicio?: string; mesFim?: string }) {
  return useQuery({
    queryKey: ["comissionamentos", filtros],
    queryFn: async () => {
      let q = supabase.from("comissionamentos" as any).select("*").order("data_referencia", { ascending: false });
      if (filtros?.profissionalId) q = q.eq("profissional_id", filtros.profissionalId);
      if (filtros?.status?.length) q = q.in("status", filtros.status);
      if (filtros?.mesInicio) q = q.gte("data_referencia", filtros.mesInicio);
      if (filtros?.mesFim) q = q.lte("data_referencia", filtros.mesFim);
      const { data, error } = await q;
      if (error) throw error;
      return (data || []) as unknown as Comissionamento[];
    },
    staleTime: 60_000,
  });
}

export function useComissaoPendencias(profissionalId?: string | null) {
  return useQuery({
    queryKey: ["comissao-pendencias", profissionalId],
    queryFn: async () => {
      let q = supabase.from("comissionamento_pendencias" as any).select("*").eq("concluido", false).order("created_at", { ascending: false });
      if (profissionalId) q = q.eq("profissional_id", profissionalId);
      const { data, error } = await q;
      if (error) throw error;
      return (data || []) as unknown as ComissaoPendencia[];
    },
    staleTime: 30_000,
  });
}

export function useComissaoConfig() {
  return useQuery({
    queryKey: ["comissao-config"],
    queryFn: async () => {
      const { data, error } = await supabase.from("comissionamento_config" as any).select("*").order("tipo");
      if (error) throw error;
      return (data || []) as unknown as ComissaoConfig[];
    },
    staleTime: 5 * 60_000,
  });
}

export function useCarteiraStats(profissionalId?: string | null) {
  return useQuery({
    queryKey: ["carteira-stats", profissionalId],
    queryFn: async () => {
      const { data: ativos, error } = await supabase
        .from("alunos")
        .select("id, responsavel_id, status")
        .eq("status", "ativo");
      if (error) throw error;
      const ids = (ativos || []).map((a: any) => a.id);
      if (!ids.length) return { total: 0, meus: 0 };

      const hoje = new Date().toISOString().slice(0, 10);
      const hojeDate = new Date(new Date().toDateString());
      const [{ data: planos }, { data: licencas }] = await Promise.all([
        supabase
          .from("planos")
          .select("aluno_id, tipo, ativo, data_inicio, data_fim, duracao_meses")
          .in("aluno_id", ids)
          .eq("ativo", true),
        supabase.from("aluno_licencas").select("aluno_id, data_inicio, data_fim").in("aluno_id", ids).lte("data_inicio", hoje).gte("data_fim", hoje),
      ]);

      const planosByAluno = new Map<string, any[]>();
      (planos || []).forEach((p: any) => {
        const arr = planosByAluno.get(p.aluno_id) || [];
        arr.push(p);
        planosByAluno.set(p.aluno_id, arr);
      });
      const licencaSet = new Set((licencas || []).map((l: any) => l.aluno_id));

      const PLANOS_QUALIFICADOS = ["Start", "Start+", "Power", "Pro"];
      const isVigente = (p: any): boolean => {
        if (isAutoRenewPlan(p.tipo)) return true;
        const planEnd = p.data_fim
          ? new Date(p.data_fim + "T00:00:00")
          : p.data_inicio
            ? addMonths(new Date(p.data_inicio + "T00:00:00"), p.duracao_meses ?? 0)
            : null;
        return !!planEnd && planEnd >= hojeDate;
      };
      const valid = (ativos || []).filter((a: any) => {
        const ps = planosByAluno.get(a.id) || [];
        const planoOk = ps.some((p: any) => PLANOS_QUALIFICADOS.includes(p.tipo) && isVigente(p));
        return planoOk && !licencaSet.has(a.id);
      });

      const total = valid.length;
      const meus = profissionalId ? valid.filter((a: any) => a.responsavel_id === profissionalId).length : total;
      return { total, meus };
    },
    staleTime: 60_000,
  });
}

export function useConcluirPendencia() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("comissionamento_pendencias" as any).update({ concluido: true, concluido_em: new Date().toISOString() }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Pendência concluída");
      qc.invalidateQueries({ queryKey: ["comissao-pendencias"] });
      qc.invalidateQueries({ queryKey: ["comissionamentos"] });
    },
    onError: (e: any) => toast.error(e.message),
  });
}

export function useUpdateComissaoStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status, data_pagamento }: { id: string; status: ComissaoStatus; data_pagamento?: string | null }) => {
      const update: any = { status };
      if (status === "pago") update.data_pagamento = data_pagamento || new Date().toISOString().slice(0, 10);
      const { error } = await supabase.from("comissionamentos" as any).update(update).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Comissão atualizada");
      qc.invalidateQueries({ queryKey: ["comissionamentos"] });
    },
    onError: (e: any) => toast.error(e.message),
  });
}

export function useUpdateConfig() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, valor, meta_minima, ativo }: { id: string; valor?: number; meta_minima?: number; ativo?: boolean }) => {
      const u: any = {};
      if (valor !== undefined) u.valor = valor;
      if (meta_minima !== undefined) u.meta_minima = meta_minima;
      if (ativo !== undefined) u.ativo = ativo;
      const { error } = await supabase.from("comissionamento_config" as any).update(u).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Configuração salva");
      qc.invalidateQueries({ queryKey: ["comissao-config"] });
    },
    onError: (e: any) => toast.error(e.message),
  });
}
