import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import type { Tables } from "@/integrations/supabase/types";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Plus, ClipboardCheck, Eye, Activity, Pencil, Trash2 } from "lucide-react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { AssessmentViewerDialog } from "./assessment/AssessmentViewerDialog";
import { fetchLastFuncionalDate, severityForLastFuncional } from "@/lib/avaliacaoFuncional";
import { useAuth } from "@/contexts/AuthContext";
import { userHasStaffAccess } from "@/lib/authAccess";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useSupabaseMutation } from "@/hooks/useSupabaseMutation";
import { invalidateAvaliacaoFuncional } from "@/lib/query-invalidation";
import { cn } from "@/lib/utils";

export function StudentAssessments({ student }: { student: Tables<"alunos"> }) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { user } = useAuth();
  const [selected, setSelected] = useState<Tables<"avaliacoes"> | null>(null);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editDate, setEditDate] = useState<Date | undefined>(undefined);

  const { data: canEdit } = useQuery({
    queryKey: ["staff-access", user?.id],
    queryFn: () => userHasStaffAccess(user!.id),
    enabled: !!user,
  });

  const { data: canDelete } = useQuery({
    queryKey: ["is-coord-or-admin", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase.rpc("is_coordinator_or_admin", { _user_id: user!.id });
      return !!data;
    },
  });

  const deleteMutation = useSupabaseMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("avaliacoes").delete().eq("id", id);
      if (error) throw error;
    },
    successMessage: "Avaliação excluída.",
    onSuccess: () => invalidateAvaliacaoFuncional(qc, student.id),
  });

  const { data: lastFuncional } = useQuery({
    queryKey: ["last_funcional_aluno", student.id],
    queryFn: () => fetchLastFuncionalDate(student.id),
  });

  const { data: avaliacoes } = useQuery({
    queryKey: ["avaliacoes-aluno", student.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("avaliacoes")
        .select("*")
        .eq("aluno_id", student.id)
        .order("data", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const openViewer = (a: Tables<"avaliacoes">) => {
    setSelected(a);
    setViewerOpen(true);
  };

  const saveHistoricoMutation = useSupabaseMutation({
    mutationFn: async (date: Date) => {
      const iso = format(date, "yyyy-MM-dd");
      const { error } = await supabase.from("avaliacoes").insert({
        aluno_id: student.id,
        avaliador_id: user!.id,
        tipo: "funcional",
        data: iso,
        observacoes: "Data registrada manualmente (avaliação realizada anteriormente fora do sistema)",
        dados: {},
        origem: "historico_manual",
      } as any);
      if (error) throw error;
    },
    successMessage: "Data da última avaliação registrada.",
    invalidates: [
      ["last_funcional_aluno", student.id],
      ["avaliacoes-aluno", student.id],
      ["alunos_with_last_funcional"],
    ],
    onSuccess: () => {
      setEditOpen(false);
      setEditDate(undefined);
    },
  });

  const sev = severityForLastFuncional(lastFuncional ?? null);

  return (
    <div className="space-y-4 mt-4">
      <div className="glass-card rounded-lg p-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
            <Activity className="w-5 h-5 text-primary" />
          </div>
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground">Última Avaliação Funcional</p>
            <p className="text-base font-semibold text-foreground">
              {lastFuncional
                ? format(lastFuncional, "dd 'de' MMMM 'de' yyyy", { locale: ptBR })
                : "Nunca realizada"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Badge variant="outline" className={`${sev.className} text-xs`}>{sev.label}</Badge>
          {canEdit && (
            <Button
              variant="ghost"
              size="icon"
              title="Editar data da última avaliação"
              onClick={() => {
                setEditDate(lastFuncional ?? undefined);
                setEditOpen(true);
              }}
            >
              <Pencil className="w-4 h-4" />
            </Button>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between">
        <h3 className="font-heading font-semibold text-foreground">Histórico de Avaliações</h3>
        <Button onClick={() => navigate(`/avaliacoes?aluno=${student.id}&new=1`)} size="sm">
          <Plus className="w-4 h-4 mr-1" /> Realizar Avaliação
        </Button>
      </div>


      {(!avaliacoes || avaliacoes.length === 0) ? (
        <div className="glass-card rounded-lg p-8 text-center text-sm text-muted-foreground">
          Nenhuma avaliação realizada para este aluno.
        </div>
      ) : (
        <div className="space-y-2">
          {avaliacoes.map((a) => (
            <div
              key={a.id}
              role="button"
              tabIndex={0}
              onClick={() => openViewer(a)}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openViewer(a); } }}
              className="glass-card rounded-lg p-4 flex items-start gap-3 w-full text-left hover:bg-secondary/30 transition-colors group cursor-pointer"
            >
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                <ClipboardCheck className="w-5 h-5 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm font-semibold text-foreground capitalize">{a.tipo.replace(/_/g, ' ')}</p>
                  {(a as any).origem === "historico_manual" && (
                    <Badge variant="outline" className="status-info text-[10px]">Registro histórico</Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {format(new Date(a.data), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                </p>
                {a.observacoes && (
                  <p className="text-xs text-muted-foreground mt-2 line-clamp-2">{a.observacoes}</p>
                )}
              </div>
              <div className="flex items-center gap-1 self-center" onClick={(e) => e.stopPropagation()}>
                <Eye className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                {canDelete && (
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" title="Excluir avaliação">
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Excluir avaliação</AlertDialogTitle>
                        <AlertDialogDescription>
                          Tem certeza que deseja excluir esta avaliação de {format(new Date(a.data), "dd/MM/yyyy")}? Esta ação é irreversível.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => deleteMutation.mutate(a.id)}
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                          Excluir
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <AssessmentViewerDialog
        open={viewerOpen}
        onOpenChange={setViewerOpen}
        avaliacao={selected}
        student={student}
      />

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar data da última avaliação funcional</DialogTitle>
            <DialogDescription>
              Use para registrar uma avaliação funcional realizada anteriormente fora do sistema.
              A data informada passa a contar para alertas e para o agendamento automático de reavaliação.
            </DialogDescription>
          </DialogHeader>
          <div className="py-2">
            <Input
              type="date"
              value={editDate ? format(editDate, "yyyy-MM-dd") : ""}
              onChange={(e) => {
                const v = e.target.value;
                setEditDate(v ? new Date(v + "T00:00:00") : undefined);
              }}
              max={format(new Date(), "yyyy-MM-dd")}
              className={cn("w-full")}
            />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditOpen(false)}>Cancelar</Button>
            <Button
              onClick={() => editDate && saveHistoricoMutation.mutate(editDate)}
              disabled={!editDate || saveHistoricoMutation.isPending}
            >
              {saveHistoricoMutation.isPending ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
