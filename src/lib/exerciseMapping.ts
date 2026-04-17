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
  PH: "Força",
  PV: "Força",
  EH: "Força",
  EV: "Força",
  EP: "Força",
  AH: "Força",
  AF: "Força",
  AR: "Força",
};

export const CODE_TO_SUBCATEGORIA: Record<string, string | undefined> = {
  DJS: "Dominante de Joelho Simétrico",
  DJA: "Dominante de Joelhos Assimétrico",
  DQ: "Dominante de Quadril",
  PH: "Puxar Horizontal",
  PV: "Puxar Vertical",
  EH: "Empurrar Horizontal",
  EV: "Empurrar Vertical",
  EP: "Estabilidade Posterior",
  AH: "Anti-Hiperextensão",
  AF: "Anti-flexão",
  AR: "Anti-Rotação",
};
