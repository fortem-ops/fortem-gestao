import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { StudentPicker } from "@/components/student/StudentPicker";
import { useNotifChat } from "@/contexts/NotifChatContext";
import { RecipientPicker } from "./RecipientPicker";
import {
  NOTIF_CATEGORIAS,
  NOTIF_PRIORIDADES,
  NOTIF_TIPOS,
  createNotificacao,
  type NotifCategoria,
  type NotifPrioridade,
  type NotifTipo,
  type RecipientGroup,
} from "@/lib/notificar";

export function NewNotificacaoDialog() {
  const [open, setOpen] = useState(false);
  const [titulo, setTitulo] = useState("");
  const [descricao, setDescricao] = useState("");
  const [categoria, setCategoria] = useState<NotifCategoria>("pauta_tecnica");
  const [prioridade, setPrioridade] = useState<NotifPrioridade>("media");
  const [tipo, setTipo] = useState<NotifTipo>("simples");
  const [prazo, setPrazo] = useState("");
  const [alunoId, setAlunoId] = useState("");
  const [reuniaoData, setReuniaoData] = useState("");
  const [reuniaoLocal, setReuniaoLocal] = useState("");
  const [destinatarios, setDestinatarios] = useState<RecipientGroup[]>([]);

  const qc = useQueryClient();
  const { openChat } = useNotifChat();
  const mutation = useMutation({
    mutationFn: async () => {
      if (!titulo.trim()) throw new Error("Informe um título");
      if (!descricao.trim()) throw new Error("Informe a descrição");
      if (destinatarios.length === 0) throw new Error("Selecione ao menos um destinatário");
      const notifId = await createNotificacao({
        titulo: titulo.trim(),
        descricao: descricao.trim(),
        categoria,
        prioridade,
        tipo,
        prazo: prazo || null,
        aluno_id: alunoId || null,
        reuniao_data: tipo === "reuniao" && reuniaoData ? reuniaoData : null,
        reuniao_local: tipo === "reuniao" ? reuniaoLocal || null : null,
        destinatarios,
      });

      // Se houver aluno vinculado, registra observação no histórico do aluno
      if (alunoId) {
        const { data: u } = await supabase.auth.getUser();
        const uid = u.user?.id;
        if (uid) {
          const desc = `📩 Notificação: ${titulo.trim()}\n${descricao.trim()}`;
          await supabase.from("historico_profissional").insert({
            aluno_id: alunoId,
            autor_id: uid,
            categoria: "observacao",
            descricao: desc,
            notificacao_id: notifId,
          } as any);
        }
      }

      return notifId;
    },
    onSuccess: (notifId) => {
      toast.success("Notificação enviada");
      qc.invalidateQueries({ queryKey: ["notif"] });
      setOpen(false);
      setTitulo(""); setDescricao(""); setPrazo(""); setAlunoId("");
      setReuniaoData(""); setReuniaoLocal(""); setDestinatarios([]);
      if (notifId) openChat(notifId);
    },
    onError: (e: any) => toast.error(e.message ?? "Erro ao enviar"),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button><Plus className="w-4 h-4 mr-2" />Nova Notificação</Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nova Notificação</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Título *</Label>
            <Input value={titulo} onChange={(e) => setTitulo(e.target.value)} maxLength={150} />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label>Tipo</Label>
              <Select value={tipo} onValueChange={(v) => setTipo(v as NotifTipo)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{NOTIF_TIPOS.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Categoria</Label>
              <Select value={categoria} onValueChange={(v) => setCategoria(v as NotifCategoria)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{NOTIF_CATEGORIAS.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Prioridade</Label>
              <Select value={prioridade} onValueChange={(v) => setPrioridade(v as NotifPrioridade)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{NOTIF_PRIORIDADES.map((p) => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label>Descrição *</Label>
            <Textarea value={descricao} onChange={(e) => setDescricao(e.target.value)} rows={4} maxLength={2000} />
          </div>
          {tipo === "reuniao" && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Data/Hora da reunião</Label>
                <Input type="datetime-local" value={reuniaoData} onChange={(e) => setReuniaoData(e.target.value)} />
              </div>
              <div>
                <Label>Local</Label>
                <Input value={reuniaoLocal} onChange={(e) => setReuniaoLocal(e.target.value)} />
              </div>
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Prazo (opcional)</Label>
              <Input type="datetime-local" value={prazo} onChange={(e) => setPrazo(e.target.value)} />
            </div>
            <div>
              <StudentPicker value={alunoId} onChange={setAlunoId} label="Aluno vinculado (opcional)" />
            </div>
          </div>
          <RecipientPicker value={destinatarios} onChange={setDestinatarios} />
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
          <Button onClick={() => mutation.mutate()} disabled={mutation.isPending}>
            {mutation.isPending ? "Enviando..." : "Enviar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
