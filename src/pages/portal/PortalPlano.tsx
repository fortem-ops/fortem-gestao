import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useStudentPortal } from "@/contexts/StudentPortalContext";
import { useCalcularRescisao } from "@/hooks/useContratos";
import { getLimite, getDiasUsados, calcDias, type LicencaTipo } from "@/lib/licencas";
import { differenceInDays, format, parseISO, addDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import {
  Shield, Lock, TrendingUp, ArrowUpCircle, AlertTriangle, CheckCircle2,
  ChevronRight, X, Loader2, CalendarOff, Zap, Star, Crown
} from "lucide-react";

const PLANO_BENEFITS: Record<string, { icon: any; label: string }[]> = {
  Start: [
    { icon: Shield, label: "Treinos ilimitados 1x/semana" },
    { icon: CheckCircle2, label: "Acesso à plataforma digital" },
  ],
  "Start+": [
    { icon: Shield, label: "Treinos ilimitados 1x/semana" },
    { icon: CheckCircle2, label: "1 Avaliação Funcional incluída" },
    { icon: CheckCircle2, label: "Acesso à plataforma digital" },
  ],
  Power: [
    { icon: Shield, label: "Treinos 2x/semana" },
    { icon: CheckCircle2, label: "1 Avaliação Funcional incluída" },
    { icon: CheckCircle2, label: "2 Consultas de Reabilitação" },
    { icon: CheckCircle2, label: "Acesso à plataforma digital" },
  ],
  Pro: [
    { icon: Zap, label: "Treinos 3x/semana" },
    { icon: CheckCircle2, label: "2 Avaliações Funcionais por ano" },
    { icon: CheckCircle2, label: "2 Consultas Nutrição" },
    { icon: CheckCircle2, label: "2 Consultas de Reabilitação" },
    { icon: Star, label: "Prioridade no agendamento" },
    { icon: CheckCircle2, label: "Acesso à plataforma digital" },
  ],
  Max: [
    { icon: Crown, label: "Treinos livres — sem limite semanal" },
    { icon: CheckCircle2, label: "2 Avaliações Funcionais por ano" },
    { icon: CheckCircle2, label: "4 Consultas Nutrição" },
    { icon: CheckCircle2, label: "4 Consultas de Reabilitação" },
    { icon: Star, label: "Prioridade máxima no agendamento" },
    { icon: Crown, label: "Acesso VIP à plataforma" },
  ],
};

export default function PortalPlano() {
  const { student } = useStudentPortal();
  const qc = useQueryClient();

  const [aba, setAba] = useState<"visao" | "trancar" | "cancelar">("visao");

  const [trancInicio, setTrancInicio] = useState("");
  const [trancFim, setTrancFim] = useState("");
  const [trancMotivo, setTrancMotivo] = useState("");
  const [trancSaving, setTrancSaving] = useState(false);

  const [cancelMotivo, setCancelMotivo] = useState("");
  const [cancelEtapa, setCancelEtapa] = useState<"persuasao" | "calculo" | "confirmar">("persuasao");
  const [cancelSaving, setCancelSaving] = useState(false);
  const [confirmacaoTexto, setConfirmacaoTexto] = useState("");

  const { data: plano } = useQuery({
    queryKey: ["portal-plano-ativo", student?.id],
    enabled: !!student,
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("planos")
        .select("*")
        .eq("aluno_id", student!.id)
        .eq("ativo", true)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      return data;
    },
  });

  const { data: contrato } = useQuery({
    queryKey: ["portal-contrato-ativo", student?.id],
    enabled: !!student,
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("contratos")
        .select("*")
        .eq("aluno_id", student!.id)
        .eq("status", "ativo")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      return data;
    },
  });

  const { data: licencas = [] } = useQuery({
    queryKey: ["portal-licencas", student?.id, plano?.id],
    enabled: !!student && !!plano?.id,
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("aluno_licencas")
        .select("*")
        .eq("aluno_id", student!.id)
        .eq("plano_id", plano!.id)
        .order("data_inicio", { ascending: false });
      return data || [];
    },
  });

  const { data: rescisao, isLoading: rescisaoLoading } = useCalcularRescisao(
    contrato?.id ?? "",
    cancelEtapa === "calculo" || cancelEtapa === "confirmar"
  );

  if (!student) return null;

  const planoTipo = plano?.tipo ?? contrato?.plano_tipo ?? "—";
  const diasPlano = differenceInDays(
    plano?.data_fim ? parseISO(plano.data_fim) : new Date(),
    new Date()
  );
  const limiteLicenca = getLimite(planoTipo, "plano");
  const diasUsadosLicenca = getDiasUsados(licencas, "plano");
  const diasSolicitados = calcDias(trancInicio, trancFim);
  const diasRestantes = Math.max(0, limiteLicenca - diasUsadosLicenca);
  const excedeLicenca = diasSolicitados > diasRestantes;

  const todayStr = new Date().toISOString().split("T")[0];
  const minFim = trancInicio
    ? format(addDays(parseISO(trancInicio), 1), "yyyy-MM-dd")
    : todayStr;

  async function handleTrancar() {
    setTrancSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Não autenticado");
      const { error } = await (supabase as any).from("aluno_licencas").insert({
        aluno_id: student!.id,
        plano_id: plano!.id,
        tipo: "plano" as LicencaTipo,
        data_inicio: trancInicio,
        data_fim: trancFim,
        dias: diasSolicitados,
        motivo: trancMotivo || "Solicitação pelo portal do aluno",
        criado_por: user.id,
      });
      if (error) throw error;
      toast.success(`Plano trancado por ${diasSolicitados} dia${diasSolicitados !== 1 ? "s" : ""}!`);
      qc.invalidateQueries({ queryKey: ["portal-licencas"] });
      setTrancInicio(""); setTrancFim(""); setTrancMotivo("");
      setAba("visao");
    } catch (e: any) {
      toast.error(e.message || "Erro ao trancar o plano.");
    } finally {
      setTrancSaving(false);
    }
  }

  async function handleSolicitarCancelamento() {
    setCancelSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Não autenticado");
      await (supabase as any).rpc("fn_notificar_criar_notificacao", {
        p_titulo: `Solicitação de cancelamento — ${student!.nome}`,
        p_descricao: `O aluno ${student!.nome} solicitou o cancelamento do plano ${planoTipo} pelo portal.\n\nMotivo: ${cancelMotivo || "Não informado"}\n\nO plano deve ser analisado pela equipe antes de efetivar o cancelamento.`,
        p_categoria: "aluno",
        p_tipo: "solicitacao",
        p_prioridade: "alta",
        p_aluno_id: student!.id,
      });
      toast.success("Solicitação enviada! A equipe FORTEM entrará em contato em breve.");
      setCancelEtapa("persuasao");
      setCancelMotivo("");
      setConfirmacaoTexto("");
      setAba("visao");
    } catch (e: any) {
      toast.error(e.message || "Erro ao enviar solicitação.");
    } finally {
      setCancelSaving(false);
    }
  }

  return (
    <div className="space-y-5 pb-32 animate-fade-in">
      <div className="pt-2">
        <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Meu Plano</p>
        <h1 className="text-xl font-black text-foreground" style={{fontFamily:'Archivo,sans-serif'}}>
          Gerenciar Plano
        </h1>
      </div>

      <div className="bg-card border border-border rounded-2xl p-5 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Plano ativo</p>
            <p className="text-2xl font-black text-foreground mt-0.5" style={{fontFamily:'Archivo,sans-serif'}}>{planoTipo}</p>
          </div>
          <div className="text-right">
            <p className="text-[11px] text-muted-foreground">Vence em</p>
            <p className="text-lg font-black text-foreground" style={{fontFamily:'Archivo,sans-serif'}}>
              {diasPlano > 0 ? `${diasPlano} dias` : "Vencido"}
            </p>
          </div>
        </div>
        {plano?.data_fim && (
          <p className="text-xs text-muted-foreground">
            Válido até {format(parseISO(plano.data_fim), "dd 'de' MMMM 'de' yyyy", {locale: ptBR})}
          </p>
        )}
        {licencas.filter((l:any) => l.data_inicio <= todayStr && l.data_fim >= todayStr).length > 0 && (
          <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3 flex items-center gap-2">
            <CalendarOff className="w-4 h-4 text-amber-400 shrink-0" />
            <p className="text-xs text-amber-400 font-medium">Plano trancado até {format(parseISO(licencas.find((l:any) => l.data_inicio <= todayStr && l.data_fim >= todayStr).data_fim), "dd/MM/yyyy")}</p>
          </div>
        )}
      </div>

      <div className="space-y-2">
        <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Ações</p>

        {limiteLicenca > 0 && (
          <button
            onClick={() => setAba(aba === "trancar" ? "visao" : "trancar")}
            className={`w-full flex items-center gap-3 p-4 rounded-xl border transition-colors text-left ${
              aba === "trancar" ? "bg-amber-500/10 border-amber-500/30" : "bg-card border-border"
            }`}
          >
            <div className="w-9 h-9 rounded-xl bg-[#2C2C2C] flex items-center justify-center shrink-0">
              <Lock className="w-4 h-4 text-amber-400" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-foreground">Trancar plano</p>
              <p className="text-xs text-muted-foreground">
                {diasRestantes > 0 ? `${diasRestantes} dia${diasRestantes !== 1 ? "s" : ""} disponível${diasRestantes !== 1 ? "es" : ""}` : "Limite de trancamento atingido"}
              </p>
            </div>
            <ChevronRight className={`w-4 h-4 text-muted-foreground transition-transform ${aba === "trancar" ? "rotate-90" : ""}`} />
          </button>
        )}

        {aba === "trancar" && (
          <div className="bg-card border border-amber-500/20 rounded-xl p-4 space-y-4">
            <p className="text-sm font-bold text-foreground" style={{fontFamily:'Archivo,sans-serif'}}>Solicitar trancamento</p>
            <p className="text-xs text-muted-foreground">
              Seu plano <strong className="text-foreground">{planoTipo}</strong> permite trancar por até <strong className="text-foreground">{limiteLicenca} dias</strong> por ano. 
              Você já usou <strong className="text-foreground">{diasUsadosLicenca}</strong> dia{diasUsadosLicenca !== 1 ? "s" : ""}.
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-xs text-muted-foreground mb-1">Data início</p>
                <input
                  type="date"
                  value={trancInicio}
                  min={todayStr}
                  onChange={e => setTrancInicio(e.target.value)}
                  className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground"
                />
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">Data fim</p>
                <input
                  type="date"
                  value={trancFim}
                  min={minFim}
                  onChange={e => setTrancFim(e.target.value)}
                  className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground"
                />
              </div>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">Motivo (opcional)</p>
              <textarea
                value={trancMotivo}
                onChange={e => setTrancMotivo(e.target.value)}
                placeholder="Ex.: viagem, lesão..."
                rows={2}
                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground resize-none"
              />
            </div>
            {diasSolicitados > 0 && (
              <div className={`rounded-xl p-3 text-xs ${excedeLicenca ? "bg-destructive/10 border border-destructive/20 text-destructive" : "bg-emerald-500/10 border border-emerald-500/20 text-emerald-400"}`}>
                {excedeLicenca
                  ? `${diasSolicitados} dias solicitados excedem o limite restante de ${diasRestantes} dias.`
                  : `✓ ${diasSolicitados} dia${diasSolicitados !== 1 ? "s" : ""} de trancamento — dentro do limite.`}
              </div>
            )}
            <div className="flex gap-3">
              <button onClick={() => setAba("visao")} className="flex-1 py-2.5 rounded-xl bg-muted text-foreground text-sm font-semibold">
                Cancelar
              </button>
              <button
                disabled={!trancInicio || !trancFim || diasSolicitados <= 0 || excedeLicenca || trancSaving || diasRestantes === 0}
                onClick={handleTrancar}
                className="flex-1 py-2.5 rounded-xl bg-amber-500 text-black text-sm font-bold disabled:opacity-40"
              >
                {trancSaving ? "Salvando..." : "Confirmar trancamento"}
              </button>
            </div>
          </div>
        )}

        <button
          onClick={() => setAba(aba === "cancelar" ? "visao" : "cancelar")}
          className={`w-full flex items-center gap-3 p-4 rounded-xl border transition-colors text-left ${
            aba === "cancelar" ? "bg-destructive/5 border-destructive/30" : "bg-card border-border"
          }`}
        >
          <div className="w-9 h-9 rounded-xl bg-[#2C2C2C] flex items-center justify-center shrink-0">
            <X className="w-4 h-4 text-destructive" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold text-foreground">Cancelar plano</p>
            <p className="text-xs text-muted-foreground">Solicitar encerramento do contrato</p>
          </div>
          <ChevronRight className={`w-4 h-4 text-muted-foreground transition-transform ${aba === "cancelar" ? "rotate-90" : ""}`} />
        </button>

        {aba === "cancelar" && (
          <div className="bg-card border border-destructive/20 rounded-xl p-4 space-y-4">
            {cancelEtapa === "persuasao" && (
              <>
                <div className="text-center space-y-2 py-2">
                  <p className="text-2xl">😢</p>
                  <p className="font-black text-base text-foreground" style={{fontFamily:'Archivo,sans-serif'}}>
                    Sentiremos sua falta, {student.nome.split(" ")[0]}!
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Antes de ir, que tal considerar uma pausa? Você pode trancar seu plano 
                    {limiteLicenca > 0 ? ` por até ${limiteLicenca} dias` : ""} sem perder seus créditos.
                  </p>
                </div>
                <button
                  onClick={() => { setAba("trancar"); setCancelEtapa("persuasao"); }}
                  className="w-full py-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 font-bold text-sm"
                >
                  <Lock className="w-4 h-4 inline mr-2" />
                  Prefiro trancar o plano
                </button>
                <button
                  onClick={() => setCancelEtapa("calculo")}
                  className="w-full py-3 rounded-xl bg-muted text-muted-foreground font-semibold text-sm"
                >
                  Quero continuar com o cancelamento
                </button>
                <button onClick={() => setAba("visao")} className="w-full text-xs text-muted-foreground py-1">
                  Voltar
                </button>
              </>
            )}

            {cancelEtapa === "calculo" && (
              <>
                <p className="font-bold text-sm text-foreground" style={{fontFamily:'Archivo,sans-serif'}}>Cálculo de rescisão</p>
                {rescisaoLoading || !rescisao ? (
                  <div className="flex justify-center py-6"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
                ) : (
                  <div className="space-y-3">
                    <div className="bg-background border border-border rounded-xl p-3 space-y-2 text-sm">
                      {rescisao.tipo === "start_sem_multa" && (
                        <div className="text-emerald-400 text-xs bg-emerald-500/10 rounded-lg p-2">
                          ✓ Plano mensal sem fidelidade. Nenhuma multa devida.
                        </div>
                      )}
                      {rescisao.tipo === "recorrencia_com_multa" && (
                        <>
                          <div className="flex justify-between text-xs">
                            <span className="text-muted-foreground">Mensalidades vincendas</span>
                            <span className="text-foreground">R$ {(rescisao.valor_vincendo ?? 0).toFixed(2).replace(".", ",")}</span>
                          </div>
                          <div className="flex justify-between text-xs">
                            <span className="text-muted-foreground">Multa ({rescisao.percentual_multa}%)</span>
                            <span className="text-foreground">R$ {(rescisao.multa_base ?? 0).toFixed(2).replace(".", ",")}</span>
                          </div>
                          <div className="flex justify-between text-xs font-bold border-t border-border pt-2 mt-1">
                            <span className="text-foreground">Total devido</span>
                            <span className="text-destructive">R$ {(rescisao.total_devido ?? 0).toFixed(2).replace(".", ",")}</span>
                          </div>
                        </>
                      )}
                      {rescisao.tipo === "parcelado_com_restituicao" && (
                        <>
                          <div className="flex justify-between text-xs">
                            <span className="text-muted-foreground">Proporcional restante</span>
                            <span className="text-foreground">R$ {(rescisao.valor_proporcional ?? 0).toFixed(2).replace(".", ",")}</span>
                          </div>
                          <div className="flex justify-between text-xs">
                            <span className="text-muted-foreground">Restituição ({rescisao.percentual_restituicao}%)</span>
                            <span className="text-foreground">R$ {(rescisao.restituicao_bruta ?? 0).toFixed(2).replace(".", ",")}</span>
                          </div>
                          {(rescisao.total_restituir ?? 0) > 0 ? (
                            <div className="flex justify-between text-xs font-bold border-t border-border pt-2 mt-1">
                              <span className="text-foreground">A restituir</span>
                              <span className="text-emerald-400">R$ {rescisao.total_restituir.toFixed(2).replace(".", ",")}</span>
                            </div>
                          ) : (
                            <div className="flex justify-between text-xs font-bold border-t border-border pt-2 mt-1">
                              <span className="text-foreground">Saldo devedor</span>
                              <span className="text-destructive">R$ {(rescisao.total_devido ?? 0).toFixed(2).replace(".", ",")}</span>
                            </div>
                          )}
                        </>
                      )}
                      {rescisao.descricao && (
                        <p className="text-[10px] text-muted-foreground border-t border-border pt-2">{rescisao.descricao}</p>
                      )}
                    </div>

                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Motivo (opcional)</p>
                      <textarea
                        value={cancelMotivo}
                        onChange={e => setCancelMotivo(e.target.value)}
                        placeholder="Ex.: mudança de cidade, motivos financeiros..."
                        rows={2}
                        className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground resize-none"
                      />
                    </div>

                    <div className="flex gap-3">
                      <button onClick={() => setCancelEtapa("persuasao")} className="flex-1 py-2.5 rounded-xl bg-muted text-foreground text-sm font-semibold">
                        Voltar
                      </button>
                      <button
                        onClick={() => setCancelEtapa("confirmar")}
                        className="flex-1 py-2.5 rounded-xl bg-destructive text-white text-sm font-bold"
                      >
                        Prosseguir
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}

            {cancelEtapa === "confirmar" && (
              <>
                <div className="bg-destructive/10 border border-destructive/20 rounded-xl p-3 space-y-1">
                  <p className="text-xs font-bold text-destructive flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4" /> Atenção — ação irreversível
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Ao confirmar, uma solicitação de cancelamento será enviada à equipe FORTEM, que entrará em contato para finalizar o processo.
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-2">
                    Para confirmar, digite <strong className="text-foreground">CANCELAR</strong> abaixo:
                  </p>
                  <input
                    type="text"
                    value={confirmacaoTexto}
                    onChange={e => setConfirmacaoTexto(e.target.value.toUpperCase())}
                    placeholder="CANCELAR"
                    className="w-full bg-background border border-destructive/30 rounded-lg px-3 py-2 text-sm text-foreground"
                  />
                </div>
                <div className="flex gap-3">
                  <button onClick={() => setCancelEtapa("calculo")} className="flex-1 py-2.5 rounded-xl bg-muted text-foreground text-sm font-semibold">
                    Voltar
                  </button>
                  <button
                    disabled={confirmacaoTexto !== "CANCELAR" || cancelSaving}
                    onClick={handleSolicitarCancelamento}
                    className="flex-1 py-2.5 rounded-xl bg-destructive text-white text-sm font-bold disabled:opacity-40"
                  >
                    {cancelSaving ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : "Enviar solicitação"}
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        <button
          onClick={() => window.open('https://wa.me/555135199451?text=Olá! Gostaria de fazer upgrade de frequência no meu plano.', '_blank')}
          className="w-full flex items-center gap-3 p-4 rounded-xl border bg-card border-border text-left"
        >
          <div className="w-9 h-9 rounded-xl bg-[#2C2C2C] flex items-center justify-center shrink-0">
            <TrendingUp className="w-4 h-4 text-primary" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold text-foreground">Upgrade de frequência</p>
            <p className="text-xs text-muted-foreground">Treine mais vezes por semana</p>
          </div>
          <ChevronRight className="w-4 h-4 text-muted-foreground" />
        </button>

        <button
          onClick={() => window.open('https://wa.me/555135199451?text=Olá! Gostaria de fazer upgrade do meu plano.', '_blank')}
          className="w-full flex items-center gap-3 p-4 rounded-xl border bg-card border-border text-left"
        >
          <div className="w-9 h-9 rounded-xl bg-[#2C2C2C] flex items-center justify-center shrink-0">
            <ArrowUpCircle className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold text-foreground">Upgrade de plano</p>
            <p className="text-xs text-muted-foreground">Acesse mais serviços e benefícios</p>
          </div>
          <ChevronRight className="w-4 h-4 text-muted-foreground" />
        </button>
      </div>

      {PLANO_BENEFITS[planoTipo] && (
        <section className="space-y-2">
          <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Vantagens do seu plano</p>
          <div className="bg-card border border-border rounded-2xl p-4 space-y-3">
            {PLANO_BENEFITS[planoTipo].map((b, i) => {
              const Icon = b.icon;
              return (
                <div key={i} className="flex items-center gap-3">
                  <div className="w-7 h-7 rounded-lg bg-[#2C2C2C] flex items-center justify-center shrink-0">
                    <Icon className="w-3.5 h-3.5 text-primary" />
                  </div>
                  <p className="text-sm text-foreground">{b.label}</p>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {licencas.length > 0 && (
        <section className="space-y-2">
          <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Histórico de trancamentos</p>
          <div className="space-y-2">
            {licencas.filter((l:any) => l.tipo === "plano").map((l:any) => {
              const isVigente = l.data_inicio <= todayStr && l.data_fim >= todayStr;
              const isFutura = l.data_inicio > todayStr;
              return (
                <div key={l.id} className="bg-card border border-border rounded-xl p-3 flex items-center gap-3">
                  <CalendarOff className="w-4 h-4 text-muted-foreground shrink-0" />
                  <div className="flex-1">
                    <p className="text-sm text-foreground font-medium">
                      {format(parseISO(l.data_inicio), "dd/MM/yyyy")} → {format(parseISO(l.data_fim), "dd/MM/yyyy")}
                    </p>
                    <p className="text-xs text-muted-foreground">{l.dias} dia{l.dias !== 1 ? "s" : ""}{l.motivo ? ` · ${l.motivo}` : ""}</p>
                  </div>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                    isVigente ? "bg-amber-500/20 text-amber-400" :
                    isFutura ? "bg-primary/20 text-primary" :
                    "bg-muted text-muted-foreground"
                  }`}>
                    {isVigente ? "Vigente" : isFutura ? "Futura" : "Encerrada"}
                  </span>
                </div>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
