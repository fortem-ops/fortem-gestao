import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Ban, Link2, Plus, RefreshCw } from "lucide-react";
import { useUserRoles } from "@/hooks/useUserRoles";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { MovimentoSaida } from "@/components/financeiro/ConciliarSaidaDialog";

const brl = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const fmtData = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}/${d.slice(0, 4)}`;

/** Saídas do Inter avisadas pela rotina diária e ainda sem despesa vinculada. */
export function useSaidasSemDespesa() {
  return useQuery({
    queryKey: ["saidas-sem-despesa"],
    queryFn: async (): Promise<MovimentoSaida[]> => {
      const { data: avisos, error } = await supabase.from("conciliacao_avisos")
        .select("movimento_id").is("resolvido_em", null).limit(500);
      if (error) throw error;
      const ids = (avisos ?? []).map((a) => a.movimento_id);
      if (!ids.length) return [];
      const [{ data: movs, error: e1 }, { data: vincs, error: e2 }] = await Promise.all([
        supabase.from("inter_extrato_movimentos").select("id, data_entrada, valor, titulo, descricao").in("id", ids),
        supabase.from("conciliacoes_bancarias").select("movimento_id").eq("desfeito", false).in("movimento_id", ids),
      ]);
      if (e1) throw e1;
      if (e2) throw e2;
      const vinculados = new Set((vincs ?? []).map((v) => v.movimento_id));
      return ((movs ?? []) as MovimentoSaida[])
        .filter((m) => !vinculados.has(m.id))
        .sort((a, b) => b.data_entrada.localeCompare(a.data_entrada));
    },
  });
}

export function SaidasSemDespesaCard({ destaqueId, onAssociar, onNova }: {
  destaqueId: string | null;
  onAssociar: (m: MovimentoSaida) => void;
  onNova: (m: MovimentoSaida) => void;
}) {
  const { data = [] } = useSaidasSemDespesa();
  const qc = useQueryClient();
  const [ignorar, setIgnorar] = useState<MovimentoSaida | null>(null);
  const [motivo, setMotivo] = useState("");
  const ign = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc("fn_ignorar_saida", { p_movimento_id: ignorar!.id, p_motivo: motivo });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Saída marcada como não sendo despesa");
      qc.invalidateQueries({ queryKey: ["saidas-sem-despesa"] });
      qc.invalidateQueries({ queryKey: ["conciliacao-bancaria"] });
      setIgnorar(null); setMotivo("");
    },
    onError: (e: { message?: string }) => toast.error(e?.message?.includes("sem_permissao") ? "Apenas administradores e coordenadores." : e?.message ?? "Erro"),
  });
  const { data: roles } = useUserRoles();
  const atualizar = useMutation({
    mutationFn: async () => {
      const s1 = await supabase.functions.invoke("inter-extrato-sync", { body: {} });
      if (s1.error) throw new Error("Falha ao buscar o extrato do Inter");
      const s2 = await supabase.functions.invoke("conciliar-extrato-diario", { body: {} });
      if (s2.error) throw new Error("Falha ao rodar a conciliação");
      return s2.data?.resumo ?? {};
    },
    onSuccess: (r: Record<string, number>) => {
      const conc = (r.conciliados ?? 0) + (r.baixados_automaticamente ?? 0) + (r.vinculados_manuais ?? 0);
      toast.success(`Conciliação atualizada: ${conc} conciliada(s), ${r.avisos_criados ?? 0} nova(s) saída(s) sem despesa`);
      ["saidas-sem-despesa", "conciliacao-bancaria", "despesas"].forEach((k) => qc.invalidateQueries({ queryKey: [k] }));
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const botao = roles?.isAdmin ? (
    <Button size="sm" variant="outline" disabled={atualizar.isPending} onClick={() => atualizar.mutate()}>
      <RefreshCw className={`h-4 w-4 mr-1 ${atualizar.isPending ? "animate-spin" : ""}`} />
      {atualizar.isPending ? "Atualizando…" : "ATUALIZAR CONCILIAÇÃO"}
    </Button>
  ) : null;
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (destaqueId && data.some((m) => m.id === destaqueId)) ref.current?.scrollIntoView({ block: "center" });
  }, [destaqueId, data]);
  if (!data.length) return botao ? <div className="flex justify-end">{botao}</div> : null;
  return (
    <Card className="border-warning/50">
      <CardHeader className="pb-2 flex flex-row flex-wrap items-center justify-between gap-2 space-y-0">
        <CardTitle className="text-base">Saídas do Inter sem despesa ({data.length})</CardTitle>
        {botao}
      </CardHeader>
      <CardContent className="space-y-2 max-h-80 overflow-y-auto">
        {data.map((m) => {
          const desc = [m.titulo, m.descricao].filter(Boolean).join(" · ") || "sem descrição";
          const dest = m.id === destaqueId;
          return (
            <div key={m.id} ref={dest ? ref : undefined}
              className={`flex flex-wrap items-center justify-between gap-2 rounded-md border p-2 ${dest ? "border-primary bg-primary/10" : ""}`}>
              <div className="min-w-0">
                <p className="text-sm font-medium">{brl(Number(m.valor))} · {fmtData(m.data_entrada)}</p>
                <p className="text-xs text-muted-foreground truncate">{desc}</p>
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => onAssociar(m)}><Link2 className="h-4 w-4 mr-1" />Associar a conta</Button>
                <Button size="sm" onClick={() => onNova(m)}><Plus className="h-4 w-4 mr-1" />Nova despesa</Button>
                <Button size="sm" variant="ghost" onClick={() => setIgnorar(m)}><Ban className="h-4 w-4 mr-1" />Não é despesa</Button>
              </div>
            </div>
          );
        })}
      </CardContent>
      {ignorar && (
        <Dialog open onOpenChange={(o) => !o && setIgnorar(null)}>
          <DialogContent>
            <DialogHeader><DialogTitle>Não é despesa</DialogTitle></DialogHeader>
            <p className="text-sm text-muted-foreground">
              {brl(Number(ignorar.valor))} · {fmtData(ignorar.data_entrada)} — {[ignorar.titulo, ignorar.descricao].filter(Boolean).join(" · ")}
            </p>
            <p className="text-sm">A saída sai desta lista e nada é apagado do extrato. Dá para desfazer em Conciliação Bancária.</p>
            <Input autoFocus placeholder="Motivo (ex.: estorno de entrada de teste)" value={motivo} maxLength={300} onChange={(e) => setMotivo(e.target.value)} />
            <DialogFooter>
              <Button variant="outline" onClick={() => setIgnorar(null)}>Cancelar</Button>
              <Button disabled={!motivo.trim() || ign.isPending} onClick={() => ign.mutate()}>{ign.isPending ? "Salvando…" : "Confirmar"}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </Card>
  );
}
