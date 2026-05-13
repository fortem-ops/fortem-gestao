import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { Tables } from "@/integrations/supabase/types";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { NotificacaoDetail } from "@/components/notificar/NotificacaoDetail";
import { Plus, MessageSquare, Stethoscope, Phone, BookOpen, Loader2, MessagesSquare } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";

const CATEGORIES = [
  { value: "observacao", label: "Observação", icon: MessageSquare, color: "text-info" },
  { value: "orientacao", label: "Orientação", icon: BookOpen, color: "text-primary" },
  { value: "intervencao", label: "Intervenção", icon: Stethoscope, color: "text-warning" },
  { value: "contato", label: "Contato", icon: Phone, color: "text-muted-foreground" },
];

const catMap = Object.fromEntries(CATEGORIES.map(c => [c.value, c]));

export function StudentNotes({ student }: { student: Tables<"alunos"> }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [categoria, setCategoria] = useState("observacao");
  const [descricao, setDescricao] = useState("");
  const [detailId, setDetailId] = useState<string | null>(null);

  const { data: profiles } = useQuery({
    queryKey: ["profiles-map"],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("user_id, full_name");
      return (data || []).reduce((m, p) => { m[p.user_id] = p.full_name; return m; }, {} as Record<string, string>);
    },
    staleTime: 60_000,
  });

  const { data: notes, isLoading } = useQuery({
    queryKey: ["historico_profissional", student.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("historico_profissional")
        .select("*")
        .eq("aluno_id", student.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const mutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("historico_profissional").insert({
        aluno_id: student.id,
        autor_id: user!.id,
        categoria,
        descricao,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Observação registrada");
      setDescricao("");
      setOpen(false);
      qc.invalidateQueries({ queryKey: ["historico_profissional", student.id] });
      qc.invalidateQueries({ queryKey: ["historico-timeline", student.id] });
    },
    onError: () => toast.error("Erro ao registrar observação"),
  });

  return (
    <div className="space-y-4 mt-4">
      <div className="flex items-center justify-between">
        <h3 className="font-heading font-semibold text-foreground">Observações</h3>
        <Button size="sm" onClick={() => setOpen(!open)}>
          <Plus className="w-3 h-3 mr-1" /> Nova Observação
        </Button>
      </div>

      {open && (
        <div className="glass-card rounded-lg p-4 space-y-3">
          <Select value={categoria} onValueChange={setCategoria}>
            <SelectTrigger className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CATEGORIES.map(c => (
                <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Textarea
            placeholder="Descreva a observação..."
            value={descricao}
            onChange={e => setDescricao(e.target.value)}
            rows={3}
          />
          <div className="flex gap-2">
            <Button size="sm" disabled={!descricao.trim() || mutation.isPending} onClick={() => mutation.mutate()}>
              {mutation.isPending ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : null}
              Salvar
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
      ) : !notes?.length ? (
        <p className="text-sm text-muted-foreground text-center py-8">Nenhuma observação registrada</p>
      ) : (
        <div className="relative">
          <div className="absolute left-4 top-0 bottom-0 w-px bg-border" />
          <div className="space-y-3">
            {notes.map(n => {
              const cat = catMap[n.categoria] || catMap["observação"];
              const Icon = cat.icon;
              return (
                <div key={n.id} className="relative pl-10">
                  <div className="absolute left-2.5 top-1.5 w-3 h-3 rounded-full border-2 border-background bg-muted" />
                  <div className="glass-card rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-1">
                      <Icon className={`w-3.5 h-3.5 ${cat.color}`} />
                      <span className="text-xs font-medium text-foreground capitalize">{n.categoria}</span>
                      <span className="text-xs text-muted-foreground">
                        · {format(new Date(n.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })} · {profiles?.[n.autor_id] || "—"}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground">{n.descricao}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
