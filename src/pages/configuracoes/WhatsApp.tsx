import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Navigate } from "react-router-dom";
import { MessageCircle, Copy, Check, Loader2, RefreshCw, Send, Link2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useUserRoles } from "@/hooks/useUserRoles";
import { sendTemplate } from "@/services/whatsappService";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const WEBHOOK_URL = `${SUPABASE_URL}/functions/v1/whatsapp-webhook`;
const TEST_PHONE = "555135199451";
const WHATSAPP_ONBOARDING_URL =
  "https://business.facebook.com/messaging/whatsapp/onboard/?app_id=973289551764344&config_id=2092477445480536&extras=%7B%22sessionInfoVersion%22%3A%223%22%2C%22version%22%3A%22v4%22%7D";

type WhatsAppEvent = {
  id: string;
  type: string | null;
  payload: unknown;
  created_at: string;
};

export default function ConfiguracoesWhatsApp() {
  const { data: roles, isLoading: rolesLoading } = useUserRoles();
  const [copied, setCopied] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testTemplate, setTestTemplate] = useState("hello_world");
  const [testLanguage, setTestLanguage] = useState("en_US");

  const eventsQuery = useQuery({
    queryKey: ["whatsapp-events"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("whatsapp_events" as never)
        .select("*")
        .order("created_at", { ascending: false })
        .limit(10);
      if (error) throw error;
      return (data ?? []) as unknown as WhatsAppEvent[];
    },
    enabled: !!roles?.isAdmin,
    refetchInterval: 15_000,
  });

  const status = useMemo(() => {
    if (eventsQuery.isError) return { ok: false, label: "Erro ao consultar" };
    return { ok: true, label: "Configurado" };
  }, [eventsQuery.isError]);

  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 1800);
    return () => clearTimeout(t);
  }, [copied]);

  if (rolesLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (!roles?.isAdmin) return <Navigate to="/" replace />;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(WEBHOOK_URL);
      setCopied(true);
      toast.success("URL do webhook copiada");
    } catch {
      toast.error("Não foi possível copiar. Copie manualmente.");
    }
  };

  const handleTest = async () => {
    setTesting(true);
    try {
      const res = await sendTemplate(TEST_PHONE, testTemplate, testLanguage, []);
      if (res.ok) {
        toast.success("Mensagem de teste enviada!");
      } else {
        toast.error(res.error ?? "Falha ao enviar teste", {
          description: res.details ? JSON.stringify(res.details).slice(0, 200) : undefined,
        });
      }
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center gap-2">
        <MessageCircle className="w-6 h-6 text-primary" />
        <div>
          <h1 className="text-2xl font-heading font-bold">WhatsApp Cloud API</h1>
          <p className="text-sm text-muted-foreground">Integração com Meta • Somente Administradores</p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Status da conexão</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-2">
              <span
                className={`w-2.5 h-2.5 rounded-full ${status.ok ? "bg-emerald-500" : "bg-red-500"}`}
              />
              <span className="font-medium">{status.label}</span>
              <Badge variant="outline" className="ml-auto">v20.0</Badge>
            </div>
            <div className="text-sm">
              <div className="text-muted-foreground">Phone Number ID</div>
              <div className="font-mono text-xs mt-1 p-2 rounded bg-muted">
                Configurado via Secret <code>WHATSAPP_PHONE_NUMBER_ID</code>
              </div>
            </div>
            <div className="text-sm">
              <div className="text-muted-foreground">Token</div>
              <div className="font-mono text-xs mt-1 p-2 rounded bg-muted">
                Configurado via Secret <code>WHATSAPP_TOKEN</code>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Webhook</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <Label className="text-xs text-muted-foreground">URL para configurar na Meta</Label>
              <div className="flex gap-2 mt-1">
                <Input readOnly value={WEBHOOK_URL} className="font-mono text-xs" />
                <Button variant="outline" size="icon" onClick={handleCopy} title="Copiar">
                  {copied ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                </Button>
              </div>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Verify Token</Label>
              <div className="font-mono text-xs mt-1 p-2 rounded bg-muted">fortem_webhook_2024</div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Link2 className="w-4 h-4 text-primary" />
            Conectar número de produção
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Clique no botão abaixo para conectar o número real da Fortem. Você será redirecionado
            para uma página da Meta onde poderá adicionar o número (51) 3519-9451 com coexistência
            ativada (o celular continuará funcionando normalmente).
          </p>
          <Button asChild className="gap-2">
            <a href={WHATSAPP_ONBOARDING_URL} target="_blank" rel="noopener noreferrer">
              <Link2 className="w-4 h-4" />
              Conectar WhatsApp Business
            </a>
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Testar conexão</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Envia uma mensagem para <strong>(51) 3519-9451</strong> usando o template abaixo.
            O template já precisa estar aprovado na sua conta do WhatsApp Business.
          </p>
          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <Label className="text-xs">Template</Label>
              <Input value={testTemplate} onChange={(e) => setTestTemplate(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">Idioma</Label>
              <Input value={testLanguage} onChange={(e) => setTestLanguage(e.target.value)} />
            </div>
          </div>
          <Button onClick={handleTest} disabled={testing} className="gap-2">
            {testing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            Enviar mensagem de teste
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base">Últimos eventos recebidos</CardTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => eventsQuery.refetch()}
            disabled={eventsQuery.isFetching}
            className="gap-2"
          >
            <RefreshCw className={`w-4 h-4 ${eventsQuery.isFetching ? "animate-spin" : ""}`} />
            Atualizar
          </Button>
        </CardHeader>
        <CardContent>
          {eventsQuery.isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          ) : eventsQuery.data && eventsQuery.data.length > 0 ? (
            <div className="space-y-2">
              {eventsQuery.data.map((ev) => (
                <details key={ev.id} className="rounded border border-border bg-muted/30 p-3">
                  <summary className="flex items-center gap-2 cursor-pointer text-sm">
                    <Badge variant="secondary">{ev.type ?? "unknown"}</Badge>
                    <span className="text-muted-foreground text-xs">
                      {new Date(ev.created_at).toLocaleString("pt-BR")}
                    </span>
                  </summary>
                  <pre className="mt-2 text-[11px] overflow-x-auto max-h-60 whitespace-pre-wrap">
                    {JSON.stringify(ev.payload, null, 2)}
                  </pre>
                </details>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground py-6 text-center">
              Nenhum evento recebido ainda. Configure o webhook na Meta para começar a receber.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
