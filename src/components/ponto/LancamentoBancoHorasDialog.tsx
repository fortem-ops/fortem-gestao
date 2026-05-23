import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  usuarioId: string;
  usuarioNome: string;
}

export function LancamentoBancoHorasDialog({ open, onOpenChange, usuarioId, usuarioNome }: Props) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [sinal, setSinal] = useState<"credito" | "debito">("credito");
  const [horas, setHoras] = useState("0");
  const [minutos, setMinutos] = useState("0");
  const [data, setData] = useState(new Date().toISOString().slice(0, 10));
  const [motivo, setMotivo] = useState("");
  const [tipo, setTipo] = useState("credito_manual");
  const [competencia, setCompetencia] = useState(() => new Date().toISOString().slice(0, 7) + "-01");
  const [vencimento, setVencimento] = useState<string>("");

  useEffect(() => {
    if (open) {
      setSinal("credito"); setHoras("0"); setMinutos("0");
      setData(new Date().toISOString().slice(0, 10));
      setMotivo(""); setTipo("credito_manual");
      setCompetencia(new Date().toISOString().slice(0, 7) + "-01");
      setVencimento("");
    }
  }, [open]);

  useEffect(() => {
    setTipo(sinal === "credito" ? "credito_manual" : "debito_manual");
  }, [sinal]);

  const mut = useMutation({
    mutationFn: async () => {
      const totalMin = (parseInt(horas || "0", 10) * 60) + parseInt(minutos || "0", 10);
      if (totalMin === 0) throw new Error("Informe horas e/ou minutos");
      if (motivo.trim().length < 3) throw new Error("Motivo obrigatório (mín. 3 caracteres)");
      // Validação CLT: 2h extras/dia
      if (sinal === "credito" && tipo === "hora_extra" && totalMin > 120) {
        throw new Error("Limite legal de 2h extras por dia ultrapassado");
      }
      const minSigned = sinal === "credito" ? totalMin : -totalMin;
      const { error } = await supabase.from("ponto_banco_horas" as any).insert({
        usuario_id: usuarioId,
        data,
        minutos: minSigned,
        motivo: motivo.trim(),
        tipo,
        competencia,
        vencimento: vencimento || null,
        registrado_por: user!.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Lançamento registrado" });
      qc.invalidateQueries({ queryKey: ["admin-banco"] });
      qc.invalidateQueries({ queryKey: ["meu-banco-saldo"] });
      qc.invalidateQueries({ queryKey: ["meu-banco-resumo"] });
      qc.invalidateQueries({ queryKey: ["meu-banco-lancamentos"] });
      onOpenChange(false);
    },
    onError: (e: any) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Lançar no banco de horas</DialogTitle>
          <DialogDescription>{usuarioNome}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Operação</Label>
            <Select value={sinal} onValueChange={(v) => setSinal(v as any)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="credito">Crédito (+)</SelectItem>
                <SelectItem value="debito">Débito (−)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Horas</Label>
              <Input type="number" min="0" value={horas} onChange={(e) => setHoras(e.target.value)} />
            </div>
            <div>
              <Label>Minutos</Label>
              <Input type="number" min="0" max="59" value={minutos} onChange={(e) => setMinutos(e.target.value)} />
            </div>
          </div>
          <div>
            <Label>Data de referência</Label>
            <Input type="date" value={data} onChange={(e) => setData(e.target.value)} />
          </div>
          <div>
            <Label>Tipo</Label>
            <Select value={tipo} onValueChange={setTipo}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="credito_manual">Crédito manual</SelectItem>
                <SelectItem value="debito_manual">Débito manual</SelectItem>
                <SelectItem value="hora_extra">Hora extra</SelectItem>
                <SelectItem value="compensacao">Compensação</SelectItem>
                <SelectItem value="ajuste_saldo">Ajuste de saldo</SelectItem>
                <SelectItem value="substituicao">Substituição</SelectItem>
                <SelectItem value="atividade_especial">Atividade especial</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Competência</Label>
              <Input type="month" value={competencia.slice(0, 7)} onChange={(e) => setCompetencia(e.target.value + "-01")} />
            </div>
            <div>
              <Label>Vencimento (opcional)</Label>
              <Input type="date" value={vencimento} onChange={(e) => setVencimento(e.target.value)} />
            </div>
          </div>
          <div>
            <Label>Motivo</Label>
            <Textarea value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Descreva o motivo do lançamento" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={() => mut.mutate()} disabled={mut.isPending}>
            {mut.isPending ? "Salvando..." : "Salvar lançamento"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
