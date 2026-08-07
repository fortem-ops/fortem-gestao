import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Info } from "lucide-react";

/**
 * Balão de orientação didática — explica, em linguagem simples, a decisão
 * que o professor precisa tomar naquele campo.
 */
export function HelpTip({ title, children }: { title?: string; children: React.ReactNode }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label="Ajuda"
          className="inline-flex items-center justify-center text-muted-foreground hover:text-primary transition-colors align-middle"
        >
          <Info className="w-3.5 h-3.5" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-80 text-xs leading-relaxed" align="start">
        {title && <p className="font-semibold mb-1 text-sm">{title}</p>}
        <div className="space-y-1.5 text-muted-foreground">{children}</div>
      </PopoverContent>
    </Popover>
  );
}
