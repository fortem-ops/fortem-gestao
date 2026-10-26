import { descricaoNotificacaoExibicao } from "@/lib/notificacaoTexto";
import { useState, useEffect, useMemo, useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Paperclip, Send, X, Archive, ArchiveRestore } from "lucide-react";
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

  const taRef = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    const el = taRef.current;
    if (!el) return;
    const ph = el.placeholder;
    el.placeholder = ""; // o placeholder infla a altura medida quando o campo está vazio
    el.style.height = "auto";
    const h = el.scrollHeight;
    el.placeholder = ph;
    el.style.height = `${h}px`;
  }, [comentario]);

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

  const myDest = (data?.dests ?? []).find((d: any) => d.usuario_id === user?.id);
  const isCriadorEarly = data?.notif && (data.notif as any).criado_por === user?.id;
  const globalArquivada = data?.notif && ((data.notif as any).status === "arquivada" || (data.notif as any).status === "concluida");
  const minhaArquivada = myDest?.status === "arquivada";
  const estaArquivada = !!(globalArquivada || minhaArquivada);

  const arquivarMut = useMutation({
    mutationFn: async () => {
      if (!id || !user) return;
      if (isCriadorEarly) {
        await updateStatus(id, estaArquivada ? "em_andamento" : "arquivada");
      }
      if (myDest) {
        const novoStatus = estaArquivada ? "visualizada" : "arquivada";
        const { error } = await supabase
          .from("notificacao_destinatarios")
          .update({ status: novoStatus })
          .eq("notificacao_id", id)
          .eq("usuario_id", user.id);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(estaArquivada ? "Conversa desarquivada" : "Conversa arquivada");
      qc.invalidateQueries({ queryKey: ["notif"] });
    },
    onError: (e: any) => toast.error(e.message ?? "Erro ao arquivar"),
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
      <div className="p-4 border-b space-y-3 shrink-0">
        <div className="flex items-start justify-between gap-3">
          <h2 className="text-xl font-semibold break-words min-w-0">{n.titulo}</h2>
          <div className="flex items-center gap-1 shrink-0">
            {isCriador && (
              <Button
                variant="outline"
                size="sm"
                className="h-9"
                onClick={() => statusMut.mutate(n.status === "concluida" ? "em_andamento" : "concluida")}
                disabled={statusMut.isPending}
              >
                {n.status === "concluida" ? <RotateCcw className="w-4 h-4 mr-1" /> : <Check className="w-4 h-4 mr-1" />}
                {n.status === "concluida" ? "Reabrir" : "Concluir"}
              </Button>
            )}
            {(isCriador || !!myDest) && (
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9"
                aria-label={estaArquivada ? "Desarquivar" : "Arquivar"}
                title={estaArquivada ? "Desarquivar" : "Arquivar"}
                onClick={() => arquivarMut.mutate()}
                disabled={arquivarMut.isPending}
              >
                {estaArquivada ? <ArchiveRestore className="w-4 h-4" /> : <Archive className="w-4 h-4" />}
              </Button>
            )}
            {isCriador && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-9 w-9" aria-label="Mais ações">
                    <MoreHorizontal className="w-4 h-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onSelect={() => statusMut.mutate("em_andamento" as NotifStatus)}>Marcar como: Em andamento</DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => statusMut.mutate("respondida" as NotifStatus)}>Marcar como: Respondida</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </div>

        <div className="flex items-start gap-3">
          <div className="h-10 w-10 shrink-0 rounded-md bg-foreground text-background flex items-center justify-center text-sm font-semibold">
            {iniciais(profileMap[n.criado_por])}
          </div>
          <div className="min-w-0 flex-1">
            <div className="font-semibold truncate">{profileMap[n.criado_por] ?? "—"}</div>
            <div className="text-xs text-muted-foreground truncate">Para: {paraTexto}</div>
          </div>
          <div className="text-xs text-muted-foreground shrink-0">
            {format(new Date(n.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap text-xs">
          <PrioridadeSelo prioridade={n.prioridade} />
          {n.categoria && (
            <span className="rounded-sm border px-1.5 py-px text-muted-foreground">
              {NOTIF_CATEGORIAS.find((c) => c.value === n.categoria)?.label ?? n.categoria}
            </span>
          )}
          {n.prazo && (
            <span className="text-muted-foreground">Prazo: {format(new Date(n.prazo), "dd/MM/yyyy HH:mm", { locale: ptBR })}</span>
          )}
          {aluno && (
            <span className="inline-flex items-center gap-1 text-muted-foreground">
              <User className="w-3.5 h-3.5" /> Aluno: <span className="text-foreground">{aluno.nome}</span>
            </span>
          )}
          {n.tipo === "reuniao" && n.reuniao_data && (
            <span className="inline-flex items-center gap-1 text-muted-foreground">
              <Calendar className="w-3.5 h-3.5" /> {format(new Date(n.reuniao_data), "dd/MM/yyyy HH:mm", { locale: ptBR })}
              {n.reuniao_local && <><MapPin className="w-3.5 h-3.5 ml-1" /> {n.reuniao_local}</>}
            </span>
          )}
          {STATUS_VISIVEL[n.status] && (
            <span className="rounded-sm bg-muted px-1.5 py-px text-muted-foreground">{STATUS_VISIVEL[n.status]}</span>
          )}
          <span className="ml-auto flex items-center gap-3 text-muted-foreground">
            <span>{data.dests.filter((d: any) => d.visualizado_em).length} visualizaram</span>
            <Button variant="link" size="sm" className="h-9 px-0 text-xs" onClick={() => setAtividadeOpen(true)}>
              Ver atividade
            </Button>
          </span>
        </div>
      </div>

      <div ref={listRef} className="flex-1 min-h-0 overflow-y-auto p-4">
        <div className="space-y-3">
          <DiaSeparador data={n.created_at} />
          <div className="border rounded-md p-4">
            <p className="text-sm whitespace-pre-wrap">{descricaoNotificacaoExibicao(n.descricao)}</p>
            <div className="text-xs text-muted-foreground mt-2">{format(new Date(n.created_at), "HH:mm", { locale: ptBR })}</div>
          </div>
          {data.coments.map((c: any, i: number) => {
            const anterior = i === 0 ? n.created_at : data.coments[i - 1].created_at;
            const mudouDia = !isSameDay(new Date(anterior), new Date(c.created_at));
            return (
              <div key={c.id} className="space-y-3">
                {mudouDia && <DiaSeparador data={c.created_at} />}
                <CommentBubble c={c} mine={c.usuario_id === user?.id} authorName={profileMap[c.usuario_id]} />
              </div>
            );
          })}
        </div>
      </div>

      <NotificacaoAtividade
        open={atividadeOpen}
        onOpenChange={setAtividadeOpen}
        hist={data.hist}
        dests={data.dests}
        profileMap={profileMap}
      />

      <div className="p-3 border-t space-y-2 shrink-0">
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
          <Textarea
            ref={taRef}
            rows={1}
            placeholder="Responder... (Enter envia · Shift+Enter nova linha · Ctrl+V cola imagem)"
            value={comentario}
            onChange={(e) => setComentario(e.target.value)}
            onPaste={handlePaste}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault();
                sendMut.mutate();
              }
            }}
            className="min-h-0 max-h-[136px] resize-none overflow-y-auto py-2 text-sm"
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

  const isImage = typeof c.anexo_tipo === "string" && c.anexo_tipo.startsWith("image/");
  const hasText = c.comentario && c.comentario !== "(anexo)";

  return (
    <div className={`flex ${mine ? "justify-end" : "justify-start"}`}>
      <div className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${mine ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
        {!mine && <div className="text-xs font-semibold opacity-80 mb-0.5">{authorName ?? "—"}</div>}
        {hasText && <div className="whitespace-pre-wrap">{c.comentario}</div>}
        {url && isImage && (
          <a href={url} target="_blank" rel="noreferrer" className="block mt-1">
            <img src={url} alt={c.anexo_nome ?? "imagem"} className="max-w-full max-h-64 rounded cursor-zoom-in" />
          </a>
        )}
        {url && !isImage && (
          <a href={url} target="_blank" rel="noreferrer" className="text-xs underline block mt-1">
            📎 {c.anexo_nome ?? "Anexo"}
          </a>
        )}
        <div className="text-[10px] opacity-70 mt-1">{format(new Date(c.created_at), "dd/MM HH:mm", { locale: ptBR })}</div>
      </div>
    </div>
  );
}
