import { useState, useEffect, ReactNode } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ShoppingCart, Calendar, Repeat, Zap, Check, ArrowLeft, Activity, Infinity as InfinityIcon, CalendarIcon } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { formatBRL, type Frequencia } from "@/lib/vendas";
import { calcularTotaisVenda, type TipoCobranca } from "@/lib/vendas-calc";
import { cn } from "@/lib/utils";
import { PaymentFields } from "./PaymentFields";
import { TipoCobrancaSection } from "./TipoCobrancaSection";
import { PagamentoStep, type Modalidade, type Canal } from "./PagamentoStep";
import { ServicosPlanoStep } from "./ServicosPlanoStep";
import { PagarCartaoDialog } from "@/components/pagamentos/PagarCartaoDialog";
import { useUserRoles } from "@/hooks/useUserRoles";
import { invalidatePlanoCaches } from "@/lib/planoCache";
import {
  getRegrasServicosPorPlano,
  planoTemEtapaServicos,
  montarServicosInclusos,
  requerEscolhaServico,
  mapModalidadeParaContrato,
  type OpcaoConsulta,
  type ServicosInclusos,
} from "@/lib/vendas-servicos";


type Props = { alunoId: string; alunoNome: string; open: boolean; onOpenChange: (v: boolean) => void };

const FREQ_OPTIONS: { value: Frequencia; label: string; desc: string }[] = [
  { value: "1x", label: "1x por semana", desc: "4 sessões/mês · 52 sessões/ano" },
  { value: "2x", label: "2x por semana", desc: "8 sessões/mês · 104 sessões/ano" },
  { value: "3x", label: "3x por semana", desc: "12 sessões/mês · 156 sessões/ano" },
  { value: "livre", label: "Livre", desc: "Acesso ilimitado no período" },
];

function StepIndicator({ steps, current }: { steps: string[]; current: number }) {
  return (
    <div className="flex items-center justify-between gap-2 mb-6 px-1">
      {steps.map((label, i) => {
        const n = i + 1;
        const active = n === current;
        const done = n < current;
        return (
          <div key={label} className="flex items-center gap-2 flex-1">
            <div
              className={cn(
                "w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold shrink-0 transition",
                done && "bg-primary text-primary-foreground",
                active && "bg-primary text-primary-foreground ring-4 ring-primary/20",
                !active && !done && "bg-muted text-muted-foreground"
              )}
            >
              {done ? <Check className="w-4 h-4" /> : n}
            </div>
            <span className={cn("text-sm font-medium", active ? "text-foreground" : "text-muted-foreground")}>{label}</span>
            {i < steps.length - 1 && <div className={cn("h-px flex-1 mx-2", done ? "bg-primary" : "bg-border")} />}
          </div>
        );
      })}
    </div>
  );
}

function RadioCard({
  selected, onClick, icon, title, subtitle, right, children,
}: {
  selected: boolean; onClick: () => void; icon?: ReactNode; title: ReactNode; subtitle?: ReactNode; right?: ReactNode; children?: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "w-full text-left flex items-start gap-3 rounded-xl border px-4 py-3 transition-all",
        selected ? "border-primary bg-primary/5 ring-2 ring-primary/20" : "border-border hover:border-primary/40"
      )}
    >
      {icon && <div className={cn("mt-0.5 shrink-0", selected ? "text-primary" : "text-muted-foreground")}>{icon}</div>}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <span className={cn("font-medium", selected ? "text-foreground" : "text-foreground/90")}>{title}</span>
          {right}
        </div>
        {subtitle && <div className="text-xs text-muted-foreground mt-0.5">{subtitle}</div>}
        {children && <div className="mt-2">{children}</div>}
      </div>
    </button>
  );
}

const PLANO_STEPS_FULL = ["Frequência", "Plano", "Serviços", "Resumo", "Pagamento"];
const PLANO_STEPS_BASE = ["Frequência", "Plano", "Resumo", "Pagamento"];


