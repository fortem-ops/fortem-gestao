import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Cake } from "lucide-react";

export function BirthdaysWidget() {
  const { data } = useQuery({
    queryKey: ["dashboard-birthdays"],
    queryFn: async () => {
      const { data: alunos } = await supabase
        .from("alunos")
        .select("id, nome, data_nascimento")
        .eq("status", "ativo")
        .not("data_nascimento", "is", null);

      const today = new Date();
      const todayMonth = today.getMonth();
      const todayDay = today.getDate();

      const todayList: { id: string; nome: string; dia: number }[] = [];
      const monthList: { id: string; nome: string; dia: number }[] = [];

      (alunos || []).forEach((a) => {
        if (!a.data_nascimento) return;
        const bd = new Date(a.data_nascimento + "T00:00:00");
        const m = bd.getMonth();
        const d = bd.getDate();
        if (m === todayMonth) {
          if (d === todayDay) {
            todayList.push({ id: a.id, nome: a.nome, dia: d });
          } else {
            monthList.push({ id: a.id, nome: a.nome, dia: d });
          }
        }
      });

      monthList.sort((a, b) => a.dia - b.dia);
      return { today: todayList, month: monthList };
    },
  });

  const todayList = data?.today || [];
  const monthList = data?.month || [];

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
