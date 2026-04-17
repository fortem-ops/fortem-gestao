export interface WorkoutExercise {
  ordem: number;
  categoria: string;
  exercicio: string;
  series: number | string;
  repeticoes: string;
  kg?: string;
  dias?: string[]; // T1, T2, T3, T4
}

export interface WorkoutSection {
  nome: string; // e.g. "TREINO 1", "TREINO 2"
  tipo: string; // "aquecimento" | "forca"
  exercicios: WorkoutExercise[];
}

export interface WorkoutTemplate {
  fase: string;
  frequencia: string;
  aquecimento: WorkoutExercise[];
  treinos: WorkoutSection[];
}

const fase1Aquecimento: WorkoutExercise[] = [
  // Liberação (LIB) — todos os dias
  { ordem: 1, categoria: "LIB", exercicio: "Rolinho - Panturrilha", series: 1, repeticoes: '60"', dias: ["T1","T2","T3","T4"] },
  { ordem: 2, categoria: "LIB", exercicio: "Rolinho - Anterior, Posterior, Vasto Lateral e Adutor", series: 1, repeticoes: '60"', dias: ["T1","T2","T3","T4"] },
  { ordem: 3, categoria: "LIB", exercicio: "Rolinho - Quadril (Glúteos)", series: 1, repeticoes: '60"', dias: ["T1","T2","T3","T4"] },
  { ordem: 4, categoria: "LIB", exercicio: "Rolinho - Torácica", series: 1, repeticoes: '60"', dias: ["T1","T2","T3","T4"] },
  // Mobilidade (MOB)
  { ordem: 5, categoria: "MOB", exercicio: "L Tesoura flexão/extensão (pé no chão)", series: 1, repeticoes: "10", dias: ["T2","T4"] },
  { ordem: 6, categoria: "MOB", exercicio: "Gatinho", series: 1, repeticoes: "15", dias: ["T1","T2","T3","T4"] },
  { ordem: 7, categoria: "MOB", exercicio: "Rocking", series: 1, repeticoes: "15", dias: ["T1","T3"] },
  { ordem: 8, categoria: "MOB", exercicio: "Dorsiflexão passiva (na parede)", series: 1, repeticoes: "15", dias: ["T1","T3"] },
  { ordem: 9, categoria: "MOB", exercicio: "Hip Hinge c/ Mãos na Parede", series: 1, repeticoes: "15", dias: ["T2","T4"] },
  // Ativação (ATI)
  { ordem: 10, categoria: "ATI", exercicio: "Prancha Frontal", series: 1, repeticoes: '20"', dias: ["T1","T2","T3","T4"] },
  { ordem: 11, categoria: "ATI", exercicio: "Ponte Bilateral", series: 1, repeticoes: '20"', dias: ["T2","T4"] },
  { ordem: 12, categoria: "ATI", exercicio: "Extensão Torácica no Chão", series: 1, repeticoes: '20"', dias: ["T2","T4"] },
  { ordem: 13, categoria: "ATI", exercicio: "Ativação glúteo c/ band no joelho", series: 1, repeticoes: "20", dias: ["T1","T3"] },
  { ordem: 14, categoria: "ATI", exercicio: "Fazendeiro Simétrico", series: 1, repeticoes: '45"', dias: ["T1","T3"] },
];

const fase1Treino1: WorkoutExercise[] = [
  { ordem: 1, categoria: "DJS", exercicio: "Agachamento com Kettlebell/Halter", series: 3, repeticoes: "10" },
  { ordem: 2, categoria: "PH", exercicio: "Remada no Cabo Unilateral (SAJ)", series: 3, repeticoes: "10" },
  { ordem: 3, categoria: "EP", exercicio: "Flexão de Joelhos na Bola", series: 3, repeticoes: "10" },
  { ordem: 4, categoria: "EV", exercicio: "Press na Mina Terrestre (SAJ)", series: 3, repeticoes: "10" },
  { ordem: 5, categoria: "AH", exercicio: "Dead Bug Alternado", series: 3, repeticoes: "20" },
];

const fase1Treino2: WorkoutExercise[] = [
  { ordem: 1, categoria: "DQ", exercicio: "Levantamento Terra com Kettlebell", series: 3, repeticoes: "10" },
  { ordem: 2, categoria: "EH", exercicio: "Supino no Rolo com Halteres", series: 3, repeticoes: "10" },
  { ordem: 3, categoria: "DJA", exercicio: "Step Up / Step Down Lateral", series: 3, repeticoes: "10" },
  { ordem: 4, categoria: "PV", exercicio: "Face Pull (SAJ)", series: 3, repeticoes: "10" },
  { ordem: 5, categoria: "AF", exercicio: "Prancha Lateral", series: 3, repeticoes: '30"' },
];

