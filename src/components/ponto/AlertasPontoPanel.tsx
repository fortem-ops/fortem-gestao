import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Bell, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

const PRIO_CLS: Record<string, string> = {
  urgente: "bg-destructive/15 text-destructive border-destructive/30",
  alta: "bg-warning/15 text-warning border-warning/30",
  media: "bg-info/15 text-info border-info/30",
  baixa: "bg-muted text-muted-foreground",
};

export function AlertasPontoPanel() {
  const { data, isLoading, refetch } = useQuery({
    queryKey: ["ponto-alertas-recentes"],
    queryFn: async () => {
      const desde = new Date();
      desde.setDate(desde.getDate() - 7);
      const { data, error } = await supabase
        .from("notificacoes")
        .select("id, titulo, descricao, prioridade, status, created_at")
        .eq("categoria", "ponto")
        .gte("created_at", desde.toISOString())
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return data ?? [];
    },
  });

  const handleRunNow = async () => {
    const { data, error } = await supabase.functions.invoke("ponto-alertas-diarios", { body: {} });
    if (error) {
      toast.error("Falha ao executar alertas: " + error.message);
      return;
    }
    toast.success(`Alertas processados: ${(data as any)?.result?.criadas ?? 0}`);
    refetch();
  };

  return (
    <Card className="p-4">
      <header className="flex items-center justify-between mb-3">
        <h2 className="text-base font-heading font-semibold flex items-center gap-2">
          <Bell className="w-4 h-4 text-primary" /> Alertas do Ponto (últimos 7 dias)
        </h2>
        <Button variant="outline" size="sm" onClick={handleRunNow}>Rodar agora</Button>
      </header>
      {isLoading ? (
        <Skeleton className="h-32" />
      ) : !data || data.length === 0 ? (
        <p className="text-sm text-muted-foreground py-6 text-center">Sem alertas recentes. ✅</p>
      ) : (
        <ul className="space-y-2">
          {data.map((n) => (
            <li key={n.id} className="flex items-start gap-3 p-3 rounded-lg border border-border/60">
              <AlertCircle className="w-4 h-4 mt-1 text-warning shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-medium truncate">{n.titulo}</span>
                  <Badge variant="outline" className={PRIO_CLS[n.prioridade] || ""}>{n.prioridade}</Badge>
                </div>
                <p className="text-xs text-muted-foreground mt-1">{n.descricao}</p>
                <p className="text-[10px] text-muted-foreground mt-1">
                  {new Date(n.created_at).toLocaleString("pt-BR")}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
