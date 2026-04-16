import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Users, ArrowRightLeft, Search, Filter } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";

export default function CarteiraAlunos() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [filterProfessor, setFilterProfessor] = useState<string>("all");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [transferOpen, setTransferOpen] = useState(false);
  const [targetProfessor, setTargetProfessor] = useState("");

  // Check if current user is coord/admin
  const { data: isCoordAdmin } = useQuery({
    queryKey: ["isCoordAdmin", user?.id],
    queryFn: async () => {
      const { data } = await supabase.rpc("is_coordinator_or_admin", { _user_id: user!.id });
      return !!data;
    },
    enabled: !!user,
  });

  // Fetch professors
  const { data: professors = [] } = useQuery({
    queryKey: ["professors-carteira"],
    queryFn: async () => {
      const { data: roles } = await supabase
        .from("user_roles")
        .select("user_id")
        .in("role", ["professor", "coordenador", "admin"]);
      if (!roles?.length) return [];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, full_name")
        .in("user_id", roles.map((r) => r.user_id));
      return profiles || [];
    },
  });

  // Fetch active students (those with active plans)
  const { data: studentsWithPlans = [], isLoading } = useQuery({
    queryKey: ["carteira-alunos"],
    queryFn: async () => {
      const { data: activePlans } = await supabase
        .from("planos")
        .select("aluno_id")
        .eq("ativo", true);
      if (!activePlans?.length) return [];

      const alunoIds = [...new Set(activePlans.map((p) => p.aluno_id))];
      const { data: alunos } = await supabase
        .from("alunos")
        .select("id, nome, email, status, responsavel_id, frequencia_semanal")
        .in("id", alunoIds)
        .eq("status", "ativo")
        .order("nome");
      return alunos || [];
    },
  });

  const profMap = useMemo(() => {
    const m: Record<string, string> = {};
    professors.forEach((p) => { m[p.user_id] = p.full_name; });
    return m;
  }, [professors]);

  const filtered = useMemo(() => {
    return studentsWithPlans.filter((a) => {
      if (search && !a.nome.toLowerCase().includes(search.toLowerCase())) return false;
      if (filterProfessor !== "all" && a.responsavel_id !== filterProfessor) return false;
      return true;
    });
  }, [studentsWithPlans, search, filterProfessor]);

  // Group by professor, logged-in user first
  const grouped = useMemo(() => {
    const g: Record<string, typeof filtered> = {};
    filtered.forEach((a) => {
      const key = a.responsavel_id || "sem-professor";
      if (!g[key]) g[key] = [];
      g[key].push(a);
    });
    // Sort: current user's group first
    const entries = Object.entries(g);
    entries.sort(([a], [b]) => {
      if (a === user?.id) return -1;
      if (b === user?.id) return 1;
      if (a === "sem-professor") return 1;
      if (b === "sem-professor") return -1;
      return 0;
    });
    return entries;
  }, [filtered, user?.id]);

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    if (selected.size === filtered.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(filtered.map((a) => a.id)));
    }
  };

  const transferMutation = useMutation({
    mutationFn: async () => {
      const ids = Array.from(selected);
      const { error } = await supabase
        .from("alunos")
        .update({ responsavel_id: targetProfessor })
        .in("id", ids);
      if (error) throw error;

      // Register in history for each student
      const userId = user!.id;
      const profName = profMap[targetProfessor] || "Desconhecido";
      const histEntries = ids.map((aluno_id) => ({
        aluno_id,
        autor_id: userId,
        categoria: "transferencia",
        descricao: `Aluno transferido para o professor ${profName}`,
      }));
      await supabase.from("historico_profissional").insert(histEntries);
    },
    onSuccess: () => {
      toast.success(`${selected.size} aluno(s) transferido(s) com sucesso`);
      setSelected(new Set());
      setTransferOpen(false);
      setTargetProfessor("");
      queryClient.invalidateQueries({ queryKey: ["carteira-alunos"] });
    },
    onError: () => toast.error("Erro ao transferir alunos"),
  });

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-heading font-bold text-foreground">Carteira de Alunos</h1>
          <p className="text-sm text-muted-foreground">Alunos com planos ativos e seus professores responsáveis</p>
        </div>
        {isCoordAdmin && selected.size > 0 && (
          <Button onClick={() => setTransferOpen(true)} className="gap-2">
            <ArrowRightLeft className="w-4 h-4" />
            Transferir {selected.size} aluno(s)
          </Button>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar aluno..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={filterProfessor} onValueChange={setFilterProfessor}>
          <SelectTrigger className="w-[220px]">
            <Filter className="w-4 h-4 mr-2" />
            <SelectValue placeholder="Filtrar por professor" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os professores</SelectItem>
            {professors.map((p) => (
              <SelectItem key={p.user_id} value={p.user_id}>{p.full_name}</SelectItem>
            ))}
            <SelectItem value="sem-professor">Sem professor</SelectItem>
          </SelectContent>
        </Select>
        {isCoordAdmin && (
          <Button variant="outline" size="sm" onClick={selectAll}>
            {selected.size === filtered.length && filtered.length > 0 ? "Desmarcar todos" : "Selecionar todos"}
          </Button>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="glass-card">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Total com plano ativo</p>
            <p className="text-2xl font-bold text-foreground">{studentsWithPlans.length}</p>
          </CardContent>
        </Card>
        <Card className="glass-card">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Professores</p>
            <p className="text-2xl font-bold text-foreground">
              {new Set(studentsWithPlans.filter((a) => a.responsavel_id).map((a) => a.responsavel_id)).size}
            </p>
          </CardContent>
        </Card>
        <Card className="glass-card">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Sem professor</p>
            <p className="text-2xl font-bold text-warning">
              {studentsWithPlans.filter((a) => !a.responsavel_id).length}
            </p>
          </CardContent>
        </Card>
        <Card className="glass-card">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Selecionados</p>
            <p className="text-2xl font-bold text-primary">{selected.size}</p>
          </CardContent>
        </Card>
      </div>

      {/* Grouped list */}
      {isLoading ? (
        <p className="text-muted-foreground text-center py-10">Carregando...</p>
      ) : Object.keys(grouped).length === 0 ? (
        <p className="text-muted-foreground text-center py-10">Nenhum aluno com plano ativo encontrado</p>
      ) : (
        Object.entries(grouped).map(([profId, alunos]) => (
          <Card key={profId} className="glass-card">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Users className="w-4 h-4 text-primary" />
                {profId === "sem-professor" ? "Sem professor atribuído" : profMap[profId] || "Professor desconhecido"}
                <Badge variant="secondary" className="ml-auto">{alunos.length} aluno(s)</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y divide-border">
                {alunos.map((aluno) => (
                  <div key={aluno.id} className="flex items-center gap-3 px-4 py-3 hover:bg-muted/30 transition-colors">
                    {isCoordAdmin && (
                      <Checkbox
                        checked={selected.has(aluno.id)}
                        onCheckedChange={() => toggleSelect(aluno.id)}
                      />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{aluno.nome}</p>
                      <p className="text-xs text-muted-foreground">{aluno.email || "Sem email"} · {aluno.frequencia_semanal || 0}x/semana</p>
                    </div>
                    <Badge variant="outline" className="status-active text-xs">Ativo</Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ))
      )}

      {/* Transfer dialog */}
      <Dialog open={transferOpen} onOpenChange={setTransferOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Transferir Alunos</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Transferir <strong>{selected.size}</strong> aluno(s) para outro professor.
          </p>
          <Select value={targetProfessor} onValueChange={setTargetProfessor}>
            <SelectTrigger>
              <SelectValue placeholder="Selecione o professor destino" />
            </SelectTrigger>
            <SelectContent>
              {professors.map((p) => (
                <SelectItem key={p.user_id} value={p.user_id}>{p.full_name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTransferOpen(false)}>Cancelar</Button>
            <Button
              onClick={() => transferMutation.mutate()}
              disabled={!targetProfessor || transferMutation.isPending}
            >
              {transferMutation.isPending ? "Transferindo..." : "Confirmar Transferência"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}