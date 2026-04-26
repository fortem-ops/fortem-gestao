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
import { Sparkles, RefreshCw } from "lucide-react";
import { Navigate } from "react-router-dom";
import { toast } from "@/hooks/use-toast";

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
      const { data, error } = await supabase.rpc("fn_clube_resync_todos");
      if (error) throw error;
      return data as { sincronizados: number; executado_em: string };
    },
    onSuccess: (data) => {
      toast({
        title: "Re-sincronização concluída",
        description: `${data.sincronizados} membros atualizados com base nos planos ativos.`,
      });
      queryClient.invalidateQueries({ queryKey: ["clube-dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["admin-membros"] });
    },
    onError: (err: any) => {
      toast({ title: "Falha ao re-sincronizar", description: err.message, variant: "destructive" });
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
        <Button
          variant="outline"
          onClick={() => resyncMutation.mutate()}
          disabled={resyncMutation.isPending}
          className="gap-2"
        >
          <RefreshCw className={`w-4 h-4 ${resyncMutation.isPending ? "animate-spin" : ""}`} />
          {resyncMutation.isPending ? "Sincronizando..." : "Re-sincronizar membros"}
        </Button>
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
