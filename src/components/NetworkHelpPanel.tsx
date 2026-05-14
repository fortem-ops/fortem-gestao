import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { WifiOff, RefreshCw, Copy, Check } from "lucide-react";
import { useState } from "react";
import type { DiagnosisResult } from "@/lib/networkDiagnostics";
import { describeDiagnosis, SUPABASE_HOST } from "@/lib/networkDiagnostics";

interface Props {
  diagnosis: DiagnosisResult;
  onRetest: () => void;
  testing?: boolean;
}

export function NetworkHelpPanel({ diagnosis, onRetest, testing }: Props) {
  const [copied, setCopied] = useState(false);
  if (diagnosis.status === "ok") return null;
  const { title, description } = describeDiagnosis(diagnosis);

  const copyHost = async () => {
    try {
      await navigator.clipboard.writeText(SUPABASE_HOST);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore
    }
  };

  return (
    <Alert variant="destructive" className="mt-3">
      <WifiOff className="h-4 w-4" />
      <AlertTitle>{title}</AlertTitle>
      <AlertDescription className="space-y-2">
        <p className="text-xs">{description}</p>
        {diagnosis.status === "backend_blocked" && (
          <>
            <ul className="list-disc pl-4 text-xs space-y-1">
              <li>Trocar DNS do Wi-Fi para 1.1.1.1 ou 8.8.8.8.</li>
              <li>Desativar VPN, proxy e antivírus com inspeção HTTPS.</li>
              <li>Pedir ao TI/admin para liberar o domínio abaixo.</li>
              <li>Testar no mesmo aparelho usando 4G/5G para confirmar.</li>
            </ul>
            <div className="flex items-center gap-2 rounded-md bg-background/40 px-2 py-1.5">
              <code className="text-xs flex-1 truncate">{SUPABASE_HOST}</code>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={copyHost}
                className="h-7 gap-1.5"
              >
                {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                {copied ? "Copiado" : "Copiar"}
              </Button>
            </div>
          </>
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
