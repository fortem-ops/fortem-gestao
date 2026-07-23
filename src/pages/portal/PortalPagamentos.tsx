import { useQuery } from "@tanstack/react-query";
import { useStudentPortal } from "@/contexts/StudentPortalContext";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { format, parseISO, differenceInDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ArrowLeft, CreditCard, Loader2, AlertCircle, CheckCircle2, Clock, XCircle } from "lucide-react";

function statusInfo(status: string) {
  switch (status) {
    case "pago":
      return { icon: CheckCircle2, cor: "text-emerald-400", bg: "bg-emerald-500/10", label: "Pago" };
    case "pendente":
      return { icon: Clock, cor: "text-muted-foreground", bg: "bg-muted/50", label: "Pendente" };
    case "atrasado":
      return { icon: AlertCircle, cor: "text-destructive", bg: "bg-destructive/10", label: "Atrasado" };
    case "cancelado":
      return { icon: XCircle, cor: "text-muted-foreground", bg: "bg-muted/30", label: "Cancelado" };
    default:
      return { icon: Clock, cor: "text-muted-foreground", bg: "bg-muted/50", label: status };
  }
}

function formaLabel(forma: string) {
  if (!forma || forma === "pendente") return "—";
  if (forma.includes("cartao") || forma.includes("recorrencia")) return "Cartão";
  if (forma.includes("boleto")) return "Boleto";
  if (forma.includes("pix")) return "PIX";
  if (forma.includes("dinheiro")) return "Dinheiro";
  return forma;
}

