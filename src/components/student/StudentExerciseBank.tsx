import { useState } from "react";
import { ChevronRight, ChevronLeft, Dumbbell } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface Category {
  name: string;
  subcategories: string[];
}

const CATEGORIES: Category[] = [
  {
    name: "Liberação Miofascial",
    subcategories: [
      "Pé/Tornozelo", "Perna", "Joelho/Coxa", "Quadril",
      "Lombar", "Torácica", "Ombro/Escápula", "Cervical", "Cotovelo/Punho",
    ],
  },
  {
    name: "Mobilidade Articular",
    subcategories: [
      "Pé/Tornozelo", "Joelho", "Quadril", "Quadril RE", "Quadril RI",
      "Flexibilidade Posterior MI", "Flexibilidade Anterior MI",
      "Torácica", "Torácica Rotação", "Glenoumeral", "Glenoumeral RE",
      "Glenoumeral RI", "Cotovelo/Punho", "Padrão Geral",
    ],
  },
  {
    name: "Ativação Muscular",
    subcategories: [
      "Pé/Tornozelo", "Perna", "Estabilidade de Joelho", "Quadril",
      "Estabilidade Lombar PA", "Estabilidade Lombar PP", "Torácica",
      "Ombro/Escápula", "Cotovelo/Punho", "Padrão Geral",
      "Estabilidade Escapular", "Desassociação Lombar/Quadril",
      "Extensão Torácica", "Kettlebell", "Barra", "LPO",
      "Pliométrico", "Coordenativo Corrida", "Solo",
    ],
  },
  {
    name: "Preventivo",
    subcategories: [
      "Tornozelo", "Joelho", "Quadril-Glúteos", "Quadril-Isquios",
      "Quadril-Flexores", "Cotovelo", "Ombro",
    ],
  },
  {
    name: "Força",
    subcategories: [],
  },
  {
    name: "Cardio",
    subcategories: [],
  },
];

export function StudentExerciseBank() {
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);

  if (selectedCategory) {
    return (
      <div className="space-y-4 mt-4 animate-fade-in">
        <button
          onClick={() => setSelectedCategory(null)}
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
          Voltar às categorias
        </button>

        <h3 className="text-lg font-heading font-bold text-foreground">
          {selectedCategory.name}
        </h3>

        {selectedCategory.subcategories.length === 0 ? (
          <div className="glass-card rounded-lg p-6 text-center">
            <p className="text-sm text-muted-foreground">Nenhuma subcategoria cadastrada</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {selectedCategory.subcategories.map((sub) => (
              <div
                key={sub}
                className="glass-card rounded-lg p-4 flex items-center gap-3 hover:border-primary/40 transition-colors cursor-pointer"
              >
                <div className="w-8 h-8 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
                  <Dumbbell className="w-4 h-4 text-primary" />
                </div>
                <span className="text-sm font-medium text-foreground">{sub}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4 mt-4 animate-fade-in">
      <h3 className="text-lg font-heading font-bold text-foreground">Banco de Exercícios</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {CATEGORIES.map((cat) => (
          <button
            key={cat.name}
            onClick={() => setSelectedCategory(cat)}
            className="glass-card rounded-lg p-4 flex items-center justify-between gap-3 hover:border-primary/40 transition-colors text-left w-full"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
                <Dumbbell className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">{cat.name}</p>
                <p className="text-xs text-muted-foreground">
                  {cat.subcategories.length > 0
                    ? `${cat.subcategories.length} subcategorias`
                    : "Em breve"}
                </p>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-muted-foreground" />
          </button>
        ))}
      </div>
    </div>
  );
}
