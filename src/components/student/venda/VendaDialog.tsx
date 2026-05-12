import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ShoppingCart, Calendar, Repeat, Zap } from "lucide-react";
import { toast } from "sonner";
import { formatBRL } from "@/lib/vendas";

type Props = { alunoId: string; alunoNome: string; open: boolean; onOpenChange: (v: boolean) => void };

export function VendaDialog({ alunoId, alunoNome, open, onOpenChange }: Props) {
  const qc = useQueryClient();
  const [tab, setTab] = useState("planos");

  const { data: planos = [], isLoading: lp } = useQuery({
    queryKey: ["planos-catalogo-ativos"],
    queryFn: async () => {
      const { data } = await (supabase as any).from("planos_catalogo").select("*").eq("ativo", true).order("valor");
      return data || [];
    },
    enabled: open,
  });

  const { data: servicos = [], isLoading: ls } = useQuery({
    queryKey: ["servicos-catalogo-ativos"],
    queryFn: async () => {
      const { data } = await (supabase as any).from("servicos_catalogo").select("*").eq("ativo", true).order("nome");
      return data || [];
    },
    enabled: open,
  });

  const vender = useMutation({
    mutationFn: async (payload: { tipo: "plano" | "servico"; item: any }) => {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await (supabase as any).from("vendas").insert({
        aluno_id: alunoId,
        tipo: payload.tipo,
        catalogo_id: payload.item.id,
        nome_snapshot: payload.item.nome,
        valor: payload.item.valor,
        vendedor_id: user?.id,
        status_pagamento: "pendente",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Venda registrada com sucesso");
      qc.invalidateQueries({ queryKey: ["vendas-aluno", alunoId] });
      qc.invalidateQueries({ queryKey: ["plano_ativo", alunoId] });
      qc.invalidateQueries({ queryKey: ["aluno_display_status", alunoId] });
      qc.invalidateQueries({ queryKey: ["creditos-aluno", alunoId] });
      onOpenChange(false);
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShoppingCart className="w-5 h-5 text-primary" /> Nova Venda — {alunoNome}
          </DialogTitle>
        </DialogHeader>

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="planos">Planos</TabsTrigger>
            <TabsTrigger value="servicos">Serviços</TabsTrigger>
          </TabsList>

          <TabsContent value="planos" className="mt-4">
            {lp ? <Skeleton className="h-32 w-full" /> : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {planos.map((p: any) => (
                  <div key={p.id} className="rounded-xl border border-border bg-card p-4 hover:border-primary/50 transition">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <span className="inline-block w-3 h-3 rounded-full" style={{ background: p.cor || "#999" }} />
                        <h4 className="font-heading font-semibold">{p.nome}</h4>
                      </div>
                      <span className="text-lg font-semibold text-primary">{formatBRL(p.valor)}</span>
                    </div>
                    <div className="flex flex-wrap gap-2 text-xs mb-3">
                      <Badge variant="outline" className="gap-1"><Repeat className="w-3 h-3" />{p.frequencia}</Badge>
                      <Badge variant="outline" className="gap-1"><Calendar className="w-3 h-3" />{p.periodo_meses} {p.periodo_meses === 1 ? "mês" : "meses"}</Badge>
                      <Badge variant="outline" className="gap-1"><Zap className="w-3 h-3" />{p.ilimitado ? "Ilimitado" : `${p.quantidade_creditos} créditos`}</Badge>
                    </div>
                    <Button size="sm" className="w-full" disabled={vender.isPending}
                      onClick={() => vender.mutate({ tipo: "plano", item: p })}>
                      Vender
                    </Button>
                  </div>
                ))}
                {planos.length === 0 && <p className="text-sm text-muted-foreground col-span-2 text-center py-6">Nenhum plano ativo. Cadastre em Administração &gt; Planos.</p>}
              </div>
            )}
          </TabsContent>

          <TabsContent value="servicos" className="mt-4">
            {ls ? <Skeleton className="h-32 w-full" /> : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {servicos.map((s: any) => (
                  <div key={s.id} className="rounded-xl border border-border bg-card p-4 hover:border-primary/50 transition">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="font-heading font-semibold">{s.nome}</h4>
                      <span className="text-lg font-semibold text-primary">{formatBRL(s.valor)}</span>
                    </div>
                    <div className="flex flex-wrap gap-2 text-xs mb-3">
                      <Badge variant="outline">{s.atividade}</Badge>
                      <Badge variant="outline" className="gap-1"><Zap className="w-3 h-3" />{s.quantidade_sessoes} sessões</Badge>
                    </div>
                    <Button size="sm" className="w-full" disabled={vender.isPending}
                      onClick={() => vender.mutate({ tipo: "servico", item: s })}>
                      Vender
                    </Button>
                  </div>
                ))}
                {servicos.length === 0 && <p className="text-sm text-muted-foreground col-span-2 text-center py-6">Nenhum serviço ativo. Cadastre em Administração &gt; Serviços.</p>}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
