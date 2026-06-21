import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { Save, Trash2, Calendar } from "lucide-react";

const DIAS = [
  { val: 1, label: "Segunda" },
  { val: 2, label: "Terça" },
  { val: 3, label: "Quarta" },
  { val: 4, label: "Quinta" },
  { val: 5, label: "Sexta" },
  { val: 6, label: "Sábado" },
];

// 06:00 → 21:15 em passos de 15 min
const HORARIOS = (() => {
  const out: string[] = [];
  for (let h = 6; h <= 21; h++) {
    for (let m = 0; m < 60; m += 15) {
      if (h === 21 && m > 15) break;
      out.push(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`);
    }
  }
  return out;
})();

interface HorarioRow {
  id: string;
  usuario_id: string;
  dia_semana: number;
  horario_inicio: string;
  horario_fim: string;
  intervalo_min: number;
  ativo: boolean;
  frequencia_mensal: number | null;
}

export function AdminPontoHorarios() {
  const qc = useQueryClient();
  const [profSelecionado, setProfSelecionado] = useState<string>("");

  const { data: professores = [], isLoading: loadingProfs } = useQuery({
    queryKey: ["ponto-colaboradores-list"],
    queryFn: async () => {
      const { data: roles } = await supabase.from("user_roles").select("user_id, role").in("role", ["professor", "admin"]);
      const ids = Array.from(new Set((roles ?? []).map((r) => r.user_id)));
      if (!ids.length) return [];
      const { data: profs } = await supabase.from("profiles").select("user_id, full_name").in("user_id", ids);
      return (profs ?? []).sort((a: any, b: any) => a.full_name.localeCompare(b.full_name));
    },
  });

  const { data: horarios = [], isLoading: loadingHorarios } = useQuery({
    queryKey: ["ponto-horarios", profSelecionado],
    enabled: !!profSelecionado,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ponto_horarios_professor")
        .select("*")
        .eq("usuario_id", profSelecionado)
        .order("dia_semana");
      if (error) throw error;
      return data as HorarioRow[];
    },
  });

  const upsert = useMutation({
    mutationFn: async (row: Partial<HorarioRow>) => {
      const { error } = await supabase.from("ponto_horarios_professor").upsert(
        {
          usuario_id: profSelecionado,
          dia_semana: row.dia_semana!,
          horario_inicio: row.horario_inicio!,
          horario_fim: row.horario_fim!,
          intervalo_min: row.intervalo_min ?? 0,
          ativo: row.ativo ?? true,
          frequencia_mensal: row.dia_semana === 6 ? (row.frequencia_mensal ?? 4) : null,
        } as any,
        { onConflict: "usuario_id,dia_semana" }
      );
      if (error) throw error;
    },
    onSuccess: () => {
      toast("Horário salvo");
      qc.invalidateQueries({ queryKey: ["ponto-horarios", profSelecionado] });
    },
    onError: (e: any) => toast.error("Falha ao salvar", { description: e.message }),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("ponto_horarios_professor").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast("Horário removido");
      qc.invalidateQueries({ queryKey: ["ponto-horarios", profSelecionado] });
    },
  });

  const horariosPorDia = useMemo(() => {
    const map = new Map<number, HorarioRow>();
    horarios.forEach((h) => map.set(h.dia_semana, h));
    return map;
  }, [horarios]);

  return (
    <Card className="p-6 space-y-4">
      <div className="flex items-center gap-2">
        <Calendar className="w-5 h-5 text-primary" />
        <h3 className="font-heading font-semibold text-lg">Horário por funcionário</h3>
      </div>
      <p className="text-sm text-muted-foreground">
        Defina a janela de trabalho (06:00–21:15) para cada dia da semana (segunda a sábado) e se haverá intervalo de 15 minutos.
      </p>

      <div className="max-w-sm">
        <Label className="text-xs">Funcionário</Label>
        <Select value={profSelecionado} onValueChange={setProfSelecionado}>
          <SelectTrigger>
            <SelectValue placeholder={loadingProfs ? "Carregando…" : "Selecionar funcionário"} />
          </SelectTrigger>
          <SelectContent>
            {professores.map((p: any) => (
              <SelectItem key={p.user_id} value={p.user_id}>
                {p.full_name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {!profSelecionado ? (
        <p className="text-sm text-muted-foreground py-6 text-center">Selecione um funcionário para configurar os horários.</p>
      ) : loadingHorarios ? (
        <Skeleton className="h-64" />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[120px]">Dia</TableHead>
              <TableHead>Início</TableHead>
              <TableHead>Fim</TableHead>
              <TableHead>Intervalo</TableHead>
              <TableHead>Frequência</TableHead>
              <TableHead>Ativo</TableHead>
              <TableHead className="text-right"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {DIAS.map((dia) => (
              <DiaRow
                key={`${profSelecionado}-${dia.val}`}
                dia={dia}
                row={horariosPorDia.get(dia.val)}
                onSave={(r) => upsert.mutate({ ...r, dia_semana: dia.val })}
                onDelete={(id) => del.mutate(id)}
              />
            ))}
          </TableBody>
        </Table>
      )}
    </Card>
  );
}

function DiaRow({
  dia,
  row,
  onSave,
  onDelete,
}: {
  dia: { val: number; label: string };
  row?: HorarioRow;
  onSave: (r: Partial<HorarioRow>) => void;
  onDelete: (id: string) => void;
}) {
  const [inicio, setInicio] = useState(row?.horario_inicio?.slice(0, 5) ?? "06:00");
  const [fim, setFim] = useState(row?.horario_fim?.slice(0, 5) ?? "12:00");
  const [intervalo, setIntervalo] = useState<number>(row?.intervalo_min ?? 0);
  const [ativo, setAtivo] = useState<boolean>(row?.ativo ?? true);
  const [frequencia, setFrequencia] = useState<number>(row?.frequencia_mensal ?? 4);

  const valido = fim > inicio;
  const isSabado = dia.val === 6;

  // Regra: jornadas até 4h (≤240 min) não têm intervalo — apenas entrada e saída.
  const janelaMin = useMemo(() => {
    const [hi, mi] = inicio.split(":").map(Number);
    const [hf, mf] = fim.split(":").map(Number);
    return hf * 60 + mf - (hi * 60 + mi);
  }, [inicio, fim]);
  const intervaloBloqueado = janelaMin > 0 && janelaMin <= 240;
  useEffect(() => {
    if (intervaloBloqueado && intervalo !== 0) setIntervalo(0);
  }, [intervaloBloqueado, intervalo]);

  return (
    <TableRow>
      <TableCell className="font-medium">{dia.label}</TableCell>
      <TableCell>
        <Select value={inicio} onValueChange={setInicio}>
          <SelectTrigger className="w-[110px]"><SelectValue /></SelectTrigger>
          <SelectContent className="max-h-64">
            {HORARIOS.map((h) => <SelectItem key={h} value={h}>{h}</SelectItem>)}
          </SelectContent>
        </Select>
      </TableCell>
      <TableCell>
        <Select value={fim} onValueChange={setFim}>
          <SelectTrigger className="w-[110px]"><SelectValue /></SelectTrigger>
          <SelectContent className="max-h-64">
            {HORARIOS.map((h) => <SelectItem key={h} value={h}>{h}</SelectItem>)}
          </SelectContent>
        </Select>
      </TableCell>
      <TableCell>
        <Select value={String(intervalo)} onValueChange={(v) => setIntervalo(Number(v))} disabled={intervaloBloqueado}>
          <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="0">Sem intervalo</SelectItem>
            <SelectItem value="15">15 minutos</SelectItem>
            <SelectItem value="60">1 hora</SelectItem>
          </SelectContent>
        </Select>
        {intervaloBloqueado && (
          <p className="text-[10px] text-muted-foreground mt-1 leading-tight max-w-[140px]">
            Jornadas até 4h: apenas entrada e saída.
          </p>
        )}
      </TableCell>
      <TableCell>
        {isSabado ? (
          <Select value={String(frequencia)} onValueChange={(v) => setFrequencia(Number(v))}>
            <SelectTrigger className="w-[170px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="1">1x por mês</SelectItem>
              <SelectItem value="2">2x por mês</SelectItem>
              <SelectItem value="3">3x por mês</SelectItem>
              <SelectItem value="4">Todos os sábados</SelectItem>
            </SelectContent>
          </Select>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        )}
      </TableCell>
      <TableCell>
        <Switch checked={ativo} onCheckedChange={setAtivo} />
      </TableCell>
      <TableCell className="text-right">
        <div className="flex gap-1 justify-end">
          <Button
            size="sm"
            variant="outline"
            disabled={!valido}
            onClick={() => onSave({ horario_inicio: inicio, horario_fim: fim, intervalo_min: intervalo, ativo, frequencia_mensal: isSabado ? frequencia : null })}
            className="gap-1"
          >
            <Save className="w-3.5 h-3.5" /> Salvar
          </Button>
          {row && (
            <Button size="sm" variant="ghost" onClick={() => onDelete(row.id)}>
              <Trash2 className="w-4 h-4 text-destructive" />
            </Button>
          )}
        </div>
      </TableCell>
    </TableRow>
  );
}
