import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { QRCodeSVG } from "qrcode.react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { lerPrevia, mensagemWhatsappPrimeira, podeGerarPrimeira } from "@/lib/pixAutPrimeira";

const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const dataBr = (d: string | null) => (d ? d.slice(0, 10).split("-").reverse().join("/") : "—");
const STATUS: Record<string, string> = {
  reservado: "Gerando", ativa: "Aguardando pagamento", liquidada: "Pago", divergente: "Em conferência (divergência)", conferencia: "Em conferência",
};
const ERROS: Record<string, string> = {
  sem_pendencias_ou_bloqueio: "Não há mensalidades a cobrar fora do débito automático, ou há pendência a conferir.",
  qr_expirando_aguarde: "O Pix atual está expirando. Aguarde alguns minutos e gere de novo.",
  grupo_sem_autorizacao_vigente: "Esta autorização não está vigente.",
};

export function PrimeiraMensalidadePix({ grupoId, isAdmin }: { grupoId: string; isAdmin: boolean }) {
  const qc = useQueryClient();
  const [gerando, setGerando] = useState(false);
  const q = useQuery({
    queryKey: ["pix_aut_primeira", grupoId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("fn_pix_aut_primeira_previa", { p_grupo: grupoId });
      if (error) throw error;
      return lerPrevia(data);
    },
  });
  const p = q.data;
  if (!p?.disponivel) return null;
  const atual = p.atual && p.atual.status !== "reservado" ? p.atual : null;
  if (!atual && !podeGerarPrimeira(p)) return null;

  async function gerar() {
    setGerando(true);
    try {
      const { data, error } = await supabase.functions.invoke("pix-aut-primeira-mensalidade", { body: { grupo_id: grupoId } });
      const d = data as { error?: string } | null;
      if (error || d?.error) {
        const m = d?.error ?? error?.message ?? "Falha ao gerar o Pix";
        throw new Error(ERROS[m] ?? m);
      }
      toast.success("Pix da 1ª mensalidade pronto");
    } catch (e) { toast.error(e instanceof Error ? e.message : "Falha ao gerar o Pix"); }
    finally { setGerando(false); qc.invalidateQueries({ queryKey: ["pix_aut_primeira", grupoId] }); }
  }
  async function copiar(t: string, ok: string) {
    try { await navigator.clipboard.writeText(t); toast.success(ok); } catch { toast.error("Não foi possível copiar"); }
  }
  const itens = p.itens.length ? p.itens : [];
  const total = atual?.valor ?? p.valor;

  return (
    <div className="rounded-md border p-3 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="font-medium">Pix da 1ª mensalidade</div>
        {atual && <span className="text-xs text-muted-foreground">{STATUS[atual.status] ?? atual.status}</span>}
      </div>
      <p className="text-xs text-muted-foreground">Mensalidades em aberto que não entram no próximo débito automático. Pagamento único, à parte da autorização.</p>
      {itens.length > 0 && (
        <div className="divide-y rounded-md border text-sm">
          {itens.map((i) => (
            <div key={`${i.cobranca_id ?? ""}${i.venda_id ?? ""}`} className="flex justify-between p-2">
              <span>{i.descricao} <span className="text-xs text-muted-foreground">venc. {dataBr(i.vencimento)}</span></span>
              <span>{brl(i.valor)}</span>
            </div>
          ))}
          <div className="flex justify-between p-2 font-semibold"><span>Total</span><span>{brl(total)}</span></div>
        </div>
      )}
      {atual?.status === "ativa" && atual.pix_copia_cola && (
        <div className="space-y-2">
          <div className="w-fit rounded-md bg-card p-2 border"><QRCodeSVG value={atual.pix_copia_cola} size={176} /></div>
          <p className="text-xs">Válido até <strong>{new Date(atual.expira_em).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}</strong>.</p>
          <textarea readOnly className="w-full h-20 rounded-md border bg-muted p-2 text-xs font-mono" value={atual.pix_copia_cola} />
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={() => copiar(atual.pix_copia_cola!, "Código copiado")}>Copiar Copia e Cola</Button>
            <Button size="sm" onClick={() => copiar(mensagemWhatsappPrimeira(itens, total, atual.pix_copia_cola!, atual.expira_em), "Mensagem copiada para o WhatsApp")}>
              Copiar mensagem para WhatsApp
            </Button>
          </div>
        </div>
      )}
      {atual?.status === "liquidada" && <p className="text-xs text-success">Pago em {dataBr(atual.data_pagamento)}. Itens baixados automaticamente.</p>}
      {atual && ["divergente", "conferencia"].includes(atual.status) && <p className="text-xs text-destructive">{atual.ultimo_erro ?? "Conferir com a equipe financeira."}</p>}
      {!atual && isAdmin && (
        <AlertDialog>
          <AlertDialogTrigger asChild><Button size="sm" disabled={gerando}>Gerar Pix da 1ª mensalidade</Button></AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Gerar Pix de {brl(p.valor)}?</AlertDialogTitle>
              <AlertDialogDescription>Cria um QR no Inter válido por 48 horas. Enquanto valer, estas mensalidades ficam reservadas e não podem ser cobradas no cartão nem baixadas manualmente.</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Voltar</AlertDialogCancel>
              <AlertDialogAction onClick={gerar}>Gerar</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
      {!atual && !isAdmin && <p className="text-xs text-muted-foreground">Só administradores geram este Pix.</p>}
    </div>
  );
}
