import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { Plus, Sparkles, Trash2, Users } from "lucide-react";

type Forma = "pagamento" | "banco_horas";

interface Atividade {
  id: string;
  nome: string;
  descricao: string | null;
  data: string;
  hora_inicio: string;
  hora_fim: string;
  local: string | null;
}

interface Participante {
  id: string;
  atividade_id: string;
  usuario_id: string;
  qtd_horas: number;
  valor_hora: number;
  forma_pagamento: Forma;
  observacoes: string | null;
}

export function AdminAtividadesEspeciais() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [novaOpen, setNovaOpen] = useState(false);
  const [verParticipantesId, setVerParticipantesId] = useState<string | null>(null);

  const { data: colabs = [] } = useQuery({
    queryKey: ["ponto-atv-colabs"],
    queryFn: async () => {
      const { data: roles } = await supabase
        .from("user_roles")
        .select("user_id, role")
        .in("role", ["professor", "admin", "coordenador", "nutricionista", "fisioterapeuta"]);
      const ids = Array.from(new Set((roles ?? []).map((r) => r.user_id)));
      if (!ids.length) return [];
      const { data: profs } = await supabase
        .from("profiles")
        .select("user_id, full_name")
        .in("user_id", ids);
      return (profs ?? []).sort((a: any, b: any) =>
        (a.full_name ?? "").localeCompare(b.full_name ?? ""),
      );
    },
  });

  const { data: atividades = [], isLoading } = useQuery({
    queryKey: ["ponto-atividades"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ponto_atividades_especiais" as any)
        .select("*")
        .order("data", { ascending: false })
        .limit(100);
      if (error) throw error;
      return (data ?? []) as unknown as Atividade[];
    },
  });

  const remover = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("ponto_atividades_especiais" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast("Atividade removida");
      qc.invalidateQueries({ queryKey: ["ponto-atividades"] });
    },
  });

  return (
    <Card className="p-4 space-y-4">
      <div className="flex items-center gap-2">
        <Sparkles className="w-4 h-4 text-primary" />
        <h3 className="font-semibold">Atividades especiais</h3>
        <p className="text-xs text-muted-foreground ml-2">
          Eventos com horas-aula vinculadas. Limite: 8h por participante.
        </p>
        <Button size="sm" className="ml-auto gap-1" onClick={() => setNovaOpen(true)}>
          <Plus className="w-4 h-4" /> Nova atividade
        </Button>
      </div>

      {isLoading ? (
        <Skeleton className="h-40" />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Data</TableHead>
              <TableHead>Nome</TableHead>
              <TableHead>Horário</TableHead>
              <TableHead>Local</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {atividades.map((a) => (
              <TableRow key={a.id}>
                <TableCell className="font-medium">
                  {new Date(a.data + "T00:00").toLocaleDateString("pt-BR")}
                </TableCell>
                <TableCell>{a.nome}</TableCell>
                <TableCell className="text-xs">
                  {a.hora_inicio.slice(0, 5)} – {a.hora_fim.slice(0, 5)}
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">{a.local ?? "—"}</TableCell>
                <TableCell className="text-right">
                  <Button size="sm" variant="outline" className="gap-1 h-7 mr-1" onClick={() => setVerParticipantesId(a.id)}>
                    <Users className="w-3 h-3" /> Participantes
                  </Button>
                  <Button size="sm" variant="ghost" className="h-7 text-destructive" onClick={() => remover.mutate(a.id)}>
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {atividades.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-sm text-muted-foreground py-8">
                  Nenhuma atividade cadastrada.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      )}

      {novaOpen && (
        <NovaAtividadeDialog
          onClose={() => setNovaOpen(false)}
          onCreated={() => {
            qc.invalidateQueries({ queryKey: ["ponto-atividades"] });
            setNovaOpen(false);
          }}
        />
      )}

      {verParticipantesId && (
        <ParticipantesDialog
          atividadeId={verParticipantesId}
          colabs={colabs as any[]}
          onClose={() => setVerParticipantesId(null)}
        />
      )}
    </Card>
  );
}

function NovaAtividadeDialog({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const { user } = useAuth();
  const [form, setForm] = useState({
    nome: "",
    descricao: "",
    data: new Date().toISOString().slice(0, 10),
    hora_inicio: "08:00",
    hora_fim: "12:00",
    local: "",
  });

  const criar = useMutation({
    mutationFn: async () => {
      if (form.nome.trim().length < 3) throw new Error("Nome obrigatório");
      const { error } = await supabase.from("ponto_atividades_especiais" as any).insert({
        ...form,
        created_by: user!.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast("Atividade criada");
      onCreated();
    },
    onError: (e: any) => toast.error("Erro", { description: e.message }),
  });

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Nova atividade especial</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Nome do evento</Label>
            <Input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} />
          </div>
          <div>
            <Label>Descrição</Label>
            <Textarea rows={2} value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} />
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div>
              <Label>Data</Label>
              <Input type="date" value={form.data} onChange={(e) => setForm({ ...form, data: e.target.value })} />
            </div>
            <div>
              <Label>Início</Label>
              <Input type="time" value={form.hora_inicio} onChange={(e) => setForm({ ...form, hora_inicio: e.target.value })} />
            </div>
            <div>
              <Label>Fim</Label>
              <Input type="time" value={form.hora_fim} onChange={(e) => setForm({ ...form, hora_fim: e.target.value })} />
            </div>
          </div>
          <div>
            <Label>Local</Label>
            <Input value={form.local} onChange={(e) => setForm({ ...form, local: e.target.value })} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button onClick={() => criar.mutate()} disabled={criar.isPending}>Criar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ParticipantesDialog({
  atividadeId,
  colabs,
  onClose,
}: {
  atividadeId: string;
  colabs: { user_id: string; full_name: string }[];
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const { user } = useAuth();

  const { data: participantes = [], isLoading } = useQuery({
    queryKey: ["ponto-atv-participantes", atividadeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ponto_atividades_participantes" as any)
        .select("*")
        .eq("atividade_id", atividadeId);
      if (error) throw error;
      return (data ?? []) as unknown as Participante[];
    },
  });

  const nomeById = useMemo(() => {
    const m = new Map<string, string>();
    colabs.forEach((c) => m.set(c.user_id, c.full_name));
    return m;
  }, [colabs]);

  const [novo, setNovo] = useState({
    usuario_id: "",
    qtd_horas: 1,
    valor_hora: 0,
    forma_pagamento: "pagamento" as Forma,
    observacoes: "",
  });

  const adicionar = useMutation({
    mutationFn: async () => {
      if (!novo.usuario_id) throw new Error("Selecione o participante");
      if (novo.qtd_horas <= 0 || novo.qtd_horas > 8) throw new Error("Horas devem ser entre 0 e 8");
      const { error } = await supabase.from("ponto_atividades_participantes" as any).insert({
        atividade_id: atividadeId,
        ...novo,
      });
      if (error) throw error;
      // Se banco_horas, lança crédito
      if (novo.forma_pagamento === "banco_horas") {
        const { data: atv } = await supabase
          .from("ponto_atividades_especiais" as any)
          .select("data, nome")
          .eq("id", atividadeId)
          .maybeSingle();
        await supabase.from("ponto_banco_horas" as any).insert({
          usuario_id: novo.usuario_id,
          data: (atv as any)?.data ?? new Date().toISOString().slice(0, 10),
          minutos: Math.round(novo.qtd_horas * 60),
          motivo: `Atividade especial: ${(atv as any)?.nome ?? "evento"}`.slice(0, 200),
          tipo: "atividade_especial",
          registrado_por: user!.id,
        });
      }
    },
    onSuccess: () => {
      toast("Participante adicionado");
      qc.invalidateQueries({ queryKey: ["ponto-atv-participantes", atividadeId] });
      qc.invalidateQueries({ queryKey: ["admin-banco"] });
      setNovo({ usuario_id: "", qtd_horas: 1, valor_hora: 0, forma_pagamento: "pagamento", observacoes: "" });
    },
    onError: (e: any) => toast.error("Erro", { description: e.message }),
  });

  const remover = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("ponto_atividades_participantes" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["ponto-atv-participantes", atividadeId] }),
  });

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Participantes da atividade</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          {isLoading ? (
            <Skeleton className="h-20" />
          ) : participantes.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum participante.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Profissional</TableHead>
                  <TableHead className="text-right">Horas</TableHead>
                  <TableHead className="text-right">Valor/h</TableHead>
                  <TableHead>Forma</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {participantes.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell>{nomeById.get(p.usuario_id) ?? "—"}</TableCell>
                    <TableCell className="text-right">{Number(p.qtd_horas).toFixed(2)}h</TableCell>
                    <TableCell className="text-right">R$ {Number(p.valor_hora).toFixed(2)}</TableCell>
                    <TableCell className="text-xs">
                      <Badge variant="outline" className={p.forma_pagamento === "banco_horas" ? "bg-info/15 text-info border-info/30" : "bg-success/15 text-success border-success/30"}>
                        {p.forma_pagamento === "banco_horas" ? "Banco h" : "Pagamento"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Button size="sm" variant="ghost" className="text-destructive h-7" onClick={() => remover.mutate(p.id)}>
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}

          <div className="border-t border-border pt-3 space-y-2">
            <p className="text-xs font-medium text-muted-foreground">Adicionar participante</p>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs">Profissional</Label>
                <Select value={novo.usuario_id} onValueChange={(v) => setNovo({ ...novo, usuario_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
                  <SelectContent>
                    {colabs.map((c) => (
                      <SelectItem key={c.user_id} value={c.user_id}>{c.full_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Horas (máx 8)</Label>
                <Input type="number" min={0} max={8} step="0.5" value={novo.qtd_horas} onChange={(e) => setNovo({ ...novo, qtd_horas: Number(e.target.value) })} />
              </div>
              <div>
                <Label className="text-xs">Valor/h</Label>
                <Input type="number" min={0} step="0.01" value={novo.valor_hora} onChange={(e) => setNovo({ ...novo, valor_hora: Number(e.target.value) })} />
              </div>
              <div>
                <Label className="text-xs">Forma</Label>
                <Select value={novo.forma_pagamento} onValueChange={(v: Forma) => setNovo({ ...novo, forma_pagamento: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pagamento">Pagamento</SelectItem>
                    <SelectItem value="banco_horas">Banco de horas</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <Button size="sm" onClick={() => adicionar.mutate()} disabled={adicionar.isPending} className="gap-1">
              <Plus className="w-3 h-3" /> Adicionar
            </Button>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Fechar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
