import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { FileSignature, FileCheck2, Download } from "lucide-react";

type TipoAcordo = "estendido_2h" | "reduzido_30min";
const TIPO_LABEL: Record<TipoAcordo, string> = {
  estendido_2h: "Intervalo estendido (>2h)",
  reduzido_30min: "Intervalo reduzido (30min)",
};

export function MeusAcordosIntervalo() {
  const { user } = useAuth();
  const qc = useQueryClient();

  const { data: acordos } = useQuery({
    queryKey: ["meus-acordos-intervalo", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ponto_acordos_intervalo")
        .select("*")
        .eq("usuario_id", user!.id)
        .eq("ativo", true)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!user,
  });

  const aceitar = useMutation({
    mutationFn: async (id: string) => {
      let ip: string | null = null;
      try {
        const r = await fetch("https://api.ipify.org?format=json");
        ip = (await r.json()).ip ?? null;
      } catch {}
      const { error } = await supabase
        .from("ponto_acordos_intervalo")
        .update({ aceite_digital_em: new Date().toISOString(), aceite_ip: ip })
        .eq("id", id)
        .eq("usuario_id", user!.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Aceite registrado" });
      qc.invalidateQueries({ queryKey: ["meus-acordos-intervalo"] });
    },
    onError: (e: any) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const baixar = async (path: string) => {
    const { data, error } = await supabase.storage.from("acordos-intervalo").createSignedUrl(path, 60);
    if (error || !data) {
      toast({ title: "Erro", description: error?.message ?? "Falha", variant: "destructive" });
      return;
    }
    window.open(data.signedUrl, "_blank");
  };

  if (!acordos || acordos.length === 0) return null;

  return (
    <Card className="p-6 space-y-3">
      <h3 className="font-heading font-semibold text-lg flex items-center gap-2">
        <FileSignature className="w-5 h-5 text-primary" /> Meus acordos de intervalo
      </h3>
      <div className="space-y-2">
        {acordos.map((a: any) => (
          <div key={a.id} className="flex items-center justify-between gap-3 p-3 rounded-md border bg-secondary/30 flex-wrap">
            <div className="space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-medium text-sm">{TIPO_LABEL[a.tipo as TipoAcordo]}</span>
                {a.aceite_digital_em ? (
                  <Badge variant="outline" className="bg-success/15 text-success border-success/30 gap-1">
                    <FileCheck2 className="w-3 h-3" /> Aceito em {new Date(a.aceite_digital_em).toLocaleDateString("pt-BR")}
                  </Badge>
                ) : (
                  <Badge variant="outline" className="bg-warning/15 text-warning border-warning/30">
                    Aguardando aceite
                  </Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                Vigência: {new Date(a.vigencia_inicio).toLocaleDateString("pt-BR")}
                {a.vigencia_fim ? ` → ${new Date(a.vigencia_fim).toLocaleDateString("pt-BR")}` : " (indeterminada)"}
              </p>
            </div>
            <div className="flex gap-2">
              {a.documento_path && (
                <Button size="sm" variant="ghost" className="gap-1" onClick={() => baixar(a.documento_path)}>
                  <Download className="w-3.5 h-3.5" /> PDF
                </Button>
              )}
              {!a.aceite_digital_em && (
                <Button size="sm" onClick={() => aceitar.mutate(a.id)} disabled={aceitar.isPending} className="gap-1">
                  <FileCheck2 className="w-3.5 h-3.5" /> Aceitar
                </Button>
              )}
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
