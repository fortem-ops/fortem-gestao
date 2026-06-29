import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { AlertCircle, CheckCircle2, FileText, Plus } from "lucide-react";
import { toast } from "sonner";

interface Versao {
  id: string;
  versao: string;
  titulo: string | null;
  texto_termo: string | null;
  changelog: string | null;
  vigente: boolean;
  rascunho: boolean;
  vigente_desde: string;
  criado_em: string;
}

export function AdminTermoConsentimento() {
  const qc = useQueryClient();
  const [editor, setEditor] = useState<{
    versao: string;
    titulo: string;
    texto: string;
    changelog: string;
  } | null>(null);
  const [visualizar, setVisualizar] = useState<Versao | null>(null);

  const { data: versoes = [], isLoading } = useQuery({
    queryKey: ["admin-termo-versoes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ponto_politica_retencao" as any)
        .select("*")
        .order("criado_em", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as Versao[];
    },
  });

  const { data: aceitesPorVersao = {} } = useQuery({
    queryKey: ["admin-aceites-por-versao"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ponto_consentimento_geo")
        .select("versao_termo");
      if (error) throw error;
      const counts: Record<string, number> = {};
      for (const r of data ?? []) {
        const v = (r as any).versao_termo as string;
        counts[v] = (counts[v] ?? 0) + 1;
      }
      return counts;
    },
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["admin-termo-versoes"] });
    qc.invalidateQueries({ queryKey: ["ponto-termo-vigente"] });
    qc.invalidateQueries({ queryKey: ["ponto-politica-retencao"] });
  };

  const salvar = useMutation({
    mutationFn: async (args: { publicarVigente: boolean }) => {
      if (!editor) return;
      const versao = editor.versao.trim();
      if (!versao) throw new Error("Informe o número da versão.");
      if (!editor.texto.trim()) throw new Error("Texto do termo não pode ficar vazio.");

      // Versão única
      const existing = versoes.find((v) => v.versao === versao);
      if (existing) throw new Error(`Versão ${versao} já existe.`);

      if (args.publicarVigente) {
        // Desmarcar a vigente atual
        const vigenteAtual = versoes.find((v) => v.vigente);
        if (vigenteAtual) {
          const { error } = await supabase
            .from("ponto_politica_retencao" as any)
            .update({ vigente: false })
            .eq("id", vigenteAtual.id);
          if (error) throw error;
        }
      }

      const { error } = await supabase.from("ponto_politica_retencao" as any).insert({
        versao,
        titulo: editor.titulo || "Termo de Consentimento de Geolocalização",
        texto_termo: editor.texto,
        changelog: editor.changelog || null,
        vigente: args.publicarVigente,
        rascunho: !args.publicarVigente,
        vigente_desde: new Date().toISOString(),
        // campos legais reaproveitados (defaults da versão vigente atual)
        retencao_jornadas_anos: 5,
        retencao_eventos_anos: 5,
        retencao_banco_horas_anos: 5,
        base_legal: "Art. 11 da CLT e Art. 7º II e IX da LGPD (Lei 13.709/2018)",
        responsavel_dados: "Fortem Centro de Treinamento",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Versão salva.");
      setEditor(null);
      invalidate();
    },
    onError: (e: any) => toast.error(e.message ?? "Erro ao salvar."),
  });

  const tornarVigente = useMutation({
    mutationFn: async (v: Versao) => {
      const vigenteAtual = versoes.find((x) => x.vigente && x.id !== v.id);
      if (vigenteAtual) {
        const { error } = await supabase
          .from("ponto_politica_retencao" as any)
          .update({ vigente: false })
          .eq("id", vigenteAtual.id);
        if (error) throw error;
      }
      const { error } = await supabase
        .from("ponto_politica_retencao" as any)
        .update({ vigente: true, rascunho: false, vigente_desde: new Date().toISOString() })
        .eq("id", v.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Versão tornada vigente.");
      invalidate();
    },
    onError: (e: any) => toast.error(e.message ?? "Erro."),
  });

  const sortedVersoes = useMemo(
    () =>
      [...versoes].sort((a, b) => {
        if (a.vigente !== b.vigente) return a.vigente ? -1 : 1;
        return new Date(b.criado_em).getTime() - new Date(a.criado_em).getTime();
      }),
    [versoes],
  );

  return (
    <Card className="p-4 space-y-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h3 className="font-semibold flex items-center gap-2">
            <FileText className="w-4 h-4" /> Versões do termo de consentimento
          </h3>
          <p className="text-xs text-muted-foreground mt-1">
            Cada versão fica registrada de forma imutável depois de aceita por algum colaborador.
            Para alterar o texto, publique uma <strong>nova versão</strong> — os colaboradores
            serão solicitados a aceitar novamente.
          </p>
        </div>
        <Button
          onClick={() =>
            setEditor({
              versao: "",
              titulo: "Termo de Consentimento de Geolocalização",
              texto: "",
              changelog: "",
            })
          }
        >
          <Plus className="w-4 h-4 mr-1" /> Nova versão
        </Button>
      </div>

      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Versão</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Publicada em</TableHead>
              <TableHead>Aceites</TableHead>
              <TableHead>Prévia</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground py-6">
                  Carregando...
                </TableCell>
              </TableRow>
            ) : sortedVersoes.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground py-6">
                  Nenhuma versão cadastrada.
                </TableCell>
              </TableRow>
            ) : (
              sortedVersoes.map((v) => {
                const aceites = aceitesPorVersao[v.versao] ?? 0;
                return (
                  <TableRow key={v.id}>
                    <TableCell className="font-medium">{v.versao}</TableCell>
                    <TableCell>
                      {v.vigente ? (
                        <Badge className="bg-success/15 text-success border-success/30" variant="outline">
                          <CheckCircle2 className="w-3 h-3 mr-1" /> Vigente
                        </Badge>
                      ) : v.rascunho ? (
                        <Badge variant="outline" className="text-muted-foreground">Rascunho</Badge>
                      ) : (
                        <Badge variant="outline">Histórica</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-sm">
                      {new Date(v.vigente_desde).toLocaleDateString("pt-BR")}
                    </TableCell>
                    <TableCell className="text-sm">{aceites}</TableCell>
                    <TableCell className="text-xs text-muted-foreground max-w-[280px]">
                      <span className="line-clamp-2">{v.texto_termo ?? "—"}</span>
                    </TableCell>
                    <TableCell className="text-right space-x-1">
                      <Button size="sm" variant="ghost" onClick={() => setVisualizar(v)}>
                        Ver
                      </Button>
                      {v.rascunho && !v.vigente && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => tornarVigente.mutate(v)}
                          disabled={tornarVigente.isPending}
                        >
                          Tornar vigente
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      <div className="text-xs text-muted-foreground flex items-start gap-2 p-3 bg-warning/10 border border-warning/30 rounded-md">
        <AlertCircle className="w-4 h-4 text-warning flex-shrink-0 mt-0.5" />
        <span>
          Versões já aceitas por colaboradores não podem ser editadas. O conteúdo aceito é
          preservado como prova legal. Publique uma nova versão para mudar o texto.
        </span>
      </div>

      {/* Editor */}
      <Dialog open={!!editor} onOpenChange={(o) => !o && setEditor(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Nova versão do termo</DialogTitle>
            <DialogDescription>
              Cadastre uma nova versão do texto de consentimento de geolocalização.
            </DialogDescription>
          </DialogHeader>
          {editor && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Número da versão</Label>
                  <Input
                    placeholder="Ex: 1.2"
                    value={editor.versao}
                    onChange={(e) => setEditor({ ...editor, versao: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Título</Label>
                  <Input
                    value={editor.titulo}
                    onChange={(e) => setEditor({ ...editor, titulo: e.target.value })}
                  />
                </div>
              </div>
              <div>
                <Label>Texto do termo</Label>
                <Textarea
                  rows={10}
                  value={editor.texto}
                  onChange={(e) => setEditor({ ...editor, texto: e.target.value })}
                  placeholder="Conteúdo completo apresentado ao colaborador..."
                />
              </div>
              <div>
                <Label>Notas internas (changelog)</Label>
                <Textarea
                  rows={2}
                  value={editor.changelog}
                  onChange={(e) => setEditor({ ...editor, changelog: e.target.value })}
                  placeholder="O que mudou em relação à versão anterior (uso interno)"
                />
              </div>
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button
              variant="ghost"
              onClick={() => salvar.mutate({ publicarVigente: false })}
              disabled={salvar.isPending}
            >
              Salvar como rascunho
            </Button>
            <Button
              onClick={() => salvar.mutate({ publicarVigente: true })}
              disabled={salvar.isPending}
            >
              Publicar e tornar vigente
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Visualizar */}
      <Dialog open={!!visualizar} onOpenChange={(o) => !o && setVisualizar(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              Versão {visualizar?.versao}
              {visualizar?.vigente && (
                <Badge className="ml-2 bg-success/15 text-success border-success/30" variant="outline">
                  Vigente
                </Badge>
              )}
            </DialogTitle>
            <DialogDescription>{visualizar?.titulo}</DialogDescription>
          </DialogHeader>
          <div className="text-sm whitespace-pre-wrap leading-relaxed max-h-[55vh] overflow-y-auto">
            {visualizar?.texto_termo ?? "—"}
          </div>
          {visualizar?.changelog && (
            <div className="text-xs text-muted-foreground border-t pt-2">
              <strong>Changelog:</strong> {visualizar.changelog}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </Card>
  );
}
