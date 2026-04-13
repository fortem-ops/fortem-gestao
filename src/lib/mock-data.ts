export type StudentStatus = 'ativo' | 'licenca' | 'encerrado';
export type PlanType = 'Start' | 'Start+' | 'Power' | 'Pro' | 'Max';
export type TaskPriority = 'alta' | 'media' | 'baixa';
export type TaskStatus = 'pendente' | 'concluida' | 'atrasada';
export type AlertType = 'troca_ficha' | 'avaliacao' | 'licenca' | 'plano_vencendo';
export type AssessmentClassification = 'Fraco' | 'Regular' | 'Médio' | 'Bom' | 'Excelente';

export interface Student {
  id: string;
  name: string;
  email: string;
  phone: string;
  birthDate: string;
  status: StudentStatus;
  plan: PlanType;
  planStart: string;
  planDurationMonths: number;
  responsible: string;
  lastAssessment: string | null;
  lastWorkoutChange: string | null;
  weeklyFrequency: number;
  services: string[];
  photo?: string;
}

export interface Alert {
  id: string;
  studentId: string;
  studentName: string;
  type: AlertType;
  message: string;
  severity: 'ok' | 'atencao' | 'urgente';
  date: string;
}

export interface Task {
  id: string;
  title: string;
  description: string;
  responsible: string;
  studentId?: string;
  studentName?: string;
  priority: TaskPriority;
  status: TaskStatus;
  dueDate: string;
  auto: boolean;
}

export const mockStudents: Student[] = [
  { id: '1', name: 'Ana Silva', email: 'ana@email.com', phone: '(11) 99999-0001', birthDate: '1990-04-13', status: 'ativo', plan: 'Pro', planStart: '2025-01-15', planDurationMonths: 12, responsible: 'Prof. Carlos', lastAssessment: '2026-03-01', lastWorkoutChange: '2026-02-10', weeklyFrequency: 3, services: ['nutrição', 'fisioterapia'] },
  { id: '2', name: 'Bruno Costa', email: 'bruno@email.com', phone: '(11) 99999-0002', birthDate: '1988-07-22', status: 'ativo', plan: 'Max', planStart: '2025-06-01', planDurationMonths: 6, responsible: 'Prof. Carlos', lastAssessment: '2026-01-15', lastWorkoutChange: '2025-12-20', weeklyFrequency: 2, services: ['nutrição'] },
  { id: '3', name: 'Camila Oliveira', email: 'camila@email.com', phone: '(11) 99999-0003', birthDate: '1995-11-08', status: 'licenca', plan: 'Start+', planStart: '2025-09-01', planDurationMonths: 12, responsible: 'Prof. Marina', lastAssessment: '2025-11-20', lastWorkoutChange: '2025-11-01', weeklyFrequency: 1, services: [] },
  { id: '4', name: 'Daniel Souza', email: 'daniel@email.com', phone: '(11) 99999-0004', birthDate: '1992-02-14', status: 'ativo', plan: 'Power', planStart: '2025-03-10', planDurationMonths: 12, responsible: 'Prof. Marina', lastAssessment: '2026-04-01', lastWorkoutChange: '2026-03-28', weeklyFrequency: 3, services: ['fisioterapia', 'avaliações extras'] },
  { id: '5', name: 'Elena Martins', email: 'elena@email.com', phone: '(11) 99999-0005', birthDate: '2000-04-15', status: 'ativo', plan: 'Start', planStart: '2026-01-01', planDurationMonths: 6, responsible: 'Prof. Carlos', lastAssessment: null, lastWorkoutChange: null, weeklyFrequency: 2, services: [] },
  { id: '6', name: 'Felipe Rocha', email: 'felipe@email.com', phone: '(11) 99999-0006', birthDate: '1985-09-30', status: 'encerrado', plan: 'Pro', planStart: '2024-06-01', planDurationMonths: 12, responsible: 'Prof. Carlos', lastAssessment: '2025-04-10', lastWorkoutChange: '2025-03-15', weeklyFrequency: 3, services: ['nutrição', 'fisioterapia'] },
];

export const mockAlerts: Alert[] = [
  { id: '1', studentId: '2', studentName: 'Bruno Costa', type: 'troca_ficha', message: 'Troca de ficha atrasada há 4 semanas', severity: 'urgente', date: '2026-04-13' },
  { id: '2', studentId: '5', studentName: 'Elena Martins', type: 'avaliacao', message: 'Aluna sem avaliação inicial', severity: 'urgente', date: '2026-04-13' },
  { id: '3', studentId: '3', studentName: 'Camila Oliveira', type: 'licenca', message: 'Em licença há 20 dias sem contato', severity: 'atencao', date: '2026-04-13' },
  { id: '4', studentId: '1', studentName: 'Ana Silva', type: 'troca_ficha', message: 'Troca de ficha em 1 semana', severity: 'atencao', date: '2026-04-13' },
  { id: '5', studentId: '4', studentName: 'Daniel Souza', type: 'avaliacao', message: 'Avaliação em dia', severity: 'ok', date: '2026-04-13' },
];

