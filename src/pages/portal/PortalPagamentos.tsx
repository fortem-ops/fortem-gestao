import { useCallback, useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useStudentPortal } from "@/contexts/StudentPortalContext";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { format, parseISO, differenceInCalendarDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ArrowLeft, CreditCard, Loader2, Plus, Star, Trash2, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CadastrarCartaoDialog } from "@/components/pagamentos/CadastrarCartaoDialog";
import { usePortalCartoes } from "@/hooks/usePortalCartoes";
import { calcularValoresContrato, type VendaVinculada } from "@/lib/contratoValores";

type Cobranca = {
  id: string; numero_ciclo: number | null; valor: number;
  data_vencimento: string; data_pagamento: string | null;
  status: string; forma_pagamento: string | null;
};
const COBRANCAS_VAZIAS: Cobranca[] = [];
const moeda = (valor: number) => Number(valor).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const dataLocal = (data: string) => parseISO(data.slice(0, 10) + "T12:00:00");
const dataCurta = (data: string) => format(dataLocal(data), "dd/MM/yyyy");
const diasParaVencer = (c: Cobranca) => differenceInCalendarDays(dataLocal(c.data_vencimento), new Date());
const emAtraso = (c: Cobranca) => c.status === "atrasado" || (c.status === "pendente" && diasParaVencer(c) < 0);
const agendada = (c: Cobranca) => c.status === "pendente" && !emAtraso(c);

function formaLabel(forma: string | null) {
  if (!forma || forma === "pendente") return "—";
  if (forma.includes("pix")) return "PIX";
  if (forma.includes("cartao") || forma.includes("recorrencia")) return "Cartão";
  if (forma.includes("boleto")) return "Boleto";
  if (forma.includes("dinheiro")) return "Dinheiro";
  return forma;
}

