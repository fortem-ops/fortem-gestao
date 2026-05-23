import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Briefcase, Clock, Coffee } from "lucide-react";
import { formatMinutes } from "@/lib/ponto";

interface Props {
  userId: string;
  data?: string; // ISO yyyy-mm-dd
}

interface Janelas {
  tempo_trabalhado_min: number;
  tempo_ocioso_min: number;
  tempo_estabelecimento_min: number;
}

/**
 * Mostra a separação entre jornada efetiva (aulas), tempo ocioso (janelas entre aulas)
 * e tempo total no estabelecimento. Não computa janelas automaticamente como horas trabalhadas.
 */
export function JanelasDoDia({ userId, data }: Props) {
  const hoje = data ?? new Date().toISOString().slice(0, 10);

  const { data: janelas, isLoading } = useQuery({
    queryKey: ["ponto-janelas-dia", userId, hoje],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("fn_ponto_janelas_dia" as any, {
        _usuario: userId,
        _data: hoje,
      });
      if (error) throw error;
      const row = Array.isArray(data) ? data[0] : data;
      return (row ?? {
        tempo_trabalhado_min: 0,
        tempo_ocioso_min: 0,
        tempo_estabelecimento_min: 0,
      }) as Janelas;
    },
    enabled: !!userId,
  });

  if (isLoading || !janelas) return <Skeleton className="h-24" />;

  const cards = [
    {
      icon: Briefcase,
      label: "Trabalhado",
      value: janelas.tempo_trabalhado_min,
      tone: "text-success bg-success/10 border-success/30",
      hint: "Aulas efetivamente realizadas",
    },
    {
      icon: Coffee,
      label: "Ocioso",
      value: janelas.tempo_ocioso_min,
      tone: "text-warning bg-warning/10 border-warning/30",
      hint: "Janelas entre aulas",
    },
    {
      icon: Clock,
      label: "No estabelecimento",
      value: janelas.tempo_estabelecimento_min,
      tone: "text-info bg-info/10 border-info/30",
      hint: "Entrada → saída (líquido)",
    },
  ];

  return (
    <Card className="p-4">
      <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
        <Clock className="w-4 h-4 text-primary" /> Janelas do dia
      </h3>
      <div className="grid grid-cols-3 gap-3">
        {cards.map((c) => (
          <div
            key={c.label}
            className={`border rounded-lg p-3 flex flex-col gap-1 ${c.tone}`}
          >
            <div className="flex items-center gap-1.5 text-xs font-medium">
              <c.icon className="w-3.5 h-3.5" /> {c.label}
            </div>
            <p className="text-xl font-bold tabular-nums">{formatMinutes(c.value)}</p>
            <p className="text-[10px] text-muted-foreground">{c.hint}</p>
          </div>
        ))}
      </div>
    </Card>
  );
}
