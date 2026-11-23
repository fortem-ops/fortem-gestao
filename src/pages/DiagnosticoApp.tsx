import { useMemo, useState } from "react";
import { Copy } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { lerDiag, textoDiag } from "@/lib/diagnosticoApp";
import { lerFontesAmbiente } from "@/lib/appInstalavel";
import { Seo } from "@/components/Seo";

/** Página só de leitura com o histórico de abertura do app, para copiar e mandar à equipe técnica. */
export default function DiagnosticoApp() {
  const [copiado, setCopiado] = useState(false);
  const texto = useMemo(() => {
    const f = lerFontesAmbiente();
    return textoDiag(lerDiag(), {
      agora: new Date().toISOString(),
      standalone_nav: String(f.navStandalone === true),
      display_standalone: String(f.displayStandalone),
      ios: String(f.ios),
      marca_local: String(f.marcaLocal),
      marca_sessao: String(f.marcaSessao),
    });
  }, []);

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(texto);
    } catch {
      const area = document.getElementById("diag-texto");
      if (area instanceof HTMLTextAreaElement) {
        area.select();
        document.execCommand("copy");
      }
    }
    setCopiado(true);
    toast.success("Diagnóstico copiado");
  };

  return (
    <div className="min-h-screen bg-background p-4">
      <Seo title="Diagnóstico do app — FORTEM" description="Histórico de abertura do app para suporte." path="/diagnostico-app" noIndex />
      <div className="mx-auto max-w-2xl space-y-3">
        <h1 className="text-lg font-semibold text-foreground">Diagnóstico do app</h1>
        <p className="text-sm text-muted-foreground">
          Copie o texto abaixo e envie para a equipe técnica. Ele não contém senha nem token.
        </p>
        <Button onClick={copiar} className="w-full sm:w-auto">
          <Copy className="mr-2 h-4 w-4" />
          {copiado ? "Copiado" : "Copiar"}
        </Button>
        <textarea
          id="diag-texto"
          readOnly
          value={texto}
          className="h-[60vh] w-full resize-none rounded-md border border-border bg-card p-3 font-mono text-[11px] text-foreground"
        />
      </div>
    </div>
  );
}
