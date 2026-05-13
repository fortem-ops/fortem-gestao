import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Settings } from "lucide-react";
import { Navigate } from "react-router-dom";
import { AdminPontoHorarios } from "@/components/ponto/AdminPontoHorarios";
import { AdminPontoFeriados } from "@/components/ponto/AdminPontoFeriados";
import { AdminPontoFerias } from "@/components/ponto/AdminPontoFerias";

export default function AdminPonto() {
  const { user, loading } = useAuth();

  const { data: isAdmin, isLoading: checking } = useQuery({
    queryKey: ["admin-ponto-access", user?.id],
    queryFn: async () => {
      const { data } = await supabase.rpc("is_admin", { _user_id: user!.id });
      return !!data;
    },
    enabled: !!user,
  });

  if (loading || checking) return <Skeleton className="h-64" />;
  if (!user) return <Navigate to="/login" replace />;
  if (!isAdmin) {
    return <Card className="p-10 text-center text-muted-foreground">Acesso restrito a administradores.</Card>;
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <header>
        <h1 className="text-2xl font-heading font-bold flex items-center gap-2">
          <Settings className="w-6 h-6 text-primary" /> Admin — Ponto
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Configure horários, feriados e ausências justificadas dos colaboradores.
        </p>
      </header>

      <Tabs defaultValue="horarios" className="space-y-4">
        <TabsList>
          <TabsTrigger value="horarios">Horários</TabsTrigger>
          <TabsTrigger value="feriados">Feriados</TabsTrigger>
          <TabsTrigger value="ferias">Férias / Folgas</TabsTrigger>
        </TabsList>
        <TabsContent value="horarios"><AdminPontoHorarios /></TabsContent>
        <TabsContent value="feriados"><AdminPontoFeriados /></TabsContent>
        <TabsContent value="ferias"><AdminPontoFerias /></TabsContent>
      </Tabs>
    </div>
  );
}
