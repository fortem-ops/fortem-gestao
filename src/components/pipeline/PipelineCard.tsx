import { useNavigate } from "react-router-dom";
import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Flame, User, Clock, DollarSign } from "lucide-react";
import { TEMPERATURE_COLORS, formatDaysAgo } from "@/lib/pipeline";
import { cn } from "@/lib/utils";

export interface PipelineCardData {
  id: string;
  nome: string;
  foto_url: string | null;
  responsavel_nome?: string | null;
  meta?: {
    temperatura_lead?: string | null;
    valor_estimado_plano?: number | null;
    origem_lead?: string | null;
  };
  last_moved_at?: string | null;
}

export function PipelineCard({ student, draggable = true }: { student: PipelineCardData; draggable?: boolean }) {
  const navigate = useNavigate();
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: student.id,
    disabled: !draggable,
    data: { aluno: student },
  });

  const style = transform ? { transform: CSS.Translate.toString(transform) } : undefined;
  const initials = student.nome.split(" ").slice(0, 2).map((s) => s[0]).join("").toUpperCase();

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={(e) => {
        if (!isDragging) {
          e.stopPropagation();
          navigate(`/alunos/${student.id}`);
        }
      }}
      className={cn(
        "group rounded-lg border border-border bg-card p-3 cursor-grab active:cursor-grabbing hover:border-primary/40 transition-colors",
        isDragging && "opacity-50 shadow-xl ring-2 ring-primary/50",
      )}
    >
      <div className="flex items-start gap-2">
        <Avatar className="h-8 w-8 shrink-0">
          {student.foto_url && <AvatarImage src={student.foto_url} alt={student.nome} />}
          <AvatarFallback className="text-[10px]">{initials}</AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-foreground truncate">{student.nome}</p>
          {student.responsavel_nome && (
            <p className="text-[11px] text-muted-foreground truncate flex items-center gap-1">
              <User className="w-3 h-3" /> {student.responsavel_nome}
            </p>
          )}
        </div>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        {student.meta?.temperatura_lead && (
          <Badge variant="outline" className={cn("text-[10px] gap-1 px-1.5 py-0", TEMPERATURE_COLORS[student.meta.temperatura_lead])}>
            <Flame className="w-3 h-3" /> {student.meta.temperatura_lead}
          </Badge>
        )}
        {student.meta?.valor_estimado_plano ? (
          <Badge variant="outline" className="text-[10px] gap-1 px-1.5 py-0">
            <DollarSign className="w-3 h-3" />
            {student.meta.valor_estimado_plano.toLocaleString("pt-BR", { minimumFractionDigits: 0 })}
          </Badge>
        ) : null}
        {student.last_moved_at && (
          <span className="text-[10px] text-muted-foreground flex items-center gap-1 ml-auto">
            <Clock className="w-3 h-3" />
            {formatDaysAgo(student.last_moved_at)}
          </span>
        )}
      </div>

      {student.meta?.origem_lead && (
        <p className="mt-1.5 text-[10px] text-muted-foreground truncate">
          Origem: {student.meta.origem_lead}
        </p>
      )}
    </div>
  );
}
