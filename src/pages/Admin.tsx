import { useQuery } from "@tanstack/react-query";
import { Settings, Users, CreditCard, Briefcase, ClipboardList, Dumbbell } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AdminUsers } from "@/components/admin/AdminUsers";
import { AdminPlanos } from "@/components/admin/AdminPlanos";
import { AdminServicos } from "@/components/admin/AdminServicos";
import { AdminComingSoon } from "@/components/admin/AdminComingSoon";
import { AdminTiposAvaliacao } from "@/components/admin/AdminTiposAvaliacao";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

const allTabs = [
  { value: "usuarios", label: "Usuários & Permissões", icon: Users, adminOnly: true },
  { value: "planos", label: "Planos", icon: CreditCard, adminOnly: true },
  { value: "servicos", label: "Serviços", icon: Briefcase, adminOnly: true },
  { value: "avaliacoes", label: "Tipos de Avaliação", icon: ClipboardList, adminOnly: false },
  { value: "templates", label: "Templates de Treino", icon: Dumbbell, adminOnly: false },
];

export default function Admin() {
  const { user } = useAuth();
  const { data: isAdmin } = useQuery({
    queryKey: ["admin-page-is-admin", user?.id],
    queryFn: async () => {
      const { data } = await supabase.rpc("is_admin", { _user_id: user!.id });
      return !!data;
    },
    enabled: !!user,
    staleTime: 5 * 60_000,
  });

  const tabs = allTabs.filter((t) => !t.adminOnly || isAdmin);
  const defaultTab = isAdmin ? "usuarios" : "avaliacoes";

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-heading font-bold text-foreground flex items-center gap-2">
          <Settings className="w-6 h-6 text-primary" />
          Administração
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          {isAdmin ? "Somente Coordenação e Administradores" : "Tipos de Avaliação e Templates de Treino"}
        </p>
      </div>

      <Tabs defaultValue={defaultTab} className="w-full">
        <TabsList className="w-full flex flex-wrap h-auto gap-1 bg-secondary/50 p-1">
          {tabs.map((tab) => (
            <TabsTrigger key={tab.value} value={tab.value} className="flex items-center gap-1.5 text-xs">
              <tab.icon className="w-3.5 h-3.5" />
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>

        {isAdmin && (
          <>
            <TabsContent value="usuarios" className="mt-4"><AdminUsers /></TabsContent>
            <TabsContent value="planos" className="mt-4"><AdminPlanos /></TabsContent>
            <TabsContent value="servicos" className="mt-4"><AdminServicos /></TabsContent>
            
          </>
        )}
        <TabsContent value="avaliacoes" className="mt-4"><AdminTiposAvaliacao /></TabsContent>
        <TabsContent value="templates" className="mt-4"><AdminComingSoon title="Templates de Treino" /></TabsContent>
      </Tabs>
    </div>
  );
}
