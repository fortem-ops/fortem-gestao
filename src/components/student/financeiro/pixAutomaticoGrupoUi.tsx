import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface CodigoGerado {
  pix_copia_cola: string | null;
  expira: string;
  codigo_numero: number;
  solicitacao_app: boolean;
}

const ERROS: Record<string, string> = {
  sem_permissao: "Só administradores podem fazer isso.",
  item_ja_vinculado: "Um dos itens já está em outro Pix Automático.",
  teto_abaixo_da_soma: "O valor máximo não pode ser menor que a soma dos itens.",
  itens_vazios: "Escolha ao menos um item.",
  limite_codigos: "Limite de 3 códigos atingido para esta autorização.",
  cancelar_no_banco_primeiro: "Cancele primeiro a autorização no banco.",
};

export function mensagemErroPix(msg: string): string {
  const chave = Object.keys(ERROS).find((k) => msg.includes(k));
  return chave ? ERROS[chave] : msg;
}

export async function gerarCodigoGrupo(grupoId: string): Promise<CodigoGerado> {
  const { data, error } = await supabase.functions.invoke("pix-aut-grupo-codigo", { body: { grupo_id: grupoId } });
  const d = data as (CodigoGerado & { error?: string }) | null;
  if (error || d?.error) throw new Error(mensagemErroPix(d?.error ?? error?.message ?? "Falha ao gerar o código"));
  return d as CodigoGerado;
}

export function textoWhatsapp(copiaCola: string, expira: string): string {
  const validade = new Date(expira).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
  return `Olá! Para ativar o Pix Automático das suas mensalidades FORTEM, abra o app do seu banco, ` +
    `escolha Pix > Copia e Cola e cole o código abaixo. Válido até ${validade}.\n\n${copiaCola}`;
}

export function CodigoPixAutorizacao({ codigo }: { codigo: CodigoGerado }) {
  const validade = new Date(codigo.expira).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
  async function copiar(t: string, ok: string) {
    try { await navigator.clipboard.writeText(t); toast.success(ok); } catch { toast.error("Não foi possível copiar"); }
  }
  return (
    <div className="space-y-3 text-sm">
      <p>Código {codigo.codigo_numero} de 3 · válido até <strong>{validade}</strong>.</p>
      {codigo.solicitacao_app && (
        <p className="text-muted-foreground">O aluno também recebe o pedido de autorização no app do banco.</p>
      )}
      {codigo.pix_copia_cola ? (
        <>
          <textarea readOnly className="w-full h-24 rounded-md border bg-muted p-2 text-xs font-mono" value={codigo.pix_copia_cola} />
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={() => copiar(codigo.pix_copia_cola!, "Código copiado")}>Copiar código</Button>
            <Button size="sm" onClick={() => copiar(textoWhatsapp(codigo.pix_copia_cola!, codigo.expira), "Mensagem copiada para o WhatsApp")}>
              Copiar mensagem para WhatsApp
            </Button>
          </div>
        </>
      ) : (
        <p className="text-destructive">O banco não devolveu o código Copia e Cola. Gere um novo código.</p>
      )}
    </div>
  );
}
