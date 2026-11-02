import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { MoreVertical, Zap } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { SeloPlano } from "@/components/portal/SeloPlano";
import { iniciaisAbrev } from "@/lib/comunidade";
import {
  AVISO_FOTO_FEED, FEED_FOTO_TIPOS, TERMO_FEED, VERSAO_TERMO_FEED, apagarFotosFeed, destaquePost, enviarFotoFeed,
  mensagemErroFeed, tempoRelativo, useCompartilhaveis, useFeed, useFeedStatus, useFotosFeed, validarFotoFeed,
  type FeedFiltro, type FeedPost,
} from "@/lib/comunidadeFeed";
import { cn } from "@/lib/utils";

const ROTULO = "text-[13px] font-bold uppercase tracking-[0.08em] text-[#B1B3B3]";
const BOTAO = "min-h-[44px] px-4 text-[13px] font-bold uppercase tracking-[0.08em]";
const BOTAO_VERMELHO = cn(BOTAO, "bg-[#C8282A] text-white disabled:opacity-50");
const BOTAO_CONTORNO = cn(BOTAO, "border border-[#4A4B4B] text-foreground disabled:opacity-50");

function Folha({ titulo, onClose, children }: { titulo: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end bg-black/70" onClick={onClose}>
      <div role="dialog" aria-label={titulo}
        className="max-h-[90vh] w-full space-y-4 overflow-y-auto border-t border-[#4A4B4B] bg-card p-6 pb-[max(1.5rem,env(safe-area-inset-bottom))]"
        onClick={(e) => e.stopPropagation()} style={{ fontFamily: "Archivo, sans-serif" }}>
        <p className="text-lg font-black uppercase text-foreground">{titulo}</p>
        {children}
      </div>
    </div>
  );
}

type Evento = { tipo: "treino" | "conquista" | "sequencia"; id: string; titulo: string };
const CHAVE_DISPENSADOS = "comunidade-feed-dispensados";
const lerDispensados = (): string[] => { try { return JSON.parse(localStorage.getItem(CHAVE_DISPENSADOS) ?? "[]"); } catch { return []; } };

