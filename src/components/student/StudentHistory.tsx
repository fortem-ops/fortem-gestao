import type { Tables } from "@/integrations/supabase/types";
import { MessageSquare, Stethoscope, Phone, BookOpen } from "lucide-react";

const mockHistory = [
  { id: '1', date: '2026-04-10', author: 'Prof. Carlos', category: 'observação', text: 'Aluna relatou dor leve no ombro esquerdo durante supino. Reduzimos carga e ajustamos amplitude.' },
  { id: '2', date: '2026-03-25', author: 'Nutri. Juliana', category: 'orientação', text: 'Ajuste no plano alimentar: aumentar proteína para 1.8g/kg visando hipertrofia.' },
  { id: '3', date: '2026-03-15', author: 'Fisio. Rafael', category: 'intervenção', text: 'Realizado liberação miofascial em quadríceps e banda iliotibial. Recomendado alongamento diário.' },
  { id: '4', date: '2026-03-01', author: 'Prof. Carlos', category: 'contato', text: 'Ligação para verificar adaptação ao novo treino. Aluna satisfeita com progressão.' },
];

const categoryIcon: Record<string, React.ElementType> = {
  observação: MessageSquare,
  orientação: BookOpen,
  intervenção: Stethoscope,
  contato: Phone,
};

const categoryColor: Record<string, string> = {
  observação: 'text-info',
  orientação: 'text-primary',
  intervenção: 'text-warning',
  contato: 'text-muted-foreground',
};

export function StudentHistory({ student }: { student: Tables<"alunos"> }) {
  return (
    <div className="space-y-4 mt-4">
      <h3 className="font-heading font-semibold text-foreground">Histórico Técnico</h3>
      <div className="relative">
        <div className="absolute left-4 top-0 bottom-0 w-px bg-border" />
        <div className="space-y-4">
          {mockHistory.map(entry => {
            const Icon = categoryIcon[entry.category] || MessageSquare;
            return (
              <div key={entry.id} className="relative pl-10">
                <div className={`absolute left-2.5 top-1 w-3 h-3 rounded-full border-2 border-background bg-muted`} />
                <div className="glass-card rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-1">
                    <Icon className={`w-3 h-3 ${categoryColor[entry.category]}`} />
                    <span className="text-xs font-medium text-foreground capitalize">{entry.category}</span>
                    <span className="text-xs text-muted-foreground">· {entry.date} · {entry.author}</span>
                  </div>
                  <p className="text-sm text-muted-foreground">{entry.text}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
