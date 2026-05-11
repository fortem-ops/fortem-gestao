import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Activity, Utensils, Footprints, MessageCircle } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import AddStudentDialog from "@/components/student/AddStudentDialog";
import { StudentListFilters, defaultFilters, type StudentFilters } from "@/components/student/StudentListFilters";
import { addMonths, format, isAfter, isBefore, startOfDay } from "date-fns";
import { getDisplayStatus } from "@/lib/studentStatus";
import type { AlunoLicenca } from "@/lib/licencas";

function parseServiceCount(servicos: string[] | null, tipoServico: string): number {
  if (!servicos) return 0;
  for (const s of servicos) {
    const match = s.match(/^(\d+)\s+(.+)$/);
    if (match && match[2] === tipoServico) return parseInt(match[1]);
  }
  return 0;
}

interface ServiceCredits {
  avalFuncional: { base: number; comprado: number; total: number; usado: number };
  nutricao: { base: number; comprado: number; total: number; usado: number };
  reabilitacao: { base: number; comprado: number; total: number; usado: number };
}

export default function StudentList() {
  const [filters, setFilters] = useState<StudentFilters>(defaultFilters);
  const navigate = useNavigate();

  const { data: profiles = [] } = useQuery({
    queryKey: ["all_profiles"],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("user_id, full_name");
      return data || [];
    },
  });

  const professors = profiles.map((p) => ({ id: p.user_id, name: p.full_name }));
  const profileMap: Record<string, string> = {};
  profiles.forEach((p) => { profileMap[p.user_id] = p.full_name; });

  const { data: alunos = [], isLoading, refetch } = useQuery({
    queryKey: ["alunos_with_plans"],
    queryFn: async () => {
      const { data: students, error } = await supabase.from("alunos").select("*").order("nome");
      if (error) throw error;

      const ids = students.map((s) => s.id);
      const { data: planos } = await supabase.from("planos").select("*").in("aluno_id", ids).eq("ativo", true);
      const { data: consumos } = await supabase
        .from("consumo_servicos")
        .select("aluno_id, plano_id, tipo_servico, quantidade, agenda_id, tipo_registro")
        .in("aluno_id", ids);
      const { data: licencas } = await supabase
        .from("aluno_licencas" as any)
        .select("*")
        .in("aluno_id", ids);
      const licencasMap: Record<string, AlunoLicenca[]> = {};
      ((licencas as unknown as AlunoLicenca[]) || []).forEach((l) => {
        (licencasMap[l.aluno_id] ||= []).push(l);
      });

      const creditsMap: Record<string, ServiceCredits> = {};
      const planEndMap: Record<string, Date | null> = {};
      const planTipoMap: Record<string, string | null> = {};

      for (const student of students) {
        const plano = planos?.find((p) => p.aluno_id === student.id);
        const studentConsumos = consumos?.filter((c) => c.aluno_id === student.id && c.plano_id === plano?.id) || [];

        // Plan end date + tipo
        if (plano) {
          planEndMap[student.id] = addMonths(new Date(plano.data_inicio), plano.duracao_meses);
          planTipoMap[student.id] = plano.tipo || null;
        } else {
          planEndMap[student.id] = null;
          planTipoMap[student.id] = null;
        }

        const countPurchased = (tipo: string) =>
          studentConsumos.filter((c: any) => c.tipo_servico === tipo && c.tipo_registro === "compra")
            .reduce((sum: number, c: any) => sum + ((c as any).quantidade ?? 1), 0);

        const countUsed = (tipo: string) =>
          studentConsumos.filter((c: any) => c.tipo_servico === tipo && (!!c.agenda_id || (c as any).tipo_registro === "uso_manual")).length;

        const buildCredit = (tipo: string) => {
          const base = parseServiceCount(plano?.servicos || null, tipo);
          const comprado = countPurchased(tipo);
          return { base, comprado, total: base + comprado, usado: countUsed(tipo) };
        };

        creditsMap[student.id] = {
          avalFuncional: buildCredit("Avaliação Funcional"),
          nutricao: buildCredit("Consultas Nutrição"),
          reabilitacao: buildCredit("Consultas Reabilitação"),
        };
      }

      return students.map((s) => ({ ...s, credits: creditsMap[s.id], planEnd: planEndMap[s.id], planTipo: planTipoMap[s.id], licencas: licencasMap[s.id] || [] }));
    },
  });

  const filtered = alunos.filter((s) => {
    const c = s.credits;
    const matchSearch = s.nome.toLowerCase().includes(filters.search.toLowerCase()) ||
      (s.email?.toLowerCase().includes(filters.search.toLowerCase()) ?? false);
    const display = getDisplayStatus(s.status, s.planEnd, s.licencas);
    const matchStatus = filters.status === "todos" || display.key === filters.status;

    const matchFreq = filters.frequencia === "todos" ||
      (filters.frequencia === "livre" ? s.frequencia_semanal === 0 : s.frequencia_semanal === parseInt(filters.frequencia));

    const hasBase = c && (c.avalFuncional.base > 0 || c.nutricao.base > 0 || c.reabilitacao.base > 0);
    const matchSP = filters.servicosPlano === "todos" ||
      (filters.servicosPlano === "com" ? hasBase : !hasBase);

    const hasPurch = c && (c.avalFuncional.comprado > 0 || c.nutricao.comprado > 0 || c.reabilitacao.comprado > 0);
    const matchSC = filters.servicosContratados === "todos" ||
      (filters.servicosContratados === "com" ? hasPurch : !hasPurch);

    const matchProf = filters.professor === "todos" || s.responsavel_id === filters.professor;

    let matchDate = true;
    if (filters.dataFinalDe && s.planEnd) {
      matchDate = matchDate && !isBefore(s.planEnd, startOfDay(filters.dataFinalDe));
    }
    if (filters.dataFinalAte && s.planEnd) {
      matchDate = matchDate && !isAfter(s.planEnd, startOfDay(filters.dataFinalAte));
    }
    if ((filters.dataFinalDe || filters.dataFinalAte) && !s.planEnd) {
      matchDate = false;
    }

    return matchSearch && matchStatus && matchFreq && matchSP && matchSC && matchProf && matchDate;
  });

  const CreditBadge = ({ total, usado, icon: Icon, label }: { total: number; usado: number; icon: any; label: string }) => {
    if (total === 0) return null;
    const restante = total - usado;
    const color = restante > 0 ? "text-primary" : "text-destructive";
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <span className={`inline-flex items-center gap-1 text-xs font-medium ${color}`}>
            <Icon className="h-3 w-3" />
            {usado}/{total}
          </span>
        </TooltipTrigger>
        <TooltipContent>
          <p>{label}: {usado} de {total} utilizado{usado !== 1 ? "s" : ""}</p>
        </TooltipContent>
      </Tooltip>
    );
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-heading font-bold text-foreground">Alunos</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {alunos.length} aluno{alunos.length !== 1 ? "s" : ""} cadastrado{alunos.length !== 1 ? "s" : ""}
          </p>
        </div>
        <AddStudentDialog onStudentAdded={() => refetch()} />
      </div>

      <StudentListFilters filters={filters} onChange={setFilters} professors={professors} />

      <div className="glass-card rounded-lg overflow-hidden overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left text-xs font-medium text-muted-foreground p-4">Nome</th>
              <th className="text-left text-xs font-medium text-muted-foreground p-4 hidden md:table-cell">Status</th>
              <th className="text-left text-xs font-medium text-muted-foreground p-4 hidden md:table-cell">Plano</th>
              <th className="text-left text-xs font-medium text-muted-foreground p-4 hidden md:table-cell">Frequência</th>
              <th className="text-left text-xs font-medium text-muted-foreground p-4 hidden lg:table-cell">Professor</th>
              <th className="text-left text-xs font-medium text-muted-foreground p-4 hidden lg:table-cell">Final Plano</th>
              <th className="text-left text-xs font-medium text-muted-foreground p-4 hidden xl:table-cell">Serviços do Plano</th>
              <th className="text-left text-xs font-medium text-muted-foreground p-4 hidden xl:table-cell">Serviços Contratados</th>
              <th className="text-center text-xs font-medium text-muted-foreground p-4 hidden xl:table-cell">WhatsApp</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i} className="border-b border-border/50">
                  <td className="p-4"><Skeleton className="h-5 w-40" /></td>
                  <td className="p-4 hidden md:table-cell"><Skeleton className="h-5 w-16" /></td>
                  <td className="p-4 hidden md:table-cell"><Skeleton className="h-5 w-16" /></td>
                  <td className="p-4 hidden md:table-cell"><Skeleton className="h-5 w-20" /></td>
                  <td className="p-4 hidden lg:table-cell"><Skeleton className="h-5 w-24" /></td>
                  <td className="p-4 hidden lg:table-cell"><Skeleton className="h-5 w-20" /></td>
                  <td className="p-4 hidden xl:table-cell"><Skeleton className="h-5 w-32" /></td>
                  <td className="p-4 hidden xl:table-cell"><Skeleton className="h-5 w-32" /></td>
                  <td className="p-4 hidden xl:table-cell"><Skeleton className="h-5 w-8" /></td>
                </tr>
              ))
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={9} className="p-8 text-center text-muted-foreground">
                  Nenhum aluno encontrado.
                </td>
              </tr>
            ) : (
              filtered.map((student) => {
                const c = student.credits;
                const hasBasePlan = c && (c.avalFuncional.base > 0 || c.nutricao.base > 0 || c.reabilitacao.base > 0);
                const hasPurchased = c && (c.avalFuncional.comprado > 0 || c.nutricao.comprado > 0 || c.reabilitacao.comprado > 0);

                const whatsappNumber = student.telefone?.replace(/\D/g, "") || null;
                const professorName = student.responsavel_id ? profileMap[student.responsavel_id] : null;

                const planEndStr = student.planEnd
                  ? format(student.planEnd, "dd/MM/yyyy")
                  : null;

                const isPlanExpired = student.planEnd && isBefore(student.planEnd, new Date());

                return (
                  <tr
                    key={student.id}
                    onClick={() => navigate(`/alunos/${student.id}`)}
                    className="border-b border-border/50 hover:bg-secondary/50 cursor-pointer transition-colors"
                  >
                    <td className="p-4">
                      <div>
                        <p className="text-sm font-medium text-foreground">{student.nome}</p>
                        <p className="text-xs text-muted-foreground">{student.email || "—"}</p>
                      </div>
                    </td>
                    <td className="p-4 hidden md:table-cell">
                      {(() => {
                        const d = getDisplayStatus(student.status, student.planEnd, student.licencas);
                        return (
                          <Badge variant="outline" className={`text-xs ${d.className}`}>{d.label}</Badge>
                        );
                      })()}
                    </td>
                    <td className="p-4 hidden md:table-cell">
                      {student.planTipo ? (
                        <Badge variant="outline" className="text-xs">{student.planTipo}</Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="p-4 hidden md:table-cell">
                      <span className="text-sm text-muted-foreground">
                        {student.frequencia_semanal === 0 ? "Livre" : `${student.frequencia_semanal}x/semana`}
                      </span>
                    </td>
                    <td className="p-4 hidden lg:table-cell">
                      <span className="text-sm text-muted-foreground">{professorName || "—"}</span>
                    </td>
                    <td className="p-4 hidden lg:table-cell">
                      {planEndStr ? (
                        <span className={`text-sm ${isPlanExpired ? "text-destructive font-medium" : "text-muted-foreground"}`}>
                          {planEndStr}
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="p-4 hidden xl:table-cell">
                      {hasBasePlan ? (
                        <div className="flex items-center gap-3">
                          <CreditBadge total={c.avalFuncional.base} usado={c.avalFuncional.usado} icon={Activity} label="Avaliação Funcional (Plano)" />
                          <CreditBadge total={c.nutricao.base} usado={Math.min(c.nutricao.usado, c.nutricao.base)} icon={Utensils} label="Nutrição (Plano)" />
                          <CreditBadge total={c.reabilitacao.base} usado={Math.min(c.reabilitacao.usado, c.reabilitacao.base)} icon={Footprints} label="Reabilitação (Plano)" />
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="p-4 hidden xl:table-cell">
                      {hasPurchased ? (
                        <div className="flex items-center gap-3">
                          <CreditBadge total={c.avalFuncional.comprado} usado={Math.max(0, c.avalFuncional.usado - c.avalFuncional.base)} icon={Activity} label="Avaliação Funcional (Contratado)" />
                          <CreditBadge total={c.nutricao.comprado} usado={Math.max(0, c.nutricao.usado - c.nutricao.base)} icon={Utensils} label="Nutrição (Contratado)" />
                          <CreditBadge total={c.reabilitacao.comprado} usado={Math.max(0, c.reabilitacao.usado - c.reabilitacao.base)} icon={Footprints} label="Reabilitação (Contratado)" />
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="p-4 hidden xl:table-cell text-center">
                      {whatsappNumber ? (
                        <a
                          href={`https://wa.me/55${whatsappNumber}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="inline-flex items-center justify-center text-primary hover:text-primary/80 transition-colors"
                        >
                          <MessageCircle className="h-5 w-5" />
                        </a>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
