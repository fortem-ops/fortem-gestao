import type { Tables } from "@/integrations/supabase/types";
import { Button } from "@/components/ui/button";
import { Plus, Copy, Archive } from "lucide-react";

const mockWorkouts = [
  { id: '1', version: 3, date: '2026-03-28', author: 'Prof. Carlos', current: true, description: 'Treino A - Superior / Treino B - Inferior' },
  { id: '2', version: 2, date: '2026-01-15', author: 'Prof. Carlos', current: false, description: 'Treino Full Body' },
  { id: '3', version: 1, date: '2025-11-01', author: 'Prof. Marina', current: false, description: 'Adaptação inicial' },
];

export function StudentWorkouts({ student }: { student: Tables<"alunos"> }) {
  return (
    <div className="space-y-4 mt-4">
      <div className="flex items-center justify-between">
        <h3 className="font-heading font-semibold text-foreground">Treinos</h3>
        <div className="flex gap-2">
          <Button size="sm" variant="outline"><Copy className="w-3 h-3 mr-1" /> Duplicar</Button>
          <Button size="sm"><Plus className="w-3 h-3 mr-1" /> Novo Treino</Button>
        </div>
      </div>

      <div className="space-y-3">
        {mockWorkouts.map(w => (
          <div key={w.id} className={`glass-card rounded-lg p-4 ${w.current ? 'border-primary/50' : ''}`}>
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-foreground">{w.description}</span>
                  {w.current && <span className="px-2 py-0.5 text-xs rounded-full bg-primary/15 text-primary border border-primary/30">Atual</span>}
                </div>
                <p className="text-xs text-muted-foreground mt-1">v{w.version} · {w.date} · {w.author}</p>
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="ghost"><Archive className="w-3 h-3" /></Button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
