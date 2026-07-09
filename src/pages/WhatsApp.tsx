import { Navigate } from "react-router-dom";
import { MessageCircle, Loader2 } from "lucide-react";
import { useUserRoles } from "@/hooks/useUserRoles";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import WhatsAppChat from "@/components/whatsapp/WhatsAppChat";
import WhatsAppDisparos from "@/components/whatsapp/WhatsAppDisparos";
import WhatsAppSettings from "@/components/whatsapp/WhatsAppSettings";

export default function WhatsApp() {
  const { data: roles, isLoading } = useUserRoles();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (!roles?.isCoordAdmin) return <Navigate to="/" replace />;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center gap-2">
        <MessageCircle className="w-6 h-6 text-primary" />
        <div>
          <h1 className="text-2xl font-heading font-bold">WhatsApp</h1>
          <p className="text-sm text-muted-foreground">
            Conversas e configurações da integração com WhatsApp Cloud API
          </p>
        </div>
      </div>

      <Tabs defaultValue="chat" className="w-full">
        <TabsList>
          <TabsTrigger value="chat">Chat</TabsTrigger>
          <TabsTrigger value="disparos">Disparos Automáticos</TabsTrigger>
          <TabsTrigger value="config">Configurações</TabsTrigger>
        </TabsList>
        <TabsContent value="chat" className="mt-4">
          <WhatsAppChat />
        </TabsContent>
        <TabsContent value="disparos" className="mt-4">
          <WhatsAppDisparos />
        </TabsContent>
        <TabsContent value="config" className="mt-4">
          <WhatsAppSettings />
        </TabsContent>
      </Tabs>
    </div>
  );
}