export function VendaDialog({ alunoId, alunoNome, open, onOpenChange }: Props) {
  const qc = useQueryClient();
  const { data: roles } = useUserRoles();
  const isCoordAdmin = !!roles?.isCoordAdmin;

  const [tab, setTab] = useState<"planos" | "servicos">("planos");

  // Plano wizard
  const [pStep, setPStep] = useState(1);
  const [frequencia, setFrequencia] = useState<Frequencia | "">("");
  const [planoId, setPlanoId] = useState<string>("");

  // Servico wizard
  const [sStep, setSStep] = useState(1);
  const [servicoId, setServicoId] = useState<string>("");

  // Resumo
  const [statusPagamento, setStatusPagamento] = useState<"pendente" | "pago">("pendente");
  const [observacoes, setObservacoes] = useState("");
  const [desconto, setDesconto] = useState(0);
  const [formaPagamento, setFormaPagamento] = useState<string | null>(null);
  const [parcelas, setParcelas] = useState(1);
  const [dataInicio, setDataInicio] = useState<Date>(new Date());

  // Novo: tipo de cobrança / pagamento (Plano)
  const [tipoCobranca, setTipoCobranca] = useState<TipoCobranca | null>(null);
  const [aluno2025, setAluno2025] = useState(false);
  const [modalidade, setModalidade] = useState<Modalidade | null>(null);
  const [canalCartao, setCanalCartao] = useState<Canal | null>(null);

  // Cartão dialog (REDE)
  const [cartaoDialog, setCartaoDialog] = useState<{ vendaId: string; valor: number; recorrencia: boolean; parcelasTotais: number; servicosInclusos: ServicosInclusos | null } | null>(null);

  // Serviços bônus do plano
  const [opcaoServicoId, setOpcaoServicoId] = useState<string | null>(null);
  const [opcaoServico, setOpcaoServico] = useState<OpcaoConsulta | null>(null);

  const reset = () => {
    setPStep(1); setFrequencia(""); setPlanoId("");
    setSStep(1); setServicoId("");
    setStatusPagamento("pendente"); setObservacoes("");
    setDesconto(0); setFormaPagamento(null); setParcelas(1);
    setDataInicio(new Date());
    setTipoCobranca(null); setModalidade(null); setCanalCartao(null);
    setOpcaoServicoId(null); setOpcaoServico(null);
    // aluno2025 preservado pelo fetch abaixo
  };


  useEffect(() => { if (!open) reset(); }, [open]);
  useEffect(() => { reset(); }, [tab]);

  // Preload aluno_2025 do aluno
  const { data: alunoInfo } = useQuery({
    queryKey: ["aluno-2025-flag", alunoId],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("alunos").select("aluno_2025").eq("id", alunoId).maybeSingle();
      return data || { aluno_2025: false };
    },
    enabled: open,
  });
  useEffect(() => {
    if (alunoInfo) setAluno2025(!!alunoInfo.aluno_2025);
  }, [alunoInfo]);

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

  const planosFiltrados = planos.filter((p: any) => p.frequencia === frequencia);
  const planoSelecionado = planos.find((p: any) => p.id === planoId);
  const servicoSelecionado = servicos.find((s: any) => s.id === servicoId);

  const totaisPlano = planoSelecionado
    ? calcularTotaisVenda({
        valorPlano: Number(planoSelecionado.valor || 0),
        desconto,
        periodoMeses: planoSelecionado.periodo_meses || 1,
        tipoCobranca,
        aluno2025,
      })
    : null;

  const venderServico = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      const valor = Number(servicoSelecionado.valor || 0);
      const valorFinal = Math.max(0, valor - (desconto || 0));
      const { error } = await (supabase as any).from("vendas").insert({
        aluno_id: alunoId,
        tipo: "servico",
        catalogo_id: servicoSelecionado.id,
        nome_snapshot: servicoSelecionado.nome,
        valor,
        desconto: desconto || 0,
        valor_final: valorFinal,
        forma_pagamento: formaPagamento,
        parcelas: parcelas || 1,
        vendedor_id: user?.id,
        status_pagamento: statusPagamento,
        observacoes: observacoes.trim() || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Venda registrada com sucesso");
      qc.invalidateQueries({ queryKey: ["vendas-aluno", alunoId] });
      qc.invalidateQueries({ queryKey: ["creditos-aluno", alunoId] });
      invalidatePlanoCaches(qc, alunoId);
      onOpenChange(false);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const regraServicos = getRegrasServicosPorPlano(planoSelecionado?.nome);
  const hasServicos = !!regraServicos;
  const servicosInclusos: ServicosInclusos = montarServicosInclusos(regraServicos, opcaoServico);
  const planoSteps = hasServicos ? PLANO_STEPS_FULL : PLANO_STEPS_BASE;
  const displayStep = hasServicos ? pStep : (pStep < 4 ? pStep : pStep - 1);

  // Cria créditos de serviços para vendas não recorrentes (recorrência usa a RPC)
  const criarCreditosServicos = async (svc: ServicosInclusos) => {
    const linhas: { atividade: string; quantidade_inicial: number }[] = [];
    if (svc.avaliacao_funcional > 0) linhas.push({ atividade: "Avaliação Funcional", quantidade_inicial: svc.avaliacao_funcional });
    if (svc.nutricao > 0) linhas.push({ atividade: "Nutrição", quantidade_inicial: svc.nutricao });
    if (svc.reabilitacao > 0) linhas.push({ atividade: "Reabilitação", quantidade_inicial: svc.reabilitacao });
    if (!linhas.length) return;
    await (supabase as any).from("creditos_aluno").insert(
      linhas.map((l) => ({ aluno_id: alunoId, origem_tipo: "plano", ...l })),
    );
  };

  const venderPlano = useMutation({
    mutationFn: async () => {
      if (!planoSelecionado || !tipoCobranca || !modalidade || !totaisPlano) {
        throw new Error("Dados de pagamento incompletos");
      }
      if (modalidade === "cartao_credito" && tipoCobranca === "tradicional" && !canalCartao) {
        throw new Error("Selecione o canal do cartão (maquininha ou online)");
      }
      if (hasServicos && requerEscolhaServico(regraServicos) && !opcaoServico) {
        throw new Error("Selecione a opção de serviços incluídos no plano");
      }

      const { data: { user } } = await supabase.auth.getUser();
      const valor = Number(planoSelecionado.valor || 0);
      const valorFinal = totaisPlano.subtotalPlano;
      const formaPgto = mapForma(modalidade, canalCartao);
      const canal = modalidade === "cartao_credito"
        ? (tipoCobranca === "recorrencia" ? "online" : canalCartao)
        : modalidade === "pix_automatico" || modalidade === "boleto" || modalidade === "pix_avista"
          ? "online"
          : modalidade === "debito" ? "maquininha"
          : modalidade === "dinheiro" ? "manual"
          : null;

      // status inicial
      const cartaoOnline = modalidade === "cartao_credito" && (tipoCobranca === "recorrencia" || canalCartao === "online");
      const initialStatus: "pendente" | "pago" =
        modalidade === "pendente" ? "pendente"
        : cartaoOnline ? "pendente"  // será atualizado pelo PagarCartaoDialog
        : statusPagamento;

      const { data: vendaIns, error } = await (supabase as any).from("vendas").insert({
        aluno_id: alunoId,
        tipo: "plano",
        catalogo_id: planoSelecionado.id,
        nome_snapshot: planoSelecionado.nome,
        valor,
        desconto: desconto || 0,
        valor_final: valorFinal,
        forma_pagamento: formaPgto,
        parcelas: parcelas || 1,
        vendedor_id: user?.id,
        status_pagamento: initialStatus,
        observacoes: observacoes.trim() || null,
        data_venda: format(dataInicio, "yyyy-MM-dd"),
        tipo_cobranca: tipoCobranca,
        taxa_mensal: totaisPlano.taxaMensal,
        modalidade_pagamento: modalidade,
        canal_pagamento: canal,
      }).select("id").single();
      if (error) throw error;

      // Atualiza flag aluno_2025 se mudou
      if (tipoCobranca === "recorrencia" && aluno2025 !== !!alunoInfo?.aluno_2025) {
        await (supabase as any).from("alunos").update({ aluno_2025: aluno2025 }).eq("id", alunoId);
      }

      // Recorrência sem cartão online → criar contrato + 12 cobranças via RPC
      // (cartão online é tratado pela edge function rede-cobrar-cartao após aprovação)
      if (tipoCobranca === "recorrencia" && modalidade !== "cartao_credito") {
        const periodo = Math.max(1, Number(planoSelecionado.periodo_meses) || 1);
        const valorMensal = totaisPlano.subtotalPlano / periodo;
        const primeiraPaga = modalidade === "dinheiro" || modalidade === "pix_avista" || modalidade === "debito";
        const formaContrato = mapModalidadeParaContrato(modalidade, canalCartao);
        const { error: rpcErr } = await (supabase as any).rpc("fn_criar_contrato_recorrencia", {
          p_venda_id: vendaIns?.id,
          p_aluno_id: alunoId,
          p_plano_id: planoSelecionado.id,
          p_valor_mensal: valorMensal,
          p_taxa_mensal: totaisPlano.taxaMensal,
          p_data_inicio: format(dataInicio, "yyyy-MM-dd"),
          p_forma_pagamento: formaContrato,
          p_cartao_token_id: null,
          p_primeira_paga: primeiraPaga,
          p_servicos_inclusos: servicosInclusos,
        });
        if (rpcErr) throw rpcErr;
      } else if (tipoCobranca === "tradicional" && hasServicos) {
        // Tradicional com benefícios — criar créditos diretamente
        await criarCreditosServicos(servicosInclusos);
      }

      const periodoPlano = Math.max(1, Number(planoSelecionado.periodo_meses) || 1);
      const valorCartaoOnline = tipoCobranca === "recorrencia"
        ? totaisPlano.mensalEstimado
        : valorFinal;
      return { vendaId: vendaIns?.id as string, cartaoOnline, valorFinal: valorCartaoOnline, periodoPlano };
    },
    onSuccess: ({ vendaId, cartaoOnline, valorFinal, periodoPlano }) => {
      qc.invalidateQueries({ queryKey: ["vendas-aluno", alunoId] });
      qc.invalidateQueries({ queryKey: ["creditos-aluno", alunoId] });
      qc.invalidateQueries({ queryKey: ["aluno-2025-flag", alunoId] });
      qc.invalidateQueries({ queryKey: ["contratos"] });
      qc.invalidateQueries({ queryKey: ["contratos-aluno", alunoId] });
      qc.invalidateQueries({ queryKey: ["cobrancas-contrato"] });
      invalidatePlanoCaches(qc, alunoId);
      if (cartaoOnline && vendaId) {
        toast.success("Venda registrada — informe os dados do cartão");
        setCartaoDialog({
          vendaId,
          valor: valorFinal,
          recorrencia: tipoCobranca === "recorrencia",
          parcelasTotais: tipoCobranca === "recorrencia" ? periodoPlano : 1,
          servicosInclusos,
        });
      } else {
        toast.success("Venda registrada com sucesso");
        onOpenChange(false);
      }
    },
    onError: (e: any) => toast.error(e.message),
  });


  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShoppingCart className="w-5 h-5 text-primary" /> Nova Venda — {alunoNome}
          </DialogTitle>
        </DialogHeader>

        <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="planos">Planos</TabsTrigger>
            <TabsTrigger value="servicos">Serviços</TabsTrigger>
          </TabsList>

          {/* ============= PLANOS ============= */}
          <TabsContent value="planos" className="mt-6">
            <StepIndicator steps={planoSteps} current={displayStep} />

            {lp ? <Skeleton className="h-40 w-full" /> : (
              <>
                {pStep === 1 && (
                  <div className="space-y-2">
                    {FREQ_OPTIONS.map((f) => (
                      <RadioCard
                        key={f.value}
                        selected={frequencia === f.value}
                        onClick={() => setFrequencia(f.value)}
                        icon={f.value === "livre" ? <InfinityIcon className="w-5 h-5" /> : <Repeat className="w-5 h-5" />}
                        title={f.label}
                        subtitle={f.desc}
                      />
                    ))}
                    <div className="flex justify-end pt-4">
                      <Button disabled={!frequencia} onClick={() => setPStep(2)}>Continuar</Button>
                    </div>
                  </div>
                )}

                {pStep === 2 && (
                  <div className="space-y-2">
                    {planosFiltrados.length === 0 ? (
                      <div className="text-center py-8 space-y-3">
                        <p className="text-sm text-muted-foreground">Nenhum plano ativo com frequência <strong>{frequencia}</strong>.</p>
                        <Button variant="outline" size="sm" onClick={() => setPStep(1)}>Escolher outra frequência</Button>
                      </div>
                    ) : (
                      (() => {
                        // Agrupar por nome (Start, Start+, Power, Pro, Max)
                        const grupos = new Map<string, any[]>();
                        for (const p of planosFiltrados) {
                          const arr = grupos.get(p.nome) || [];
                          arr.push(p);
                          grupos.set(p.nome, arr);
                        }
                        const lista = Array.from(grupos.entries()).map(([nome, variantes]) => {
                          const ordenadas = [...variantes].sort((a, b) => (a.periodo_meses || 0) - (b.periodo_meses || 0));
                          const menorValor = Math.min(...variantes.map((v) => Number(v.valor) || 0));
                          return { nome, variantes: ordenadas, menorValor, cor: ordenadas[0]?.cor };
                        }).sort((a, b) => a.menorValor - b.menorValor);

                        return lista.map((g) => {
                          const selectedVariante = g.variantes.find((v) => v.id === planoId);
                          const isOpen = !!selectedVariante;
                          return (
                            <div key={g.nome} className="space-y-2">
                              <RadioCard
                                selected={isOpen}
                                onClick={() => {
                                  if (isOpen) return;
                                  setPlanoId(g.variantes[0].id);
                                }}
                                icon={<span className="inline-block w-4 h-4 rounded-full mt-1" style={{ background: g.cor || "#999" }} />}
                                title={g.nome}
                                subtitle={
                                  <span className="flex flex-wrap gap-2 mt-1">
                                    {g.variantes.map((v) => (
                                      <Badge key={v.id} variant="outline" className="gap-1">
                                        <Calendar className="w-3 h-3" />{v.periodo_meses} {v.periodo_meses === 1 ? "mês" : "meses"}
                                      </Badge>
                                    ))}
                                  </span>
                                }
                                right={
                                  <span className="text-right">
                                    <span className="block text-[10px] uppercase tracking-wide text-muted-foreground">a partir de</span>
                                    <span className="text-base font-semibold text-primary">{formatBRL(g.menorValor)}</span>
                                  </span>
                                }
                              />
                              {isOpen && g.variantes.length > 1 && (
                                <div className="flex flex-wrap gap-2 pl-4">
                                  {g.variantes.map((v) => (
                                    <button
                                      key={v.id}
                                      type="button"
                                      onClick={() => setPlanoId(v.id)}
                                      className={cn(
                                        "rounded-lg border px-3 py-1.5 text-xs transition",
                                        planoId === v.id
                                          ? "border-primary bg-primary/10 text-primary font-medium"
                                          : "border-border hover:border-primary/40"
                                      )}
                                    >
                                      {v.periodo_meses} {v.periodo_meses === 1 ? "mês" : "meses"} · {formatBRL(v.valor)}
                                    </button>
                                  ))}
                                </div>
                              )}
                              {isOpen && g.variantes.length === 1 && (
                                <div className="pl-4 text-xs text-muted-foreground">
                                  {g.variantes[0].ilimitado ? "Ilimitado" : `${g.variantes[0].quantidade_creditos} créditos`} · {formatBRL(g.variantes[0].valor)}
                                </div>
                              )}
                            </div>
                          );
                        });
                      })()
                    )}
                    <div className="flex justify-between pt-4">
                      <Button variant="outline" onClick={() => setPStep(1)}><ArrowLeft className="w-4 h-4 mr-1" />Voltar</Button>
                      <Button disabled={!planoId} onClick={() => setPStep(hasServicos ? 3 : 4)}>Continuar</Button>
                    </div>
                  </div>
                )}

                {pStep === 3 && planoSelecionado && hasServicos && regraServicos && (
                  <div className="space-y-4">
                    <ServicosPlanoStep
                      nomePlano={planoSelecionado.nome}
                      regra={regraServicos}
                      opcaoSelecionadaId={opcaoServicoId}
                      onOpcaoChange={(opc) => { setOpcaoServicoId(opc?.id ?? null); setOpcaoServico(opc); }}
                    />

                    <div className="flex justify-between pt-2">
                      <Button variant="outline" onClick={() => setPStep(2)}><ArrowLeft className="w-4 h-4 mr-1" />Voltar</Button>
                      <Button
                        disabled={requerEscolhaServico(regraServicos) && !opcaoServicoId}
                        onClick={() => setPStep(4)}
                      >Continuar</Button>
                    </div>
                  </div>
                )}

                {pStep === 4 && planoSelecionado && (

                  <div className="space-y-4">
                    <div className="rounded-xl border border-border bg-card p-5 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="inline-block w-4 h-4 rounded-full" style={{ background: planoSelecionado.cor || "#999" }} />
                          <h4 className="font-heading font-semibold text-lg">{planoSelecionado.nome}</h4>
                        </div>
                        <span className="text-2xl font-bold text-primary">{formatBRL(planoSelecionado.valor)}</span>
                      </div>
                      <div className="grid grid-cols-2 gap-3 text-sm">
                        <div><span className="text-muted-foreground">Aluno:</span> <span className="font-medium">{alunoNome}</span></div>
                        <div><span className="text-muted-foreground">Frequência:</span> <span className="font-medium">{frequencia}</span></div>
                        <div><span className="text-muted-foreground">Período:</span> <span className="font-medium">{planoSelecionado.periodo_meses} {planoSelecionado.periodo_meses === 1 ? "mês" : "meses"}</span></div>
                        <div><span className="text-muted-foreground">Créditos:</span> <span className="font-medium">{planoSelecionado.ilimitado ? "Ilimitado" : `${planoSelecionado.quantidade_creditos}`}</span></div>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label>Data de Início do Plano</Label>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !dataInicio && "text-muted-foreground")}>
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {dataInicio ? format(dataInicio, "dd/MM/yyyy", { locale: ptBR }) : <span>Selecione a data</span>}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <CalendarComponent
                            mode="single"
                            selected={dataInicio}
                            onSelect={(d) => d && setDataInicio(d)}
                            initialFocus
                            locale={ptBR}
                            className={cn("p-3 pointer-events-auto")}
                          />
                        </PopoverContent>
                      </Popover>
                    </div>

                    <TipoCobrancaSection
                      valorPlano={Number(planoSelecionado.valor || 0)}
                      periodoMeses={planoSelecionado.periodo_meses || 1}
                      desconto={desconto}
                      onDescontoChange={setDesconto}
                      tipoCobranca={tipoCobranca}
                      onTipoCobrancaChange={setTipoCobranca}
                      aluno2025={aluno2025}
                      onAluno2025Change={setAluno2025}
                      canTogglesAluno2025={isCoordAdmin}
                    />

                    {tipoCobranca === "recorrencia" && (
                      <div className="rounded-lg border border-primary/30 bg-primary/5 px-3 py-2 text-xs text-foreground/90">
                        Será criado um <strong>contrato de 12 meses</strong> com cobranças automáticas mensais. A 1ª mensalidade é cobrada agora; as outras 11 ficam agendadas como pendentes.
                      </div>
                    )}

                    <div className="space-y-2">
                      <Label>Observações (opcional)</Label>
                      <Textarea value={observacoes} onChange={(e) => setObservacoes(e.target.value)} rows={3} placeholder="Notas internas sobre essa venda..." />
                    </div>

                    <div className="flex justify-between pt-2">
                      <Button variant="outline" onClick={() => setPStep(hasServicos ? 3 : 2)}><ArrowLeft className="w-4 h-4 mr-1" />Voltar</Button>
                      <Button disabled={!tipoCobranca} onClick={() => setPStep(5)}>Continuar para Pagamento</Button>
                    </div>
                  </div>
                )}

                {pStep === 5 && planoSelecionado && tipoCobranca && totaisPlano && (

                  <div className="space-y-4">
                    <PagamentoStep
                      tipoCobranca={tipoCobranca}
                      total={totaisPlano.total}
                      mensalEstimado={totaisPlano.mensalEstimado}
                      periodoMeses={planoSelecionado.periodo_meses || 1}
                      modalidade={modalidade}
                      onModalidadeChange={(m) => {
                        setModalidade(m);
                        if (m !== "cartao_credito") setCanalCartao(null);
                      }}
                      canalCartao={canalCartao}
                      onCanalCartaoChange={setCanalCartao}
                      parcelas={parcelas}
                      onParcelasChange={setParcelas}
                    />

                    {modalidade && modalidade !== "pendente" && !(modalidade === "cartao_credito" && tipoCobranca === "tradicional" && canalCartao === "online") && (
                      <div className="space-y-2">
                        <Label>Status do pagamento</Label>
                        <Select value={statusPagamento} onValueChange={(v) => setStatusPagamento(v as any)}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="pendente">Pendente</SelectItem>
                            <SelectItem value="pago">Já recebido</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    )}

                    <div className="flex justify-between pt-2">
                      <Button variant="outline" onClick={() => setPStep(4)}><ArrowLeft className="w-4 h-4 mr-1" />Voltar</Button>
                      <Button
                        disabled={
                          venderPlano.isPending ||
                          !modalidade ||
                          (modalidade === "cartao_credito" && tipoCobranca === "tradicional" && !canalCartao)
                        }
                        onClick={() => venderPlano.mutate()}
                      >
                        {modalidade === "cartao_credito" && (tipoCobranca === "recorrencia" || canalCartao === "online")
                          ? "Avançar para dados do cartão"
                          : "Confirmar venda"}
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </TabsContent>

          {/* ============= SERVIÇOS ============= */}
          <TabsContent value="servicos" className="mt-6">
            <StepIndicator steps={["Serviço", "Resumo"]} current={sStep} />

            {ls ? <Skeleton className="h-40 w-full" /> : (
              <>
                {sStep === 1 && (
                  <div className="space-y-2">
                    {servicos.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-6">Nenhum serviço ativo. Cadastre em Administração &gt; Serviços.</p>
                    ) : servicos.map((s: any) => (
                      <RadioCard
                        key={s.id}
                        selected={servicoId === s.id}
                        onClick={() => setServicoId(s.id)}
                        icon={<Activity className="w-5 h-5" />}
                        title={s.nome}
                        subtitle={
                          <span className="flex flex-wrap gap-2 mt-1">
                            <Badge variant="outline">{s.atividade}</Badge>
                            <Badge variant="outline" className="gap-1"><Zap className="w-3 h-3" />{s.quantidade_sessoes} sessões</Badge>
                          </span>
                        }
                        right={<span className="text-base font-semibold text-primary">{formatBRL(s.valor)}</span>}
                      />
                    ))}
                    <div className="flex justify-end pt-4">
                      <Button disabled={!servicoId} onClick={() => setSStep(2)}>Continuar</Button>
                    </div>
                  </div>
                )}

                {sStep === 2 && servicoSelecionado && (
                  <div className="space-y-4">
                    <div className="rounded-xl border border-border bg-card p-5 space-y-3">
                      <div className="flex items-center justify-between">
                        <h4 className="font-heading font-semibold text-lg">{servicoSelecionado.nome}</h4>
                        <span className="text-2xl font-bold text-primary">{formatBRL(servicoSelecionado.valor)}</span>
                      </div>
                      <div className="grid grid-cols-2 gap-3 text-sm">
                        <div><span className="text-muted-foreground">Aluno:</span> <span className="font-medium">{alunoNome}</span></div>
                        <div><span className="text-muted-foreground">Atividade:</span> <span className="font-medium">{servicoSelecionado.atividade}</span></div>
                        <div><span className="text-muted-foreground">Sessões:</span> <span className="font-medium">{servicoSelecionado.quantidade_sessoes}</span></div>
                      </div>
                    </div>

                    <PaymentFields
                      valorBase={Number(servicoSelecionado.valor || 0)}
                      desconto={desconto}
                      onDescontoChange={setDesconto}
                      formaPagamentoSlug={formaPagamento}
                      onFormaPagamentoChange={setFormaPagamento}
                      parcelas={parcelas}
                      onParcelasChange={setParcelas}
                    />

                    <div className="space-y-2">
                      <Label>Status do pagamento</Label>
                      <Select value={statusPagamento} onValueChange={(v) => setStatusPagamento(v as any)}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="pendente">Pendente</SelectItem>
                          <SelectItem value="pago">Pago</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label>Observações (opcional)</Label>
                      <Textarea value={observacoes} onChange={(e) => setObservacoes(e.target.value)} rows={3} />
                    </div>

                    <div className="flex justify-between pt-2">
                      <Button variant="outline" onClick={() => setSStep(1)}><ArrowLeft className="w-4 h-4 mr-1" />Voltar</Button>
                      <Button disabled={venderServico.isPending} onClick={() => venderServico.mutate()}>
                        Confirmar venda
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </TabsContent>
        </Tabs>

        {cartaoDialog && (
          <PagarCartaoDialog
            open={!!cartaoDialog}
            onOpenChange={(o) => {
              if (!o) {
                setCartaoDialog(null);
                onOpenChange(false);
              }
            }}
            vendaId={cartaoDialog.vendaId}
            alunoId={alunoId}
            valor={cartaoDialog.valor}
            recorrencia={cartaoDialog.recorrencia}
            parcelasTotais={cartaoDialog.parcelasTotais}
            onSuccess={() => {
              qc.invalidateQueries({ queryKey: ["vendas-aluno", alunoId] });
              invalidatePlanoCaches(qc, alunoId);
            }}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function mapForma(modalidade: Modalidade, canal: Canal | null): string {
  switch (modalidade) {
    case "cartao_credito":
      return canal === "maquininha" ? "cartao_credito_maquininha" : "cartao_credito";
    case "pix_automatico": return "pix_automatico";
    case "boleto": return "boleto";
    case "debito": return "debito";
    case "dinheiro": return "dinheiro";
    case "pix_avista": return "pix";
    case "pendente": return "pendente";
  }
}
