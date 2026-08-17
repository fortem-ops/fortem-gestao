import { useState, useRef, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useUserRoles } from "@/hooks/useUserRoles";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
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
import { toast } from "sonner";
import {
  FolderOpen,
  Folder,
  FilePlus2,
  FolderPlus,
  Trash2,
  Download,
  ChevronRight,
  Loader2,
  FileText,
} from "lucide-react";

const BUCKET = "arquivos-metodologicos";
const MAX_FILE_BYTES = 50 * 1024 * 1024; // 50 MB

type Pasta = {
  id: string;
  nome: string;
  parent_id: string | null;
  criado_por: string | null;
  created_at: string;
};

type Item = {
  id: string;
  pasta_id: string | null;
  nome_arquivo: string;
  storage_path: string;
  tamanho_bytes: number | null;
  tipo_mime: string | null;
  enviado_por: string | null;
  created_at: string;
};

function formatBytes(bytes: number | null) {
  if (!bytes && bytes !== 0) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function sanitizeFileName(name: string) {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]/g, "_");
}

export default function ArquivosMetodologicos() {
  const { user } = useAuth();
  const { data: roles } = useUserRoles();
  const isCoordAdmin = !!roles?.isCoordAdmin;
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [currentFolder, setCurrentFolder] = useState<string | null>(null);
  const [newFolderOpen, setNewFolderOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [uploading, setUploading] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<
    { tipo: "pasta"; pasta: Pasta } | { tipo: "arquivo"; item: Item } | null
  >(null);

  const { data: pastas = [], isLoading: loadingPastas } = useQuery({
    queryKey: ["arquivos-metodologicos-pastas"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("arquivos_metodologicos_pastas")
        .select("id, nome, parent_id, criado_por, created_at")
        .order("nome");
      if (error) throw error;
      return (data ?? []) as Pasta[];
    },
  });

  const { data: itens = [], isLoading: loadingItens } = useQuery({
    queryKey: ["arquivos-metodologicos-itens", currentFolder],
    queryFn: async () => {
      let q = supabase
        .from("arquivos_metodologicos_itens")
        .select(
          "id, pasta_id, nome_arquivo, storage_path, tamanho_bytes, tipo_mime, enviado_por, created_at"
        )
        .order("created_at", { ascending: false });
      q = currentFolder ? q.eq("pasta_id", currentFolder) : q.is("pasta_id", null);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as Item[];
    },
  });

  const autorIds = useMemo(
    () => Array.from(new Set(itens.map((i) => i.enviado_por).filter(Boolean))) as string[],
    [itens]
  );

  const { data: autores = {} } = useQuery({
    queryKey: ["arquivos-metodologicos-autores", autorIds],
    queryFn: async () => {
      if (autorIds.length === 0) return {};
      const { data } = await supabase
        .from("profiles")
        .select("user_id, full_name")
        .in("user_id", autorIds);
      const map: Record<string, string> = {};
      (data ?? []).forEach((p: any) => {
        if (p.user_id) map[p.user_id] = p.full_name ?? "—";
      });
      return map;
    },
    enabled: autorIds.length > 0,
  });

  const subPastas = useMemo(
    () => pastas.filter((p) => (p.parent_id ?? null) === currentFolder),
    [pastas, currentFolder]
  );

  const breadcrumb = useMemo(() => {
    const trilha: Pasta[] = [];
    let cursor = currentFolder;
    const byId = new Map(pastas.map((p) => [p.id, p]));
    while (cursor) {
      const p = byId.get(cursor);
      if (!p) break;
      trilha.unshift(p);
      cursor = p.parent_id;
    }
    return trilha;
  }, [pastas, currentFolder]);

  /* ─── Criar pasta ─── */
  const criarPasta = useMutation({
    mutationFn: async (nome: string) => {
      const { error } = await supabase.from("arquivos_metodologicos_pastas").insert({
        nome: nome.trim(),
        parent_id: currentFolder,
        criado_por: user?.id ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Pasta criada");
      setNewFolderOpen(false);
      setNewFolderName("");
      queryClient.invalidateQueries({ queryKey: ["arquivos-metodologicos-pastas"] });
    },
    onError: (e: any) => toast.error(e.message ?? "Erro ao criar pasta"),
  });

  /* ─── Upload ─── */
  async function handleUpload(files: FileList | null) {
    if (!files || files.length === 0) return;
    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        if (file.size > MAX_FILE_BYTES) {
          toast.error(`"${file.name}" excede o limite de 50 MB`);
          continue;
        }
        const path = `${currentFolder ?? "raiz"}/${crypto.randomUUID()}-${sanitizeFileName(
          file.name
        )}`;
        const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, file, {
          contentType: file.type || undefined,
          upsert: false,
        });
        if (upErr) throw upErr;

        const { error: dbErr } = await supabase.from("arquivos_metodologicos_itens").insert({
          pasta_id: currentFolder,
          nome_arquivo: file.name,
          storage_path: path,
          tamanho_bytes: file.size,
          tipo_mime: file.type || null,
          enviado_por: user?.id ?? null,
        });
        if (dbErr) {
          await supabase.storage.from(BUCKET).remove([path]);
          throw dbErr;
        }
      }
      toast.success("Upload concluído");
      queryClient.invalidateQueries({ queryKey: ["arquivos-metodologicos-itens"] });
    } catch (e: any) {
      toast.error(e.message ?? "Erro no upload");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  /* ─── Download ─── */
  async function baixar(item: Item) {
    const { data, error } = await supabase.storage
      .from(BUCKET)
      .createSignedUrl(item.storage_path, 60, { download: item.nome_arquivo });
    if (error || !data) {
      toast.error("Não foi possível gerar o link");
      return;
    }
    window.open(data.signedUrl, "_blank");
  }

  /* ─── Excluir arquivo ─── */
  const excluirArquivo = useMutation({
    mutationFn: async (item: Item) => {
      const { error: stErr } = await supabase.storage.from(BUCKET).remove([item.storage_path]);
      if (stErr) throw stErr;
      const { error } = await supabase
        .from("arquivos_metodologicos_itens")
        .delete()
        .eq("id", item.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Arquivo excluído");
      queryClient.invalidateQueries({ queryKey: ["arquivos-metodologicos-itens"] });
    },
    onError: (e: any) => toast.error(e.message ?? "Erro ao excluir arquivo"),
  });

  /* ─── Excluir pasta (recursivo no Storage, cascata no banco) ─── */
  const excluirPasta = useMutation({
    mutationFn: async (pasta: Pasta) => {
      // coleta recursiva dos ids de pastas afetadas
      const ids: string[] = [];
      const coletar = (id: string) => {
        ids.push(id);
        pastas.filter((p) => p.parent_id === id).forEach((p) => coletar(p.id));
      };
      coletar(pasta.id);

      const { data: afetados, error: selErr } = await supabase
        .from("arquivos_metodologicos_itens")
        .select("storage_path")
        .in("pasta_id", ids);
      if (selErr) throw selErr;

      const paths = (afetados ?? []).map((a: any) => a.storage_path).filter(Boolean);
      if (paths.length > 0) {
        const { error: stErr } = await supabase.storage.from(BUCKET).remove(paths);
        if (stErr) throw stErr;
      }

      const { error } = await supabase
        .from("arquivos_metodologicos_pastas")
        .delete()
        .eq("id", pasta.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Pasta excluída");
      queryClient.invalidateQueries({ queryKey: ["arquivos-metodologicos-pastas"] });
      queryClient.invalidateQueries({ queryKey: ["arquivos-metodologicos-itens"] });
    },
    onError: (e: any) => toast.error(e.message ?? "Erro ao excluir pasta"),
  });

  const carregando = loadingPastas || loadingItens;

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <FolderOpen className="w-6 h-6 text-primary" />
            Arquivos Metodológicos
          </h1>
          <p className="text-sm text-muted-foreground">
            Repositório compartilhado da equipe técnica
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setNewFolderOpen(true)}>
            <FolderPlus className="w-4 h-4 mr-2" />
            Nova pasta
          </Button>
          <Button onClick={() => fileInputRef.current?.click()} disabled={uploading}>
            {uploading ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <FilePlus2 className="w-4 h-4 mr-2" />
            )}
            Enviar arquivo
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="hidden"
            onChange={(e) => handleUpload(e.target.files)}
          />
        </div>
      </div>

      {/* Breadcrumb */}
      <div className="flex items-center flex-wrap gap-1 text-sm">
        <button
          className="hover:text-primary transition-colors font-medium"
          onClick={() => setCurrentFolder(null)}
        >
          Início
        </button>
        {breadcrumb.map((p) => (
          <span key={p.id} className="flex items-center gap-1">
            <ChevronRight className="w-3 h-3 text-muted-foreground" />
            <button
              className="hover:text-primary transition-colors"
              onClick={() => setCurrentFolder(p.id)}
            >
              {p.nome}
            </button>
          </span>
        ))}
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">
            {breadcrumb.length ? breadcrumb[breadcrumb.length - 1].nome : "Pasta raiz"}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {carregando && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground py-6 justify-center">
              <Loader2 className="w-4 h-4 animate-spin" /> Carregando...
            </div>
          )}

          {!carregando && subPastas.length === 0 && itens.length === 0 && (
            <p className="text-sm text-muted-foreground py-8 text-center">
              Esta pasta está vazia.
            </p>
          )}

          {/* Pastas */}
          {subPastas.map((p) => (
            <div
              key={p.id}
              className="flex items-center gap-3 rounded-lg border border-border p-3 hover:bg-muted/50 transition-colors"
            >
              <button
                className="flex items-center gap-3 flex-1 text-left min-w-0"
                onClick={() => setCurrentFolder(p.id)}
              >
                <Folder className="w-5 h-5 text-primary shrink-0" />
                <span className="font-medium truncate">{p.nome}</span>
              </button>
              {isCoordAdmin && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setConfirmDelete({ tipo: "pasta", pasta: p })}
                >
                  <Trash2 className="w-4 h-4 text-destructive" />
                </Button>
              )}
            </div>
          ))}

          {/* Arquivos */}
          {itens.map((it) => (
            <div
              key={it.id}
              className="flex items-center gap-3 rounded-lg border border-border p-3 hover:bg-muted/50 transition-colors"
            >
              <FileText className="w-5 h-5 text-muted-foreground shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate">{it.nome_arquivo}</p>
                <p className="text-xs text-muted-foreground">
                  {formatBytes(it.tamanho_bytes)} · {formatDate(it.created_at)}
                  {it.enviado_por && autores[it.enviado_por]
                    ? ` · ${autores[it.enviado_por]}`
                    : ""}
                </p>
              </div>
              <Button variant="ghost" size="icon" onClick={() => baixar(it)}>
                <Download className="w-4 h-4" />
              </Button>
              {isCoordAdmin && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setConfirmDelete({ tipo: "arquivo", item: it })}
                >
                  <Trash2 className="w-4 h-4 text-destructive" />
                </Button>
              )}
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Nova pasta */}
      <Dialog open={newFolderOpen} onOpenChange={setNewFolderOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nova pasta</DialogTitle>
          </DialogHeader>
          <Input
            autoFocus
            placeholder="Nome da pasta"
            value={newFolderName}
            onChange={(e) => setNewFolderName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && newFolderName.trim()) criarPasta.mutate(newFolderName);
            }}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewFolderOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={() => criarPasta.mutate(newFolderName)}
              disabled={!newFolderName.trim() || criarPasta.isPending}
            >
              Criar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirmação de exclusão */}
      <AlertDialog open={!!confirmDelete} onOpenChange={(o) => !o && setConfirmDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmDelete?.tipo === "pasta" ? "Excluir pasta?" : "Excluir arquivo?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmDelete?.tipo === "pasta"
                ? `A pasta "${confirmDelete.pasta.nome}", suas subpastas e todos os arquivos dentro dela serão excluídos permanentemente.`
                : `O arquivo "${
                    confirmDelete?.tipo === "arquivo" ? confirmDelete.item.nome_arquivo : ""
                  }" será excluído permanentemente.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (!confirmDelete) return;
                if (confirmDelete.tipo === "pasta") excluirPasta.mutate(confirmDelete.pasta);
                else excluirArquivo.mutate(confirmDelete.item);
                setConfirmDelete(null);
              }}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
