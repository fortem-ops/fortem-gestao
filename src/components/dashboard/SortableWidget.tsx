import { ReactNode } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  id: string;
  editing: boolean;
  children: ReactNode;
}

export function SortableWidget({ id, editing, children }: Props) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
    disabled: !editing,
  });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} className={cn("relative", editing && "min-w-0")}>
      {editing && (
        <button
          type="button"
          aria-label="Arrastar widget"
          className={cn(
            "absolute -top-2 -left-2 z-20 flex h-7 w-7 items-center justify-center rounded-md border border-primary/40 bg-background shadow-sm",
            "cursor-grab active:cursor-grabbing hover:bg-primary/10"
          )}
          {...attributes}
          {...listeners}
        >
          <GripVertical className="h-4 w-4 text-primary" />
        </button>
      )}
      <div className={cn(editing && "rounded-lg ring-2 ring-dashed ring-primary/30 ring-offset-2 ring-offset-background")}>
        {children}
      </div>
    </div>
  );
}
