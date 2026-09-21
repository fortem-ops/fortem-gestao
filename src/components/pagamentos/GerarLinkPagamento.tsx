import { useState } from "react";
import { Link2, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

type Props = {
  vendaId: string;
  /** Botão compacto (só ícone), para tabelas de ações. */
  compacto?: boolean;
  className?: string;
};

/** Gera o link público de pagamento de uma venda pendente e copia para a área de transferência. */
export function GerarLinkPagamento({ vendaId, compacto = false, className = "" }: Props) {
  const [gerando, setGerando] = useState(false);
  const [url, setUrl] = useState<string | null>(null);
  const [copiado, setCopiado] = useState(false);

  async function gerar() {
    setGerando(true);
    try {
      const { data, error } = await supabase.functions.invoke("criar-link-pagamento", {
        body: { venda_id: vendaId },
      });
      if (error || !data?.ok || !data?.url) throw new Error(data?.error ?? "falha");
      setUrl(String(data.url));
      try {
        await navigator.clipboard.writeText(String(data.url));
        setCopiado(true);
        toast.success("Link copiado!");
      } catch {
        toast.success("Link gerado. Copie o endereço abaixo.");
      }
    } catch {
      toast.error("Não foi possível gerar o link de pagamento.");
    } finally {
      setGerando(false);
    }
  }

  if (compacto) {
    return (
      <Button
        size="icon"
        variant="ghost"
        className={`h-7 w-7 ${className}`}
        onClick={gerar}
        disabled={gerando}
        title={copiado ? "Link copiado!" : "Gerar link de pagamento"}
      >
        {gerando ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Link2 className="w-3.5 h-3.5" />}
      </Button>
    );
  }

  return (
    <div className={`space-y-2 ${className}`}>
      <Button size="sm" variant="outline" onClick={gerar} disabled={gerando}>
        {gerando ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Link2 className="w-4 h-4 mr-2" />}
        {copiado ? "Link copiado!" : "Gerar link de pagamento"}
      </Button>
      {url && <p className="text-xs text-muted-foreground break-all">{url}</p>}
    </div>
  );
}

export default GerarLinkPagamento;
