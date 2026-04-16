import { useState, useMemo } from "react";
import { classifyAngle, getClassificationColor } from "@/lib/mock-data";
import type { AssessmentClassification } from "@/lib/mock-data";
import type { Tables } from "@/integrations/supabase/types";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Save } from "lucide-react";
import { BodyDiagram } from "./assessment/BodyDiagram";

const functionalMetrics = [
  'Flexibilidade Posterior MMII',
  'Mobilidade Ombro RI',
  'Mobilidade Ombro RE',
  'Flexibilidade Psoas',
  'Flexibilidade Quadríceps',
  'Mobilidade Quadril RI',
  'Mobilidade Quadril RE',
  'Mobilidade Torácica',
  'Mobilidade Tornozelo',
];

function FunctionalAssessment() {
  const [values, setValues] = useState<Record<string, { left: string; right: string }>>({});
  const [notes, setNotes] = useState("");

  const handleChange = (metric: string, side: 'left' | 'right', val: string) => {
    setValues(prev => ({ ...prev, [metric]: { ...prev[metric], [side]: val } }));
  };

  const classifications = useMemo(() => {
    const result: Record<string, { left: AssessmentClassification | null; right: AssessmentClassification | null }> = {};
    functionalMetrics.forEach(metric => {
      const v = values[metric] || { left: '', right: '' };
      const leftNum = parseInt(v.left);
      const rightNum = parseInt(v.right);
      result[metric] = {
        left: !isNaN(leftNum) ? classifyAngle(metric, leftNum) : null,
        right: !isNaN(rightNum) ? classifyAngle(metric, rightNum) : null,
      };
    });
    return result;
  }, [values]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row gap-6">
        <div className="glass-card rounded-lg p-4 flex flex-col items-center justify-center lg:w-64 shrink-0">
          <h4 className="text-xs font-semibold text-muted-foreground mb-3 uppercase tracking-wider">Mapa Corporal</h4>
          <BodyDiagram classifications={classifications} />
        </div>

        <div className="glass-card rounded-lg overflow-hidden flex-1">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left text-xs font-medium text-muted-foreground p-3">Métrica</th>
                <th className="text-center text-xs font-medium text-muted-foreground p-3 w-20">Esquerdo</th>
                <th className="text-center text-xs font-medium text-muted-foreground p-3 w-24">Class. E</th>
                <th className="text-center text-xs font-medium text-muted-foreground p-3 w-20">Direito</th>
                <th className="text-center text-xs font-medium text-muted-foreground p-3 w-24">Class. D</th>
              </tr>
            </thead>
            <tbody>
              {functionalMetrics.map(metric => {
                const v = values[metric] || { left: '', right: '' };
                const leftNum = parseInt(v.left);
                const rightNum = parseInt(v.right);
                const leftClass = !isNaN(leftNum) ? classifyAngle(metric, leftNum) : null;
                const rightClass = !isNaN(rightNum) ? classifyAngle(metric, rightNum) : null;
                return (
                  <tr key={metric} className="border-b border-border/50">
                    <td className="p-3 text-sm text-foreground">{metric}</td>
                    <td className="p-3">
                      <Input type="number" className="w-16 text-center h-8 text-sm mx-auto" value={v.left} onChange={(e) => handleChange(metric, 'left', e.target.value)} placeholder="°" />
                    </td>
                    <td className="p-3 text-center">
                      {leftClass && <span className={`text-xs font-semibold ${getClassificationColor(leftClass)}`}>{leftClass}</span>}
                    </td>
                    <td className="p-3">
                      <Input type="number" className="w-16 text-center h-8 text-sm mx-auto" value={v.right} onChange={(e) => handleChange(metric, 'right', e.target.value)} placeholder="°" />
                    </td>
                    <td className="p-3 text-center">
                      {rightClass && <span className={`text-xs font-semibold ${getClassificationColor(rightClass)}`}>{rightClass}</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="glass-card rounded-lg p-4">
        <h4 className="text-sm font-semibold text-foreground mb-2">Observações do Avaliador</h4>
        <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Assimetrias, restrições, prioridades de intervenção..." rows={4} />
      </div>

      <Button><Save className="w-4 h-4 mr-2" /> Salvar Avaliação</Button>
    </div>
  );
}

const dobrasLabels = ['Peitoral', 'Axilar média', 'Tríceps', 'Subescapular', 'Abdominal', 'Supra-ilíaca', 'Coxa'];

function classifyBF(pct: number, sexo: 'M' | 'F'): { label: string; color: string } {
  if (sexo === 'M') {
    if (pct <= 6) return { label: 'Essencial', color: 'text-info' };
    if (pct <= 13) return { label: 'Excelente', color: 'text-primary' };
    if (pct <= 17) return { label: 'Bom', color: 'text-primary' };
    if (pct <= 24) return { label: 'Médio', color: 'text-warning' };
    return { label: 'Elevado', color: 'text-destructive' };
  }
  if (pct <= 13) return { label: 'Essencial', color: 'text-info' };
  if (pct <= 20) return { label: 'Excelente', color: 'text-primary' };
  if (pct <= 24) return { label: 'Bom', color: 'text-primary' };
  if (pct <= 31) return { label: 'Médio', color: 'text-warning' };
  return { label: 'Elevado', color: 'text-destructive' };
}

function BodyComposition() {
  const [sexo, setSexo] = useState<'M' | 'F'>('M');
  const [idade, setIdade] = useState('');
  const [peso, setPeso] = useState('');
  const [altura, setAltura] = useState('');
  const [dobras, setDobras] = useState<Record<string, string>>({});

  const results = useMemo(() => {
    const idadeNum = parseFloat(idade);
    const vals = dobrasLabels.map(d => parseFloat(dobras[d] || ''));
    if (isNaN(idadeNum) || vals.some(v => isNaN(v))) return null;
    const sigma7 = vals.reduce((a, b) => a + b, 0);
    let dc: number;
    if (sexo === 'M') dc = 1.112 - 0.00043499 * sigma7 + 0.00000055 * sigma7 * sigma7 - 0.00028826 * idadeNum;
    else dc = 1.097 - 0.00046971 * sigma7 + 0.00000056 * sigma7 * sigma7 - 0.00012828 * idadeNum;
    const bf = (495 / dc) - 450;
    const classification = classifyBF(bf, sexo);
    const pesoNum = parseFloat(peso);
    const alturaNum = parseFloat(altura);
    const imc = !isNaN(pesoNum) && !isNaN(alturaNum) && alturaNum > 0 ? pesoNum / ((alturaNum / 100) ** 2) : null;
    const massaMagra = !isNaN(pesoNum) ? pesoNum * (1 - bf / 100) : null;
    const massaGorda = !isNaN(pesoNum) ? pesoNum * (bf / 100) : null;
    return { sigma7, dc, bf, classification, imc, massaMagra, massaGorda };
  }, [sexo, idade, peso, altura, dobras]);

  return (
    <div className="space-y-6">
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

      <Button><Save className="w-4 h-4 mr-2" /> Salvar Avaliação</Button>
    </div>
  );
}

export function AssessmentForm({ student: _student }: { student: Tables<"alunos"> }) {
  return (
    <Tabs defaultValue="funcional">
      <TabsList className="bg-secondary/50 border border-border">
        <TabsTrigger value="funcional">Funcional</TabsTrigger>
        <TabsTrigger value="composicao">Composição Corporal</TabsTrigger>
        <TabsTrigger value="pliometria">Pliometria</TabsTrigger>
        <TabsTrigger value="forca">Força</TabsTrigger>
        <TabsTrigger value="experimental">Experimental</TabsTrigger>
        <TabsTrigger value="kinology">Kinology</TabsTrigger>
      </TabsList>

      <TabsContent value="funcional"><FunctionalAssessment /></TabsContent>
      <TabsContent value="composicao"><BodyComposition /></TabsContent>
      <TabsContent value="pliometria"><div className="glass-card rounded-lg p-6 text-center text-muted-foreground">Módulo de pliometria em desenvolvimento</div></TabsContent>
      <TabsContent value="forca"><div className="glass-card rounded-lg p-6 text-center text-muted-foreground">Módulo de força em desenvolvimento</div></TabsContent>
      <TabsContent value="experimental">
        <div className="glass-card rounded-lg p-6 text-center text-muted-foreground">
          <div className="space-y-4 text-left max-w-md mx-auto">
            {['Data', 'Avaliador', 'Classificação Inicial'].map(f => (
              <div key={f}><label className="text-xs text-muted-foreground">{f}</label><Input className="mt-1 h-8" /></div>
            ))}
            <div><label className="text-xs text-muted-foreground">Observações</label><Textarea rows={3} className="mt-1" /></div>
            <Button size="sm"><Save className="w-3 h-3 mr-1" /> Salvar</Button>
          </div>
        </div>
      </TabsContent>
      <TabsContent value="kinology">
        <div className="glass-card rounded-lg p-6 text-center text-muted-foreground">
          <p className="mb-4">Upload de PDF Kinology</p>
          <Button variant="outline" size="sm">Selecionar PDF</Button>
        </div>
      </TabsContent>
    </Tabs>
  );
}
