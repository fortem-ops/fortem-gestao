import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, CalendarOff } from "lucide-react";
import { toast } from "sonner";
import {
  type AlunoLicenca,
  type LicencaTipo,
  calcDias,
  getLimite,
  getDiasUsados,
} from "@/lib/licencas";

interface Props {
  alunoId: string;
  planoId: string;
  planoTipo: string;
  isCoordAdmin: boolean;
}

export function StudentLicencas({ alunoId, planoId, planoTipo, isCoordAdmin }: Props) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [tipo, setTipo] = useState<LicencaTipo>("plano");
  const [inicio, setInicio] = useState("");
  const [fim, setFim] = useState("");
  const [motivo, setMotivo] = useState("");
  const [saving, setSaving] = useState(false);

  const { data: licencas = [] } = useQuery({
    queryKey: ["aluno_licencas", alunoId, planoId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("aluno_licencas" as any)
        .select("*")
        .eq("aluno_id", alunoId)
        .eq("plano_id", planoId)
        .order("data_inicio", { ascending: false });
      if (error) throw error;
      return (data as unknown as AlunoLicenca[]) || [];
    },
  });

  const limite = getLimite(planoTipo, tipo);
  const usados = getDiasUsados(licencas, tipo);
  const dias = calcDias(inicio, fim);
  const restanteAntes = Math.max(0, limite - usados);
  const excede = dias > 0 && dias > restanteAntes;

  const todayStr = new Date().toISOString().split("T")[0];

  const close = () => {
    setOpen(false);
    setTipo("plano");
    setInicio("");
    setFim("");
    setMotivo("");
  };

  async function handleSave() {
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Não autenticado");
      const { error } = await supabase.from("aluno_licencas" as any).insert({
        aluno_id: alunoId,
        plano_id: planoId,
        tipo,
        data_inicio: inicio,
        data_fim: fim,
        dias,
        motivo: motivo || null,
        criado_por: user.id,
      });
      if (error) throw error;
      toast.success("Licença adicionada");
      qc.invalidateQueries({ queryKey: ["aluno_licencas", alunoId, planoId] });
      qc.invalidateQueries({ queryKey: ["alunos_with_plans"] });
      close();
    } catch (err: any) {
      toast.error(err.message || "Erro ao adicionar licença");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    try {
      const { error } = await supabase.from("aluno_licencas" as any).delete().eq("id", id);
      if (error) throw error;
      toast.success("Licença removida");
      qc.invalidateQueries({ queryKey: ["aluno_licencas", alunoId, planoId] });
      qc.invalidateQueries({ queryKey: ["alunos_with_plans"] });
    } catch (err: any) {
      toast.error(err.message || "Erro ao remover");
    }
  }

  function statusOf(l: AlunoLicenca): { label: string; cls: string } {
    if (l.data_inicio > todayStr) return { label: "Futura", cls: "status-info" };
    if (l.data_fim < todayStr) return { label: "Encerrada", cls: "status-urgent" };
    return { label: "Vigente", cls: "status-license" };
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm font-medium text-foreground flex items-center gap-2">
          <CalendarOff className="h-4 w-4 text-muted-foreground" />
          Licenças
        </p>
        {isCoordAdmin && (
          <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
            <Plus className="h-3.5 w-3.5 mr-1" /> Adicionar licença
          </Button>
        )}
      </div>

      {licencas.length === 0 ? (
        <p className="text-xs text-muted-foreground">Nenhuma licença registrada.</p>
      ) : (
        <div className="space-y-2">
          {licencas.map((l) => {
            const st = statusOf(l);
            return (
              <div key={l.id} className="flex items-center justify-between rounded-md border border-border/50 bg-muted/20 px-4 py-2.5">
                <div className="flex items-center gap-3">
                  <Badge variant="outline" className="text-xs">
                    {l.tipo === "plano" ? "Licença do Plano" : "Licença Médica"}
                  </Badge>
                  <span className="text-sm text-foreground">
                    {new Date(l.data_inicio + "T00:00:00").toLocaleDateString("pt-BR")} →{" "}
                    {new Date(l.data_fim + "T00:00:00").toLocaleDateString("pt-BR")}
                  </span>
                  <span className="text-xs text-muted-foreground">{l.dias} dia{l.dias !== 1 ? "s" : ""}</span>
                  <Badge variant="outline" className={`text-xs ${st.cls}`}>{st.label}</Badge>
                </div>
                {isCoordAdmin && (
                  <button
                    className="text-muted-foreground hover:text-destructive transition-colors"
                    onClick={() => handleDelete(l.id)}
                    title="Remover"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      <Dialog open={open} onOpenChange={(v) => (v ? setOpen(true) : close())}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Adicionar licença</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Tipo</Label>
              <RadioGroup value={tipo} onValueChange={(v) => setTipo(v as LicencaTipo)}>
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="plano" id="lt-plano" />
                  <Label htmlFor="lt-plano" className="font-normal">Licença do Plano</Label>
                </div>
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="medica" id="lt-medica" />
                  <Label htmlFor="lt-medica" className="font-normal">Licença Médica</Label>
                </div>
              </RadioGroup>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Data início</Label>
                <Input type="date" value={inicio} onChange={(e) => setInicio(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Data fim</Label>
                <Input type="date" value={fim} onChange={(e) => setFim(e.target.value)} />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Motivo (opcional)</Label>
              <Textarea value={motivo} onChange={(e) => setMotivo(e.target.value)} rows={2} />
            </div>

            <div className={`text-xs rounded-md p-3 ${excede ? "status-urgent" : "status-info"}`}>
              {limite === 0 ? (
                <span>Plano <strong>{planoTipo}</strong> não permite {tipo === "plano" ? "Licença do Plano" : "Licença Médica"}.</span>
              ) : (
                <>
                  Plano <strong>{planoTipo}</strong>: {limite} dias permitidos · {usados} já usados · {restanteAntes} disponíveis.
                  {dias > 0 && (
                    <span className="block mt-1">
                      Solicitando <strong>{dias}</strong> dia{dias !== 1 ? "s" : ""}{excede ? " — excede o limite" : ""}.
                    </span>
                  )}
                </>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={close}>Cancelar</Button>
            <Button
              disabled={saving || !inicio || !fim || dias <= 0 || limite === 0 || excede}
              onClick={handleSave}
            >
              Adicionar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
