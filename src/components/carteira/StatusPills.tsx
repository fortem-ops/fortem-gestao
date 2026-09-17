import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { RescheduleDialog, type ReschedTask } from "@/components/tasks/RescheduleDialog";

export type PillStatus = "em_dia" | "pendente" | "atrasada";

const STATUS_CLASS: Record<PillStatus, string> = {
  em_dia: "status-active",
  pendente: "status-warning",
  atrasada: "status-urgent",
};

const STATUS_LABEL: Record<PillStatus, string> = {
  em_dia: "Em dia",
  pendente: "Pendente",
  atrasada: "Atrasada",
};

export interface StatusPillProps {
  /** Rótulo curto exibido na etiqueta. */
  label: string;
  /** Nome completo do indicador, usado no menu. */
  titulo: string;
  status: PillStatus;
  /** Texto auxiliar (data, prazo) exibido no tooltip e no menu. */
  detalhe?: string;
  /** Rótulo da ação principal. */
  acaoLabel: string;
  /** Rota da ação principal. */
  acaoHref: string;
  /** Tarefa aberta relacionada — habilita "Reagendar". */
  tarefa?: ReschedTask | null;
  onReagendado?: () => void;
}

export function StatusPill({
  titulo,
  status,
  detalhe,
  acaoLabel,
  acaoHref,
  tarefa,
  onReagendado,
}: StatusPillProps) {
  const navigate = useNavigate();
  const [reschedOpen, setReschedOpen] = useState(false);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
          <button
            type="button"
            title={detalhe ? `${titulo}: ${STATUS_LABEL[status]} · ${detalhe}` : `${titulo}: ${STATUS_LABEL[status]}`}
            className="focus:outline-none"
          >
            <Badge variant="outline" className={`${STATUS_CLASS[status]} text-xs px-2.5 py-0.5 cursor-pointer`}>
              {STATUS_LABEL[status]}
            </Badge>
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
          <DropdownMenuLabel className="text-xs font-normal">
            {titulo}: {STATUS_LABEL[status]}
            {detalhe ? ` · ${detalhe}` : ""}
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => navigate(acaoHref)}>{acaoLabel}</DropdownMenuItem>
          {tarefa && (
            <DropdownMenuItem onSelect={() => setTimeout(() => setReschedOpen(true), 0)}>
              Reagendar
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
      {tarefa && reschedOpen && (
        <RescheduleDialog
          task={tarefa}
          hideTrigger
          open={reschedOpen}
          onOpenChange={setReschedOpen}
          onDone={() => {
            setReschedOpen(false);
            onReagendado?.();
          }}
        />
      )}
    </>
  );
}
