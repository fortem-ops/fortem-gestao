import { Settings, Users, Shield, CreditCard, Briefcase, ClipboardList, Dumbbell } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AdminUsers } from "@/components/admin/AdminUsers";
import { AdminPlanos } from "@/components/admin/AdminPlanos";
import { AdminServicos } from "@/components/admin/AdminServicos";
import { AdminComingSoon } from "@/components/admin/AdminComingSoon";
import { AdminTiposAvaliacao } from "@/components/admin/AdminTiposAvaliacao";

const tabs = [
  { value: "usuarios", label: "Usuários & Permissões", icon: Users },
  { value: "planos", label: "Planos", icon: CreditCard },
  { value: "servicos", label: "Serviços", icon: Briefcase },
  { value: "avaliacoes", label: "Tipos de Avaliação", icon: ClipboardList },
  { value: "templates", label: "Templates de Treino", icon: Dumbbell },
];

export default function Admin() {
  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-heading font-bold text-foreground flex items-center gap-2">
          <Settings className="w-6 h-6 text-primary" />
          Administração
        </h1>
        <p className="text-sm text-muted-foreground mt-1">Somente Coordenação e Administradores</p>
      </div>

      <Tabs defaultValue="usuarios" className="w-full">
        <TabsList className="w-full flex flex-wrap h-auto gap-1 bg-secondary/50 p-1">
          {tabs.map((tab) => (
            <TabsTrigger key={tab.value} value={tab.value} className="flex items-center gap-1.5 text-xs">
              <tab.icon className="w-3.5 h-3.5" />
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="usuarios" className="mt-4">
          <AdminUsers />
        </TabsContent>
        <TabsContent value="planos" className="mt-4">
          <AdminPlanos />
        </TabsContent>
        <TabsContent value="servicos" className="mt-4">
          <AdminServicos />
        </TabsContent>
        <TabsContent value="avaliacoes" className="mt-4">
          <AdminTiposAvaliacao />
        </TabsContent>
        <TabsContent value="templates" className="mt-4">
          <AdminComingSoon title="Templates de Treino" />
        </TabsContent>
      </Tabs>
    </div>
  );
}
