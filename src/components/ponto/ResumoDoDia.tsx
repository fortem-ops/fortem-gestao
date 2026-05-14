import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useAuth } from "@/contexts/AuthContext";
import { formatHora, formatMinutes } from "@/lib/ponto";
import {
  formatDivergencia,
  STATUS_PONTO_LABEL,
  STATUS_PONTO_CLASS,
  type JornadaTolerancia,
} from "@/lib/pontoTolerancia";
import { LogIn, Coffee, Utensils, LogOut, MessageSquarePlus, MapPin, Info } from "lucide-react";
import { toast } from "@/hooks/use-toast";

export interface EventoPonto {
  tipo: "entrada" | "intervalo_inicio" | "intervalo_fim" | "saida";
  data_hora: string;
  latitude: number | null;
  longitude: number | null;
  dispositivo: string | null;
}

interface Props {
  jornadaId?: string | null;
  entrada?: string | null;
  intervaloInicio?: string | null;
  intervaloFim?: string | null;
  saida?: string | null;
  minutosTrabalhados?: number | null;
  observacao?: string | null;
  eventos?: EventoPonto[];
  readOnly?: boolean;
  usuarioAlvoId?: string;
  tolerancia?: JornadaTolerancia | null;
}

function LocBadge({ ev }: { ev?: EventoPonto }) {
  if (!ev) return null;
  if (ev.latitude == null || ev.longitude == null) {
    return <p className="text-[10px] text-muted-foreground/70 mt-0.5">Sem localização</p>;
  }
  const lat = ev.latitude;
  const lng = ev.longitude;
  const url = `https://www.google.com/maps?q=${lat},${lng}`;
  const d = 0.004;
  const bbox = `${lng - d},${lat - d / 2},${lng + d},${lat + d / 2}`;
  const embedUrl = `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${lat},${lng}`;
  return (
    <div className="mt-1 space-y-1">
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="block overflow-hidden rounded border border-border/60 hover:border-primary/60 transition-colors"
        title="Abrir no Google Maps"
      >
        <iframe
          src={embedUrl}
          className="w-full h-20 pointer-events-none"
          loading="lazy"
          title={`Mapa ${lat},${lng}`}
        />
      </a>
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1 text-[10px] text-primary hover:underline"
      >
        <MapPin className="w-2.5 h-2.5" />
        Ampliar mapa
      </a>
    </div>
  );
}

export function ResumoDoDia({
  jornadaId,
  entrada,
  intervaloInicio,
  intervaloFim,
  saida,
  minutosTrabalhados,
  observacao,
  eventos,
  readOnly,
  usuarioAlvoId,
}: Props) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [adding, setAdding] = useState(false);
  const [obs, setObs] = useState(observacao ?? "");

  useEffect(() => { setObs(observacao ?? ""); }, [observacao]);

  const mut = useMutation({
    mutationFn: async () => {
      if (!jornadaId) throw new Error("Inicie a jornada antes de adicionar observação.");
      const { error } = await supabase
        .from("ponto_jornadas")
        .update({ observacao: obs })
        .eq("id", jornadaId)
        .eq("usuario_id", usuarioAlvoId ?? user!.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Observação salva" });
      setAdding(false);
      qc.invalidateQueries({ queryKey: ["ponto-estado"] });
      qc.invalidateQueries({ queryKey: ["ponto-jornada-hoje"] });
    },
    onError: (e: any) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const evMap = new Map<EventoPonto["tipo"], EventoPonto>();
  for (const e of eventos ?? []) evMap.set(e.tipo, e);

  const items: { label: string; value: string; icon: typeof LogIn; tipo: EventoPonto["tipo"] }[] = [
    { label: "Entrada", value: formatHora(entrada), icon: LogIn, tipo: "entrada" },
    { label: "Intervalo início", value: formatHora(intervaloInicio), icon: Coffee, tipo: "intervalo_inicio" },
    { label: "Intervalo fim", value: formatHora(intervaloFim), icon: Utensils, tipo: "intervalo_fim" },
    { label: "Saída", value: formatHora(saida), icon: LogOut, tipo: "saida" },
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
          const ev = evMap.get(it.tipo);
          const registered = it.value !== "—";
          return (
            <div key={it.label} className="p-3 rounded-md border bg-secondary/30">
              <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                <Icon className="w-3.5 h-3.5" />
                {it.label}
              </div>
              <p className="text-base font-semibold tabular-nums">{it.value}</p>
              {registered && <LocBadge ev={ev} />}
            </div>
          );
        })}
      </div>

      {!readOnly && (
        !adding ? (
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
        )
      )}

      {observacao && !adding && (
        <p className="text-sm text-muted-foreground italic border-l-2 border-primary/40 pl-3">{observacao}</p>
      )}
    </Card>
  );
}
