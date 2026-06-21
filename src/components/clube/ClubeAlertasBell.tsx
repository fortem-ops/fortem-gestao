// Sino de alertas internos do Clube FORTEM (visível no header do AdminClube).
// Mostra contagem de não lidos + popover com lista. Permite marcar como lido.
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Bell, AlertTriangle, AlertCircle, Info, Check } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";

type Severidade = "info" | "aviso" | "critico";
type Tipo = "cron_falha" | "divergencia_nivel" | "sincronizacao_parcial" | "manual";

interface Alerta {
  id: string;
  tipo: Tipo;
  severidade: Severidade;
  mensagem: string;
  payload: Record<string, any>;
  lido: boolean;
  created_at: string;
}

const SEV_ICON: Record<Severidade, typeof Info> = {
  info: Info,
  aviso: AlertTriangle,
  critico: AlertCircle,
};

const SEV_COLOR: Record<Severidade, string> = {
  info: "text-blue-500",
  aviso: "text-amber-500",
  critico: "text-destructive",
};

export function ClubeAlertasBell() {
  const queryClient = useQueryClient();

  const { data: alertas } = useQuery({
    queryKey: ["clube-alertas"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clube_alertas")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data ?? []) as Alerta[];
    },
    refetchInterval: 60_000,
  });

  const naoLidos = alertas?.filter((a) => !a.lido).length ?? 0;

  const marcarLido = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.rpc("fn_clube_marcar_alerta_lido", { _alerta_id: id });
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["clube-alertas"] }),
    onError: (err: any) => toast.error("Erro", { description: err.message }),
  });

  const marcarTodosLidos = useMutation({
    mutationFn: async () => {
      const ids = alertas?.filter((a) => !a.lido).map((a) => a.id) ?? [];
      if (!ids.length) return;
      const { error } = await supabase
        .from("clube_alertas")
        .update({ lido: true, lido_em: new Date().toISOString() })
        .in("id", ids);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["clube-alertas"] }),
  });

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="icon" className="relative">
          <Bell className="w-4 h-4" />
          {naoLidos > 0 && (
            <Badge
              variant="destructive"
              className="absolute -top-1 -right-1 h-5 min-w-5 px-1 text-[10px] flex items-center justify-center"
            >
              {naoLidos > 9 ? "9+" : naoLidos}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-96 p-0">
        <div className="flex items-center justify-between p-3 border-b">
          <p className="font-semibold text-sm">Alertas do Clube</p>
          {naoLidos > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs"
              onClick={() => marcarTodosLidos.mutate()}
            >
              Marcar todos como lidos
            </Button>
          )}
        </div>
        <ScrollArea className="h-96">
          {!alertas?.length ? (
            <p className="p-6 text-sm text-center text-muted-foreground">
              Nenhum alerta registrado.
            </p>
          ) : (
            <ul className="divide-y">
              {alertas.map((a) => {
                const Icon = SEV_ICON[a.severidade];
                return (
                  <li
                    key={a.id}
                    className={`p-3 hover:bg-muted/50 transition-colors ${
                      !a.lido ? "bg-muted/30" : ""
                    }`}
                  >
                    <div className="flex gap-3">
                      <Icon className={`w-4 h-4 mt-0.5 shrink-0 ${SEV_COLOR[a.severidade]}`} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium leading-snug">{a.mensagem}</p>
                        {a.tipo === "divergencia_nivel" && a.payload && (
                          <p className="text-xs text-muted-foreground mt-1">
                            Atual: <strong>{a.payload.nivel_atual}</strong> · Esperado:{" "}
                            <strong>{a.payload.nivel_esperado}</strong>
                          </p>
                        )}
                        {a.tipo === "cron_falha" && a.payload?.erro && (
                          <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                            {a.payload.erro}
                          </p>
                        )}
                        <p className="text-[10px] text-muted-foreground mt-1">
                          {formatDistanceToNow(new Date(a.created_at), {
                            addSuffix: true,
                            locale: ptBR,
                          })}
                        </p>
                      </div>
                      {!a.lido && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 shrink-0"
                          onClick={() => marcarLido.mutate(a.id)}
                          title="Marcar como lido"
                        >
                          <Check className="w-3.5 h-3.5" />
                        </Button>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
