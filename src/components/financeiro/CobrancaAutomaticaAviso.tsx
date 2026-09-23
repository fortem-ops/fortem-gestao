import { PauseCircle } from "lucide-react";
import { useCobrancaRecorrenteAtiva } from "@/hooks/useSistemaConfig";

/**
 * Faixa de aviso exibida enquanto a cobrança automática no cartão estiver pausada.
 * Não renderiza nada quando a cobrança está ativa.
 */
export function CobrancaAutomaticaAviso({ className = "" }: { className?: string }) {
  const { data: ativa, isLoading } = useCobrancaRecorrenteAtiva();
  if (isLoading || ativa) return null;

  return (
    <div
      className={`rounded-lg border border-warning/40 bg-warning/10 p-3 flex items-start gap-3 ${className}`}
    >
      <PauseCircle className="h-5 w-5 text-warning shrink-0 mt-0.5" />
      <div className="text-sm">
        <p className="font-semibold text-foreground">Cobrança automática no cartão PAUSADA</p>
        <p className="text-muted-foreground">
          Nenhuma mensalidade está sendo cobrada automaticamente. Os recebimentos precisam ser
          registrados manualmente até que a cobrança seja reativada em Admin &gt; Integrações.
        </p>
      </div>
    </div>
  );
}
