// Map workout template category codes to Banco de Exercícios grupo/subcategoria
export const CODE_TO_GRUPO: Record<string, string> = {
  LIB: "Liberação Miofascial",
  MOB: "Mobilidade Articular",
  ATI: "Ativação Muscular",
  PREV: "Preventivo",
  COND: "Cardio",
  DJS: "Força",
  DJA: "Força",
  DQ: "Força",
  DQ_P: "Força",
  PH: "Força",
  PV: "Força",
  EH: "Força",
  EV: "Força",
  EP: "Força",
  EEF: "Força",
  EE: "Força",
  AH: "Força",
  AF: "Força",
  AR: "Força",
};

export const CODE_TO_SUBCATEGORIA: Record<string, string | undefined> = {
  DJS: "Dominante de Joelho Simétrico",
  DJA: "Dominante de Joelhos Assimétrico",
  DQ: "Dominante de Quadril",
  DQ_P: "Dominante de Quadril",
  PH: "Puxar Horizontal",
  PV: "Puxar Vertical",
  EH: "Empurrar Horizontal",
  EV: "Empurrar Vertical",
  EP: "Estabilidade Posterior",
  EEF: "Estabilidade Escapular",
  EE: "Estabilidade Escapular",
  AH: "Anti-Hiperextensão",
  AF: "Anti-flexão",
  AR: "Anti-Rotação",
};

// Subcategorias disponíveis para cada bloco de aquecimento (LIB/MOB/ATI).
// Mantenha sincronizado com CATEGORIES em StudentExerciseBank.tsx.
export const AQUECIMENTO_SUBCATEGORIAS: Record<"LIB" | "MOB" | "ATI", string[]> = {
  LIB: [
    "Pé/Tornozelo", "Perna", "Joelho/Coxa", "Quadril",
    "Lombar", "Torácica", "Ombro/Escápula", "Cervical", "Cotovelo/Punho",
  ],
  MOB: [
    "Pé/Tornozelo", "Joelho", "Quadril", "Quadril RE", "Quadril RI",
    "Flexibilidade Posterior MI", "Flexibilidade Anterior MI",
    "Torácica", "Torácica Rotação", "Glenoumeral", "Glenoumeral RE",
    "Glenoumeral RI", "Cotovelo/Punho", "Padrão Geral",
  ],
  ATI: [
    "Pé/Tornozelo", "Perna", "Estabilidade de Joelho", "Quadril",
    "Estabilidade Lombar PA", "Estabilidade Lombar PP", "Torácica",
    "Ombro/Escápula", "Cotovelo/Punho", "Padrão Geral",
    "Estabilidade Escapular", "Desassociação Lombar/Quadril",
    "Extensão Torácica", "Kettlebell", "Barra", "LPO",
    "Pliométrico", "Coordenativo Corrida", "Solo",
  ],
};
