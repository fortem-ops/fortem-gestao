import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, ChevronUp, ChevronDown } from "lucide-react";
import {
  newQuestion,
  QUESTION_TYPE_LABELS,
  type ExperimentalSchema,
  type TemplateSection,
  type TemplateQuestion,
  type QuestionType,
  type OpcaoItem,
} from "./experimentalTemplate";

interface Props {
  value: ExperimentalSchema;
  onChange: (s: ExperimentalSchema) => void;
}

export function DynamicSchemaEditor({ value, onChange }: Props) {
  const schema = value;
  const setSchema = (s: ExperimentalSchema) => onChange(s);

  const updateSection = (idx: number, patch: Partial<TemplateSection>) => {
    const next = { ...schema, sections: [...schema.sections] };
    next.sections[idx] = { ...next.sections[idx], ...patch };
    setSchema(next);
  };
  const removeSection = (idx: number) =>
    setSchema({ ...schema, sections: schema.sections.filter((_, i) => i !== idx) });
  const addSection = () =>
    setSchema({ ...schema, sections: [...schema.sections, { id: crypto.randomUUID(), title: "Nova seção", questions: [] }] });
  const moveSection = (idx: number, dir: -1 | 1) => {
    const arr = [...schema.sections];
    const j = idx + dir;
    if (j < 0 || j >= arr.length) return;
    [arr[idx], arr[j]] = [arr[j], arr[idx]];
    setSchema({ ...schema, sections: arr });
  };

  const updateQuestion = (si: number, qi: number, patch: Partial<TemplateQuestion>) => {
    const sections = [...schema.sections];
    const qs = [...sections[si].questions];
    qs[qi] = { ...qs[qi], ...patch };
    sections[si] = { ...sections[si], questions: qs };
    setSchema({ ...schema, sections });
  };
  const removeQuestion = (si: number, qi: number) => {
    const sections = [...schema.sections];
    sections[si] = { ...sections[si], questions: sections[si].questions.filter((_, i) => i !== qi) };
    setSchema({ ...schema, sections });
  };
  const addQuestion = (si: number) => {
    const sections = [...schema.sections];
    sections[si] = { ...sections[si], questions: [...sections[si].questions, newQuestion()] };
    setSchema({ ...schema, sections });
  };
  const moveQuestion = (si: number, qi: number, dir: -1 | 1) => {
    const sections = [...schema.sections];
    const qs = [...sections[si].questions];
    const j = qi + dir;
    if (j < 0 || j >= qs.length) return;
    [qs[qi], qs[j]] = [qs[j], qs[qi]];
    sections[si] = { ...sections[si], questions: qs };
    setSchema({ ...schema, sections });
  };
  const changeType = (si: number, qi: number, type: QuestionType) => {
    const fresh = newQuestion(type);
    updateQuestion(si, qi, { type, options: fresh.options, detalheLabel: fresh.detalheLabel, labelSim: fresh.labelSim, labelNao: fresh.labelNao });
  };
  const updateOption = (si: number, qi: number, oi: number, patch: Partial<OpcaoItem>) => {
    const sections = [...schema.sections];
    const qs = [...sections[si].questions];
    const opts = [...(qs[qi].options ?? [])];
    opts[oi] = { ...opts[oi], ...patch };
    qs[qi] = { ...qs[qi], options: opts };
    sections[si] = { ...sections[si], questions: qs };
    setSchema({ ...schema, sections });
  };
  const addOption = (si: number, qi: number) => {
    const sections = [...schema.sections];
    const qs = [...sections[si].questions];
    const opts = [...(qs[qi].options ?? [])];
    opts.push({ value: `opcao_${opts.length + 1}`, label: `Opção ${opts.length + 1}` });
    qs[qi] = { ...qs[qi], options: opts };
    sections[si] = { ...sections[si], questions: qs };
    setSchema({ ...schema, sections });
  };
  const removeOption = (si: number, qi: number, oi: number) => {
    const sections = [...schema.sections];
    const qs = [...sections[si].questions];
    const opts = (qs[qi].options ?? []).filter((_, i) => i !== oi);
    qs[qi] = { ...qs[qi], options: opts };
    sections[si] = { ...sections[si], questions: qs };
    setSchema({ ...schema, sections });
  };

  return (
    <div className="space-y-4">
      {schema.sections.map((sec, si) => (
        <div key={sec.id} className="glass-card rounded-lg p-4 space-y-3">
          <div className="flex items-center gap-2">
            <Input
              value={sec.title}
              onChange={(e) => updateSection(si, { title: e.target.value })}
              placeholder="Título da seção"
              className="font-semibold"
            />
            <Button size="icon" variant="ghost" onClick={() => moveSection(si, -1)} disabled={si === 0}><ChevronUp className="w-4 h-4" /></Button>
            <Button size="icon" variant="ghost" onClick={() => moveSection(si, 1)} disabled={si === schema.sections.length - 1}><ChevronDown className="w-4 h-4" /></Button>
            <Button size="icon" variant="ghost" onClick={() => removeSection(si)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
          </div>

          <div className="space-y-3 pl-2 border-l-2 border-border/50">
            {sec.questions.map((q, qi) => (
              <div key={q.id} className="rounded-md border border-border/60 p-3 space-y-2 bg-background/30">
                <div className="flex items-start gap-2">
                  <AutoTextarea
                    value={q.label}
                    onChange={(v) => updateQuestion(si, qi, { label: v })}
                    placeholder="Texto da pergunta"
                  />
                  <Button size="icon" variant="ghost" onClick={() => moveQuestion(si, qi, -1)} disabled={qi === 0}><ChevronUp className="w-4 h-4" /></Button>
                  <Button size="icon" variant="ghost" onClick={() => moveQuestion(si, qi, 1)} disabled={qi === sec.questions.length - 1}><ChevronDown className="w-4 h-4" /></Button>
                  <Button size="icon" variant="ghost" onClick={() => removeQuestion(si, qi)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div>
                    <Label className="text-xs text-muted-foreground">Tipo</Label>
                    <Select value={q.type} onValueChange={(v) => changeType(si, qi, v as QuestionType)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {(Object.keys(QUESTION_TYPE_LABELS) as QuestionType[]).map((t) => (
                          <SelectItem key={t} value={t}>{QUESTION_TYPE_LABELS[t]}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {(q.type === "sim_nao_detalhe" || q.type === "sim_nao_numero") && (
                    <div>
                      <Label className="text-xs text-muted-foreground">Rótulo do campo (se Sim)</Label>
                      <Input value={q.detalheLabel || ""} onChange={(e) => updateQuestion(si, qi, { detalheLabel: e.target.value })} />
                    </div>
                  )}
                  {q.type === "sim_nao_dupla" && (
                    <>
                      <div>
                        <Label className="text-xs text-muted-foreground">Rótulo (Sim)</Label>
                        <Input value={q.labelSim || ""} onChange={(e) => updateQuestion(si, qi, { labelSim: e.target.value })} />
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground">Rótulo (Não)</Label>
                        <Input value={q.labelNao || ""} onChange={(e) => updateQuestion(si, qi, { labelNao: e.target.value })} />
                      </div>
                    </>
                  )}
                </div>

                {(q.type === "opcoes" || q.type === "opcoes_multi") && (
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">Opções de resposta</Label>
                    {(q.options ?? []).map((o, oi) => (
                      <div key={oi} className="flex items-center gap-2">
                        <Input
                          className="flex-1"
                          value={o.label}
                          onChange={(e) => updateOption(si, qi, oi, { label: e.target.value, value: o.value || slug(e.target.value) })}
                          placeholder="Texto da opção"
                        />
                        <Button size="icon" variant="ghost" onClick={() => removeOption(si, qi, oi)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                      </div>
                    ))}
                    <Button size="sm" variant="outline" onClick={() => addOption(si, qi)}><Plus className="w-3 h-3 mr-1" /> Adicionar opção</Button>
                  </div>
                )}
              </div>
            ))}
            <Button size="sm" variant="outline" onClick={() => addQuestion(si)}><Plus className="w-3 h-3 mr-1" /> Adicionar pergunta</Button>
          </div>
        </div>
      ))}

      <Button variant="outline" onClick={addSection}><Plus className="w-4 h-4 mr-1" /> Adicionar seção</Button>
    </div>
  );
}

function slug(s: string) {
  return s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "") || crypto.randomUUID().slice(0, 6);
}

function AutoTextarea({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      rows={2}
      className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-y"
    />
  );
}