const fase1Treino3: WorkoutExercise[] = [
  { ordem: 1, categoria: "DJS", exercicio: "Agachamento com Kettlebell/Halter", series: 3, repeticoes: "10" },
  { ordem: 2, categoria: "PH", exercicio: "Remada no Cabo Bilateral (SAJ)", series: 3, repeticoes: "10" },
  { ordem: 3, categoria: "DQ", exercicio: "Elevação de Quadril no Solo/Step", series: 3, repeticoes: "15" },
  { ordem: 4, categoria: "EV", exercicio: "Press Unilateral (AJ)", series: 3, repeticoes: "10" },
  { ordem: 5, categoria: "AH", exercicio: "Prancha na Bola", series: 3, repeticoes: '30"' },
];

const fase1Treino4: WorkoutExercise[] = [
  { ordem: 1, categoria: "DQ", exercicio: "Levantamento Terra com Kettlebell", series: 3, repeticoes: "10" },
  { ordem: 2, categoria: "EH", exercicio: "Apoio", series: 3, repeticoes: "10" },
  { ordem: 3, categoria: "DJA", exercicio: "Passada Reversa", series: 3, repeticoes: "10" },
  { ordem: 4, categoria: "PV", exercicio: "Face Pull (SAJ)", series: 3, repeticoes: "10" },
  { ordem: 5, categoria: "AR", exercicio: "Estabilidade Lateral - (AJ)", series: 3, repeticoes: "10" },
];

// =================== FASE 2 ===================
const fase2Aquecimento: WorkoutExercise[] = [
  { ordem: 1, categoria: "LIB", exercicio: "01. Rolinho - panturrilha", series: 1, repeticoes: '60"', dias: ["T1","T2","T3","T4"] },
  { ordem: 2, categoria: "LIB", exercicio: "01. Rolinho - anterior, posterior, vasto lateral e adutor", series: 1, repeticoes: '60"', dias: ["T1","T2","T3","T4"] },
  { ordem: 3, categoria: "LIB", exercicio: "01. Rolinho - quadril (glúteos)", series: 1, repeticoes: '60"', dias: ["T1","T2","T3","T4"] },
  { ordem: 4, categoria: "LIB", exercicio: "01. Rolinho - torácica", series: 1, repeticoes: '60"', dias: ["T1","T2","T3","T4"] },
  { ordem: 5, categoria: "LIB", exercicio: "06. Alongamento posterior c/ superband", series: 1, repeticoes: '60"', dias: ["T2","T4"] },
  { ordem: 6, categoria: "MOB", exercicio: "04. Extensão e flexão torácica (em rocking)", series: 1, repeticoes: "15", dias: ["T1","T2","T3","T4"] },
  { ordem: 7, categoria: "MOB", exercicio: "05. 90/90 RE/RI (sem giro do tronco)", series: 1, repeticoes: "20", dias: ["T1","T3"] },
  { ordem: 8, categoria: "MOB", exercicio: "02. L Tesoura flexão/extensão (perna no chão)", series: 1, repeticoes: "15", dias: ["T2","T4"] },
  { ordem: 9, categoria: "MOB", exercicio: "03. Dorsiflexão passiva c/ step", series: 1, repeticoes: "15", dias: ["T1","T3"] },
  { ordem: 10, categoria: "MOB", exercicio: "01. Flexão e extensão de ombro c/ bastão (SM)", series: 1, repeticoes: "15", dias: ["T2","T4"] },
  { ordem: 11, categoria: "ATI", exercicio: "05- Dead bug alternado", series: 1, repeticoes: "20", dias: ["T1","T2","T3","T4"] },
  { ordem: 12, categoria: "ATI", exercicio: "02- Ponte unilateral c/ perna flexionada", series: 1, repeticoes: '30"', dias: ["T2","T4"] },
  { ordem: 13, categoria: "ATI", exercicio: "01- Rotação externa de ombro c/ elástico", series: 1, repeticoes: "20", dias: ["T1","T2","T3","T4"] },
  { ordem: 14, categoria: "ATI", exercicio: "03- Deslocamento lateral c/ band no joelho", series: 1, repeticoes: "20", dias: ["T1","T3"] },
  { ordem: 15, categoria: "ATI", exercicio: "02- Pêndulo", series: 2, repeticoes: "8", dias: ["T2","T4"] },
];

