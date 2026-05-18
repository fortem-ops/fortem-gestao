import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Plus, Pencil, Trash2, Loader2, ClipboardList, FileText, Lock } from "lucide-react";
import { toast } from "sonner";
import {
  fetchTipos, fetchProtocolos, deleteTipo, deleteProtocolo,
  type AvaliacaoTipo, type AvaliacaoProtocolo,
} from "@/lib/avaliacaoProtocolos";
import { TipoAvaliacaoDialog } from "./TipoAvaliacaoDialog";
import { ProtocoloAvaliacaoDialog } from "./ProtocoloAvaliacaoDialog";

export function AdminTiposAvaliacao() {
  const qc = useQueryClient();
  const [selectedTipoId, setSelectedTipoId] = useState<string | null>(null);
  const [tipoDialog, setTipoDialog] = useState<{ open: boolean; tipo: AvaliacaoTipo | null }>({ open: false, tipo: null });
  const [protoDialog, setProtoDialog] = useState<{ open: boolean; protocolo: AvaliacaoProtocolo | null }>({ open: false, protocolo: null });

  const { data: tipos = [], isLoading: loadingTipos } = useQuery({
    queryKey: ["avaliacao-tipos"],
    queryFn: fetchTipos,
  });

  const selectedTipo = useMemo(
    () => tipos.find((t) => t.id === selectedTipoId) ?? tipos[0] ?? null,
    [tipos, selectedTipoId]
  );

  const { data: protocolos = [], isLoading: loadingProtos } = useQuery({
    queryKey: ["avaliacao-protocolos", selectedTipo?.id],
    enabled: !!selectedTipo,
    queryFn: () => fetchProtocolos(selectedTipo!.id),
  });

  const handleDeleteTipo = async (t: AvaliacaoTipo) => {
    try {
      await deleteTipo(t.id);
      toast.success("Tipo excluído");
      qc.invalidateQueries({ queryKey: ["avaliacao-tipos"] });
      if (selectedTipoId === t.id) setSelectedTipoId(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao excluir");
    }
  };

  const handleDeleteProto = async (p: AvaliacaoProtocolo) => {
    try {
      await deleteProtocolo(p.id);
      toast.success("Protocolo excluído");
      qc.invalidateQueries({ queryKey: ["avaliacao-protocolos", selectedTipo?.id] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao excluir");
    }
  };

  if (loadingTipos) {
    return <div className="flex justify-center py-12"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-4">
      {/* Coluna 1: tipos */}
      <div className="glass-card rounded-lg p-4 space-y-3 h-fit">
        <div className="flex items-center justify-between">
          <h3 className="font-heading font-semibold text-foreground flex items-center gap-2">
            <ClipboardList className="w-4 h-4 text-primary" /> Tipos
          </h3>
          <Button size="sm" variant="outline" onClick={() => setTipoDialog({ open: true, tipo: null })}>
            <Plus className="w-3 h-3 mr-1" /> Novo
          </Button>
        </div>
        <div className="space-y-1">
          {tipos.map((t) => {
            const active = selectedTipo?.id === t.id;
            return (
              <div
                key={t.id}
                className={`group rounded-md border px-3 py-2 flex items-center gap-2 cursor-pointer transition-colors ${active ? "border-primary/50 bg-primary/5" : "border-border/50 hover:bg-secondary/30"}`}
                onClick={() => setSelectedTipoId(t.id)}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-semibold text-foreground truncate">{t.nome}</p>
                    {t.is_sistema && <Badge variant="outline" className="text-[10px] border-info/40 text-info"><Lock className="w-2.5 h-2.5 mr-1" />sistema</Badge>}
                    {!t.ativo && <Badge variant="outline" className="text-[10px] border-muted/40 text-muted-foreground">inativo</Badge>}
                  </div>
                  <p className="text-[11px] text-muted-foreground">{engineLabel(t.engine)}</p>
                </div>
                <Button size="icon" variant="ghost" className="opacity-0 group-hover:opacity-100" onClick={(e) => { e.stopPropagation(); setTipoDialog({ open: true, tipo: t }); }}>
                  <Pencil className="w-3.5 h-3.5" />
                </Button>
                {!t.is_sistema && (
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button size="icon" variant="ghost" className="opacity-0 group-hover:opacity-100" onClick={(e) => e.stopPropagation()}>
                        <Trash2 className="w-3.5 h-3.5 text-destructive" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Excluir tipo "{t.nome}"?</AlertDialogTitle>
                        <AlertDialogDescription>Todos os protocolos vinculados serão excluídos. Avaliações antigas mantêm o histórico mas perdem o vínculo.</AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction onClick={() => handleDeleteTipo(t)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Excluir</AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Coluna 2: protocolos */}
      <div className="glass-card rounded-lg p-4 space-y-3">
        {!selectedTipo ? (
          <div className="text-center text-sm text-muted-foreground py-8">Selecione um tipo de avaliação à esquerda</div>
        ) : (
          <>
            <div className="flex items-center justify-between flex-wrap gap-2">
              <h3 className="font-heading font-semibold text-foreground flex items-center gap-2">
                <FileText className="w-4 h-4 text-primary" />
                Protocolos de {selectedTipo.nome}
              </h3>
              <Button size="sm" onClick={() => setProtoDialog({ open: true, protocolo: null })}>
                <Plus className="w-3.5 h-3.5 mr-1" /> Novo protocolo
              </Button>
            </div>

            {loadingProtos ? (
              <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
            ) : protocolos.length === 0 ? (
              <div className="text-center text-sm text-muted-foreground py-8">Nenhum protocolo cadastrado.</div>
            ) : (
              <div className="space-y-2">
                {protocolos.map((p) => (
                  <div key={p.id} className="rounded-md border border-border/50 p-3 flex items-center gap-3 hover:bg-secondary/20 transition-colors">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-semibold text-foreground">{p.nome}</p>
                        {p.is_default && <Badge variant="outline" className="text-[10px] border-success/40 text-success">padrão</Badge>}
                        {!p.ativo && <Badge variant="outline" className="text-[10px] border-muted/40 text-muted-foreground">inativo</Badge>}
                      </div>
                      {p.descricao && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{p.descricao}</p>}
                    </div>
                    <Button size="icon" variant="ghost" onClick={() => setProtoDialog({ open: true, protocolo: p })}>
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button size="icon" variant="ghost"><Trash2 className="w-4 h-4 text-destructive" /></Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Excluir protocolo "{p.nome}"?</AlertDialogTitle>
                          <AlertDialogDescription>Avaliações realizadas com este protocolo mantêm seu histórico.</AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction onClick={() => handleDeleteProto(p)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Excluir</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      <TipoAvaliacaoDialog
        open={tipoDialog.open}
        onOpenChange={(o) => setTipoDialog((s) => ({ ...s, open: o }))}
        tipo={tipoDialog.tipo}
      />
      {selectedTipo && (
        <ProtocoloAvaliacaoDialog
          open={protoDialog.open}
          onOpenChange={(o) => setProtoDialog((s) => ({ ...s, open: o }))}
          tipo={selectedTipo}
          protocolo={protoDialog.protocolo}
        />
      )}
    </div>
  );
}

function engineLabel(e: string) {
  if (e === "funcional_fixo") return "Funcional (mapa corporal)";
  if (e === "composicao_pollock") return "Composição Pollock";
  return "Dinâmico";
}
