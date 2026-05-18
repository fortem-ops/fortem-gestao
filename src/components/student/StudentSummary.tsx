import type { Tables } from "@/integrations/supabase/types";
import { CalendarDays, Dumbbell, ClipboardCheck, Heart, Clock, User, AlertTriangle, RefreshCw, UserX, Activity, Calendar, DollarSign, FileText, Pencil, Utensils, Footprints, Sparkles, Scale, ShieldCheck, Camera, Eye } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { getDisplayStatus } from "@/lib/studentStatus";
import type { AlunoLicenca } from "@/lib/licencas";
import { EditDadosCadastraisDialog } from "./EditDadosCadastraisDialog";
import AnnexDetailModal, { type AnnexDetail } from "@/components/legal-annex/AnnexDetailModal";
import { Link } from "react-router-dom";


type Aluno = Tables<"alunos">;

const WEEKS_BY_FREQ: Record<number, number> = { 1: 12, 2: 8, 3: 6 };
const DEFAULT_WEEKS = 6;

function calcAge(dob: string): number {
  const birth = new Date(dob + "T00:00:00");
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
  return age;
}

function calcEndDate(startDate: string, durationMonths: number): Date {
  const d = new Date(startDate + "T00:00:00");
  d.setMonth(d.getMonth() + durationMonths);
  return d;
}

interface Alert {
  id: string;
  type: string;
  severity: "atencao" | "urgente";
  message: string;
  icon: React.ElementType;
}

