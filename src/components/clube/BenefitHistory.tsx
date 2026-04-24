import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, XCircle, Clock, Ban } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

interface BenefitHistoryProps {
  alunoId: string;
}

const STATUS_ICON = {
  valido: { icon: CheckCircle2, color: "text-emerald-500", label: "Validado" },
  recusado: { icon: XCircle, color: "text-rose-500", label: "Recusado" },
  expirado: { icon: Clock, color: "text-amber-500", label: "Expirado" },
  bloqueado: { icon: Ban, color: "text-zinc-500", label: "Bloqueado" },
};

export function BenefitHistory({ alunoId }: BenefitHistoryProps) {
  const { data, isLoading } = useQuery({
    queryKey: ["clube-uso-historico", alunoId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("uso_beneficios")
        .select("id, data_uso, hora_uso, status_validacao, motivo_recusa, beneficio_id, parceiro_id")
        .eq("aluno_id", alunoId)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;

      const benIds = Array.from(new Set((data || []).map((u) => u.beneficio_id)));
      const parIds = Array.from(new Set((data || []).map((u) => u.parceiro_id)));
      const [benefs, parcs] = await Promise.all([
        benIds.length ? supabase.from("beneficios").select("id, titulo").in("id", benIds) : { data: [] as any[] },
        parIds.length ? supabase.from("parceiros").select("id, nome").in("id", parIds) : { data: [] as any[] },
      ]);

      const bMap = new Map((benefs.data || []).map((b: any) => [b.id, b.titulo]));
      const pMap = new Map((parcs.data || []).map((p: any) => [p.id, p.nome]));

      return (data || []).map((u) => ({
        ...u,
        beneficio_titulo: bMap.get(u.beneficio_id) || "—",
        parceiro_nome: pMap.get(u.parceiro_id) || "—",
      }));
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-2">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-16" />
        ))}
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <Card className="p-10 text-center text-muted-foreground text-sm">
        Nenhum uso de benefício registrado ainda.
      </Card>
    );
  }

  return (
    <div className="space-y-2">
      {data.map((u) => {
        const meta = STATUS_ICON[u.status_validacao as keyof typeof STATUS_ICON];
        const Icon = meta.icon;
        return (
          <Card key={u.id} className="p-3 flex items-center gap-3">
            <Icon className={`w-5 h-5 shrink-0 ${meta.color}`} />
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <p className="font-medium text-sm truncate">{u.beneficio_titulo}</p>
                <Badge variant="outline" className="text-[10px]">{meta.label}</Badge>
              </div>
              <p className="text-xs text-muted-foreground truncate">
                {u.parceiro_nome} · {new Date(u.data_uso).toLocaleDateString("pt-BR")} {u.hora_uso?.slice(0, 5)}
              </p>
              {u.motivo_recusa && <p className="text-xs text-rose-400 mt-1">{u.motivo_recusa}</p>}
            </div>
          </Card>
        );
      })}
    </div>
  );
}
