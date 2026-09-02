import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { format, parseISO } from "date-fns";
import { AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

interface Props {
  value: string;
  titulo: string;
  descricao?: string;
  icon: LucideIcon;
  /** Data ISO da última avaliação desta categoria (null = sem dado). */
  ultimaData: string | null;
  children: ReactNode;
}

export function CategoriaCard({ value, titulo, descricao, icon: Icon, ultimaData, children }: Props) {
  return (
    <AccordionItem
      value={value}
      className="bio-card border border-[hsl(var(--bio-line))] overflow-hidden data-[state=open]:shadow-sm"
    >
      <AccordionTrigger className="px-4 py-3 hover:no-underline">
        <div className="flex flex-1 items-center justify-between gap-3 pr-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="p-2 rounded-md bg-rose-500/10 border border-rose-500/30 shrink-0">
              <Icon className="w-4 h-4 text-rose-600" />
            </div>
            <div className="min-w-0 text-left">
              <p className="bio-heading text-sm text-[hsl(var(--bio-ink))]">{titulo}</p>
              {descricao && (
                <p className="text-xs text-[hsl(var(--bio-ink-muted))] truncate">{descricao}</p>
              )}
            </div>
          </div>
          <div className="text-right shrink-0">
            <p
              className={`text-sm font-semibold ${
                ultimaData ? "text-[hsl(var(--bio-ink))]" : "text-[hsl(var(--bio-ink-faint))]"
              }`}
            >
              {ultimaData ? `Última: ${format(parseISO(ultimaData), "dd/MM/yyyy")}` : "Sem dado"}
            </p>
          </div>
        </div>
      </AccordionTrigger>
      <AccordionContent className="px-4 pb-4 pt-1 border-t border-[hsl(var(--bio-line))]">
        <div className="pt-4">{children}</div>
      </AccordionContent>
    </AccordionItem>
  );
}
