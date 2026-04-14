import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Search, Filter, Activity, Utensils, Footprints } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import AddStudentDialog from "@/components/student/AddStudentDialog";

type Status = "ativo" | "licenca" | "encerrado";
const statusLabel: Record<Status, string> = { ativo: "Ativo", licenca: "Licença", encerrado: "Encerrado" };
const statusClass: Record<Status, string> = { ativo: "status-active", licenca: "status-warning", encerrado: "status-urgent" };

function parseServiceCount(servicos: string[] | null, tipoServico: string): number {
  if (!servicos) return 0;
  for (const s of servicos) {
    const match = s.match(/^(\d+)\s+(.+)$/);
    if (match && match[2] === tipoServico) return parseInt(match[1]);
  }
  return 0;
}

interface ServiceCredits {
  avalFuncional: { total: number; usado: number };
  nutricao: { total: number; usado: number };
  reabilitacao: { total: number; usado: number };
}

export default function StudentList() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("todos");
  const navigate = useNavigate();

  const { data: alunos = [], isLoading, refetch } = useQuery({
    queryKey: ["alunos_with_plans"],
    queryFn: async () => {
      const { data: students, error } = await supabase
        .from("alunos")
        .select("*")
        .order("nome");
      if (error) throw error;

      // Fetch active plans for all students
      const ids = students.map((s) => s.id);
      const { data: planos } = await supabase
        .from("planos")
        .select("*")
        .in("aluno_id", ids)
        .eq("ativo", true);

      // Fetch all consumption records
      const { data: consumos } = await supabase
        .from("consumo_servicos")
        .select("aluno_id, plano_id, tipo_servico")
        .in("aluno_id", ids);

      // Build a map of credits per student
      const creditsMap: Record<string, ServiceCredits> = {};
      for (const student of students) {
        const plano = planos?.find((p) => p.aluno_id === student.id);
        const studentConsumos = consumos?.filter((c) => c.aluno_id === student.id && c.plano_id === plano?.id) || [];

        const countUsed = (tipo: string) => studentConsumos.filter((c) => c.tipo_servico === tipo).length;

        creditsMap[student.id] = {
          avalFuncional: {
            total: parseServiceCount(plano?.servicos || null, "Avaliação Funcional"),
            usado: countUsed("Avaliação Funcional"),
          },
          nutricao: {
            total: parseServiceCount(plano?.servicos || null, "Consultas Nutrição"),
            usado: countUsed("Consultas Nutrição"),
          },
          reabilitacao: {
            total: parseServiceCount(plano?.servicos || null, "Consultas Reabilitação"),
            usado: countUsed("Consultas Reabilitação"),
          },
        };
      }

      return students.map((s) => ({ ...s, credits: creditsMap[s.id] }));
    },
  });

  const filtered = alunos.filter((s) => {
    const matchSearch =
      s.nome.toLowerCase().includes(search.toLowerCase()) ||
      (s.email?.toLowerCase().includes(search.toLowerCase()) ?? false);
    const matchStatus = statusFilter === "todos" || s.status === statusFilter;
    return matchSearch && matchStatus;
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

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome ou email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[160px]">
            <Filter className="w-4 h-4 mr-2" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos</SelectItem>
            <SelectItem value="ativo">Ativos</SelectItem>
            <SelectItem value="licenca">Licença</SelectItem>
            <SelectItem value="encerrado">Encerrados</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="glass-card rounded-lg overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left text-xs font-medium text-muted-foreground p-4">Nome</th>
              <th className="text-left text-xs font-medium text-muted-foreground p-4 hidden md:table-cell">Status</th>
              <th className="text-left text-xs font-medium text-muted-foreground p-4 hidden md:table-cell">Frequência</th>
              <th className="text-left text-xs font-medium text-muted-foreground p-4 hidden lg:table-cell">Serviços do Plano</th>
              <th className="text-left text-xs font-medium text-muted-foreground p-4 hidden xl:table-cell">Telefone</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i} className="border-b border-border/50">
                  <td className="p-4"><Skeleton className="h-5 w-40" /></td>
                  <td className="p-4 hidden md:table-cell"><Skeleton className="h-5 w-16" /></td>
                  <td className="p-4 hidden md:table-cell"><Skeleton className="h-5 w-20" /></td>
                  <td className="p-4 hidden lg:table-cell"><Skeleton className="h-5 w-32" /></td>
                  <td className="p-4 hidden xl:table-cell"><Skeleton className="h-5 w-28" /></td>
                </tr>
              ))
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={5} className="p-8 text-center text-muted-foreground">
                  Nenhum aluno encontrado.
                </td>
              </tr>
            ) : (
              filtered.map((student) => {
                const c = student.credits;
                const hasAnyService = c && (c.avalFuncional.total > 0 || c.nutricao.total > 0 || c.reabilitacao.total > 0);
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
                      <Badge variant="outline" className={`text-xs ${statusClass[student.status as Status] || ""}`}>
                        {statusLabel[student.status as Status] || student.status}
                      </Badge>
                    </td>
                    <td className="p-4 hidden md:table-cell">
                      <span className="text-sm text-muted-foreground">
                        {student.frequencia_semanal === 0 ? "Livre" : `${student.frequencia_semanal}x/semana`}
                      </span>
                    </td>
                    <td className="p-4 hidden lg:table-cell">
                      {hasAnyService ? (
                        <div className="flex items-center gap-3">
                          <CreditBadge total={c.avalFuncional.total} usado={c.avalFuncional.usado} icon={Activity} label="Avaliação Funcional" />
                          <CreditBadge total={c.nutricao.total} usado={c.nutricao.usado} icon={Utensils} label="Consultas Nutrição" />
                          <CreditBadge total={c.reabilitacao.total} usado={c.reabilitacao.usado} icon={Footprints} label="Consultas Reabilitação" />
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="p-4 hidden xl:table-cell">
                      <span className="text-sm text-muted-foreground">{student.telefone || "—"}</span>
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
