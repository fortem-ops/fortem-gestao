import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Plus, Save, Trash2, Loader2, Eye, EyeOff, FlipHorizontal, ArrowLeftRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { AnatomyFront } from "@/components/student/assessment/funcionalV2/anatomy/AnatomyFront";
import { AnatomyBack } from "@/components/student/assessment/funcionalV2/anatomy/AnatomyBack";
import { pointsToSmoothPath, bestInsertionIndex } from "@/components/student/assessment/funcionalV2/pointsToPath";
import { useBodyMapShapes, type BodyMapShape } from "@/components/student/assessment/funcionalV2/useBodyMapShapes";

const VIEWBOX = { w: 1024, h: 1024 };

function hexagon(cx: number, cy: number, r: number): Array<[number, number]> {
  return Array.from({ length: 6 }, (_, i) => {
    const a = (Math.PI / 3) * i - Math.PI / 2;
    return [Math.round(cx + r * Math.cos(a)), Math.round(cy + r * Math.sin(a))] as [number, number];
  });
}

export default function BodyMapShapesConfig() {
  const { shapes, isLoading, saveShape, createShape, deleteShape } = useBodyMapShapes();
  const [view, setView] = useState<"front" | "back">("front");
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [editingPoints, setEditingPoints] = useState<Array<[number, number]>>([]);
  const [selectedPoint, setSelectedPoint] = useState<number | null>(null);
  const [dialogKind, setDialogKind] = useState<"musculo" | "articulacao" | null>(null);
  const [newKey, setNewKey] = useState("");
  const [newLabel, setNewLabel] = useState("");
  const [pointsHidden, setPointsHidden] = useState(false);
  const [peeking, setPeeking] = useState(false);
  const showPoints = !pointsHidden && !peeking;

  useEffect(() => {
    function isTyping(t: EventTarget | null) {
      const el = t as HTMLElement | null;
      if (!el || !el.tagName) return false;
      const tag = el.tagName.toLowerCase();
      return tag === "input" || tag === "textarea" || el.isContentEditable;
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.repeat || isTyping(e.target) || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key.toLowerCase() === "h") setPeeking(true);
    }
    function onKeyUp(e: KeyboardEvent) {
      if (e.key.toLowerCase() === "h") setPeeking(false);
    }
    function onBlur() {
      setPeeking(false);
    }
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("blur", onBlur);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", onBlur);
    };
  }, []);


  const svgRef = useRef<SVGSVGElement>(null);
  const draggingRef = useRef<number | null>(null);

  const viewShapes = useMemo(() => shapes.filter((s) => s.view === view), [shapes, view]);
  const musculos = viewShapes.filter((s) => s.kind === "musculo");
  const articulacoes = viewShapes.filter((s) => s.kind === "articulacao");
  const selected = shapes.find((s) => s.shape_key === selectedKey) ?? null;

  function selectShape(s: BodyMapShape) {
    setSelectedKey(s.shape_key);
    setEditingPoints(s.points.map((p) => [p[0], p[1]] as [number, number]));
    setSelectedPoint(null);
  }

  function toViewBox(clientX: number, clientY: number) {
    const svg = svgRef.current;
    if (!svg) return null;
    const rect = svg.getBoundingClientRect();
    const x = ((clientX - rect.left) / rect.width) * VIEWBOX.w;
    const y = ((clientY - rect.top) / rect.height) * VIEWBOX.h;
    return {
      x: Math.round(Math.max(0, Math.min(VIEWBOX.w, x))),
      y: Math.round(Math.max(0, Math.min(VIEWBOX.h, y))),
    };
  }

  function handleDoubleClick(e: React.MouseEvent) {
    if (!selected || !showPoints) return;
    const p = toViewBox(e.clientX, e.clientY);
    if (!p) return;
    const point: [number, number] = [p.x, p.y];
    const i = bestInsertionIndex(editingPoints, point);
    const next = [...editingPoints];
    next.splice(i, 0, point);
    setEditingPoints(next);
    setSelectedPoint(i);
  }

  function removeSelectedPoint() {
    if (selectedPoint === null || editingPoints.length <= 3) return;
    setEditingPoints(editingPoints.filter((_, i) => i !== selectedPoint));
    setSelectedPoint(null);
  }

  async function handleSave() {
    if (!selected) return;
    try {
      await saveShape.mutateAsync({ ...selected, points: editingPoints });
      toast.success("Contorno salvo.");
    } catch (e: any) {
      toast.error(e.message || "Erro ao salvar contorno.");
    }
  }

  async function handleDelete() {
    if (!selected) return;
    if (!confirm(`Excluir a forma "${selected.label}"? Esta ação não pode ser desfeita.`)) return;
    try {
      await deleteShape.mutateAsync(selected.shape_key);
      setSelectedKey(null);
      setEditingPoints([]);
      toast.success("Forma excluída.");
    } catch (e: any) {
      toast.error(e.message || "Erro ao excluir.");
    }
  }

  async function handleCreate() {
    if (!dialogKind) return;
    const key = newKey.trim();
    const label = newLabel.trim();
    if (!key || !label) {
      toast.error("Preencha a chave e o rótulo.");
      return;
    }
    try {
      await createShape.mutateAsync({
        shape_key: key,
        label,
        view,
        kind: dialogKind,
        points: hexagon(512, 400, 60),
      });
      toast.success("Forma criada.");
      setDialogKind(null);
      setNewKey("");
      setNewLabel("");
      setSelectedKey(key);
      setEditingPoints(hexagon(512, 400, 60));
      setSelectedPoint(null);
    } catch (e: any) {
      toast.error(e.message || "Erro ao criar forma.");
    }
  }

  function ShapeList({ title, items }: { title: string; items: BodyMapShape[] }) {
    return (
      <div className="space-y-1.5">
        <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground font-semibold">{title}</p>
        {items.length === 0 && <p className="text-xs text-muted-foreground">Nenhuma forma nesta vista.</p>}
        {items.map((s) => (
          <button
            key={s.shape_key}
            onClick={() => selectShape(s)}
            className={`w-full text-left px-2.5 py-1.5 rounded-md text-xs transition-colors ${
              s.shape_key === selectedKey
                ? "bg-primary/15 text-foreground border border-primary/40"
                : "text-muted-foreground hover:bg-muted border border-transparent"
            }`}
          >
            <span className="block font-medium">{s.label}</span>
            <span className="block text-[10px] opacity-60 font-mono">{s.shape_key}</span>
          </button>
        ))}
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-heading font-bold">Config. Mapa Corporal</h1>
          <p className="text-sm text-muted-foreground">
            Edite os contornos musculares e articulares ponto a ponto.
          </p>
        </div>
        <div className="inline-flex p-1 rounded-lg bg-muted">
          {(["front", "back"] as const).map((v) => (
            <button
              key={v}
              onClick={() => { setView(v); setSelectedKey(null); setEditingPoints([]); }}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                view === v ? "bg-background shadow-sm text-foreground" : "text-muted-foreground"
              }`}
            >
              {v === "front" ? "Vista anterior" : "Vista posterior"}
            </button>
          ))}
        </div>
      </header>

      {isLoading ? (
        <div className="flex items-center gap-2 text-muted-foreground text-sm">
          <Loader2 className="w-4 h-4 animate-spin" /> Carregando formas...
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-5">
          <Card className="p-4 flex flex-col items-center">
            <svg
              ref={svgRef}
              viewBox={`0 0 ${VIEWBOX.w} ${VIEWBOX.h}`}
              className="w-full max-w-[620px] h-auto rounded-xl overflow-hidden select-none"
              style={{ touchAction: "none" }}
              onDoubleClick={handleDoubleClick}
            >
              {view === "front" ? <AnatomyFront /> : <AnatomyBack />}

              {selected && editingPoints.length >= 3 && (
                <path
                  d={pointsToSmoothPath(editingPoints)}
                  fill="hsl(var(--primary))"
                  fillOpacity={0.35}
                  stroke="hsl(var(--primary))"
                  strokeWidth={2}
                />
              )}

              {selected && showPoints &&
                editingPoints.map((p, i) => (
                  <circle
                    key={i}
                    cx={p[0]}
                    cy={p[1]}
                    r={8}
                    fill="hsl(var(--primary))"
                    stroke={selectedPoint === i ? "white" : "hsl(var(--primary-foreground))"}
                    strokeWidth={selectedPoint === i ? 4 : 1.5}
                    style={{ cursor: "move" }}
                    onPointerDown={(e) => {
                      (e.currentTarget as Element).setPointerCapture(e.pointerId);
                      draggingRef.current = i;
                      setSelectedPoint(i);
                      e.stopPropagation();
                    }}
                    onPointerMove={(e) => {
                      if (draggingRef.current !== i) return;
                      const pt = toViewBox(e.clientX, e.clientY);
                      if (!pt) return;
                      setEditingPoints((prev) => prev.map((q, j) => (j === i ? [pt.x, pt.y] : q)));
                    }}
                    onPointerUp={(e) => {
                      draggingRef.current = null;
                      try { (e.currentTarget as Element).releasePointerCapture(e.pointerId); } catch { /* noop */ }
                    }}
                  />
                ))}
            </svg>
            <p className="text-[11px] text-muted-foreground mt-3 text-center">
              Selecione uma forma na lista. Arraste os pontos para moldar; duplo-clique na imagem adiciona um ponto.
              <br />
              Segure <kbd className="px-1 py-0.5 rounded border text-[10px] font-mono">H</kbd> para ocultar os pontos e conferir o tracejado.
            </p>
          </Card>

          <div className="space-y-4">
            <div className="flex gap-2">
              <Button size="sm" variant="outline" className="flex-1" onClick={() => setDialogKind("musculo")}>
                <Plus className="w-3.5 h-3.5 mr-1" /> Músculo
              </Button>
              <Button size="sm" variant="outline" className="flex-1" onClick={() => setDialogKind("articulacao")}>
                <Plus className="w-3.5 h-3.5 mr-1" /> Articulação
              </Button>
            </div>

            {selected && (
              <Card className="p-3 space-y-2">
                <p className="text-xs font-semibold">{selected.label}</p>
                <p className="text-[10px] text-muted-foreground">{editingPoints.length} ponto(s)</p>
                <div className="flex flex-col gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setPointsHidden((v) => !v)}
                  >
                    {pointsHidden ? (
                      <><Eye className="w-3.5 h-3.5 mr-1" /> Mostrar pontos</>
                    ) : (
                      <><EyeOff className="w-3.5 h-3.5 mr-1" /> Ocultar pontos</>
                    )}
                  </Button>
                  <Button size="sm" onClick={handleSave} disabled={saveShape.isPending}>
                    <Save className="w-3.5 h-3.5 mr-1" />
                    {saveShape.isPending ? "Salvando..." : "Salvar contorno"}
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={removeSelectedPoint}
                    disabled={selectedPoint === null || editingPoints.length <= 3}
                  >
                    Remover ponto selecionado
                  </Button>
                  <Button size="sm" variant="destructive" onClick={handleDelete} disabled={deleteShape.isPending}>
                    <Trash2 className="w-3.5 h-3.5 mr-1" /> Excluir forma
                  </Button>
                </div>
              </Card>
            )}

            <Card className="p-3 space-y-4 max-h-[60vh] overflow-y-auto">
              <ShapeList title="Músculos" items={musculos} />
              <ShapeList title="Articulações" items={articulacoes} />
            </Card>
          </div>
        </div>
      )}

      <Dialog open={dialogKind !== null} onOpenChange={(o) => !o && setDialogKind(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {dialogKind === "articulacao" ? "Nova articulação" : "Novo músculo"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="shape-key">Chave (shape_key)</Label>
              <Input
                id="shape-key"
                value={newKey}
                onChange={(e) => setNewKey(e.target.value)}
                placeholder="trapezio-esquerdo"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="shape-label">Rótulo</Label>
              <Input
                id="shape-label"
                value={newLabel}
                onChange={(e) => setNewLabel(e.target.value)}
                placeholder="Trapézio esquerdo"
              />
            </div>
            <p className="text-[11px] text-muted-foreground">
              Será criado na {view === "front" ? "vista anterior" : "vista posterior"} com um hexágono inicial.
            </p>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDialogKind(null)}>Cancelar</Button>
            <Button onClick={handleCreate} disabled={createShape.isPending}>
              {createShape.isPending ? "Criando..." : "Criar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
