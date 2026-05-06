import { getLicencaVigente, type AlunoLicenca } from "./licencas";

export type DisplayStatusKey = "ativo" | "licenca" | "encerrado" | "lead" | "prospect";

export interface DisplayStatus {
  key: DisplayStatusKey;
  label: string;
  className: string;
}

const LABELS: Record<DisplayStatusKey, string> = {
  ativo: "Ativo",
  licenca: "Licença",
  encerrado: "Inativo",
  lead: "Lead",
  prospect: "Prospect",
};

const CLASSES: Record<DisplayStatusKey, string> = {
  ativo: "status-active",
  licenca: "status-license",
  encerrado: "status-urgent",
  lead: "status-info",
  prospect: "status-warning",
};

export function getDisplayStatus(
  rawStatus: string | null | undefined,
  planEnd: Date | null,
  licencas: AlunoLicenca[] = [],
): DisplayStatus {
  // Pipeline-only statuses
  if (rawStatus === "lead" || rawStatus === "prospect") {
    return { key: rawStatus, label: LABELS[rawStatus], className: CLASSES[rawStatus] };
  }

  if (getLicencaVigente(licencas)) {
    return { key: "licenca", label: LABELS.licenca, className: CLASSES.licenca };
  }

  if (planEnd && planEnd < new Date(new Date().toDateString())) {
    return { key: "encerrado", label: LABELS.encerrado, className: CLASSES.encerrado };
  }

  return { key: "ativo", label: LABELS.ativo, className: CLASSES.ativo };
}
