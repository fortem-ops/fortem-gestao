import { useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link2, Plus } from "lucide-react";
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
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (destaqueId && data.some((m) => m.id === destaqueId)) ref.current?.scrollIntoView({ block: "center" });
  }, [destaqueId, data]);
  if (!data.length) return null;
  return (
    <Card className="border-warning/50">
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Saídas do Inter sem despesa ({data.length})</CardTitle>
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
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
