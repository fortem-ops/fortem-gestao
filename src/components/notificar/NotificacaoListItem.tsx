import { format, isToday } from "date-fns";
import { MessageSquare, Paperclip } from "lucide-react";
import { cn } from "@/lib/utils";
import { descricaoNotificacaoExibicao } from "@/lib/notificacaoTexto";
import { PrioridadeSelo } from "./NotificacaoBadge";
import type { NotificacaoListItem as Item, ComentarioResumo } from "@/hooks/useNotificacoes";

interface Props {
  n: Item;
  remetente: string;
  unread: boolean;
  selected: boolean;
  resumo?: ComentarioResumo;
  destinatarios?: number;
  onClick: () => void;
}

export function NotificacaoListItem({ n, remetente, unread, selected, resumo, destinatarios, onClick }: Props) {
  const d = new Date(n.created_at);
  const linha1 = destinatarios !== undefined
    ? `Para: ${destinatarios} ${destinatarios === 1 ? "destinatário" : "destinatários"}`
    : remetente;
  const hora = isToday(d) ? format(d, "HH:mm") : format(d, "dd/MM");
  return (
    <button
      onClick={onClick}
      className={cn(
        "relative w-full border-b py-2.5 pl-6 pr-3 text-left transition-colors hover:bg-muted/50",
        selected && "bg-muted",
      )}
    >
      {selected && <span className="absolute inset-y-0 left-0 w-[3px] bg-primary" />}
      {unread && <span className="absolute left-2.5 top-[15px] h-2 w-2 rounded-[2px] bg-primary" />}
      <div className="flex items-center justify-between gap-2">
        <span className={cn("min-w-0 flex-1 truncate text-sm", unread ? "font-bold text-foreground" : "text-foreground/90")}>{linha1}</span>
        <span className="shrink-0 text-[11px] text-muted-foreground">{hora}</span>
      </div>
      <div className="mt-0.5 flex items-center justify-between gap-2">
        <span className={cn("min-w-0 flex-1 truncate text-sm", unread ? "font-semibold text-foreground" : "text-foreground/80")}>{n.titulo}</span>
        <PrioridadeSelo prioridade={n.prioridade} />
      </div>
      <div className="mt-0.5 flex items-center justify-between gap-2">
        <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">{descricaoNotificacaoExibicao(n.descricao)}</span>
        <span className="flex shrink-0 items-center gap-1.5 text-muted-foreground">
          {resumo?.temAnexo && <Paperclip className="h-3 w-3" aria-label="Com anexo" />}
          {(resumo?.total ?? 0) > 0 && (
            <span className="flex items-center gap-0.5 text-[11px]">
              <MessageSquare className="h-3 w-3" />{resumo!.total}
            </span>
          )}
        </span>
      </div>
    </button>
  );
}
