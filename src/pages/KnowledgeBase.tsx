import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Plus, Search, Edit2, Trash2, ChevronDown, ChevronUp,
  Eye, ThumbsUp, ThumbsDown, BookOpen, Tag, X, Save, Loader2
} from "lucide-react";

export default function KnowledgeBase() {
  const qc = useQueryClient();
  const [busca, setBusca] = useState("");
  const [categoriaSelecionada, setCategoriaSelecionada] = useState<string | null>(null);
  const [expandido, setExpandido] = useState<string | null>(null);
  const [modoEdicao, setModoEdicao] = useState(false);
  const [artigoEditando, setArtigoEditando] = useState<any | null>(null);
  const [form, setForm] = useState({ category_id: "", pergunta: "", resposta: "", palavras_chave: "", aliases: "", ativo: true });

  const { data: categorias = [] } = useQuery({
    queryKey: ["knowledge-categories"],
    queryFn: async () => {
      const { data } = await (supabase as any).from("knowledge_categories").select("*").order("ordem");
      return data || [];
    },
  });

  const { data: artigos = [], isLoading } = useQuery({
    queryKey: ["knowledge-articles", categoriaSelecionada, busca],
    queryFn: async () => {
      let q = (supabase as any)
        .from("knowledge_articles")
        .select("*, knowledge_categories(nome)")
        .order("created_at", { ascending: false });
      if (categoriaSelecionada) q = q.eq("category_id", categoriaSelecionada);
      if (busca) q = q.or(`pergunta.ilike.%${busca}%,resposta.ilike.%${busca}%`);
      const { data } = await q;
      return data || [];
    },
  });

  const salvar = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      const payload = {
        ...form,
        palavras_chave: form.palavras_chave.split(",").map((s: string) => s.trim()).filter(Boolean),
        aliases: form.aliases.split(",").map((s: string) => s.trim()).filter(Boolean),
        updated_by: user!.id,
        updated_at: new Date().toISOString(),
      };
      if (artigoEditando?.id) {
        const { error } = await (supabase as any).from("knowledge_articles").update(payload).eq("id", artigoEditando.id);
        if (error) throw error;
      } else {
        const { error } = await (supabase as any).from("knowledge_articles").insert({ ...payload, created_by: user!.id });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(artigoEditando?.id ? "Artigo atualizado!" : "Artigo criado!");
      qc.invalidateQueries({ queryKey: ["knowledge-articles"] });
      setModoEdicao(false);
      setArtigoEditando(null);
      setForm({ category_id: "", pergunta: "", resposta: "", palavras_chave: "", aliases: "", ativo: true });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const excluir = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from("knowledge_articles").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Artigo excluído"); qc.invalidateQueries({ queryKey: ["knowledge-articles"] }); },
  });

  const toggleAtivo = useMutation({
    mutationFn: async ({ id, ativo }: { id: string; ativo: boolean }) => {
      const { error } = await (supabase as any).from("knowledge_articles").update({ ativo }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["knowledge-articles"] }),
  });

  function iniciarEdicao(a: any) {
    setArtigoEditando(a);
    setForm({
      category_id: a.category_id,
      pergunta: a.pergunta,
      resposta: a.resposta,
      palavras_chave: (a.palavras_chave || []).join(", "),
      aliases: (a.aliases || []).join(", "),
      ativo: a.ativo,
    });
    setModoEdicao(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function iniciarNovo() {
    setArtigoEditando(null);
    setForm({ category_id: categoriaSelecionada || "", pergunta: "", resposta: "", palavras_chave: "", aliases: "", ativo: true });
    setModoEdicao(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  const totalAtivos = artigos.filter((a: any) => a.ativo).length;

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <BookOpen className="w-6 h-6 text-primary" />
            Base de Conhecimento
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Assistente FORTEM · {totalAtivos} artigos ativos de {artigos.length} total
          </p>
        </div>
        <button onClick={iniciarNovo} className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-lg font-semibold text-sm hover:bg-primary/90 transition-colors">
          <Plus className="w-4 h-4" /> Novo artigo
        </button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {categorias.slice(0, 4).map((c: any) => {
          const count = artigos.filter((a: any) => a.category_id === c.id && a.ativo).length;
          return (
            <div key={c.id} className="glass-card rounded-xl p-3 text-center cursor-pointer hover:border-primary/30 transition-colors" onClick={() => setCategoriaSelecionada(c.id === categoriaSelecionada ? null : c.id)}>
              <p className="text-2xl font-black text-primary">{count}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{c.nome}</p>
            </div>
          );
        })}
      </div>

      {modoEdicao && (
        <div className="border border-primary/30 rounded-xl p-5 bg-primary/5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-bold text-base">{artigoEditando?.id ? "Editar artigo" : "Novo artigo"}</h2>
            <button onClick={() => { setModoEdicao(false); setArtigoEditando(null); }} className="text-muted-foreground hover:text-foreground">
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1 block">Categoria *</label>
                <select value={form.category_id} onChange={e => setForm(f => ({ ...f, category_id: e.target.value }))} className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background">
                  <option value="">Selecione...</option>
                  {categorias.map((c: any) => <option key={c.id} value={c.id}>{c.nome}</option>)}
                </select>
              </div>
              <div className="flex items-end gap-2">
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input type="checkbox" checked={form.ativo} onChange={e => setForm(f => ({ ...f, ativo: e.target.checked }))} className="rounded" />
                  Artigo ativo (visível para o assistente)
                </label>
              </div>
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1 block">Pergunta principal *</label>
              <input value={form.pergunta} onChange={e => setForm(f => ({ ...f, pergunta: e.target.value }))} placeholder="Ex: Como cancelar um treino agendado?" className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background" />
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1 block">Resposta *</label>
              <textarea value={form.resposta} onChange={e => setForm(f => ({ ...f, resposta: e.target.value }))} placeholder="Resposta completa e clara para o aluno..." rows={5} className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background resize-none" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1 block flex items-center gap-1">
                  <Tag className="w-3 h-3" /> Palavras-chave
                </label>
                <input value={form.palavras_chave} onChange={e => setForm(f => ({ ...f, palavras_chave: e.target.value }))} placeholder="cancelar, treino, agendamento" className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background" />
                <p className="text-[10px] text-muted-foreground mt-1">Separadas por vírgula — ajudam a IA a encontrar este artigo</p>
              </div>
              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1 block">Variações da pergunta</label>
                <input value={form.aliases} onChange={e => setForm(f => ({ ...f, aliases: e.target.value }))} placeholder="como cancelo, desmarcar treino" className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background" />
                <p className="text-[10px] text-muted-foreground mt-1">Formas diferentes de fazer a mesma pergunta</p>
              </div>
            </div>
          </div>
          <div className="flex gap-3 justify-end pt-2">
            <button onClick={() => { setModoEdicao(false); setArtigoEditando(null); }} className="px-4 py-2 rounded-lg bg-muted text-foreground text-sm font-semibold">Cancelar</button>
            <button
              onClick={() => salvar.mutate()}
              disabled={!form.category_id || !form.pergunta || !form.resposta || salvar.isPending}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold disabled:opacity-50"
            >
              {salvar.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Salvar artigo
            </button>
          </div>
        </div>
      )}

      <div className="space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar por pergunta ou resposta..." className="w-full pl-9 pr-4 py-2 border border-border rounded-lg bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
        </div>
        <div className="flex gap-2 flex-wrap">
          <button onClick={() => setCategoriaSelecionada(null)} className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${!categoriaSelecionada ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}>
            Todas ({artigos.length})
          </button>
          {categorias.map((c: any) => {
            const count = artigos.filter((a: any) => a.category_id === c.id).length;
            return (
              <button key={c.id} onClick={() => setCategoriaSelecionada(c.id === categoriaSelecionada ? null : c.id)} className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${categoriaSelecionada === c.id ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}>
                {c.nome} ({count})
              </button>
            );
          })}
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
      ) : artigos.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <BookOpen className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="font-medium">Nenhum artigo encontrado</p>
          <p className="text-sm mt-1">Crie o primeiro artigo clicando em "Novo artigo"</p>
        </div>
      ) : (
        <div className="space-y-2">
          {artigos.map((a: any) => (
            <div key={a.id} className={`border rounded-xl overflow-hidden transition-all ${a.ativo ? "border-border bg-card" : "border-border/40 bg-muted/10 opacity-60"}`}>
              <button className="w-full flex items-center gap-3 px-4 py-3.5 text-left" onClick={() => setExpandido(expandido === a.id ? null : a.id)}>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-primary/10 text-primary">{a.knowledge_categories?.nome}</span>
                    {!a.ativo && <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-muted text-muted-foreground">Inativo</span>}
                  </div>
                  <p className="font-semibold text-sm text-foreground truncate">{a.pergunta}</p>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <div className="hidden sm:flex items-center gap-3 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1"><Eye className="w-3 h-3" />{a.visualizacoes}</span>
                    <span className="flex items-center gap-1 text-emerald-500"><ThumbsUp className="w-3 h-3" />{a.util_sim}</span>
                    <span className="flex items-center gap-1 text-destructive"><ThumbsDown className="w-3 h-3" />{a.util_nao}</span>
                  </div>
                  {expandido === a.id ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                </div>
              </button>
              {expandido === a.id && (
                <div className="px-4 pb-4 border-t border-border space-y-3">
                  <p className="text-sm text-foreground/80 mt-3 whitespace-pre-wrap leading-relaxed">{a.resposta}</p>
                  {a.palavras_chave?.length > 0 && (
                    <div className="flex gap-1.5 flex-wrap">
                      <span className="text-[10px] text-muted-foreground font-semibold">Palavras-chave:</span>
                      {a.palavras_chave.map((k: string) => (
                        <span key={k} className="text-[10px] bg-muted px-2 py-0.5 rounded-full text-muted-foreground">{k}</span>
                      ))}
                    </div>
                  )}
                  {a.aliases?.length > 0 && (
                    <div className="flex gap-1.5 flex-wrap">
                      <span className="text-[10px] text-muted-foreground font-semibold">Variações:</span>
                      {a.aliases.map((k: string) => (
                        <span key={k} className="text-[10px] bg-muted/50 px-2 py-0.5 rounded-full text-muted-foreground italic">{k}</span>
                      ))}
                    </div>
                  )}
                  <div className="flex gap-2 pt-1 flex-wrap">
                    <button onClick={() => iniciarEdicao(a)} className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-muted text-foreground text-xs font-semibold hover:bg-muted/80">
                      <Edit2 className="w-3 h-3" /> Editar
                    </button>
                    <button onClick={() => toggleAtivo.mutate({ id: a.id, ativo: !a.ativo })} className="px-3 py-1.5 rounded-lg bg-muted text-foreground text-xs font-semibold hover:bg-muted/80">
                      {a.ativo ? "Desativar" : "Ativar"}
                    </button>
                    <button onClick={() => { if (confirm("Excluir este artigo permanentemente?")) excluir.mutate(a.id); }} className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-destructive/10 text-destructive text-xs font-semibold hover:bg-destructive/20">
                      <Trash2 className="w-3 h-3" /> Excluir
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
