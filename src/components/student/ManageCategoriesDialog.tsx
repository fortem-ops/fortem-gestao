import { useEffect, useState } from "react";
import { Plus, Pencil, Trash2, Check, X, Loader2, GripVertical } from "lucide-react";

import { toast } from "sonner";

import { useExerciseCategories, siglaSugerida } from "@/hooks/useExerciseCategories";
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
  | { kind: "categoria"; grupo: string; oldName: string }
  | { kind: "sub"; grupo: string; categoria: string; oldName: string };

type MoveConfirm =
  | { kind: "grupo"; origem: string; destino: string; total: number; cats: number }
  | { kind: "categoria"; grupo: string; categoria: string; destino: string; total: number }
  | {
      kind: "sub";
      grupo: string;
      categoria: string;
      sub: string;
      destinoGrupo: string;
      destinoCategoria: string;
      total: number;
    }
  | {
      kind: "promover-sub";
      grupo: string;
      categoria: string;
      sub: string;
      destinoGrupo: string;
      total: number;
    }
  | { kind: "promover-categoria"; grupo: string; categoria: string; total: number; subs: number };


const validate = (name: string, existing: string[], oldName?: string) => {
  const v = name.trim();
  if (!v) return "Nome obrigatório";
  if (v.length > 80) return "Máx. 80 caracteres";
  const dup = existing.some((e) => e.toLowerCase() === v.toLowerCase() && e !== oldName);
  if (dup) return "Nome já existe";
  return null;
};

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
}

