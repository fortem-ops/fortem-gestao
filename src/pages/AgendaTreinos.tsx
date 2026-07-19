import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarIcon, Plus, Pencil, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useSupabaseMutation } from "@/hooks/useSupabaseMutation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";

const DIAS = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];

type Slot = {
  id: string;
  dia_semana: number;
  horario_inicio: string;
  horario_fim: string;
  capacidade_maxima: number;
  instrutor_id: string | null;
  ativo: boolean;
  observacoes: string | null;
};

type Profile = { user_id: string; full_name: string };

function SlotDialog({
  open,
  onOpenChange,
  slot,
  profiles,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  slot: Slot | null;
  profiles: Profile[];
  onSaved: () => void;
}) {
  const [form, setForm] = useState({
    dia_semana: slot?.dia_semana ?? 1,
    horario_inicio: slot?.horario_inicio?.slice(0, 5) ?? "07:00",
    horario_fim: slot?.horario_fim?.slice(0, 5) ?? "08:00",
    capacidade_maxima: slot?.capacidade_maxima ?? 8,
    instrutor_id: slot?.instrutor_id ?? "",
    observacoes: slot?.observacoes ?? "",
  });

  const save = useSupabaseMutation({
    mutationFn: async () => {
      const payload = {
        dia_semana: form.dia_semana,
        horario_inicio: form.horario_inicio,
        horario_fim: form.horario_fim,
        capacidade_maxima: form.capacidade_maxima,
        instrutor_id: form.instrutor_id || null,
        observacoes: form.observacoes || null,
      };
      if (slot) {
        const { error } = await supabase.from("treino_slots").update(payload).eq("id", slot.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("treino_slots").insert(payload);
        if (error) throw error;
      }
    },
    successMessage: slot ? "Horário atualizado" : "Horário criado",
    onSuccess: () => {
      onSaved();
      onOpenChange(false);
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{slot ? "Editar horário" : "Novo horário"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Dia da semana</Label>
            <Select value={String(form.dia_semana)} onValueChange={(v) => setForm({ ...form, dia_semana: Number(v) })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {DIAS.map((d, i) => <SelectItem key={i} value={String(i)}>{d}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Início</Label>
              <Input type="time" value={form.horario_inicio} onChange={(e) => setForm({ ...form, horario_inicio: e.target.value })} />
            </div>
            <div>
              <Label>Fim</Label>
              <Input type="time" value={form.horario_fim} onChange={(e) => setForm({ ...form, horario_fim: e.target.value })} />
            </div>
          </div>
          <div>
            <Label>Capacidade máxima</Label>
            <Input type="number" min={1} value={form.capacidade_maxima}
              onChange={(e) => setForm({ ...form, capacidade_maxima: Number(e.target.value) })} />
          </div>
          <div>
            <Label>Instrutor</Label>
            <Select value={form.instrutor_id || "none"} onValueChange={(v) => setForm({ ...form, instrutor_id: v === "none" ? "" : v })}>
              <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Sem instrutor definido</SelectItem>
                {profiles.map((p) => <SelectItem key={p.user_id} value={p.user_id}>{p.full_name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Observações</Label>
            <Textarea value={form.observacoes} onChange={(e) => setForm({ ...form, observacoes: e.target.value })} rows={2} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={() => save.mutate(undefined)} disabled={save.isPending}>Salvar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function HorariosTab() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Slot | null>(null);

  const { data: slots = [], refetch } = useQuery({
    queryKey: ["treino-slots-admin"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("treino_slots")
        .select("*")
        .order("dia_semana")
        .order("horario_inicio");
      if (error) throw error;
      return data as Slot[];
    },
  });

  const { data: profiles = [] } = useQuery({
    queryKey: ["treino-slots-profiles"],
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("user_id, full_name").order("full_name");
      if (error) throw error;
      return data as Profile[];
    },
  });

  const profileMap = useMemo(() => Object.fromEntries(profiles.map((p) => [p.user_id, p.full_name])), [profiles]);

  const toggleAtivo = useSupabaseMutation({
    mutationFn: async ({ id, ativo }: { id: string; ativo: boolean }) => {
      const { error } = await supabase.from("treino_slots").update({ ativo }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => refetch(),
  });

  const grouped = useMemo(() => {
    const g: Record<number, Slot[]> = {};
    for (const s of slots) {
      (g[s.dia_semana] ??= []).push(s);
    }
    return g;
  }, [slots]);

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => { setEditing(null); setDialogOpen(true); }}>
          <Plus className="w-4 h-4 mr-2" /> Novo Horário
        </Button>
      </div>

      {DIAS.map((diaNome, diaIdx) => {
        const list = grouped[diaIdx] || [];
        if (!list.length) return null;
        return (
          <Card key={diaIdx} className="p-4">
            <h3 className="font-semibold mb-3">{diaNome}</h3>
            <div className="space-y-2">
              {list.map((s) => (
                <div key={s.id} className={cn("flex items-center gap-3 p-3 rounded-lg border", !s.ativo && "opacity-60")}>
                  <div className="flex-1">
                    <div className="font-medium">
                      {s.horario_inicio.slice(0, 5)} → {s.horario_fim.slice(0, 5)}
                    </div>
                    <div className="text-xs text-muted-foreground flex items-center gap-3">
                      <span><Users className="w-3 h-3 inline mr-1" />{s.capacidade_maxima} vagas</span>
                      {s.instrutor_id && <span>Instrutor: {profileMap[s.instrutor_id] ?? "—"}</span>}
                    </div>
                    {s.observacoes && <div className="text-xs text-muted-foreground mt-1">{s.observacoes}</div>}
                  </div>
                  <Switch checked={s.ativo} onCheckedChange={(v) => toggleAtivo.mutate({ id: s.id, ativo: v })} />
                  <Button variant="ghost" size="icon" onClick={() => { setEditing(s); setDialogOpen(true); }}>
                    <Pencil className="w-4 h-4" />
                  </Button>
                </div>
              ))}
            </div>
          </Card>
        );
      })}

      {slots.length === 0 && (
        <Card className="p-10 text-center text-muted-foreground">
          Nenhum horário cadastrado. Clique em "Novo Horário" para começar.
        </Card>
      )}

      {dialogOpen && (
        <SlotDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          slot={editing}
          profiles={profiles}
          onSaved={refetch}
        />
      )}
    </div>
  );
}

const STATUS_STYLES: Record<string, string> = {
  agendado: "bg-blue-500/15 text-blue-500 border-blue-500/30",
  confirmado: "bg-emerald-500/15 text-emerald-500 border-emerald-500/30",
  cancelado: "bg-muted text-muted-foreground border-border",
  faltou: "bg-red-500/15 text-red-500 border-red-500/30",
  realizado: "bg-emerald-700/20 text-emerald-600 border-emerald-700/30",
};

function AgendamentosTab() {
  const [data, setData] = useState<Date>(new Date());

  const dataStr = format(data, "yyyy-MM-dd");
  const diaSemana = data.getDay();

  const { data: slots = [] } = useQuery({
    queryKey: ["treino-slots-dia", diaSemana],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("treino_slots")
        .select("*")
        .eq("dia_semana", diaSemana)
        .eq("ativo", true)
        .order("horario_inicio");
      if (error) throw error;
      return data as Slot[];
    },
  });

  const { data: agendamentos = [], refetch } = useQuery({
    queryKey: ["treino-agendamentos-dia", dataStr],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("treino_agendamentos")
        .select("id, slot_id, status, horario_inicio, aluno_id, alunos:aluno_id(id, nome)")
        .eq("data", dataStr)
        .order("horario_inicio");
      if (error) throw error;
      return data as any[];
    },
  });

  const updateStatus = useSupabaseMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const patch: any = { status };
      if (status === "cancelado") {
        patch.cancelado_em = new Date().toISOString();
        patch.cancelado_por = "staff";
      }
      const { error } = await supabase.from("treino_agendamentos").update(patch).eq("id", id);
      if (error) throw error;
    },
    successMessage: "Status atualizado",
    onSuccess: () => refetch(),
  });

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline">
              <CalendarIcon className="w-4 h-4 mr-2" />
              {format(data, "PPP", { locale: ptBR })}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="end">
            <Calendar mode="single" selected={data} onSelect={(d) => d && setData(d)} className="p-3 pointer-events-auto" />
          </PopoverContent>
        </Popover>
      </div>

      {slots.length === 0 && (
        <Card className="p-8 text-center text-muted-foreground">Nenhum horário ativo neste dia da semana.</Card>
      )}

      {slots.map((slot) => {
        const doSlot = agendamentos.filter((a) => a.slot_id === slot.id);
        const ativos = doSlot.filter((a) => ["agendado", "confirmado"].includes(a.status));
        return (
          <Card key={slot.id} className="p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold">
                {slot.horario_inicio.slice(0, 5)} → {slot.horario_fim.slice(0, 5)}
              </h3>
              <Badge variant="outline">{ativos.length} / {slot.capacidade_maxima} alunos</Badge>
            </div>
            {doSlot.length === 0 ? (
              <p className="text-sm text-muted-foreground">Sem agendamentos.</p>
            ) : (
              <div className="space-y-2">
                {doSlot.map((a) => (
                  <div key={a.id} className="flex items-center gap-2 p-2 rounded-lg border">
                    <div className="flex-1">
                      <div className="font-medium text-sm">{a.alunos?.nome ?? "—"}</div>
                      <div className="text-xs text-muted-foreground">{a.horario_inicio.slice(0, 5)}</div>
                    </div>
                    <Badge className={cn("border", STATUS_STYLES[a.status])} variant="outline">{a.status}</Badge>
                    {["agendado", "confirmado"].includes(a.status) && (
                      <>
                        <Button size="sm" variant="outline"
                          onClick={() => updateStatus.mutate({ id: a.id, status: "realizado" })}>
                          Presente
                        </Button>
                        <Button size="sm" variant="outline"
                          onClick={() => updateStatus.mutate({ id: a.id, status: "faltou" })}>
                          Falta
                        </Button>
                        <Button size="sm" variant="ghost"
                          onClick={() => updateStatus.mutate({ id: a.id, status: "cancelado" })}>
                          Cancelar
                        </Button>
                      </>
                    )}
                  </div>
                ))}
              </div>
            )}
          </Card>
        );
      })}
    </div>
  );
}

export default function AgendaTreinos() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Agenda de Treinos</h1>
        <p className="text-sm text-muted-foreground">Configure horários semanais e acompanhe os agendamentos dos alunos.</p>
      </div>

      <Tabs defaultValue="horarios">
        <TabsList>
          <TabsTrigger value="horarios">Horários</TabsTrigger>
          <TabsTrigger value="agendamentos">Agendamentos</TabsTrigger>
        </TabsList>
        <TabsContent value="horarios" className="mt-4"><HorariosTab /></TabsContent>
        <TabsContent value="agendamentos" className="mt-4"><AgendamentosTab /></TabsContent>
      </Tabs>
    </div>
  );
}
