import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { WifiOff, RefreshCw } from "lucide-react";
import type { DiagnosisResult } from "@/lib/networkDiagnostics";
import { describeDiagnosis } from "@/lib/networkDiagnostics";

interface Props {
  diagnosis: DiagnosisResult;
  onRetest: () => void;
  testing?: boolean;
}

export function NetworkHelpPanel({ diagnosis, onRetest, testing }: Props) {
  if (diagnosis.status === "ok") return null;
  const { title, description } = describeDiagnosis(diagnosis);

  return (
    <Alert variant="destructive" className="mt-3">
      <WifiOff className="h-4 w-4" />
      <AlertTitle>{title}</AlertTitle>
      <AlertDescription className="space-y-2">
        <p className="text-xs">{description}</p>
        {diagnosis.status === "backend_blocked" && (
          <ul className="list-disc pl-4 text-xs space-y-1">
            <li>Trocar DNS do Wi-Fi para 1.1.1.1 ou 8.8.8.8.</li>
            <li>Desativar VPN, proxy e antivírus com inspeção HTTPS.</li>
            <li>Pedir ao TI para liberar o domínio do servidor.</li>
            <li>Testar no mesmo aparelho usando 4G/5G para confirmar.</li>
          </ul>
        )}
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={onRetest}
          disabled={testing}
          className="gap-1.5"
        >
          <RefreshCw className={`h-3 w-3 ${testing ? "animate-spin" : ""}`} />
          {testing ? "Testando..." : "Testar conexão novamente"}
        </Button>
      </AlertDescription>
    </Alert>
  );
}
