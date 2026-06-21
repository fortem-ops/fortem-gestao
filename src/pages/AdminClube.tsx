import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { AdminClubeDashboard } from "@/components/clube/AdminClubeDashboard";
import { AdminMembrosTable } from "@/components/clube/AdminMembrosTable";
import { AdminParceirosTable } from "@/components/clube/AdminParceirosTable";
import { AdminBeneficiosTable } from "@/components/clube/AdminBeneficiosTable";
import { ClubeAlertasBell } from "@/components/clube/ClubeAlertasBell";
import { Sparkles, RefreshCw } from "lucide-react";
import { Navigate } from "react-router-dom";
import { toast } from "sonner";

/**
 * Painel administrativo do Clube FORTEM (coordenadores e admins).
 */
export default function AdminClube() {
  const { user, loading } = useAuth();
  const queryClient = useQueryClient();

  const { data: isCoordAdmin, isLoading: checking } = useQuery({
    queryKey: ["admin-clube-access", user?.id],
    queryFn: async () => {
      const { data } = await supabase.rpc("is_coordinator_or_admin", { _user_id: user!.id });
      return !!data;
    },
    enabled: !!user,
  });

  const resyncMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc("fn_clube_resync_todos_safe");
      if (error) throw error;
      return data as { ok: boolean; resync?: { sincronizados: number }; divergencias?: { divergencias: number }; erro?: string };
    },
    onSuccess: (data) => {
      if (!data.ok) {
        toast.error("Falha registrada", { description: data.erro ?? "Veja o sino de alertas." });
      } else {
        const sinc = data.resync?.sincronizados ?? 0;
        const div = data.divergencias?.divergencias ?? 0;
        toast.success("Re-sincronização concluída", { description: `${sinc} membros atualizados${div > 0 ? ` · ${div} divergência(s) registrada(s) nos alertas` : ""}.` });
      }
      queryClient.invalidateQueries({ queryKey: ["clube-dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["admin-membros"] });
      queryClient.invalidateQueries({ queryKey: ["clube-alertas"] });
    },
    onError: (err: any) => {
      toast.error("Falha ao re-sincronizar", { description: err.message });
    },
  });

  if (loading || checking) return <Skeleton className="h-64" />;
  if (!user) return <Navigate to="/login" replace />;
  if (!isCoordAdmin) {
    return (
      <Card className="p-10 text-center text-muted-foreground">
        Acesso restrito a coordenadores e administradores.
      </Card>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <header className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-heading font-bold flex items-center gap-2">
            <Sparkles className="w-6 h-6 text-primary" /> Administração — Clube FORTEM
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Gestão estratégica de membros, parceiros, benefícios e métricas.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <ClubeAlertasBell />
          <Button
            variant="outline"
            onClick={() => resyncMutation.mutate()}
            disabled={resyncMutation.isPending}
            className="gap-2"
          >
            <RefreshCw className={`w-4 h-4 ${resyncMutation.isPending ? "animate-spin" : ""}`} />
            {resyncMutation.isPending ? "Sincronizando..." : "Re-sincronizar membros"}
          </Button>
        </div>
      </header>

      <Tabs defaultValue="dashboard" className="w-full">
        <TabsList className="bg-secondary/50">
          <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
          <TabsTrigger value="membros">Membros</TabsTrigger>
          <TabsTrigger value="parceiros">Parceiros</TabsTrigger>
          <TabsTrigger value="beneficios">Benefícios</TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard" className="pt-6"><AdminClubeDashboard /></TabsContent>
        <TabsContent value="membros" className="pt-6"><AdminMembrosTable /></TabsContent>
        <TabsContent value="parceiros" className="pt-6"><AdminParceirosTable /></TabsContent>
        <TabsContent value="beneficios" className="pt-6"><AdminBeneficiosTable /></TabsContent>
      </Tabs>
    </div>
  );
}
