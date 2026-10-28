import { Navigate } from "react-router-dom";
import { Send, Loader2, Clock } from "lucide-react";
import { useUserRoles } from "@/hooks/useUserRoles";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import DisparosModelos from "@/components/disparos/DisparosModelos";
import DisparosAvulsos from "@/components/disparos/DisparosAvulsos";
import DisparosHistorico from "@/components/disparos/DisparosHistorico";

function EmBreve({ texto }: { texto: string }) {
  return (
    <Card>
      <CardContent className="flex flex-col items-center justify-center gap-2 py-16 text-center">
        <Clock className="h-8 w-8 text-muted-foreground" />
        <p className="font-medium">Em breve</p>
        <p className="text-sm text-muted-foreground max-w-md">{texto}</p>
      </CardContent>
    </Card>
  );
}

export default function Disparos() {
  const { data: roles, isLoading } = useUserRoles();
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (!roles?.isAdmin) return <Navigate to="/" replace />;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Send className="h-6 w-6 text-primary" />
        <div>
          <h1 className="text-2xl font-bold">Disparo de Mensagens</h1>
          <p className="text-sm text-muted-foreground">Campanhas por e-mail e WhatsApp</p>
        </div>
      </div>
      <Tabs defaultValue="modelos">
        <TabsList>
          <TabsTrigger value="avulsos">Avulsos</TabsTrigger>
          <TabsTrigger value="automaticos">Automáticos</TabsTrigger>
          <TabsTrigger value="modelos">Modelos</TabsTrigger>
          <TabsTrigger value="historico">Histórico</TabsTrigger>
        </TabsList>
        <TabsContent value="avulsos"><DisparosAvulsos /></TabsContent>
        <TabsContent value="automaticos"><EmBreve texto="Automações por gatilho chegam em uma fase futura." /></TabsContent>
        <TabsContent value="modelos"><DisparosModelos /></TabsContent>
        <TabsContent value="historico"><DisparosHistorico /></TabsContent>
      </Tabs>
    </div>
  );
}
