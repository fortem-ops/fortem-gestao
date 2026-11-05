import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Gift } from "lucide-react";
import { listarIndicacoes, MOTIVO_SEM_PONTOS_EQUIPE, STATUS_INDICACAO } from "@/lib/indicacoes";

const fmt = (d?: string | null) => (d ? new Date(d).toLocaleDateString("pt-BR") : "—");

/** Seção "Indicações" no perfil (equipe): quem este aluno indicou. Some quando não há nenhuma. */
export function IndicacoesDoIndicador({ alunoId }: { alunoId: string }) {
  const { data: lista = [] } = useQuery({
    queryKey: ["indicacoes-do-indicador", alunoId],
    queryFn: () => listarIndicacoes({ padrinho: alunoId }),
  });
  if (lista.length === 0) return null;

  return (
    <div className="glass-card rounded-lg p-4">
      <div className="mb-3 flex items-center gap-2">
        <Gift className="h-4 w-4 text-muted-foreground" />
        <span className="text-xs uppercase text-muted-foreground">Indicações ({lista.length})</span>
      </div>
      <div className="divide-y divide-border">
        {lista.map((i) => {
          const motivo = i.status === "convertida" && i.pontos_pagos <= 0
            ? (i.sem_pontos_motivo ? MOTIVO_SEM_PONTOS_EQUIPE[i.sem_pontos_motivo] || i.sem_pontos_motivo : "Sem pontos")
            : i.status === "recusada" ? i.motivo_recusa : null;
          return (
            <div key={i.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
              <div>
                <Link to={`/alunos/${i.indicado_id}`} className="font-medium text-primary hover:underline">{i.indicado_nome}</Link>
                <p className="text-xs text-muted-foreground">
                  Indicado em {fmt(i.criada_em)}{i.convertido_em ? ` · convertido em ${fmt(i.convertido_em)}` : ""}
                </p>
              </div>
              <div className="text-right">
                <Badge variant="outline" className="text-[10px]">{STATUS_INDICACAO[i.status] || i.status}</Badge>
                <p className="mt-1 text-xs text-muted-foreground">
                  {i.pontos_pagos > 0 ? `${i.pontos_pagos} pontos pagos` : motivo || "—"}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
