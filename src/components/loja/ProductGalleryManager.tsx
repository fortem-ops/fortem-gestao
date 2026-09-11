import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { GripVertical, ImageIcon, Star, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { ProductImageUpload } from "./ProductImageUpload";

type GalleryImage = {
  id: string;
  produto_id: string;
  cor: string | null;
  imagem_url: string;
  legenda: string | null;
  ordem: number;
  principal: boolean;
};

interface Props {
  produtoId: string;
  cor?: string | null;
  onPrincipalChange?: (url: string) => void;
}

export function ProductGalleryManager({ produtoId, cor = null, onPrincipalChange }: Props) {
  const qc = useQueryClient();
  const key = ["loja-galeria-admin", produtoId, cor ?? "geral"];
  const [url, setUrl] = useState("");
  const [legenda, setLegenda] = useState("");
  const [uploading, setUploading] = useState(false);
  const [dragId, setDragId] = useState<string | null>(null);

  const { data: imagens = [] } = useQuery({
    queryKey: key,
    queryFn: async () => {
      let query = (supabase as any)
        .from("produtos_imagens")
        .select("id,produto_id,cor,imagem_url,legenda,ordem,principal,created_at")
        .eq("produto_id", produtoId);
      query = cor ? query.eq("cor", cor) : query.is("cor", null);
      const { data, error } = await query.order("ordem").order("created_at");
      if (error) throw error;
      return (data ?? []) as GalleryImage[];
    },
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: key });
    qc.invalidateQueries({ queryKey: ["loja", "produtos"] });
    qc.invalidateQueries({ queryKey: ["loja", "produto", produtoId] });
  };

  const add = useMutation({
    mutationFn: async () => {
      if (!url) throw new Error("Envie uma imagem primeiro.");
      const principal = imagens.length === 0;
      const { error } = await (supabase as any).from("produtos_imagens").insert({
        produto_id: produtoId,
        cor: cor || null,
        imagem_url: url,
        legenda: legenda.trim() || null,
        ordem: (imagens.length + 1) * 10,
        principal,
      });
      if (error) throw error;
      if (principal) onPrincipalChange?.(url);
    },
    onSuccess: () => {
      setUrl("");
      setLegenda("");
      invalidate();
      toast.success("Imagem adicionada à galeria");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const setPrincipal = useMutation({
    mutationFn: async (imagem: GalleryImage) => {
      let reset = (supabase as any).from("produtos_imagens").update({ principal: false }).eq("produto_id", produtoId);
      reset = cor ? reset.eq("cor", cor) : reset.is("cor", null);
      const { error: resetError } = await reset;
      if (resetError) throw resetError;
      const { error } = await (supabase as any).from("produtos_imagens").update({ principal: true }).eq("id", imagem.id);
      if (error) throw error;
      onPrincipalChange?.(imagem.imagem_url);
    },
    onSuccess: invalidate,
    onError: (error: Error) => toast.error(error.message),
  });

  const remove = useMutation({
    mutationFn: async (imagem: GalleryImage) => {
      const { error } = await (supabase as any).from("produtos_imagens").delete().eq("id", imagem.id);
      if (error) throw error;
      if (imagem.principal) {
        const seguinte = imagens.find((item) => item.id !== imagem.id);
        if (seguinte) {
          const { error: principalError } = await (supabase as any)
            .from("produtos_imagens")
            .update({ principal: true })
            .eq("id", seguinte.id);
          if (principalError) throw principalError;
          onPrincipalChange?.(seguinte.imagem_url);
        }
      }
    },
    onSuccess: () => {
      invalidate();
      toast.success("Imagem removida");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const ordered = useMemo(() => [...imagens].sort((a, b) => a.ordem - b.ordem), [imagens]);
  const reorder = async (targetId: string) => {
    if (!dragId || dragId === targetId) return;
    const next = [...ordered];
    const from = next.findIndex((item) => item.id === dragId);
    const to = next.findIndex((item) => item.id === targetId);
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    setDragId(null);
    const results = await Promise.all(next.map((item, index) =>
      (supabase as any).from("produtos_imagens").update({ ordem: (index + 1) * 10 }).eq("id", item.id)
    ));
    const failed = results.find((result) => result.error);
    if (failed?.error) toast.error(failed.error.message);
    else invalidate();
  };

  return (
    <div className="space-y-3 rounded-lg border border-border p-3">
      <div>
        <p className="text-sm font-medium">{cor ? `Galeria da cor ${cor}` : "Galeria do produto"}</p>
        <p className="text-xs text-muted-foreground">Arraste para ordenar e marque a foto de destaque.</p>
      </div>

      {ordered.length > 0 && (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {ordered.map((imagem) => (
            <div
              key={imagem.id}
              draggable
              onDragStart={() => setDragId(imagem.id)}
              onDragOver={(event) => event.preventDefault()}
              onDrop={() => void reorder(imagem.id)}
              className="overflow-hidden rounded-md border border-border bg-muted"
            >
              <div className="relative aspect-[4/3]">
                <img src={imagem.imagem_url} alt={imagem.legenda || "Imagem do produto"} className="h-full w-full object-contain" />
                <GripVertical className="absolute left-1 top-1 h-5 w-5 cursor-grab rounded bg-background/80 p-0.5" />
              </div>
              <div className="flex items-center justify-between gap-1 p-2">
                <span className="min-w-0 truncate text-xs">{imagem.legenda || "Sem legenda"}</span>
                <div className="flex shrink-0">
                  <Button type="button" size="icon" variant="ghost" className="h-7 w-7" title="Definir como principal" onClick={() => setPrincipal.mutate(imagem)}>
                    <Star className={`h-4 w-4 ${imagem.principal ? "fill-primary text-primary" : ""}`} />
                  </Button>
                  <Button type="button" size="icon" variant="ghost" className="h-7 w-7 text-destructive" title="Remover" onClick={() => remove.mutate(imagem)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
        <ProductImageUpload
          label="Nova imagem"
          value={url}
          pathPrefix={`produtos/${produtoId}/galeria`}
          fileNamePrefix={cor || "geral"}
          onChange={setUrl}
          onUploadingChange={setUploading}
        />
        <div className="space-y-2">
          <Label>Visão</Label>
          <Input value={legenda} onChange={(event) => setLegenda(event.target.value)} placeholder="Ex.: Frente ou Costas" />
        </div>
        <Button type="button" disabled={!url || uploading || add.isPending} onClick={() => add.mutate()}>
          <ImageIcon className="mr-2 h-4 w-4" /> Adicionar
        </Button>
      </div>
    </div>
  );
}