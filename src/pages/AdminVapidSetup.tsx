import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

export default function AdminVapidSetup() {
  const [keys, setKeys] = useState<{ publicKey: string; privateKey: string } | null>(null);
  const [loading, setLoading] = useState(false);

  async function gerarChaves() {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-vapid-keys`,
        {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${session?.access_token}`,
            "Content-Type": "application/json",
          },
        }
      );
      const result = await res.json();
      setKeys(result);
    } catch (e: any) {
      alert("Erro: " + e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="p-8 max-w-2xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold">Setup VAPID Keys</h1>
      <p className="text-sm text-muted-foreground">
        Use esta página uma única vez para gerar as chaves VAPID para Web Push.
        Após gerar, salve as chaves nos secrets do Lovable e remova esta página.
      </p>
      <Button onClick={gerarChaves} disabled={loading}>
        {loading ? "Gerando..." : "Gerar VAPID Keys"}
      </Button>
      {keys && (
        <div className="space-y-4">
          <div className="rounded-lg border p-4 space-y-2">
            <p className="text-xs font-bold text-muted-foreground uppercase">VAPID_PUBLIC_KEY (salvar no Lovable Secrets E no .env como VITE_VAPID_PUBLIC_KEY)</p>
            <code className="text-xs break-all block bg-muted p-2 rounded select-all">{keys.publicKey}</code>
          </div>
          <div className="rounded-lg border p-4 space-y-2">
            <p className="text-xs font-bold text-muted-foreground uppercase">VAPID_PRIVATE_KEY (salvar no Lovable Secrets — nunca expor no frontend)</p>
            <code className="text-xs break-all block bg-muted p-2 rounded select-all">{keys.privateKey}</code>
          </div>
          <div className="rounded-lg border border-primary/30 bg-primary/5 p-4">
            <p className="text-sm font-bold mb-2">Próximos passos:</p>
            <ol className="text-xs space-y-1 text-muted-foreground list-decimal list-inside">
              <li>Copie VAPID_PUBLIC_KEY → Lovable Secrets → nome: VAPID_PUBLIC_KEY</li>
              <li>Copie VAPID_PRIVATE_KEY → Lovable Secrets → nome: VAPID_PRIVATE_KEY</li>
              <li>Copie VAPID_PUBLIC_KEY → Lovable Env Vars → nome: VITE_VAPID_PUBLIC_KEY</li>
              <li>Após salvar, remova esta página do código</li>
            </ol>
          </div>
        </div>
      )}
    </div>
  );
}
