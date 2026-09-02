import { Lock } from "lucide-react";

/** Nota discreta exibida nas abas de categoria quando em modo somente leitura. */
export function ReadOnlyHint() {
  return (
    <p className="flex items-center gap-1.5 text-[11px] text-[hsl(var(--bio-ink-muted))]">
      <Lock className="w-3 h-3" />
      Somente leitura · lançamentos e correções ficam em Lançamento
    </p>
  );
}