export const mockTasks: Task[] = [
  { id: '1', title: 'Trocar ficha - Bruno Costa', description: 'Ficha vencida há 4 semanas', responsible: 'Prof. Carlos', studentId: '2', studentName: 'Bruno Costa', priority: 'alta', status: 'atrasada', dueDate: '2026-03-15', auto: true },
  { id: '2', title: 'Avaliação inicial - Elena Martins', description: 'Realizar primeira avaliação funcional', responsible: 'Prof. Carlos', studentId: '5', studentName: 'Elena Martins', priority: 'alta', status: 'pendente', dueDate: '2026-04-15', auto: true },
  { id: '3', title: 'Contato licença - Camila Oliveira', description: 'Aluna sem contato há 20 dias', responsible: 'Prof. Marina', studentId: '3', studentName: 'Camila Oliveira', priority: 'media', status: 'pendente', dueDate: '2026-04-14', auto: true },
  { id: '4', title: 'Atualizar prescrição nutricional', description: 'Revisar plano alimentar mensal', responsible: 'Nutri. Juliana', studentId: '1', studentName: 'Ana Silva', priority: 'media', status: 'pendente', dueDate: '2026-04-20', auto: false },
  { id: '5', title: 'Reavaliação trimestral - Daniel', description: 'Composição corporal + funcional', responsible: 'Prof. Marina', studentId: '4', studentName: 'Daniel Souza', priority: 'baixa', status: 'pendente', dueDate: '2026-04-30', auto: true },
];

// Functional assessment reference tables
export const assessmentReferences: Record<string, { ranges: [number, number, string][] }> = {
  'Mobilidade Tornozelo': {
    ranges: [[0, 25, 'Fraco'], [26, 34, 'Regular'], [35, 39, 'Médio'], [40, 44, 'Bom'], [45, 999, 'Excelente']],
  },
  'Mobilidade Quadril RE': {
    ranges: [[0, 35, 'Fraco'], [36, 44, 'Regular'], [45, 49, 'Médio'], [50, 54, 'Bom'], [55, 999, 'Excelente']],
  },
  'Mobilidade Quadril RI': {
    ranges: [[0, 20, 'Fraco'], [21, 29, 'Regular'], [30, 34, 'Médio'], [35, 39, 'Bom'], [40, 999, 'Excelente']],
  },
  'Mobilidade Ombro RE': {
    ranges: [[0, 65, 'Fraco'], [66, 74, 'Regular'], [75, 79, 'Médio'], [80, 84, 'Bom'], [85, 999, 'Excelente']],
  },
  'Mobilidade Ombro RI': {
    ranges: [[0, 45, 'Fraco'], [46, 50, 'Regular'], [51, 64, 'Médio'], [65, 69, 'Bom'], [70, 999, 'Excelente']],
  },
  'Mobilidade Torácica': {
    ranges: [[0, 35, 'Fraco'], [36, 44, 'Regular'], [45, 49, 'Médio'], [50, 54, 'Bom'], [55, 999, 'Excelente']],
  },
  'Flexibilidade Posterior MMII': {
    ranges: [[0, 65, 'Fraco'], [66, 74, 'Regular'], [75, 79, 'Médio'], [80, 84, 'Bom'], [85, 999, 'Excelente']],
  },
  'Flexibilidade Psoas': {
    ranges: [[1, 999, 'Regular'], [0, 0, 'Excelente']],
  },
  'Flexibilidade Quadríceps': {
    ranges: [[0, 120, 'Fraco'], [121, 130, 'Regular'], [131, 140, 'Médio'], [141, 149, 'Bom'], [150, 999, 'Excelente']],
  },
};

export function classifyAngle(metric: string, degrees: number): AssessmentClassification {
  const ref = assessmentReferences[metric];
  if (!ref) return 'Médio';
  
  // Special case for Psoas
  if (metric === 'Flexibilidade Psoas') {
    return degrees === 0 ? 'Excelente' : 'Regular';
  }
  
  for (const [min, max, label] of ref.ranges) {
    if (degrees >= min && degrees <= max) return label as AssessmentClassification;
  }
  return 'Médio';
}

export function getClassificationColor(classification: AssessmentClassification): string {
  switch (classification) {
    case 'Fraco': return 'text-destructive';
    case 'Regular': return 'text-warning';
    case 'Médio': return 'text-info';
    case 'Bom': return 'text-success';
    case 'Excelente': return 'text-primary';
    default: return 'text-muted-foreground';
  }
}

export function getRemainingDays(planStart: string, durationMonths: number): number {
  const start = new Date(planStart);
  const end = new Date(start);
  end.setMonth(end.getMonth() + durationMonths);
  const now = new Date();
  return Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

export function getBirthdaysToday(students: Student[]): Student[] {
  const today = new Date();
  return students.filter(s => {
    const bd = new Date(s.birthDate);
    return bd.getMonth() === today.getMonth() && bd.getDate() === today.getDate();
  });
}

export function getBirthdaysMonth(students: Student[]): Student[] {
  const today = new Date();
  return students.filter(s => {
    const bd = new Date(s.birthDate);
    return bd.getMonth() === today.getMonth();
  });
}
