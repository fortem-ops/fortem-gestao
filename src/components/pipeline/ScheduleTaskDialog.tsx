import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { CalendarIcon, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const QUICK_TITLES = ["Ligar", "WhatsApp", "Confirmar avaliação", "Encerrar atendimento", "Follow-up", "Enviar proposta"];

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  alunoId: string;
  alunoNome: string;
  responsavelId: string | null;
}

export function ScheduleTaskDialog({ open, onOpenChange, alunoId, alunoNome, responsavelId }: Props) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [titulo, setTitulo] = useState("");
  const [descricao, setDescricao] = useState("");
  const [data, setData] = useState<Date | undefined>(new Date());
  const [prioridade, setPrioridade] = useState<"alta" | "media" | "baixa">("media");
  const [saving, setSaving] = useState(false);

  const { data: existing } = useQuery({
    queryKey: ["pipeline-pending-task", alunoId, open],
    enabled: open,
    queryFn: async () => {
      const { data } = await supabase
        .from("tarefas")
        .select("id,titulo,data_limite,prioridade,descricao")
        .eq("aluno_id", alunoId)
        .eq("status", "pendente")
        .order("data_limite", { ascending: true, nullsFirst: false })
        .limit(1)
        .maybeSingle();
      return data;
    },
  });

  useEffect(() => {
    if (!open) return;
    if (existing) {
      setTitulo(existing.titulo);
      setDescricao(existing.descricao || "");
      setData(existing.data_limite ? new Date(existing.data_limite + "T00:00:00") : new Date());
      setPrioridade((existing.prioridade as any) || "media");
    } else {
      setTitulo("");
      setDescricao("");
      setData(new Date());
      setPrioridade("media");
    }
  }, [existing, open]);

  function invalidate() {
    qc.invalidateQueries({ queryKey: ["pipeline-next-tasks"] });
    qc.invalidateQueries({ queryKey: ["pipeline-pending-task", alunoId] });
    qc.invalidateQueries({ queryKey: ["tarefas"] });
  }

  async function save(asNew: boolean) {
    if (!user) return;
    if (!titulo.trim()) { toast.error("Informe um título"); return; }
    setSaving(true);
    try {
      const data_limite = data ? format(data, "yyyy-MM-dd") : null;
      if (existing && !asNew) {
        const { error } = await supabase.from("tarefas").update({
          titulo: titulo.trim(),
          descricao: descricao.trim() || null,
          data_limite,
          prioridade,
        }).eq("id", existing.id);
        if (error) throw error;
        toast.success("Tarefa reagendada");
      } else {
        const { error } = await supabase.from("tarefas").insert({
          titulo: titulo.trim(),
          descricao: descricao.trim() || null,
          aluno_id: alunoId,
          responsavel_id: responsavelId || user.id,
          criado_por_id: user.id,
          data_limite,
          prioridade,
          status: "pendente",
        });
        if (error) throw error;
        toast.success("Tarefa agendada");
      }
      invalidate();
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e.message || "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  }

  async function complete() {
    if (!existing) return;
    setSaving(true);
    try {
      const { error } = await supabase.from("tarefas").update({ status: "concluida" }).eq("id", existing.id);
      if (error) throw error;
      toast.success("Tarefa concluída");
      invalidate();
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e.message || "Erro");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{existing ? "Tarefa pendente" : "Agendar tarefa"} · {alunoNome}</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div>
            <Label className="text-xs">Título</Label>
            <Input value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="O que fazer?" />
            <div className="flex flex-wrap gap-1.5 mt-2">
              {QUICK_TITLES.map((t) => (
                <Badge
                  key={t}
                  variant="outline"
                  className="cursor-pointer hover:bg-primary/10 text-[10px]"
                  onClick={() => setTitulo(t)}
                >
                  {t}
                </Badge>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs">Data</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("w-full justify-start font-normal", !data && "text-muted-foreground")}>
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {data ? format(data, "dd/MM/yyyy") : "Selecionar"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={data} onSelect={setData} initialFocus className={cn("p-3 pointer-events-auto")} />
                </PopoverContent>
              </Popover>
            </div>
            <div>
              <Label className="text-xs">Prioridade</Label>
              <Select value={prioridade} onValueChange={(v: any) => setPrioridade(v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="alta">Alta</SelectItem>
                  <SelectItem value="media">Média</SelectItem>
                  <SelectItem value="baixa">Baixa</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label className="text-xs">Descrição (opcional)</Label>
            <Textarea value={descricao} onChange={(e) => setDescricao(e.target.value)} rows={2} />
          </div>
        </div>

        <DialogFooter className="gap-2 flex-wrap">
          {existing && (
            <Button variant="outline" onClick={complete} disabled={saving} className="gap-2">
              <CheckCircle2 className="w-4 h-4" /> Concluir
            </Button>
          )}
          {existing && (
            <Button variant="outline" onClick={() => save(true)} disabled={saving}>Criar nova</Button>
          )}
          <Button onClick={() => save(false)} disabled={saving}>
            {existing ? "Reagendar" : "Agendar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
