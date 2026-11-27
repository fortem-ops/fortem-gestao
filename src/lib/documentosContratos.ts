export interface DocumentoContratoResumo {
  id: string;
  contratos?: { plano_tipo: string | null } | null;
}

const CORRIDA_TIPOS = new Set(["corrida", "corrida_sem_plano"]);

export function separarDocumentosContratos<T extends DocumentoContratoResumo>(documentos: T[]) {
  return {
    funcionais: documentos.filter((d) => !CORRIDA_TIPOS.has(d.contratos?.plano_tipo ?? "")),
    corrida: documentos.filter((d) => CORRIDA_TIPOS.has(d.contratos?.plano_tipo ?? "")),
  };
}
