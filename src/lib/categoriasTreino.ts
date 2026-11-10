import { CODE_TO_SUBCATEGORIA } from "./exerciseMapping";

export interface OpcaoCategoriaTreino { codigo: string; nome: string }

/** Opções de categoria da parte principal (códigos curtos), mantendo o valor atual se ausente. */
export function opcoesCategoriaTreino(atual?: string | null): OpcaoCategoriaTreino[] {
  const base: OpcaoCategoriaTreino[] = [
    ...Object.entries(CODE_TO_SUBCATEGORIA)
      .filter(([c]) => c !== "EEF")
      .map(([codigo, nome]) => ({ codigo, nome: nome ?? codigo })),
    { codigo: "COND", nome: "Condicionamento (Cardio)" },
  ];
  const v = (atual ?? "").trim();
  if (v && !base.some((o) => o.codigo === v)) return [{ codigo: v, nome: v }, ...base];
  return base;
}
