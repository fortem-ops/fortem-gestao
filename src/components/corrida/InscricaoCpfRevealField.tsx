import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";

const REVEAL_MS = 15_000;

function formatCPF(digits: string) {
  const d = digits.replace(/\D/g, "").slice(0, 11);
  return d
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
}

interface Props {
  inscricaoId: string;
  cpfUltimos3: string | null | undefined;
  isCoordAdmin: boolean;
}

export function InscricaoCpfRevealField({ inscricaoId, cpfUltimos3, isCoordAdmin }: Props) {
  const [revealed, setRevealed] = useState<string | null>(null);
  const [restante, setRestante] = useState(0);
  const [progress, setProgress] = useState(100);
  const [loading, setLoading] = useState(false);
  const timerRef = useRef<number | null>(null);
  const startRef = useRef<number>(0);

  const masked = cpfUltimos3 ? `•••.•••.**${cpfUltimos3}` : "Não informado";

  function clearTimer() {
    if (timerRef.current) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }

  function hide() {
    clearTimer();
    setRevealed(null);
    setProgress(100);
    setRestante(0);
  }

  useEffect(() => () => clearTimer(), []);
  useEffect(() => { hide(); /* nova inscrição selecionada */ }, [inscricaoId]);

  async function reveal() {
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc("fn_reveal_inscricao_cpf", {
        p_inscricao_id: inscricaoId,
      });
      if (error) throw error;
      const cpfFull = typeof data === "string" ? data : "";
      setRevealed(cpfFull);
      startRef.current = Date.now();
      setProgress(100);
      setRestante(Math.ceil(REVEAL_MS / 1000));
      clearTimer();
      timerRef.current = window.setInterval(() => {
        const elapsed = Date.now() - startRef.current;
        setProgress(Math.max(0, 100 - (elapsed / REVEAL_MS) * 100));
        setRestante(Math.max(0, Math.ceil((REVEAL_MS - elapsed) / 1000)));
        if (elapsed >= REVEAL_MS) hide();
      }, 200);
    } catch (e: any) {
      const msg = String(e?.message || "");
      toast.error(
        msg.toLowerCase().includes("acesso") || msg.toLowerCase().includes("permission")
          ? "Acesso negado para revelar CPF."
          : msg || "Não foi possível revelar o CPF.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-0.5">
      <p className="text-xs text-muted-foreground">CPF</p>
      <div className="flex items-center gap-2 flex-wrap">
        <p className="text-sm font-medium font-mono">
          {revealed ? formatCPF(revealed) : masked}
        </p>
        {isCoordAdmin && (
          revealed ? (
            <Button size="sm" variant="ghost" className="h-7 px-2 gap-1" onClick={hide}>
              <EyeOff className="w-3.5 h-3.5" /> Ocultar ({restante}s)
            </Button>
          ) : (
            <Button size="sm" variant="ghost" className="h-7 px-2 gap-1" onClick={reveal} disabled={loading}>
              <Eye className="w-3.5 h-3.5" /> {loading ? "..." : "Revelar CPF"}
            </Button>
          )
        )}
      </div>
      {revealed && (
        <div className="mt-2 h-1 w-full bg-muted rounded-full overflow-hidden">
          <div
            className="h-full bg-primary transition-[width] duration-200 ease-linear"
            style={{ width: `${progress}%` }}
          />
        </div>
      )}
    </div>
  );
}
