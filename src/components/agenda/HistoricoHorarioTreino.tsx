import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Clock, History, ListOrdered } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import {
  parseHistoricoHorarioPayload,
  rotuloAutorHorario,
  rotuloEventoHorario,
} from "@/lib/historicoHorarioTreino";

interface Props {
  slotId: string;
  dataStr: string;
}

function formatarDataHora(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return format(d, "dd/MM 'às' HH:mm", { locale: ptBR });
}

export function HistoricoHorarioTreino({ slotId, dataStr }: Props) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["historico-horario-treino", slotId, dataStr],
    enabled: Boolean(slotId && dataStr),
    queryFn: async () => {
      const { data: rpcData, error } = await supabase.rpc("fn_historico_horario_treino", {
        p_slot_id: slotId,
        p_data: dataStr,
      });
      if (error) throw error;
      return parseHistoricoHorarioPayload(rpcData);
    },
  });

  const fila = data?.fila_ativa ?? [];
  const eventos = data?.eventos ?? [];

  return (
    <div className="mt-6 space-y-5 border-t pt-4">
      <section aria-label="Na fila de espera">
        <div className="flex items-center gap-2 mb-2">
          <ListOrdered className="w-4 h-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold">Na fila de espera</h3>
          {fila.length > 0 && (
            <Badge variant="secondary" className="text-[10px] ml-auto">
              {fila.length}
            </Badge>
          )}
        </div>

        {isLoading ? (
          <p className="text-xs text-muted-foreground">Carregando fila...</p>
        ) : isError ? (
          <p className="text-xs text-destructive">Não foi possível carregar a fila de espera.</p>
        ) : fila.length === 0 ? (
          <p className="text-xs text-muted-foreground">Ninguém na fila de espera.</p>
        ) : (
          <ol className="space-y-1.5">
            {fila.map((item, idx) => (
              <li
                key={item.id}
                className="flex items-center justify-between gap-2 rounded-md border px-2.5 py-1.5 text-xs"
              >
                <span className="font-medium truncate">
                  {idx + 1}. {item.aluno_nome}
                </span>
                <span className="text-muted-foreground shrink-0 flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {formatarDataHora(item.created_at)}
                </span>
              </li>
            ))}
          </ol>
        )}
      </section>

      <section aria-label="Histórico do horário">
        <div className="flex items-center gap-2 mb-2">
          <History className="w-4 h-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold">Histórico do horário</h3>
        </div>

        {isLoading ? (
          <p className="text-xs text-muted-foreground">Carregando histórico...</p>
        ) : isError ? (
          <p className="text-xs text-destructive">Não foi possível carregar o histórico.</p>
        ) : eventos.length === 0 ? (
          <p className="text-xs text-muted-foreground">Nenhuma movimentação registrada neste horário.</p>
        ) : (
          <ul className="space-y-2">
            {eventos.map((ev) => (
              <li key={ev.id} className="rounded-md border px-2.5 py-2 text-xs space-y-0.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium text-foreground truncate">{ev.aluno_nome}</span>
                  <span className="text-muted-foreground shrink-0">
                    {formatarDataHora(ev.ocorrido_em)}
                  </span>
                </div>
                <div className="text-foreground/90">
                  {rotuloEventoHorario(ev.tipo, ev.autor_tipo)}
                  {ev.detalhe ? ` · ${ev.detalhe}` : ""}
                </div>
                <div className="text-[11px] text-muted-foreground">
                  Por: {rotuloAutorHorario(ev.autor_nome, ev.autor_tipo)}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}