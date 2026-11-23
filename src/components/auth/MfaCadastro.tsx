import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Copy } from "lucide-react";
import { toast } from "sonner";
import { codigoValido, limparFatoresPendentes, MSG_CODIGO_ERRADO } from "@/lib/mfa";

export function MfaCadastro({ nomeAparelho, onConcluido }: { nomeAparelho: string; onConcluido: () => void }) {
  const [factorId, setFactorId] = useState<string | null>(null);
  const [qr, setQr] = useState<string | null>(null);
  const [secret, setSecret] = useState<string>("");
  const [codigo, setCodigo] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    let ativo = true;
    (async () => {
      await limparFatoresPendentes();
      const { data, error } = await supabase.auth.mfa.enroll({
        factorType: "totp",
        friendlyName: `${nomeAparelho} ${new Date().toISOString().slice(0, 16)}`,
      });
      if (!ativo) return;
      if (error || !data) {
        setErro("Não foi possível gerar o QR code. Tente novamente.");
        return;
      }
      setFactorId(data.id);
      setQr(data.totp.qr_code);
      setSecret(data.totp.secret);
    })();
    return () => { ativo = false; };
  }, [nomeAparelho]);

  const confirmar = async () => {
    if (!factorId || !codigoValido(codigo)) {
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
    toast.success("Verificação em duas etapas ativada.");
    onConcluido();
  };

  return (
    <div className="space-y-4">
      <ol className="text-sm text-muted-foreground list-decimal pl-5 space-y-1">
        <li>Abra o Google Authenticator, Authy, 1Password ou similar.</li>
        <li>Escaneie o QR code ou digite o código manual.</li>
        <li>Digite o código de 6 dígitos que aparecer.</li>
      </ol>
      <div className="flex justify-center">
        {qr ? (
          <img src={qr} alt="QR code para o aplicativo autenticador" className="w-48 h-48 rounded-md bg-foreground p-2" />
        ) : (
          <div className="w-48 h-48 rounded-md bg-muted animate-pulse" />
        )}
      </div>
      {secret && (
        <div className="flex items-center gap-2">
          <code className="flex-1 text-xs break-all rounded-md bg-muted px-2 py-2 text-foreground">{secret}</code>
          <Button
            type="button"
            size="icon"
            variant="outline"
            aria-label="Copiar código manual"
            onClick={() => { void navigator.clipboard.writeText(secret); toast.success("Código copiado."); }}
          >
            <Copy className="w-4 h-4" />
          </Button>
        </div>
      )}
      <Input
        inputMode="numeric"
        autoComplete="one-time-code"
        maxLength={6}
        placeholder="000000"
        value={codigo}
        onChange={(e) => setCodigo(e.target.value.replace(/\D/g, ""))}
        onKeyDown={(e) => { if (e.key === "Enter") void confirmar(); }}
        className="text-center text-lg tracking-[0.4em]"
        aria-label="Código de 6 dígitos"
      />
      {erro && <p className="text-sm text-destructive">{erro}</p>}
      <Button className="w-full" onClick={confirmar} disabled={enviando || !factorId}>
        {enviando ? "Confirmando..." : "Confirmar e ativar"}
      </Button>
    </div>
  );
}
