import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useStudentPortal } from "@/contexts/StudentPortalContext";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Apple, Dumbbell, HeartPulse, Activity, CreditCard, Star, Trash2 } from "lucide-react";
import { toast } from "sonner";

const TIPOS = [
  { key: "Avaliação Funcional", label: "Avaliação Funcional", icon: Activity },
  { key: "Avaliação Física", label: "Avaliação Física", icon: Dumbbell },
  { key: "Consulta Nutrição", label: "Nutrição", icon: Apple },
  { key: "Consulta Reabilitação", label: "Fisioterapia", icon: HeartPulse },
];

const statusBadge: Record<string, string> = {
  ativo: "border-success/40 text-success bg-success/10",
  licenca: "border-warning/40 text-warning bg-warning/10",
  encerrado: "border-destructive/40 text-destructive bg-destructive/10",
};
const statusLabel: Record<string, string> = { ativo: "Ativo", licenca: "Licença", encerrado: "Encerrado" };

export default function PortalProfile() {
  const { student } = useStudentPortal();

  const { data: planoAtivo } = useQuery({
    queryKey: ["portal-plano", student?.id],
    enabled: !!student,
    queryFn: async () => {
      const { data } = await supabase
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

  const { data: creditos = [] } = useQuery({
    queryKey: ["portal-creditos", student?.id],
    enabled: !!student,
    queryFn: async () => {
      const { data } = await supabase
        .from("consumo_servicos")
        .select("tipo_servico, quantidade, agenda_id, tipo_registro")
        .eq("aluno_id", student!.id);
      const totais: Record<string, { contratado: number; usado: number }> = {};
      TIPOS.forEach((t) => (totais[t.key] = { contratado: 0, usado: 0 }));
      (data || []).forEach((c: any) => {
        const slot = totais[c.tipo_servico];
        if (!slot) return;
        if (c.tipo_registro === "compra") slot.contratado += c.quantidade ?? 1;
        if (!!c.agenda_id || c.tipo_registro === "uso_manual") slot.usado += c.quantidade ?? 1;
      });
      return TIPOS.map((t) => ({ ...t, ...totais[t.key] }));
    },
  });

  if (!student) return null;

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Cartão do perfil */}
      <Card className="glass-card p-5">
        <div className="flex items-center gap-4">
          <Avatar className="w-16 h-16">
            {student.foto_url && <AvatarImage src={student.foto_url} alt={student.nome} />}
            <AvatarFallback className="bg-primary/20 text-primary font-bold text-lg">
              {student.nome.charAt(0)}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <h1 className="font-heading font-bold text-lg leading-tight">{student.nome}</h1>
            <p className="text-xs text-muted-foreground truncate">{student.email}</p>
            <div className="mt-2 flex items-center gap-2 flex-wrap">
              <Badge variant="outline" className={statusBadge[student.status] || ""}>
                {statusLabel[student.status] || student.status}
              </Badge>
              {planoAtivo && (
                <Badge variant="outline" className="border-primary/40 text-primary bg-primary/10">
                  Plano {planoAtivo.tipo}
                </Badge>
              )}
            </div>
          </div>
        </div>
      </Card>

      {/* Créditos */}
      <section className="space-y-2">
        <h2 className="text-sm font-heading font-semibold text-muted-foreground uppercase tracking-wide">
          Créditos disponíveis
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {creditos.map((c) => {
            const saldo = Math.max(0, c.contratado - c.usado);
            const pct = c.contratado > 0 ? Math.min(100, (c.usado / c.contratado) * 100) : 0;
            return (
              <Card key={c.key} className="glass-card p-4">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
                    <c.icon className="w-4 h-4 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold">{c.label}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {c.usado} usado{c.usado === 1 ? "" : "s"} de {c.contratado}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold text-primary leading-none">{saldo}</p>
                    <p className="text-[10px] text-muted-foreground uppercase">saldo</p>
                  </div>
                </div>
                <Progress value={pct} className="h-1.5" />
              </Card>
            );
          })}
        </div>
        <p className="text-[11px] text-muted-foreground">
          Os créditos são atualizados automaticamente conforme você consome cada serviço.
        </p>
      </section>
    </div>
  );
}
