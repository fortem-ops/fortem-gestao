import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  AlertTriangle,
  ChevronDown,
  CreditCard,
  FileX,
  Loader2,
} from "lucide-react";
import { useUserRoles } from "@/hooks/useUserRoles";
import { useToast } from "@/hooks/use-toast";
import { RescisaoDialog } from "@/components/contratos/RescisaoDialog";
import {
  LABEL_PLANO,
  LABEL_PAGAMENTO,
  LABEL_STATUS,
  type Contrato,
  type ServicoUtilizado,
} from "@/lib/contratos-calc";

interface Props {
  alunoId: string;
}

const fmt = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const fmtDate = (d: string | null) =>
  d ? new Date(d + "T00:00:00").toLocaleDateString("pt-BR") : "—";

export default function ContratoFinanceiro({ alunoId }: Props) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { data: roles } = useUserRoles();
  const podeCancelar = !!(roles?.isAdmin || roles?.isCoordAdmin);
  const [rescOpen, setRescOpen] = useState(false);

  const { data: contratos = [], isLoading } = useQuery({
    queryKey: ["contratos-aluno", alunoId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contratos")
        .select("*")
        .eq("aluno_id", alunoId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as Contrato[];
    },
  });

  const ativo = contratos.find((c) => c.status === "ativo") ?? null;
  const historico = contratos.filter((c) => c.status !== "ativo");

  const { data: cobrancas = [] } = useQuery({
    queryKey: ["cobrancas-contrato", ativo?.id],
    enabled: !!ativo,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cobrancas")
        .select("*")
        .eq("contrato_id", ativo!.id)
        .order("data_vencimento", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: ciclo } = useQuery({
    queryKey: ["ciclo-ativo", ativo?.id],
    enabled: !!ativo,
    queryFn: async () => {
      const { data } = await supabase
        .from("ciclos_credito")
        .select("*")
        .eq("contrato_id", ativo!.id)
        .eq("status", "ativo")
        .maybeSingle();
      return data;
    },
  });

  const { data: inadimplencias = [] } = useQuery({
    queryKey: ["inadimplencias-contrato", ativo?.id],
    enabled: !!ativo,
    queryFn: async () => {
      const { data } = await supabase
        .from("inadimplencias")
        .select("*")
        .eq("contrato_id", ativo!.id)
        .eq("status", "aberta");
      return data ?? [];
    },
  });

  if (isLoading) {
    return (
      <div className="flex justify-center p-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!contratos.length) {
    return (
      <Card className="p-8 text-center text-muted-foreground">
        <FileX className="h-10 w-10 mx-auto mb-3 opacity-50" />
        Nenhum contrato cadastrado para este aluno.
      </Card>
    );
  }

  const proxCob = cobrancas.find((c) => c.status === "pendente");

  const handleCancelar = async () => {
    if (!ativo) return;
    const hoje = new Date().toISOString().split("T")[0];
    const { error } = await supabase
      .from("contratos")
      .update({
        status: "cancelado",
        motivo_cancelamento: "Solicitação do aluno",
        data_cancelamento: hoje,
      })
      .eq("id", ativo.id);
    if (error) {
      toast({ title: "Erro ao cancelar", description: error.message, variant: "destructive" });
      return;
    }
    await supabase
      .from("cobrancas")
      .update({ status: "cancelado" })
      .eq("contrato_id", ativo.id)
      .eq("status", "pendente");
    await supabase
      .from("ciclos_credito")
      .update({ status: "cancelado" })
      .eq("contrato_id", ativo.id)
      .eq("status", "ativo");

    toast({ title: "Contrato cancelado", description: "Cobranças e créditos suspensos." });
    qc.invalidateQueries({ queryKey: ["contratos-aluno", alunoId] });
    qc.invalidateQueries({ queryKey: ["cobrancas-contrato", ativo.id] });
    qc.invalidateQueries({ queryKey: ["ciclo-ativo", ativo.id] });
  };

  return (
    <div className="space-y-6">
      {/* Contrato ativo */}
      {ativo ? (
        <Card className="p-5 space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="space-y-2">
              <div className="flex flex-wrap gap-2">
                <Badge className={LABEL_STATUS[ativo.status]?.color ?? "bg-gray-500"}>
                  {LABEL_STATUS[ativo.status]?.label ?? ativo.status}
                </Badge>
                <Badge variant="outline">{LABEL_PLANO[ativo.plano_tipo] ?? ativo.plano_tipo}</Badge>
                <Badge variant="outline">
                  {ativo.vigencia_tipo === "anual" ? "Anual" : "Mensal"}
                </Badge>
                <Badge variant="outline">{LABEL_PAGAMENTO[ativo.forma_pagamento]}</Badge>
              </div>
              <div className="text-sm text-muted-foreground">
                Início {fmtDate(ativo.data_inicio)} · Fim {fmtDate(ativo.data_fim)}
              </div>
            </div>
            {podeCancelar && (
              <Button variant="destructive" size="sm" onClick={() => setRescOpen(true)}>
                Cancelar contrato
              </Button>
            )}
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-2">
            <Info label="Valor mensal" value={fmt(ativo.valor_cobrado)} />
            <Info
              label="Próxima cobrança"
              value={proxCob ? `${fmtDate(proxCob.data_vencimento)} · ${fmt(Number(proxCob.valor))}` : "—"}
            />
            <Info
              label="Créditos do ciclo"
              value={
                ciclo
                  ? `${ciclo.creditos_usados}/${ciclo.creditos_liberados}`
                  : "—"
              }
            />
            <Info label="Créditos contrato" value={String(ativo.creditos_total)} />
          </div>
        </Card>
      ) : (
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Sem contrato ativo</AlertTitle>
          <AlertDescription>Este aluno não possui contrato em vigência.</AlertDescription>
        </Alert>
      )}

      {/* Inadimplências */}
      {inadimplencias.length > 0 && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Inadimplências em aberto</AlertTitle>
          <AlertDescription>
            <ul className="mt-2 space-y-1">
              {inadimplencias.map((i) => {
                const dias = Math.floor(
                  (Date.now() - new Date(i.data_vencimento + "T00:00:00").getTime()) /
                    86400000,
                );
                return (
                  <li key={i.id} className="flex justify-between gap-3 text-sm">
                    <span>
                      Venc. {fmtDate(i.data_vencimento)} · {dias} dia(s) em atraso
                    </span>
                    <span className="font-semibold">{fmt(Number(i.valor))}</span>
                  </li>
                );
              })}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      {/* Cobranças */}
      {ativo && (
        <Card className="p-5">
          <h3 className="font-medium flex items-center gap-2 mb-3">
            <CreditCard className="h-4 w-4" /> Cobranças
          </h3>
          {cobrancas.length === 0 ? (
            <div className="text-sm text-muted-foreground">Nenhuma cobrança registrada.</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Vencimento</TableHead>
                  <TableHead>Valor</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Forma</TableHead>
                  <TableHead>TID</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {cobrancas.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell>{fmtDate(c.data_vencimento)}</TableCell>
                    <TableCell>{fmt(Number(c.valor))}</TableCell>
                    <TableCell>
                      <Badge
                        className={
                          c.status === "pago"
                            ? "bg-green-600"
                            : c.status === "atrasado"
                            ? "bg-red-600"
                            : c.status === "cancelado"
                            ? "bg-gray-500"
                            : "bg-yellow-500"
                        }
                      >
                        {c.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs">
                      {LABEL_PAGAMENTO[c.forma_pagamento as keyof typeof LABEL_PAGAMENTO] ??
                        c.forma_pagamento}
                    </TableCell>
                    <TableCell className="text-xs font-mono text-muted-foreground">
                      {c.tid ?? "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </Card>
      )}

      {/* Histórico */}
      {historico.length > 0 && (
        <Collapsible>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" className="w-full justify-between">
              <span>Histórico de contratos ({historico.length})</span>
              <ChevronDown className="h-4 w-4" />
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="space-y-2 mt-2">
            {historico.map((c) => (
              <Card key={c.id} className="p-3 flex flex-wrap items-center justify-between gap-2 text-sm">
                <div className="flex flex-wrap gap-2 items-center">
                  <Badge className={LABEL_STATUS[c.status]?.color ?? "bg-gray-500"}>
                    {LABEL_STATUS[c.status]?.label ?? c.status}
                  </Badge>
                  <span>{LABEL_PLANO[c.plano_tipo] ?? c.plano_tipo}</span>
                  <span className="text-muted-foreground">
                    {fmtDate(c.data_inicio)} → {fmtDate(c.data_fim)}
                  </span>
                </div>
                <span className="font-medium">{fmt(c.valor_cobrado)}/mês</span>
              </Card>
            ))}
          </CollapsibleContent>
        </Collapsible>
      )}

      {/* Dialog de rescisão */}
      {ativo && (
        <RescisaoDialog
          contrato={ativo}
          servicosUtilizados={[] as ServicoUtilizado[]}
          open={rescOpen}
          onOpenChange={setRescOpen}
          onConfirmar={handleCancelar}
        />
      )}
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="font-medium text-sm">{value}</div>
    </div>
  );
}
