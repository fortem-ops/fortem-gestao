import { useState } from "react";
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
import { AdminPontoVinculos } from "@/components/ponto/AdminPontoVinculos";
import { AdminSubstituicoes } from "@/components/ponto/AdminSubstituicoes";
import { AdminAtividadesEspeciais } from "@/components/ponto/AdminAtividadesEspeciais";
import { AdminAcordosIntervalo } from "@/components/ponto/AdminAcordosIntervalo";
import { AdminPontoLocais } from "@/components/ponto/AdminPontoLocais";
import { AdminBancoHorasConfig } from "@/components/ponto/AdminBancoHorasConfig";
import { AdminBancoHorasTable } from "@/components/ponto/AdminBancoHorasTable";

export default function AdminPonto() {
  const { user, loading } = useAuth();
  const [profId, setProfId] = useState<string>("todos");

  const { data: isAdmin, isLoading: checking } = useQuery({
    queryKey: ["admin-ponto-access", user?.id],
    queryFn: async () => {
      const { data } = await supabase.rpc("is_admin", { _user_id: user!.id });
      return !!data;
    },
    enabled: !!user,
  });

  const { data: profissionais = [] } = useQuery({
    queryKey: ["admin-ponto-profs"],
    enabled: !!isAdmin,
    queryFn: async () => {
      const { data: roles } = await supabase
        .from("user_roles")
        .select("user_id, role")
        .in("role", ["professor", "admin"]);
      const ids = Array.from(new Set((roles ?? []).map((r) => r.user_id)));
      if (!ids.length) return [];
      const { data } = await supabase
        .from("profiles")
        .select("user_id, full_name")
        .in("user_id", ids)
        .order("full_name");
      return (data ?? []) as Array<{ user_id: string; full_name: string }>;
    },
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

      <Tabs defaultValue="vinculos" className="space-y-4">
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="vinculos">Vínculos</TabsTrigger>
          <TabsTrigger value="horarios">Horários</TabsTrigger>
          <TabsTrigger value="locais">Locais</TabsTrigger>
          <TabsTrigger value="feriados">Feriados</TabsTrigger>
          <TabsTrigger value="ferias">Férias / Folgas</TabsTrigger>
          <TabsTrigger value="substituicoes">Substituições</TabsTrigger>
          <TabsTrigger value="atividades">Atividades especiais</TabsTrigger>
          <TabsTrigger value="acordos">Acordos de intervalo</TabsTrigger>
          <TabsTrigger value="banco">Banco de horas</TabsTrigger>
        </TabsList>
        <TabsContent value="vinculos"><AdminPontoVinculos /></TabsContent>
        <TabsContent value="horarios"><AdminPontoHorarios /></TabsContent>
        <TabsContent value="locais"><AdminPontoLocais /></TabsContent>
        <TabsContent value="feriados"><AdminPontoFeriados /></TabsContent>
        <TabsContent value="ferias"><AdminPontoFerias /></TabsContent>
        <TabsContent value="substituicoes"><AdminSubstituicoes /></TabsContent>
        <TabsContent value="atividades"><AdminAtividadesEspeciais /></TabsContent>
        <TabsContent value="acordos"><AdminAcordosIntervalo /></TabsContent>
        <TabsContent value="banco" className="space-y-4">
          <AdminBancoHorasConfig />
          <AdminBancoHorasTable profissionais={profissionais} profId={profId} setProfId={setProfId} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
