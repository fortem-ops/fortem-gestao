import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Undo2, Search } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { formatBRL } from "@/lib/vendas";

type Venda = { id: string; aluno_id: string; origem: string | null; status_pagamento: string; valor_final: number | null; valor: number | null };

/** Botão "Devolver PIX" de compra avulsa do portal (só admin; venda paga com Pix liquidado). */
export function DevolverPixVenda({ venda }: { venda: Venda }) {
  const qc = useQueryClient();
  const elegivelBase = venda.origem === "portal_avulso" && venda.status_pagamento === "pago";
  const [aberto, setAberto] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [chave, setChave] = useState(() => crypto.randomUUID());

  const { data: info, refetch } = useQuery({
    queryKey: ["devolver-pix-venda", venda.id],
    enabled: elegivelBase,
    queryFn: async () => {
      const sb = supabase as any;
      const [{ data: pix }, { data: est }, { data: aluno }] = await Promise.all([
        sb.from("pix_cobrancas").select("valor").eq("corrida_venda_id", venda.id).not("liquidado_em", "is", null).limit(1),
        sb.from("estornos_pix_venda").select("status").eq("venda_id", venda.id).in("status", ["reservado", "desconhecido", "devolvido"]).limit(1),
        sb.from("alunos").select("nome").eq("id", venda.aluno_id).maybeSingle(),
      ]);
      return {
        valor: pix?.[0] ? Number(pix[0].valor) : null,
        emConferencia: !!est?.[0] && est[0].status !== "devolvido",
        devolvido: est?.[0]?.status === "devolvido",
        nome: aluno?.nome ?? "o aluno",
      };
    },
  });

  if (!elegivelBase || !info || info.valor == null || info.devolvido) return null;

  const invalidar = () => {
    ["vendas-aluno", "creditos-aluno", "devolver-pix-venda"].forEach((k) => qc.invalidateQueries({ queryKey: [k] }));
  };

  const lerErro = async (error: any) => {
    try { const b = await error?.context?.json?.(); if (b?.error) return String(b.error); } catch { /* ignora */ }
    return error?.message ?? "Erro desconhecido";
  };

  const avisoCredito = (d: any) =>
    d?.credito_usado > 0 && !d?.credito_retirado
      ? " A sessão de Recovery já foi usada, então o crédito não foi retirado."
      : d?.credito_retirado ? " O crédito de Recovery não usado foi retirado." : "";

  async function devolver() {
    setEnviando(true);
    const { data, error } = await supabase.functions.invoke("estornar-cobranca", {
      body: { venda_id: venda.id, idempotency_key: chave, motivo },
    });
    setEnviando(false);
    setChave(crypto.randomUUID());
    if (error || !data?.success) {
      toast.error(error ? await lerErro(error) : data?.error ?? "Não foi possível devolver");
      refetch();
      return;
    }
    toast.success(`Pix de ${formatBRL(Number(data.valor_estornado))} devolvido.${avisoCredito(data)}`, { duration: 10000 });
    setAberto(false);
    invalidar();
  }

  async function consultar() {
    setEnviando(true);
    const { data, error } = await supabase.functions.invoke("estornar-cobranca", {
      body: { venda_id: venda.id, acao: "consultar" },
    });
    setEnviando(false);
    if (error || !data?.success) toast.error(error ? await lerErro(error) : data?.error ?? "Não foi possível consultar");
    else toast.success(`Devolução confirmada pelo banco.${avisoCredito(data)}`, { duration: 10000 });
    invalidar();
  }

  if (info.emConferencia) {
    return (
      <Button size="icon" variant="ghost" className="h-7 w-7" disabled={enviando} onClick={consultar}
        title="Devolução Pix em conferência: consultar no banco">
        <Search className="w-3.5 h-3.5" />
      </Button>
    );
  }

  return (
    <>
      <Button size="icon" variant="ghost" title="Devolver PIX"
        className="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10"
        onClick={() => { setMotivo(""); setAberto(true); }}>
        <Undo2 className="w-3.5 h-3.5" />
      </Button>
      <AlertDialog open={aberto} onOpenChange={(o) => !enviando && setAberto(o)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Devolver {formatBRL(info.valor)} por PIX para {info.nome}?</AlertDialogTitle>
            <AlertDialogDescription>
              O valor integral volta para quem pagou. A venda fica estornada e o crédito de Recovery é retirado só se ainda não foi usado.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Textarea placeholder="Motivo (mínimo 10 caracteres)" value={motivo} onChange={(e) => setMotivo(e.target.value)} />
          <AlertDialogFooter>
            <AlertDialogCancel disabled={enviando}>Cancelar</AlertDialogCancel>
            <Button variant="destructive" disabled={enviando || motivo.trim().length < 10} onClick={devolver}>
              {enviando ? "Devolvendo..." : "Devolver PIX"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
