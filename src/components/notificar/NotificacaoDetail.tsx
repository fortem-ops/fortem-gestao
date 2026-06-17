import { useState, useEffect, useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Paperclip, Send, X } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { addComentario, getAnexoUrl, markVisualizada, updateStatus, NOTIF_STATUS, type NotifStatus } from "@/lib/notificar";
import { useNotificacaoDetail } from "@/hooks/useNotificacoes";
import { CategoriaBadge, PrioridadeBadge, StatusBadge } from "./NotificacaoBadge";

export function NotificacaoDetail({ id }: { id: string | null }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { data, isLoading } = useNotificacaoDetail(id);
  const [comentario, setComentario] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const filePreviewUrl = useMemo(() => {
    if (file && file.type.startsWith("image/")) return URL.createObjectURL(file);
    return null;
  }, [file]);
  useEffect(() => { return () => { if (filePreviewUrl) URL.revokeObjectURL(filePreviewUrl); }; }, [filePreviewUrl]);

  const handlePaste = (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (const it of Array.from(items)) {
      if (it.kind === "file" && it.type.startsWith("image/")) {
        const f = it.getAsFile();
        if (f) {
          const ext = it.type.split("/")[1] || "png";
          setFile(new File([f], `pasted-${Date.now()}.${ext}`, { type: it.type }));
          toast.success("Imagem colada");
          e.preventDefault();
          return;
        }
      }
    }
  };
  const handleDragOver = (e: React.DragEvent) => {
    if (e.dataTransfer?.types?.includes("Files")) { e.preventDefault(); setDragOver(true); }
  };
  const handleDragLeave = (e: React.DragEvent) => { if (e.currentTarget === e.target) setDragOver(false); };
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer?.files?.[0];
    if (f) { setFile(f); toast.success(f.type.startsWith("image/") ? "Imagem anexada" : "Arquivo anexado"); }
  };


  // Mark as viewed
  useEffect(() => {
    if (id && user) {
      markVisualizada(id, user.id).then(() =>
        qc.invalidateQueries({ queryKey: ["notif"] })
      );
    }
  }, [id, user, qc]);

  const { data: profileMap = {} } = useQuery({
    queryKey: ["profiles-map"],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("user_id,full_name");
      const map: Record<string, string> = {};
      (data ?? []).forEach((p) => { map[p.user_id] = p.full_name; });
      return map;
    },
  });

  const alunoId = (data?.notif as any)?.aluno_id as string | undefined;
  const { data: aluno } = useQuery({
    queryKey: ["notif-aluno", alunoId],
    enabled: !!alunoId,
    queryFn: async () => {
      const { data } = await supabase.from("alunos").select("id,nome").eq("id", alunoId!).maybeSingle();
      return data;
    },
  });

  const sendMut = useMutation({
    mutationFn: async () => {
      if (!id || (!comentario.trim() && !file)) return;
      await addComentario({ notificacaoId: id, comentario: comentario.trim() || "(anexo)", anexo: file });
    },
    onSuccess: () => {
      setComentario(""); setFile(null);
      qc.invalidateQueries({ queryKey: ["notif", "detail", id] });
    },
    onError: (e: any) => toast.error(e.message ?? "Erro ao comentar"),
  });

  const statusMut = useMutation({
    mutationFn: async (status: NotifStatus) => {
      if (!id) return;
      await updateStatus(id, status);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notif"] }),
  });

  if (!id) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        Selecione uma notificação para visualizar
      </div>
    );
  }
  if (isLoading || !data?.notif) return <div className="p-6">Carregando...</div>;

  const n = data.notif as any;
  const isCriador = n.criado_por === user?.id;

  return (
    <div
      className={`flex flex-col h-full relative ${dragOver ? "ring-2 ring-primary ring-inset" : ""}`}
      onPaste={handlePaste}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {dragOver && (
        <div className="absolute inset-0 z-10 bg-primary/10 border-2 border-dashed border-primary rounded flex items-center justify-center pointer-events-none">
          <span className="text-sm font-medium text-primary">Solte para anexar</span>
        </div>
      )}
      <div className="p-4 border-b space-y-2">
        <div className="flex items-start justify-between gap-3">
          <h2 className="text-xl font-semibold">{n.titulo}</h2>
          <div className="flex items-center gap-2">
            <PrioridadeBadge prioridade={n.prioridade} />
            <StatusBadge status={n.status} />
          </div>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
          <CategoriaBadge categoria={n.categoria} />
          <span>· {profileMap[n.criado_por] ?? "—"}</span>
          <span>· {format(new Date(n.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}</span>
          {n.prazo && <span>· Prazo: {format(new Date(n.prazo), "dd/MM/yyyy HH:mm", { locale: ptBR })}</span>}
        </div>
        <p className="text-sm whitespace-pre-wrap pt-1">{n.descricao}</p>
        {aluno && (
          <div className="text-sm bg-muted/50 rounded p-2">
            👤 Aluno vinculado: <span className="font-medium">{aluno.nome}</span>
          </div>
        )}
        {n.tipo === "reuniao" && n.reuniao_data && (
          <div className="text-sm bg-muted/50 rounded p-2">
            📅 Reunião: {format(new Date(n.reuniao_data), "dd/MM/yyyy HH:mm", { locale: ptBR })}
            {n.reuniao_local && <> · 📍 {n.reuniao_local}</>}
          </div>
        )}
        <div className="flex items-center gap-2 pt-2">
          <Select value={n.status} onValueChange={(v) => statusMut.mutate(v as NotifStatus)} disabled={!isCriador}>
            <SelectTrigger className="w-48 h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>{NOTIF_STATUS.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent>
          </Select>
          <span className="text-xs text-muted-foreground">{data.dests.length} destinatário(s) · {data.dests.filter((d: any) => d.visualizado_em).length} visualizou</span>
        </div>
      </div>

      <ScrollArea className="flex-1 p-4">
        <div className="space-y-3">
          {data.coments.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">Sem comentários ainda.</p>
          )}
          {data.coments.map((c: any) => (
            <CommentBubble key={c.id} c={c} mine={c.usuario_id === user?.id} authorName={profileMap[c.usuario_id]} />
          ))}
          <Separator className="my-4" />
          <div className="text-xs text-muted-foreground">Histórico</div>
          {data.hist.map((h: any) => (
            <div key={h.id} className="text-xs text-muted-foreground">
              · {h.acao.replace("_", " ")} {h.usuario_id ? `por ${profileMap[h.usuario_id] ?? "—"}` : ""} em {format(new Date(h.created_at), "dd/MM HH:mm", { locale: ptBR })}
            </div>
          ))}
        </div>
      </ScrollArea>

      <div className="p-3 border-t space-y-2">
        {file && (
          <div className="flex items-center gap-2 text-xs bg-muted px-2 py-1 rounded">
            {filePreviewUrl ? (
              <img src={filePreviewUrl} alt="preview" className="h-14 w-14 object-cover rounded" />
            ) : (
              <Paperclip className="w-3 h-3" />
            )}
            <span className="truncate flex-1">{file.name}</span>
            <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => setFile(null)}><X className="w-3 h-3" /></Button>
          </div>
        )}
        <div className="flex items-center gap-2">
          <label className="cursor-pointer">
            <input type="file" hidden onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
            <Button variant="ghost" size="icon" asChild><span><Paperclip className="w-4 h-4" /></span></Button>
          </label>
          <Input
            placeholder="Comentário..."
            value={comentario}
            onChange={(e) => setComentario(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMut.mutate(); } }}
          />
          <Button size="icon" onClick={() => sendMut.mutate()} disabled={sendMut.isPending}>
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

function CommentBubble({ c, mine, authorName }: { c: any; mine: boolean; authorName?: string }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (c.anexo_url) getAnexoUrl(c.anexo_url).then((u) => setUrl(u ?? null));
  }, [c.anexo_url]);

  return (
    <div className={`flex ${mine ? "justify-end" : "justify-start"}`}>
      <div className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${mine ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
        {!mine && <div className="text-xs font-semibold opacity-80 mb-0.5">{authorName ?? "—"}</div>}
        <div className="whitespace-pre-wrap">{c.comentario}</div>
        {url && (
          <a href={url} target="_blank" rel="noreferrer" className="text-xs underline block mt-1">
            📎 {c.anexo_nome ?? "Anexo"}
          </a>
        )}
        <div className="text-[10px] opacity-70 mt-1">{format(new Date(c.created_at), "dd/MM HH:mm", { locale: ptBR })}</div>
      </div>
    </div>
  );
}
