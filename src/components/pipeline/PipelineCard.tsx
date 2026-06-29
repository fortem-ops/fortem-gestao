import { useState } from "react";
import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { User, Clock, CalendarPlus, CheckCircle2, XCircle, RefreshCw, Bell, Ban } from "lucide-react";
import {
  formatDaysAgo, type NextTaskInfo, type Funnel,
  PLANO_BADGE_CLASSES, computeTemperature, TEMP_DOT_CLASS, TEMP_DOT_LABEL,
  formatCurrencyBRL, formatNextAction,
} from "@/lib/pipeline";
import { ScheduleTaskDialog } from "./ScheduleTaskDialog";
import { ConvertToAlunoDialog } from "./ConvertToAlunoDialog";
import { MarkLostDialog } from "./MarkLostDialog";
import { cn } from "@/lib/utils";

export interface PipelineCardData {
  id: string;
  nome: string;
  foto_url: string | null;
  responsavel_id?: string | null;
  responsavel_nome?: string | null;
  motivo_perda?: string | null;
  current_stage_name?: string;
  current_stage_probabilidade?: number | null;
  current_funnel?: Funnel;
  meta?: {
    plano_interesse?: string | null;
    temperatura_lead?: string | null;
    valor_estimado_plano?: number | null;
    origem_lead?: string | null;
    last_contact_at?: string | null;
    updated_at?: string | null;
  };
  last_moved_at?: string | null;
  next_task?: NextTaskInfo | null;
}

interface Props {
  student: PipelineCardData;
  draggable?: boolean;
  onOpen?: (student: PipelineCardData) => void;
}

