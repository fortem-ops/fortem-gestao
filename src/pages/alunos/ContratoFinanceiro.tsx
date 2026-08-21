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
  CheckCircle,
  Calendar,
  Link as LinkIcon,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useUserRoles } from "@/hooks/useUserRoles";
import { useToast } from "@/hooks/use-toast";
import { RescisaoDialog } from "@/components/contratos/RescisaoDialog";
import { AlterarDadosVendaDialog } from "@/components/financeiro/AlterarDadosVendaDialog";
import { HistoricoVendas } from "@/components/student/venda/HistoricoVendas";
import {
  LABEL_PLANO,
  LABEL_PAGAMENTO,
  LABEL_STATUS,
  type Contrato,
  type ServicoUtilizado,
} from "@/lib/contratos-calc";
import {
  FORMAS_RECEBIMENTO,
  getFormaRecebimento,
  labelFormaPagamento,
} from "@/lib/formasRecebimento";


interface Props {
  alunoId: string;
}

const fmt = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const fmtDate = (d: string | null) =>
  d ? new Date(d + "T00:00:00").toLocaleDateString("pt-BR") : "—";

const STATUS_ATIVOS = ["ativo", "inadimplente", "suspenso"] as const;

export default function ContratoFinanceiro({ alunoId }: Props) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { data: roles } = useUserRoles();
  const podeCancelar = !!(roles?.isAdmin || roles?.isCoordAdmin);

  const [rescContrato, setRescContrato] = useState<Contrato | null>(null);
  const [baixaOpen, setBaixaOpen] = useState(false);
  const [baixaCobranca, setBaixaCobranca] = useState<any | null>(null);
  const [baixaData, setBaixaData] = useState(new Date().toISOString().split("T")[0]);
  const [baixaForma, setBaixaForma] = useState<string>("dinheiro");
  const [baixaLoading, setBaixaLoading] = useState(false);

  const { data: contratos = [], isLoading } = useQuery({
    queryKey: ["contratos-aluno", alunoId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contratos")
        .select("*")
        .eq("aluno_id", alunoId)
        .order("data_inicio", { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as Contrato[];
    },
  });

  const ativos = contratos
    .filter((c) => (STATUS_ATIVOS as readonly string[]).includes(c.status))
    .sort((a, b) => (a.data_inicio ?? "").localeCompare(b.data_inicio ?? ""));
  const historico = contratos.filter(
    (c) => !(STATUS_ATIVOS as readonly string[]).includes(c.status),
  );

  if (isLoading) {
    return (
      <div className="flex justify-center p-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!contratos.length) {
    return (
      <div className="space-y-6">
        <Card className="p-8 text-center text-muted-foreground">
          <FileX className="h-10 w-10 mx-auto mb-3 opacity-50" />
          Nenhum contrato cadastrado para este aluno.
        </Card>
        <Card className="p-5">
          <h3 className="font-medium mb-3">Histórico de Pagamentos</h3>
          <HistoricoVendas alunoId={alunoId} />
        </Card>
      </div>
    );
  }

  const handleCancelar = async (payload: {
    dataCancelamento: string;
    valorMulta: number;
    tratamento: "estorno" | "nova_cobranca";
    vencimentoMulta?: string;
  }) => {
    const alvo = rescContrato;
    if (!alvo) return;
    const hoje = new Date().toISOString().split("T")[0];
    const isImediato = payload.dataCancelamento <= hoje;
    const motivo = isImediato
      ? "Solicitação do aluno"
      : `Cancelamento agendado para ${payload.dataCancelamento}`;

    const { error } = await supabase
      .from("contratos")
      .update({
        status: isImediato ? "cancelado" : alvo.status,
        motivo_cancelamento: motivo,
        data_cancelamento: payload.dataCancelamento,
        data_fim: payload.dataCancelamento,
      })
      .eq("id", alvo.id);
    if (error) {
      toast({ title: "Erro ao cancelar", description: error.message, variant: "destructive" });
      return;
    }

    // Cancela cobranças pendentes posteriores à data efetiva
    await supabase
      .from("cobrancas")
      .update({ status: "cancelado" })
      .eq("contrato_id", alvo.id)
      .eq("status", "pendente")
      .gt("data_vencimento", payload.dataCancelamento);

    // Suspende ciclos ativos somente se imediato
    if (isImediato) {
      await supabase
        .from("ciclos_credito")
        .update({ status: "cancelado" })
        .eq("contrato_id", alvo.id)
        .eq("status", "ativo");
    }

    // Espelha APENAS no plano vinculado a este contrato (nunca nos demais
    // planos ativos do aluno — isso derrubava contratos paralelos).
    if (alvo.plano_id) {
      await supabase
        .from("planos")
        .update({
          renovacao_automatica: false,
          data_fim: payload.dataCancelamento,
          ativo: isImediato ? false : true,
        } as any)
        .eq("id", alvo.plano_id);
    }


    // Tratamento da multa
    if (payload.valorMulta > 0) {
      const numero = 999; // marcador de movimento extra-ciclo
      if (payload.tratamento === "estorno") {
        await supabase.from("cobrancas").insert({
          contrato_id: alvo.id,
          aluno_id: alunoId,
          numero_ciclo: numero,
          valor: -Math.abs(payload.valorMulta),
          data_vencimento: hoje,
          data_pagamento: hoje,
          status: "pago",
          forma_pagamento: alvo.forma_pagamento,
          meio_registro: "estorno_cancelamento",
        } as any);
      } else {
        await supabase.from("cobrancas").insert({
          contrato_id: alvo.id,
          aluno_id: alunoId,
          numero_ciclo: numero,
          valor: Math.abs(payload.valorMulta),
          data_vencimento: payload.vencimentoMulta ?? hoje,
          status: "pendente",
          forma_pagamento: alvo.forma_pagamento,
          meio_registro: "multa_cancelamento",
        } as any);
      }
    }

    toast({
      title: isImediato ? "Contrato cancelado" : "Cancelamento agendado",
      description: isImediato
        ? "Cobranças futuras e créditos foram suspensos."
        : `Efetivação em ${new Date(payload.dataCancelamento + "T00:00:00").toLocaleDateString("pt-BR")}.`,
    });
    qc.invalidateQueries({ queryKey: ["contratos-aluno", alunoId] });
    qc.invalidateQueries({ queryKey: ["cobrancas-contrato", alvo.id] });
    qc.invalidateQueries({ queryKey: ["ciclo-ativo", alvo.id] });
    qc.invalidateQueries({ queryKey: ["plano-aluno", alunoId] });
    qc.invalidateQueries({ queryKey: ["plano", alunoId] });
    setRescContrato(null);
  };

  const handleBaixa = async () => {
    if (!baixaCobranca) return;
    const forma = getFormaRecebimento(baixaForma);
    if (!forma) return;
    setBaixaLoading(true);
    try {
      const { error } = await supabase
        .from("cobrancas")
        .update({
          status: "pago",
          data_pagamento: baixaData,
          forma_pagamento: forma.value,
          gateway: forma.gateway,
          meio_registro: "manual_admin",
        })
        .eq("id", baixaCobranca.id);

      if (error) throw error;

      await supabase
        .from("inadimplencias")
        .update({ status: "regularizada", data_regularizacao: baixaData })
        .eq("cobranca_id", baixaCobranca.id)
        .eq("status", "aberta");

      // Propaga a forma recebida para a venda vinculada, quando ela ainda
      // estiver "a definir" (pendente/nula).
      const { data: vendasDiretas } = await (supabase as any)
        .from("vendas")
        .update({ forma_pagamento: forma.vendaForma, status_pagamento: "pago" })
        .eq("cobranca_id", baixaCobranca.id)
        .or("forma_pagamento.is.null,forma_pagamento.eq.pendente")
        .select("id");

      if (!vendasDiretas?.length) {
        const contrato = contratos.find((c) => c.id === baixaCobranca.contrato_id) as any;
        if (contrato?.plano_id) {
          await (supabase as any)
            .from("vendas")
            .update({ forma_pagamento: forma.vendaForma, status_pagamento: "pago" })
            .eq("aluno_id", alunoId)
            .eq("plano_id", contrato.plano_id)
            .or("forma_pagamento.is.null,forma_pagamento.eq.pendente");
        }
      }

      toast({ title: "Baixa registrada", description: `Cobrança de ${fmt(Number(baixaCobranca.valor))} recebida via ${forma.label}.` });
      setBaixaOpen(false);
      const contratoId = baixaCobranca.contrato_id;
      setBaixaCobranca(null);
      qc.invalidateQueries({ queryKey: ["cobrancas-contrato", contratoId] });
      qc.invalidateQueries({ queryKey: ["contratos-aluno", alunoId] });
      qc.invalidateQueries({ queryKey: ["inadimplencias-contrato", contratoId] });
      qc.invalidateQueries({ queryKey: ["inadimplencias-aluno", alunoId] });
      qc.invalidateQueries({ queryKey: ["vendas-aluno", alunoId] });
      qc.invalidateQueries({ queryKey: ["inadimplencias", "abertas"] });
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    } finally {
      setBaixaLoading(false);
    }
  };

  const pedirBaixa = (c: any) => {
    setBaixaCobranca(c);
    setBaixaData(new Date().toISOString().split("T")[0]);
    setBaixaForma("dinheiro");

    setBaixaOpen(true);
  };

  const hojeStr = new Date().toISOString().split("T")[0];

  return (
    <div className="space-y-6">
      {/* Contratos ativos (vigente + adicionais/futuros) */}
      {ativos.length > 0 ? (
        ativos.map((c, idx) => {
          let rotulo: { label: string; variant: "default" | "secondary" | "outline" } | null = null;
          if (ativos.length > 1) {
            if (idx === 0) rotulo = { label: "Vigente", variant: "default" };
            else if ((c.data_inicio ?? "") > hojeStr) rotulo = { label: "Futuro", variant: "secondary" };
            else rotulo = { label: "Adicional", variant: "secondary" };
          }
          return (
            <ContratoAtivoCard
              key={c.id}
              contrato={c}
              rotulo={rotulo}
              podeCancelar={podeCancelar}
              onCancelar={() => setRescContrato(c)}
              onPedirBaixa={pedirBaixa}
            />
          );
        })
      ) : (
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Sem contrato ativo</AlertTitle>
          <AlertDescription>Este aluno não possui contrato em vigência.</AlertDescription>
        </Alert>
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
                <span className="font-medium">
                  {c.vigencia_tipo === "mensal" ? `${fmt(c.valor_cobrado)}/mês` : `${fmt(c.valor_cobrado)} total`}
                </span>
              </Card>
            ))}
          </CollapsibleContent>
        </Collapsible>
      )}

      {/* Histórico de Pagamentos (vendas) */}
      <Card className="p-5">
        <h3 className="font-medium mb-3">Histórico de Pagamentos</h3>
        <HistoricoVendas alunoId={alunoId} />
      </Card>

      {/* Dialog de rescisão */}
      {rescContrato && (
        <RescisaoDialog
          contrato={rescContrato}
          servicosUtilizados={[] as ServicoUtilizado[]}
          open={!!rescContrato}
          onOpenChange={(v) => !v && setRescContrato(null)}
          onConfirmar={handleCancelar}
        />
      )}

      {/* Dialog de baixa manual */}
      <Dialog open={baixaOpen} onOpenChange={setBaixaOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Registrar pagamento manual</DialogTitle>
            <DialogDescription>
              Cobrança de <strong>{fmt(Number(baixaCobranca?.valor))}</strong> com vencimento em{" "}
              <strong>{fmtDate(baixaCobranca?.data_vencimento)}</strong>
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="baixa-data" className="flex items-center gap-1">
                <Calendar className="h-3.5 w-3.5" /> Data do pagamento
              </Label>
              <Input
                id="baixa-data"
                type="date"
                value={baixaData}
                onChange={(e) => setBaixaData(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="baixa-gateway">Meio de pagamento</Label>
              <Select value={baixaGateway} onValueChange={setBaixaGateway}>
                <SelectTrigger id="baixa-gateway">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="dinheiro">Dinheiro</SelectItem>
                  <SelectItem value="maquina">Máquina (débito/crédito)</SelectItem>
                  <SelectItem value="inter_pix">Pix</SelectItem>
                  <SelectItem value="rede">Cartão de Crédito (Rede)</SelectItem>
                  <SelectItem value="boleto">Boleto</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBaixaOpen(false)} disabled={baixaLoading}>
              Cancelar
            </Button>
            <Button
              onClick={handleBaixa}
              disabled={baixaLoading || !baixaData}
              className="bg-green-600 hover:bg-green-700 text-white gap-1"
            >
              {baixaLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />}
              Confirmar pagamento
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
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

interface ContratoAtivoCardProps {
  contrato: Contrato;
  rotulo: { label: string; variant: "default" | "secondary" | "outline" } | null;
  podeCancelar: boolean;
  onCancelar: () => void;
  onPedirBaixa: (cobranca: any) => void;
}

function ContratoAtivoCard({ contrato, rotulo, podeCancelar, onCancelar, onPedirBaixa }: ContratoAtivoCardProps) {
  const [alterarOpen, setAlterarOpen] = useState(false);
  const { toast } = useToast();
  const [copiandoLink, setCopiandoLink] = useState(false);

  const { data: contratoDoc } = useQuery({
    queryKey: ["contrato-documento", contrato.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contratos_documentos")
        .select("id, aceite")
        .eq("contrato_id", contrato.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  async function copiarLinkAceite() {
    if (!contratoDoc?.id) return;
    setCopiandoLink(true);
    try {
      const { data, error } = await (supabase as any).rpc("fn_criar_link_contrato", {
        p_contrato_documento_id: contratoDoc.id,
      });
      if (error) throw error;
      if (!data?.ok || !data?.token) {
        throw new Error(data?.motivo ?? "Não foi possível gerar o link.");
      }
      await navigator.clipboard.writeText(`${window.location.origin}/contrato/${data.token}`);
      toast({ title: "Link copiado! Válido por 7 dias." });
    } catch (e: any) {
      toast({
        title: "Erro ao gerar link",
        description: e?.message ?? "Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setCopiandoLink(false);
    }
  }


  const { data: cobrancas = [] } = useQuery({
    queryKey: ["cobrancas-contrato", contrato.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cobrancas")
        .select("*")
        .eq("contrato_id", contrato.id)
        .order("data_vencimento", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: ciclo } = useQuery({
    queryKey: ["ciclo-ativo", contrato.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("ciclos_credito")
        .select("*")
        .eq("contrato_id", contrato.id)
        .eq("status", "ativo")
        .maybeSingle();
      return data;
    },
  });

  const { data: inadimplencias = [] } = useQuery({
    queryKey: ["inadimplencias-contrato", contrato.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("inadimplencias")
        .select("*")
        .eq("contrato_id", contrato.id)
        .eq("status", "aberta");
      return data ?? [];
    },
  });

  const proxCob = cobrancas.find((c) => c.status === "pendente");

  // Valores exibidos: as cobranças são a fonte de verdade quando existem.
  // Sem cobranças, planos anuais mensalizados (start_plus/power/pro/max)
  // guardam a MENSALIDADE em valor_cobrado — os demais guardam o total.
  const valores = (() => {
    const somaCob = cobrancas.reduce((s, c: any) => s + (Number(c.valor) || 0), 0);
    if (cobrancas.length > 0 && somaCob > 0) {
      return { total: somaCob, mensal: somaCob / cobrancas.length };
    }
    const meses =
      contrato.vigencia_tipo === "anual" ? 12 : contrato.vigencia_tipo === "semestral" ? 6 : 1;
    const mensalizados = ["start_plus", "power", "pro", "max"];
    if (contrato.vigencia_tipo !== "mensal" && mensalizados.includes(contrato.plano_tipo)) {
      return { total: contrato.valor_cobrado * meses, mensal: contrato.valor_cobrado };
    }
    return {
      total: contrato.valor_cobrado,
      mensal: contrato.parcelas ? contrato.valor_cobrado / contrato.parcelas : contrato.valor_cobrado,
    };
  })();

  return (
    <div className="space-y-4">
      <Card className="p-5 space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-2">
            <div className="flex flex-wrap gap-2 items-center">
              {rotulo && (
                <Badge variant={rotulo.variant}>{rotulo.label}</Badge>
              )}
              <Badge className={LABEL_STATUS[contrato.status]?.color ?? "bg-gray-500"}>
                {LABEL_STATUS[contrato.status]?.label ?? contrato.status}
              </Badge>
              <Badge variant="outline">{LABEL_PLANO[contrato.plano_tipo] ?? contrato.plano_tipo}</Badge>
              <Badge variant="outline">
                {contrato.vigencia_tipo === "anual"
                  ? "Anual"
                  : contrato.vigencia_tipo === "semestral"
                    ? "Semestral"
                    : "Mensal"}

              </Badge>
              <Badge variant="outline">{LABEL_PAGAMENTO[contrato.forma_pagamento]}</Badge>
            </div>
            <div className="text-sm text-muted-foreground">
              Início {fmtDate(contrato.data_inicio)} · Fim {fmtDate(contrato.data_fim)}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {contratoDoc?.id &&
              (contratoDoc.aceite ? (
                <span className="text-xs text-emerald-500 font-medium">Contrato assinado</span>
              ) : (
                <Button variant="outline" size="sm" onClick={copiarLinkAceite} disabled={copiandoLink}>
                  {copiandoLink ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <LinkIcon className="h-4 w-4 mr-2" />
                  )}
                  Copiar link de aceite
                </Button>
              ))}
            {podeCancelar && cobrancas.some((c) => c.status === "pendente" || c.status === "atrasado") && (
              <Button variant="outline" size="sm" onClick={() => setAlterarOpen(true)}>
                Alterar dados da venda
              </Button>
            )}
            {podeCancelar && (
              <Button variant="destructive" size="sm" onClick={onCancelar}>
                Cancelar contrato
              </Button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-2">
          {contrato.vigencia_tipo === "mensal" ? (
            <Info label="Valor mensal" value={fmt(valores.mensal)} />
          ) : (
            <>
              <Info label="Valor total do contrato" value={fmt(valores.total)} />
              <Info label="Valor mensal" value={fmt(valores.mensal)} />
            </>
          )}
          <Info
            label="Próxima cobrança"
            value={proxCob ? `${fmtDate(proxCob.data_vencimento)} · ${fmt(Number(proxCob.valor))}` : "—"}
          />
          {contrato.plano_tipo === "corrida" ? (
            <div className="col-span-2">
              <div className="text-xs text-muted-foreground">Créditos</div>
              <div className="font-medium text-sm">Sem controle de créditos</div>
            </div>
          ) : (
            <>
              <Info
                label="Créditos do ciclo"
                value={ciclo ? `${ciclo.creditos_usados}/${ciclo.creditos_liberados}` : "—"}
              />
              <Info
                label="Créditos contrato"
                value={contrato.creditos_total != null ? String(contrato.creditos_total) : "—"}
              />
            </>
          )}

        </div>
      </Card>

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
                <TableHead className="w-8 text-center">#</TableHead>
                <TableHead>Vencimento</TableHead>
                <TableHead>Pgto</TableHead>
                <TableHead>Valor</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Meio</TableHead>
                <TableHead>TID</TableHead>
                {podeCancelar && <TableHead className="text-right">Ação</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {cobrancas.map((c, idx) => (
                <TableRow key={c.id} className={c.status === "pago" ? "opacity-60" : ""}>
                  <TableCell className="text-center text-xs text-muted-foreground font-mono">{idx + 1}</TableCell>
                  <TableCell className="whitespace-nowrap">{fmtDate(c.data_vencimento)}</TableCell>
                  <TableCell className="whitespace-nowrap">{c.data_pagamento ? fmtDate(c.data_pagamento) : "—"}</TableCell>
                  <TableCell className="whitespace-nowrap font-medium">{fmt(Number(c.valor))}</TableCell>
                  <TableCell>
                    <Badge
                      className={
                        c.status === "pago"
                          ? "bg-green-600 hover:bg-green-600"
                          : c.status === "atrasado"
                          ? "bg-red-600 hover:bg-red-600"
                          : c.status === "cancelado"
                          ? "bg-gray-500 hover:bg-gray-500"
                          : "bg-yellow-500 hover:bg-yellow-500 text-black"
                      }
                    >
                      {c.status === "pago" ? "Pago" :
                       c.status === "pendente" ? "Pendente" :
                       c.status === "atrasado" ? "Atrasado" :
                       c.status === "cancelado" ? "Cancelado" :
                       c.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs">
                    {LABEL_PAGAMENTO[c.forma_pagamento as keyof typeof LABEL_PAGAMENTO] ?? c.forma_pagamento}
                  </TableCell>
                  <TableCell className="text-xs font-mono text-muted-foreground">
                    {c.tid ?? "—"}
                  </TableCell>
                  {podeCancelar && (
                    <TableCell className="text-right">
                      {(c.status === "pendente" || c.status === "atrasado") && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 text-xs gap-1 border-green-600 text-green-700 hover:bg-green-50"
                          onClick={() => onPedirBaixa(c)}
                        >
                          <CheckCircle className="h-3 w-3" />
                          Dar baixa
                        </Button>
                      )}
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>

      <AlterarDadosVendaDialog
        open={alterarOpen}
        onOpenChange={setAlterarOpen}
        contratoId={contrato.id}
        cobrancas={cobrancas}
      />
    </div>
  );
}
