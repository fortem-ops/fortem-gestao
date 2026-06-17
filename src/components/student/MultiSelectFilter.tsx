import { useState } from "react";
import { Check, ChevronDown, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export interface MultiSelectOption {
  value: string;
  label: string;
}

interface Props {
  options: MultiSelectOption[];
  value: string[];
  onChange: (value: string[]) => void;
  placeholderAll?: string;
  className?: string;
}

export function MultiSelectFilter({
  options,
  value,
  onChange,
  placeholderAll = "Todos",
  className,
}: Props) {
  const [open, setOpen] = useState(false);
  const toggle = (v: string) => {
    if (value.includes(v)) onChange(value.filter((x) => x !== v));
    else onChange([...value, v]);
  };
  const clear = () => onChange([]);

  const label =
    value.length === 0
      ? placeholderAll
      : value.length === 1
        ? options.find((o) => o.value === value[0])?.label ?? placeholderAll
        : `${value.length} selecionados`;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          className={cn(
            "h-9 w-full justify-between font-normal text-sm",
            value.length === 0 && "text-muted-foreground",
            className,
          )}
        >
          <span className="truncate text-left flex items-center gap-2">
            {label}
            {value.length > 1 && (
              <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">
                {value.length}
              </Badge>
            )}
          </span>
          <ChevronDown className="h-4 w-4 opacity-50 shrink-0" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0 bg-popover" align="start">
        <div className="max-h-64 overflow-y-auto p-1">
          {options.length === 0 && (
            <div className="px-3 py-2 text-xs text-muted-foreground">Sem opções</div>
          )}
          {options.map((opt) => {
            const checked = value.includes(opt.value);
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => toggle(opt.value)}
                className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent text-left"
              >
                <Checkbox checked={checked} className="pointer-events-none" />
                <span className="flex-1 truncate">{opt.label}</span>
                {checked && <Check className="h-3.5 w-3.5 text-primary" />}
              </button>
            );
          })}
        </div>
        {value.length > 0 && (
          <div className="border-t p-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={clear}
              className="w-full h-7 text-xs gap-1 justify-center"
            >
              <X className="h-3 w-3" /> Limpar
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
