import { useEffect, useRef, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { supabase } from "@/integrations/supabase/client";
import { Progress } from "@/components/ui/progress";
import { Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface MembershipQRProps {
  alunoId: string;
  /** Cor do QR (preto ou branco conforme paleta do nível) */
  fgColor?: string;
  bgColor?: string;
  size?: number;
}

interface TokenResp {
  token: string;
  expires_at: string;
}

const REFRESH_MS = 25_000; // QR gira antes de expirar (30s)
const TICK_MS = 200;

/**
 * QR rotativo para validação por parceiros. Gera novo token via RPC a cada 25s.
 */
export function MembershipQR({ alunoId, fgColor = "#000000", bgColor = "#FFFFFF", size = 220 }: MembershipQRProps) {
  const [data, setData] = useState<TokenResp | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  async function fetchToken() {
    setLoading(true);
    setError(null);
    const { data: resp, error: err } = await supabase.rpc("fn_clube_generate_qr_token", { _aluno_id: alunoId });
    if (err) {
      setError(err.message);
    } else {
      setData(resp as unknown as TokenResp);
    }
    setLoading(false);
  }

  useEffect(() => {
    fetchToken();
    const interval = setInterval(fetchToken, REFRESH_MS);
    return () => {
      clearInterval(interval);
      if (refreshTimer.current) clearTimeout(refreshTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [alunoId]);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), TICK_MS);
    return () => clearInterval(t);
  }, []);

  const expiresAt = data ? new Date(data.expires_at).getTime() : 0;
  const remaining = Math.max(0, expiresAt - now);
  const pct = Math.min(100, Math.max(0, (remaining / 30_000) * 100));
  const value = data ? `fortem://beneficios/${data.token}` : "";

  return (
    <div className="flex flex-col items-center gap-3 w-full">
      <div
        className="rounded-xl p-3 flex items-center justify-center"
        style={{ backgroundColor: bgColor, width: size + 24, height: size + 24 }}
      >
        {loading && !data ? (
          <Loader2 className="w-8 h-8 animate-spin" style={{ color: fgColor }} />
        ) : error ? (
          <div className="text-xs text-center px-4" style={{ color: fgColor }}>
            {error}
          </div>
        ) : (
          <QRCodeSVG value={value} size={size} fgColor={fgColor} bgColor={bgColor} level="M" />
        )}
      </div>

      <div className="w-full max-w-[260px] space-y-1">
        <Progress value={pct} className="h-1" />
        <div className="flex items-center justify-between text-[10px] uppercase tracking-wider opacity-80">
          <span>{loading ? "Atualizando..." : `Expira em ${Math.ceil(remaining / 1000)}s`}</span>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-2 text-[10px] gap-1"
            onClick={fetchToken}
            disabled={loading}
            style={{ color: fgColor }}
          >
            <RefreshCw className="w-3 h-3" />
            Renovar
          </Button>
        </div>
      </div>
    </div>
  );
}
