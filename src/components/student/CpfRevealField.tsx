import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Eye, EyeOff, Pencil, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { isValidCpfDigits, normalizeCpf } from "@/lib/cpfValidation";

const REVEAL_MS = 15_000;

function formatCPF(digits: string) {
  const d = digits.replace(/\D/g, "").slice(0, 11);
  return d
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
}

interface Props {
  alunoId: string;
  cpfUltimos3: string | null | undefined;
  isCoordAdmin: boolean;
  isAdmin: boolean;
}

export function CpfRevealField({ alunoId, cpfUltimos3, isCoordAdmin, isAdmin }: Props) {
  const qc = useQueryClient();
  const [revealed, setRevealed] = useState<string | null>(null);
  const [progress, setProgress] = useState(100);
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState("");
  const [saving, setSaving] = useState(false);
  const timerRef = useRef<number | null>(null);
  const startRef = useRef<number>(0);

  const hasCpf = !!cpfUltimos3;
  const masked = hasCpf
    ? `•••.•••.**${cpfUltimos3}`
    : "Não informado";

  function clearTimer() {
    if (timerRef.current) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }

  function hide() {
    clearTimer();
    setRevealed(null);
    setProgress(100);
  }

  useEffect(() => () => clearTimer(), []);

  async function reveal() {
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc("fn_reveal_cpf", { p_aluno_id: alunoId });
      if (error) throw error;
      const cpfFull = typeof data === "string" ? data : "";
      setRevealed(cpfFull);
      startRef.current = Date.now();
      setProgress(100);
      clearTimer();
      timerRef.current = window.setInterval(() => {
        const elapsed = Date.now() - startRef.current;
        const pct = Math.max(0, 100 - (elapsed / REVEAL_MS) * 100);
        setProgress(pct);
        if (elapsed >= REVEAL_MS) hide();
      }, 200);
    } catch (e: any) {
      const msg = String(e?.message || "");
      toast.error(
        msg.toLowerCase().includes("acesso") || msg.toLowerCase().includes("permission")
          ? "Acesso negado para revelar CPF."
          : msg || "Não foi possível revelar o CPF.",
      );
    } finally {
      setLoading(false);
    }
  }

  function openEdit() {
    setEditValue(revealed ? formatCPF(revealed) : "");
    setEditing(true);
  }

  async function saveEdit() {
    const digits = normalizeCpf(editValue);
    if (!isValidCpfDigits(digits)) {
      toast.error("CPF inválido. Confira os 11 dígitos.");
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase.rpc("fn_update_cpf", {
        p_aluno_id: alunoId,
        p_novo_cpf: digits,
      });
      if (error) throw error;
      toast.success("CPF atualizado.");
      setEditing(false);
      hide();
      qc.invalidateQueries({ queryKey: ["aluno", alunoId] });
      qc.invalidateQueries({ queryKey: ["student", alunoId] });
      qc.invalidateQueries({ predicate: (q) => {
        const k = q.queryKey?.[0];
        return typeof k === "string" && (k.startsWith("student") || k.startsWith("aluno"));
      }});
    } catch (e: any) {
      const msg = String(e?.message || "");
      toast.error(
        msg.toLowerCase().includes("acesso") || msg.toLowerCase().includes("permission")
          ? "Acesso negado para editar CPF."
          : msg || "Não foi possível atualizar o CPF.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <div className="flex items-center gap-2 flex-wrap">
        <p className="text-sm font-semibold text-foreground font-mono">
          {revealed ? formatCPF(revealed) : masked}
        </p>
        {!hasCpf && isAdmin && (
          <Button size="sm" variant="ghost" className="h-7 px-2 gap-1" onClick={openEdit}>
            <Plus className="w-3.5 h-3.5" /> Adicionar CPF
          </Button>
        )}
        {!hasCpf && !isAdmin && isCoordAdmin && (
          <span className="text-xs text-muted-foreground">Somente admin pode cadastrar o CPF</span>
        )}
        {hasCpf && isCoordAdmin && (
          revealed ? (
            <Button size="sm" variant="ghost" className="h-7 px-2 gap-1" onClick={hide}>
              <EyeOff className="w-3.5 h-3.5" /> Ocultar
            </Button>
          ) : (
            <Button size="sm" variant="ghost" className="h-7 px-2 gap-1" onClick={reveal} disabled={loading}>
              <Eye className="w-3.5 h-3.5" /> {loading ? "..." : "Revelar"}
            </Button>
          )
        )}
        {hasCpf && isAdmin && revealed && (
          <Button size="sm" variant="ghost" className="h-7 px-2 gap-1" onClick={openEdit}>
            <Pencil className="w-3.5 h-3.5" /> Editar
          </Button>
        )}
      </div>
      {revealed && (
        <div className="mt-2 h-1 w-full bg-muted rounded-full overflow-hidden">
          <div className="h-full bg-primary transition-[width] duration-200 ease-linear" style={{ width: `${progress}%` }} />
        </div>
      )}

      <Dialog open={editing} onOpenChange={setEditing}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Editar CPF</DialogTitle>
          </DialogHeader>
          <div>
            <Label className="text-xs">CPF</Label>
            <Input
              value={editValue}
              onChange={(e) => setEditValue(formatCPF(e.target.value))}
              placeholder="000.000.000-00"
              className="font-mono"
            />
            <p className="text-xs text-muted-foreground mt-2">
              Esta alteração fica registrada no log de auditoria.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(false)}>Cancelar</Button>
            <Button onClick={saveEdit} disabled={saving}>{saving ? "Salvando..." : "Salvar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
