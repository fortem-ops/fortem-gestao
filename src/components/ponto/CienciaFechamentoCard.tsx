import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { CheckCircle2, FileCheck2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { formatMinutes } from "@/lib/ponto";

interface FechamentoRow {
  id: string;
  status: string;
  total_minutos: number | null;
  minutos_extras: number | null;
  minutos_faltantes: number | null;
  pendencias_count: number | null;
  ciencia_colaborador_em: string | null;
}

function formatMesExtenso(mes: string): string {
  const d = new Date(mes + "-01T00:00");
  return d.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
}

interface Props {
  userId: string;
  mes: string; // YYYY-MM
}

export function CienciaFechamentoCard({ userId, mes }: Props) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const isSelf = user?.id === userId;

  const { data, isLoading } = useQuery({
    queryKey: ["ciencia-fechamento", userId, mes],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ponto_fechamentos_mensais")
        .select(
          "id, status, total_minutos, minutos_extras, minutos_faltantes, pendencias_count, ciencia_colaborador_em",
        )
        .eq("usuario_id", userId)
        .eq("mes", mes + "-01")
        .maybeSingle();
      if (error) throw error;
      return (data ?? null) as FechamentoRow | null;
    },
  });

  const registrar = useMutation({
    mutationFn: async (fechamentoId: string) => {
      const { error } = await supabase
        .from("ponto_fechamentos_mensais")
        .update({ ciencia_colaborador_em: new Date().toISOString() })
        .eq("id", fechamentoId)
        .eq("usuario_id", user!.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Ciência registrada com sucesso");
      qc.invalidateQueries({ queryKey: ["ciencia-fechamento", userId, mes] });
      qc.invalidateQueries({ queryKey: ["meu-relatorio-fechamentos"] });
      setConfirmOpen(false);
    },
    onError: (e: any) => {
      toast.error(e?.message ?? "Não foi possível registrar a ciência");
    },
  });

  if (isLoading) return <Skeleton className="h-32" />;

  // Não há fechamento gerado
  if (!data) {
    return (
      <Card className="p-4 bg-muted/30 border-dashed">
        <div className="flex items-start gap-3">
          <FileCheck2 className="w-5 h-5 text-muted-foreground mt-0.5" />
          <div>
            <p className="text-sm font-medium">Espelho de ponto — {formatMesExtenso(mes)}</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Fechamento ainda não gerado pela coordenação.
            </p>
          </div>
        </div>
      </Card>
    );
  }

  // Ciência já registrada
  if (data.ciencia_colaborador_em) {
    const quando = new Date(data.ciencia_colaborador_em).toLocaleString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
    return (
      <Card className="p-4 border-success/30 bg-success/5">
        <div className="flex items-start gap-3">
          <CheckCircle2 className="w-5 h-5 text-success mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-medium text-success-foreground">
              Ciência do espelho de ponto registrada
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {formatMesExtenso(mes)} · Confirmada em {quando}
            </p>
            <Badge
              variant="outline"
              className="mt-2 text-info border-info/30 bg-info/10 text-[10px]"
            >
              Portaria MTE 671/2021 · Art. 74 CLT
            </Badge>
          </div>
        </div>
      </Card>
    );
  }

  // Pendente de ciência
  return (
    <>
      <Card className="p-4 border-warning/40 bg-warning/5">
        <div className="flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-warning mt-0.5" />
          <div className="flex-1 space-y-3">
            <div>
              <p className="text-sm font-semibold">
                Espelho de ponto disponível para conferência
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Referente a {formatMesExtenso(mes)}
              </p>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
              <div className="rounded-md border bg-background/60 p-2">
                <p className="text-muted-foreground">Trabalhado</p>
                <p className="font-semibold">{formatMinutes(data.total_minutos ?? 0)}</p>
              </div>
              <div className="rounded-md border bg-background/60 p-2">
                <p className="text-muted-foreground">Extras</p>
                <p className="font-semibold text-success">
                  {formatMinutes(data.minutos_extras ?? 0)}
                </p>
              </div>
              <div className="rounded-md border bg-background/60 p-2">
                <p className="text-muted-foreground">Déficit</p>
                <p className="font-semibold text-destructive">
                  {formatMinutes(data.minutos_faltantes ?? 0)}
                </p>
              </div>
              <div className="rounded-md border bg-background/60 p-2">
                <p className="text-muted-foreground">Pendências</p>
                <p className="font-semibold">{data.pendencias_count ?? 0}</p>
              </div>
            </div>

            <p className="text-xs text-muted-foreground">
              Revise seu espelho de ponto antes de confirmar. Após confirmar ciência, este
              registro ficará arquivado conforme exigido pela Portaria MTE 671/2021.
            </p>

            {isSelf ? (
              <Button
                size="sm"
                onClick={() => setConfirmOpen(true)}
                disabled={registrar.isPending}
              >
                Confirmar ciência
              </Button>
            ) : (
              <p className="text-xs italic text-muted-foreground">
                Somente o próprio colaborador pode registrar a ciência.
              </p>
            )}
          </div>
        </div>
      </Card>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar ciência do espelho de ponto</AlertDialogTitle>
            <AlertDialogDescription>
              Ao confirmar, você declara ter conferido seu espelho de ponto referente a{" "}
              <strong>{formatMesExtenso(mes)}</strong>. Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={registrar.isPending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                registrar.mutate(data.id);
              }}
              disabled={registrar.isPending}
            >
              {registrar.isPending ? "Registrando..." : "Confirmar ciência"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
