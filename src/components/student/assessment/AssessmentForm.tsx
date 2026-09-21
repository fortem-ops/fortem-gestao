import { useState, useMemo, useEffect, useRef } from "react";

/** Normaliza nome de protocolo (sem acento, minúsculo) para o pré-preenchimento. */
function normalizarNome(v: string | null | undefined): string {
  return (v ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase();
}

import { useQuery } from "@tanstack/react-query";
import type { Tables } from "@/integrations/supabase/types";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Save, FileDown, Loader2 } from "lucide-react";
import { exportAssessmentPDF } from "./exportAssessmentPDF";
import { DynamicAssessment } from "./DynamicAssessment";
import { ReabilitacaoEvolucao, isProtocoloEvolucao } from "./ReabilitacaoEvolucao";
import { fetchTipos, fetchProtocolos, type AvaliacaoTipo, type AvaliacaoProtocolo } from "@/lib/avaliacaoProtocolos";
import { invalidateAvaliacaoFuncional } from "@/lib/query-invalidation";
import type { ExperimentalSchema } from "./experimentalTemplate";
import { AvaliacaoAnexos } from "./AvaliacaoAnexos";
import { FuncionalV2Assessment } from "./funcionalV2/FuncionalV2Assessment";
import { AssessmentDateField, todayISO } from "@/components/avaliacoes-premium/AssessmentDateField";


// O antigo formulário funcional fixo (tipo `funcional`) foi aposentado:
// o tipo unificado é `funcional_v2` e o lançamento acontece no
// FuncionalV2Assessment, para onde o engine `funcional_fixo` também aponta.


import { DOBRAS_POLLOCK_7 as dobrasLabels, computePollock } from "@/lib/pollockCalculo";

