import { useMemo, useState } from "react";
import { Plus, Pencil, Trash2, Check, X, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { useExerciseCategories } from "@/hooks/useExerciseCategories";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

type RowEdit =
  | { kind: "grupo"; oldName: string }
  | { kind: "sub"; grupo: string; oldName: string };

const validate = (name: string, existing: string[], oldName?: string) => {
  const v = name.trim();
  if (!v) return "Nome obrigatório";
  if (v.length > 80) return "Máx. 80 caracteres";
  const dup = existing.some(
    (e) => e.toLowerCase() === v.toLowerCase() && e !== oldName,
  );
  if (dup) return "Nome já existe";
  return null;
};

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
}

export function ManageCategoriesDialog({ open, onOpenChange }: Props) {
  const {
    categories,
    addGrupo,
    addSub,
    renameGrupo,
    renameSub,
    deleteGrupo,
    deleteSub,
  } = useExerciseCategories();

  const [tab, setTab] = useState<"grupos" | "subs">("grupos");
  const [newGrupo, setNewGrupo] = useState("");
  const [selectedGrupo, setSelectedGrupo] = useState<string>("");
  const [newSub, setNewSub] = useState("");
  const [editing, setEditing] = useState<RowEdit | null>(null);
  const [editValue, setEditValue] = useState("");
  const [confirmDel, setConfirmDel] = useState<RowEdit | null>(null);

  const grupos = categories.map((c) => c.name);
  const subs =
    categories.find((c) => c.name === selectedGrupo)?.subcategories ?? [];

  const startEdit = (e: RowEdit) => {
    setEditing(e);
    setEditValue(e.oldName);
  };

  const saveEdit = async () => {
    if (!editing) return;
    const value = editValue.trim();
    const list = editing.kind === "grupo" ? grupos : subs;
    const err = validate(value, list, editing.oldName);
    if (err) return toast.error(err);
    try {
      if (editing.kind === "grupo") {
        await renameGrupo.mutateAsync({ oldGrupo: editing.oldName, newGrupo: value });
        if (selectedGrupo === editing.oldName) setSelectedGrupo(value);
      } else {
        await renameSub.mutateAsync({
          grupo: editing.grupo,
          oldSub: editing.oldName,
          newSub: value,
        });
      }
      setEditing(null);
      toast.success("Atualizado");
    } catch (e: any) {
      toast.error(e.message || "Erro ao atualizar");
    }
  };

  const handleDelete = async () => {
    if (!confirmDel) return;
    try {
      if (confirmDel.kind === "grupo") {
        await deleteGrupo.mutateAsync(confirmDel.oldName);
        if (selectedGrupo === confirmDel.oldName) setSelectedGrupo("");
      } else {
        await deleteSub.mutateAsync({
          grupo: confirmDel.grupo,
          subcategoria: confirmDel.oldName,
        });
      }
      toast.success("Excluído");
      setConfirmDel(null);
    } catch (e: any) {
      toast.error(e.message || "Erro ao excluir");
    }
  };

  const handleAddGrupo = async () => {
    const err = validate(newGrupo, grupos);
    if (err) return toast.error(err);
    try {
      await addGrupo.mutateAsync(newGrupo.trim());
      setNewGrupo("");
      toast.success("Grupo adicionado (com subcategoria padrão 'Geral')");
    } catch (e: any) {
      toast.error(e.message || "Erro ao adicionar");
    }
  };

  const handleAddSub = async () => {
    if (!selectedGrupo) return toast.error("Selecione um grupo");
    const err = validate(newSub, subs);
    if (err) return toast.error(err);
    try {
      await addSub.mutateAsync({ grupo: selectedGrupo, subcategoria: newSub.trim() });
      setNewSub("");
      toast.success("Subcategoria adicionada");
    } catch (e: any) {
      toast.error(e.message || "Erro ao adicionar");
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Gerenciar Categorias</DialogTitle>
            <DialogDescription>
              Crie, renomeie e exclua Grupos e Subcategorias do Banco de Exercícios.
            </DialogDescription>
          </DialogHeader>

          <div className="flex gap-2 border-b border-border">
            <button
              type="button"
              onClick={() => setTab("grupos")}
              className={`px-3 py-2 text-sm font-medium border-b-2 transition-colors ${
                tab === "grupos"
                  ? "border-primary text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              Grupos
            </button>
            <button
              type="button"
              onClick={() => setTab("subs")}
              className={`px-3 py-2 text-sm font-medium border-b-2 transition-colors ${
                tab === "subs"
                  ? "border-primary text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              Subcategorias
            </button>
          </div>

          {tab === "grupos" ? (
            <div className="space-y-3">
              <div className="flex gap-2">
                <Input
                  placeholder="Novo grupo (ex.: Yoga)"
                  value={newGrupo}
                  onChange={(e) => setNewGrupo(e.target.value)}
                  maxLength={80}
                />
                <Button onClick={handleAddGrupo} disabled={addGrupo.isPending}>
                  {addGrupo.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Plus className="w-4 h-4" />
                  )}
                  Adicionar
                </Button>
              </div>
              <div className="space-y-1">
                {grupos.length === 0 && (
                  <p className="text-sm text-muted-foreground py-4 text-center">
                    Nenhum grupo cadastrado
                  </p>
                )}
                {grupos.map((g) => {
                  const isEditing = editing?.kind === "grupo" && editing.oldName === g;
                  return (
                    <div
                      key={g}
                      className="glass-card rounded-md p-2 flex items-center gap-2"
                    >
                      {isEditing ? (
                        <>
                          <Input
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            maxLength={80}
                            autoFocus
                          />
                          <Button size="icon" variant="ghost" onClick={saveEdit}>
                            <Check className="w-4 h-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => setEditing(null)}
                          >
                            <X className="w-4 h-4" />
                          </Button>
                        </>
                      ) : (
                        <>
                          <span className="flex-1 text-sm">{g}</span>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => startEdit({ kind: "grupo", oldName: g })}
                            aria-label="Renomear grupo"
                          >
                            <Pencil className="w-4 h-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => setConfirmDel({ kind: "grupo", oldName: g })}
                            aria-label="Excluir grupo"
                          >
                            <Trash2 className="w-4 h-4 text-destructive" />
                          </Button>
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div>
                <Label>Grupo</Label>
                <Select value={selectedGrupo} onValueChange={setSelectedGrupo}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione um grupo" />
                  </SelectTrigger>
                  <SelectContent>
                    {grupos.map((g) => (
                      <SelectItem key={g} value={g}>
                        {g}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {selectedGrupo && (
                <>
                  <div className="flex gap-2">
                    <Input
                      placeholder="Nova subcategoria"
                      value={newSub}
                      onChange={(e) => setNewSub(e.target.value)}
                      maxLength={80}
                    />
                    <Button onClick={handleAddSub} disabled={addSub.isPending}>
                      {addSub.isPending ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Plus className="w-4 h-4" />
                      )}
                      Adicionar
                    </Button>
                  </div>
                  <div className="space-y-1">
                    {subs.length === 0 && (
                      <p className="text-sm text-muted-foreground py-4 text-center">
                        Nenhuma subcategoria
                      </p>
                    )}
                    {subs.map((s) => {
                      const isEditing =
                        editing?.kind === "sub" &&
                        editing.grupo === selectedGrupo &&
                        editing.oldName === s;
                      return (
                        <div
                          key={s}
                          className="glass-card rounded-md p-2 flex items-center gap-2"
                        >
                          {isEditing ? (
                            <>
                              <Input
                                value={editValue}
                                onChange={(e) => setEditValue(e.target.value)}
                                maxLength={80}
                                autoFocus
                              />
                              <Button size="icon" variant="ghost" onClick={saveEdit}>
                                <Check className="w-4 h-4" />
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => setEditing(null)}
                              >
                                <X className="w-4 h-4" />
                              </Button>
                            </>
                          ) : (
                            <>
                              <span className="flex-1 text-sm">{s}</span>
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() =>
                                  startEdit({
                                    kind: "sub",
                                    grupo: selectedGrupo,
                                    oldName: s,
                                  })
                                }
                                aria-label="Renomear subcategoria"
                              >
                                <Pencil className="w-4 h-4" />
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() =>
                                  setConfirmDel({
                                    kind: "sub",
                                    grupo: selectedGrupo,
                                    oldName: s,
                                  })
                                }
                                aria-label="Excluir subcategoria"
                              >
                                <Trash2 className="w-4 h-4 text-destructive" />
                              </Button>
                            </>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={!!confirmDel}
        onOpenChange={(o) => !o && setConfirmDel(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              {confirmDel?.kind === "grupo"
                ? `Excluir o grupo "${confirmDel.oldName}" e todas as suas subcategorias? Não será possível se houver exercícios vinculados.`
                : `Excluir a subcategoria "${confirmDel?.oldName}"? Não será possível se houver exercícios vinculados.`}
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
