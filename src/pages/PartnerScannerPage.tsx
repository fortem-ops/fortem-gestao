import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { PartnerScanner } from "@/components/clube/PartnerScanner";
import { PartnerManualValidation } from "@/components/clube/PartnerManualValidation";
import { LogOut, ScanLine, Sparkles } from "lucide-react";
import fortemIcon from "@/assets/fortem-icon.png";
import { Navigate, useNavigate } from "react-router-dom";

/**
 * Painel autônomo do parceiro (sem AppLayout).
 * Coordenadores podem escolher qualquer parceiro; donos veem o seu.
 */
export default function PartnerScannerPage() {
  const { user, loading, signOut } = useAuth();
  const navigate = useNavigate();
  const [parceiroId, setParceiroId] = useState<string>("");

  const { data: isCoordAdmin } = useQuery({
    queryKey: ["scanner-isCoordAdmin", user?.id],
    queryFn: async () => {
      const { data } = await supabase.rpc("is_coordinator_or_admin", { _user_id: user!.id });
      return !!data;
    },
    enabled: !!user,
  });

  const { data: parceirosList = [] } = useQuery({
    queryKey: ["scanner-parceiros", user?.id, isCoordAdmin],
    queryFn: async () => {
      let q = supabase.from("parceiros").select("id, nome, categoria").eq("ativo", true).order("nome");
      if (!isCoordAdmin) q = q.eq("user_id", user!.id);
      const { data } = await q;
      return data || [];
    },
    enabled: !!user,
  });

  useEffect(() => {
    if (!parceiroId && parceirosList.length > 0) setParceiroId(parceirosList[0].id);
  }, [parceirosList, parceiroId]);

  if (loading) return <div className="min-h-screen flex items-center justify-center"><Skeleton className="h-32 w-64" /></div>;
  if (!user) return <Navigate to="/login" replace />;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border sticky top-0 bg-background/95 backdrop-blur z-10">
        <div className="max-w-3xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <img src={fortemIcon} alt="Fortem" className="w-6 h-6" />
            <span className="text-sm font-semibold">Painel do Parceiro</span>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => navigate("/")}>Sistema</Button>
            <Button variant="ghost" size="icon" onClick={signOut}><LogOut className="w-4 h-4" /></Button>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto p-4 sm:p-6 space-y-6">
        {parceirosList.length === 0 ? (
          <Card className="p-10 text-center text-muted-foreground">
            <Sparkles className="w-10 h-10 mx-auto mb-3 opacity-40" />
            <p>Nenhum parceiro vinculado a esta conta.</p>
          </Card>
        ) : (
          <>
            {parceirosList.length > 1 && (
              <Card className="p-4">
                <label className="text-xs text-muted-foreground uppercase tracking-wider mb-2 block">
                  Parceiro ativo
                </label>
                <Select value={parceiroId} onValueChange={setParceiroId}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {parceirosList.map((p) => (
                      <SelectItem key={p.id} value={p.id}>{p.nome} · {p.categoria}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Card>
            )}

            {parceiroId && (
              <Tabs defaultValue="qr" className="w-full">
                <TabsList className="grid grid-cols-2 w-full">
                  <TabsTrigger value="qr" className="gap-2"><ScanLine className="w-4 h-4" /> QR Scan</TabsTrigger>
                  <TabsTrigger value="manual">CPF Manual</TabsTrigger>
                </TabsList>
                <TabsContent value="qr" className="pt-4">
                  <PartnerScanner parceiroId={parceiroId} />
                </TabsContent>
                <TabsContent value="manual" className="pt-4">
                  <PartnerManualValidation parceiroId={parceiroId} />
                </TabsContent>
              </Tabs>
            )}
          </>
        )}
      </main>
    </div>
  );
}
