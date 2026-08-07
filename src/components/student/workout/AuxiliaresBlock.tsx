import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Trash2 } from "lucide-react";
import { ExerciseSelector } from "@/components/student/workout/ExerciseSelector";
import { CATEGORY_LABELS } from "@/components/student/workout/workoutTemplates";
import { SUBCATEGORIA_TO_CODE } from "@/lib/exerciseMapping";
import type { ExerciseCategory } from "@/hooks/useExerciseCategories";

/** Item auxiliar — mesmo shape do `Auxiliar531`/`PSAuxiliar`. */
export interface AuxiliarItem {
  categoria: string;
  exercicio: string;
  exercicio_id?: string | null;
  video_url?: string | null;
  series: number;
  reps: string;
  kg?: string;
}

export function CategoriaSelectForca({
  value,
  onChange,
  groups,
}: {
  value: string;
  onChange: (v: string) => void;
  groups: ExerciseCategory[];
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="h-8 text-xs">
        <SelectValue placeholder="Categoria" />
      </SelectTrigger>
      <SelectContent className="max-h-80">
        {groups.map((g) => (
          <SelectGroup key={g.name}>
            <SelectLabel className="text-[10px] uppercase tracking-wider text-muted-foreground">
              {g.name}
            </SelectLabel>
            {g.subcategories.map((sub) => {
              const code = SUBCATEGORIA_TO_CODE[sub];
              const itemValue = code ?? sub;
              const display = code ? `${code} — ${CATEGORY_LABELS[code] ?? sub}` : sub;
              return (
                <SelectItem key={itemValue} value={itemValue} className="text-xs">
                  {display}
                </SelectItem>
              );
            })}
          </SelectGroup>
        ))}
      </SelectContent>
    </Select>
  );
}

interface Props {
  title?: string;
  emptyLabel?: string;
  itens: AuxiliarItem[];
  categorias: ExerciseCategory[];
  onAdd: () => void;
  onUpdate: (idx: number, patch: Partial<AuxiliarItem>) => void;
  onRemove: (idx: number) => void;
}

/** Lista de auxiliares (categoria + exercício + séries/reps/kg), padrão 5-3-1. */
export function AuxiliaresBlock({
  title = "Auxiliares",
  emptyLabel = "Sem auxiliares.",
  itens,
  categorias,
  onAdd,
  onUpdate,
  onRemove,
}: Props) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">{title}</h3>
        <Button variant="outline" size="sm" onClick={onAdd}>
          <Plus className="w-3.5 h-3.5 mr-1" /> Auxiliar
        </Button>
      </div>
      {itens.length === 0 && <p className="text-xs text-muted-foreground">{emptyLabel}</p>}
      {itens.map((aux, idx) => (
        <div key={idx} className="grid grid-cols-[160px_1fr_70px_80px_90px_auto] gap-2 items-end">
          <div>
            <Label className="text-xs">Categoria</Label>
            <CategoriaSelectForca
              value={aux.categoria}
              groups={categorias}
              onChange={(v) =>
                onUpdate(idx, {
                  categoria: v,
                  exercicio: "",
                  exercicio_id: null,
                  video_url: null,
                })
              }
            />
          </div>
          <div>
            <Label className="text-xs">Exercício</Label>
            <div className="border border-input rounded-md">
              <ExerciseSelector
                categoria={aux.categoria || "DJS"}
                value={aux.exercicio}
                disabled={!aux.categoria}
                placeholder={aux.categoria ? "Buscar exercício..." : "Escolha a categoria"}
                onChange={(val, video) => onUpdate(idx, { exercicio: val, video_url: video })}
              />
            </div>
          </div>
          <div>
            <Label className="text-xs">Séries</Label>
            <Input
              type="number"
              className="h-8"
              value={aux.series}
              onChange={(e) => onUpdate(idx, { series: Number(e.target.value) || 0 })}
            />
          </div>
          <div>
            <Label className="text-xs">Reps</Label>
            <Input
              className="h-8"
              value={aux.reps}
              onChange={(e) => onUpdate(idx, { reps: e.target.value })}
            />
          </div>
          <div>
            <Label className="text-xs">Kg</Label>
            <Input
              className="h-8"
              value={aux.kg ?? ""}
              onChange={(e) => onUpdate(idx, { kg: e.target.value })}
            />
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-destructive"
            onClick={() => onRemove(idx)}
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      ))}
    </div>
  );
}
