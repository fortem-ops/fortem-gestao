import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/contexts/AuthContext";
import { formatHora, formatMinutes } from "@/lib/ponto";
import { LogIn, Coffee, Utensils, LogOut, MessageSquarePlus } from "lucide-react";
import { toast } from "@/hooks/use-toast";

interface Props {
  jornadaId?: string | null;
  entrada?: string | null;
  intervaloInicio?: string | null;
  intervaloFim?: string | null;
  saida?: string | null;
  minutosTrabalhados?: number | null;
  observacao?: string | null;
}

export function ResumoDoDia({ jornadaId, entrada, intervaloInicio, intervaloFim, saida, minutosTrabalhados, observacao }: Props) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [adding, setAdding] = useState(false);
  const [obs, setObs] = useState(observacao ?? "");

  const mut = useMutation({
    mutationFn: async () => {
      if (!jornadaId) throw new Error("Inicie a jornada antes de adicionar observação.");
      const { error } = await supabase
        .from("ponto_jornadas")
        .update({ observacao: obs })
        .eq("id", jornadaId)
        .eq("usuario_id", user!.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Observação salva" });
      setAdding(false);
      qc.invalidateQueries({ queryKey: ["ponto-estado"] });
    },
    onError: (e: any) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const items = [
    { label: "Entrada", value: formatHora(entrada), icon: LogIn },
    { label: "Intervalo início", value: formatHora(intervaloInicio), icon: Coffee },
    { label: "Intervalo fim", value: formatHora(intervaloFim), icon: Utensils },
    { label: "Saída", value: formatHora(saida), icon: LogOut },
  ];

  return (
    <Card className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <h3 className="font-heading font-semibold text-lg">Resumo do dia</h3>
        <div className="text-right">
          <p className="text-xs text-muted-foreground uppercase tracking-wider">Horas hoje</p>
          <p className="text-2xl font-bold text-primary">{formatMinutes(minutosTrabalhados ?? 0)}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {items.map((it) => {
          const Icon = it.icon;
          return (
            <div key={it.label} className="p-3 rounded-md border bg-secondary/30">
              <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                <Icon className="w-3.5 h-3.5" />
                {it.label}
              </div>
              <p className="text-base font-semibold tabular-nums">{it.value}</p>
            </div>
          );
        })}
      </div>

      {!adding ? (
        <Button variant="ghost" size="sm" onClick={() => setAdding(true)} className="gap-2 text-muted-foreground" disabled={!jornadaId}>
          <MessageSquarePlus className="w-4 h-4" />
          {observacao ? "Editar observação" : "Adicionar observação"}
        </Button>
      ) : (
        <div className="space-y-2">
          <Textarea value={obs} onChange={(e) => setObs(e.target.value)} placeholder="Ex.: Treino externo, mudança de unidade…" rows={3} />
          <div className="flex gap-2">
            <Button size="sm" onClick={() => mut.mutate()} disabled={mut.isPending}>Salvar</Button>
            <Button size="sm" variant="ghost" onClick={() => { setAdding(false); setObs(observacao ?? ""); }}>Cancelar</Button>
          </div>
        </div>
      )}

      {observacao && !adding && (
        <p className="text-sm text-muted-foreground italic border-l-2 border-primary/40 pl-3">{observacao}</p>
      )}
    </Card>
  );
}
