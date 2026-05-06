import { Badge } from "@/components/ui/badge";
import { NOTIF_PRIORIDADES, NOTIF_STATUS, NOTIF_CATEGORIAS } from "@/lib/notificar";

export function PrioridadeBadge({ prioridade }: { prioridade: string }) {
  const p = NOTIF_PRIORIDADES.find((x) => x.value === prioridade);
  return <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${p?.className ?? ""}`}>{p?.label ?? prioridade}</span>;
}

export function StatusBadge({ status }: { status: string }) {
  const s = NOTIF_STATUS.find((x) => x.value === status);
  return <Badge variant="outline" className="text-xs">{s?.label ?? status}</Badge>;
}

export function CategoriaBadge({ categoria }: { categoria: string }) {
  const c = NOTIF_CATEGORIAS.find((x) => x.value === categoria);
  return <Badge variant="secondary" className="text-xs">{c?.label ?? categoria}</Badge>;
}
