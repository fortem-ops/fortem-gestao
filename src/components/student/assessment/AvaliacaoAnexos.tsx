import { useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Paperclip, Upload, Loader2, Trash2, FileDown } from "lucide-react";
import { toast } from "sonner";

interface AnexoRow {
  id: string;
  avaliacao_id: string;
  storage_path: string;
  nome_arquivo: string;
  tipo: string;
  uploaded_by: string;
  created_at: string;
}

interface Props {
  avaliacaoId: string | null;
  canEdit?: boolean;
}

const BUCKET = "aluno-files";

export function AvaliacaoAnexos({ avaliacaoId, canEdit = true }: Props) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const { data: anexos = [], isLoading } = useQuery({
    queryKey: ["avaliacao-anexos", avaliacaoId],
    enabled: !!avaliacaoId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("avaliacao_anexos" as never)
        .select("*")
        .eq("avaliacao_id", avaliacaoId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as AnexoRow[];
    },
  });

  const handleUpload = async (files: FileList | null) => {
    if (!files || files.length === 0 || !avaliacaoId || !user) return;
    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        const ext = file.name.split(".").pop() || "bin";
        const path = `avaliacoes/${avaliacaoId}/${crypto.randomUUID()}.${ext}`;
        const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, file);
        if (upErr) throw upErr;
        const tipo = file.type.startsWith("image/") ? "imagem" : file.type.includes("pdf") ? "pdf" : "arquivo";
        const { error: dbErr } = await supabase.from("avaliacao_anexos" as never).insert({
          avaliacao_id: avaliacaoId,
          storage_path: path,
          nome_arquivo: file.name,
          tipo,
          uploaded_by: user.id,
        } as never);
        if (dbErr) throw dbErr;
      }
      toast.success(`${files.length} arquivo(s) enviado(s)`);
      qc.invalidateQueries({ queryKey: ["avaliacao-anexos", avaliacaoId] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro no upload");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const handleDownload = async (a: AnexoRow) => {
    const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(a.storage_path, 60);
    if (error || !data) {
      toast.error("Erro ao gerar link");
      return;
    }
    window.open(data.signedUrl, "_blank");
  };

  const handleDelete = async (a: AnexoRow) => {
    try {
      await supabase.storage.from(BUCKET).remove([a.storage_path]);
      const { error } = await supabase.from("avaliacao_anexos" as never).delete().eq("id", a.id);
      if (error) throw error;
      toast.success("Anexo removido");
      qc.invalidateQueries({ queryKey: ["avaliacao-anexos", avaliacaoId] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao remover");
    }
  };

  return (
    <div className="glass-card rounded-lg p-4 space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <Paperclip className="w-4 h-4 text-primary" /> Anexos da avaliação
        </h4>
        {canEdit && (
          <>
            <input
              ref={inputRef}
              type="file"
              multiple
              className="hidden"
              onChange={(e) => handleUpload(e.target.files)}
              accept="image/*,application/pdf,.doc,.docx,.xls,.xlsx"
            />
            <Button
              size="sm"
              variant="outline"
              disabled={!avaliacaoId || uploading}
              onClick={() => inputRef.current?.click()}
            >
              {uploading ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <Upload className="w-3.5 h-3.5 mr-1" />}
              Enviar arquivo
            </Button>
          </>
        )}
      </div>

      {!avaliacaoId ? (
        <p className="text-xs text-muted-foreground">Salve a avaliação para habilitar o envio de arquivos.</p>
      ) : isLoading ? (
        <div className="flex justify-center py-3"><Loader2 className="w-4 h-4 animate-spin text-muted-foreground" /></div>
      ) : anexos.length === 0 ? (
        <p className="text-xs text-muted-foreground">Nenhum arquivo anexado.</p>
      ) : (
        <ul className="space-y-1.5">
          {anexos.map((a) => (
            <li key={a.id} className="flex items-center justify-between gap-2 text-sm rounded-md border border-border/50 px-3 py-2 hover:bg-secondary/30">
              <span className="truncate flex-1" title={a.nome_arquivo}>{a.nome_arquivo}</span>
              <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => handleDownload(a)}>
                <FileDown className="w-3.5 h-3.5" />
              </Button>
              {canEdit && (
                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => handleDelete(a)}>
                  <Trash2 className="w-3.5 h-3.5 text-destructive" />
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
