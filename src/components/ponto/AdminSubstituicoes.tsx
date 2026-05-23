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
import { toast } from "@/hooks/use-toast";
import { Plus, Check, X, UserCheck, Replace } from "lucide-react";

type Forma = "pagamento" | "banco_horas";
type Status = "pendente" | "aprovada" | "rejeitada";

interface Sub {
  id: string;
  substituto_id: string;
  substituido_id: string;
  data: string;
  hora_inicio: string;
  hora_fim: string;
  qtd_horas: number;
  valor_hora_aplicado: number;
  forma_pagamento: Forma;
  motivo: string;
  status: Status;
  observacoes: string | null;
}

const STATUS_TONE: Record<Status, string> = {
  pendente: "bg-warning/15 text-warning border-warning/30",
  aprovada: "bg-success/15 text-success border-success/30",
  rejeitada: "bg-destructive/15 text-destructive border-destructive/30",
};

export function AdminSubstituicoes() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [novoOpen, setNovoOpen] = useState(false);

  const { data: colabs = [] } = useQuery({
    queryKey: ["ponto-subs-colabs"],
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

  const nomeById = useMemo(() => {
    const m = new Map<string, string>();
    colabs.forEach((c: any) => m.set(c.user_id, c.full_name));
    return m;
  }, [colabs]);

  const { data: subs = [], isLoading } = useQuery({
    queryKey: ["ponto-substituicoes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ponto_substituicoes" as any)
        .select("*")
        .order("data", { ascending: false })
        .limit(200);
      if (error) throw error;
      return (data ?? []) as unknown as Sub[];
    },
  });

  const aprovar = useMutation({
    mutationFn: async ({ id, novoStatus }: { id: string; novoStatus: Status }) => {
      const sub = subs.find((s) => s.id === id);
      const { error } = await supabase
        .from("ponto_substituicoes" as any)
        .update({
          status: novoStatus,
          aprovado_por: user!.id,
          aprovado_em: new Date().toISOString(),
        })
        .eq("id", id);
      if (error) throw error;

      // Se aprovada e forma=banco_horas, lança crédito no banco do substituto
      if (sub && novoStatus === "aprovada" && sub.forma_pagamento === "banco_horas") {
        const minutos = Math.round(Number(sub.qtd_horas) * 60);
        await supabase.from("ponto_banco_horas" as any).insert({
          usuario_id: sub.substituto_id,
          data: sub.data,
          minutos,
          motivo: `Substituição: ${sub.motivo}`.slice(0, 200),
          tipo: "substituicao",
          registrado_por: user!.id,
        });
      }
    },
    onSuccess: (_, vars) => {
      toast({
        title: vars.novoStatus === "aprovada" ? "Substituição aprovada" : "Substituição rejeitada",
      });
      qc.invalidateQueries({ queryKey: ["ponto-substituicoes"] });
      qc.invalidateQueries({ queryKey: ["admin-banco"] });
    },
    onError: (e: any) =>
      toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  return (
    <Card className="p-4 space-y-4">
      <div className="flex items-center gap-2">
        <Replace className="w-4 h-4 text-primary" />
        <h3 className="font-semibold">Substituições entre profissionais</h3>
        <Button size="sm" className="ml-auto gap-1" onClick={() => setNovoOpen(true)}>
          <Plus className="w-4 h-4" /> Nova substituição
        </Button>
      </div>

      {isLoading ? (
        <Skeleton className="h-40" />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Data</TableHead>
              <TableHead>Substituto</TableHead>
              <TableHead>Substituído</TableHead>
              <TableHead>Horário</TableHead>
              <TableHead className="text-right">Horas</TableHead>
              <TableHead className="text-right">Valor/h</TableHead>
              <TableHead>Forma</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {subs.map((s) => (
              <TableRow key={s.id}>
                <TableCell className="font-medium">
                  {new Date(s.data + "T00:00").toLocaleDateString("pt-BR")}
                </TableCell>
                <TableCell>{nomeById.get(s.substituto_id) ?? "—"}</TableCell>
                <TableCell>{nomeById.get(s.substituido_id) ?? "—"}</TableCell>
                <TableCell className="text-xs">
                  {s.hora_inicio.slice(0, 5)} – {s.hora_fim.slice(0, 5)}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {Number(s.qtd_horas).toFixed(2)}h
                </TableCell>
                <TableCell className="text-right">
                  R$ {Number(s.valor_hora_aplicado).toFixed(2)}
                </TableCell>
                <TableCell className="text-xs">
                  {s.forma_pagamento === "pagamento" ? "Pagamento" : "Banco h"}
                </TableCell>
                <TableCell>
                  <Badge variant="outline" className={STATUS_TONE[s.status]}>
                    {s.status}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  {s.status === "pendente" && (
                    <div className="flex gap-1 justify-end">
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-1 h-7"
                        onClick={() => aprovar.mutate({ id: s.id, novoStatus: "aprovada" })}
                      >
                        <Check className="w-3 h-3" /> Aprovar
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="gap-1 h-7 text-destructive"
                        onClick={() => aprovar.mutate({ id: s.id, novoStatus: "rejeitada" })}
                      >
                        <X className="w-3 h-3" />
                      </Button>
                    </div>
                  )}
                </TableCell>
              </TableRow>
            ))}
            {subs.length === 0 && (
              <TableRow>
                <TableCell colSpan={9} className="text-center text-sm text-muted-foreground py-8">
                  Nenhuma substituição registrada.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      )}

      {novoOpen && (
        <NovaSubstituicaoDialog
          colabs={colabs as any[]}
          onClose={() => setNovoOpen(false)}
          onCreated={() => {
            qc.invalidateQueries({ queryKey: ["ponto-substituicoes"] });
            setNovoOpen(false);
          }}
        />
      )}
    </Card>
  );
}

function NovaSubstituicaoDialog({
  colabs,
  onClose,
  onCreated,
}: {
  colabs: { user_id: string; full_name: string }[];
  onClose: () => void;
  onCreated: () => void;
}) {
  const { user } = useAuth();
  const [form, setForm] = useState({
    substituto_id: "",
    substituido_id: "",
    data: new Date().toISOString().slice(0, 10),
    hora_inicio: "07:00",
    hora_fim: "08:00",
    motivo: "",
    valor_hora_aplicado: 0,
    forma_pagamento: "pagamento" as Forma,
    observacoes: "",
  });

  // Calcula qtd_horas
  const qtd_horas = useMemo(() => {
    const [hi, mi] = form.hora_inicio.split(":").map(Number);
    const [hf, mf] = form.hora_fim.split(":").map(Number);
    const min = hf * 60 + mf - (hi * 60 + mi);
    return Math.max(0, min / 60);
  }, [form.hora_inicio, form.hora_fim]);

  // Puxa valor hora-aula padrão do substituto
  const { data: vinculo } = useQuery({
    queryKey: ["sub-vinculo", form.substituto_id],
    enabled: !!form.substituto_id,
    queryFn: async () => {
      const { data } = await supabase
        .from("cadastro_trabalhista" as any)
        .select("valor_hora_aula")
        .eq("usuario_id", form.substituto_id)
        .maybeSingle();
      return data as any;
    },
  });

  // Auto-preenche
  useMemo(() => {
    if (vinculo?.valor_hora_aula && form.valor_hora_aplicado === 0) {
      setForm((f) => ({ ...f, valor_hora_aplicado: Number(vinculo.valor_hora_aula) }));
    }
  }, [vinculo]); // eslint-disable-line

  const criar = useMutation({
    mutationFn: async () => {
      if (!form.substituto_id || !form.substituido_id) throw new Error("Selecione os profissionais");
      if (form.substituto_id === form.substituido_id) throw new Error("Substituto deve ser diferente do substituído");
      if (qtd_horas <= 0) throw new Error("Horário inválido");
      if (form.motivo.trim().length < 3) throw new Error("Motivo obrigatório");
      const { error } = await supabase.from("ponto_substituicoes" as any).insert({
        ...form,
        qtd_horas,
        created_by: user!.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Substituição registrada", description: "Aguardando aprovação." });
      onCreated();
    },
    onError: (e: any) =>
      toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Nova substituição</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <Label>Substituto</Label>
            <Select
              value={form.substituto_id}
              onValueChange={(v) => setForm({ ...form, substituto_id: v })}
            >
              <SelectTrigger><SelectValue placeholder="Quem cobriu" /></SelectTrigger>
              <SelectContent>
                {colabs.map((c) => (
                  <SelectItem key={c.user_id} value={c.user_id}>{c.full_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Substituído</Label>
            <Select
              value={form.substituido_id}
              onValueChange={(v) => setForm({ ...form, substituido_id: v })}
            >
              <SelectTrigger><SelectValue placeholder="Quem foi coberto" /></SelectTrigger>
              <SelectContent>
                {colabs.map((c) => (
                  <SelectItem key={c.user_id} value={c.user_id}>{c.full_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Data</Label>
            <Input type="date" value={form.data} onChange={(e) => setForm({ ...form, data: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-2">
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
            <Label>Valor hora-aula (R$)</Label>
            <Input
              type="number"
              step="0.01"
              min={0}
              value={form.valor_hora_aplicado}
              onChange={(e) => setForm({ ...form, valor_hora_aplicado: Number(e.target.value) })}
            />
            <p className="text-xs text-muted-foreground mt-1">
              Total: R$ {(qtd_horas * form.valor_hora_aplicado).toFixed(2)} ({qtd_horas.toFixed(2)}h)
            </p>
          </div>
          <div>
            <Label>Forma de pagamento</Label>
            <Select
              value={form.forma_pagamento}
              onValueChange={(v: Forma) => setForm({ ...form, forma_pagamento: v })}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="pagamento">Pagamento</SelectItem>
                <SelectItem value="banco_horas">Banco de horas</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="md:col-span-2">
            <Label>Motivo</Label>
            <Input value={form.motivo} onChange={(e) => setForm({ ...form, motivo: e.target.value })} placeholder="Ex.: falta justificada, atestado, treinamento" />
          </div>
          <div className="md:col-span-2">
            <Label>Observações</Label>
            <Textarea rows={2} value={form.observacoes} onChange={(e) => setForm({ ...form, observacoes: e.target.value })} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button onClick={() => criar.mutate()} disabled={criar.isPending} className="gap-2">
            <UserCheck className="w-4 h-4" /> Registrar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
