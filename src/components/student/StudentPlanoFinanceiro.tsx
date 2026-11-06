import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { StudentPlan } from "./StudentPlan";
import { StudentFinanceiro } from "./StudentFinanceiro";
import ContratoFinanceiro from "@/pages/alunos/ContratoFinanceiro";

export const PLANO_FIN_SUBTABS = ["servicos", "cobrancas", "carteira"] as const;
export type PlanoFinSubTab = (typeof PLANO_FIN_SUBTABS)[number];

interface Props {
  student: any;
  sub: PlanoFinSubTab;
  onSubChange: (s: PlanoFinSubTab) => void;
}

const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function ResumoFinanceiro({ alunoId }: { alunoId: string }) {
  const { data } = useQuery({
    queryKey: ["plano-fin-resumo", alunoId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cobrancas")
        .select("id, valor, data_vencimento, status")
        .eq("aluno_id", alunoId)
        .in("status", ["pendente", "atrasado"])
        .order("data_vencimento", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });
  if (!data) return null;
  const hoje = new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
  const atrasadas = data.filter((c: any) => c.status === "atrasado" || c.data_vencimento < hoje);
  const proxima = data.find((c: any) => c.status === "pendente" && c.data_vencimento >= hoje);
  const totalAtraso = atrasadas.reduce((s: number, c: any) => s + Number(c.valor || 0), 0);
  const fmt = (d: string) => new Date(d + "T00:00:00").toLocaleDateString("pt-BR");

  return (
    <div className="glass-card rounded-lg border border-border p-4 flex flex-wrap items-center gap-x-8 gap-y-2">
      <div className="flex items-center gap-2">
        <span className="text-xs uppercase tracking-wide text-muted-foreground">Situação financeira</span>
        {atrasadas.length > 0 ? (
          <Badge variant="destructive">Em atraso</Badge>
        ) : (
          <Badge className="bg-success/15 text-success border-success/30" variant="outline">Em dia</Badge>
        )}
      </div>
      {atrasadas.length > 0 && (
        <div className="text-sm text-foreground">
          {atrasadas.length} cobrança(s) vencida(s) · <span className="font-semibold">{brl(totalAtraso)}</span>
        </div>
      )}
      <div className="text-sm text-muted-foreground">
        Próxima cobrança:{" "}
        {proxima ? (
          <span className="text-foreground font-medium">
            {brl(Number(proxima.valor || 0))} em {fmt(proxima.data_vencimento)}
          </span>
        ) : (
          <span>nenhuma pendente</span>
        )}
      </div>
    </div>
  );
}

export function StudentPlanoFinanceiro({ student, sub, onSubChange }: Props) {
  return (
    <div className="space-y-4 mt-4">
      <ResumoFinanceiro alunoId={student.id} />
      <Tabs value={sub} onValueChange={(v) => onSubChange(v as PlanoFinSubTab)}>
        <TabsList className="bg-secondary/30 border border-border">
          <TabsTrigger value="servicos">Plano & Créditos</TabsTrigger>
          <TabsTrigger value="cobrancas">Cobranças & Contrato</TabsTrigger>
          <TabsTrigger value="carteira">Meios de Pagamento</TabsTrigger>
        </TabsList>
        <TabsContent value="servicos"><StudentPlan student={student} /></TabsContent>
        <TabsContent value="cobrancas"><ContratoFinanceiro alunoId={student.id} /></TabsContent>
        <TabsContent value="carteira"><StudentFinanceiro student={student} /></TabsContent>
      </Tabs>
    </div>
  );
}
