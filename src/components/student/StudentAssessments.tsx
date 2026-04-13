import { useState } from "react";
import { type Student, classifyAngle, getClassificationColor } from "@/lib/mock-data";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Save } from "lucide-react";

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
    setValues(prev => ({
      ...prev,
      [metric]: { ...prev[metric], [side]: val },
    }));
  };

  return (
    <div className="space-y-6">
      <div className="glass-card rounded-lg overflow-hidden">
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
                    <Input
                      type="number"
                      className="w-16 text-center h-8 text-sm mx-auto"
                      value={v.left}
                      onChange={(e) => handleChange(metric, 'left', e.target.value)}
                      placeholder="°"
                    />
                  </td>
                  <td className="p-3 text-center">
                    {leftClass && (
                      <span className={`text-xs font-semibold ${getClassificationColor(leftClass)}`}>{leftClass}</span>
                    )}
                  </td>
                  <td className="p-3">
                    <Input
                      type="number"
                      className="w-16 text-center h-8 text-sm mx-auto"
                      value={v.right}
                      onChange={(e) => handleChange(metric, 'right', e.target.value)}
                      placeholder="°"
                    />
                  </td>
                  <td className="p-3 text-center">
                    {rightClass && (
                      <span className={`text-xs font-semibold ${getClassificationColor(rightClass)}`}>{rightClass}</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="glass-card rounded-lg p-4">
        <h4 className="text-sm font-semibold text-foreground mb-2">Observações do Avaliador</h4>
        <Textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Assimetrias, restrições, prioridades de intervenção..."
          rows={4}
        />
      </div>

      <Button><Save className="w-4 h-4 mr-2" /> Salvar Avaliação</Button>
    </div>
  );
}

function BodyComposition() {
  return (
    <div className="glass-card rounded-lg p-4 space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {['Peso (kg)', 'Altura (cm)', 'IMC', '% Gordura', 'Massa Magra (kg)', 'Dobras Cutâneas'].map(field => (
          <div key={field}>
            <label className="text-xs text-muted-foreground">{field}</label>
            <Input type="number" placeholder="—" className="mt-1 h-8" />
          </div>
        ))}
      </div>
      <Button size="sm"><Save className="w-3 h-3 mr-1" /> Salvar</Button>
    </div>
  );
}

export function StudentAssessments({ student }: { student: Student }) {
  return (
    <div className="space-y-4 mt-4">
      <h3 className="font-heading font-semibold text-foreground">Avaliações</h3>

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
        <TabsContent value="pliometria">
          <div className="glass-card rounded-lg p-6 text-center text-muted-foreground">Módulo de pliometria em desenvolvimento</div>
        </TabsContent>
        <TabsContent value="forca">
          <div className="glass-card rounded-lg p-6 text-center text-muted-foreground">Módulo de força em desenvolvimento</div>
        </TabsContent>
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
    </div>
  );
}
