import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { UserPlus, Dumbbell, Loader2, ArrowLeft } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { Tables } from "@/integrations/supabase/types";
import { StudentPicker } from "@/components/student/StudentPicker";
import { PersonalizadoEditor } from "./PersonalizadoEditor";
import { personalizadoFromFlat } from "./personalizadoTypes";

type Treino = Tables<"treinos">;

interface Props {
  alunoId: string;
  onSaved?: () => void;
}

export function ImportFromStudentDialog({ alunoId, onSaved }: Props) {
  const [open, setOpen] = useState(false);
  const [sourceAlunoId, setSourceAlunoId] = useState("");
  const [selectedTreino, setSelectedTreino] = useState<Treino | null>(null);

  const { data: destinoAluno } = useQuery({
    queryKey: ["aluno-nome", alunoId],
    enabled: open,
    queryFn: async () => {
      const { data } = await supabase
        .from("alunos")
        .select("id, nome")
        .eq("id", alunoId)
        .maybeSingle();
      return data;
    },
  });

  const { data: sourceAluno } = useQuery({
    queryKey: ["aluno-nome", sourceAlunoId],
    enabled: open && !!sourceAlunoId,
    queryFn: async () => {
      const { data } = await supabase
        .from("alunos")
        .select("id, nome")
        .eq("id", sourceAlunoId)
        .maybeSingle();
      return data;
    },
  });

  const { data: treinos = [], isLoading: loadingTreinos } = useQuery({
    queryKey: ["treinos-source", sourceAlunoId],
    enabled: open && !!sourceAlunoId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("treinos")
        .select("*")
        .eq("aluno_id", sourceAlunoId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Treino[];
    },
  });

  const initial = useMemo(
    () => (selectedTreino ? personalizadoFromFlat(selectedTreino.conteudo) : null),
    [selectedTreino],
  );

  const handleClose = () => {
    setOpen(false);
    setSourceAlunoId("");
    setSelectedTreino(null);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) {
          setSourceAlunoId("");
          setSelectedTreino(null);
        }
      }}
    >
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <UserPlus className="w-4 h-4 mr-1" /> Importar de Aluno
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        {!selectedTreino ? (
          <>
            <DialogHeader>
              <DialogTitle>Importar treino de outro aluno</DialogTitle>
              <DialogDescription>
                Escolha um aluno de origem e selecione um dos treinos dele para copiar.
                Você poderá editar antes de salvar como novo treino
                {destinoAluno?.nome ? ` de ${destinoAluno.nome}` : ""}.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 mt-2">
              <StudentPicker
                value={sourceAlunoId}
                onChange={(id) => setSourceAlunoId(id)}
                label="Aluno de origem"
                placeholder="Buscar aluno (pode ser o mesmo)..."
              />

              {sourceAlunoId && (
                <div className="space-y-2">
                  <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Treinos disponíveis
                  </h4>
                  {loadingTreinos ? (
                    <div className="py-8 flex items-center justify-center text-muted-foreground">
                      <Loader2 className="w-5 h-5 animate-spin mr-2" /> Carregando treinos...
                    </div>
                  ) : treinos.length === 0 ? (
                    <div className="glass-card rounded-lg p-6 text-center text-sm text-muted-foreground">
                      Este aluno não tem treinos cadastrados.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {treinos.map((t) => (
                        <button
                          key={t.id}
                          onClick={() => setSelectedTreino(t)}
                          className="glass-card rounded-lg p-3 w-full flex items-center gap-3 hover:border-primary/50 transition-all text-left"
                        >
                          <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                            <Dumbbell className="w-4 h-4 text-primary" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-sm font-semibold text-foreground">
                                {t.descricao}
                              </span>
                              {t.status === "atual" ? (
                                <Badge
                                  variant="outline"
                                  className="text-[10px] px-1.5 py-0 border-primary/30 text-primary bg-primary/10"
                                >
                                  Atual
                                </Badge>
                              ) : (
                                <Badge
                                  variant="outline"
                                  className="text-[10px] px-1.5 py-0 border-muted-foreground/30 text-muted-foreground"
                                >
                                  Arquivado
                                </Badge>
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              v{t.versao} ·{" "}
                              {formatDistanceToNow(new Date(t.created_at), {
                                addSuffix: true,
                                locale: ptBR,
                              })}
                            </p>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </>
        ) : (
          initial && (
            <>
              <DialogHeader>
                <div className="flex items-center gap-2">
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => setSelectedTreino(null)}
                    title="Trocar treino"
                  >
                    <ArrowLeft className="w-4 h-4" />
                  </Button>
                  <div className="flex-1">
                    <DialogTitle>
                      Copiar de {sourceAluno?.nome || "aluno"} →{" "}
                      {destinoAluno?.nome || "destino"}
                    </DialogTitle>
                    <DialogDescription>
                      Edite o treino conforme necessário e clique em "Salvar no aluno"
                      para criar uma nova versão atual.
                    </DialogDescription>
                  </div>
                </div>
              </DialogHeader>

              <PersonalizadoEditor
                initial={initial}
                initialName={`Cópia de ${selectedTreino.descricao}`}
                alunoId={alunoId}
                alunoNome={destinoAluno?.nome}
                onBack={() => setSelectedTreino(null)}
                onSaved={() => {
                  onSaved?.();
                  handleClose();
                }}
              />
            </>
          )
        )}
      </DialogContent>
    </Dialog>
  );
}
