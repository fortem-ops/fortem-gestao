import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import fortemIcon from "@/assets/fortem-icon.png";
import { Loader2, Shield } from "lucide-react";

type OAuthResp = {
  data?: {
    redirect_url?: string;
    redirect_to?: string;
    client?: { name?: string; redirect_uris?: string[] };
    scopes?: string[];
  } | null;
  error?: { message: string } | null;
};
type OAuthNs = {
  getAuthorizationDetails(id: string): Promise<OAuthResp>;
  approveAuthorization(id: string): Promise<OAuthResp>;
  denyAuthorization(id: string): Promise<OAuthResp>;
};

function oauth(): OAuthNs {
  return (supabase.auth as unknown as { oauth: OAuthNs }).oauth;
}

export default function OAuthConsent() {
  const [params] = useSearchParams();
  const authorizationId = params.get("authorization_id") ?? "";
  const [details, setDetails] = useState<OAuthResp["data"] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      if (!authorizationId) return setError("Parâmetro authorization_id ausente.");
      const { data: sess } = await supabase.auth.getSession();
      if (!sess.session) {
        const next = window.location.pathname + window.location.search;
        window.location.href = "/login?next=" + encodeURIComponent(next);
        return;
      }
      const { data, error } = await oauth().getAuthorizationDetails(authorizationId);
      if (!active) return;
      if (error) return setError(error.message);
      const immediate = data?.redirect_url ?? data?.redirect_to;
      if (immediate && !data?.client) {
        window.location.href = immediate;
        return;
      }
      setDetails(data ?? null);
    })();
    return () => {
      active = false;
    };
  }, [authorizationId]);

  async function decide(approve: boolean) {
    setBusy(true);
    const { data, error } = approve
      ? await oauth().approveAuthorization(authorizationId)
      : await oauth().denyAuthorization(authorizationId);
    if (error) {
      setBusy(false);
      return setError(error.message);
    }
    const target = data?.redirect_url ?? data?.redirect_to;
    if (!target) {
      setBusy(false);
      return setError("Servidor de autorização não retornou destino de redirect.");
    }
    window.location.href = target;
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="max-w-md w-full glass-card">
          <CardContent className="pt-6 space-y-2 text-center">
            <p className="font-medium">Não foi possível carregar esta autorização</p>
            <p className="text-sm text-muted-foreground">{error}</p>
          </CardContent>
        </Card>
      </div>
    );
  }
  if (!details) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const clientName = details.client?.name ?? "Aplicativo externo";

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="max-w-md w-full glass-card">
        <CardHeader className="text-center space-y-3 pb-2">
          <img src={fortemIcon} alt="Fortem" className="mx-auto w-14 h-14" />
          <div>
            <h1 className="text-lg font-heading font-bold">Conectar {clientName} à Fortem</h1>
            <p className="text-sm text-muted-foreground mt-1">
              {clientName} poderá chamar as ferramentas deste app como você enquanto estiver conectado.
            </p>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-start gap-2 text-sm p-3 rounded-lg bg-muted/40 border border-border">
            <Shield className="w-4 h-4 text-primary mt-0.5 shrink-0" />
            <p className="text-muted-foreground">
              O acesso continua limitado pelas permissões (RLS) da sua conta — nada é concedido além do que você
              já pode ver dentro do sistema.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Button variant="outline" disabled={busy} onClick={() => decide(false)}>
              Cancelar
            </Button>
            <Button disabled={busy} onClick={() => decide(true)}>
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : "Aprovar"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