export default function PortalPagamentos() {
  const { student } = useStudentPortal();
  const navigate = useNavigate();

  const { data: contrato } = useQuery({
    queryKey: ["portal-contrato-pagamentos", student?.id],
    enabled: !!student,
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("contratos")
        .select("id, plano_tipo, vigencia_tipo, parcelas, valor_cobrado, data_inicio, data_fim, status")
        .eq("aluno_id", student!.id)
        .eq("status", "ativo")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      return data;
    },
  });

  const { data: cobrancas = [], isLoading } = useQuery({
    queryKey: ["portal-cobrancas", student?.id, contrato?.id],
    enabled: !!student && !!contrato?.id,
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("cobrancas")
        .select("id, numero_ciclo, valor, data_vencimento, data_pagamento, status, forma_pagamento, gateway, tid")
        .eq("contrato_id", contrato!.id)
        .order("data_vencimento", { ascending: true });
      return data || [];
    },
  });

  if (!student) return null;

  const hoje = new Date();
  const totalParcelas = cobrancas.length > 0 ? cobrancas.length : (contrato?.parcelas ?? 1);
  const pagas = cobrancas.filter((c: any) => c.status === "pago").length;
  const atrasadas = cobrancas.filter((c: any) =>
    c.status === "atrasado" ||
    (c.status === "pendente" && new Date(c.data_vencimento) < hoje)
  );

  const proximaCobranca = cobrancas.find((c: any) =>
    c.status === "pendente" && new Date(c.data_vencimento) >= hoje
  );

  return (
    <div className="space-y-5 pb-32 animate-fade-in">
      <div className="flex items-center gap-3 pt-2">
        <button
          onClick={() => navigate(-1)}
          className="w-9 h-9 rounded-xl bg-card border border-border flex items-center justify-center shrink-0"
        >
          <ArrowLeft className="w-4 h-4 text-muted-foreground" />
        </button>
        <div>
          <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Financeiro</p>
          <h1 className="text-xl font-black text-foreground" style={{fontFamily:'Archivo,sans-serif'}}>Pagamentos</h1>
        </div>
      </div>

      {atrasadas.length > 0 && (
        <div className="bg-destructive/10 border border-destructive/20 rounded-2xl p-4 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-bold text-sm text-destructive">
              {atrasadas.length === 1 ? "1 cobrança em atraso" : `${atrasadas.length} cobranças em atraso`}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Entre em contato com a equipe FORTEM para regularizar.
            </p>
          </div>
          <button
            onClick={() => window.open("https://wa.me/555135199451?text=Olá! Preciso regularizar minha situação financeira.", "_blank")}
            className="shrink-0 text-xs font-bold text-[#25D366] border border-[#25D366]/30 px-2 py-1 rounded-lg"
          >
            WhatsApp
          </button>
        </div>
      )}

      {proximaCobranca && (
        <section className="space-y-2">
          <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Próxima cobrança</p>
          <div className="bg-card border border-border rounded-2xl p-4 flex items-center gap-4">
            <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
              <CreditCard className="w-5 h-5 text-primary" />
            </div>
            <div className="flex-1">
              <p className="font-black text-lg text-foreground" style={{fontFamily:'Archivo,sans-serif'}}>
                R$ {Number(proximaCobranca.valor).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
              </p>
              <p className="text-xs text-muted-foreground">
                Vence em {format(parseISO(proximaCobranca.data_vencimento + "T12:00:00"), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                {" · "}
                {(() => {
                  const dias = differenceInDays(parseISO(proximaCobranca.data_vencimento + "T12:00:00"), hoje);
                  if (dias === 0) return "hoje";
                  if (dias === 1) return "amanhã";
                  return `em ${dias} dias`;
                })()}
              </p>
            </div>
          </div>
        </section>
      )}

      {contrato && (
        <section className="space-y-2">
          <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Resumo do contrato</p>
          <div className="bg-card border border-border rounded-2xl p-4 grid grid-cols-3 gap-3 text-center">
            <div>
              <p className="text-2xl font-black text-foreground" style={{fontFamily:'Archivo,sans-serif'}}>{pagas}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">Pagas</p>
            </div>
            <div className="border-x border-border">
              <p className="text-2xl font-black text-foreground" style={{fontFamily:'Archivo,sans-serif'}}>{totalParcelas}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">Total</p>
            </div>
            <div>
              <p className="text-2xl font-black text-foreground" style={{fontFamily:'Archivo,sans-serif'}}>
                R$ {Number(contrato.valor_cobrado ?? 0).toLocaleString("pt-BR", { minimumFractionDigits: 0 })}
              </p>
              <p className="text-[10px] text-muted-foreground mt-0.5">Mensalidade</p>
            </div>
          </div>
          <div className="space-y-1">
            <div className="h-1.5 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-emerald-500 rounded-full transition-all"
                style={{ width: `${totalParcelas > 0 ? Math.round((pagas / totalParcelas) * 100) : 0}%` }}
              />
            </div>
            <p className="text-[10px] text-muted-foreground text-right">
              {pagas} de {totalParcelas} parcelas pagas
            </p>
          </div>
        </section>
      )}

      <section className="space-y-2">
        <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Histórico</p>

        {isLoading ? (
          <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
        ) : cobrancas.length === 0 ? (
          <div className="bg-card border border-border rounded-2xl p-5 text-center">
            <p className="text-sm text-muted-foreground">Nenhuma cobrança registrada.</p>
          </div>
        ) : (
          <div className="bg-card border border-border rounded-2xl overflow-hidden divide-y divide-border">
            {cobrancas.map((c: any, idx: number) => {
              const { icon: Icon, cor, bg } = statusInfo(c.status);
              const numParcela = c.numero_ciclo ?? (idx + 1);
              const isPaga = c.status === "pago";
              const isAtrasada = c.status === "atrasado" ||
                (c.status === "pendente" && new Date(c.data_vencimento) < hoje);
              const isFutura = c.status === "pendente" && new Date(c.data_vencimento) >= hoje;

              return (
                <div key={c.id} className={`flex items-center gap-3 px-4 py-3.5 ${isAtrasada ? "bg-destructive/5" : ""}`}>
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${bg}`}>
                    <Icon className={`w-4 h-4 ${cor}`} />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <p className="text-sm font-bold text-foreground">
                        Parcela {numParcela}
                        {totalParcelas > 1 && `/${totalParcelas}`}
                      </p>
                      {isPaga && <span className="text-emerald-400 text-xs">✅</span>}
                      {isFutura && <span className="text-[10px] bg-muted text-muted-foreground px-1.5 py-0.5 rounded-full">Agendada</span>}
                      {isAtrasada && <span className="text-[10px] bg-destructive/10 text-destructive px-1.5 py-0.5 rounded-full font-bold">Em atraso</span>}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {isPaga && c.data_pagamento
                        ? `Pago em ${format(parseISO(c.data_pagamento + "T12:00:00"), "dd/MM/yyyy", { locale: ptBR })}`
                        : `Vence ${format(parseISO(c.data_vencimento + "T12:00:00"), "dd/MM/yyyy", { locale: ptBR })}`
                      }
                      {c.forma_pagamento && c.forma_pagamento !== "pendente" && ` · ${formaLabel(c.forma_pagamento)}`}
                    </p>
                  </div>

                  <p className={`text-sm font-black shrink-0 ${isAtrasada ? "text-destructive" : "text-foreground"}`} style={{fontFamily:'Archivo,sans-serif'}}>
                    R$ {Number(c.valor).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <p className="text-[10px] text-muted-foreground text-center px-4">
        Notas fiscais são enviadas automaticamente para o seu e-mail cadastrado.
        Dúvidas? Fale com a equipe FORTEM.
      </p>
    </div>
  );
}