export function PipelineCard({ student, draggable = true, onOpen }: Props) {
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [convertOpen, setConvertOpen] = useState(false);
  const [renewOpen, setRenewOpen] = useState(false);
  const [lostOpen, setLostOpen] = useState(false);
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: student.id,
    disabled: !draggable,
    data: { aluno: student },
  });

  const style = transform ? { transform: CSS.Translate.toString(transform) } : undefined;
  const initials = student.nome.split(" ").slice(0, 2).map((s) => s[0]).join("").toUpperCase();

  // Temperatura calculada: maior data entre meta.last_contact_at, meta.updated_at e last_moved_at
  const activityCandidates = [student.meta?.last_contact_at, student.meta?.updated_at, student.last_moved_at]
    .filter(Boolean) as string[];
  const lastActivity = activityCandidates.length
    ? new Date(Math.max(...activityCandidates.map((d) => new Date(d).getTime()))).toISOString()
    : null;
  const temp = computeTemperature(lastActivity);

  const stageName = student.current_stage_name;
  const probabilidade = student.current_stage_probabilidade ?? 0;
  const isLostCard = stageName === "Aluno perdido" || stageName === "Aluno inativo";
  const showConvert = stageName === "Follow Up";
  const showRenew = stageName === "Renovação de plano";
  const showLost = stageName === "Follow Up" || stageName === "Renovação de plano" || stageName === "Risco de evasão";
  const lostDest = student.current_funnel === "aluno" ? "Aluno inativo" : "Aluno perdido";

  const valor = Number(student.meta?.valor_estimado_plano || 0);

  return (
    <>
      <div
        ref={setNodeRef}
        style={style}
        {...attributes}
        {...listeners}
        onClick={(e) => {
          if (!isDragging) {
            e.stopPropagation();
            onOpen?.(student);
          }
        }}
        className={cn(
          "group relative rounded-lg border border-border bg-card p-3 cursor-grab active:cursor-grabbing hover:border-primary/40 transition-colors overflow-hidden",
          isDragging && "opacity-50 shadow-xl ring-2 ring-primary/50",
        )}
      >
        {/* Dot temperatura no topo direito */}
        <TooltipProvider delayDuration={200}>
          <Tooltip>
            <TooltipTrigger asChild>
              <div className={cn("absolute top-2 right-2 w-2 h-2 rounded-full", TEMP_DOT_CLASS[temp])} />
            </TooltipTrigger>
            <TooltipContent side="left">{TEMP_DOT_LABEL[temp]}</TooltipContent>
          </Tooltip>
        </TooltipProvider>

        <div className="flex items-start gap-2 pr-3">
          <Avatar className="h-8 w-8 shrink-0">
            {student.foto_url && <AvatarImage src={student.foto_url} alt={student.nome} />}
            <AvatarFallback className="text-[10px]">{initials}</AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-foreground truncate">{student.nome}</p>
            {student.responsavel_nome && (
              <p className="text-[11px] text-muted-foreground truncate flex items-center gap-1">
                <User className="w-3 h-3" /> {student.responsavel_nome}
              </p>
            )}
          </div>
          <Button
            size="icon"
            variant="ghost"
            className="h-6 w-6 shrink-0 opacity-60 hover:opacity-100"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => { e.stopPropagation(); setScheduleOpen(true); }}
            title="Agendar tarefa"
          >
            <CalendarPlus className="w-3.5 h-3.5" />
          </Button>
        </div>

        {/* Plano + valor */}
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          {student.meta?.plano_interesse && PLANO_BADGE_CLASSES[student.meta.plano_interesse] && (
            <Badge variant="outline" className={cn("text-[10px] px-1.5 py-0", PLANO_BADGE_CLASSES[student.meta.plano_interesse])}>
              {student.meta.plano_interesse}
            </Badge>
          )}
          {valor > 0 && (
            <span className="text-[11px] font-semibold text-emerald-300 tabular-nums">
              {formatCurrencyBRL(valor)}<span className="text-muted-foreground font-normal">/mês</span>
            </span>
          )}
          {student.last_moved_at && (
            <span className="text-[10px] text-muted-foreground flex items-center gap-1 ml-auto">
              <Clock className="w-3 h-3" />
              {formatDaysAgo(student.last_moved_at)}
            </span>
          )}
        </div>

        {/* Origem */}
        {student.meta?.origem_lead && (
          <p className="mt-1.5 text-[10px] text-muted-foreground truncate">
            Origem: <span className="text-foreground/80">{student.meta.origem_lead}</span>
          </p>
        )}

        {/* Próxima ação */}
        {student.next_task && (
          <div className="mt-2 flex items-center gap-1.5 rounded-md bg-muted/40 px-2 py-1">
            <Bell className="w-3 h-3 text-primary shrink-0" />
            <span className="text-[10.5px] text-foreground/90 truncate">
              {formatNextAction(student.next_task.titulo, student.next_task.data_limite)}
            </span>
          </div>
        )}

        {/* Motivo de perda */}
        {isLostCard && student.motivo_perda && (
          <div className="mt-2 flex items-center gap-1.5 rounded-md border border-rose-500/30 bg-rose-500/10 px-2 py-1">
            <Ban className="w-3 h-3 text-rose-300 shrink-0" />
            <span className="text-[10.5px] text-rose-200 truncate">Perdido: {student.motivo_perda}</span>
          </div>
        )}

        {/* Barra de probabilidade */}
        {!isLostCard && (
          <div className="mt-2.5">
            <div className="flex items-center justify-between text-[9.5px] text-muted-foreground mb-0.5">
              <span>Probabilidade</span>
              <span className="tabular-nums text-foreground/80 font-medium">{probabilidade}%</span>
            </div>
            <Progress value={probabilidade} className="h-1" />
          </div>
        )}

        {(showConvert || showRenew || showLost) && (
          <div className="mt-2 flex flex-wrap gap-1.5 pt-2 border-t border-border/50">
            {showConvert && (
              <Button
                size="sm"
                variant="outline"
                className="h-6 px-2 text-[10px] gap-1 border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/10"
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => { e.stopPropagation(); setConvertOpen(true); }}
              >
                <CheckCircle2 className="w-3 h-3" /> Conversão
              </Button>
            )}
            {showRenew && (
              <Button
                size="sm"
                variant="outline"
                className="h-6 px-2 text-[10px] gap-1 border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/10"
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => { e.stopPropagation(); setRenewOpen(true); }}
              >
                <RefreshCw className="w-3 h-3" /> Ganho
              </Button>
            )}
            {showLost && (
              <Button
                size="sm"
                variant="outline"
                className="h-6 px-2 text-[10px] gap-1 border-rose-500/40 text-rose-300 hover:bg-rose-500/10"
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => { e.stopPropagation(); setLostOpen(true); }}
              >
                <XCircle className="w-3 h-3" /> Perdido
              </Button>
            )}
          </div>
        )}
      </div>

      {scheduleOpen && (
        <ScheduleTaskDialog
          open={scheduleOpen}
          onOpenChange={setScheduleOpen}
          alunoId={student.id}
          alunoNome={student.nome}
          responsavelId={student.responsavel_id || null}
        />
      )}
      {convertOpen && (
        <ConvertToAlunoDialog
          open={convertOpen}
          onOpenChange={setConvertOpen}
          alunoId={student.id}
          alunoNome={student.nome}
          fullConvert={true}
          destinoStage="Aluno ativo"
        />
      )}
      {renewOpen && (
        <ConvertToAlunoDialog
          open={renewOpen}
          onOpenChange={setRenewOpen}
          alunoId={student.id}
          alunoNome={student.nome}
          fullConvert={false}
          destinoStage="Aluno ativo"
          title={`Renovar plano de ${student.nome}`}
        />
      )}
      {lostOpen && (
        <MarkLostDialog
          open={lostOpen}
          onOpenChange={setLostOpen}
          alunoId={student.id}
          alunoNome={student.nome}
          destinoStage={lostDest}
        />
      )}
    </>
  );
}
