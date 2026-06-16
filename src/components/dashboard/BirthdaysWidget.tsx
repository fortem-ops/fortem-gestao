import { Cake } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface Props {
  professorId: string | null;
}

interface Aniversariante {
  id: string;
  nome: string;
  dia: number;
  hoje: boolean;
}

export function BirthdaysWidget({ professorId: _professorId }: Props) {
  // Mostra TODOS os alunos aniversariantes do mês (independente da carteira do professor).
  const { data } = useQuery({
    queryKey: ["dashboard-aniversariantes-global"],
    queryFn: async (): Promise<Aniversariante[]> => {
      const { data, error } = await supabase
        .from("alunos")
        .select("id, nome, data_nascimento")
        .eq("status", "ativo")
        .not("data_nascimento", "is", null);
      if (error) throw error;
      const now = new Date();
      const mes = now.getMonth() + 1;
      const dia = now.getDate();
      return (data || [])
        .map((a) => {
          const d = new Date(a.data_nascimento + "T00:00:00");
          return {
            id: a.id,
            nome: a.nome,
            mes: d.getMonth() + 1,
            dia: d.getDate(),
          };
        })
        .filter((a) => a.mes === mes)
        .map((a) => ({ id: a.id, nome: a.nome, dia: a.dia, hoje: a.dia === dia }))
        .sort((a, b) => a.dia - b.dia);
    },
    staleTime: 60_000,
  });

  const todayList = (data || []).filter((a) => a.hoje);
  const monthList = (data || []).filter((a) => !a.hoje);

  return (
    <div className="glass-card rounded-lg p-5">
      <h3 className="font-heading font-semibold text-foreground mb-4 flex items-center gap-2">
        <Cake className="w-4 h-4 text-primary" />
        Aniversariantes
      </h3>
      {todayList.length > 0 && (
        <div className="mb-3">
          <p className="text-xs font-semibold text-primary mb-2">🎂 Hoje</p>
          {todayList.map((s) => (
            <p key={s.id} className="text-sm text-foreground">{s.nome}</p>
          ))}
        </div>
      )}
      <div>
        <p className="text-xs font-semibold text-muted-foreground mb-2">Este mês</p>
        {monthList.length > 0 ? monthList.map((s) => (
          <p key={s.id} className="text-sm text-foreground">
            {s.nome} <span className="text-muted-foreground">· {s.dia}/{new Date().getMonth() + 1}</span>
          </p>
        )) : (
          <p className="text-sm text-muted-foreground">Nenhum aniversariante</p>
        )}
      </div>
    </div>
  );
}
