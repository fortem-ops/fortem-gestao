import { useEffect, useMemo, useState } from "react";
import { Plus, Pencil, Trash2, Check, X, Loader2, GripVertical, ArrowRight } from "lucide-react";

import { toast } from "sonner";

import { useExerciseCategories } from "@/hooks/useExerciseCategories";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";

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
    migrar,
    migrarGrupoPreservandoSubs,
    moverGrupoParaGrupo,
    moverSubParaGrupo,
    contarPorSubcategoria,
    reorderGrupos,
    reorderSubs,
    contarExercicios,
  } = useExerciseCategories();

  const [tab, setTab] = useState<"grupos" | "subs" | "migrar">("grupos");
  const [newGrupo, setNewGrupo] = useState("");
  const [selectedGrupo, setSelectedGrupo] = useState<string>("");
  const [newSub, setNewSub] = useState("");
  const [editing, setEditing] = useState<RowEdit | null>(null);
  const [editValue, setEditValue] = useState("");
  const [confirmDel, setConfirmDel] = useState<RowEdit | null>(null);
  const [dragGrupo, setDragGrupo] = useState<string | null>(null);
  const [dragSub, setDragSub] = useState<string | null>(null);
  const [hoverNest, setHoverNest] = useState<string | null>(null);
  const [hoverGrupoAlvo, setHoverGrupoAlvo] = useState<string | null>(null);
  const [confirmMove, setConfirmMove] = useState<
    | { kind: "grupo"; origem: string; destino: string; total: number; subs: string[] }
    | { kind: "sub"; grupo: string; sub: string; destino: string; total: number }
    | null
  >(null);
  const [movendo, setMovendo] = useState(false);


  // Migração
  const [origGrupo, setOrigGrupo] = useState("");
  const [origSub, setOrigSub] = useState<string>("__todas__");
  const [destGrupo, setDestGrupo] = useState("");
  const [destSub, setDestSub] = useState("");
  const [excluirOrigem, setExcluirOrigem] = useState(false);
  const [preview, setPreview] = useState<number | null>(null);
  const [modoSubs, setModoSubs] = useState<"manter" | "unificar">("manter");
  const [previewSubs, setPreviewSubs] = useState<{ sub: string; total: number }[]>([]);



  const grupos = categories.map((c) => c.name);
  const subs =
    categories.find((c) => c.name === selectedGrupo)?.subcategories ?? [];
  const origSubs = useMemo(
    () => categories.find((c) => c.name === origGrupo)?.subcategories ?? [],
    [categories, origGrupo],
  );
  const destSubs = useMemo(
    () => categories.find((c) => c.name === destGrupo)?.subcategories ?? [],
    [categories, destGrupo],
  );

  // Prévia da quantidade de exercícios afetados pela migração
  useEffect(() => {
    let cancelado = false;
    if (!origGrupo) {
      setPreview(null);
      setPreviewSubs([]);
      return;
    }
    contarExercicios(origGrupo, origSub === "__todas__" ? null : origSub)
      .then((n) => !cancelado && setPreview(n))
      .catch(() => !cancelado && setPreview(null));
    if (origSub === "__todas__") {
      contarPorSubcategoria(origGrupo)
        .then((r) => !cancelado && setPreviewSubs(r))
        .catch(() => !cancelado && setPreviewSubs([]));
    } else {
      setPreviewSubs([]);
    }
    return () => {
      cancelado = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [origGrupo, origSub]);

  const reordenar = <T,>(list: T[], from: T, to: T): T[] => {
    const arr = [...list];
    const fromIdx = arr.indexOf(from);
    const toIdx = arr.indexOf(to);
    if (fromIdx < 0 || toIdx < 0 || fromIdx === toIdx) return arr;
    arr.splice(fromIdx, 1);
    arr.splice(toIdx, 0, from);
    return arr;
  };

  // Define se a soltura sobre a linha reordena (metade superior) ou aninha (metade inferior)
  const zonaDeSoltura = (e: React.DragEvent<HTMLDivElement>): "reordenar" | "aninhar" => {
    const rect = e.currentTarget.getBoundingClientRect();
    return e.clientY - rect.top < rect.height / 2 ? "reordenar" : "aninhar";
  };

  const dropGrupo = async (alvo: string, modo: "reordenar" | "aninhar") => {
    const origem = dragGrupo;
    setDragGrupo(null);
    setHoverNest(null);
    if (!origem || origem === alvo) return;

    if (modo === "aninhar") {
      try {
        const total = await contarExercicios(origem, null);
        const subsOrigem =
          categories.find((c) => c.name === origem)?.subcategories ?? [];
        setConfirmMove({ kind: "grupo", origem, destino: alvo, total, subs: subsOrigem });
      } catch (e: any) {
        toast.error(e.message || "Erro ao calcular a prévia");
      }
      return;
    }

    const nova = reordenar(grupos, origem, alvo);
    try {
      await reorderGrupos.mutateAsync(nova);
    } catch (e: any) {
      toast.error(e.message || "Erro ao reordenar");
    }
  };

  const dropSub = async (alvo: string) => {
    if (!dragSub || dragSub === alvo) return setDragSub(null);
    const nova = reordenar(subs, dragSub, alvo);
    setDragSub(null);
    try {
      await reorderSubs.mutateAsync({ grupo: selectedGrupo, novaOrdem: nova });
    } catch (e: any) {
      toast.error(e.message || "Erro ao reordenar");
    }
  };

  const dropSubEmGrupo = async (destino: string) => {
    const sub = dragSub;
    setDragSub(null);
    setHoverGrupoAlvo(null);
    if (!sub || !selectedGrupo || destino === selectedGrupo) return;
    try {
      const total = await contarExercicios(selectedGrupo, sub);
      setConfirmMove({ kind: "sub", grupo: selectedGrupo, sub, destino, total });
    } catch (e: any) {
      toast.error(e.message || "Erro ao calcular a prévia");
    }
  };

  const confirmarMovimento = async () => {
    if (!confirmMove) return;
    setMovendo(true);
    try {
      if (confirmMove.kind === "grupo") {
        const n = await moverGrupoParaGrupo.mutateAsync({
          grupoOrigem: confirmMove.origem,
          grupoDestino: confirmMove.destino,
        });
        if (selectedGrupo === confirmMove.origem) setSelectedGrupo(confirmMove.destino);
        toast.success(`${n} exercício(s) movidos para ${confirmMove.destino}`);
      } else {
        const n = await moverSubParaGrupo.mutateAsync({
          grupoOrigem: confirmMove.grupo,
          sub: confirmMove.sub,
          grupoDestino: confirmMove.destino,
        });
        toast.success(`${n} exercício(s) movidos para ${confirmMove.destino}`);
      }
      setConfirmMove(null);
    } catch (e: any) {
      toast.error(e.message || "Erro ao mover");
    } finally {
      setMovendo(false);
    }
  };



  const handleMigrar = async () => {
    if (!origGrupo) return toast.error("Selecione o grupo de origem");
    if (!destGrupo) return toast.error("Selecione o grupo de destino");
    const subOrigem = origSub === "__todas__" ? null : origSub;
    const preservar = subOrigem === null && modoSubs === "manter";
    if (!preservar && !destSub) {
      return toast.error("Selecione a subcategoria de destino");
    }
    if (origGrupo === destGrupo && (preservar || subOrigem === destSub)) {
      return toast.error("Origem e destino são iguais");
    }
    try {
      const movidos = preservar
        ? await migrarGrupoPreservandoSubs.mutateAsync({
            grupoOrigem: origGrupo,
            grupoDestino: destGrupo,
          })
        : await migrar.mutateAsync({
            grupoOrigem: origGrupo,
            subOrigem,
            grupoDestino: destGrupo,
            subDestino: destSub,
          });
      if (excluirOrigem) {
        if (subOrigem) {
          await deleteSub.mutateAsync({ grupo: origGrupo, subcategoria: subOrigem });
        } else {
          await deleteGrupo.mutateAsync(origGrupo);
        }
      }
      toast.success(`${movidos} exercício(s) migrado(s)`);
      setPreview(null);
    } catch (e: any) {
      toast.error(e.message || "Erro ao migrar");
    }
  };

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
              Crie, renomeie, reordene, migre e exclua Grupos e Subcategorias do Banco de
              Exercícios.
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
            <button
              type="button"
              onClick={() => setTab("migrar")}
              className={`px-3 py-2 text-sm font-medium border-b-2 transition-colors ${
                tab === "migrar"
                  ? "border-primary text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              Migrar
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
              <p className="text-xs text-muted-foreground">
                Arraste na metade <strong>de cima</strong> de outro grupo para reordenar, ou
                na metade <strong>de baixo</strong> para colocar a pasta dentro dele.
              </p>
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
                      className={`glass-card rounded-md p-2 flex items-center gap-2 transition-shadow ${
                        dragGrupo === g ? "opacity-50" : ""
                      } ${hoverNest === g ? "ring-2 ring-primary" : ""}`}
                      draggable={!isEditing}
                      onDragStart={() => setDragGrupo(g)}
                      onDragEnd={() => {
                        setDragGrupo(null);
                        setHoverNest(null);
                      }}
                      onDragOver={(e) => {
                        e.preventDefault();
                        if (!dragGrupo || dragGrupo === g) return;
                        setHoverNest(zonaDeSoltura(e) === "aninhar" ? g : null);
                      }}
                      onDragLeave={() => setHoverNest((h) => (h === g ? null : h))}
                      onDrop={(e) => dropGrupo(g, zonaDeSoltura(e))}
                    >

                      <GripVertical className="w-4 h-4 text-muted-foreground cursor-grab shrink-0" />
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
          ) : tab === "subs" ? (

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
                          className={`glass-card rounded-md p-2 flex items-center gap-2 ${
                            dragSub === s ? "opacity-50" : ""
                          }`}
                          draggable={!isEditing}
                          onDragStart={() => setDragSub(s)}
                          onDragEnd={() => setDragSub(null)}
                          onDragOver={(e) => e.preventDefault()}
                          onDrop={() => dropSub(s)}
                        >
                          <GripVertical className="w-4 h-4 text-muted-foreground cursor-grab shrink-0" />
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
          ) : (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Move todos os exercícios de uma origem para outro grupo/subcategoria.
                Exercícios que já estiverem no destino não são duplicados.
              </p>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Origem — Grupo</Label>
                  <Select
                    value={origGrupo}
                    onValueChange={(v) => {
                      setOrigGrupo(v);
                      setOrigSub("__todas__");
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      {grupos.map((g) => (
                        <SelectItem key={g} value={g}>
                          {g}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Label>Origem — Subcategoria</Label>
                  <Select value={origSub} onValueChange={setOrigSub} disabled={!origGrupo}>
                    <SelectTrigger>
                      <SelectValue placeholder="Todas" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__todas__">Todas (grupo inteiro)</SelectItem>
                      {origSubs.map((s) => (
                        <SelectItem key={s} value={s}>
                          {s}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Destino — Grupo</Label>
                  <Select
                    value={destGrupo}
                    onValueChange={(v) => {
                      setDestGrupo(v);
                      setDestSub("");
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      {grupos.map((g) => (
                        <SelectItem key={g} value={g}>
                          {g}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  {origSub === "__todas__" && (
                    <>
                      <Label>Subcategorias</Label>
                      <Select
                        value={modoSubs}
                        onValueChange={(v) => setModoSubs(v as "manter" | "unificar")}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="manter">
                            Manter subcategorias de origem
                          </SelectItem>
                          <SelectItem value="unificar">
                            Unificar em uma subcategoria
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </>
                  )}

                  {!(origSub === "__todas__" && modoSubs === "manter") && (
                    <>
                      <Label>Destino — Subcategoria</Label>
                      <Select value={destSub} onValueChange={setDestSub} disabled={!destGrupo}>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione" />
                        </SelectTrigger>
                        <SelectContent>
                          {destSubs.map((s) => (
                            <SelectItem key={s} value={s}>
                              {s}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </>
                  )}
                </div>
              </div>

              {preview !== null && (
                <div className="glass-card rounded-md p-3 text-sm space-y-2">
                  <div className="flex items-center gap-2">
                    <ArrowRight className="w-4 h-4 text-primary" />
                    <span>
                      {preview} exercício(s) serão movidos de{" "}
                      <strong>
                        {origGrupo}
                        {origSub !== "__todas__" ? ` / ${origSub}` : ""}
                      </strong>
                      {destGrupo ? (
                        <>
                          {" "}
                          para{" "}
                          <strong>
                            {destGrupo}
                            {origSub === "__todas__" && modoSubs === "manter"
                              ? " (mesmas subcategorias)"
                              : destSub
                                ? ` / ${destSub}`
                                : ""}
                          </strong>
                        </>
                      ) : null}
                      .
                    </span>
                  </div>
                  {origSub === "__todas__" && modoSubs === "manter" && previewSubs.length > 0 && (
                    <div className="text-xs text-muted-foreground">
                      {previewSubs.map((s) => `${s.sub}: ${s.total}`).join(" · ")}
                    </div>
                  )}
                </div>
              )}

              <label className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={excluirOrigem}
                  onCheckedChange={(c) => setExcluirOrigem(c === true)}
                />
                Excluir a categoria de origem após migrar
              </label>

              <Button
                onClick={handleMigrar}
                disabled={
                  migrar.isPending ||
                  migrarGrupoPreservandoSubs.isPending ||
                  !origGrupo ||
                  !destGrupo ||
                  (!(origSub === "__todas__" && modoSubs === "manter") && !destSub)
                }
                className="w-full"
              >
                {migrar.isPending || migrarGrupoPreservandoSubs.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <ArrowRight className="w-4 h-4" />
                )}
                Migrar exercícios
              </Button>
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