const fase2Treino1: WorkoutExercise[] = [
  { ordem: 1, categoria: "DJS", exercicio: "2- Agachamento com 2 Kettlebell's/Halteres", series: 3, repeticoes: "10" },
  { ordem: 2, categoria: "PH", exercicio: "4- Remada no TRX", series: 3, repeticoes: "10" },
  { ordem: 3, categoria: "EP", exercicio: "2- Flexão de Joelhos no Slide", series: 3, repeticoes: "10" },
  { ordem: 4, categoria: "EV", exercicio: "3- Press Unilateral (SAJ)", series: 3, repeticoes: "10" },
  { ordem: 5, categoria: "EEF", exercicio: "2- Fazendeiro Assimétrico", series: 3, repeticoes: '45"' },
];

const fase2Treino2: WorkoutExercise[] = [
  { ordem: 1, categoria: "DQ", exercicio: "6- Levantamento Terra com Barra Hexagonal", series: 3, repeticoes: "10" },
  { ordem: 2, categoria: "EH", exercicio: "2- Supino Bilateral com Halteres", series: 3, repeticoes: "10" },
  { ordem: 3, categoria: "DJA", exercicio: "2- Passada Reversa", series: 3, repeticoes: "10" },
  { ordem: 4, categoria: "PV", exercicio: "4- Puxada Inclinada Unilateral (SAJ)", series: 3, repeticoes: "10" },
  { ordem: 5, categoria: "AH", exercicio: "7- Prancha ombro (3 apoios)", series: 3, repeticoes: "20" },
];

const fase2Treino3: WorkoutExercise[] = [
  { ordem: 1, categoria: "DJS", exercicio: "3- Agachamento com Barra Frontal", series: 3, repeticoes: "10" },
  { ordem: 2, categoria: "PH", exercicio: "1- Remada no Cabo Unilateral (SAJ)", series: 3, repeticoes: "10" },
  { ordem: 3, categoria: "DQ_P", exercicio: "13- Stiff com 2 Kettlebells (sem vídeo)", series: 3, repeticoes: "10" },
  { ordem: 4, categoria: "EV", exercicio: "3- Press Unilateral (SAJ)", series: 3, repeticoes: "10" },
  { ordem: 5, categoria: "AF", exercicio: "1- Prancha Lateral", series: 3, repeticoes: '30"' },
];

const fase2Treino4: WorkoutExercise[] = [
  { ordem: 1, categoria: "DQ", exercicio: "6- Levantamento Terra com Barra Hexagonal", series: 3, repeticoes: "10" },
  { ordem: 2, categoria: "EH", exercicio: "6- Floor Press Unilateral com Halteres", series: 3, repeticoes: "10" },
  { ordem: 3, categoria: "DJA", exercicio: "1- Passada Simples", series: 3, repeticoes: "10" },
  { ordem: 4, categoria: "PV", exercicio: "1- Puxada no Cabo Bilateral (AJ)", series: 3, repeticoes: "10" },
  { ordem: 5, categoria: "AH", exercicio: "3- Dead Bug", series: 3, repeticoes: "15" },
];