function ContratoBloco({ contrato, onCobrancas }: {
  contrato: any;
  onCobrancas: (id: string, cobrancas: Cobranca[], carregando: boolean) => void;
}) {
  const { data: cobrancas = COBRANCAS_VAZIAS, isLoading } = useQuery({
    queryKey: ["portal-cobrancas", contrato.id],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("cobrancas")
        .select("id, numero_ciclo, valor, data_vencimento, data_pagamento, status, forma_pagamento, gateway, tid")
        .eq("contrato_id", contrato.id)
        .order("data_vencimento", { ascending: true });
      return data || [];
    },
  });

  const { data: venda } = useQuery({
    queryKey: ["portal-venda-contrato", contrato.plano_id],
    queryFn: async () => {
      if (!contrato.plano_id) return null;
      const { data } = await (supabase as any)
        .from("vendas")
        .select("valor_final, parcelas, tipo_cobranca")
        .eq("plano_id", contrato.plano_id)
        .eq("tipo", "plano")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      return data as VendaVinculada | null;
    },
    enabled: !!contrato.plano_id,
  });
  const valoresContrato = calcularValoresContrato(contrato, venda);
  useEffect(() => {
    onCobrancas(contrato.id, cobrancas, isLoading);
  }, [contrato.id, cobrancas, isLoading, onCobrancas]);

  const totalParcelas = Math.max(cobrancas.length, contrato.parcelas ?? venda?.parcelas ?? 1);
  const pagas = cobrancas.filter((c: Cobranca) => c.status === "pago").length;
  const historico = cobrancas.map((c: Cobranca, index: number) => ({ ...c, parcela: c.numero_ciclo ?? index + 1 }))
    .sort((a: Cobranca, b: Cobranca) => {
      const grupo = (c: Cobranca) => agendada(c) ? 0 : c.status === "pago" ? 1 : 2;
      const ordem = grupo(a) - grupo(b);
      if (ordem) return ordem;
      if (agendada(a)) return a.data_vencimento.localeCompare(b.data_vencimento);
      return (b.data_pagamento ?? b.data_vencimento).localeCompare(a.data_pagamento ?? a.data_vencimento);
    });
  const plano = String(contrato.plano_tipo ?? "Plano").replace(/^plano\s+/i, "");
  const tituloPlano = plano.charAt(0).toUpperCase() + plano.slice(1);

  return (
    <section className="space-y-4 border-t border-border pt-6">
      <h2 className="text-base font-bold uppercase break-words">
        Contrato {tituloPlano}{contrato.vigencia_tipo && ` · ${contrato.vigencia_tipo}`} · {totalParcelas}x
      </h2>
      <div className="space-y-2">
        <div className="flex justify-between gap-4 text-sm">
          <span className="text-muted-foreground">Parcelas pagas</span>
          <span>{pagas} de {totalParcelas}</span>
        </div>
        <div role="progressbar" aria-label="Parcelas pagas" aria-valuenow={pagas} aria-valuemin={0} aria-valuemax={totalParcelas} className="h-1 bg-muted overflow-hidden">
          <div className="h-full bg-success" style={{ width: `${Math.min(100, totalParcelas > 0 ? pagas / totalParcelas * 100 : 0)}%` }} />
        </div>
        <div className="flex flex-wrap justify-between gap-2 text-sm">
          <p className="text-muted-foreground">
            {contrato.data_inicio ? dataCurta(contrato.data_inicio) : "—"} → {contrato.data_fim ? dataCurta(contrato.data_fim) : "—"}
          </p>
          <p>{moeda(valoresContrato.parcela)} <span className="text-muted-foreground">/ {valoresContrato.recorrente ? "mês" : "parcela"}</span></p>
        </div>
      </div>
      <div className="space-y-2">
        <h3 className="portal-section-label">Histórico</h3>
        {isLoading ? (
          <div className="flex justify-center py-8" aria-label="Carregando histórico"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
        ) : historico.length === 0 ? (
          <p className="py-4 text-sm text-muted-foreground">Nenhuma cobrança registrada.</p>
        ) : (
          <div className="divide-y divide-border">
            {historico.map((c: Cobranca & { parcela: number }) => {
              const paga = c.status === "pago";
              const atrasada = emAtraso(c);
              const status = paga ? "Pago" : atrasada ? "Em atraso" : agendada(c) ? "Agendada" : c.status;
              return (
                <div key={c.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 py-4 min-h-16">
                  <p className="text-sm font-bold">Parcela {c.parcela}/{totalParcelas}</p>
                  <p className="text-sm font-bold text-right tabular-nums">{moeda(c.valor)}</p>
                  <p className="text-xs text-muted-foreground break-words">
                    {paga && c.data_pagamento ? dataCurta(c.data_pagamento) : dataCurta(c.data_vencimento)} · {formaLabel(c.forma_pagamento)}
                  </p>
                  <p className={`text-[11px] font-bold uppercase text-right ${paga ? "text-success" : atrasada ? "text-warning" : "text-muted-foreground"}`}>{status}</p>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}

export default function PortalPagamentos() {
  const { student } = useStudentPortal();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [cadastroAberto, setCadastroAberto] = useState(false);
  const [trocarAberto, setTrocarAberto] = useState(false);
  const [resumos, setResumos] = useState<Record<string, { cobrancas: Cobranca[]; carregando: boolean }>>({});
  const receberCobrancas = useCallback((id: string, cobrancas: Cobranca[], carregando: boolean) => {
    setResumos(atual => {
      if (atual[id]?.cobrancas === cobrancas && atual[id]?.carregando === carregando) return atual;
      return { ...atual, [id]: { cobrancas, carregando } };
    });
  }, []);

  const { cartoes, definirPrincipal, removerCartao } = usePortalCartoes(student?.id);

  const { data: contratos = [], isLoading } = useQuery({
    queryKey: ["portal-contratos-pagamentos", student?.id],
    enabled: !!student,
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("contratos")
        .select("id, plano_id, plano_tipo, vigencia_tipo, forma_pagamento, parcelas, valor_cobrado, data_inicio, data_fim, status")
        .eq("aluno_id", student!.id)
        .eq("status", "ativo")
        .order("created_at", { ascending: false });
      return data || [];
    },
  });

  if (!student) return null;

  const carregandoCobrancas = isLoading || contratos.some((c: any) => !resumos[c.id] || resumos[c.id].carregando);
  const todasCobrancas = contratos.flatMap((c: any) => resumos[c.id]?.cobrancas ?? []) as Cobranca[];
  const atrasadas = todasCobrancas.filter(emAtraso);
  const proxima = todasCobrancas.filter(agendada).sort((a, b) => a.data_vencimento.localeCompare(b.data_vencimento))[0];
  const cartaoPrincipal = cartoes.find(c => c.is_default) ?? cartoes[0];

  return (
    <div className="portal-pagamentos space-y-6 pb-32">
      <div className="flex items-center gap-3 pt-2">
        <Button variant="outline" size="icon" className="h-11 w-11 shrink-0" aria-label="Voltar" onClick={() => navigate(-1)}><ArrowLeft /></Button>
        <div><p className="portal-section-label">Financeiro</p><h1 className="text-xl font-black uppercase">Pagamentos</h1></div>
      </div>

      <section className="relative portal-cobranca-moldura border border-border bg-card p-5 space-y-3" aria-label="Próxima cobrança">
        <h2 className="portal-section-label">Próxima cobrança</h2>
        {carregandoCobrancas ? (
          <div className="py-4" aria-label="Carregando cobranças"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
        ) : (
          <>
            {proxima ? <>
              <p className="text-4xl font-black tabular-nums break-words">{moeda(proxima.valor)}</p>
              <p className="text-sm text-muted-foreground">Vencimento {format(dataLocal(proxima.data_vencimento), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })} · {diasParaVencer(proxima) === 0 ? "hoje" : `em ${diasParaVencer(proxima)} ${diasParaVencer(proxima) === 1 ? "dia" : "dias"}`}</p>
            </> : <p className="text-sm text-muted-foreground">Nenhuma cobrança agendada.</p>}
            <p className={`text-sm font-bold ${atrasadas.length ? "text-warning" : "text-success"}`}>
              {atrasadas.length ? `${atrasadas.length} ${atrasadas.length === 1 ? "cobrança em atraso" : "cobranças em atraso"}` : "Você está em dia."}
            </p>
            {atrasadas.length > 0 && <div className="space-y-3 border-t border-border pt-3">
              <p className="text-sm text-muted-foreground">Entre em contato com a equipe FORTEM para regularizar.</p>
              <Button variant="outline" className="min-h-11" onClick={() => window.open("https://wa.me/555135199451?text=Olá! Preciso regularizar minha situação financeira.", "_blank")}>WhatsApp</Button>
            </div>}
          </>
        )}
      </section>

      <section className="space-y-3" aria-label="Forma de pagamento">
        <h2 className="portal-section-label">Forma de pagamento</h2>
        {cartaoPrincipal ? <>
          <div className="flex items-center gap-3 border border-border bg-card p-4">
            <CreditCard className="w-5 h-5 shrink-0 text-muted-foreground" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold break-words">{cartaoPrincipal.brand ?? "Cartão"} · final {cartaoPrincipal.last4 ?? "—"}</p>
              <p className="text-xs text-muted-foreground mt-1">Validade {String(cartaoPrincipal.expiration_month ?? "—").padStart(2, "0")}/{cartaoPrincipal.expiration_year ?? "—"}</p>
            </div>
            <Button variant="outline" className="h-11 shrink-0" aria-expanded={trocarAberto} aria-controls="portal-trocar-cartoes" onClick={() => setTrocarAberto(!trocarAberto)}>Trocar<ChevronDown className={trocarAberto ? "rotate-180" : ""} /></Button>
          </div>
          {trocarAberto && <div id="portal-trocar-cartoes" className="border-y border-border divide-y divide-border">
            {cartoes.map(c => <div key={c.id} className="py-4 space-y-2">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-bold break-words">{c.brand ?? "Cartão"} · final {c.last4 ?? "—"}</p>
                  <p className="text-xs text-muted-foreground mt-1">{String(c.expiration_month ?? "—").padStart(2, "0")}/{c.expiration_year ?? "—"}{c.holder_name && ` · ${c.holder_name}`}</p>
                  {c.is_default && <p className="text-xs text-muted-foreground uppercase mt-1">Principal</p>}
                </div>
                <Button variant="outline" size="icon" className="h-11 w-11 shrink-0" aria-label={`Remover cartão final ${c.last4}`} title="Remover cartão" onClick={() => removerCartao.mutate(c.id)} disabled={removerCartao.isPending}><Trash2 /></Button>
              </div>
              {!c.is_default && <Button variant="outline" className="min-h-11" onClick={() => definirPrincipal.mutate(c.id)} disabled={definirPrincipal.isPending}><Star />Tornar principal</Button>}
            </div>)}
            <div className="py-3"><Button variant="outline" className="min-h-11" onClick={() => setCadastroAberto(true)}><Plus />Adicionar</Button></div>
          </div>}
        </> : <Button className="w-full min-h-16 justify-start whitespace-normal text-left px-4" onClick={() => setCadastroAberto(true)}><Plus /><span><span className="block font-bold">Cadastrar cartão</span><span className="block text-xs mt-1">Para pagar suas mensalidades no cartão</span></span></Button>}
        {cartaoPrincipal && <p className="text-xs text-muted-foreground">Para pagar suas mensalidades no cartão</p>}
        <p className="text-xs text-muted-foreground">Não armazenamos o número do cartão — apenas um token seguro via Rede.</p>
      </section>

      {isLoading ? <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
        : contratos.length === 0 ? <p className="py-4 text-sm text-muted-foreground">Nenhum contrato ativo.</p>
        : <div className="space-y-6">{contratos.map((c: any) => <ContratoBloco key={c.id} contrato={c} onCobrancas={receberCobrancas} />)}</div>}

      <p className="text-xs text-muted-foreground text-center border-t border-border pt-5">
        Notas fiscais são enviadas automaticamente para o seu e-mail cadastrado.
        Dúvidas? Fale com a equipe FORTEM.
      </p>

      <CadastrarCartaoDialog
        open={cadastroAberto}
        onOpenChange={setCadastroAberto}
        alunoId={student.id}
        alunoNome={student.nome}
        origem="portal_aluno"
        onSuccess={() => qc.invalidateQueries({ queryKey: ["portal-cartoes"] })}
      />
    </div>
  );
}
