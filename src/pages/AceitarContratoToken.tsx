import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { CheckCircle2, AlertTriangle, Loader2, FileSignature } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";

interface ValidacaoLink {
  valido: boolean;
  motivo?: string;
  nome?: string;
  contrato_documento_id?: string;
  conteudo_gerado?: string;
  aceite?: boolean;
  data_aceite?: string | null;
}

function preencherMergeFields(
  html: string,
  values: { assinatura?: string; aceite?: string; data_aceite?: string; formato_aceite?: string; ip_aceite?: string },
) {
  return html
    .replace(/%ASSINATURA%/g, values.assinatura ?? "")
    .replace(/%ACEITE%/g, values.aceite ?? "")
    .replace(/%DATA_ACEITE%/g, values.data_aceite ?? "")
    .replace(/%FORMATO_ACEITE%/g, values.formato_aceite ?? "")
    .replace(/%IP_ACEITE%/g, values.ip_aceite ?? "");
}

export default function AceitarContratoToken() {
  const { token } = useParams<{ token: string }>();

  const [carregando, setCarregando] = useState(true);
  const [dados, setDados] = useState<ValidacaoLink | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [acabouDeAceitar, setAcabouDeAceitar] = useState(false);

  const validar = useCallback(async () => {
    if (!token) {
      setDados({ valido: false, motivo: "invalido" });
      setCarregando(false);
      return;
    }
    setCarregando(true);
    const { data, error } = await (supabase as any).rpc("fn_validar_link_contrato", { p_token: token });
    if (error || !data) {
      setDados({ valido: false, motivo: "invalido" });
    } else {
      setDados(data as ValidacaoLink);
    }
    setCarregando(false);
  }, [token]);

  useEffect(() => {
    validar();
  }, [validar]);

  const conteudo = useMemo(() => {
    if (!dados?.conteudo_gerado) return "";
    if (dados.aceite) {
      return preencherMergeFields(dados.conteudo_gerado, {
        assinatura: "Assinatura eletrônica confirmada",
        aceite: "Aceito",
        data_aceite: dados.data_aceite
          ? format(new Date(dados.data_aceite), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })
          : "",
        formato_aceite: "Aceite digital via link público",
      });
    }
    return preencherMergeFields(dados.conteudo_gerado, {});
  }, [dados]);

  async function confirmarAceite() {
    if (!token) return;
    setEnviando(true);
    try {
      const { data, error } = await supabase.functions.invoke("aceitar-contrato-token", {
        body: { token },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setAcabouDeAceitar(true);
      await validar();
      toast.success("Contrato aceito com sucesso!");
    } catch (e: any) {
      toast.error(e?.message ?? "Não foi possível registrar o aceite. Tente novamente.");
    } finally {
      setEnviando(false);
    }
  }

  const Header = (
    <div className="text-center mb-6">
      <h1 className="text-2xl font-bold tracking-tight">FORTEM</h1>
      <p className="text-sm text-muted-foreground">Aceite de contrato</p>
    </div>
  );

  if (carregando) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="w-full max-w-2xl">
          {Header}
          <Card>
            <CardContent className="flex items-center justify-center py-12 gap-3">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              <span className="text-muted-foreground">Carregando contrato…</span>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (!dados?.valido) {
    const msg =
      dados?.motivo === "expirado"
        ? "Este link expirou. Peça um novo link à coordenação da Fortem."
        : "Link inválido ou não encontrado.";
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          {Header}
          <Card>
            <CardContent className="flex flex-col items-center text-center gap-3 py-12">
              <div className="w-12 h-12 rounded-2xl bg-amber-500/10 flex items-center justify-center">
                <AlertTriangle className="w-6 h-6 text-amber-400" />
              </div>
              <p className="text-sm font-semibold text-foreground">Não foi possível abrir o contrato</p>
              <p className="text-sm text-muted-foreground">{msg}</p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (acabouDeAceitar) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          {Header}
          <Card>
            <CardContent className="flex flex-col items-center text-center gap-3 py-12">
              <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 flex items-center justify-center">
                <CheckCircle2 className="w-7 h-7 text-emerald-400" />
              </div>
              <p className="text-base font-semibold text-foreground">Contrato aceito com sucesso!</p>
              <p className="text-sm text-muted-foreground">
                Seu aceite foi registrado. Você já pode fechar esta página.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  const jaAceito = !!dados.aceite;

  return (
    <div className="min-h-screen bg-background p-4 pb-28">
      <div className="w-full max-w-2xl mx-auto">
        {Header}

        <div className="mb-4">
          <p className="text-base font-semibold text-foreground">
            {dados.nome ? `Olá, ${dados.nome}!` : "Olá!"}{" "}
            {jaAceito ? "Este é o seu contrato." : "Confira e aceite seu contrato abaixo."}
          </p>
          {jaAceito && (
            <span className="inline-flex mt-2 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400">
              Contrato já assinado
              {dados.data_aceite
                ? ` · ${format(new Date(dados.data_aceite), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}`
                : ""}
            </span>
          )}
        </div>

        <div className="bg-card border border-border rounded-2xl p-4">
          <div
            className="prose prose-sm prose-invert max-w-none overflow-x-auto"
            dangerouslySetInnerHTML={{ __html: conteudo }}
          />
        </div>
      </div>

      {!jaAceito && (
        <div className="fixed bottom-0 left-0 right-0 border-t border-border bg-background/95 backdrop-blur p-4">
          <div className="max-w-2xl mx-auto">
            <Button className="w-full" size="lg" disabled={enviando} onClick={confirmarAceite}>
              {enviando ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Registrando aceite…
                </>
              ) : (
                <>
                  <FileSignature className="w-4 h-4 mr-2" /> Confirmar leitura e aceite
                </>
              )}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
