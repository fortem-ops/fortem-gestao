import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useUserRoles } from "@/hooks/useUserRoles";

/** Botão de teste real só para admin, proposta de teste e modo real_baixo_valor. As travas reais ficam no banco. */
export function podeMostrarTesteReal(p: { isAdmin: boolean; testeAdmin: boolean; modo?: string | null; cancelada: boolean }) {
  return p.isAdmin && p.testeAdmin && p.modo === "real_baixo_valor" && !p.cancelada;
}
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

type Mensalidade = { id: string; numero: number; vencimento: string; valor_centavos: number; status: string; tentativas: number; simulado: boolean };

const STATUS: Record<string, string> = {
  pendente: "Pendente", processando: "Cobrando", desconhecido: "Conferir", pago: "Paga",
  recusado: "Recusada", inadimplente: "Inadimplente", cancelado: "Cancelada",
};

/** Mensalidades da assinatura no cartão (planos 2027 do site) + ações da equipe. */
export function AssinaturaSite2027({ propostaId, familia, cancelada, testeAdmin = false }: { propostaId: string; familia: string; cancelada: boolean; testeAdmin?: boolean }) {
  const qc = useQueryClient();
  const { data: roles } = useUserRoles();
  const { data: modoTeste } = useQuery({
    queryKey: ["sistema-config", "planos_pagamento_modo_teste"],
    enabled: !!roles?.isAdmin && testeAdmin,
    queryFn: async () => {
      const { data } = await supabase.from("sistema_config").select("valor").eq("chave", "planos_pagamento_modo_teste").maybeSingle();
      return String(data?.valor ?? "").replace(/"/g, "");
    },
  });
  const podeTesteReal = podeMostrarTesteReal({ isAdmin: !!roles?.isAdmin, testeAdmin, modo: modoTeste, cancelada });
  const { data = [] } = useQuery({
    queryKey: ["mensalidades-2027", propostaId],
    queryFn: async () => {
      const { data, error } = await supabase.from("planos_2027_mensalidades")
        .select("id, numero, vencimento, valor_centavos, status, tentativas, simulado")
        .eq("proposta_id", propostaId).order("numero");
      if (error) throw error;
      return (data ?? []) as Mensalidade[];
    },
  });
  const atualizar = () => {
    qc.invalidateQueries({ queryKey: ["mensalidades-2027", propostaId] });
    qc.invalidateQueries({ queryKey: ["propostas-planos-2027"] });
    qc.invalidateQueries({ queryKey: ["sistema-config", "planos_pagamento_modo_teste"] });
  };
  const cancelar = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc("fn_recorrencia_2027_cancelar", { p_proposta_id: propostaId });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Assinatura cancelada"); atualizar(); },
    onError: (e: any) => toast.error(e?.message ?? "Não foi possível cancelar"),
  });
  const baixa = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.rpc("fn_recorrencia_2027_baixa_manual", { p_id: id, p_forma: "pix" });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Mensalidade marcada como paga"); atualizar(); },
    onError: (e: any) => toast.error(e?.message ?? "Não foi possível dar baixa"),
  });
  const testeReal = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("planos-recorrencia-diario", { body: { modo: "teste_real", proposta_id: propostaId } });
      if (error) throw error;
      return data as { ok?: boolean; resultado?: string; motivo?: string };
    },
    onSuccess: (r) => {
      if (r?.ok) toast.success(`Teste real: ${r.resultado ?? "concluído"}`);
      else toast.error(`Teste não executado: ${r?.motivo ?? "recusado"}`);
      atualizar();
    },
    onError: (e: any) => toast.error(e?.message ?? "Não foi possível executar o teste"),
  });

  if (data.length === 0) return null;
  const primeiraPendente = data.find((m) => m.status === "pendente")?.id;
  const brl = (c: number) => (c / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  return (
    <div className="mt-3 space-y-2 border-t border-border pt-3">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-sm font-medium">Assinatura no cartão</span>
        {data[0]?.simulado && <Badge variant="outline">Simulação</Badge>}
        {cancelada && <Badge variant="secondary">Cancelada</Badge>}
      </div>
      <div className="flex flex-wrap gap-2">
        {data.map((m) => (
          <div key={m.id} className="rounded-md border border-border px-2 py-1 text-xs">
            <span className="font-medium">{m.numero}ª</span> · {format(new Date(m.vencimento + "T12:00:00"), "dd/MM/yyyy")} · {brl(m.valor_centavos)} ·{" "}
            <span className={m.status === "inadimplente" || m.status === "desconhecido" ? "text-destructive" : ""}>{STATUS[m.status] ?? m.status}</span>
            {m.tentativas > 0 && m.status !== "pago" ? ` (${m.tentativas}/3)` : ""}
            {["recusado", "inadimplente"].includes(m.status) && (
              <Button size="sm" variant="link" className="h-auto p-0 ml-1 text-xs" disabled={baixa.isPending}
                onClick={() => baixa.mutate(m.id)}>Recebido por Pix</Button>
            )}
            {podeTesteReal && m.id === primeiraPendente && (
              <Button size="sm" variant="link" className="h-auto p-0 ml-1 text-xs" disabled={testeReal.isPending}
                onClick={() => testeReal.mutate()}>Cobrar mensalidade de teste (R$ 1,00)</Button>
            )}
          </div>
        ))}
      </div>
      {!cancelada && (
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button size="sm" variant="outline" disabled={cancelar.isPending}>Cancelar assinatura</Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Cancelar assinatura?</AlertDialogTitle>
              <AlertDialogDescription>
                {familia === "start_2027"
                  ? "O Start encerra no ciclo atual: o acesso vale até o fim do mês pago e nenhuma nova cobrança será feita."
                  : "As mensalidades em aberto deixam de ser cobradas automaticamente. Multa e pendências seguem o contrato."}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Voltar</AlertDialogCancel>
              <AlertDialogAction onClick={() => cancelar.mutate()}>Cancelar assinatura</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </div>
  );
}
