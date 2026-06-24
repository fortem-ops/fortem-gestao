import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export interface NotificacaoListItem {
  id: string;
  titulo: string;
  descricao: string;
  categoria: string;
  prioridade: string;
  tipo: string;
  status: string;
  criado_por: string;
  prazo: string | null;
  aluno_id: string | null;
  reuniao_data: string | null;
  reuniao_local: string | null;
  created_at: string;
  // joined
  visualizado_em?: string | null;
  dest_status?: string;
  criador_nome?: string;
}

export function useNotificacoesRecebidas() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["notif", "recebidas", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from("notificacao_destinatarios")
        .select("visualizado_em,status,notificacoes(*)")
        .eq("usuario_id", user.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      const rows = (data ?? [])
        .filter((r: any) => r.notificacoes)
        .map((r: any) => ({
          ...(r.notificacoes as any),
          visualizado_em: r.visualizado_em,
          dest_status: r.status,
        })) as NotificacaoListItem[];
      return rows;
    },
    enabled: !!user,
  });
}

export function useNotificacoesEnviadas() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["notif", "enviadas", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from("notificacoes")
        .select("*")
        .eq("criado_por", user.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as NotificacaoListItem[];
    },
    enabled: !!user,
  });
}

export function useUnreadCount() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["notif", "unread", user?.id],
    queryFn: async () => {
      if (!user) return 0;
      const { count } = await supabase
        .from("notificacao_destinatarios")
        .select("id", { count: "exact", head: true })
        .eq("usuario_id", user.id)
        .is("visualizado_em", null)
        .neq("status", "arquivada");
      return count ?? 0;
    },
    enabled: !!user,
    staleTime: 30_000,
  });
}

export function useNotificacaoRealtime() {
  const { user } = useAuth();
  const qc = useQueryClient();

  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel(`notif-user-${user.id}-${Math.random().toString(36).slice(2)}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notificacao_destinatarios", filter: `usuario_id=eq.${user.id}` },
        async (payload: any) => {
          qc.invalidateQueries({ queryKey: ["notif"] });
          const { data } = await supabase
            .from("notificacoes")
            .select("titulo,prioridade")
            .eq("id", payload.new.notificacao_id)
            .maybeSingle();
          if (data) {
            toast(data.titulo, {
              description: `Nova notificação ${data.prioridade}`,
            });
          }
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "notificacoes" },
        () => qc.invalidateQueries({ queryKey: ["notif"] })
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "notificacao_comentarios" },
        () => qc.invalidateQueries({ queryKey: ["notif"] })
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "notificacao_destinatarios", filter: `usuario_id=eq.${user.id}` },
        () => qc.invalidateQueries({ queryKey: ["notif"] })
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, qc]);
}

export function useNotificacaoDetail(id: string | null) {
  return useQuery({
    queryKey: ["notif", "detail", id],
    queryFn: async () => {
      if (!id) return null;
      const [{ data: notif }, { data: dests }, { data: coments }, { data: hist }] = await Promise.all([
        supabase.from("notificacoes").select("*").eq("id", id).maybeSingle(),
        supabase.from("notificacao_destinatarios").select("*").eq("notificacao_id", id),
        supabase.from("notificacao_comentarios").select("*").eq("notificacao_id", id).order("created_at"),
        supabase.from("notificacao_historico").select("*").eq("notificacao_id", id).order("created_at"),
      ]);
      return { notif, dests: dests ?? [], coments: coments ?? [], hist: hist ?? [] };
    },
    enabled: !!id,
  });
}
