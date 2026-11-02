import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { ChevronLeft, Plus, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { SeloPlano } from "@/components/portal/SeloPlano";
import { ComunidadeFeed } from "@/components/portal/ComunidadeFeed";
import {
  AVISO_VISIBILIDADE, MODALIDADES, DESCRICAO_MAX, ORIENTACAO_CAPA, CAPA_TIPOS, enviarCapa, useCapasClubes, validarArquivoCapa, iniciaisAbrev, mensagemErroComunidade, useMeusClubes, useRankingClube,
  type ComunidadeClube,
} from "@/lib/comunidade";
import { cn } from "@/lib/utils";

const ROTULO = "text-[13px] font-bold uppercase tracking-[0.08em] text-[#B1B3B3]";
const BOTAO = "min-h-[44px] px-4 text-[13px] font-bold uppercase tracking-[0.08em]";
const BOTAO_VERMELHO = cn(BOTAO, "bg-[#C8282A] text-white disabled:opacity-50");
const BOTAO_CONTORNO = cn(BOTAO, "border border-[#4A4B4B] text-foreground disabled:opacity-50");

function Quadrado({ texto, grande }: { texto: string; grande?: boolean }) {
  return (
    <div className={cn("flex shrink-0 items-center justify-center bg-[#2C2C2C] font-black text-[#B1B3B3]", grande ? "h-14 w-14 text-xl" : "h-11 w-11 text-sm")}>
      {texto}
    </div>
  );
}

/** Sombra leve para o texto continuar legível sobre a capa. */
const SOMBRA: React.CSSProperties = { textShadow: "0 1px 2px rgba(0,0,0,.6)" };

/** Imagem de capa cobrindo o card inteiro, com degradê escuro para manter o texto legível. */
function FundoCapa({ url, children, className, posicao }: { url: string; children: React.ReactNode; className?: string; posicao?: string }) {
  // Imagem em pé (ilustração com personagem) é recortada um pouco abaixo do topo:
  // no centro ela vira uma faixa escura, e no topo sobra só o fundo vazio.
  const [auto, setAuto] = useState("center");
  return (
    <div className={cn("relative min-h-[140px] overflow-hidden bg-[#0e0e0e]", className)}>
      <img
        src={url}
        alt=""
        loading="lazy"
        className="absolute inset-0 h-full w-full object-cover"
        style={{ objectPosition: posicao ?? auto }}
        onLoad={(e) => {
          const i = e.currentTarget;
          if (i.naturalHeight > 0 && i.naturalWidth < i.naturalHeight) setAuto("center 25%");
        }}
      />
      <div className="absolute inset-0" style={{ background: "linear-gradient(to top, rgba(14,14,14,0.92) 0%, rgba(14,14,14,0.62) 45%, rgba(14,14,14,0.35) 100%)" }} />
      <div className="absolute inset-0" style={{ background: "linear-gradient(to right, rgba(14,14,14,0.75) 0%, rgba(14,14,14,0) 70%)" }} />
      <div className="relative">{children}</div>
    </div>
  );
}

function SeloOficial() {
  return <span className="ml-2 border border-[#C8282A] bg-[#0e0e0e]/60 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.08em] text-foreground">Oficial</span>;
}

function Folha({ titulo, onClose, children }: { titulo: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end bg-black/70" onClick={onClose}>
      <div
        role="dialog"
        aria-label={titulo}
        className="max-h-[90vh] w-full space-y-4 overflow-y-auto border-t border-[#4A4B4B] bg-card p-6 pb-[max(1.5rem,env(safe-area-inset-bottom))]"
        onClick={(e) => e.stopPropagation()}
        style={{ fontFamily: "Archivo, sans-serif" }}
      >
        <p className="text-lg font-black uppercase text-foreground">{titulo}</p>
        {children}
      </div>
    </div>
  );
}

export default function PortalComunidade() {
  const qc = useQueryClient();
  const [params, setParams] = useSearchParams();
  const clubeId = params.get("clube");
  const { data: clubes, isLoading } = useMeusClubes();
  const { data: capas } = useCapasClubes((clubes ?? []).map((c) => c.capa_url));
  const [entrando, setEntrando] = useState<ComunidadeClube | null>(null);
  const [criando, setCriando] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const [alunoId, setAlunoId] = useState<string | null>(null);
  useEffect(() => {
    supabase.rpc("fn_comunidade_meu_aluno" as any).then(({ data }) => setAlunoId((data as string) ?? null));
  }, []);

  const atualizar = () => {
    qc.invalidateQueries({ queryKey: ["comunidade-clubes"] });
    qc.invalidateQueries({ queryKey: ["comunidade-ranking"] });
  };
  const abrir = (id: string | null) => {
    const p = new URLSearchParams(params);
    if (id) p.set("clube", id); else p.delete("clube");
    setParams(p);
  };

  const entrar = async () => {
    if (!entrando) return;
    setOcupado(true);
    const { error } = await supabase.rpc("fn_comunidade_entrar" as any, { p_clube_id: entrando.id });
    setOcupado(false);
    if (error) return toast.error(mensagemErroComunidade(error));
    const id = entrando.id;
    setEntrando(null);
    atualizar();
    abrir(id);
  };

  const clube = clubeId ? clubes?.find((c) => c.id === clubeId) : null;
  if (clubeId && clube) return <DetalheClube clube={clube} capa={clube.capa_url ? capas?.[clube.capa_url] : undefined} voltar={() => abrir(null)} aoSair={atualizar} />;

  const meus = (clubes ?? []).filter((c) => c.sou_membro || (c.sou_criador && c.status !== "ativo"));
  const explorar = (clubes ?? []).filter((c) => c.status === "ativo" && !c.sou_membro);

  const aba = params.get("aba") === "clubes" ? "clubes" : "feed";
  const abas = (
    <div className="grid grid-cols-2 border-b border-[#4A4B4B] pt-2" role="tablist">
      {(["feed", "clubes"] as const).map((v) => (
        <button key={v} role="tab" aria-selected={aba === v}
          onClick={() => { const p = new URLSearchParams(params); p.set("aba", v); setParams(p); }}
          className={cn(BOTAO, "border-b-2", aba === v ? "border-[#C8282A] text-foreground" : "border-transparent text-[#B1B3B3]")}>
          {v === "feed" ? "Feed" : "Clubes"}
        </button>
      ))}
    </div>
  );

  if (aba === "feed") {
    return (
      <div className="space-y-6 pb-8" style={{ fontFamily: "Archivo, sans-serif" }}>
        {abas}
        <ComunidadeFeed alunoId={alunoId} />
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-8" style={{ fontFamily: "Archivo, sans-serif" }}>
      {abas}
      <header className="flex items-end justify-between gap-3 pt-2">
        <div>
          <p className={ROTULO}>Comunidade</p>
          <h1 className="text-xl font-black uppercase text-foreground">Clubes</h1>
        </div>
        <button onClick={() => setCriando(true)} className={cn(BOTAO_CONTORNO, "flex items-center gap-2")}>
          <Plus className="h-4 w-4" /> Criar clube
        </button>
      </header>

      <section className="space-y-3">
        <p className={ROTULO}>Meus clubes</p>
        {isLoading ? <Skeleton className="h-20" /> : meus.length === 0 ? (
          <p className="text-sm text-[#B1B3B3]">Você ainda não participa de nenhum clube.</p>
        ) : (
          <ul className="divide-y divide-[#4A4B4B] border border-[#4A4B4B]">
            {meus.map((c) => {
              const analise = c.status === "pendente";
              const recusado = c.status === "recusado";
              const clicavel = c.status === "ativo" && c.sou_membro;
              const capa = c.capa_url ? capas?.[c.capa_url] : undefined;
              const conteudo = (
                  <button
                    disabled={!clicavel}
                    onClick={() => abrir(c.id)}
                    className={cn("flex w-full items-center gap-3 p-3 text-left", capa ? "min-h-[140px] items-end" : "min-h-[64px]")}
                  >
                    {!capa && <Quadrado texto={c.nome[0]?.toUpperCase() ?? ""} />}
                    <div className="min-w-0 flex-1" style={capa ? SOMBRA : undefined}>
                      <p className="truncate font-bold text-foreground">{c.nome}{c.tipo === "oficial" && capa && <SeloOficial />}</p>
                      {capa && c.descricao && <p className="line-clamp-2 text-xs text-foreground/90">{c.descricao}</p>}
                      {capa && <p className="text-xs text-[#B1B3B3]">{c.membros} {c.membros === 1 ? "membro" : "membros"}</p>}
                      {analise && <p className="text-xs font-bold uppercase tracking-[0.08em] text-[#E3B341]">Em análise</p>}
                      {recusado && <p className="text-xs text-[#B1B3B3]">Não aprovado. Motivo: {c.motivo_recusa}</p>}
                      {clicavel && <p className="text-xs text-[#B1B3B3]">{c.meus_dias ?? 0} dias no mês</p>}
                    </div>
                    {clicavel && (
                      <div className="text-right">
                        <p className="text-xl font-black text-foreground">{c.minha_posicao ?? "—"}º</p>
                        <p className="text-[10px] font-bold uppercase tracking-[0.06em] text-[#B1B3B3]">Posição</p>
                      </div>
                    )}
                  </button>
              );
              return <li key={c.id}>{capa ? <FundoCapa url={capa}>{conteudo}</FundoCapa> : conteudo}</li>;
            })}
          </ul>
        )}
      </section>

      <section className="space-y-3">
        <p className={ROTULO}>Explorar</p>
        {isLoading ? <Skeleton className="h-20" /> : explorar.length === 0 ? (
          <p className="text-sm text-[#B1B3B3]">Nenhum outro clube disponível no momento.</p>
        ) : (
          <ul className="divide-y divide-[#4A4B4B] border border-[#4A4B4B]">
            {explorar.map((c) => {
              const capa = c.capa_url ? capas?.[c.capa_url] : undefined;
              const linha = (
              <div className={cn("flex items-center gap-3 p-3", capa && "min-h-[140px] items-end")}>
                {!capa && <Quadrado texto={c.nome[0]?.toUpperCase() ?? ""} />}
                <div className="min-w-0 flex-1" style={capa ? SOMBRA : undefined}>
                  <p className="truncate font-bold text-foreground">{c.nome}{capa && c.tipo === "oficial" && <SeloOficial />}</p>
                  {capa && c.descricao && <p className="line-clamp-2 text-xs text-foreground/90">{c.descricao}</p>}
                  <p className="text-xs text-[#B1B3B3]">
                    {c.membros} {c.membros === 1 ? "membro" : "membros"}{!capa && c.tipo === "oficial" ? " · Oficial" : ""}
                  </p>
                </div>
                <button onClick={() => setEntrando(c)} className={BOTAO_VERMELHO}>Entrar</button>
              </div>
              );
              return <li key={c.id}>{capa ? <FundoCapa url={capa}>{linha}</FundoCapa> : linha}</li>;
            })}
          </ul>
        )}
      </section>

      {entrando && (
        <Folha titulo={entrando.nome} onClose={() => setEntrando(null)}>
          {entrando.descricao && <p className="text-sm text-[#B1B3B3]">{entrando.descricao}</p>}
          <p className="border-l-2 border-[#C8282A] pl-3 text-sm text-foreground">{AVISO_VISIBILIDADE}</p>
          <div className="grid grid-cols-2 gap-3">
            <button onClick={() => setEntrando(null)} className={BOTAO_CONTORNO}>Cancelar</button>
            <button onClick={entrar} disabled={ocupado} className={BOTAO_VERMELHO}>Entrar no clube</button>
          </div>
        </Folha>
      )}

      {criando && <CriarClube alunoId={alunoId} fechar={() => setCriando(false)} aoCriar={atualizar} />}
    </div>
  );
}

function CriarClube({ alunoId, fechar, aoCriar }: { alunoId: string | null; fechar: () => void; aoCriar: () => void }) {
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [previa, setPrevia] = useState<string | null>(null);
  useEffect(() => () => { if (previa) URL.revokeObjectURL(previa); }, [previa]);
  const escolher = (f: File | undefined) => {
    if (!f) return;
    const erro = validarArquivoCapa({ type: f.type, size: 0 });
    if (erro) return toast.error(erro);
    setArquivo(f);
    setPrevia(URL.createObjectURL(f));
  };
  const [nome, setNome] = useState("");
  const [descricao, setDescricao] = useState("");
  const [modalidade, setModalidade] = useState<ComunidadeClube["modalidade"]>("todas");
  const [ocupado, setOcupado] = useState(false);
  const valido = nome.trim().length >= 3;

  const enviar = async () => {
    setOcupado(true);
    let capa: string | null = null;
    if (arquivo) {
      if (!alunoId) { setOcupado(false); return toast.error("Não foi possível enviar a imagem."); }
      try { capa = await enviarCapa(arquivo, alunoId); }
      catch (e: any) { setOcupado(false); return toast.error(e?.message?.startsWith("A imagem") || e?.message?.startsWith("Use") ? e.message : "Não foi possível enviar a imagem."); }
    }
    const { error } = await supabase.rpc("fn_comunidade_criar_clube" as any, {
      p_nome: nome.trim(), p_descricao: descricao.trim(), p_modalidade: modalidade, p_capa_url: capa,
    });
    setOcupado(false);
    if (error) return toast.error(mensagemErroComunidade(error));
    toast.success("Clube enviado para análise.");
    aoCriar();
    fechar();
  };

  const campo = "w-full min-h-[44px] border border-[#4A4B4B] bg-transparent px-3 text-sm text-foreground outline-none focus:border-[#C8282A]";
  return (
    <Folha titulo="Criar clube" onClose={fechar}>
      <label className="block space-y-1">
        <span className={ROTULO}>Nome</span>
        <input value={nome} maxLength={40} onChange={(e) => setNome(e.target.value)} className={campo} />
      </label>
      <label className="block space-y-1">
        <span className={ROTULO}>Descrição curta</span>
        <textarea value={descricao} maxLength={DESCRICAO_MAX} rows={3} onChange={(e) => setDescricao(e.target.value)} className={cn(campo, "py-2")} />
      </label>
      <div className="space-y-2">
        <span className={ROTULO}>Imagem de capa (opcional)</span>
        {previa ? (
          <div className="relative">
            <img src={previa} alt="Pré-visualização da capa" className="h-32 w-full object-cover" />
            <button type="button" aria-label="Remover imagem" onClick={() => { setArquivo(null); setPrevia(null); }}
              className="absolute right-0 top-0 flex h-11 w-11 items-center justify-center bg-[#0e0e0e]/80 text-foreground">
              <X className="h-5 w-5" />
            </button>
          </div>
        ) : (
          <label className={cn(BOTAO_CONTORNO, "flex cursor-pointer items-center justify-center")}>
            Selecionar imagem
            <input type="file" accept={CAPA_TIPOS.join(",")} className="sr-only" onChange={(e) => { escolher(e.target.files?.[0]); e.target.value = ""; }} />
          </label>
        )}
        <p className="text-xs text-[#B1B3B3]">{ORIENTACAO_CAPA}</p>
      </div>
      <div className="space-y-1">
        <span className={ROTULO}>Modalidade</span>
        <div className="grid grid-cols-3 gap-2">
          {MODALIDADES.map((m) => (
            <button
              key={m.valor}
              type="button"
              onClick={() => setModalidade(m.valor)}
              aria-pressed={modalidade === m.valor}
              className={cn(BOTAO, "border px-2", modalidade === m.valor ? "border-[#C8282A] bg-[#C8282A] text-white" : "border-[#4A4B4B] text-foreground")}
            >
              {m.rotulo}
            </button>
          ))}
        </div>
      </div>
      <p className="text-xs text-[#B1B3B3]">A equipe analisa o clube antes de ele aparecer para outros alunos.</p>
      <div className="grid grid-cols-2 gap-3">
        <button onClick={fechar} className={BOTAO_CONTORNO}>Cancelar</button>
        <button onClick={enviar} disabled={!valido || ocupado} className={BOTAO_VERMELHO}>Enviar</button>
      </div>
    </Folha>
  );
}

function DetalheClube({ clube, capa, voltar, aoSair }: { clube: ComunidadeClube; capa?: string; voltar: () => void; aoSair: () => void }) {
  const { data: ranking, isLoading } = useRankingClube(clube.id);
  const [confirmarSaida, setConfirmarSaida] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const podio = (ranking ?? []).slice(0, 3);

  const sair = async () => {
    setOcupado(true);
    const { error } = await supabase.rpc("fn_comunidade_sair" as any, { p_clube_id: clube.id });
    setOcupado(false);
    if (error) return toast.error(mensagemErroComunidade(error));
    setConfirmarSaida(false);
    aoSair();
    voltar();
  };

  return (
    <div className="space-y-6 pb-8" style={{ fontFamily: "Archivo, sans-serif" }}>
      <button onClick={voltar} className="flex min-h-[44px] items-center gap-1 text-[13px] font-bold uppercase tracking-[0.08em] text-[#B1B3B3]">
        <ChevronLeft className="h-4 w-4" /> Clubes
      </button>

      {capa ? (
        <FundoCapa url={capa} className="-mx-4">
          <header className="flex min-h-[180px] flex-col justify-end gap-1 p-4" style={SOMBRA}>
            <h1 className="text-xl font-black uppercase leading-tight text-foreground">{clube.nome}</h1>
            {clube.descricao && <p className="line-clamp-2 text-sm text-foreground/90">{clube.descricao}</p>}
            <p className="text-xs text-[#B1B3B3]">
              {clube.membros} {clube.membros === 1 ? "membro" : "membros"}
              {clube.tipo === "oficial" && <SeloOficial />}
            </p>
          </header>
        </FundoCapa>
      ) : (<>
      <header className="flex items-center gap-4">
        <Quadrado texto={clube.nome[0]?.toUpperCase() ?? ""} grande />
        <div className="min-w-0">
          <h1 className="text-xl font-black uppercase leading-tight text-foreground">{clube.nome}</h1>
          <p className="text-xs text-[#B1B3B3]">
            {clube.membros} {clube.membros === 1 ? "membro" : "membros"}
            {clube.tipo === "oficial" && <span className="ml-2 border border-[#C8282A] px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.08em] text-foreground">Oficial</span>}
          </p>
        </div>
      </header>
      {clube.descricao && <p className="text-sm text-[#B1B3B3]">{clube.descricao}</p>}
      </>)}

      {isLoading ? <Skeleton className="h-40" /> : (
        <>
          {podio.length > 0 && (
            <section className="grid grid-cols-3 items-end gap-2">
              {[podio[1], podio[0], podio[2]].map((l, i) => l ? (
                <div key={i} className={cn("flex flex-col items-center gap-1 border bg-card p-2 text-center", l.eh_voce ? "border-[#c8282a]" : "border-[#4A4B4B]", i === 1 ? "pb-6 pt-4" : "py-3")}>
                  <p className="text-2xl font-black text-foreground">{l.posicao}º</p>
                  <Quadrado texto={iniciaisAbrev(l.nome)} />
                  <p className="w-full truncate text-xs font-bold text-foreground">{l.nome}</p>
                  <p className="text-[11px] text-[#B1B3B3]">{l.dias} dias</p>
                </div>
              ) : <div key={i} />)}
            </section>
          )}

          <ol className="divide-y divide-[#4A4B4B] border border-[#4A4B4B]">
            {(ranking ?? []).map((l, i) => (
              <li key={i} className={cn("flex min-h-[56px] items-center gap-3 px-3", l.eh_voce && "border-2 border-[#c8282a]")}>
                <span className="w-7 text-right text-sm font-black text-foreground">{l.posicao}º</span>
                <Quadrado texto={iniciaisAbrev(l.nome)} />
                <div className="flex min-w-0 flex-1 items-center gap-2">
                  <span className="truncate text-sm font-bold text-foreground">{l.nome}{l.eh_voce ? " (você)" : ""}</span>
                  <SeloPlano chave={l.plano_chave} />
                </div>
                <span className="text-sm font-bold text-foreground">{l.dias}</span>
              </li>
            ))}
          </ol>
        </>
      )}
      <p className="text-xs text-[#B1B3B3]">Conta os dias com treino no mês. Reinicia todo dia 1º.</p>
      {clube.anfitriao && <p className="text-xs text-[#B1B3B3]">Anfitrião: <span className="font-bold text-foreground">{clube.anfitriao}</span></p>}

      <button onClick={() => setConfirmarSaida(true)} className={cn(BOTAO_CONTORNO, "w-full")}>Sair do clube</button>

      {confirmarSaida && (
        <Folha titulo="Sair do clube" onClose={() => setConfirmarSaida(false)}>
          <p className="text-sm text-[#B1B3B3]">Seu nome e seus dias de treino deixam de aparecer para os membros na hora.</p>
          <div className="grid grid-cols-2 gap-3">
            <button onClick={() => setConfirmarSaida(false)} className={BOTAO_CONTORNO}>Cancelar</button>
            <button onClick={sair} disabled={ocupado} className={BOTAO_VERMELHO}>Sair</button>
          </div>
        </Folha>
      )}
    </div>
  );
}