export function StudentSummary({ student }: { student: Aluno }) {
  const statusMap: Record<string, string> = { ativo: "Ativo", licenca: "Licença", encerrado: "Encerrado" };
  const queryClient = useQueryClient();
  const [editingEndDate, setEditingEndDate] = useState(false);
  const [editingCadastro, setEditingCadastro] = useState(false);
  const [viewingAnnex, setViewingAnnex] = useState<AnnexDetail | null>(null);

  const { data: isCoordAdmin = false } = useQuery({
    queryKey: ["is_coord_admin_summary"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return false;
      const { data } = await supabase.rpc("is_coordinator_or_admin", { _user_id: user.id });
      return !!data;
    },
  });
  const { data: professor } = useQuery({
    queryKey: ["professor", student.responsavel_id],
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("user_id", student.responsavel_id!)
        .single();
      return data;
    },
    enabled: !!student.responsavel_id,
  });

  const { data: plano } = useQuery({
    queryKey: ["plano_resumo", student.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("planos")
        .select("*")
        .eq("aluno_id", student.id)
        .eq("ativo", true)
        .order("created_at", { ascending: false })
        .limit(1);
      return data && data.length > 0 ? data[0] : null;
    },
  });

  const { data: licencas = [] } = useQuery({
    queryKey: ["aluno_licencas_summary", student.id, plano?.id],
    queryFn: async () => {
      if (!plano) return [];
      const { data } = await supabase.from("aluno_licencas" as any)
        .select("*").eq("aluno_id", student.id).eq("plano_id", plano.id);
      return (data as unknown as AlunoLicenca[]) || [];
    },
    enabled: !!plano,
  });

  const { data: creditos = [] } = useQuery({
    queryKey: ["creditos_resumo", student.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("creditos_aluno" as any)
        .select("*")
        .eq("aluno_id", student.id)
        .eq("ativo", true);
      return (data as any[]) || [];
    },
  });

  const { data: consumos = [] } = useQuery({
    queryKey: ["consumos_resumo", student.id, plano?.id],
    queryFn: async () => {
      if (!plano) return [];
      const { data } = await supabase
        .from("consumo_servicos")
        .select("*")
        .eq("aluno_id", student.id)
        .eq("plano_id", plano.id);
      return data || [];
    },
    enabled: !!plano,
  });
  const { data: lastAval } = useQuery({
    queryKey: ["last_aval_funcional", student.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("avaliacoes")
        .select("id, data")
        .eq("aluno_id", student.id)
        .eq("tipo", "funcional")
        .order("data", { ascending: false })
        .limit(1);
      return data && data.length > 0 ? data[0] : null;
    },
  });

  const { data: currentTreino } = useQuery({
    queryKey: ["current_treino_resumo", student.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("treinos")
        .select("id, created_at")
        .eq("aluno_id", student.id)
        .eq("status", "atual")
        .order("created_at", { ascending: false })
        .limit(1);
      return data && data.length > 0 ? data[0] : null;
    },
  });

  const { data: origemLead } = useQuery({
    queryKey: ["pipeline_metadata_origem", student.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("pipeline_metadata")
        .select("origem_lead")
        .eq("aluno_id", student.id)
        .maybeSingle();
      return (data as any)?.origem_lead ?? null;
    },
  });

  // Build alerts for this student
  const alerts: Alert[] = [];
  const today = new Date();

  const RECURRING_PLANS = ["Start", "Gympass/Wellhub", "Total Pass"];

  // Plan expiring (skip recurring monthly plans)
  if (plano && !RECURRING_PLANS.includes(plano.tipo)) {
    const endDate = plano.data_fim ? new Date(plano.data_fim + "T00:00:00") : calcEndDate(plano.data_inicio, plano.duracao_meses);
    const diffDays = Math.ceil((endDate.getTime() - today.getTime()) / 86400000);
    if (diffDays <= 30) {
      alerts.push({
        id: "plano",
        type: "plano_vencendo",
        severity: diffDays <= 7 ? "urgente" : "atencao",
        message: diffDays <= 0
          ? `Plano vencido há ${Math.abs(diffDays)} dias`
          : `Plano vence em ${diffDays} dias (${endDate.toLocaleDateString("pt-BR")})`,
        icon: AlertTriangle,
      });
    }
  }

  // License
  if (student.status === "licenca") {
    alerts.push({
      id: "licenca",
      type: "licenca",
      severity: "atencao",
      message: "Aluno em licença",
      icon: UserX,
    });
  }

  // Workout change
  if (currentTreino && student.status === "ativo") {
    const freq = student.frequencia_semanal ?? 0;
    const weeksLimit = WEEKS_BY_FREQ[freq] || DEFAULT_WEEKS;
    const treinoDate = new Date(currentTreino.created_at);
    const limitDate = new Date(treinoDate);
    limitDate.setDate(limitDate.getDate() + weeksLimit * 7);
    const diffDays = Math.ceil((limitDate.getTime() - today.getTime()) / 86400000);

    if (diffDays <= 14) {
      alerts.push({
        id: "troca_ficha",
        type: "troca_ficha",
        severity: diffDays <= 0 ? "urgente" : "atencao",
        message: diffDays <= 0
          ? `Troca de ficha atrasada (${Math.abs(diffDays)} dias)`
          : `Troca de ficha em ${diffDays} dias`,
        icon: RefreshCw,
      });
    }
  }

  // Functional reassessment
  if (lastAval && student.status === "ativo") {
    const lastDate = new Date(lastAval.data + "T00:00:00");
    const months4 = new Date(lastDate);
    months4.setMonth(months4.getMonth() + 4);
    const months6 = new Date(lastDate);
    months6.setMonth(months6.getMonth() + 6);

    if (today >= months4) {
      alerts.push({
        id: "reavaliacao",
        type: "avaliacao",
        severity: today >= months6 ? "urgente" : "atencao",
        message: today >= months6
          ? `Reavaliação funcional atrasada (última: ${lastDate.toLocaleDateString("pt-BR")})`
          : `Agendar reavaliação funcional (última: ${lastDate.toLocaleDateString("pt-BR")})`,
        icon: Clock,
      });
    }
  }

  const planEndDate = plano ? (plano.data_fim ? new Date(plano.data_fim + "T00:00:00") : calcEndDate(plano.data_inicio, plano.duracao_meses)) : null;
  const displayStatus = getDisplayStatus(student.status, planEndDate, licencas, plano?.tipo ?? null);

  const severityClass: Record<string, string> = {
    atencao: "status-warning",
    urgente: "status-urgent",
  };

  return (
    <div className="space-y-6 mt-4">
      {/* Seção 1: Plano */}
      <div>
        <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
          <DollarSign className="w-4 h-4 text-muted-foreground" />
          Plano
        </h3>
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          <div className="glass-card rounded-lg p-4">
            <span className="text-xs text-muted-foreground">Tipo</span>
            <p className="text-sm font-semibold text-foreground mt-1">{plano?.tipo || "Sem plano"}</p>
          </div>
          <div className="glass-card rounded-lg p-4">
            <span className="text-xs text-muted-foreground">Frequência</span>
            <p className="text-sm font-semibold text-foreground mt-1">{student.frequencia_semanal || 0}x/semana</p>
          </div>
          <div className="glass-card rounded-lg p-4">
            <span className="text-xs text-muted-foreground">Status</span>
            <p className="text-sm font-semibold text-foreground mt-1">
              {plano ? (
                <Badge variant="outline" className={`${displayStatus.className} text-xs`}>{displayStatus.label}</Badge>
              ) : (
                <Badge variant="outline" className="status-urgent text-xs">Sem plano</Badge>
              )}
            </p>
          </div>
          <div className="glass-card rounded-lg p-4">
            <span className="text-xs text-muted-foreground">Data Final</span>
            <div className="flex items-center gap-2 mt-1">
              <p className="text-sm font-semibold text-foreground">
                {planEndDate ? planEndDate.toLocaleDateString("pt-BR") : "—"}
              </p>
              {isCoordAdmin && plano && (
                <Popover open={editingEndDate} onOpenChange={setEditingEndDate}>
                  <PopoverTrigger asChild>
                    <button className="text-muted-foreground hover:text-primary transition-colors">
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <CalendarComponent
                      mode="single"
                      selected={planEndDate || undefined}
                      defaultMonth={planEndDate || undefined}
                      onSelect={async (date) => {
                        if (!date || !plano) return;
                        const dataFim = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
                        const { error } = await supabase
                          .from("planos")
                          .update({ data_fim: dataFim } as any)
                          .eq("id", plano.id);
                        if (error) {
                          toast.error("Erro ao atualizar data final");
                        } else {
                          toast.success("Data final atualizada");
                          queryClient.invalidateQueries({ queryKey: ["plano_resumo", student.id] });
                          queryClient.invalidateQueries({ queryKey: ["plano_ativo", student.id] });
                        }
                        setEditingEndDate(false);
                      }}
                      className={cn("p-3 pointer-events-auto")}
                    />
                  </PopoverContent>
                </Popover>
              )}
            </div>
          </div>
          <div className="glass-card rounded-lg p-4">
            <span className="text-xs text-muted-foreground">Valor</span>
            <p className="text-sm font-semibold text-foreground mt-1">
              {plano?.valor ? `R$ ${Number(plano.valor).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}` : "—"}
            </p>
          </div>
        </div>
      </div>

      {/* Seção 1.5: Serviços (Plano + Contratados) */}
      {(() => {
        const servico = creditos.filter((c) => c.origem_tipo === "servico");

        // Serviços do Plano: derivados de plano.servicos (ex.: "4 Avaliação Funcional")
        // + compras adicionais e usos registrados em consumo_servicos.
        const PLAN_SERVICES = [
          { label: "Avaliação Funcional", icon: Activity },
          { label: "Consultas Nutrição", icon: Utensils },
          { label: "Consultas Reabilitação", icon: Footprints },
        ];
        const parseBase = (tipo: string): number => {
          for (const s of (plano?.servicos || []) as string[]) {
            const m = s.match(/^(\d+)\s+(.+)$/);
            if (m && m[2] === tipo) return parseInt(m[1]);
          }
          return 0;
        };
        const planoItems = PLAN_SERVICES.map(({ label, icon: Icon }) => {
          const base = parseBase(label);
          const comprado = (consumos as any[])
            .filter((c) => c.tipo_servico === label && c.tipo_registro === "compra")
            .reduce((s, c) => s + (c.quantidade ?? 1), 0);
          const usado = (consumos as any[])
            .filter((c) => c.tipo_servico === label && (!!c.agenda_id || c.tipo_registro === "uso_manual"))
            .length;
          const total = base + comprado;
          const restante = Math.max(0, total - usado);
          return { label, Icon, total, restante };
        }).filter((i) => i.total > 0);

        const renderItem = (c: any) => {
          const restante = c.ilimitado ? "∞" : Math.max(0, (c.quantidade_inicial ?? 0) - (c.quantidade_usada ?? 0));
          const total = c.ilimitado ? "∞" : (c.quantidade_inicial ?? 0);
          return (
            <div key={c.id} className="glass-card rounded-lg p-3 flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-foreground">{c.atividade}</p>
                {c.data_validade && (
                  <p className="text-xs text-muted-foreground">
                    Validade: {new Date(c.data_validade + "T00:00:00").toLocaleDateString("pt-BR")}
                  </p>
                )}
              </div>
              <Badge variant="outline" className="text-xs">{restante}/{total}</Badge>
            </div>
          );
        };
        return (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div>
              <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                <Activity className="w-4 h-4 text-muted-foreground" />
                Serviços do Plano
              </h3>
              {planoItems.length === 0 ? (
                <div className="glass-card rounded-lg p-4">
                  <p className="text-sm text-muted-foreground">Nenhum serviço incluído no plano</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {planoItems.map(({ label, Icon, total, restante }) => (
                    <div key={label} className="glass-card rounded-lg p-3 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Icon className="w-4 h-4 text-muted-foreground" />
                        <p className="text-sm font-semibold text-foreground">{label}</p>
                      </div>
                      <Badge variant="outline" className="text-xs">{restante}/{total}</Badge>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div>
              <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-muted-foreground" />
                Serviços Contratados
              </h3>
              {servico.length === 0 ? (
                <div className="glass-card rounded-lg p-4">
                  <p className="text-sm text-muted-foreground">Nenhum serviço contratado</p>
                </div>
              ) : (
                <div className="space-y-2">{servico.map(renderItem)}</div>
              )}
            </div>
          </div>
        );
      })()}

      {/* Seção 2: Professor */}
      <div>
        <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
          <User className="w-4 h-4 text-muted-foreground" />
          Professor Responsável
        </h3>
        <div className="glass-card rounded-lg p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
              <User className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">{professor?.full_name || "Não atribuído"}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Seção 3: Última Avaliação Funcional */}
      <div>
        <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
          <Activity className="w-4 h-4 text-muted-foreground" />
          Última Avaliação Funcional
        </h3>
        <div className="glass-card rounded-lg p-4">
          {lastAval ? (
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-foreground">
                  {new Date(lastAval.data + "T00:00:00").toLocaleDateString("pt-BR")}
                </p>
                <p className="text-xs text-muted-foreground">
                  {(() => {
                    const d = new Date(lastAval.data + "T00:00:00");
                    const diffMs = today.getTime() - d.getTime();
                    const diffDays = Math.floor(diffMs / 86400000);
                    if (diffDays < 30) return `Há ${diffDays} dias`;
                    const diffMonths = Math.floor(diffDays / 30);
                    return `Há ${diffMonths} ${diffMonths === 1 ? "mês" : "meses"}`;
                  })()}
                </p>
              </div>
              {(() => {
                const d = new Date(lastAval.data + "T00:00:00");
                const m4 = new Date(d);
                m4.setMonth(m4.getMonth() + 4);
                const m6 = new Date(d);
                m6.setMonth(m6.getMonth() + 6);
                if (today >= m6) return <Badge variant="outline" className="status-urgent text-xs">Atrasada</Badge>;
                if (today >= m4) return <Badge variant="outline" className="status-warning text-xs">Pendente</Badge>;
                return <Badge variant="outline" className="status-active text-xs">Em dia</Badge>;
              })()}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Nenhuma avaliação funcional registrada</p>
          )}
        </div>
      </div>

      {/* Seção 4: Alertas do Aluno */}
      <div>
        <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-warning" />
          Alertas
        </h3>
        {alerts.length === 0 ? (
          <div className="glass-card rounded-lg p-4">
            <p className="text-sm text-muted-foreground text-center">Nenhum alerta para este aluno 🎉</p>
          </div>
        ) : (
          <div className="space-y-2">
            {alerts.map((alert) => (
              <div
                key={alert.id}
                className="glass-card rounded-lg p-3 flex items-start gap-3"
              >
                <div className={`shrink-0 w-8 h-8 rounded-md flex items-center justify-center ${severityClass[alert.severity]}`}>
                  <alert.icon className="w-4 h-4" />
                </div>
                <p className="text-sm text-foreground">{alert.message}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Seção 5: Dados Cadastrais */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <FileText className="w-4 h-4 text-muted-foreground" />
            Dados Cadastrais
          </h3>
          {isCoordAdmin && (
            <button
              className="text-muted-foreground hover:text-primary transition-colors flex items-center gap-1 text-xs"
              onClick={() => setEditingCadastro(true)}
              title="Editar dados cadastrais"
            >
              <Pencil className="w-3.5 h-3.5" /> Editar
            </button>
          )}
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="glass-card rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <Heart className="w-4 h-4 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Status</span>
            </div>
            <Badge variant="outline" className={`${displayStatus.className} text-xs`}>{displayStatus.label}</Badge>
          </div>
          <div className="glass-card rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <CalendarDays className="w-4 h-4 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Data de Nascimento</span>
            </div>
            <p className="text-sm font-semibold text-foreground">
              {student.data_nascimento
                ? `${new Date(student.data_nascimento + "T00:00:00").toLocaleDateString("pt-BR")} (${calcAge(student.data_nascimento)} anos)`
                : "Não informada"}
            </p>
          </div>
          <div className="glass-card rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <User className="w-4 h-4 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Sexo</span>
            </div>
            <p className="text-sm font-semibold text-foreground capitalize">
              {(student as any).sexo ? String((student as any).sexo).replace("_", " ") : "Não informado"}
            </p>
          </div>
          <div className="glass-card rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <FileText className="w-4 h-4 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">CPF</span>
            </div>
            <p className="text-sm font-semibold text-foreground font-mono">{(student as any).cpf || "Não informado"}</p>
          </div>
          <div className="glass-card rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <FileText className="w-4 h-4 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">RG</span>
            </div>
            <p className="text-sm font-semibold text-foreground font-mono">{(student as any).rg || "Não informado"}</p>
          </div>
          <div className="glass-card rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <ClipboardCheck className="w-4 h-4 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Email</span>
            </div>
            <p className="text-sm font-semibold text-foreground break-all">{student.email || "Não informado"}</p>
          </div>
          <div className="glass-card rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <CalendarDays className="w-4 h-4 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Telefone</span>
            </div>
            <p className="text-sm font-semibold text-foreground">{student.telefone || "Não informado"}</p>
          </div>
          <div className="glass-card rounded-lg p-4 lg:col-span-2">
            <div className="flex items-center gap-2 mb-2">
              <FileText className="w-4 h-4 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Endereço</span>
            </div>
            {(() => {
              const a: any = student;
              const linha = [
                a.logradouro,
                a.numero,
                a.complemento,
              ].filter(Boolean).join(", ");
              const cidade = [a.bairro, a.cidade && a.uf ? `${a.cidade}/${a.uf}` : a.cidade || a.uf]
                .filter(Boolean).join(" · ");
              const cep = a.cep ? `CEP ${a.cep}` : null;
              const parts = [linha, cidade, cep].filter(Boolean);
              return parts.length > 0 ? (
                <p className="text-sm font-semibold text-foreground">{parts.join(" — ")}</p>
              ) : (
                <p className="text-sm text-muted-foreground">Não informado</p>
              );
            })()}
          </div>
          <div className="glass-card rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <Sparkles className="w-4 h-4 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Origem</span>
            </div>
            <p className="text-sm font-semibold text-foreground">{origemLead || "Não informada"}</p>
          </div>
          <div className="glass-card rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <Dumbbell className="w-4 h-4 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Cadastro</span>
            </div>
            <p className="text-sm font-semibold text-foreground">{new Date(student.created_at).toLocaleDateString("pt-BR")}</p>
          </div>
        </div>
      </div>

      {/* Observações */}
      {student.observacoes && (
        <div className="glass-card rounded-lg p-4">
          <h3 className="text-sm font-semibold text-foreground mb-2">Observações</h3>
          <p className="text-sm text-muted-foreground">{student.observacoes}</p>
        </div>
      )}

      <EditDadosCadastraisDialog
        open={editingCadastro}
        onOpenChange={setEditingCadastro}
        alunoId={student.id}
      />
    </div>
  );
}
