import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, TouchSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, arrayMove, rectSortingStrategy, sortableKeyboardCoordinates, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ArrowDown, ArrowUp, GripVertical, Heart, ImagePlus, MessageCircle, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { festa10AnosConfig as cfg } from "@/config/festa10anos";
import { agruparFotosPorAno, carregarFestaFotos, reduzirFoto, LINK_FIXO_SEGUNDOS, type FestaFoto } from "@/lib/festaFotos";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

const TIPOS = ["image/jpeg", "image/png", "image/webp"];
const MAX = 10 * 1024 * 1024;

export default function FestaFotosAdmin() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [enviando, setEnviando] = useState<string | null>(null);
  const [remover, setRemover] = useState<FestaFoto | null>(null);
  const { data: fotos = [], isLoading } = useQuery({ queryKey: ["festa-fotos"], queryFn: carregarFestaFotos });
  const porAno = agruparFotosPorAno(fotos);
  const atualizar = () => qc.invalidateQueries({ queryKey: ["festa-fotos"] });
  const { data: inter = {} } = useQuery({ queryKey: ["festa-fotos-inter"], queryFn: async () => {
    const { data, error } = await supabase.rpc("fn_festa_fotos_interacoes" as any, {});
    if (error) throw error; return (data ?? {}) as Record<string, { curtidas: number; comentarios: { id: string; nome: string; texto: string }[] }>;
  } });
  const [apagarCom, setApagarCom] = useState<{ id: string; texto: string } | null>(null);
  async function confirmarApagarCom() {
    if (!apagarCom) return;
    const { error } = await supabase.from("festa_fotos_comentarios").delete().eq("id", apagarCom.id);
    if (error) toast.error("Não foi possível apagar."); else toast.success("Comentário apagado.");
    setApagarCom(null); qc.invalidateQueries({ queryKey: ["festa-fotos-inter"] });
  }

  async function enviar(ano: string, files: FileList | null) {
    if (!files?.length) return;
    setEnviando(ano);
    let ordem = (porAno[ano]?.at(-1)?.ordem ?? -1) + 1;
    try {
      for (const original of Array.from(files)) {
        if (!TIPOS.includes(original.type)) { toast.error(`${original.name}: use JPG, PNG ou WebP.`); continue; }
        if (original.size > MAX) { toast.error(`${original.name}: máximo 10 MB.`); continue; }
        const file = await reduzirFoto(original);
        const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
        const caminho = `${ano}/${crypto.randomUUID()}.${ext}`;
        const up = await supabase.storage.from("festa-fotos").upload(caminho, file, { contentType: file.type });
        if (up.error) { toast.error(`${file.name}: falha no envio.`); continue; }
        const { data: link } = await supabase.storage.from("festa-fotos").createSignedUrl(caminho, LINK_FIXO_SEGUNDOS);
        const { error } = await supabase.from("festa_fotos").insert({ ano, url: link?.signedUrl ?? caminho, caminho, alt: null, ordem: ordem++, criado_por: user?.id });
        if (error) { await supabase.storage.from("festa-fotos").remove([caminho]); toast.error(`${file.name}: não foi possível salvar.`); }
      }
      toast.success("Fotos atualizadas.");
    } finally { setEnviando(null); atualizar(); }
  }

  const salvarAlt = useMutation({
    mutationFn: async ({ id, alt }: { id: string; alt: string }) => {
      const { error } = await supabase.from("festa_fotos").update({ alt: alt.trim() || null }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Descrição salva."); atualizar(); },
    onError: () => toast.error("Não foi possível salvar a descrição."),
  });

  async function mover(lista: FestaFoto[], i: number, dir: -1 | 1) {
    const a = lista[i], b = lista[i + dir];
    if (!a || !b) return;
    const r = await Promise.all([
      supabase.from("festa_fotos").update({ ordem: b.ordem === a.ordem ? a.ordem + dir : b.ordem }).eq("id", a.id),
      supabase.from("festa_fotos").update({ ordem: a.ordem }).eq("id", b.id),
    ]);
    if (r.some((x) => x.error)) toast.error("Não foi possível mudar a ordem.");
    atualizar();
  }

  const [salvandoOrdem, setSalvandoOrdem] = useState(false);
  const sensores = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  async function soltar(lista: FestaFoto[], e: DragEndEvent) {
    const de = lista.findIndex((f) => f.id === e.active.id), para = lista.findIndex((f) => f.id === e.over?.id);
    if (de < 0 || para < 0 || de === para) return;
    const nova = arrayMove(lista, de, para);
    qc.setQueryData<FestaFoto[]>(["festa-fotos"], (old) => (old ?? []).map((f) => { const i = nova.findIndex((n) => n.id === f.id); return i >= 0 ? { ...f, ordem: i } : f; }));
    setSalvandoOrdem(true);
    try {
      const r = await Promise.all(nova.map((f, i) => f.ordem === i ? null : supabase.from("festa_fotos").update({ ordem: i }).eq("id", f.id)));
      if (r.some((x) => x?.error)) toast.error("Não foi possível salvar a nova ordem."); else toast.success("Ordem salva.");
    } finally { setSalvandoOrdem(false); atualizar(); }
  }

  async function confirmarRemocao() {
    if (!remover) return;
    const { error } = await supabase.from("festa_fotos").delete().eq("id", remover.id);
    if (error) toast.error("Não foi possível remover.");
    else { if (remover.caminho) await supabase.storage.from("festa-fotos").remove([remover.caminho]); toast.success("Foto removida."); }
    setRemover(null); atualizar();
  }

  if (isLoading) return <p className="text-sm text-muted-foreground">Carregando fotos…</p>;

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">As fotos aparecem na linha do tempo da página da festa. Anos com mais de uma foto viram slide.</p>
      {cfg.historia.anos.map(({ ano }) => {
        const lista = porAno[ano] ?? [];
        return (
          <Card key={ano} className="p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h3 className="text-xl font-bold">{ano} <span className="text-sm font-normal text-muted-foreground">· {lista.length} foto(s)</span></h3>
              <Button variant="outline" size="sm" asChild disabled={enviando === ano}>
                <label className="cursor-pointer">
                  <ImagePlus className="mr-2 h-4 w-4" />{enviando === ano ? "Enviando…" : "Adicionar fotos"}
                  <input type="file" accept={TIPOS.join(",")} multiple className="sr-only" disabled={!!enviando} onChange={(e) => { enviar(ano, e.target.files); e.target.value = ""; }} />
                </label>
              </Button>
            </div>
            {lista.length > 0 && (
              <DndContext sensors={sensores} collisionDetection={closestCenter} onDragEnd={(e) => soltar(lista, e)}>
              <SortableContext items={lista.map((f) => f.id)} strategy={rectSortingStrategy} disabled={salvandoOrdem}>
              <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {lista.map((f, i) => (
                  <Arrastavel key={f.id} id={f.id} rotulo={`Arrastar foto ${i + 1} de ${ano}`}>
                    <img loading="lazy" src={f.url} alt={f.alt ?? ""} className="aspect-[4/3] w-full bg-muted object-contain" />
                    <Input defaultValue={f.alt ?? ""} placeholder="Descrição da foto" aria-label={`Descrição da foto ${i + 1} de ${ano}`}
                      onBlur={(e) => { if ((e.target.value.trim() || null) !== f.alt) salvarAlt.mutate({ id: f.id, alt: e.target.value }); }} />
                    <div className="flex gap-4 text-sm text-muted-foreground">
                      <span className="inline-flex items-center gap-1"><Heart className="h-4 w-4" />{inter[f.id]?.curtidas ?? 0}</span>
                      <span className="inline-flex items-center gap-1"><MessageCircle className="h-4 w-4" />{inter[f.id]?.comentarios.length ?? 0}</span>
                    </div>
                    {(inter[f.id]?.comentarios ?? []).length > 0 && (
                      <ul className="max-h-40 space-y-1 overflow-y-auto text-sm">
                        {inter[f.id].comentarios.map((c) => (
                          <li key={c.id} className="flex items-start gap-2"><span className="flex-1 break-words"><strong>{c.nome}</strong> {c.texto}</span>
                            <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" aria-label="Apagar comentário" onClick={() => setApagarCom(c)}><Trash2 className="h-3.5 w-3.5" /></Button></li>
                        ))}
                      </ul>
                    )}
                    <div className="flex gap-1">
                      <Button size="icon" variant="ghost" aria-label="Mover para antes" disabled={i === 0} onClick={() => mover(lista, i, -1)}><ArrowUp className="h-4 w-4" /></Button>
                      <Button size="icon" variant="ghost" aria-label="Mover para depois" disabled={i === lista.length - 1} onClick={() => mover(lista, i, 1)}><ArrowDown className="h-4 w-4" /></Button>
                      <Button size="sm" variant="ghost" className="ml-auto text-destructive" onClick={() => setRemover(f)}><Trash2 className="mr-1 h-4 w-4" />Remover</Button>
                    </div>
                  </Arrastavel>
                ))}
              </div>
              </SortableContext>
              </DndContext>
            )}
          </Card>
        );
      })}
      <AlertDialog open={!!apagarCom} onOpenChange={(o) => !o && setApagarCom(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Apagar este comentário?</AlertDialogTitle>
            <AlertDialogDescription>Ele sai da página da festa na hora.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Voltar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmarApagarCom}>Apagar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <AlertDialog open={!!remover} onOpenChange={(o) => !o && setRemover(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover esta foto?</AlertDialogTitle>
            <AlertDialogDescription>Ela sai da página da festa na hora.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Voltar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmarRemocao}>Remover</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function Arrastavel({ id, rotulo, children }: { id: string; rotulo: string; children: React.ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  return (
    <div ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`relative space-y-2 border border-border bg-card p-2 ${isDragging ? "z-10 opacity-80 shadow-lg" : ""}`}>
      <button type="button" {...attributes} {...listeners} aria-label={rotulo}
        className="absolute left-3 top-3 z-10 flex h-11 w-11 cursor-grab touch-none items-center justify-center rounded-md bg-background/80 text-foreground active:cursor-grabbing">
        <GripVertical className="h-5 w-5" />
      </button>
      {children}
    </div>
  );
}
