import { forwardRef, useRef, useState } from "react";
import { ImageIcon, Loader2, Upload } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

function safeFileName(name: string) {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

interface ProductImageUploadProps {
  label: string;
  value: string;
  pathPrefix: string;
  fileNamePrefix?: string;
  fallbackText?: string;
  onChange: (url: string) => void;
  onUploadingChange?: (uploading: boolean) => void;
}

export const ProductImageUpload = forwardRef<HTMLDivElement, ProductImageUploadProps>(function ProductImageUpload({
  label,
  value,
  pathPrefix,
  fileNamePrefix,
  fallbackText,
  onChange,
  onUploadingChange,
}, forwardedRef) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const handleFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Selecione um arquivo de imagem válido.");
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      toast.error("A imagem deve ter no máximo 5 MB.");
      return;
    }

    setUploading(true);
    onUploadingChange?.(true);
    try {
      const fileName = safeFileName(file.name) || "imagem";
      const prefix = fileNamePrefix ? `${safeFileName(fileNamePrefix)}-` : "";
      const path = `${pathPrefix}/${prefix}${Date.now()}-${fileName}`;
      const { error } = await supabase.storage.from("loja-produtos").upload(path, file, {
        contentType: file.type,
        upsert: false,
      });
      if (error) throw error;

      const { data, error: signError } = await supabase.storage
        .from("loja-produtos")
        .createSignedUrl(path, 315360000);
      if (signError || !data?.signedUrl) throw signError ?? new Error("Falha ao gerar link da imagem");
      onChange(data.signedUrl);
      toast.success("Imagem enviada");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Não foi possível enviar a imagem.";
      toast.error(message);
    } finally {
      setUploading(false);
      onUploadingChange?.(false);
    }
  };

  return (
    <div ref={forwardedRef} className="space-y-2">
      <Label>{label}</Label>
      <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
      <div className="flex items-center gap-3">
        <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-md border border-border bg-muted">
          {value ? (
            <img src={value} alt="Prévia da imagem" className="h-full w-full object-cover" />
          ) : (
            <ImageIcon className="h-6 w-6 text-muted-foreground" aria-hidden="true" />
          )}
        </div>
        <div className="space-y-1">
          <Button type="button" variant="outline" disabled={uploading} onClick={() => inputRef.current?.click()}>
            {uploading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
            ) : (
              <Upload className="mr-2 h-4 w-4" aria-hidden="true" />
            )}
            {uploading ? "Enviando..." : value ? "Trocar imagem" : "Selecionar imagem"}
          </Button>
          <p className="text-xs text-muted-foreground">{fallbackText || "Imagem de até 5 MB."}</p>
        </div>
      </div>
    </div>
  );
});