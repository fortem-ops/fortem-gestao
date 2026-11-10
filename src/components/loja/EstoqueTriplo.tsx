import type { EstoqueVariante } from "@/hooks/useEstoqueDisponivelAdmin";

export function EstoqueTriplo({ e }: { e: EstoqueVariante }) {
  const alerta = e.disponivel === 0 && e.encomendado > 0;
  return (
    <span className="inline-flex items-center gap-1.5 text-xs whitespace-nowrap" title="Físico · Encomendado · Disponível">
      <span className="text-muted-foreground">Fís. {e.fisico}</span>
      <span className="text-muted-foreground">·</span>
      <span className="text-muted-foreground">Enc. {e.encomendado}</span>
      <span className="text-muted-foreground">·</span>
      <span className={`font-semibold text-sm ${alerta ? "text-destructive" : "text-foreground"}`}>Disp. {e.disponivel}</span>
    </span>
  );
}
