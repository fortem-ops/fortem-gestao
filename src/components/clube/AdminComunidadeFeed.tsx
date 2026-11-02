import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { format } from "date-fns";
import { apagarFotosFeed, destaquePost, mensagemErroFeed, useFotosFeed } from "@/lib/comunidadeFeed";

type Post = {
  id: string; aluno_id: string; tipo: any; payload: any; audiencia: string; foto_path: string | null;
  status: string; created_at: string; aluno: { nome: string } | null;
};
type Denuncia = { id: string; post_id: string; motivo: string; created_at: string; post: Post | null };
type Consent = { aluno_id: string; aceito_em: string; suspenso_em: string | null; revogado_em: string | null; aluno: { nome: string } | null };

const MOTIVO: Record<string, string> = { inadequado: "Inadequado", pessoa_identificavel: "Pessoa identificável", spam: "Spam", outro: "Outro" };

export function useFeedPendencias() {
  return useQuery({
    queryKey: ["admin-feed-pendencias"],
    queryFn: async () => {
      const d = await supabase.from("comunidade_feed_denuncias" as any).select("id", { count: "exact", head: true }).is("resolvido_em", null);
      return d.count ?? 0;
    },
  });
}

export function AdminComunidadeFeed() {
  const qc = useQueryClient();
  const sel = "*, aluno:alunos!comunidade_feed_posts_aluno_id_fkey(nome)";
  const { data: fotosRecentes, isLoading: l1 } = useQuery({
    queryKey: ["admin-feed-fotos-recentes"],
    queryFn: async () => {
      const desde = new Date(Date.now() - 30 * 86400000).toISOString();
      const { data, error } = await supabase.from("comunidade_feed_posts" as any).select(sel)
        .eq("status", "publicado").not("foto_path", "is", null).gte("created_at", desde).order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as Post[];
    },
  });
  const { data: denuncias, isLoading: l2 } = useQuery({
    queryKey: ["admin-feed-denuncias"],
    queryFn: async () => {
      const { data, error } = await supabase.from("comunidade_feed_denuncias" as any)
        .select(`id, post_id, motivo, created_at, post:comunidade_feed_posts(${sel})`).is("resolvido_em", null).order("created_at");
      if (error) throw error;
      return (data ?? []) as unknown as Denuncia[];
    },
  });
  const { data: recentes } = useQuery({
    queryKey: ["admin-feed-recentes"],
    queryFn: async () => {
      const { data, error } = await supabase.from("comunidade_feed_posts" as any).select(sel).eq("status", "publicado").order("created_at", { ascending: false }).limit(30);
      if (error) throw error;
      return (data ?? []) as unknown as Post[];
    },
  });
  const { data: participantes } = useQuery({
    queryKey: ["admin-feed-participantes"],
    queryFn: async () => {
      const { data, error } = await supabase.from("comunidade_consentimentos" as any)
        .select("aluno_id, aceito_em, suspenso_em, revogado_em, aluno:alunos!comunidade_consentimentos_aluno_id_fkey(nome)")
        .is("revogado_em", null).order("aceito_em", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as Consent[];
    },
  });
  const todasFotos = [...(fotosRecentes ?? []), ...(denuncias ?? []).map((d) => d.post).filter(Boolean) as Post[], ...(recentes ?? [])].map((p) => p.foto_path);
  const { data: fotos } = useFotosFeed(todasFotos);

  const atualizar = () => {
    ["admin-feed-fotos-recentes", "admin-feed-denuncias", "admin-feed-recentes", "admin-feed-pendencias", "admin-feed-participantes"]
      .forEach((k) => qc.invalidateQueries({ queryKey: [k] }));
  };
  const moderar = async (p: Post, acao: "ocultar" | "remover") => {
    const { data, error } = await supabase.rpc("fn_comunidade_feed_moderar" as any, { p_post: p.id, p_acao: acao });
    if (error) return toast.error(mensagemErroFeed(error));
    await apagarFotosFeed([data as string | null]);
    toast.success("Feito.");
    atualizar();
  };
  const dispensar = async (postId: string) => {
    const { error } = await supabase.rpc("fn_comunidade_feed_dispensar_denuncias" as any, { p_post: postId });
    if (error) return toast.error(mensagemErroFeed(error));
    atualizar();
  };
  const suspender = async (alunoId: string, s: boolean) => {
    const { error } = await supabase.rpc("fn_comunidade_feed_suspender" as any, { p_aluno: alunoId, p_suspender: s });
    if (error) return toast.error(mensagemErroFeed(error));
    toast.success(s ? "Aluno suspenso no feed." : "Aluno reativado no feed.");
    atualizar();
  };

  const resumo = (p: Post) => {
    const d = destaquePost(p);
    return (
      <div className="space-y-1">
        <p className="font-medium">{p.aluno?.nome ?? "Aluno"} <span className="text-xs text-muted-foreground">· {format(new Date(p.created_at), "dd/MM HH:mm")} · {p.audiencia === "fortem" ? "Toda a Fortem" : "Só clubes"}</span></p>
        <p className="text-sm"><span className="text-xs uppercase text-muted-foreground">{d.rotulo}:</span> {d.valor}{d.detalhe ? ` · ${d.detalhe}` : ""}</p>
        {p.foto_path && fotos?.[p.foto_path] && <img src={fotos[p.foto_path]} alt="" className="max-h-64 rounded object-contain" />}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <section className="space-y-2">
        <h3 className="font-semibold">Fotos recentes <span className="text-xs font-normal text-muted-foreground">últimos 30 dias</span></h3>
        {l1 ? <Skeleton className="h-24" /> : !fotosRecentes?.length ? <p className="text-sm text-muted-foreground">Nenhuma foto nos últimos 30 dias.</p> :
          fotosRecentes.map((p) => (
            <Card key={p.id}><CardContent className="flex items-center gap-3 p-3">
              {p.foto_path && fotos?.[p.foto_path]
                ? <img src={fotos[p.foto_path]} alt="" className="h-16 w-16 shrink-0 object-cover" />
                : <div className="h-16 w-16 shrink-0 bg-muted" />}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{p.aluno?.nome ?? "Aluno"}</p>
                <p className="text-xs text-muted-foreground">{format(new Date(p.created_at), "dd/MM/yyyy HH:mm")}</p>
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => moderar(p, "ocultar")}>Ocultar</Button>
                <Button size="sm" variant="destructive" onClick={() => moderar(p, "remover")}>Remover</Button>
              </div>
            </CardContent></Card>
          ))}
      </section>

      <section className="space-y-2">
        <h3 className="font-semibold">Denúncias abertas {!!denuncias?.length && <Badge variant="destructive">{denuncias.length}</Badge>}</h3>
        {l2 ? <Skeleton className="h-24" /> : !denuncias?.length ? <p className="text-sm text-muted-foreground">Nenhuma denúncia aberta.</p> :
          denuncias.map((d) => (
            <Card key={d.id}><CardContent className="flex flex-wrap items-start justify-between gap-3 p-4">
              <div className="space-y-1">
                <Badge variant="secondary">{MOTIVO[d.motivo] ?? d.motivo}</Badge>
                {d.post ? resumo(d.post) : <p className="text-sm text-muted-foreground">Publicação indisponível.</p>}
                {d.post && d.post.status !== "publicado" && <p className="text-xs text-muted-foreground">Status atual: {d.post.status}</p>}
              </div>
              <div className="flex gap-2">
                {d.post && d.post.status === "publicado" && <Button size="sm" variant="destructive" onClick={() => moderar(d.post!, "ocultar")}>Ocultar</Button>}
                <Button size="sm" variant="outline" onClick={() => dispensar(d.post_id)}>Dispensar</Button>
              </div>
            </CardContent></Card>
          ))}
      </section>

      <section className="space-y-2">
        <h3 className="font-semibold">Publicações recentes</h3>
        {!recentes?.length ? <p className="text-sm text-muted-foreground">Nenhuma publicação.</p> :
          recentes.map((p) => (
            <Card key={p.id}><CardContent className="flex flex-wrap items-start justify-between gap-3 p-4">
              {resumo(p)}
              <Button size="sm" variant="destructive" onClick={() => moderar(p, "remover")}>Remover</Button>
            </CardContent></Card>
          ))}
      </section>

      <section className="space-y-2">
        <h3 className="font-semibold">Participantes</h3>
        {!participantes?.length ? <p className="text-sm text-muted-foreground">Nenhum aluno participa do feed.</p> :
          <Card><CardContent className="divide-y p-0">
            {participantes.map((c) => (
              <div key={c.aluno_id} className="flex items-center justify-between gap-3 p-3">
                <div>
                  <p className="text-sm font-medium">{c.aluno?.nome ?? "Aluno"}</p>
                  <p className="text-xs text-muted-foreground">Desde {format(new Date(c.aceito_em), "dd/MM/yyyy")}{c.suspenso_em ? ` · suspenso em ${format(new Date(c.suspenso_em), "dd/MM/yyyy")}` : ""}</p>
                </div>
                {c.suspenso_em
                  ? <Button size="sm" variant="outline" onClick={() => suspender(c.aluno_id, false)}>Reativar</Button>
                  : <Button size="sm" variant="destructive" onClick={() => suspender(c.aluno_id, true)}>Suspender</Button>}
              </div>
            ))}
          </CardContent></Card>}
      </section>
    </div>
  );
}
