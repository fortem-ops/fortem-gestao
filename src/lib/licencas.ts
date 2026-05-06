export const LICENCA_PLANO_LIMITS: Record<string, number> = {
  "Start+": 10,
  "Power": 15,
  "Pro": 20,
  "Max": 30,
};

export const LICENCA_MEDICA_LIMIT = 30;
export const PLANOS_ELEGIVEIS_MEDICA = ["Start", "Start+", "Power", "Pro", "Max"];

export type LicencaTipo = "plano" | "medica";

export interface AlunoLicenca {
  id: string;
  aluno_id: string;
  plano_id: string;
  tipo: LicencaTipo;
  data_inicio: string;
  data_fim: string;
  dias: number;
  motivo: string | null;
  arquivo_url: string | null;
  created_at: string;
}

export function getLimite(planoTipo: string | undefined, tipo: LicencaTipo): number {
  if (!planoTipo) return 0;
  if (tipo === "plano") return LICENCA_PLANO_LIMITS[planoTipo] ?? 0;
  return PLANOS_ELEGIVEIS_MEDICA.includes(planoTipo) ? LICENCA_MEDICA_LIMIT : 0;
}

export function getDiasUsados(licencas: AlunoLicenca[], tipo: LicencaTipo): number {
  return licencas.filter((l) => l.tipo === tipo).reduce((sum, l) => sum + l.dias, 0);
}

export function calcDias(inicio: string, fim: string): number {
  if (!inicio || !fim) return 0;
  const a = new Date(inicio + "T00:00:00").getTime();
  const b = new Date(fim + "T00:00:00").getTime();
  if (b < a) return 0;
  return Math.floor((b - a) / 86400000) + 1;
}

export function getLicencaVigente(licencas: AlunoLicenca[], hoje = new Date()): AlunoLicenca | null {
  const todayStr = hoje.toISOString().split("T")[0];
  return (
    licencas.find((l) => l.data_inicio <= todayStr && l.data_fim >= todayStr) || null
  );
}
