import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export type Periodo = { inicio: string; fim: string };

export function defaultPeriodo(): Periodo {
  const fim = new Date();
  const inicio = new Date();
  inicio.setDate(inicio.getDate() - 29);
  return {
    inicio: inicio.toISOString().slice(0, 10),
    fim: fim.toISOString().slice(0, 10),
  };
}

interface Props {
  value: Periodo;
  onChange: (v: Periodo) => void;
}

export function PeriodoFilter({ value, onChange }: Props) {
  const preset = (days: number) => {
    const fim = new Date();
    const inicio = new Date();
    inicio.setDate(inicio.getDate() - (days - 1));
    onChange({ inicio: inicio.toISOString().slice(0, 10), fim: fim.toISOString().slice(0, 10) });
  };
  return (
    <div className="flex flex-wrap items-end gap-2">
      <div>
        <Label className="text-xs">De</Label>
        <Input type="date" value={value.inicio} onChange={(e) => onChange({ ...value, inicio: e.target.value })} className="h-9" />
      </div>
      <div>
        <Label className="text-xs">Até</Label>
        <Input type="date" value={value.fim} onChange={(e) => onChange({ ...value, fim: e.target.value })} className="h-9" />
      </div>
      <div className="flex gap-1">
        <Button size="sm" variant="outline" onClick={() => preset(7)}>7d</Button>
        <Button size="sm" variant="outline" onClick={() => preset(30)}>30d</Button>
        <Button size="sm" variant="outline" onClick={() => preset(90)}>90d</Button>
      </div>
    </div>
  );
}
