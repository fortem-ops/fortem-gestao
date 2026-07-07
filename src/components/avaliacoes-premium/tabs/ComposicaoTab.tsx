import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import { LineChart, Line, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid, Bar, BarChart } from "recharts";
import { format, parseISO } from "date-fns";
import type { ComposicaoSnapshot } from "../useAlunoAvaliacoesConsolidadas";
import { AssessmentDateField, todayISO } from "../AssessmentDateField";
import { DOBRAS_POLLOCK_7, computePollock } from "@/lib/pollockCalculo";
import { fetchDefaultProtocoloByTipoSlug } from "@/lib/avaliacaoProtocolos";

interface Props {
  alunoId: string;
  latest: ComposicaoSnapshot | null;
  history: ComposicaoSnapshot[];
}

export function ComposicaoTab({ alunoId, latest, history }: Props) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [sexo, setSexo] = useState<"M" | "F">("M");
  const [idade, setIdade] = useState("");
  const [peso, setPeso] = useState("");
  const [altura, setAltura] = useState("");
  const [dobras, setDobras] = useState<Record<string, string>>({});
  const [dataAval, setDataAval] = useState<string>(todayISO());
  const [saving, setSaving] = useState(false);

  const results = useMemo(
    () =>
      computePollock({
        sexo,
        idade: parseFloat(idade),
        peso: parseFloat(peso),
        altura: parseFloat(altura),
        dobras,
      }),
    [sexo, idade, peso, altura, dobras],
  );

  async function handleSave() {
    if (!user) {
      toast.error("Usuário não autenticado");
      return;
    }
    if (!results) {
      toast.error("Preencha idade e todas as 7 dobras antes de salvar");
      return;
    }
    setSaving(true);
    try {
      const protocolo = await fetchDefaultProtocoloByTipoSlug("composicao_corporal");
      const { error } = await supabase.from("avaliacoes").insert({
        aluno_id: alunoId,
        avaliador_id: user.id,
        tipo: "composicao_corporal",
        protocolo_id: protocolo?.id ?? null,
        data: dataAval || todayISO(),
        dados: {
          sexo,
          idade: parseFloat(idade),
          peso: parseFloat(peso),
          altura: parseFloat(altura),
          dobras,
          sigma7: results.sigma7,
          densidade: results.dc,
          percentual_gordura: results.bf,
          classificacao: results.classification.label,
          imc: results.imc,
          massa_magra: results.massaMagra,
          massa_gorda: results.massaGorda,
        },
      } as never);
      if (error) throw error;
      toast.success("Composição corporal salva com sucesso");
      setDobras({});
      setDataAval(todayISO());
      qc.invalidateQueries({ queryKey: ["aluno-avaliacoes-consolidadas", alunoId] });
      qc.invalidateQueries({ queryKey: ["avaliacoes-aluno", alunoId] });
      qc.invalidateQueries({ queryKey: ["avaliacoes-global", alunoId] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  }

  const evol = useMemo(
    () =>
      [...history].reverse().map((c) => ({
        data: format(parseISO(c.data), "dd/MM/yy"),
        gordura: Number(c.bf.toFixed(1)),
        magra: c.massaMagra ? Number(c.massaMagra.toFixed(1)) : null,
        peso: c.peso,
      })),
    [history],
  );

  const dobrasArr = latest
    ? Object.entries(latest.dobras).map(([k, v]) => ({ name: k, valor: Number(v) }))
    : [];

  return (
    <div className="space-y-5">
      {/* ============ FORMULÁRIO ============ */}
      <div className="bio-card p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="bio-heading text-base">Nova avaliação — Pollock 7 Dobras</h3>
        </div>

        <AssessmentDateField value={dataAval} onChange={setDataAval} />

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div>
            <label className="text-xs text-white/60">Sexo</label>
            <div className="flex gap-2 mt-1">
              <Button
                size="sm"
                variant={sexo === "M" ? "default" : "outline"}
                className="flex-1 h-8"
                onClick={() => setSexo("M")}
              >
                Masculino
              </Button>
              <Button
                size="sm"
                variant={sexo === "F" ? "default" : "outline"}
                className="flex-1 h-8"
                onClick={() => setSexo("F")}
              >
                Feminino
              </Button>
            </div>
          </div>
          <div>
            <label className="text-xs text-white/60">Idade</label>
            <Input
              type="number"
              className="mt-1 h-8"
              placeholder="anos"
              value={idade}
              onChange={(e) => setIdade(e.target.value)}
            />
          </div>
          <div>
            <label className="text-xs text-white/60">Peso (kg)</label>
            <Input
              type="number"
              className="mt-1 h-8"
              placeholder="kg"
              value={peso}
              onChange={(e) => setPeso(e.target.value)}
            />
          </div>
          <div>
            <label className="text-xs text-white/60">Altura (cm)</label>
            <Input
              type="number"
              className="mt-1 h-8"
              placeholder="cm"
              value={altura}
              onChange={(e) => setAltura(e.target.value)}
            />
          </div>
        </div>

        <div>
          <p className="text-xs text-white/60 mb-2">Dobras cutâneas (mm)</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {DOBRAS_POLLOCK_7.map((d, i) => (
              <div key={d}>
                <label className="text-xs text-white/60">
                  {i + 1}. {d}
                </label>
                <Input
                  type="number"
                  className="mt-1 h-8"
                  placeholder="mm"
                  value={dobras[d] || ""}
                  onChange={(e) =>
                    setDobras((prev) => ({ ...prev, [d]: e.target.value }))
                  }
                />
              </div>
            ))}
          </div>
        </div>

        {results && (
          <div className="grid grid-cols-2 md:grid-cols-6 gap-2 pt-2">
            <ResumoCell label="Σ 7 Dobras" value={`${results.sigma7.toFixed(1)} mm`} />
            <ResumoCell label="Densidade" value={results.dc.toFixed(4)} />
            <ResumoCell
              label="% Gordura"
              value={`${results.bf.toFixed(1)}%`}
              sub={results.classification.label}
            />
            <ResumoCell label="IMC" value={results.imc ? results.imc.toFixed(1) : "—"} />
            <ResumoCell
              label="Massa Magra"
              value={results.massaMagra ? `${results.massaMagra.toFixed(1)} kg` : "—"}
            />
            <ResumoCell
              label="Massa Gorda"
              value={results.massaGorda ? `${results.massaGorda.toFixed(1)} kg` : "—"}
            />
          </div>
        )}

        <div className="flex justify-end">
          <Button onClick={handleSave} disabled={saving || !results}>
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Salvando...
              </>
            ) : (
              <>
                <Save className="w-4 h-4 mr-2" /> Salvar composição
              </>
            )}
          </Button>
        </div>
      </div>

      {/* ============ HISTÓRICO ============ */}
      {!latest ? (
        <div className="bio-card p-6 text-center text-white/55 text-sm">
          Nenhuma composição corporal (Pollock) registrada ainda.
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="bio-card p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="bio-heading text-base">Composição Atual</h3>
              <span className="bio-label">{format(parseISO(latest.data), "dd/MM/yyyy")}</span>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <Stat label="% Gordura" value={`${latest.bf.toFixed(1)}%`} sub={latest.classificacao} tone="warn" />
              <Stat label="Massa Magra" value={latest.massaMagra ? `${latest.massaMagra.toFixed(1)} kg` : "—"} tone="good" />
              <Stat label="Massa Gorda" value={latest.massaGorda ? `${latest.massaGorda.toFixed(1)} kg` : "—"} tone="risk" />
              <Stat label="IMC" value={latest.imc ? latest.imc.toFixed(1) : "—"} />
              <Stat label="Peso" value={`${latest.peso} kg`} />
              <Stat label="Σ 7 Dobras" value={`${latest.sigma7.toFixed(1)} mm`} />
            </div>
          </div>

          <div className="bio-card p-5">
            <h3 className="bio-heading text-base mb-3">Distribuição das Dobras (mm)</h3>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={dobrasArr}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(0 0% 100% / 0.06)" />
                <XAxis dataKey="name" stroke="hsl(0 0% 100% / 0.4)" tick={{ fontSize: 10 }} />
                <YAxis stroke="hsl(0 0% 100% / 0.4)" tick={{ fontSize: 11 }} />
                <Tooltip contentStyle={{ background: "hsl(220 18% 12%)", border: "1px solid hsl(0 0% 100% / 0.1)", borderRadius: 8 }} />
                <Bar dataKey="valor" fill="hsl(var(--sev-attention))" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {evol.length >= 2 && (
            <div className="bio-card p-5 lg:col-span-2">
              <h3 className="bio-heading text-base mb-3">Evolução</h3>
              <ResponsiveContainer width="100%" height={260}>
                <LineChart data={evol}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(0 0% 100% / 0.06)" />
                  <XAxis dataKey="data" stroke="hsl(0 0% 100% / 0.4)" tick={{ fontSize: 11 }} />
                  <YAxis stroke="hsl(0 0% 100% / 0.4)" tick={{ fontSize: 11 }} />
                  <Tooltip contentStyle={{ background: "hsl(220 18% 12%)", border: "1px solid hsl(0 0% 100% / 0.1)", borderRadius: 8 }} />
                  <Line type="monotone" dataKey="gordura" name="% Gordura" stroke="hsl(var(--sev-attention))" strokeWidth={2} />
                  <Line type="monotone" dataKey="magra" name="Massa Magra (kg)" stroke="hsl(var(--sev-good))" strokeWidth={2} />
                  <Line type="monotone" dataKey="peso" name="Peso (kg)" stroke="hsl(var(--sev-medium))" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ResumoCell({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-lg bg-white/5 border border-white/5 p-2 text-center">
      <p className="text-[10px] uppercase tracking-wide text-white/50">{label}</p>
      <p className="text-sm bio-heading text-white/90 mt-0.5">{value}</p>
      {sub && <p className="text-[10px] text-white/50">{sub}</p>}
    </div>
  );
}

function Stat({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: "good" | "warn" | "risk" }) {
  const toneCls = tone === "good" ? "text-emerald-300" : tone === "warn" ? "text-amber-300" : tone === "risk" ? "text-rose-300" : "text-white/90";
  return (
    <div className="rounded-lg bg-white/5 border border-white/5 p-3 text-center">
      <p className="bio-label">{label}</p>
      <p className={`text-lg bio-heading mt-1 ${toneCls}`}>{value}</p>
      {sub && <p className="text-[10px] text-white/50 mt-0.5">{sub}</p>}
    </div>
  );
}