export function ComunidadeFeed({ alunoId }: { alunoId: string | null }) {
  const qc = useQueryClient();
  const { data: status, isLoading } = useFeedStatus();
  const participa = !!status?.participa;
  const [filtro, setFiltro] = useState<FeedFiltro>("fortem");
  const { data: posts, isLoading: carregando } = useFeed(filtro, participa);
  const { data: comp } = useCompartilhaveis(participa && !status?.suspenso);
  const { data: fotos } = useFotosFeed((posts ?? []).map((p) => p.foto_path));
  const [dispensados, setDispensados] = useState<string[]>(lerDispensados);
  const [compartilhando, setCompartilhando] = useState<Evento | null>(null);
  const [saindo, setSaindo] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const [menu, setMenu] = useState<FeedPost | null>(null);

  const atualizar = () => {
    qc.invalidateQueries({ queryKey: ["comunidade-feed"] });
    qc.invalidateQueries({ queryKey: ["comunidade-feed-status"] });
    qc.invalidateQueries({ queryKey: ["comunidade-compartilhaveis"] });
  };
  const dispensar = (id: string) => {
    const novo = [...dispensados, id].slice(-50);
    setDispensados(novo);
    localStorage.setItem(CHAVE_DISPENSADOS, JSON.stringify(novo));
  };

  const participar = async () => {
    setOcupado(true);
    const { error } = await supabase.rpc("fn_comunidade_feed_aceitar" as any, { p_versao: VERSAO_TERMO_FEED });
    setOcupado(false);
    if (error) return toast.error(mensagemErroFeed(error));
    atualizar();
  };
  const sair = async () => {
    setOcupado(true);
    const { data, error } = await supabase.rpc("fn_comunidade_feed_revogar" as any);
    if (!error) await apagarFotosFeed((data as string[]) ?? []);
    setOcupado(false);
    if (error) return toast.error(mensagemErroFeed(error));
    setSaindo(false);
    toast.success("Você saiu do feed. Suas publicações foram removidas.");
    atualizar();
  };
  const reagir = async (p: FeedPost) => {
    const fn = p.eu_reagi ? "fn_comunidade_feed_desreagir" : "fn_comunidade_feed_reagir";
    const { error } = await supabase.rpc(fn as any, { p_post: p.id });
    if (error) return toast.error(mensagemErroFeed(error));
    qc.invalidateQueries({ queryKey: ["comunidade-feed"] });
  };
  const apagar = async (p: FeedPost) => {
    const { data, error } = await supabase.rpc("fn_comunidade_feed_apagar" as any, { p_post: p.id });
    if (error) return toast.error(mensagemErroFeed(error));
    await apagarFotosFeed([data as string | null]);
    setMenu(null);
    toast.success("Publicação apagada.");
    atualizar();
  };
  const denunciar = async (p: FeedPost) => {
    const { error } = await supabase.rpc("fn_comunidade_feed_denunciar" as any, { p_post: p.id, p_motivo: "inadequado" });
    setMenu(null);
    if (error) return toast.error(mensagemErroFeed(error));
    toast.success("Denúncia enviada à equipe.");
  };

  if (isLoading) return <Skeleton className="h-40" />;

  if (!participa) {
    return (
      <section className="space-y-4 border border-[#4A4B4B] p-5">
        <p className={ROTULO}>Feed da comunidade</p>
        <p className="text-sm text-foreground">{TERMO_FEED}</p>
        <Link to="/privacidade" className="inline-block min-h-[44px] py-3 text-sm text-[#B1B3B3] underline">Política de privacidade</Link>
        <button onClick={participar} disabled={ocupado} className={cn(BOTAO_VERMELHO, "w-full")}>Participar</button>
      </section>
    );
  }

  const treino = comp?.treino && !dispensados.includes(comp.treino.id) ? comp.treino : null;
  const conquistas = (comp?.conquistas ?? []).filter((c) => !dispensados.includes(c.id));

  return (
    <div className="space-y-4">
      {status?.suspenso && (
        <p className="border border-[#4A4B4B] p-4 text-sm text-[#B1B3B3]">
          Sua participação no feed está suspensa pela equipe. Você pode ver as publicações, mas não pode compartilhar.
        </p>
      )}

      {!status?.suspenso && treino && (
        <div className="space-y-3 border border-[#C8282A] p-4">
          <p className="text-sm text-foreground">
            Seu treino de hoje: {treino.modalidade} · {treino.horario} · concluído. Quer compartilhar na comunidade?
          </p>
          <div className="flex gap-2">
            <button className={cn(BOTAO_VERMELHO, "flex-1")} onClick={() => setCompartilhando({ tipo: "treino", id: treino.id, titulo: `${treino.modalidade} · ${treino.horario}` })}>Compartilhar</button>
            <button className={cn(BOTAO_CONTORNO, "flex-1")} onClick={() => dispensar(treino.id)}>Agora não</button>
          </div>
        </div>
      )}
      {!status?.suspenso && conquistas.map((c) => (
        <div key={c.id} className="space-y-3 border border-[#4A4B4B] p-4">
          <p className="text-sm text-foreground">Nova conquista: {c.nome}. Quer compartilhar na comunidade?</p>
          <div className="flex gap-2">
            <button className={cn(BOTAO_VERMELHO, "flex-1")} onClick={() => setCompartilhando({ tipo: c.tipo, id: c.id, titulo: c.nome })}>Compartilhar</button>
            <button className={cn(BOTAO_CONTORNO, "flex-1")} onClick={() => dispensar(c.id)}>Agora não</button>
          </div>
        </div>
      ))}

      <div className="grid grid-cols-2 border border-[#4A4B4B]" role="tablist">
        {(["fortem", "clubes"] as FeedFiltro[]).map((f) => (
          <button key={f} role="tab" aria-selected={filtro === f} onClick={() => setFiltro(f)}
            className={cn(BOTAO, filtro === f ? "bg-[#C8282A] text-white" : "text-[#B1B3B3]")}>
            {f === "fortem" ? "Fortem" : "Meus clubes"}
          </button>
        ))}
      </div>

      {carregando ? <Skeleton className="h-40" /> : (posts ?? []).length === 0 ? (
        <p className="text-sm text-[#B1B3B3]">
          {filtro === "clubes" ? "Nenhuma publicação de membros dos seus clubes nos últimos 30 dias." : "Nenhuma publicação nos últimos 30 dias."}
        </p>
      ) : (
        <ul className="space-y-3">
          {(posts ?? []).map((p) => {
            const d = destaquePost(p);
            const foto = p.foto_path ? fotos?.[p.foto_path] : undefined;
            return (
              <li key={p.id} className="border border-[#4A4B4B] bg-card">
                <div className="flex items-center gap-3 p-3">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center bg-[#2C2C2C] text-sm font-black text-[#B1B3B3]">{iniciaisAbrev(p.nome)}</div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="truncate font-bold text-foreground">{p.nome}</p>
                      <SeloPlano chave={p.plano_chave} />
                    </div>
                    <p className="text-xs text-[#B1B3B3]">{tempoRelativo(p.created_at)}</p>
                  </div>
                  <button aria-label="Opções da publicação" onClick={() => setMenu(p)} className="flex h-11 w-11 items-center justify-center text-[#B1B3B3]">
                    <MoreVertical className="h-5 w-5" />
                  </button>
                </div>
                <div className="px-3 pb-3">
                  <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-[#E73C3E]">{d.rotulo}</p>
                  <p className="text-2xl font-black uppercase text-foreground">{d.valor}</p>
                  {d.detalhe && <p className="text-xs text-[#B1B3B3]">{d.detalhe}</p>}
                </div>
                {foto && <img src={foto} alt="" loading="lazy" className="w-full object-cover" />}
                <div className="border-t border-[#4A4B4B] p-2">
                  <button onClick={() => reagir(p)} disabled={!!status?.suspenso} aria-pressed={p.eu_reagi}
                    className={cn(BOTAO, "flex items-center gap-2", p.eu_reagi ? "text-[#E73C3E]" : "text-[#B1B3B3]")}>
                    <Zap className="h-4 w-4" fill={p.eu_reagi ? "currentColor" : "none"} /> Força {p.reacoes > 0 && <span>{p.reacoes}</span>}
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <button onClick={() => setSaindo(true)} className={cn(BOTAO, "w-full text-[#B1B3B3] underline")}>Sair do feed</button>

      {menu && (
        <Folha titulo="Publicação" onClose={() => setMenu(null)}>
          {menu.eh_meu
            ? <button onClick={() => apagar(menu)} className={cn(BOTAO_VERMELHO, "w-full")}>Apagar</button>
            : <button onClick={() => denunciar(menu)} className={cn(BOTAO_CONTORNO, "w-full")}>Denunciar</button>}
          <button onClick={() => setMenu(null)} className={cn(BOTAO_CONTORNO, "w-full")}>Cancelar</button>
        </Folha>
      )}

      {saindo && (
        <Folha titulo="Sair do feed" onClose={() => setSaindo(false)}>
          <p className="text-sm text-[#B1B3B3]">Suas publicações deixam de aparecer e suas fotos são apagadas. Você pode voltar depois.</p>
          <button onClick={sair} disabled={ocupado} className={cn(BOTAO_VERMELHO, "w-full")}>Confirmar saída</button>
          <button onClick={() => setSaindo(false)} className={cn(BOTAO_CONTORNO, "w-full")}>Cancelar</button>
        </Folha>
      )}

      {compartilhando && (
        <FolhaCompartilhar evento={compartilhando} alunoId={alunoId} onClose={() => setCompartilhando(null)}
          onFeito={() => { setCompartilhando(null); atualizar(); }} />
      )}
    </div>
  );
}

function FolhaCompartilhar({ evento, alunoId, onClose, onFeito }: { evento: Evento; alunoId: string | null; onClose: () => void; onFeito: () => void }) {
  const [audiencia, setAudiencia] = useState<FeedFiltro>("clubes");
  const [foto, setFoto] = useState<File | null>(null);
  const [previa, setPrevia] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  useEffect(() => () => { if (previa) URL.revokeObjectURL(previa); }, [previa]);

  const escolher = (f?: File) => {
    if (!f) return;
    const erro = validarFotoFeed({ type: f.type, size: 0 });
    if (erro) return toast.error(erro);
    setFoto(f);
    setPrevia(URL.createObjectURL(f));
  };
  const enviar = async () => {
    if (!alunoId) return;
    setOcupado(true);
    let caminho: string | null = null;
    try {
      if (foto) caminho = await enviarFotoFeed(foto, alunoId);
      const { error } = await supabase.rpc("fn_comunidade_compartilhar" as any, {
        p_tipo: evento.tipo, p_referencia_id: evento.id, p_audiencia: audiencia, p_foto_path: caminho,
      });
      if (error) throw error;
      toast.success(caminho ? "Enviado. A foto aparece depois da análise da equipe." : "Compartilhado.");
      onFeito();
    } catch (e: any) {
      if (caminho) await apagarFotosFeed([caminho]);
      toast.error(e?.message && !e?.code ? e.message : mensagemErroFeed(e));
    } finally {
      setOcupado(false);
    }
  };

  return (
    <Folha titulo="Compartilhar" onClose={onClose}>
      <p className="text-sm text-foreground">{evento.titulo}</p>
      <fieldset className="space-y-2">
        <legend className={ROTULO}>Quem vê</legend>
        {([["clubes", "Só meus clubes"], ["fortem", "Toda a Fortem"]] as [FeedFiltro, string][]).map(([v, r]) => (
          <label key={v} className="flex min-h-[44px] items-center gap-3 border border-[#4A4B4B] px-3">
            <input type="radio" name="audiencia" checked={audiencia === v} onChange={() => setAudiencia(v)} className="h-5 w-5 accent-[#C8282A]" />
            <span className="text-sm text-foreground">{r}</span>
          </label>
        ))}
      </fieldset>
      <div className="space-y-2">
        <p className={ROTULO}>Foto (opcional)</p>
        {previa ? (
          <div className="space-y-2">
            <img src={previa} alt="Prévia da foto" className="max-h-60 w-full object-cover" />
            <button onClick={() => { setFoto(null); setPrevia(null); }} className={cn(BOTAO_CONTORNO, "w-full")}>Remover foto</button>
          </div>
        ) : (
          <label className={cn(BOTAO_CONTORNO, "flex w-full cursor-pointer items-center justify-center")}>
            Anexar foto
            <input type="file" accept={FEED_FOTO_TIPOS.join(",")} className="sr-only" onChange={(e) => escolher(e.target.files?.[0])} />
          </label>
        )}
        <p className="text-xs text-[#B1B3B3]">{AVISO_FOTO_FEED}</p>
      </div>
      <button onClick={enviar} disabled={ocupado || !alunoId} className={cn(BOTAO_VERMELHO, "w-full")}>Compartilhar</button>
      <button onClick={onClose} className={cn(BOTAO_CONTORNO, "w-full")}>Cancelar</button>
    </Folha>
  );
}
