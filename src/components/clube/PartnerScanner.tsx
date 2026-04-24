import { useEffect, useRef, useState } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, XCircle, Camera, Loader2 } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";

interface PartnerScannerProps {
  parceiroId: string;
}

interface ValidationResult {
  ok: boolean;
  status: string;
  motivo?: string;
  aluno?: { id: string; nome: string; fortem_id: string; nivel: string };
  beneficio?: { titulo: string; descricao: string };
}

const SCANNER_ID = "fortem-qr-scanner";
const TOKEN_PREFIX = "fortem://beneficios/";

export function PartnerScanner({ parceiroId }: PartnerScannerProps) {
  const [scanning, setScanning] = useState(false);
  const [beneficioId, setBeneficioId] = useState<string>("");
  const [result, setResult] = useState<ValidationResult | null>(null);
  const [validating, setValidating] = useState(false);
  const scannerRef = useRef<Html5Qrcode | null>(null);

  const { data: beneficios = [] } = useQuery({
    queryKey: ["scanner-beneficios", parceiroId],
    queryFn: async () => {
      const { data } = await supabase
        .from("beneficios")
        .select("id, titulo")
        .eq("parceiro_id", parceiroId)
        .eq("ativo", true)
        .order("titulo");
      return data || [];
    },
    enabled: !!parceiroId,
  });

  useEffect(() => {
    return () => {
      stopScanner();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function startScanner() {
    if (!beneficioId) {
      toast.error("Selecione o benefício antes de escanear.");
      return;
    }
    setResult(null);
    setScanning(true);
    try {
      const scanner = new Html5Qrcode(SCANNER_ID);
      scannerRef.current = scanner;
      await scanner.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 240, height: 240 } },
        async (decoded) => {
          await stopScanner();
          await handleToken(decoded);
        },
        () => {},
      );
    } catch (err: any) {
      toast.error("Não foi possível abrir a câmera: " + err.message);
      setScanning(false);
    }
  }

  async function stopScanner() {
    try {
      if (scannerRef.current?.isScanning) {
        await scannerRef.current.stop();
        await scannerRef.current.clear();
      }
    } catch {
      // ignore
    }
    scannerRef.current = null;
    setScanning(false);
  }

  async function handleToken(decoded: string) {
    const token = decoded.startsWith(TOKEN_PREFIX) ? decoded.slice(TOKEN_PREFIX.length) : decoded;
    setValidating(true);
    const { data, error } = await supabase.rpc("fn_clube_validar_token", {
      _token: token,
      _beneficio_id: beneficioId,
    });
    setValidating(false);
    if (error) {
      toast.error(error.message);
      setResult({ ok: false, status: "erro", motivo: error.message });
      return;
    }
    setResult(data as unknown as ValidationResult);
  }

  return (
    <div className="space-y-4">
      <Card className="p-4 space-y-3">
        <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Benefício a validar</label>
        <Select value={beneficioId} onValueChange={setBeneficioId} disabled={scanning}>
          <SelectTrigger>
            <SelectValue placeholder="Selecione o benefício" />
          </SelectTrigger>
          <SelectContent>
            {beneficios.map((b) => (
              <SelectItem key={b.id} value={b.id}>{b.titulo}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Card>

      <Card className="p-4">
        <div id={SCANNER_ID} className="w-full aspect-square max-w-sm mx-auto rounded-lg overflow-hidden bg-black/50" />
        <div className="flex gap-2 justify-center mt-4">
          {!scanning ? (
            <Button onClick={startScanner} disabled={!beneficioId} className="gap-2">
              <Camera className="w-4 h-4" /> Iniciar scanner
            </Button>
          ) : (
            <Button variant="outline" onClick={stopScanner}>Parar</Button>
          )}
        </div>
      </Card>

      {validating && (
        <Card className="p-6 flex items-center justify-center gap-2 text-muted-foreground">
          <Loader2 className="w-5 h-5 animate-spin" /> Validando token...
        </Card>
      )}

      {result && (
        <Card className={`p-6 border-2 ${result.ok ? "border-emerald-500/40" : "border-rose-500/40"}`}>
          <div className="flex items-center gap-3 mb-4">
            {result.ok ? (
              <CheckCircle2 className="w-10 h-10 text-emerald-500" />
            ) : (
              <XCircle className="w-10 h-10 text-rose-500" />
            )}
            <div>
              <h3 className="text-lg font-bold">{result.ok ? "VALIDADO" : "RECUSADO"}</h3>
              {result.motivo && <p className="text-sm text-muted-foreground">{result.motivo}</p>}
            </div>
          </div>
          {result.aluno && (
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Aluno</span>
                <span className="font-medium">{result.aluno.nome}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">FORTEM ID</span>
                <span className="font-mono text-xs">{result.aluno.fortem_id}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Nível</span>
                <Badge variant="outline">{result.aluno.nivel.toUpperCase()}</Badge>
              </div>
              {result.beneficio && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Benefício</span>
                  <span className="font-medium">{result.beneficio.titulo}</span>
                </div>
              )}
            </div>
          )}
          <Button variant="outline" className="w-full mt-4" onClick={() => setResult(null)}>
            Nova validação
          </Button>
        </Card>
      )}
    </div>
  );
}
