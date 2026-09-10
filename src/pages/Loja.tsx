import { Navigate } from "react-router-dom";
import { ShoppingBag, Package, Tag } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useUserRoles } from "@/hooks/useUserRoles";
import { ProdutosTab } from "@/components/loja/ProdutosTab";
import { PromocoesTab } from "@/components/loja/PromocoesTab";

export default function Loja() {
  const { data: roles, isLoading } = useUserRoles();

  if (isLoading) {
    return <p className="text-sm text-muted-foreground">Carregando...</p>;
  }

  if (!roles?.isCoordAdmin) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-heading font-bold text-foreground flex items-center gap-2">
          <ShoppingBag className="w-6 h-6 text-primary" />
          Loja
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Produtos, variantes, estoque e promoções — somente Coordenação e Administração
        </p>
      </div>

      <Tabs defaultValue="produtos" className="w-full">
        <TabsList className="w-full flex flex-wrap h-auto gap-1 bg-secondary/50 p-1">
          <TabsTrigger value="produtos" className="flex items-center gap-1.5 text-xs">
            <Package className="w-3.5 h-3.5" />
            Produtos & Estoque
          </TabsTrigger>
          <TabsTrigger value="promocoes" className="flex items-center gap-1.5 text-xs">
            <Tag className="w-3.5 h-3.5" />
            Promoções
          </TabsTrigger>
        </TabsList>

        <TabsContent value="produtos" className="mt-4">
          <ProdutosTab />
        </TabsContent>
        <TabsContent value="promocoes" className="mt-4">
          <PromocoesTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
