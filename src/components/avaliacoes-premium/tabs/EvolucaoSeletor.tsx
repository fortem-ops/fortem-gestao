import { format, parseISO } from "date-fns";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";

export interface SeletorItem {
  key: string;
  label: string;
}

export interface SeletorGrupo {
  id: string;
  titulo: string;
  itens: SeletorItem[];
}

interface Props {
  dates: string[];
  selectedDates: string[];
  onToggleDate: (date: string) => void;
  onAllDates: () => void;
  onClearDates: () => void;
  grupos: SeletorGrupo[];
  selectedItems: Record<string, boolean>;
  onToggleItem: (key: string) => void;
  onToggleGrupo: (grupoId: string, checked: boolean) => void;
}

export function EvolucaoSeletor({
  dates,
  selectedDates,
  onToggleDate,
  onAllDates,
  onClearDates,
  grupos,
  selectedItems,
  onToggleItem,
  onToggleGrupo,
}: Props) {
  return (
    <div className="bio-card p-5 space-y-5">
      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-3">
          <p className="bio-label">Datas das avaliações</p>
          <Button variant="ghost" size="sm" className="h-6 px-2 text-xs" onClick={onAllDates}>
            Todas
          </Button>
          <Button variant="ghost" size="sm" className="h-6 px-2 text-xs" onClick={onClearDates}>
            Limpar
          </Button>
        </div>
        <div className="flex flex-wrap gap-x-5 gap-y-2">
          {dates.map((d) => (
            <label key={d} className="flex items-center gap-2 text-sm text-[hsl(var(--bio-ink))] cursor-pointer">
              <Checkbox checked={selectedDates.includes(d)} onCheckedChange={() => onToggleDate(d)} />
              {format(parseISO(d), "dd/MM/yyyy")}
            </label>
          ))}
        </div>
      </div>

      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        {grupos.map((g) => {
          const total = g.itens.length;
          const marcados = g.itens.filter((i) => selectedItems[i.key]).length;
          const todos = total > 0 && marcados === total;
          return (
            <div key={g.id} className="space-y-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <Checkbox checked={todos} onCheckedChange={(v) => onToggleGrupo(g.id, !!v)} />
                <span className="bio-label">{g.titulo}</span>
                <span className="text-[11px] text-[hsl(var(--bio-ink-faint))]">
                  {marcados}/{total}
                </span>
              </label>
              <div className="space-y-1 pl-1">
                {g.itens.map((i) => (
                  <label
                    key={i.key}
                    className="flex items-center gap-2 text-sm text-[hsl(var(--bio-ink))] cursor-pointer"
                  >
                    <Checkbox checked={!!selectedItems[i.key]} onCheckedChange={() => onToggleItem(i.key)} />
                    {i.label}
                  </label>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