function BodyComposition({ student, protocoloId, permiteUpload }: { student: Tables<"alunos">; protocoloId: string | null; permiteUpload: boolean }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [sexo, setSexo] = useState<'M' | 'F'>('M');
  const [idade, setIdade] = useState('');
  const [peso, setPeso] = useState('');
  const [altura, setAltura] = useState('');
  const [dobras, setDobras] = useState<Record<string, string>>({});
  const [dataAval, setDataAval] = useState<string>(todayISO());
  const [saving, setSaving] = useState(false);
  const [savedAvaliacaoId, setSavedAvaliacaoId] = useState<string | null>(null);

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

  const handleSave = async () => {
    if (!user) { toast.error("Usuário não autenticado"); return; }
    if (!results) { toast.error("Preencha todos os dados antes de salvar"); return; }
    setSaving(true);
    try {
      const { data: inserted, error } = await supabase.from("avaliacoes").insert({
        aluno_id: student.id,
        avaliador_id: user.id,
        tipo: "composicao_corporal",
        protocolo_id: protocoloId,
        data: dataAval || todayISO(),
        dados: {
          sexo, idade: parseFloat(idade), peso: parseFloat(peso), altura: parseFloat(altura),
          dobras, sigma7: results.sigma7, densidade: results.dc, percentual_gordura: results.bf,
          classificacao: results.classification.label, imc: results.imc,
          massa_magra: results.massaMagra, massa_gorda: results.massaGorda,
        },
      } as never).select().single();
      if (error) throw error;
      setSavedAvaliacaoId(inserted.id);
      toast.success("Composição corporal salva com sucesso");
      invalidateAvaliacaoFuncional(queryClient, student.id);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  };

  const handleExportPDF = () => {
    if (!results) { toast.error("Preencha todos os dados antes de exportar"); return; }
    exportAssessmentPDF({
      student,
      tipo: "Composição Corporal — Pollock 7 Dobras",
      rows: [
        { label: "Sexo", left: sexo === 'M' ? 'Masculino' : 'Feminino', leftClass: '', right: '', rightClass: '' },
        { label: "Idade", left: `${idade} anos`, leftClass: '', right: '', rightClass: '' },
        { label: "Peso", left: `${peso} kg`, leftClass: '', right: '', rightClass: '' },
        { label: "Altura", left: `${altura} cm`, leftClass: '', right: '', rightClass: '' },
        ...dobrasLabels.map(d => ({ label: `Dobra ${d}`, left: `${dobras[d]} mm`, leftClass: '', right: '', rightClass: '' })),
        { label: "Σ 7 Dobras", left: `${results.sigma7.toFixed(1)} mm`, leftClass: '', right: '', rightClass: '' },
        { label: "Densidade Corporal", left: results.dc.toFixed(4), leftClass: '', right: '', rightClass: '' },
        { label: "% Gordura", left: `${results.bf.toFixed(1)}%`, leftClass: results.classification.label, right: '', rightClass: '' },
        ...(results.imc !== null ? [{ label: "IMC", left: results.imc.toFixed(1), leftClass: '', right: '', rightClass: '' }] : []),
        ...(results.massaMagra !== null ? [{ label: "Massa Magra", left: `${results.massaMagra.toFixed(1)} kg`, leftClass: '', right: '', rightClass: '' }] : []),
        ...(results.massaGorda !== null ? [{ label: "Massa Gorda", left: `${results.massaGorda.toFixed(1)} kg`, leftClass: '', right: '', rightClass: '' }] : []),
      ],
    });
  };

  return (
    <div className="space-y-6">
      <div className="glass-card rounded-lg p-4">
        <AssessmentDateField value={dataAval} onChange={setDataAval} />
      </div>
      <div className="glass-card rounded-lg p-4">
        <h4 className="text-sm font-semibold text-foreground mb-3">Dados do Aluno</h4>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <label className="text-xs text-muted-foreground">Sexo</label>
            <div className="flex gap-2 mt-1">
              <Button size="sm" variant={sexo === 'M' ? 'default' : 'outline'} className="flex-1 h-8" onClick={() => setSexo('M')}>Masculino</Button>
              <Button size="sm" variant={sexo === 'F' ? 'default' : 'outline'} className="flex-1 h-8" onClick={() => setSexo('F')}>Feminino</Button>
            </div>
          </div>
          <div><label className="text-xs text-muted-foreground">Idade</label><Input type="number" className="mt-1 h-8" placeholder="anos" value={idade} onChange={e => setIdade(e.target.value)} /></div>
          <div><label className="text-xs text-muted-foreground">Peso (kg)</label><Input type="number" className="mt-1 h-8" placeholder="kg" value={peso} onChange={e => setPeso(e.target.value)} /></div>
          <div><label className="text-xs text-muted-foreground">Altura (cm)</label><Input type="number" className="mt-1 h-8" placeholder="cm" value={altura} onChange={e => setAltura(e.target.value)} /></div>
        </div>
      </div>

      <div className="glass-card rounded-lg p-4">
        <h4 className="text-sm font-semibold text-foreground mb-1">Protocolo de Pollock — 7 Dobras Cutâneas</h4>
        <p className="text-xs text-muted-foreground mb-3">Insira os valores em milímetros (mm)</p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {dobrasLabels.map((d, i) => (
            <div key={d}>
              <label className="text-xs text-muted-foreground">{i + 1}. {d}</label>
              <Input type="number" className="mt-1 h-8" placeholder="mm" value={dobras[d] || ''} onChange={e => setDobras(prev => ({ ...prev, [d]: e.target.value }))} />
            </div>
          ))}
        </div>
      </div>

      {results && (
        <div className="glass-card rounded-lg p-4">
          <h4 className="text-sm font-semibold text-foreground mb-3">Resultados</h4>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            <div className="text-center p-3 rounded-lg bg-secondary/30"><p className="text-xs text-muted-foreground">Σ7 Dobras</p><p className="text-lg font-bold text-foreground">{results.sigma7.toFixed(1)} <span className="text-xs font-normal">mm</span></p></div>
            <div className="text-center p-3 rounded-lg bg-secondary/30"><p className="text-xs text-muted-foreground">Densidade Corporal</p><p className="text-lg font-bold text-foreground">{results.dc.toFixed(4)}</p></div>
            <div className="text-center p-3 rounded-lg bg-secondary/30"><p className="text-xs text-muted-foreground">% Gordura</p><p className="text-lg font-bold text-foreground">{results.bf.toFixed(1)}%</p></div>
            <div className="text-center p-3 rounded-lg bg-secondary/30"><p className="text-xs text-muted-foreground">Classificação</p><p className={`text-lg font-bold ${results.classification.color}`}>{results.classification.label}</p></div>
            {results.imc !== null && <div className="text-center p-3 rounded-lg bg-secondary/30"><p className="text-xs text-muted-foreground">IMC</p><p className="text-lg font-bold text-foreground">{results.imc.toFixed(1)}</p></div>}
            {results.massaMagra !== null && <div className="text-center p-3 rounded-lg bg-secondary/30"><p className="text-xs text-muted-foreground">Massa Magra</p><p className="text-lg font-bold text-foreground">{results.massaMagra.toFixed(1)} <span className="text-xs font-normal">kg</span></p></div>}
          </div>
        </div>
      )}

      {permiteUpload && <AvaliacaoAnexos avaliacaoId={savedAvaliacaoId} />}

      <div className="flex flex-wrap gap-2">
        <Button onClick={handleSave} disabled={saving}>
          {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
          Salvar Avaliação
        </Button>
        <Button variant="outline" onClick={handleExportPDF}>
          <FileDown className="w-4 h-4 mr-2" /> Exportar PDF
        </Button>
      </div>
    </div>
  );
}

// Tipos cuja aplicação vive no módulo "Avaliações" (Premium) e por isso não
// aparecem em Técnico > Relatórios. Todos os demais tipos ativos — inclusive os
// criados em Administração > Relatórios — ficam disponíveis aqui.
const ENGINES_EXCLUIDAS_LEGADO = ["funcional_v2", "composicao_pollock"];

export function AssessmentForm({
  student,
  tipoSlugInicial,
  protocoloNomeInicial,
}: {
  student: Tables<"alunos">;
  /** Pré-seleciona o tipo pelo slug (ex.: vindo de uma tarefa). */
  tipoSlugInicial?: string | null;
  /** Pré-seleciona o protocolo pelo nome/prefixo (ex.: "evolucao"). */
  protocoloNomeInicial?: string | null;
}) {
  const { data: tipos = [], isLoading: loadingTipos } = useQuery({
    queryKey: ["avaliacao-tipos"],
    queryFn: fetchTipos,
  });
  const tiposAtivos = useMemo(
    () => tipos.filter((t) => t.ativo && !ENGINES_EXCLUIDAS_LEGADO.includes(t.engine)),
    [tipos],
  );

  const [tipoId, setTipoId] = useState<string>("");
  const [protocoloId, setProtocoloId] = useState<string>("");
  const prefillProtocoloAplicado = useRef(false);

  useEffect(() => {
    if (tipoId || !tiposAtivos.length) return;
    const porSlug = tipoSlugInicial
      ? tiposAtivos.find((t) => t.slug === tipoSlugInicial)
      : null;
    setTipoId((porSlug ?? tiposAtivos[0]).id);
  }, [tipoId, tiposAtivos, tipoSlugInicial]);

  const tipoSel = tiposAtivos.find((t) => t.id === tipoId) ?? null;

  const { data: protocolos = [] } = useQuery({
    queryKey: ["avaliacao-protocolos", tipoId],
    enabled: !!tipoId,
    queryFn: () => fetchProtocolos(tipoId),
  });
  const protocolosAtivos = useMemo(() => protocolos.filter((p) => p.ativo), [protocolos]);

  useEffect(() => {
    if (!protocolosAtivos.length) { setProtocoloId(""); return; }
    if (
      protocoloNomeInicial &&
      !prefillProtocoloAplicado.current &&
      tipoSel?.slug === tipoSlugInicial
    ) {
      const alvo = protocolosAtivos.find((p) =>
        normalizarNome(p.nome).startsWith(normalizarNome(protocoloNomeInicial)),
      );
      if (alvo) {
        prefillProtocoloAplicado.current = true;
        setProtocoloId(alvo.id);
        return;
      }
    }
    if (!protocolosAtivos.find((p) => p.id === protocoloId)) {
      const def = protocolosAtivos.find((p) => p.is_default) ?? protocolosAtivos[0];
      setProtocoloId(def.id);
    }
  }, [protocolosAtivos, protocoloId, protocoloNomeInicial, tipoSel, tipoSlugInicial]);


  const protoSel = protocolosAtivos.find((p) => p.id === protocoloId) ?? null;

  if (loadingTipos) {
    return <div className="glass-card rounded-lg p-6 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="space-y-4">
      <div className="glass-card rounded-lg p-4 grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <Label className="text-xs text-muted-foreground">Tipo</Label>
          <Select value={tipoId} onValueChange={setTipoId}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {tiposAtivos.map((t) => (<SelectItem key={t.id} value={t.id}>{t.nome}</SelectItem>))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs text-muted-foreground">Categoria</Label>
          <Select value={protocoloId} onValueChange={setProtocoloId} disabled={protocolosAtivos.length === 0}>
            <SelectTrigger><SelectValue placeholder={protocolosAtivos.length ? "Selecione" : "Nenhum protocolo"} /></SelectTrigger>
            <SelectContent>
              {protocolosAtivos.map((p) => (
                <SelectItem key={p.id} value={p.id}>{p.nome}{p.is_default ? " (padrão)" : ""}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {protoSel?.descricao && <p className="text-[11px] text-muted-foreground mt-1">{protoSel.descricao}</p>}
        </div>
      </div>

      {tipoSel ? (
        <EngineDispatcher student={student} tipo={tipoSel} protocolo={protoSel} />
      ) : (
        <div className="glass-card rounded-lg p-6 text-center text-sm text-muted-foreground">
          Nenhum tipo de avaliação configurado. Acesse Admin → Tipos de Avaliação.
        </div>
      )}
    </div>
  );
}

function EngineDispatcher({ student, tipo, protocolo }: { student: Tables<"alunos">; tipo: AvaliacaoTipo; protocolo: AvaliacaoProtocolo | null }) {
  const permiteUpload = !!protocolo?.permite_upload;
  // Engine antigo `funcional_fixo` foi unificado no lançamento funcional v2.
  if (tipo.engine === "funcional_fixo" || tipo.engine === "funcional_v2") {
    return <FuncionalV2Assessment student={student} protocoloId={protocolo?.id ?? null} permiteUpload={permiteUpload} />;
  }

  if (tipo.engine === "funcional_v2") {
    return <FuncionalV2Assessment student={student} protocoloId={protocolo?.id ?? null} permiteUpload={permiteUpload} />;
  }
  if (tipo.engine === "composicao_pollock") {
    return <BodyComposition student={student} protocoloId={protocolo?.id ?? null} permiteUpload={permiteUpload} />;
  }
  // dinamico
  if (!protocolo) {
    return <div className="glass-card rounded-lg p-6 text-center text-sm text-muted-foreground">Selecione um protocolo para começar.</div>;
  }
  const schema = (protocolo.schema as ExperimentalSchema) ?? { sections: [] };
  if (tipo.slug === "reabilitacao" && isProtocoloEvolucao(protocolo.nome)) {
    return (
      <ReabilitacaoEvolucao
        key={protocolo.id}
        student={student}
        tipoId={tipo.id}
        tipoSlug={tipo.slug}
        protocoloId={protocolo.id}
        schema={schema}
        permiteUpload={permiteUpload}
      />
    );
  }
  return (
    <DynamicAssessment
      key={protocolo.id}
      student={student}
      tipoSlug={tipo.slug}
      protocoloId={protocolo.id}
      schema={schema}
      permiteUpload={permiteUpload}
    />
  );
}
