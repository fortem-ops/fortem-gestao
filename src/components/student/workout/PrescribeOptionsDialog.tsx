import { useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarIcon } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export type PrescribeChoice = { mode: "now" } | { mode: "schedule"; date: Date };

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (choice: PrescribeChoice) => void;
  saving?: boolean;
  title?: string;
  description?: string;
}

export function PrescribeOptionsDialog({
  open,
  onOpenChange,
  onConfirm,
  saving,
  title = "Aplicar treino",
  description = "Escolha quando o treino deve passar a valer para o aluno.",
}: Props) {
  const [mode, setMode] = useState<"now" | "schedule">("now");
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const [date, setDate] = useState<Date | undefined>(tomorrow);

  const confirm = () => {
    if (mode === "schedule") {
      if (!date) return;
      onConfirm({ mode: "schedule", date });
    } else {
      onConfirm({ mode: "now" });
    }
  };

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const minDate = new Date(today);
  minDate.setDate(minDate.getDate() + 1);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <RadioGroup value={mode} onValueChange={(v) => setMode(v as "now" | "schedule")} className="space-y-3">
          <label
            htmlFor="opt-now"
            className={cn(
              "flex items-start gap-3 rounded-lg border p-3 cursor-pointer transition-colors",
              mode === "now" ? "border-primary bg-primary/5" : "border-border hover:border-primary/40",
            )}
          >
            <RadioGroupItem value="now" id="opt-now" className="mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-semibold">Aplicar agora</p>
              <p className="text-xs text-muted-foreground">
                Vira o treino atual imediatamente e arquiva o anterior.
              </p>
            </div>
          </label>

          <label
            htmlFor="opt-schedule"
            className={cn(
              "flex items-start gap-3 rounded-lg border p-3 cursor-pointer transition-colors",
              mode === "schedule" ? "border-primary bg-primary/5" : "border-border hover:border-primary/40",
            )}
          >
            <RadioGroupItem value="schedule" id="opt-schedule" className="mt-0.5" />
            <div className="flex-1 space-y-2">
              <div>
                <p className="text-sm font-semibold">Programar início</p>
                <p className="text-xs text-muted-foreground">
                  Fica como "aguardando" e vira atual automaticamente na data escolhida.
                </p>
              </div>
              {mode === "schedule" && (
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className={cn("w-full justify-start text-left font-normal", !date && "text-muted-foreground")}
                    >
                      <CalendarIcon className="w-4 h-4 mr-2" />
                      {date ? format(date, "PPP", { locale: ptBR }) : "Escolher data"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={date}
                      onSelect={setDate}
                      disabled={(d) => d < minDate}
                      initialFocus
                      locale={ptBR}
                      className={cn("p-3 pointer-events-auto")}
                    />
                  </PopoverContent>
                </Popover>
              )}
            </div>
          </label>
        </RadioGroup>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button
            onClick={confirm}
            disabled={saving || (mode === "schedule" && !date)}
          >
            {saving ? "Salvando..." : mode === "schedule" ? "Programar" : "Aplicar agora"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
