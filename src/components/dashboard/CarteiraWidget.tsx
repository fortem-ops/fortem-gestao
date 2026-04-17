import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Briefcase, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useNavigate } from "react-router-dom";

export function CarteiraWidget() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const { data: isCoordAdmin } = useQuery({
    queryKey: ["dashboard-isCoordAdmin", user?.id],
    queryFn: async () => {
      const { data } = await supabase.rpc("is_coordinator_or_admin", { _user_id: user!.id });
      return !!data;
    },
    enabled: !!user,
    staleTime: 5 * 60_000,
  });

  const { data: carteiras = [] } = useQuery({
    queryKey: ["dashboard-carteiras", user?.id, isCoordAdmin],
    queryFn: async () => {
      // Get active plans
      const { data: planos } = await supabase.from("planos").select("aluno_id").eq("ativo", true);
      if (!planos?.length) return [];
      const alunoIds = [...new Set(planos.map((p) => p.aluno_id))];

      // Get students with active plans
      const { data: alunos } = await supabase
        .from("alunos")
        .select("id, responsavel_id")
        .in("id", alunoIds)
        .eq("status", "ativo");

      if (!alunos?.length) return [];

      if (!isCoordAdmin) {
        // Professor: only their own count
        const count = alunos.filter((a) => a.responsavel_id === user!.id).length;
        return [{ userId: user!.id, name: "Minha Carteira", count }];
      }

      // Coord/Admin: group by professor
      const grouped: Record<string, number> = {};
      let semProf = 0;
      alunos.forEach((a) => {
        if (a.responsavel_id) {
          grouped[a.responsavel_id] = (grouped[a.responsavel_id] || 0) + 1;
        } else {
          semProf++;
        }
      });

      const profIds = Object.keys(grouped);
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, full_name")
        .in("user_id", profIds);

      const nameMap: Record<string, string> = {};
      (profiles || []).forEach((p) => { nameMap[p.user_id] = p.full_name; });

      const result = profIds
        .map((id) => ({ userId: id, name: nameMap[id] || "Desconhecido", count: grouped[id] }))
        .sort((a, b) => b.count - a.count);

      if (semProf > 0) {
        result.push({ userId: "none", name: "Sem professor", count: semProf });
      }

      return result;
    },
    enabled: !!user && isCoordAdmin !== undefined,
    staleTime: 60_000,
  });

  const total = carteiras.reduce((sum, c) => sum + c.count, 0);

  return (
    <div className="glass-card rounded-lg p-5 cursor-pointer" onClick={() => navigate("/carteira")}>
      <h3 className="font-heading font-semibold text-foreground mb-4 flex items-center gap-2">
        <Briefcase className="w-4 h-4 text-primary" />
        {isCoordAdmin ? "Carteiras por Professor" : "Minha Carteira"}
        <Badge variant="secondary" className="ml-auto">{total} total</Badge>
      </h3>
      <div className="space-y-2">
        {carteiras.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">Nenhum aluno com plano ativo</p>
        ) : carteiras.map((c) => (
          <div key={c.userId} className="flex items-center justify-between p-2.5 rounded-md bg-secondary/50">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm text-foreground">{c.name}</span>
            </div>
            <Badge variant="outline" className="text-xs font-bold">{c.count}</Badge>
          </div>
        ))}
      </div>
    </div>
  );
}
