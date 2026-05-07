import { useState } from "react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Pencil, Trash2, Plus, X, Check } from "lucide-react";
import { useLeadOrigens, useLeadOrigemMutations, type LeadOrigem } from "@/hooks/useLeadOrigens";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

export function ManageOrigensDialog({ open, onOpenChange }: Props) {
  const { data: origens = [], isLoading } = useLeadOrigens(true);
  const { create, update, remove } = useLeadOrigemMutations();
  const [novoNome, setNovoNome] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editNome, setEditNome] = useState("");
  const [confirmDelete, setConfirmDelete] = useState<LeadOrigem | null>(null);

  async function handleCreate() {
    const nome = novoNome.trim();
    if (!nome) return;
    try {
      await create.mutateAsync({ nome, ordem: (origens[origens.length - 1]?.ordem ?? 0) + 1 });
      toast.success("Origem criada");
      setNovoNome("");
    } catch (e: any) {
      toast.error(e.message || "Erro ao criar");
    }
  }

  async function handleSaveEdit(id: string) {
    const nome = editNome.trim();
    if (!nome) return;
    try {
      await update.mutateAsync({ id, nome });
      toast.success("Origem atualizada");
      setEditingId(null);
    } catch (e: any) {
      toast.error(e.message || "Erro ao atualizar");
    }
  }

  async function handleToggle(o: LeadOrigem) {
    try {
      await update.mutateAsync({ id: o.id, ativo: !o.ativo });
    } catch (e: any) {
      toast.error(e.message || "Erro");
    }
  }

  async function handleDelete() {
    if (!confirmDelete) return;
    try {
      await remove.mutateAsync(confirmDelete.id);
      toast.success("Origem excluída");
      setConfirmDelete(null);
    } catch (e: any) {
      toast.error(e.message || "Não foi possível excluir. Talvez esteja em uso — desative-a.");
      setConfirmDelete(null);
    }
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader><DialogTitle>Gerenciar Origens</DialogTitle></DialogHeader>

          <div className="flex gap-2">
            <Input
              placeholder="Nova origem..."
              value={novoNome}
              onChange={(e) => setNovoNome(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleCreate()}
            />
            <Button onClick={handleCreate} disabled={create.isPending} className="gap-1">
              <Plus className="w-4 h-4" /> Adicionar
            </Button>
          </div>

          <div className="border border-border rounded-md divide-y divide-border max-h-[360px] overflow-auto">
            {isLoading && <p className="p-3 text-sm text-muted-foreground">Carregando...</p>}
            {!isLoading && origens.length === 0 && (
              <p className="p-3 text-sm text-muted-foreground">Nenhuma origem cadastrada.</p>
            )}
            {origens.map((o) => (
              <div key={o.id} className="flex items-center gap-2 p-2">
                {editingId === o.id ? (
                  <>
                    <Input
                      value={editNome}
                      onChange={(e) => setEditNome(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleSaveEdit(o.id)}
                      autoFocus
                    />
                    <Button size="icon" variant="ghost" onClick={() => handleSaveEdit(o.id)} title="Salvar">
                      <Check className="w-4 h-4" />
                    </Button>
                    <Button size="icon" variant="ghost" onClick={() => setEditingId(null)} title="Cancelar">
                      <X className="w-4 h-4" />
                    </Button>
                  </>
                ) : (
                  <>
                    <span className={`flex-1 text-sm ${!o.ativo ? "text-muted-foreground line-through" : ""}`}>
                      {o.nome}
                    </span>
                    <Switch checked={o.ativo} onCheckedChange={() => handleToggle(o)} title={o.ativo ? "Ativa" : "Inativa"} />
                    <Button size="icon" variant="ghost" onClick={() => { setEditingId(o.id); setEditNome(o.nome); }} title="Editar">
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <Button size="icon" variant="ghost" onClick={() => setConfirmDelete(o)} title="Excluir">
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </>
                )}
              </div>
            ))}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!confirmDelete} onOpenChange={(v) => !v && setConfirmDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir origem?</AlertDialogTitle>
            <AlertDialogDescription>
              "{confirmDelete?.nome}" será removida. Leads já cadastrados manterão o registro,
              mas a opção não estará mais disponível. Se preferir, desative em vez de excluir.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
