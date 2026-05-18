import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { Tables } from "@/integrations/supabase/types";
import { supabase } from "@/integrations/supabase/client";
import { FileText, Image, Upload, Loader2, Download, Trash2, Eye, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const CATEGORIES = [
  { value: "exame", label: "Exame" },
  { value: "laudo", label: "Laudo" },
  { value: "foto", label: "Foto" },
  { value: "documento", label: "Documento" },
  { value: "avaliacao_forca", label: "Avaliação de Força" },
  { value: "outro", label: "Outro" },
];

export function StudentUploads({ student }: { student: Tables<"alunos"> }) {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [categoria, setCategoria] = useState("documento");
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState<{ url: string; file: Tables<"uploads"> } | null>(null);
  const [loadingPreviewId, setLoadingPreviewId] = useState<string | null>(null);

  const { data: profiles } = useQuery({
    queryKey: ["profiles-map"],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("user_id, full_name");
      return (data || []).reduce((m, p) => { m[p.user_id] = p.full_name; return m; }, {} as Record<string, string>);
    },
    staleTime: 60_000,
  });

  const { data: uploads, isLoading } = useQuery({
    queryKey: ["uploads", student.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("uploads")
        .select("*")
        .eq("aluno_id", student.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Não autenticado");

      for (const file of Array.from(files)) {
        const ext = file.name.split(".").pop();
        const path = `${student.id}/${crypto.randomUUID()}.${ext}`;

        const { error: storageError } = await supabase.storage
          .from("aluno-files")
          .upload(path, file);
        if (storageError) throw storageError;

        const tipo = file.type.startsWith("image/") ? "imagem" : file.type.includes("pdf") ? "pdf" : "arquivo";

        const { error: dbError } = await supabase.from("uploads").insert({
          aluno_id: student.id,
          autor_id: user.id,
          nome_arquivo: file.name,
          storage_path: path,
          tipo,
          categoria,
        });
        if (dbError) throw dbError;
      }

      toast({ title: "Upload concluído", description: `${files.length} arquivo(s) enviado(s)` });
      queryClient.invalidateQueries({ queryKey: ["uploads", student.id] });
      queryClient.invalidateQueries({ queryKey: ["historico-timeline", student.id] });
    } catch (err: any) {
      toast({ title: "Erro no upload", description: err.message, variant: "destructive" });
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleDownload = async (upload: Tables<"uploads">) => {
    const { data, error } = await supabase.storage
      .from("aluno-files")
      .createSignedUrl(upload.storage_path, 60);
    if (error || !data?.signedUrl) {
      toast({ title: "Erro ao baixar", description: error?.message || "URL não gerada", variant: "destructive" });
      return;
    }
    window.open(data.signedUrl, "_blank");
  };

  const deleteMutation = useMutation({
    mutationFn: async (upload: Tables<"uploads">) => {
      await supabase.storage.from("aluno-files").remove([upload.storage_path]);
      const { error } = await supabase.from("uploads").delete().eq("id", upload.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Arquivo removido" });
      queryClient.invalidateQueries({ queryKey: ["uploads", student.id] });
    },
    onError: (err: any) => {
      toast({ title: "Erro ao remover", description: err.message, variant: "destructive" });
    },
  });

  const isImage = (tipo: string) => tipo === "imagem" || tipo === "Imagem";
  const isPdf = (tipo: string, name: string) => tipo === "pdf" || name.toLowerCase().endsWith(".pdf");
  const canPreview = (file: Tables<"uploads">) => isImage(file.tipo) || isPdf(file.tipo, file.nome_arquivo);

  const handlePreview = async (file: Tables<"uploads">) => {
    setLoadingPreviewId(file.id);
    const { data, error } = await supabase.storage
      .from("aluno-files")
      .createSignedUrl(file.storage_path, 300);
    setLoadingPreviewId(null);
    if (error || !data?.signedUrl) {
      toast({ title: "Erro ao pré-visualizar", description: error?.message || "URL não gerada", variant: "destructive" });
      return;
    }
    setPreview({ url: data.signedUrl, file });
  };

  return (
    <div className="space-y-4 mt-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h3 className="font-heading font-semibold text-foreground">Uploads</h3>
        <div className="flex items-center gap-2">
          <Select value={categoria} onValueChange={setCategoria}>
            <SelectTrigger className="w-[130px] h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CATEGORIES.map(c => (
                <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button size="sm" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
            {uploading ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Upload className="w-3 h-3 mr-1" />}
            Enviar Arquivo
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="hidden"
            onChange={handleFileSelect}
          />
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        </div>
      ) : !uploads || uploads.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-8">Nenhum arquivo enviado</p>
      ) : (
        <div className="space-y-2">
          {uploads.map(file => (
            <div key={file.id} className="glass-card rounded-lg p-3 flex items-center gap-3">
              {isImage(file.tipo) ? (
                <Image className="w-5 h-5 text-info shrink-0" />
              ) : (
                <FileText className="w-5 h-5 text-destructive shrink-0" />
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">{file.nome_arquivo}</p>
                <p className="text-xs text-muted-foreground">
                  {format(new Date(file.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                  {file.categoria ? ` · ${file.categoria}` : ""}
                  {profiles?.[file.autor_id] ? ` · ${profiles[file.autor_id]}` : ""}
                </p>
              </div>
              <Button variant="ghost" size="icon" className="shrink-0" onClick={() => handleDownload(file)}>
                <Download className="w-4 h-4" />
              </Button>
              <Button variant="ghost" size="icon" className="shrink-0 text-destructive" onClick={() => deleteMutation.mutate(file)}>
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