// =================== FASE 3 ===================
const fase3Aquecimento: WorkoutExercise[] = [
  { ordem: 1, categoria: "LIB", exercicio: "02. Rolinho - panturrilha ativo", series: 1, repeticoes: '60"', dias: ["T1","T2","T3","T4"] },
  { ordem: 2, categoria: "LIB", exercicio: "01. Rolinho - anterior, posterior, vasto lateral e adutor", series: 1, repeticoes: '60"', dias: ["T1","T2","T3","T4"] },
  { ordem: 3, categoria: "LIB", exercicio: "01. Rolinho - quadril (glúteos)", series: 1, repeticoes: '60"', dias: ["T1","T2","T3","T4"] },
  { ordem: 4, categoria: "LIB", exercicio: "01. Rolinho - torácica", series: 1, repeticoes: '60"', dias: ["T1","T2","T3","T4"] },
  { ordem: 5, categoria: "LIB", exercicio: "07. Alongamento anterior coxa (SAJ)", series: 1, repeticoes: '60"', dias: ["T1","T3"] },
  { ordem: 6, categoria: "MOB", exercicio: "06. 90/90 RE/RI (com giro do tronco)", series: 1, repeticoes: "10", dias: ["T1","T3"] },
  { ordem: 7, categoria: "MOB", exercicio: "06. Rotação torácica c/ cotovelo flexionado (SAJ)", series: 1, repeticoes: "10", dias: ["T2","T4"] },
  { ordem: 8, categoria: "MOB", exercicio: "04. Dorsiflexão passiva c/ step + KTB", series: 1, repeticoes: "15", dias: ["T1","T3"] },
  { ordem: 9, categoria: "MOB", exercicio: "05. Mobilidade torácica e glenoumeral (no banco)", series: 1, repeticoes: "10", dias: ["T2","T4"] },
  { ordem: 10, categoria: "MOB", exercicio: "03. Bom dia c/ bastão (hip hinge)", series: 1, repeticoes: "15", dias: ["T1","T2","T3","T4"] },
  { ordem: 11, categoria: "ATI", exercicio: "02- Prancha na bola", series: 1, repeticoes: '30"', dias: ["T1","T3"] },
  { ordem: 12, categoria: "ATI", exercicio: "03- Ponte unilateral c/ perna estendida", series: 1, repeticoes: '30"', dias: ["T2","T4"] },
  { ordem: 13, categoria: "ATI", exercicio: "01- Rotação externa de ombro c/ elástico", series: 1, repeticoes: "20", dias: ["T1","T2","T3","T4"] },
  { ordem: 14, categoria: "ATI", exercicio: "03- Deslocamento lateral c/ band no joelho", series: 1, repeticoes: "20", dias: ["T1","T3"] },
  { ordem: 15, categoria: "ATI", exercicio: "03- Dead Swing", series: 2, repeticoes: "8", dias: ["T2","T4"] },
];

const fase3Treino1: WorkoutExercise[] = [
  { ordem: 1, categoria: "DJS", exercicio: "4- Agachamento com Barra nas Costas", series: 3, repeticoes: "8" },
  { ordem: 2, categoria: "PH", exercicio: "5- Remada no Cabo Bilateral em Pé (SM)", series: 3, repeticoes: "8" },
  { ordem: 3, categoria: "EP", exercicio: "2- Flexão de Joelhos no Slide", series: 3, repeticoes: "10" },
  { ordem: 4, categoria: "EV", exercicio: "4- Press Unilateral (SM)", series: 3, repeticoes: "10" },
  { ordem: 5, categoria: "AR", exercicio: "5- Cortador (AJ)", series: 3, repeticoes: "10" },
];

const fase3Treino2: WorkoutExercise[] = [
  { ordem: 1, categoria: "DQ", exercicio: "7- Levantamento Terra com Barra Reta", series: 3, repeticoes: "8" },
  { ordem: 2, categoria: "EH", exercicio: "4- Supino", series: 3, repeticoes: "8" },
  { ordem: 3, categoria: "DJA", exercicio: "22- Step Up / Step Down Frontal", series: 3, repeticoes: "10" },
  { ordem: 4, categoria: "PV", exercicio: "1- Puxada no Cabo Bilateral (AJ)", series: 3, repeticoes: "10" },
  { ordem: 5, categoria: "AH", exercicio: "8- Prancha Dinâmica na Bola", series: 3, repeticoes: "10" },
];

const fase3Treino3: WorkoutExercise[] = [
  { ordem: 1, categoria: "DJS", exercicio: "3- Agachamento com Barra Frontal", series: 3, repeticoes: "8" },
  { ordem: 2, categoria: "PH", exercicio: "8- Serrote Unilateral com Apoio", series: 3, repeticoes: "8" },
  { ordem: 3, categoria: "DQ_P", exercicio: "2- Stiff com Barra Reta", series: 3, repeticoes: "10" },
  { ordem: 4, categoria: "EV", exercicio: "4- Press Unilateral (SM)", series: 3, repeticoes: "10" },
  { ordem: 5, categoria: "AR", exercicio: "2- Estabilidade Lateral (SAJ)", series: 3, repeticoes: "10" },
];

const fase3Treino4: WorkoutExercise[] = [
  { ordem: 1, categoria: "DQ", exercicio: "7- Levantamento Terra com Barra Reta", series: 3, repeticoes: "8" },
  { ordem: 2, categoria: "EH", exercicio: "3- Supino Alternado com Halteres", series: 3, repeticoes: "8" },
  { ordem: 3, categoria: "DJA", exercicio: "3- Passada no Slide", series: 3, repeticoes: "10" },
  { ordem: 4, categoria: "PV", exercicio: "3- Puxada no Cabo Unilateral (AJ)", series: 3, repeticoes: "10" },
  { ordem: 5, categoria: "AH", exercicio: "3- Dead Bug", series: 3, repeticoes: "20" },
];

