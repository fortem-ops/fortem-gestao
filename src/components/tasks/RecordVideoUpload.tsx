import { useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Upload, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

interface Props {
  taskId: string;
  descricao: string | null;
}

const MAX_VIDEO_BYTES = 100 * 1024 * 1024; // 100 MB

/**
 * Botão de upload de vídeo embutido na tarefa "Gravar Vídeo".
 * Lê o exercicio_id do campo descricao (formato: "exercicio_id:<uuid>"),
 * envia o arquivo ao bucket exercicios-videos, atualiza o exercício e
 * marca a tarefa como concluída.
 */
export function RecordVideoUpload({ taskId, descricao }: Props) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const exercicioId = (() => {
    const m = descricao?.match(/exercicio_id:([0-9a-fA-F-]{36})/);
    return m ? m[1] : null;
  })();

  if (!exercicioId) return null;

  const handleSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    if (!file.type.startsWith("video/")) {
      toast.error("Selecione um arquivo de vídeo");
      return;
    }
    if (file.size > MAX_VIDEO_BYTES) {
      toast.error("Vídeo excede 100 MB");
      return;
    }
    setUploading(true);
    try {
      const ext = file.name.split(".").pop() || "mp4";
      const path = `${user.id}/${crypto.randomUUID()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("exercicios-videos")
        .upload(path, file, { contentType: file.type });
      if (upErr) throw upErr;

      const { error: updErr } = await supabase
        .from("exercicios_personalizados")
        .update({ video_path: path })
        .eq("id", exercicioId);
      if (updErr) throw updErr;

      // Conclui todas as tarefas "gravar_video" deste exercício (pode haver
      // uma por coordenador), não apenas a clicada.
      const { error: taskErr } = await supabase
        .from("tarefas")
        .update({ status: "concluida" })
        .eq("tipo_auto", "gravar_video")
        .eq("descricao", `exercicio_id:${exercicioId}`);
      if (taskErr) throw taskErr;

      toast.success("Vídeo enviado e tarefa concluída!");
      queryClient.invalidateQueries({ queryKey: ["tarefas-all"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-tarefas"] });
      queryClient.invalidateQueries({ queryKey: ["exercicios-bank"] });
      queryClient.invalidateQueries({ queryKey: ["exercicios-bank-selector"] });
    } catch (err: any) {
      toast.error(err.message || "Falha no upload");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept="video/*"
        className="hidden"
        onChange={handleSelect}
      />
      <Button
        size="sm"
        variant="outline"
        className="h-7 text-xs gap-1"
        disabled={uploading}
        onClick={(e) => {
          e.stopPropagation();
          inputRef.current?.click();
        }}
      >
        {uploading ? (
          <>
            <Loader2 className="w-3 h-3 animate-spin" /> Enviando...
          </>
        ) : (
          <>
            <Upload className="w-3 h-3" /> Enviar Vídeo
          </>
        )}
      </Button>
    </>
  );
}
