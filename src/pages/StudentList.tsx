import { useState } from "react";
import { mockStudents, getRemainingDays, type StudentStatus } from "@/lib/mock-data";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Search, Filter } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const statusLabel: Record<StudentStatus, string> = { ativo: 'Ativo', licenca: 'Licença', encerrado: 'Encerrado' };
const statusClass: Record<StudentStatus, string> = { ativo: 'status-active', licenca: 'status-warning', encerrado: 'status-urgent' };

export default function StudentList() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("todos");
  const navigate = useNavigate();

  const filtered = mockStudents.filter(s => {
    const matchSearch = s.name.toLowerCase().includes(search.toLowerCase()) || s.email.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === "todos" || s.status === statusFilter;
    return matchSearch && matchStatus;
  });

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-heading font-bold text-foreground">Alunos</h1>
        <p className="text-sm text-muted-foreground mt-1">{mockStudents.length} alunos cadastrados</p>
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
              <th className="text-left text-xs font-medium text-muted-foreground p-4 hidden md:table-cell">Plano</th>
              <th className="text-left text-xs font-medium text-muted-foreground p-4 hidden lg:table-cell">Responsável</th>
              <th className="text-left text-xs font-medium text-muted-foreground p-4 hidden lg:table-cell">Dias Restantes</th>
              <th className="text-left text-xs font-medium text-muted-foreground p-4 hidden xl:table-cell">Última Avaliação</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((student) => {
              const remaining = getRemainingDays(student.planStart, student.planDurationMonths);
              return (
                <tr
                  key={student.id}
                  onClick={() => navigate(`/alunos/${student.id}`)}
                  className="border-b border-border/50 hover:bg-secondary/50 cursor-pointer transition-colors"
                >
                  <td className="p-4">
                    <div>
                      <p className="text-sm font-medium text-foreground">{student.name}</p>
                      <p className="text-xs text-muted-foreground">{student.email}</p>
                    </div>
                  </td>
                  <td className="p-4 hidden md:table-cell">
                    <Badge variant="outline" className={`text-xs ${statusClass[student.status]}`}>
                      {statusLabel[student.status]}
                    </Badge>
                  </td>
                  <td className="p-4 hidden md:table-cell">
                    <span className="text-sm text-foreground">{student.plan}</span>
                  </td>
                  <td className="p-4 hidden lg:table-cell">
                    <span className="text-sm text-muted-foreground">{student.responsible}</span>
                  </td>
                  <td className="p-4 hidden lg:table-cell">
                    <span className={`text-sm ${remaining < 30 ? 'text-destructive' : remaining < 90 ? 'text-warning' : 'text-muted-foreground'}`}>
                      {remaining > 0 ? `${remaining}d` : 'Vencido'}
                    </span>
                  </td>
                  <td className="p-4 hidden xl:table-cell">
                    <span className="text-sm text-muted-foreground">
                      {student.lastAssessment || '—'}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