// =================== FASE 4 ===================
const fase4Aquecimento: WorkoutExercise[] = [
  { ordem: 1, categoria: "LIB", exercicio: "03. Rolinho panturrilha - ativo + mov.", series: 1, repeticoes: '60"', dias: ["T1","T2","T3","T4"] },
  { ordem: 2, categoria: "LIB", exercicio: "01. Rolinho - anterior, posterior, vasto lateral e adutor", series: 1, repeticoes: '60"', dias: ["T1","T2","T3","T4"] },
  { ordem: 3, categoria: "LIB", exercicio: "01. Rolinho - quadril (glúteos)", series: 1, repeticoes: '60"', dias: ["T1","T2","T3","T4"] },
  { ordem: 4, categoria: "LIB", exercicio: "01. Rolinho - torácica", series: 1, repeticoes: '60"', dias: ["T1","T2","T3","T4"] },
  { ordem: 5, categoria: "LIB", exercicio: "08. Alongamento anterior coxa + isquiotibiais (SAJ)", series: 1, repeticoes: "10", dias: ["T1","T2","T3","T4"] },
  { ordem: 6, categoria: "MOB", exercicio: "04. Dorsiflexão passiva c/ step + KTB", series: 1, repeticoes: "15", dias: ["T1","T3"] },
  { ordem: 7, categoria: "MOB", exercicio: "04. Rotação externa de quadril 3 apoios (SAJ)", series: 1, repeticoes: "15", dias: ["T2","T4"] },
  { ordem: 8, categoria: "MOB", exercicio: "09. Rotação torácica na parede c/ apoio interno no joelho (SAJ)", series: 1, repeticoes: "15", dias: ["T2","T4"] },
  { ordem: 9, categoria: "MOB", exercicio: "11. Goblet (ênfase na rotação externa do quadril)", series: 1, repeticoes: "10", dias: ["T1","T3"] },
  { ordem: 10, categoria: "MOB", exercicio: "05. Rooftop", series: 1, repeticoes: "10", dias: ["T2","T4"] },
  { ordem: 11, categoria: "ATI", exercicio: "02- 4 apoios (alternando braços)", series: 1, repeticoes: "10", dias: ["T1","T3"] },
  { ordem: 12, categoria: "ATI", exercicio: "04- Ativação muscular do ombro em Y c/ bastão (hip hinge)", series: 1, repeticoes: "10", dias: ["T1","T3"] },
  { ordem: 13, categoria: "ATI", exercicio: "09- Lunge press halter / KTB", series: 1, repeticoes: "10", dias: ["T2","T4"] },
  { ordem: 14, categoria: "ATI", exercicio: "04- Fazendeiro rack / lunge", series: 1, repeticoes: '45"', dias: ["T1","T3"] },
  { ordem: 15, categoria: "ATI", exercicio: "04- Swing", series: 2, repeticoes: "8", dias: ["T2","T4"] },
];

const fase4Treino1: WorkoutExercise[] = [
  { ordem: 1, categoria: "DJS", exercicio: "4- Agachamento com Barra nas Costas", series: 3, repeticoes: "8" },
  { ordem: 2, categoria: "PH", exercicio: "9- Serrote Unilateral sem Apoio", series: 3, repeticoes: "8" },
  { ordem: 3, categoria: "DQ_P", exercicio: "2- Stiff com Barra Reta", series: 3, repeticoes: "10" },
  { ordem: 4, categoria: "EV", exercicio: "6- Press Bilateral Kettlebell/Halter", series: 3, repeticoes: "10" },
  { ordem: 5, categoria: "AR", exercicio: "6- Cortador (SAJ)", series: 3, repeticoes: "10" },
];

const fase4Treino2: WorkoutExercise[] = [
  { ordem: 1, categoria: "DQ", exercicio: "7- Levantamento Terra com Barra Reta", series: 3, repeticoes: "8" },
  { ordem: 2, categoria: "EH", exercicio: "4- Supino", series: 3, repeticoes: "8" },
  { ordem: 3, categoria: "DJA", exercicio: "5- Passada Reversa no Step", series: 3, repeticoes: "10" },
  { ordem: 4, categoria: "PV", exercicio: "3- Puxada no Cabo Unilateral (AJ)", series: 3, repeticoes: "10" },
  { ordem: 5, categoria: "AH", exercicio: "9- Prancha Dinâmica no Slide", series: 3, repeticoes: "10" },
];

