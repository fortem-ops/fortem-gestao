import { Link, useNavigate } from "react-router-dom";
import { AlertTriangle, CheckCircle2, ArrowRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useInadimplenciasAbertas } from "@/hooks/useContratos";
import { formatBRL, PLANO_LABELS, FORMA_PAGAMENTO_LABELS, type PlanoTipo, type FormaPagamento } from "@/types/financeiro";

export function InadimplentesWidget() {
  const navigate = useNavigate();
  const { data: inad = [], isLoading } = useInadimplenciasAbertas();

  const total = inad.length;
  const totalValor = inad.reduce((s, i) => s + Number(i.valor || 0), 0);
  const alunosAfetados = new Set(inad.map((i) => i.aluno_id)).size;

  const top = [...inad]
    .sort((a, b) => (Number(b.dias_atraso ?? 0)) - (Number(a.dias_atraso ?? 0)))
    .slice(0, 5);

  return (
    <div className="glass-card rounded-lg p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-destructive" />
          <h3 className="font-heading font-semibold text-foreground">Inadimplentes</h3>
          {total > 0 && (
            <Badge variant="destructive" className="ml-1">{total}</Badge>
          )}
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate("/financeiro/contratos")}
          className="text-xs"
        >
          Ver todos <ArrowRight className="w-3 h-3 ml-1" />
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}
        </div>
      ) : total === 0 ? (
        <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
          <CheckCircle2 className="w-10 h-10 text-success mb-2" />
          <p className="text-sm">Nenhuma inadimplência em aberto</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-2 mb-4">
            <div className="rounded-md bg-muted/30 p-2 text-center">
              <p className="text-xs text-muted-foreground">Em aberto</p>
              <p className="text-sm font-bold text-destructive">{formatBRL(totalValor)}</p>
            </div>
            <div className="rounded-md bg-muted/30 p-2 text-center">
              <p className="text-xs text-muted-foreground">Parcelas</p>
              <p className="text-sm font-bold text-foreground">{total}</p>
            </div>
            <div className="rounded-md bg-muted/30 p-2 text-center">
              <p className="text-xs text-muted-foreground">Alunos</p>
              <p className="text-sm font-bold text-foreground">{alunosAfetados}</p>
            </div>
          </div>

          <ul className="space-y-2">
            {top.map((i: any) => {
              const plano = i.contratos?.plano_tipo as PlanoTipo | undefined;
              const forma = i.contratos?.forma_pagamento as FormaPagamento | undefined;
              return (
                <li
                  key={i.id}
                  className="flex items-center justify-between gap-2 rounded-md border border-border/40 bg-card/40 p-2 hover:bg-muted/30 transition-colors"
                >
                  <div className="min-w-0 flex-1">
                    <Link
                      to={`/alunos/${i.aluno_id}?tab=contrato`}
                      className="text-sm font-medium text-foreground hover:text-primary hover:underline truncate block"
                    >
                      {i.alunos?.nome ?? "—"}
                    </Link>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {plano && (
                        <Badge variant="outline" className="text-[10px] h-4 px-1">
                          {PLANO_LABELS[plano] ?? plano}
                        </Badge>
                      )}
                      {forma && (
                        <Badge variant="outline" className="text-[10px] h-4 px-1">
                          {FORMA_PAGAMENTO_LABELS[forma] ?? forma}
                        </Badge>
                      )}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-semibold text-destructive">{formatBRL(Number(i.valor))}</p>
                    <Badge variant="destructive" className="text-[10px] h-4 px-1 mt-0.5">
                      {i.dias_atraso ?? 0}d atraso
                    </Badge>
                  </div>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </div>
  );
}
