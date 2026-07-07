import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Save, Loader2, Zap, Gauge, Timer, Activity, Sparkles } from "lucide-react";
import { format, parseISO } from "date-fns";
import type { PliometriaSnapshot } from "../useAlunoAvaliacoesConsolidadas";
import { AssessmentDateField, todayISO } from "../AssessmentDateField";

interface Props {
  alunoId: string;
  latest: PliometriaSnapshot | null;
  history: PliometriaSnapshot[];
}

const FIELDS = [
  { key: "salto_vertical", label: "Salto vertical", unit: "cm", icon: Zap },
  { key: "salto_horizontal", label: "Salto horizontal", unit: "cm", icon: Zap },
  { key: "rsi", label: "RSI", unit: "", icon: Activity },
  { key: "tempo_contato", label: "Tempo de contato", unit: "ms", icon: Timer },
  { key: "potencia", label: "Potência", unit: "W", icon: Gauge },
  { key: "stiffness", label: "Stiffness", unit: "kN/m", icon: Activity },
  { key: "assimetria", label: "Assimetria", unit: "%", icon: Sparkles },
] as const;

type Field = (typeof FIELDS)[number]["key"];

export function PliometriaTab({ alunoId, latest, history }: Props) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [values, setValues] = useState<Record<Field, string>>({
    salto_vertical: "",
    salto_horizontal: "",
    rsi: "",
    tempo_contato: "",
    potencia: "",
    stiffness: "",
    assimetria: "",
  });
  const [obs, setObs] = useState("");
  const [data, setData] = useState<string>(todayISO());
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (!user) return toast.error("Usuário não autenticado.");
    const numericVals: Partial<Record<Field, number>> = {};
    let hasAny = false;
    (Object.keys(values) as Field[]).forEach((k) => {
      const n = parseFloat(values[k]);
      if (!isNaN(n)) {
        numericVals[k] = n;
        hasAny = true;
      }
    });
    if (!hasAny) return toast.error("Preencha ao menos um valor.");
    setSaving(true);
    try {
      const { data: aval, error } = await supabase
        .from("avaliacoes")
        .insert({
          aluno_id: alunoId,
          avaliador_id: user.id,
          tipo: "pliometria",
          observacoes: obs || null,
          dados: numericVals,
        } as never)
        .select()
        .single();
      if (error) throw error;

      // Best-effort write na tabela dedicada se ela existir.
      try {
        await supabase.from("avaliacao_pliometria" as never).insert({
          avaliacao_id: aval.id,
          ...numericVals,
          observacoes: obs || null,
        } as never);
      } catch { /* tabela pode ainda não estar provisionada */ }

      toast.success("Pliometria registrada com sucesso.");
      setValues({
        salto_vertical: "",
        salto_horizontal: "",
        rsi: "",
        tempo_contato: "",
        potencia: "",
        stiffness: "",
        assimetria: "",
      });
      setObs("");
      qc.invalidateQueries({ queryKey: ["aluno-avaliacoes-consolidadas", alunoId] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao salvar.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      {/* Resumo último resultado */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-2">
        {FIELDS.map((f) => {
          const Icon = f.icon;
          const v = latest ? (latest[f.key] as number | null) : null;
          return (
            <div key={f.key} className="bio-card p-3">
              <div className="flex items-center justify-between">
                <Icon className="w-3.5 h-3.5 text-white/50" />
                <span className="bio-label">{f.unit}</span>
              </div>
              <p className="text-[10px] uppercase tracking-wider text-white/55 mt-2 truncate">{f.label}</p>
              <p className="text-lg bio-heading text-white/90">
                {v !== null && v !== undefined ? v : "—"}
              </p>
            </div>
          );
        })}
      </div>

      {/* Formulário */}
      <div className="bio-card p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="bio-heading text-base">Registrar nova avaliação de pliometria</h3>
          {latest && (
            <span className="bio-label">
              Última: {format(parseISO(latest.data), "dd/MM/yyyy")}
            </span>
          )}
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {FIELDS.map((f) => (
            <div key={f.key}>
              <Label className="text-xs text-white/65">{f.label} {f.unit && <span className="text-white/40">({f.unit})</span>}</Label>
              <Input
                type="number"
                inputMode="decimal"
                value={values[f.key]}
                onChange={(e) => setValues((p) => ({ ...p, [f.key]: e.target.value }))}
                className="mt-1 h-9 bg-white/5 border-white/10 text-white"
              />
            </div>
          ))}
        </div>
        <div>
          <Label className="text-xs text-white/65">Observações</Label>
          <Textarea value={obs} onChange={(e) => setObs(e.target.value)} rows={2} className="mt-1 bg-white/5 border-white/10 text-white" />
        </div>
        <div className="flex justify-end">
          <Button onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
            Salvar Pliometria
          </Button>
        </div>
      </div>

      {/* Histórico */}
      {history.length > 0 && (
        <div className="bio-card overflow-hidden">
          <div className="px-5 py-3 border-b border-white/5">
            <h3 className="bio-heading text-base">Histórico</h3>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-white/55 text-xs">
                <th className="text-left p-3 font-medium">Data</th>
                {FIELDS.map((f) => (
                  <th key={f.key} className="text-center p-3 font-medium">{f.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {history.map((s, i) => (
                <tr key={i} className="border-t border-white/5">
                  <td className="p-3 text-white/75">{format(parseISO(s.data), "dd/MM/yyyy")}</td>
                  {FIELDS.map((f) => (
                    <td key={f.key} className="p-3 text-center text-white/75">
                      {(s[f.key] as number | null) ?? "—"}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