const fase4Treino3: WorkoutExercise[] = [
  { ordem: 1, categoria: "DJS", exercicio: "4- Agachamento com Barra nas Costas", series: 3, repeticoes: "8" },
  { ordem: 2, categoria: "PH", exercicio: "11- Remada Curvada com Barra", series: 3, repeticoes: "8" },
  { ordem: 3, categoria: "EP", exercicio: "2- Flexão de Joelhos no Slide", series: 3, repeticoes: "10" },
  { ordem: 4, categoria: "EV", exercicio: "5- See Saw Press", series: 3, repeticoes: "10" },
  { ordem: 5, categoria: "AR", exercicio: "4- Estabilidade Lateral (ASM)", series: 3, repeticoes: "10" },
];

const fase4Treino4: WorkoutExercise[] = [
  { ordem: 1, categoria: "DQ", exercicio: "7- Levantamento Terra com Barra Reta", series: 3, repeticoes: "8" },
  { ordem: 2, categoria: "EH", exercicio: "7- Floor Press com Barra", series: 3, repeticoes: "8" },
  { ordem: 3, categoria: "DJA", exercicio: "3- Passada no Slide", series: 3, repeticoes: "10" },
  { ordem: 4, categoria: "PV", exercicio: "1- Puxada no Cabo Bilateral (AJ)", series: 3, repeticoes: "10" },
  { ordem: 5, categoria: "AF", exercicio: "2- Anti Flexão Lateral com elastico (AJ)", series: 3, repeticoes: "10" },
];

export const CATEGORY_LABELS: Record<string, string> = {
  LIB: "Liberação",
  MOB: "Mobilidade",
  ATI: "Ativação",
  DJS: "Dominante Joelho Simétrico",
  DJA: "Dominante Joelho Assimétrico",
  DQ: "Dominante Quadril",
  DQ_P: "Dominante Quadril Posterior",
  PH: "Puxar Horizontal",
  PV: "Puxar Vertical",
  EH: "Empurrar Horizontal",
  EV: "Empurrar Vertical",
  EP: "Estabilidade Posterior",
  EEF: "Estabilidade Escapular Fazendeiro",
  EE: "Estabilidade Escapular",
  AH: "Anti-Extensão/Estabilidade Horizontal",
  AF: "Anti-Flexão Lateral",
  AR: "Anti-Rotação",
  PREV: "Preventivo",
  COND: "Condicionamento",
};

