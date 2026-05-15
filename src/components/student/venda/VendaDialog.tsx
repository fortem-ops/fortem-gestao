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
import { ShoppingCart, Calendar, Repeat, Zap, Check, ArrowLeft, Activity, Infinity as InfinityIcon } from "lucide-react";
import { toast } from "sonner";
import { formatBRL, calcularCreditos, type Frequencia } from "@/lib/vendas";
import { cn } from "@/lib/utils";
import { PaymentFields } from "./PaymentFields";
import { invalidatePlanoCaches } from "@/lib/planoCache";

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

export function VendaDialog({ alunoId, alunoNome, open, onOpenChange }: Props) {
  const qc = useQueryClient();
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

  const reset = () => {
    setPStep(1); setFrequencia(""); setPlanoId("");
    setSStep(1); setServicoId("");
    setStatusPagamento("pendente"); setObservacoes("");
    setDesconto(0); setFormaPagamento(null); setParcelas(1);
  };

  useEffect(() => { if (!open) reset(); }, [open]);
  useEffect(() => { reset(); }, [tab]);

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

  const vender = useMutation({
    mutationFn: async (payload: { tipo: "plano" | "servico"; item: any }) => {
      const { data: { user } } = await supabase.auth.getUser();
      const valor = Number(payload.item.valor || 0);
      const valorFinal = Math.max(0, valor - (desconto || 0));
      const { error } = await (supabase as any).from("vendas").insert({
        aluno_id: alunoId,
        tipo: payload.tipo,
        catalogo_id: payload.item.id,
        nome_snapshot: payload.item.nome,
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

  const creditosCalc = planoSelecionado
    ? (planoSelecionado.ilimitado
        ? { quantidade: null, ilimitado: true }
        : { quantidade: planoSelecionado.quantidade_creditos, ilimitado: false })
    : null;

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
            <StepIndicator steps={["Frequência", "Plano", "Resumo"]} current={pStep} />

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
                      planosFiltrados.map((p: any) => (
                        <RadioCard
                          key={p.id}
                          selected={planoId === p.id}
                          onClick={() => setPlanoId(p.id)}
                          icon={<span className="inline-block w-4 h-4 rounded-full mt-1" style={{ background: p.cor || "#999" }} />}
                          title={p.nome}
                          subtitle={
                            <span className="flex flex-wrap gap-2 mt-1">
                              <Badge variant="outline" className="gap-1"><Calendar className="w-3 h-3" />{p.periodo_meses} {p.periodo_meses === 1 ? "mês" : "meses"}</Badge>
                              <Badge variant="outline" className="gap-1"><Zap className="w-3 h-3" />{p.ilimitado ? "Ilimitado" : `${p.quantidade_creditos} créditos`}</Badge>
                            </span>
                          }
                          right={<span className="text-base font-semibold text-primary">{formatBRL(p.valor)}</span>}
                        />
                      ))
                    )}
                    <div className="flex justify-between pt-4">
                      <Button variant="outline" onClick={() => setPStep(1)}><ArrowLeft className="w-4 h-4 mr-1" />Voltar</Button>
                      <Button disabled={!planoId} onClick={() => setPStep(3)}>Continuar</Button>
                    </div>
                  </div>
                )}

                {pStep === 3 && planoSelecionado && (
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
                        <div><span className="text-muted-foreground">Créditos:</span> <span className="font-medium">{creditosCalc?.ilimitado ? "Ilimitado" : `${creditosCalc?.quantidade}`}</span></div>
                      </div>
                    </div>

                    <PaymentFields
                      valorBase={Number(planoSelecionado.valor || 0)}
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
                      <Textarea value={observacoes} onChange={(e) => setObservacoes(e.target.value)} rows={3} placeholder="Notas internas sobre essa venda..." />
                    </div>

                    <div className="flex justify-between pt-2">
                      <Button variant="outline" onClick={() => setPStep(2)}><ArrowLeft className="w-4 h-4 mr-1" />Voltar</Button>
                      <Button disabled={vender.isPending} onClick={() => vender.mutate({ tipo: "plano", item: planoSelecionado })}>
                        Confirmar venda
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
                      <Button disabled={vender.isPending} onClick={() => vender.mutate({ tipo: "servico", item: servicoSelecionado })}>
                        Confirmar venda
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
