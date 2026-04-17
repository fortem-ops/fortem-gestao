import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dumbbell, Library, ArrowLeft, Flame, ListChecks } from "lucide-react";
import { WORKOUT_TEMPLATES, CATEGORY_LABELS, type WorkoutTemplate, type WorkoutExercise } from "@/components/student/workout/workoutTemplates";

const PHASE_GROUPS = [
  { label: "Fases", filter: (t: WorkoutTemplate) => /^Fase \d/.test(t.fase) },
  { label: "Métodos", filter: (t: WorkoutTemplate) => ["Personalizado", "Planilha 5RM", "5-3-1", "M102"].includes(t.fase) },
  { label: "Corrida", filter: (t: WorkoutTemplate) => t.fase.startsWith("Corrida") },
];

function ExerciseTable({ exercicios, showDays }: { exercicios: WorkoutExercise[]; showDays?: boolean }) {
  if (exercicios.length === 0) {
    return <p className="text-sm text-muted-foreground italic">Sem exercícios cadastrados.</p>;
  }
  return (
    <div className="rounded-lg border border-border overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-12">#</TableHead>
            <TableHead className="w-24">Categoria</TableHead>
            <TableHead>Exercício</TableHead>
            <TableHead className="w-20 text-center">Séries</TableHead>
            <TableHead className="w-24 text-center">Reps</TableHead>
            {showDays && <TableHead className="w-32 text-center">Dias</TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {exercicios.map((ex, i) => (
            <TableRow key={i}>
              <TableCell className="font-mono text-xs text-muted-foreground">{ex.ordem}</TableCell>
              <TableCell>
                <Badge variant="outline" className="text-xs">{ex.categoria}</Badge>
              </TableCell>
              <TableCell className="text-sm">
                {ex.exercicio || <span className="text-muted-foreground italic">A definir</span>}
              </TableCell>
              <TableCell className="text-center text-sm">{ex.series}</TableCell>
              <TableCell className="text-center text-sm">{ex.repeticoes}</TableCell>
              {showDays && (
                <TableCell className="text-center">
                  <div className="flex gap-1 justify-center flex-wrap">
                    {(ex.dias || []).map(d => (
                      <Badge key={d} variant="secondary" className="text-[10px] px-1.5 py-0">{d}</Badge>
                    ))}
                  </div>
                </TableCell>
              )}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function TemplateDetail({ template, onBack }: { template: WorkoutTemplate; onBack: () => void }) {
  const blocks = ["LIB", "MOB", "ATI"] as const;
  const blockLabels: Record<string, string> = { LIB: "Liberação", MOB: "Mobilidade", ATI: "Ativação" };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={onBack}>
          <ArrowLeft className="h-4 w-4 mr-2" /> Voltar
        </Button>
        <div>
          <h2 className="text-2xl font-bold">{template.fase}</h2>
          <p className="text-sm text-muted-foreground">Frequência: {template.frequencia}</p>
        </div>
      </div>

      {template.aquecimento.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Flame className="h-5 w-5 text-warning" /> Aquecimento
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {blocks.map(block => {
              const items = template.aquecimento.filter(e => e.categoria === block);
              if (items.length === 0) return null;
              return (
                <div key={block} className="space-y-2">
                  <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                    {blockLabels[block]} ({block})
                  </h4>
                  <ExerciseTable exercicios={items} showDays />
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <ListChecks className="h-5 w-5 text-primary" /> Treinos
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue={template.treinos[0]?.nome}>
            <TabsList className="flex-wrap h-auto">
              {template.treinos.map(t => (
                <TabsTrigger key={t.nome} value={t.nome}>{t.nome}</TabsTrigger>
              ))}
            </TabsList>
            {template.treinos.map(t => {
              const block1 = t.exercicios.filter(e => e.ordem <= 2);
              const block2 = t.exercicios.filter(e => e.ordem >= 3);
              return (
                <TabsContent key={t.nome} value={t.nome} className="space-y-4 mt-4">
                  {block1.length > 0 && (
                    <div className="space-y-2">
                      <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Bloco 1 (Principais)</h4>
                      <ExerciseTable exercicios={block1} />
                    </div>
                  )}
                  {block2.length > 0 && (
                    <div className="space-y-2">
                      <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Bloco 2 (Acessórios)</h4>
                      <ExerciseTable exercicios={block2} />
                    </div>
                  )}
                </TabsContent>
              );
            })}
          </Tabs>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Legenda de Categorias</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-xs">
            {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
              <div key={key} className="flex items-center gap-2">
                <Badge variant="outline" className="font-mono">{key}</Badge>
                <span className="text-muted-foreground">{label}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function BancoTreinos() {
  const [selected, setSelected] = useState<WorkoutTemplate | null>(null);

  if (selected) {
    return (
      <div className="container mx-auto p-6 max-w-6xl">
        <TemplateDetail template={selected} onBack={() => setSelected(null)} />
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 max-w-6xl animate-fade-in">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 rounded-lg bg-primary/10">
          <Library className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h1 className="text-3xl font-bold">Banco de Treinos</h1>
          <p className="text-sm text-muted-foreground">
            Modelos base usados na prescrição de treinos para alunos
          </p>
        </div>
      </div>

      <div className="space-y-8">
        {PHASE_GROUPS.map(group => {
          const items = WORKOUT_TEMPLATES.filter(group.filter);
          if (items.length === 0) return null;
          return (
            <section key={group.label}>
              <h2 className="text-lg font-semibold mb-3 text-muted-foreground uppercase tracking-wide">
                {group.label}
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {items.map(template => (
                  <Card
                    key={template.fase}
                    className="cursor-pointer hover:border-primary transition-colors group"
                    onClick={() => setSelected(template)}
                  >
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div className="p-2 rounded-lg bg-primary/10 group-hover:bg-primary/20 transition-colors">
                          <Dumbbell className="h-5 w-5 text-primary" />
                        </div>
                        <Badge variant="outline">{template.frequencia}</Badge>
                      </div>
                      <CardTitle className="text-lg mt-3">{template.fase}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center justify-between text-sm text-muted-foreground">
                        <span>{template.treinos.length} treinos</span>
                        <span>
                          {template.treinos.reduce((acc, t) => acc + t.exercicios.length, 0)} exercícios
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
