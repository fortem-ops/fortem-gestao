import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { codigoValido, MSG_CODIGO_ERRADO, type MfaEstado } from "@/lib/mfa";

export function MfaDesafio({ fatores, onConcluido }: { fatores: MfaEstado["fatores"]; onConcluido: () => void }) {
  const [factorId, setFactorId] = useState(fatores[0]?.id ?? "");
  const [codigo, setCodigo] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  const verificar = async () => {
    if (!codigoValido(codigo)) {
      setErro("Digite os 6 números do aplicativo.");
      return;
    }
    setEnviando(true);
    setErro(null);
    const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId, code: codigo });
    setEnviando(false);
    if (error) {
      setErro(MSG_CODIGO_ERRADO);
      setCodigo("");
      return;
    }
    onConcluido();
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">Digite o código de 6 dígitos do seu aplicativo autenticador.</p>
      {fatores.length > 1 && (
        <div className="flex flex-wrap gap-2">
          {fatores.map((f, i) => (
            <Button key={f.id} type="button" size="sm" variant={f.id === factorId ? "default" : "outline"} onClick={() => setFactorId(f.id)}>
              {i === 0 ? "Aparelho principal" : `Reserva ${i}`}
            </Button>
          ))}
        </div>
      )}
      <Input
        autoFocus
        inputMode="numeric"
        autoComplete="one-time-code"
        maxLength={6}
        placeholder="000000"
        value={codigo}
        onChange={(e) => setCodigo(e.target.value.replace(/\D/g, ""))}
        onKeyDown={(e) => { if (e.key === "Enter") void verificar(); }}
        className="text-center text-lg tracking-[0.4em]"
        aria-label="Código de 6 dígitos"
      />
      {erro && <p className="text-sm text-destructive">{erro}</p>}
      <Button className="w-full" onClick={verificar} disabled={enviando}>
        {enviando ? "Verificando..." : "Entrar"}
      </Button>
    </div>
  );
}