export const WORKOUT_TEMPLATES: WorkoutTemplate[] = [
  {
    fase: "Fase 1",
    frequencia: "4x",
    aquecimento: fase1Aquecimento,
    treinos: [
      { nome: "Treino 1", tipo: "forca", exercicios: fase1Treino1 },
      { nome: "Treino 2", tipo: "forca", exercicios: fase1Treino2 },
      { nome: "Treino 3", tipo: "forca", exercicios: fase1Treino3 },
      { nome: "Treino 4", tipo: "forca", exercicios: fase1Treino4 },
    ],
  },
  {
    fase: "Fase 2",
    frequencia: "4x",
    aquecimento: fase1Aquecimento,
    treinos: [
      { nome: "Treino 1", tipo: "forca", exercicios: fase2Treino1 },
      { nome: "Treino 2", tipo: "forca", exercicios: fase2Treino2 },
      { nome: "Treino 3", tipo: "forca", exercicios: [...fase2Treino1] },
      { nome: "Treino 4", tipo: "forca", exercicios: [...fase2Treino2] },
    ],
  },
  {
    fase: "Fase 3",
    frequencia: "4x",
    aquecimento: fase1Aquecimento,
    treinos: [
      { nome: "Treino 1", tipo: "forca", exercicios: fase3Treino1 },
      { nome: "Treino 2", tipo: "forca", exercicios: fase3Treino2 },
      { nome: "Treino 3", tipo: "forca", exercicios: [...fase3Treino1] },
      { nome: "Treino 4", tipo: "forca", exercicios: [...fase3Treino2] },
    ],
  },
  {
    fase: "Fase 4",
    frequencia: "4x",
    aquecimento: fase1Aquecimento,
    treinos: [
      { nome: "Treino 1", tipo: "forca", exercicios: fase4Treino1 },
      { nome: "Treino 2", tipo: "forca", exercicios: fase4Treino2 },
      { nome: "Treino 3", tipo: "forca", exercicios: [...fase4Treino1] },
      { nome: "Treino 4", tipo: "forca", exercicios: [...fase4Treino2] },
    ],
  },
  {
    fase: "Personalizado",
    frequencia: "—",
    aquecimento: [],
    treinos: [
      { nome: "Treino 1", tipo: "forca", exercicios: [{ ordem: 1, categoria: "", exercicio: "", series: 3, repeticoes: "10" }] },
    ],
  },
  {
    fase: "Planilha 5RM",
    frequencia: "3x",
    aquecimento: fase1Aquecimento,
    treinos: [
      { nome: "Treino A", tipo: "forca", exercicios: [
        { ordem: 1, categoria: "DJS", exercicio: "", series: 5, repeticoes: "5" },
        { ordem: 2, categoria: "PH", exercicio: "", series: 5, repeticoes: "5" },
        { ordem: 3, categoria: "DQ", exercicio: "", series: 5, repeticoes: "5" },
      ]},
      { nome: "Treino B", tipo: "forca", exercicios: [
        { ordem: 1, categoria: "EH", exercicio: "", series: 5, repeticoes: "5" },
        { ordem: 2, categoria: "EV", exercicio: "", series: 5, repeticoes: "5" },
        { ordem: 3, categoria: "EP", exercicio: "", series: 5, repeticoes: "5" },
      ]},
    ],
  },
  {
    fase: "5-3-1",
    frequencia: "4x",
    aquecimento: fase1Aquecimento,
    treinos: [
      { nome: "Treino 1 — Press", tipo: "forca", exercicios: [
        { ordem: 1, categoria: "EV", exercicio: "", series: 3, repeticoes: "5/3/1" },
        { ordem: 2, categoria: "PH", exercicio: "", series: 5, repeticoes: "10" },
        { ordem: 3, categoria: "AH", exercicio: "", series: 3, repeticoes: "20" },
      ]},
      { nome: "Treino 2 — Agachamento", tipo: "forca", exercicios: [
        { ordem: 1, categoria: "DJS", exercicio: "", series: 3, repeticoes: "5/3/1" },
        { ordem: 2, categoria: "EP", exercicio: "", series: 5, repeticoes: "10" },
        { ordem: 3, categoria: "AF", exercicio: "", series: 3, repeticoes: '30"' },
      ]},
      { nome: "Treino 3 — Supino", tipo: "forca", exercicios: [
        { ordem: 1, categoria: "EH", exercicio: "", series: 3, repeticoes: "5/3/1" },
        { ordem: 2, categoria: "PV", exercicio: "", series: 5, repeticoes: "10" },
        { ordem: 3, categoria: "AH", exercicio: "", series: 3, repeticoes: "20" },
      ]},
      { nome: "Treino 4 — Levantamento Terra", tipo: "forca", exercicios: [
        { ordem: 1, categoria: "DQ", exercicio: "", series: 3, repeticoes: "5/3/1" },
        { ordem: 2, categoria: "DJA", exercicio: "", series: 5, repeticoes: "10" },
        { ordem: 3, categoria: "AR", exercicio: "", series: 3, repeticoes: "10" },
      ]},
    ],
  },
  {
    fase: "M102",
    frequencia: "3x",
    aquecimento: fase1Aquecimento,
    treinos: [
      { nome: "Treino A", tipo: "forca", exercicios: [
        { ordem: 1, categoria: "DJS", exercicio: "", series: 4, repeticoes: "8" },
        { ordem: 2, categoria: "PH", exercicio: "", series: 4, repeticoes: "8" },
        { ordem: 3, categoria: "EP", exercicio: "", series: 3, repeticoes: "12" },
        { ordem: 4, categoria: "EV", exercicio: "", series: 3, repeticoes: "10" },
        { ordem: 5, categoria: "AH", exercicio: "", series: 3, repeticoes: "20" },
      ]},
      { nome: "Treino B", tipo: "forca", exercicios: [
        { ordem: 1, categoria: "DQ", exercicio: "", series: 4, repeticoes: "8" },
        { ordem: 2, categoria: "EH", exercicio: "", series: 4, repeticoes: "8" },
        { ordem: 3, categoria: "DJA", exercicio: "", series: 3, repeticoes: "10" },
        { ordem: 4, categoria: "PV", exercicio: "", series: 3, repeticoes: "10" },
        { ordem: 5, categoria: "AF", exercicio: "", series: 3, repeticoes: '30"' },
      ]},
      { nome: "Treino C", tipo: "forca", exercicios: [
        { ordem: 1, categoria: "DJS", exercicio: "", series: 3, repeticoes: "10" },
        { ordem: 2, categoria: "PH", exercicio: "", series: 3, repeticoes: "10" },
        { ordem: 3, categoria: "DQ", exercicio: "", series: 3, repeticoes: "12" },
        { ordem: 4, categoria: "EV", exercicio: "", series: 3, repeticoes: "10" },
        { ordem: 5, categoria: "AR", exercicio: "", series: 3, repeticoes: "10" },
      ]},
    ],
  },
  {
    fase: "Corrida - Fase 1",
    frequencia: "3x",
    aquecimento: [],
    treinos: [
      { nome: "Treino 1", tipo: "forca", exercicios: [
        { ordem: 1, categoria: "COND", exercicio: "Corrida Contínua", series: 1, repeticoes: '20-30min' },
      ]},
      { nome: "Treino 2", tipo: "forca", exercicios: [
        { ordem: 1, categoria: "COND", exercicio: "Corrida Contínua", series: 1, repeticoes: '25-35min' },
      ]},
      { nome: "Treino 3", tipo: "forca", exercicios: [
        { ordem: 1, categoria: "COND", exercicio: "Corrida Contínua", series: 1, repeticoes: '30-40min' },
      ]},
    ],
  },
  {
    fase: "Corrida - Fase 2",
    frequencia: "3x",
    aquecimento: [],
    treinos: [
      { nome: "Treino 1", tipo: "forca", exercicios: [
        { ordem: 1, categoria: "COND", exercicio: "Intervalado", series: "6-8", repeticoes: '2min rápido / 2min lento' },
      ]},
      { nome: "Treino 2", tipo: "forca", exercicios: [
        { ordem: 1, categoria: "COND", exercicio: "Corrida Contínua", series: 1, repeticoes: '35-45min' },
      ]},
      { nome: "Treino 3", tipo: "forca", exercicios: [
        { ordem: 1, categoria: "COND", exercicio: "Tempo Run", series: 1, repeticoes: '20-30min ritmo forte' },
      ]},
    ],
  },
  {
    fase: "Corrida - Fase 3",
    frequencia: "4x",
    aquecimento: [],
    treinos: [
      { nome: "Treino 1", tipo: "forca", exercicios: [
        { ordem: 1, categoria: "COND", exercicio: "Intervalado Curto", series: "8-10", repeticoes: '1min forte / 1min lento' },
      ]},
      { nome: "Treino 2", tipo: "forca", exercicios: [
        { ordem: 1, categoria: "COND", exercicio: "Corrida Contínua", series: 1, repeticoes: '40-50min' },
      ]},
      { nome: "Treino 3", tipo: "forca", exercicios: [
        { ordem: 1, categoria: "COND", exercicio: "Tempo Run", series: 1, repeticoes: '25-35min ritmo forte' },
      ]},
      { nome: "Treino 4", tipo: "forca", exercicios: [
        { ordem: 1, categoria: "COND", exercicio: "Long Run", series: 1, repeticoes: '60-90min ritmo leve' },
      ]},
    ],
  },
  {
    fase: "Corrida - Fase 4",
    frequencia: "4x",
    aquecimento: [],
    treinos: [
      { nome: "Treino 1", tipo: "forca", exercicios: [
        { ordem: 1, categoria: "COND", exercicio: "Intervalado Intenso", series: "10-12", repeticoes: '400m forte / 200m recuperação' },
      ]},
      { nome: "Treino 2", tipo: "forca", exercicios: [
        { ordem: 1, categoria: "COND", exercicio: "Corrida Contínua", series: 1, repeticoes: '45-60min' },
      ]},
      { nome: "Treino 3", tipo: "forca", exercicios: [
        { ordem: 1, categoria: "COND", exercicio: "Fartlek", series: 1, repeticoes: '40min variando ritmos' },
      ]},
      { nome: "Treino 4", tipo: "forca", exercicios: [
        { ordem: 1, categoria: "COND", exercicio: "Long Run", series: 1, repeticoes: '90-120min ritmo leve' },
      ]},
    ],
  },
];