export function ManageCategoriesDialog({ open, onOpenChange }: Props) {
  const {
    tree,
    addGrupo,
    addCategoria,
    addSub,
    renomear,
    deleteGrupo,
    deleteCategoria,
    deleteSub,
    moverGrupoComoCategoria,
    moverCategoriaParaGrupo,
    moverSubParaCategoria,
    promoverSubParaCategoria,
    promoverCategoriaParaGrupo,
    reorderGrupos,
    reorderCategorias,
    reorderSubs,
    contarExercicios,
    definirSigla,
  } = useExerciseCategories();

  const [tab, setTab] = useState<"grupos" | "categorias" | "subs">("grupos");
  const [newGrupo, setNewGrupo] = useState("");
  const [newCategoria, setNewCategoria] = useState("");
  const [newSub, setNewSub] = useState("");
  const [selectedGrupo, setSelectedGrupo] = useState<string>("");
  const [selectedCategoria, setSelectedCategoria] = useState<string>("");
  const [editing, setEditing] = useState<RowEdit | null>(null);
  const [editValue, setEditValue] = useState("");
  const [confirmDel, setConfirmDel] = useState<RowEdit | null>(null);
  const [siglaEdit, setSiglaEdit] = useState<string | null>(null);
  const [siglaValue, setSiglaValue] = useState("");

  const [dragGrupo, setDragGrupo] = useState<string | null>(null);
  const [dragCategoria, setDragCategoria] = useState<string | null>(null);
  const [dragSub, setDragSub] = useState<string | null>(null);
  const [hoverNest, setHoverNest] = useState<string | null>(null);
  const [hoverAlvo, setHoverAlvo] = useState<string | null>(null);
  const [confirmMove, setConfirmMove] = useState<MoveConfirm | null>(null);
  const [movendo, setMovendo] = useState(false);

  const grupos = tree.map((g) => g.nome);
  const categoriasDoGrupo = (grupo: string) =>
    tree.find((g) => g.nome === grupo)?.categorias.map((c) => c.nome) ?? [];
  const catNode = (grupo: string, categoria: string) =>
    tree.find((g) => g.nome === grupo)?.categorias.find((c) => c.nome === categoria);
  const siglaDe = (grupo: string, categoria: string) =>
    (catNode(grupo, categoria)?.sigla || siglaSugerida(categoria)).toUpperCase();

  const salvarSigla = async (categoria: string) => {
    const val = siglaValue.trim().toUpperCase();
    setSiglaEdit(null);
    if (!val || val === siglaDe(selectedGrupo, categoria)) return;
    try {
      await definirSigla.mutateAsync({ grupo: selectedGrupo, categoria, sigla: val });
      toast.success(`Sigla de "${categoria}" agora é ${val}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao definir sigla");
    }
  };

  const subsDe = (grupo: string, categoria: string) =>
    tree.find((g) => g.nome === grupo)?.categorias.find((c) => c.nome === categoria)
      ?.subcategorias ?? [];

  const cats = categoriasDoGrupo(selectedGrupo);
  const subs = subsDe(selectedGrupo, selectedCategoria);

  // Mantém as seleções coerentes com a árvore
  useEffect(() => {
    if (selectedGrupo && !cats.includes(selectedCategoria)) {
      setSelectedCategoria(cats[0] ?? "");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedGrupo, tree]);

  const reordenar = <T,>(list: T[], from: T, to: T): T[] => {
    const arr = [...list];
    const fromIdx = arr.indexOf(from);
    const toIdx = arr.indexOf(to);
    if (fromIdx < 0 || toIdx < 0 || fromIdx === toIdx) return arr;
    arr.splice(fromIdx, 1);
    arr.splice(toIdx, 0, from);
    return arr;
  };

  const zonaDeSoltura = (e: React.DragEvent<HTMLDivElement>): "reordenar" | "aninhar" => {
    const rect = e.currentTarget.getBoundingClientRect();
    return e.clientY - rect.top < rect.height / 2 ? "reordenar" : "aninhar";
  };

  // --------------------------------------------------------------- grupos

  const dropGrupo = async (alvo: string, modo: "reordenar" | "aninhar") => {
    const origem = dragGrupo;
    setDragGrupo(null);
    setHoverNest(null);
    if (!origem || origem === alvo) return;

    if (modo === "aninhar") {
      try {
        const total = await contarExercicios(origem);
        const nCats = categoriasDoGrupo(origem).length;
        setConfirmMove({ kind: "grupo", origem, destino: alvo, total, cats: nCats });
      } catch (e: any) {
        toast.error(e.message || "Erro ao calcular a prévia");
      }
      return;
    }

    try {
      await reorderGrupos.mutateAsync(reordenar(grupos, origem, alvo));
    } catch (e: any) {
      toast.error(e.message || "Erro ao reordenar");
    }
  };

  // ----------------------------------------------------------- categorias

  const dropCategoria = async (alvo: string) => {
    const origem = dragCategoria;
    setDragCategoria(null);
    if (!origem || origem === alvo) return;
    try {
      await reorderCategorias.mutateAsync({
        grupo: selectedGrupo,
        novaOrdem: reordenar(cats, origem, alvo),
      });
    } catch (e: any) {
      toast.error(e.message || "Erro ao reordenar");
    }
  };

  const dropCategoriaEmGrupo = async (destino: string) => {
    const categoria = dragCategoria;
    setDragCategoria(null);
    setHoverAlvo(null);
    if (!categoria || !selectedGrupo || destino === selectedGrupo) return;
    try {
      const total = await contarExercicios(selectedGrupo, categoria);
      setConfirmMove({ kind: "categoria", grupo: selectedGrupo, categoria, destino, total });
    } catch (e: any) {
      toast.error(e.message || "Erro ao calcular a prévia");
    }
  };

  // --------------------------------------------------------- subcategorias

  const dropSub = async (alvo: string) => {
    const origem = dragSub;
    setDragSub(null);
    if (!origem || origem === alvo) return;
    try {
      await reorderSubs.mutateAsync({
        grupo: selectedGrupo,
        categoria: selectedCategoria,
        novaOrdem: reordenar(subs, origem, alvo),
      });
    } catch (e: any) {
      toast.error(e.message || "Erro ao reordenar");
    }
  };

  const dropSubEmCategoria = async (destinoGrupo: string, destinoCategoria: string) => {
    const sub = dragSub;
    setDragSub(null);
    setHoverAlvo(null);
    if (!sub || !selectedGrupo || !selectedCategoria) return;
    if (destinoGrupo === selectedGrupo && destinoCategoria === selectedCategoria) return;
    try {
      const total = await contarExercicios(selectedGrupo, selectedCategoria, sub);
      setConfirmMove({
        kind: "sub",
        grupo: selectedGrupo,
        categoria: selectedCategoria,
        sub,
        destinoGrupo,
        destinoCategoria,
        total,
      });
    } catch (e: any) {
      toast.error(e.message || "Erro ao calcular a prévia");
    }
  };

  /** Subcategoria sobe de nível: vira categoria do grupo destino */
  const dropSubEmGrupo = async (destinoGrupo: string) => {
    const sub = dragSub;
    setDragSub(null);
    setHoverAlvo(null);
    if (!sub || !selectedGrupo || !selectedCategoria) return;
    if (destinoGrupo === selectedGrupo && selectedCategoria === sub) return;
    try {
      const total = await contarExercicios(selectedGrupo, selectedCategoria, sub);
      setConfirmMove({
        kind: "promover-sub",
        grupo: selectedGrupo,
        categoria: selectedCategoria,
        sub,
        destinoGrupo,
        total,
      });
    } catch (e: any) {
      toast.error(e.message || "Erro ao calcular a prévia");
    }
  };

  /** Categoria sobe de nível: vira grupo próprio */
  const dropCategoriaPromover = async () => {
    const categoria = dragCategoria;
    setDragCategoria(null);
    setHoverAlvo(null);
    if (!categoria || !selectedGrupo) return;
    if (grupos.some((g) => g.toLowerCase() === categoria.toLowerCase())) {
      toast.error("Já existe um grupo com esse nome");
      return;
    }
    try {
      const total = await contarExercicios(selectedGrupo, categoria);
      setConfirmMove({
        kind: "promover-categoria",
        grupo: selectedGrupo,
        categoria,
        total,
        subs: subsDe(selectedGrupo, categoria).length,
      });
    } catch (e: any) {
      toast.error(e.message || "Erro ao calcular a prévia");
    }
  };

  const confirmarMovimento = async () => {
    if (!confirmMove) return;
    setMovendo(true);
    try {
      if (confirmMove.kind === "grupo") {
        const n = await moverGrupoComoCategoria.mutateAsync({
          grupoOrigem: confirmMove.origem,
          grupoDestino: confirmMove.destino,
        });
        if (selectedGrupo === confirmMove.origem) {
          setSelectedGrupo(confirmMove.destino);
          setSelectedCategoria(confirmMove.origem);
        }
        toast.success(
          `"${confirmMove.origem}" agora é categoria de "${confirmMove.destino}" (${n} exercício(s))`,
        );
      } else if (confirmMove.kind === "categoria") {
        const n = await moverCategoriaParaGrupo.mutateAsync({
          grupoOrigem: confirmMove.grupo,
          categoria: confirmMove.categoria,
          grupoDestino: confirmMove.destino,
        });
        toast.success(`${n} exercício(s) movidos para ${confirmMove.destino}`);
      } else if (confirmMove.kind === "promover-sub") {
        const n = await promoverSubParaCategoria.mutateAsync({
          grupoOrigem: confirmMove.grupo,
          categoriaOrigem: confirmMove.categoria,
          sub: confirmMove.sub,
          grupoDestino: confirmMove.destinoGrupo,
        });
        setSelectedGrupo(confirmMove.destinoGrupo);
        setSelectedCategoria(confirmMove.sub);
        toast.success(
          `"${confirmMove.sub}" agora é categoria de "${confirmMove.destinoGrupo}" (${n} exercício(s))`,
        );
      } else if (confirmMove.kind === "promover-categoria") {
        const n = await promoverCategoriaParaGrupo.mutateAsync({
          grupoOrigem: confirmMove.grupo,
          categoria: confirmMove.categoria,
        });
        setSelectedGrupo(confirmMove.categoria);
        setSelectedCategoria("");
        toast.success(`"${confirmMove.categoria}" agora é um grupo (${n} exercício(s))`);
      } else {
        const n = await moverSubParaCategoria.mutateAsync({
          grupoOrigem: confirmMove.grupo,
          categoriaOrigem: confirmMove.categoria,
          sub: confirmMove.sub,
          grupoDestino: confirmMove.destinoGrupo,
          categoriaDestino: confirmMove.destinoCategoria,
        });
        toast.success(`${n} exercício(s) movidos para ${confirmMove.destinoCategoria}`);
      }

      setConfirmMove(null);
    } catch (e: any) {
      toast.error(e.message || "Erro ao mover");
    } finally {
      setMovendo(false);
    }
  };

  // ---------------------------------------------------- editar / excluir

  const startEdit = (e: RowEdit) => {
    setEditing(e);
    setEditValue(e.oldName);
  };

  const saveEdit = async () => {
    if (!editing) return;
    const value = editValue.trim();
    const list =
      editing.kind === "grupo" ? grupos : editing.kind === "categoria" ? cats : subs;
    const err = validate(value, list, editing.oldName);
    if (err) return toast.error(err);
    try {
      if (editing.kind === "grupo") {
        await renomear.mutateAsync({ grupo: editing.oldName, novoNome: value });
        if (selectedGrupo === editing.oldName) setSelectedGrupo(value);
      } else if (editing.kind === "categoria") {
        await renomear.mutateAsync({
          grupo: editing.grupo,
          categoria: editing.oldName,
          novoNome: value,
        });
        if (selectedCategoria === editing.oldName) setSelectedCategoria(value);
      } else {
        await renomear.mutateAsync({
          grupo: editing.grupo,
          categoria: editing.categoria,
          subcategoria: editing.oldName,
          novoNome: value,
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
      } else if (confirmDel.kind === "categoria") {
        await deleteCategoria.mutateAsync({
          grupo: confirmDel.grupo,
          categoria: confirmDel.oldName,
        });
        if (selectedCategoria === confirmDel.oldName) setSelectedCategoria("");
      } else {
        await deleteSub.mutateAsync({
          grupo: confirmDel.grupo,
          categoria: confirmDel.categoria,
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
      toast.success("Grupo adicionado (com categoria e subcategoria padrão)");
    } catch (e: any) {
      toast.error(e.message || "Erro ao adicionar");
    }
  };

  const handleAddCategoria = async () => {
    if (!selectedGrupo) return toast.error("Selecione um grupo");
    const err = validate(newCategoria, cats);
    if (err) return toast.error(err);
    try {
      await addCategoria.mutateAsync({ grupo: selectedGrupo, categoria: newCategoria.trim() });
      setNewCategoria("");
      toast.success("Categoria adicionada");
    } catch (e: any) {
      toast.error(e.message || "Erro ao adicionar");
    }
  };

  const handleAddSub = async () => {
    if (!selectedGrupo || !selectedCategoria) return toast.error("Selecione grupo e categoria");
    const err = validate(newSub, subs);
    if (err) return toast.error(err);
    try {
      await addSub.mutateAsync({
        grupo: selectedGrupo,
        categoria: selectedCategoria,
        subcategoria: newSub.trim(),
      });
      setNewSub("");
      toast.success("Subcategoria adicionada");
    } catch (e: any) {
      toast.error(e.message || "Erro ao adicionar");
    }
  };

  const abas: { key: typeof tab; label: string }[] = [
    { key: "grupos", label: "Grupos" },
    { key: "categorias", label: "Categorias" },
    { key: "subs", label: "Subcategorias" },
  ];

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Gerenciar Categorias</DialogTitle>
            <DialogDescription>
              Estrutura em três níveis: Grupo &gt; Categoria &gt; Subcategoria &gt; exercícios.
            </DialogDescription>
          </DialogHeader>

          <div className="flex gap-2 border-b border-border">
            {abas.map((a) => (
              <button
                key={a.key}
                type="button"
                onClick={() => setTab(a.key)}
                className={`px-3 py-2 text-sm font-medium border-b-2 transition-colors ${
                  tab === a.key
                    ? "border-primary text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                {a.label}
              </button>
            ))}
          </div>

          {/* ------------------------------------------------------ GRUPOS */}
          {tab === "grupos" && (
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
                Arraste na metade <strong>de cima</strong> de outro grupo para reordenar, ou na
                metade <strong>de baixo</strong> para colocar a pasta dentro dele — o grupo
                arrastado vira uma <strong>categoria</strong> do destino, com todo o conteúdo.
              </p>
              <div className="space-y-1">
                {grupos.length === 0 && (
                  <p className="text-sm text-muted-foreground py-4 text-center">
                    Nenhum grupo cadastrado
                  </p>
                )}
                {tree.map((g) => {
                  const isEditing = editing?.kind === "grupo" && editing.oldName === g.nome;
                  return (
                    <div
                      key={g.nome}
                      className={`glass-card rounded-md p-2 flex items-center gap-2 transition-shadow ${
                        dragGrupo === g.nome ? "opacity-50" : ""
                      } ${hoverNest === g.nome ? "ring-2 ring-primary" : ""}`}
                      draggable={!isEditing}
                      onDragStart={() => setDragGrupo(g.nome)}
                      onDragEnd={() => {
                        setDragGrupo(null);
                        setHoverNest(null);
                      }}
                      onDragOver={(e) => {
                        e.preventDefault();
                        if (!dragGrupo || dragGrupo === g.nome) return;
                        setHoverNest(zonaDeSoltura(e) === "aninhar" ? g.nome : null);
                      }}
                      onDragLeave={() => setHoverNest((h) => (h === g.nome ? null : h))}
                      onDrop={(e) => dropGrupo(g.nome, zonaDeSoltura(e))}
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
                          <Button size="icon" variant="ghost" onClick={() => setEditing(null)}>
                            <X className="w-4 h-4" />
                          </Button>
                        </>
                      ) : (
                        <>
                          <span className="flex-1 text-sm">
                            {g.nome}
                            <span className="ml-2 text-xs text-muted-foreground">
                              {g.categorias.length} categoria(s)
                            </span>
                          </span>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => startEdit({ kind: "grupo", oldName: g.nome })}
                            aria-label="Renomear grupo"
                          >
                            <Pencil className="w-4 h-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => setConfirmDel({ kind: "grupo", oldName: g.nome })}
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
          )}

          {/* -------------------------------------------------- CATEGORIAS */}
          {tab === "categorias" && (
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
                      placeholder="Nova categoria"
                      value={newCategoria}
                      onChange={(e) => setNewCategoria(e.target.value)}
                      maxLength={80}
                    />
                    <Button onClick={handleAddCategoria} disabled={addCategoria.isPending}>
                      {addCategoria.isPending ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Plus className="w-4 h-4" />
                      )}
                      Adicionar
                    </Button>
                  </div>

                  <div className="space-y-1">
                    {cats.length === 0 && (
                      <p className="text-sm text-muted-foreground py-4 text-center">
                        Nenhuma categoria
                      </p>
                    )}
                    {cats.map((c) => {
                      const isEditing =
                        editing?.kind === "categoria" &&
                        editing.grupo === selectedGrupo &&
                        editing.oldName === c;
                      return (
                        <div
                          key={c}
                          className={`glass-card rounded-md p-2 flex items-center gap-2 ${
                            dragCategoria === c ? "opacity-50" : ""
                          }`}
                          draggable={!isEditing}
                          onDragStart={() => setDragCategoria(c)}
                          onDragEnd={() => setDragCategoria(null)}
                          onDragOver={(e) => e.preventDefault()}
                          onDrop={() => dropCategoria(c)}
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
                              <Button size="icon" variant="ghost" onClick={() => setEditing(null)}>
                                <X className="w-4 h-4" />
                              </Button>
                            </>
                          ) : (
                            <>
                              <span className="flex-1 text-sm flex items-center gap-2">
                                {siglaEdit === c ? (
                                  <Input
                                    value={siglaValue}
                                    onChange={(e) => setSiglaValue(e.target.value.toUpperCase())}
                                    onBlur={() => salvarSigla(c)}
                                    onKeyDown={(e) => {
                                      if (e.key === "Enter") salvarSigla(c);
                                      if (e.key === "Escape") setSiglaEdit(null);
                                    }}
                                    maxLength={8}
                                    autoFocus
                                    className="h-6 w-20 text-[11px] font-mono"
                                  />
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setSiglaValue(siglaDe(selectedGrupo, c));
                                      setSiglaEdit(c);
                                    }}
                                    title="Editar sigla usada nas prescrições"
                                    className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded border border-border text-muted-foreground hover:text-foreground"
                                  >
                                    {siglaDe(selectedGrupo, c)}
                                  </button>
                                )}
                                {c}
                                <span className="ml-1 text-xs text-muted-foreground">
                                  {subsDe(selectedGrupo, c).length} subcategoria(s)
                                </span>
                              </span>
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() =>
                                  startEdit({ kind: "categoria", grupo: selectedGrupo, oldName: c })
                                }
                                aria-label="Renomear categoria"
                              >
                                <Pencil className="w-4 h-4" />
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() =>
                                  setConfirmDel({
                                    kind: "categoria",
                                    grupo: selectedGrupo,
                                    oldName: c,
                                  })
                                }
                                aria-label="Excluir categoria"
                              >
                                <Trash2 className="w-4 h-4 text-destructive" />
                              </Button>
                            </>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  <div className="space-y-2 pt-2 border-t border-border">
                    <Label>Mover categoria para outro grupo</Label>
                    <p className="text-xs text-muted-foreground">
                      Arraste uma categoria acima e solte sobre um grupo abaixo — subcategorias e
                      exercícios vão junto.
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {grupos
                        .filter((g) => g !== selectedGrupo)
                        .map((g) => (
                          <div
                            key={g}
                            onDragOver={(e) => {
                              e.preventDefault();
                              setHoverAlvo(g);
                            }}
                            onDragLeave={() => setHoverAlvo((h) => (h === g ? null : h))}
                            onDrop={() => dropCategoriaEmGrupo(g)}
                            className={`rounded-md border border-dashed px-3 py-2 text-sm transition-colors ${
                              hoverAlvo === g
                                ? "border-primary bg-primary/10 text-foreground"
                                : "border-border text-muted-foreground"
                            }`}
                          >
                            {g}
                          </div>
                        ))}
                    </div>
                  </div>

                  <div className="space-y-2 pt-2 border-t border-border">
                    <Label>Promover categoria a grupo</Label>
                    <p className="text-xs text-muted-foreground">
                      Arraste uma categoria acima e solte aqui — ela sobe um nível e passa a ser um
                      grupo próprio, mantendo subcategorias e exercícios.
                    </p>
                    <div
                      onDragOver={(e) => {
                        e.preventDefault();
                        setHoverAlvo("promover-categoria");
                      }}
                      onDragLeave={() =>
                        setHoverAlvo((h) => (h === "promover-categoria" ? null : h))
                      }
                      onDrop={dropCategoriaPromover}
                      className={`rounded-md border border-dashed px-3 py-4 text-sm text-center transition-colors ${
                        hoverAlvo === "promover-categoria"
                          ? "border-primary bg-primary/10 text-foreground"
                          : "border-border text-muted-foreground"
                      }`}
                    >
                      ↑ Promover a grupo
                    </div>
                  </div>

                </>
              )}
            </div>
          )}

          {/* ------------------------------------------------ SUBCATEGORIAS */}
          {tab === "subs" && (
            <div className="space-y-3">
              <div className="grid gap-2 sm:grid-cols-2">
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
                <div>
                  <Label>Categoria</Label>
                  <Select
                    value={selectedCategoria}
                    onValueChange={setSelectedCategoria}
                    disabled={!selectedGrupo}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione uma categoria" />
                    </SelectTrigger>
                    <SelectContent>
                      {cats.map((c) => (
                        <SelectItem key={c} value={c}>
                          {c}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {selectedGrupo && selectedCategoria && (
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
                        editing.categoria === selectedCategoria &&
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
                              <Button size="icon" variant="ghost" onClick={() => setEditing(null)}>
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
                                    categoria: selectedCategoria,
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
                                    categoria: selectedCategoria,
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

                  <div className="space-y-2 pt-2 border-t border-border">
                    <Label>Mover subcategoria para outra categoria</Label>
                    <p className="text-xs text-muted-foreground">
                      Arraste uma subcategoria acima e solte sobre uma categoria abaixo — os
                      exercícios vão junto.
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {tree.flatMap((g) =>
                        g.categorias
                          .filter(
                            (c) => !(g.nome === selectedGrupo && c.nome === selectedCategoria),
                          )
                          .map((c) => {
                            const key = `${g.nome}///${c.nome}`;
                            return (
                              <div
                                key={key}
                                onDragOver={(e) => {
                                  e.preventDefault();
                                  setHoverAlvo(key);
                                }}
                                onDragLeave={() => setHoverAlvo((h) => (h === key ? null : h))}
                                onDrop={() => dropSubEmCategoria(g.nome, c.nome)}
                                className={`rounded-md border border-dashed px-3 py-2 text-xs transition-colors ${
                                  hoverAlvo === key
                                    ? "border-primary bg-primary/10 text-foreground"
                                    : "border-border text-muted-foreground"
                                }`}
                              >
                                {g.nome} › {c.nome}
                              </div>
                            );
                          }),
                      )}
                    </div>
                  </div>

                  <div className="space-y-2 pt-2 border-t border-border">
                    <Label>Promover subcategoria a categoria</Label>
                    <p className="text-xs text-muted-foreground">
                      Arraste uma subcategoria acima e solte sobre um grupo abaixo — ela sobe um
                      nível e vira categoria desse grupo, levando os exercícios.
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {grupos.map((g) => {
                        const key = `promover-sub///${g}`;
                        return (
                          <div
                            key={key}
                            onDragOver={(e) => {
                              e.preventDefault();
                              setHoverAlvo(key);
                            }}
                            onDragLeave={() => setHoverAlvo((h) => (h === key ? null : h))}
                            onDrop={() => dropSubEmGrupo(g)}
                            className={`rounded-md border border-dashed px-3 py-2 text-xs transition-colors ${
                              hoverAlvo === key
                                ? "border-primary bg-primary/10 text-foreground"
                                : "border-border text-muted-foreground"
                            }`}
                          >
                            ↑ {g}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                </>
              )}
            </div>
          )}

        </DialogContent>
      </Dialog>

      <AlertDialog open={!!confirmDel} onOpenChange={(o) => !o && setConfirmDel(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              {confirmDel?.kind === "grupo"
                ? `Excluir o grupo "${confirmDel.oldName}" e todo o seu conteúdo? Não será possível se houver exercícios vinculados.`
                : confirmDel?.kind === "categoria"
                  ? `Excluir a categoria "${confirmDel.oldName}" e suas subcategorias? Não será possível se houver exercícios vinculados.`
                  : `Excluir a subcategoria "${confirmDel?.oldName}"? Não será possível se houver exercícios vinculados.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!confirmMove} onOpenChange={(o) => !o && !movendo && setConfirmMove(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmMove?.kind === "promover-sub" || confirmMove?.kind === "promover-categoria"
                ? "Promover nível"
                : "Mover para dentro"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmMove?.kind === "grupo"
                ? `Mover "${confirmMove.origem}" (${confirmMove.cats} categoria(s), ${confirmMove.total} exercício(s)) para dentro de "${confirmMove.destino}"? "${confirmMove.origem}" passa a ser uma categoria de "${confirmMove.destino}", mantendo subcategorias e exercícios.`
                : confirmMove?.kind === "categoria"
                  ? `Mover a categoria "${confirmMove.categoria}" e seus ${confirmMove.total} exercício(s) de "${confirmMove.grupo}" para "${confirmMove.destino}"?`
                  : confirmMove?.kind === "promover-sub"
                    ? `Promover a subcategoria "${confirmMove.sub}" (${confirmMove.total} exercício(s)) a categoria de "${confirmMove.destinoGrupo}"? Ela deixa de ficar dentro de "${confirmMove.grupo} › ${confirmMove.categoria}".`
                    : confirmMove?.kind === "promover-categoria"
                      ? `Promover a categoria "${confirmMove.categoria}" (${confirmMove.subs} subcategoria(s), ${confirmMove.total} exercício(s)) a grupo próprio? Ela deixa de ficar dentro de "${confirmMove.grupo}".`
                      : confirmMove
                        ? `Mover a subcategoria "${confirmMove.sub}" e seus ${confirmMove.total} exercício(s) para "${confirmMove.destinoGrupo} › ${confirmMove.destinoCategoria}"?`
                        : ""}

            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={movendo}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                confirmarMovimento();
              }}
              disabled={movendo}
            >
              {movendo ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              Mover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
