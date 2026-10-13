import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Switch } from "@/components/ui/switch";
import { IdentificacaoPublicaForm, type IdentificacaoPublica } from "@/components/planos/IdentificacaoPublica";
import { CheckoutSite2027 } from "@/components/planos/CheckoutSite2027";
import { checkout, lerSessao, limparSessao, salvarSessao, type SessaoCheckout } from "@/lib/checkoutSite2027";
import { Check, ArrowLeft, CircleHelp } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Seo } from "@/components/Seo";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { TEXTOS_PLANOS as T, PAGAMENTO_PUBLICO as P, PACOTES_PUBLICOS } from "@/config/planosPublicoTextos";
import {
  FAMILIAS, FREQUENCIAS, NOME_FAMILIA, rotuloFrequencia, formasPermitidas, encontrarItem, itemReferencia,
  pagamentoComRecorrencia, parcelasPacotePublico, precoMensalVitrine, opcoesCorrida, menorPrecoFrequencia, permiteReposicaoPublica, calcularResumo, brl, descreverParcelas,
  type CatalogoPublico, type Familia2027, type Frequencia2027, type FormaPublica, type ServicoPublico, type PeriodoCorrida,
} from "@/lib/planosPublico2027";
import { type FormaServicos2027 } from "@/lib/vendas2027";
import fotoNutricao from "@/assets/planos2027/nutricao.jpg";
import fotoFisio from "@/assets/planos2027/reabilitacao.jpg";
import fotoCorrida from "@/assets/planos2027/corrida.jpg";

function Titulo({ children, subtitulo }: { children: ReactNode; subtitulo?: string }) {
  return <div className="mb-6"><h1 className="font-display text-2xl sm:text-3xl font-extrabold uppercase leading-tight">{children}</h1>{subtitulo && <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{subtitulo}</p>}</div>;
}
function Opcao({ ativo, onClick, children, disabled, className, label }: { ativo: boolean; onClick: () => void; children: ReactNode; disabled?: boolean; className?: string; label?: string }) {
  return <Button type="button" variant="outline" aria-label={label} aria-pressed={ativo} disabled={disabled} onClick={onClick} className={cn("relative h-auto w-full min-w-0 items-start justify-start rounded-none whitespace-normal border p-5 text-left text-sm leading-relaxed hover:bg-card hover:text-foreground", ativo ? "border-primary bg-primary/10" : "border-border bg-card", className)}>{children}</Button>;
}
const nomeServico = (s: ServicoPublico) => `${PACOTES_PUBLICOS[s.codigo]?.area ?? s.atividade} · ${PACOTES_PUBLICOS[s.codigo]?.titulo ?? s.nome}`;
const periodoLabel = (n: number) => n === 1 ? "Mensal" : n === 6 ? "Semestral (6 meses)" : "Anual (12 meses)";

export default function PlanosPublico2027({ catalogo }: { catalogo: CatalogoPublico }) {
  const [passo, setPasso] = useState(0);
  const [freq, setFreq] = useState<Frequencia2027>("2x");
  const [familia, setFamilia] = useState<Familia2027>("power_2027");
  const [nutri, setNutri] = useState<string | null>(null);
  const [reab, setReab] = useState<string | null>(null);
  const [corridaPeriodo, setCorridaPeriodo] = useState<PeriodoCorrida | null>(null);
  const [forma, setForma] = useState<FormaPublica>("cartao_parcelado");
  const [parcelas, setParcelas] = useState(12);
  const [formaServicos, setFormaServicos] = useState<FormaServicos2027>("cartao_parcelado");
  const [parcelasServicos, setParcelasServicos] = useState(6);
  const [detalhes, setDetalhes] = useState(false);
  const [ajuda, setAjuda] = useState(false);
  const [cadastro, setCadastro] = useState(false);
  const [erros, setErros] = useState<Record<string, string>>({});
  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState(false);
  // Checkout do site (prévia + proposta de teste enquanto planos_checkout_ativo=false).
  const [sessao, setSessao] = useState<SessaoCheckout | null>(null);
  const [etapaSessao, setEtapaSessao] = useState<string | undefined>();
  const [alterando, setAlterando] = useState(false);
  const [contato, setContato] = useState({ nome: "", email: "" });
  useEffect(() => {
    if (!catalogo.previa) return;
    const s = lerSessao();
    if (!s) return;
    checkout<{ etapa: string }>("estado", s).then((r) => { setEtapaSessao(r.etapa); setSessao(s); }).catch(() => limparSessao());
  }, [catalogo.previa]);
  const formas = formasPermitidas(familia).slice().sort((a, b) => ["cartao_parcelado", "recorrencia", "pix_vista"].indexOf(a) - ["cartao_parcelado", "recorrencia", "pix_vista"].indexOf(b));
  const formaEfetiva = formas.includes(forma) ? forma : formas[0];
  const item = encontrarItem(catalogo, familia, freq, formaEfetiva);
  const ref = itemReferencia(catalogo, familia, freq);
  const servicosEscolhidos = useMemo(() => catalogo.servicos.filter((s) => s.codigo === nutri || s.codigo === reab), [catalogo.servicos, nutri, reab]);
  const corridaOpcoes = opcoesCorrida(catalogo, familia);
  const corridaEscolhida = corridaOpcoes.find((c) => (c.periodo_meses ?? 1) === corridaPeriodo);
  const resumo = useMemo(() => item ? calcularResumo({ item, servicos: servicosEscolhidos, forma: formaEfetiva, parcelas, formaServicos, parcelasServicos }) : null, [item, servicosEscolhidos, formaEfetiva, parcelas, formaServicos, parcelasServicos]);
  const vitrine = precoMensalVitrine(catalogo, familia, freq);
  const nutris = catalogo.servicos.filter((s) => s.atividade === "Nutrição");
  const fisios = catalogo.servicos.filter((s) => s.atividade === "Reabilitação");
  const nome = NOME_FAMILIA[familia];
  const frequencia = rotuloFrequencia(freq);
  const ir = (n: number) => { setPasso(n); setCadastro(false); window.scrollTo({ top: 0, behavior: "instant" }); };
  async function salvarAlteracao() {
    if (!sessao || !item) return;
    setErros({}); setEnviando(true);
    try {
      await checkout("alterar", { ...sessao, escolhas: {
        plano_codigo: item.codigo, forma_plano: formaEfetiva, parcelas_plano: parcelas,
        servicos: servicosEscolhidos.map((s) => s.codigo), forma_servicos: formaServicos, parcelas_servicos: parcelasServicos,
        corrida: !!corridaEscolhida, corrida_periodo_meses: corridaEscolhida?.periodo_meses ?? 1,
      } });
      setEtapaSessao("identificada"); setAlterando(false); setDetalhes(false); window.scrollTo({ top: 0 });
    } catch (e) { setErros({ geral: (e as Error).message }); }
    setEnviando(false);
  }
  const abrirCadastro = () => { if (sessao && alterando) { void salvarAlteracao(); return; } setDetalhes(false); setPasso(4); setCadastro(true); window.scrollTo({ top: 0, behavior: "instant" }); };
  async function enviar(dados: IdentificacaoPublica) {
    if (!dados.aceite || !item || !resumo) return;
    setErros({});
    setEnviando(true);
    const { data, error } = await supabase.rpc("fn_proposta_plano_2027_criar" as any, { p: {
      previa: catalogo.previa, ...dados,
      plano_codigo: item.codigo, forma_plano: formaEfetiva, parcelas_plano: parcelas,
      servicos: servicosEscolhidos.map((s) => s.codigo), forma_servicos: formaServicos, parcelas_servicos: parcelasServicos,
      corrida: !!corridaEscolhida, corrida_periodo_meses: corridaEscolhida?.periodo_meses ?? 1,
    } });
    setEnviando(false);
    if (error) { setErros({ geral: error.message || "Não foi possível enviar agora. Tente novamente." }); return; }
    const resposta = data as unknown as { valor_total_centavos: number; limitado?: boolean };
    if (resposta.limitado) { setErros({ geral: "Muitas consultas. Tente novamente mais tarde." }); return; }
    if (resposta.valor_total_centavos !== Math.round(resumo.totalGeral * 100)) { setErros({ geral: "Os valores do catálogo mudaram. Revise sua proposta antes de continuar." }); return; }
    const id = (data as unknown as { id?: string }).id;
    if (catalogo.previa && id) {
      try {
        const r = await checkout<{ chave_sessao: string; etapa: string }>("iniciar", { proposta_id: id });
        const s = { proposta_id: id, chave_sessao: r.chave_sessao };
        salvarSessao(s); setContato({ nome: dados.nome, email: dados.email }); setEtapaSessao(r.etapa); setSessao(s);
        window.scrollTo({ top: 0 });
        return;
      } catch { /* checkout fechado para esta proposta: segue o fluxo atual */ }
    }
    setEnviado(true); window.scrollTo({ top: 0 });
  }
  const linhaPagamento = (f: FormaPublica) => f === "recorrencia" ? P.recorrenciaCartao : f === "pix_vista" ? P.pix_vista : `Cartão de crédito em ${parcelas}x`;
  const totalConsultas = resumo?.totalServicos ?? 0;
  const parcelasPlano = resumo?.plano.parcelas ?? [];
  const primeira = parcelasPlano[0];
  const consultasParcela = primeira?.servicos ?? 0;
  const detalhesConteudo = resumo && ref && <div className="space-y-6 text-sm leading-relaxed">
    {familia !== "start_2027" && passo < 4 && <p>{T.resumoAnual(brl(encontrarItem(catalogo, familia, freq, "cartao_parcelado")?.valor ?? 0))}</p>}
    <div><h3 className="font-bold text-lg">{nome} · {frequencia}</h3><p className="mt-2 text-muted-foreground">{familia === "start_2027" ? "Plano mensal, sem fidelidade." : `Fidelidade de ${ref.fidelidade_meses} meses, ${ref.licenca_dias} dias de trancamento e ${ref.avaliacoes_funcionais} ${ref.avaliacoes_funcionais === 1 ? "avaliação funcional" : "avaliações funcionais"}.`}</p></div>
    <div className="space-y-3 border-t border-border pt-5"><h3 className="font-display font-bold uppercase">{T.detalhes.adicionais}</h3>{servicosEscolhidos.length ? servicosEscolhidos.map((s) => <div key={s.codigo} className="flex justify-between gap-4"><span>{nomeServico(s)}</span><strong className="shrink-0">{brl(s.valor)}</strong></div>) : <p className="text-muted-foreground">Nenhum</p>}<div className="flex justify-between gap-4 font-bold"><span>{T.detalhes.consultas}</span><span>{brl(totalConsultas)}</span></div>{corridaEscolhida && <p>Grupo de corrida · {periodoLabel(corridaPeriodo ?? 1)}: {brl(corridaEscolhida.valor)} à parte ({brl(corridaEscolhida.valor / (corridaPeriodo ?? 1))} por mês).</p>}</div>
    <div className="space-y-3 border-t border-border pt-5"><h3 className="font-display font-bold uppercase">{T.detalhes.pagamento}</h3><p>Plano: {linhaPagamento(formaEfetiva)}</p>{totalConsultas > 0 && <p>Consultas: {resumo.servicosAvulsos ? resumo.servicosAvulsos.forma === "pix_vista" ? P.pix_vista : `Cartão de crédito em ${resumo.servicosAvulsos.parcelas.length}x` : `Cartão de crédito em ${parcelas}x, com o plano`}</p>}</div>
    <div className="space-y-3 border-t border-border pt-5"><h3 className="font-display font-bold uppercase">Cobranças</h3>{primeira && <><p>{parcelasPlano.every((p) => p.valor === primeira.valor) ? parcelasPlano.length > 1 ? `1ª a ${parcelasPlano.length}ª cobrança ${brl(primeira.valor)}` : `1ª cobrança ${brl(primeira.valor)}` : descreverParcelas(parcelasPlano)} = Mensalidade {nome} {brl(primeira.plano)}{consultasParcela > 0 && ` + Consultas ${brl(consultasParcela)}`}</p>{resumo.servicosAvulsos && <p>Consultas à parte: {descreverParcelas(resumo.servicosAvulsos.parcelas)}</p>}<p className="text-muted-foreground">{familia === "start_2027" ? "Uma cobrança é gerada a cada mês, até o cancelamento." : formaEfetiva === "pix_vista" ? `Pagamento único do plano no Pix. Em 12 meses você terá pago ${brl(resumo.totalGeral)}.` : `Uma cobrança é gerada a cada mês. Em 12 meses você terá pago ${brl(resumo.totalGeral)}.`}</p></>}<div className="flex justify-between gap-4 text-lg font-bold"><span>{familia === "start_2027" ? "Total do ciclo e consultas" : "Total em 12 meses"}</span><span>{brl(resumo.totalGeral)}</span></div></div>
    {alterando && erros.geral && <p role="alert" className="border-l-2 border-primary pl-3 text-sm">{erros.geral}</p>}
    <Button className="w-full h-auto py-4 rounded-none font-bold uppercase whitespace-normal" disabled={enviando} onClick={abrirCadastro}>{alterando ? "Salvar e revisar" : T.detalhes.continuar}</Button>
  </div>;

  return <div data-planos2027="true" className="min-h-screen bg-background text-foreground">
    <Seo path="/planos" title="Planos FORTEM — monte seu plano" description="Escolha frequência, vantagens e consultas e monte seu plano FORTEM." />
    {catalogo.previa && <div className="bg-primary text-primary-foreground text-center text-xs font-semibold py-2 px-4">Prévia — itens ainda não estão à venda</div>}
    <header className="border-b border-border"><div className="mx-auto max-w-6xl px-4 sm:px-8 py-5 flex items-center justify-between"><span className="font-display text-xl font-black">FORTEM</span><span className="text-xs uppercase">Monte seu plano</span></div></header>
    <main className="mx-auto max-w-6xl px-4 sm:px-8 pt-6 pb-48 lg:pb-12">
      {sessao && !alterando ? <CheckoutSite2027 key={`${sessao.proposta_id}-${etapaSessao}`} sessao={sessao} etapaInicial={etapaSessao}
        nome={contato.nome || "Do seu cadastro"} email={contato.email || "Do seu cadastro"}
        onAlterar={() => { setAlterando(true); ir(0); }}
        onSessaoInvalida={() => { setSessao(null); setEtapaSessao(undefined); ir(0); }} />
      : enviado ? <div className="max-w-2xl py-10"><Titulo>A equipe FORTEM entra em contato</Titulo><p className="text-muted-foreground">Recebemos a sua escolha. Em breve você recebe uma mensagem no WhatsApp para confirmar os detalhes e concluir a matrícula.</p><p className="mt-6 font-bold">{nome} · {frequencia}</p><p className="mt-2">Total: {brl(resumo?.totalGeral ?? 0)}</p></div> : <>
        <ol className="grid grid-cols-5 gap-1 lg:gap-4 mb-7" aria-label="Etapas">{T.passos.map((p, i) => <li key={p}><Button variant="ghost" disabled={i > passo} onClick={() => ir(i)} aria-current={i === passo ? "step" : undefined} className="w-full h-auto p-0 rounded-none flex-col items-start hover:bg-transparent"><span className={cn("block h-1 w-full", i <= passo ? "bg-primary" : "bg-border")} /><span className={cn("mt-3 hidden lg:flex items-center gap-2 text-xs", i === passo ? "text-foreground" : "text-muted-foreground")}><span className={cn("flex size-6 items-center justify-center border", i === passo ? "border-primary text-primary" : "border-border")}>{i + 1}</span>{p}</span></Button></li>)}</ol>
        <div className="grid lg:grid-cols-[minmax(0,1fr)_300px] gap-8 xl:gap-12 items-start">
          <div className="min-w-0"><p className="text-xs text-primary font-semibold uppercase mb-3">Passo {passo + 1} de 5</p>
          {cadastro ? <>
            <Titulo subtitulo={`${nome} · ${frequencia}`}>{T.identificacao.titulo}</Titulo>
            <IdentificacaoPublicaForm onSubmit={enviar} enviando={enviando} erro={erros.geral} />
            <Button variant="link" className="p-0 h-auto rounded-none mt-4" onClick={() => setCadastro(false)}>Voltar ao pagamento</Button>
          </> : <>
          {passo === 0 && <section><Titulo subtitulo={T.frequencia.subtitulo}>{T.frequencia.titulo}</Titulo><div className="grid sm:grid-cols-2 gap-3">{FREQUENCIAS.map((f) => { const preco = menorPrecoFrequencia(catalogo, f); return <Opcao key={f} label={rotuloFrequencia(f)} ativo={freq === f} disabled={preco === null} onClick={() => setFreq(f)}><span className="block"><span className="font-display text-xl font-bold uppercase block">{rotuloFrequencia(f)}</span><span className="mt-5 block text-muted-foreground">a partir de <strong className="text-foreground">{preco === null ? "Indisponível" : brl(preco)}</strong> por mês</span></span></Opcao>; })}</div><div className="mt-6 space-y-3 text-sm text-muted-foreground"><p>{T.frequencia.limite}</p><p>{T.frequencia.anual}</p></div></section>}
          {passo === 1 && <section><Titulo subtitulo={T.vantagens.subtitulo(frequencia)}>{T.vantagens.titulo}</Titulo><div role="radiogroup" aria-label="Plano" className="grid gap-4 xl:grid-cols-3">{FAMILIAS.map((f) => { const p = itemReferencia(catalogo, f, freq); const beneficios = f === "start_2027" ? T.vantagens.start : f === "power_2027" ? T.vantagens.power : T.vantagens.pro; return <article key={f} role="radio" aria-checked={familia === f} aria-label={`Escolher ${NOME_FAMILIA[f]}`} aria-disabled={!p} tabIndex={p ? 0 : -1} onClick={(e) => { if (p && !(e.target as HTMLElement).closest("button,a")) setFamilia(f); }} onKeyDown={(e) => { if (e.target === e.currentTarget && p && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); setFamilia(f); } }} className={cn("relative border bg-card cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", familia === f ? "border-primary" : "border-border")}>
            {f === "pro_2027" && <p className="bg-primary text-primary-foreground text-center text-[11px] font-bold py-2 px-2 uppercase">Melhor custo-benefício</p>}
            <div className="p-5"><span className="block"><span className="flex justify-between items-center font-display text-2xl font-black uppercase">{NOME_FAMILIA[f]}{familia === f && <Check className="size-4 text-primary" />}</span><span className="block mt-3 font-bold text-xl">{brl(precoMensalVitrine(catalogo, f, freq) ?? 0)}<span className="text-xs font-normal text-muted-foreground"> /mês</span></span></span></div>
            <ul className="px-5 pb-5 space-y-3 text-sm leading-relaxed">{beneficios.map((b) => <li key={b} className="flex items-start gap-2"><Check className="mt-1 size-3 shrink-0 text-primary" /><span>{b}</span></li>)}{p && permiteReposicaoPublica(p) && <li className="flex items-start gap-2"><Check className="mt-1 size-3 shrink-0 text-primary" /><span>{T.vantagens.reposicao} <Button variant="ghost" size="icon" className="inline-flex size-6 rounded-none text-muted-foreground" aria-label="O que é reposição de créditos?" onClick={(e) => { e.stopPropagation(); setAjuda(true); }}><CircleHelp /></Button></span></li>}</ul>
          </article>; })}</div></section>}
          {passo === 2 && <section><Titulo subtitulo={T.turbine.subtitulo}>{T.turbine.titulo}</Titulo><div className="space-y-7">{T.profissionais.map((p, i) => { const precos = (i === 0 ? nutris : i === 1 ? fisios : catalogo.corrida.filter((c) => (c.periodo_meses ?? 1) === 1)).map((s) => s.valor); return <article key={p.area} className="grid grid-cols-[80px_minmax(0,1fr)] sm:grid-cols-[112px_minmax(0,1fr)] gap-4 sm:gap-6 border-b border-border pb-7"><img src={[fotoNutricao, fotoFisio, fotoCorrida][i]} alt={`${p.nome} — foto provisória`} width={112} height={140} className="w-full aspect-[4/5] object-cover" loading="lazy" /><div className="min-w-0"><h2 className="font-display text-xl font-bold uppercase">{p.area}</h2><p className="mt-1 text-sm text-primary font-semibold">{p.papel} · {p.nome}</p><div className="mt-4 space-y-3 text-sm text-muted-foreground leading-relaxed">{p.especialidades.map((e) => <p key={e.texto}>{e.titulo && <strong className="text-foreground">{e.titulo}: </strong>}{e.texto}</p>)}</div><p className="mt-4 text-sm font-bold">{precos.length ? i === 2 ? `A partir de ${brl(Math.min(...precos))} por mês` : `Pacotes a partir de ${brl(Math.min(...precos))}` : "Indisponível"}</p></div></article>; })}</div></section>}
          {passo === 3 && <section className="space-y-8"><Titulo subtitulo={T.acompanhamento.subtitulo}>{T.acompanhamento.titulo}</Titulo><GrupoServico titulo="Nutrição" profissional="com a Nutricionista Jéssica Elkfury" nota={T.acompanhamento.nutricaoNota} itens={nutris} familia={familia} valor={nutri} onChange={setNutri} /><GrupoServico titulo="Fisioterapia" profissional="com a Fisioterapeuta Júlia Assis Brasil" nota={T.acompanhamento.fisioNota} itens={fisios} familia={familia} valor={reab} onChange={setReab} /><div><h2 className="font-display text-xl font-bold uppercase">Grupo de corrida</h2><p className="mt-1 mb-4 text-sm text-muted-foreground">com a Professora Yasmim Ávila</p><div className="grid gap-3 sm:grid-cols-2"><Opcao ativo={!corridaEscolhida} onClick={() => setCorridaPeriodo(null)}>Nenhum</Opcao>{corridaOpcoes.map((c) => { const n = c.periodo_meses ?? 1; return <Opcao key={n} label={`Corrida ${periodoLabel(n)}`} ativo={corridaPeriodo === n} onClick={() => setCorridaPeriodo(n)}><span className="block"><strong className="block">{periodoLabel(n)}</strong>{c.valor_cheio != null && c.valor_cheio > c.valor && <span className="block mt-2">de <s>{brl(c.valor_cheio / n)}</s> por</span>}<span className="mt-2 block font-bold text-lg">{brl(c.valor / n)} <span className="text-xs font-normal">por mês</span></span>{n > 1 && <span className="block text-muted-foreground">Total: {brl(c.valor)}</span>}<span className="mt-2 block text-xs text-muted-foreground">{P.corrida[n]}</span></span></Opcao>; })}</div></div></section>}
          {passo === 4 && <section className="space-y-7"><Titulo subtitulo={P.subtitulo(nome, frequencia)}>{P.titulo}</Titulo>{familia !== "start_2027" && <div className="border-y border-border py-5 space-y-3"><div className="flex items-start justify-between gap-4"><label htmlFor="recorrencia" className="font-bold">{P.toggleTitulo}</label><Switch id="recorrencia" aria-label={P.toggleTitulo} checked={formaEfetiva === "recorrencia"} onCheckedChange={(ligado) => setForma(pagamentoComRecorrencia(familia, ligado, formaEfetiva))} /></div><p className="text-sm text-muted-foreground">{P.toggleDescricao(brl(encontrarItem(catalogo, familia, freq, "recorrencia")?.taxa_recorrencia ?? 0))}</p><p className="text-sm italic text-muted-foreground">{P.toggleNota}</p>{formaEfetiva === "recorrencia" && primeira && <p className="font-bold">{brl(primeira.plano)} por mês · 12 cobranças</p>}</div>}<div className="grid gap-3">{formas.filter((f) => familia === "start_2027" ? f === "recorrencia" : formaEfetiva !== "recorrencia" && f !== "recorrencia").map((f) => { const it = encontrarItem(catalogo, familia, freq, f); const calc = it ? calcularResumo({ item: it, servicos: [], forma: f, parcelas: 12, formaServicos: "pix_vista", parcelasServicos: 1 }) : null; return <Opcao key={f} label={P[f]} ativo={formaEfetiva === f} disabled={!it} onClick={() => setForma(f)}><span className="block"><strong className="block">{P[f]}</strong>{it && calc ? <><span className="block mt-2 text-muted-foreground">{f === "recorrencia" ? familia === "start_2027" ? P.startDescricao : P.recorrenciaDescricao(brl(it.taxa_recorrencia)) : `${f === "pix_vista" ? P.pixDescricao : P.semAdicional} Total de ${brl(calc.totalPlano)}.`}</span>{f !== "pix_vista" && <span className="mt-3 block font-bold text-xl">{f === "recorrencia" ? `${brl(calc.plano.parcelas[0].valor)} por mês` : descreverParcelas(calc.plano.parcelas)}</span>}</> : "Indisponível"}</span></Opcao>; })}</div>
            {formaEfetiva === "cartao_parcelado" && <label className="block text-sm">Número de parcelas<select aria-label="Parcelas do plano" value={parcelas} onChange={(e) => setParcelas(Number(e.target.value))} className="campo mt-2">{Array.from({ length: 12 }, (_, i) => i + 1).map((n) => <option key={n} value={n}>{n}x</option>)}</select></label>}
            <div className="border-t border-border pt-5 text-sm leading-relaxed"><h2 className="font-bold mb-2">{P.consultas}</h2><p className="text-muted-foreground">{familia === "start_2027" ? P.consultasStart : formaEfetiva === "cartao_parcelado" ? P.consultasPlano : P.consultasExplicacao}</p></div>
            {totalConsultas > 0 && formaEfetiva !== "cartao_parcelado" && <div className="space-y-3"><div className="grid grid-cols-2 gap-3"><Opcao ativo={formaServicos === "cartao_parcelado"} onClick={() => setFormaServicos("cartao_parcelado")}>{P.cartaoConsultas}</Opcao><Opcao ativo={formaServicos === "pix_vista"} onClick={() => setFormaServicos("pix_vista")}>{P.pix_vista}</Opcao></div>{formaServicos === "cartao_parcelado" && <label className="block text-sm">Parcelas das consultas<select aria-label="Parcelas das consultas" className="campo mt-2" value={parcelasServicos} onChange={(e) => setParcelasServicos(Number(e.target.value))}>{Array.from({ length: 6 }, (_, i) => i + 1).map((n) => <option key={n} value={n}>{n}x</option>)}</select></label>}</div>}
            <div className="border-t border-border pt-5 text-sm leading-relaxed"><h2 className="font-bold mb-2">Grupo de corrida</h2><p className="text-muted-foreground">{P.corridaExplicacao}</p></div>
          </section>}
          </>}
          <div className="hidden lg:flex mt-8 gap-3">{(passo > 0 || cadastro) && <Button variant="outline" size="icon" className="rounded-none" aria-label="Voltar" onClick={() => cadastro ? setCadastro(false) : ir(passo - 1)}><ArrowLeft /></Button>}{!cadastro && <Button disabled={!ref} className="rounded-none h-auto py-3 px-6 font-bold uppercase" onClick={() => passo === 4 ? abrirCadastro() : ir(passo + 1)}>{passo === 4 ? T.detalhes.continuar : "Continuar"}</Button>}</div>
          </div>
          <aside className="hidden lg:block sticky top-6 border-l border-border pl-6 min-w-0"><h2 className="font-display text-lg font-bold uppercase">Resumo do pedido</h2><p className="mt-5 font-bold">{nome} · {frequencia}</p><dl className="space-y-4 mt-5 text-sm"><div className="flex justify-between gap-3"><dt>Mensalidade</dt><dd className="font-bold">{brl(vitrine ?? 0)}</dd></div>{servicosEscolhidos.map((s) => <div key={s.codigo} className="flex justify-between gap-3"><dt>{nomeServico(s)}</dt><dd className="shrink-0">{brl(s.valor)}</dd></div>)}{corridaEscolhida && <div><dt>Grupo de corrida · {periodoLabel(corridaPeriodo ?? 1)}</dt><dd>{brl(corridaEscolhida.valor / (corridaPeriodo ?? 1))} por mês, à parte</dd></div>}</dl>{familia !== "start_2027" && passo < 4 && <p className="mt-5 text-sm text-muted-foreground leading-relaxed">{T.resumoAnual(brl(encontrarItem(catalogo, familia, freq, "cartao_parcelado")?.valor ?? 0))}</p>}{passo === 4 && resumo && <div className="mt-5 border-t border-border pt-5"><p className="text-sm">{descreverParcelas(resumo.plano.parcelas)}{familia === "start_2027" && " por mês"}</p>{resumo.servicosAvulsos && <p className="text-sm mt-2">Consultas: {descreverParcelas(resumo.servicosAvulsos.parcelas)}</p>}<p className="font-bold mt-4">Total: {brl(resumo.totalGeral)}</p></div>}<Button variant="link" className="p-0 h-auto mt-5 rounded-none" onClick={() => setDetalhes(true)}>Detalhes ›</Button></aside>
        </div>
        {!cadastro && <div className="lg:hidden fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 backdrop-blur"><div className="px-4 pt-3 pb-4 space-y-2"><div className="flex justify-between gap-3 text-xs"><span>{nome} · {frequencia}</span><Button variant="link" className="h-auto p-0 rounded-none text-xs" onClick={() => setDetalhes(true)}>Detalhes ›</Button></div><div className="flex items-center gap-2">{passo > 0 && <Button variant="outline" size="icon" className="rounded-none shrink-0" aria-label="Voltar" onClick={() => ir(passo - 1)}><ArrowLeft /></Button>}<div className="min-w-0 flex-1"><p className="font-bold text-sm">{passo === 4 && primeira ? formaEfetiva === "cartao_parcelado" ? `${parcelas}x ${brl(primeira.plano)}` : formaEfetiva === "recorrencia" ? `${brl(primeira.plano)} /mês` : brl(primeira.plano) : `${brl(vitrine ?? 0)} /mês`}</p>{passo === 3 && <p className="text-xs text-muted-foreground">Consultas {brl(totalConsultas)}</p>}{passo === 4 && totalConsultas > 0 && <p className="text-xs text-muted-foreground">Consultas {resumo?.servicosAvulsos ? descreverParcelas(resumo.servicosAvulsos.parcelas) : `${parcelas}x ${brl(consultasParcela)}`}</p>}</div><Button disabled={!ref} className="rounded-none h-auto py-3 px-3 text-xs font-bold uppercase whitespace-normal max-w-[155px]" onClick={() => passo === 4 ? abrirCadastro() : ir(passo + 1)}>{passo === 4 ? T.detalhes.continuar : "Continuar"}</Button></div>{passo === 2 && familia !== "start_2027" && <p className="text-xs text-muted-foreground">Plano anual em até 12x no cartão</p>}</div></div>}
      </>}
    </main>
    <Dialog open={detalhes} onOpenChange={setDetalhes}><DialogContent data-planos2027="true" className="rounded-none sm:rounded-none max-w-xl text-foreground"><DialogTitle className="font-display uppercase font-bold pr-7">{T.detalhes.titulo}</DialogTitle><DialogDescription className="sr-only">Resumo do plano, serviços adicionais e pagamento</DialogDescription>{detalhesConteudo}</DialogContent></Dialog>
    <Dialog open={ajuda} onOpenChange={setAjuda}><DialogContent data-planos2027="true" className="rounded-none sm:rounded-none text-foreground"><DialogTitle>O que é isso?</DialogTitle><DialogDescription className="text-sm leading-relaxed">{T.vantagens.ajuda.replace("O que é isso? ", "")}</DialogDescription></DialogContent></Dialog>
  </div>;
}
function GrupoServico({ titulo, profissional, nota, itens, familia, valor, onChange }: { familia: Familia2027; titulo: string; profissional: string; nota: string; itens: ServicoPublico[]; valor: string | null; onChange: (v: string | null) => void }) {
  return <div><h2 className="font-display text-xl font-bold uppercase">{titulo}</h2><p className="mt-1 mb-4 text-sm text-muted-foreground">{profissional}</p><div className="grid gap-3"><Opcao ativo={valor === null} onClick={() => onChange(null)}>Nenhum</Opcao>{itens.map((s) => { const pacote = PACOTES_PUBLICOS[s.codigo]; const parcelas = parcelasPacotePublico(s, familia); return <Opcao key={s.codigo} label={`${titulo} ${pacote?.titulo ?? s.nome}`} ativo={valor === s.codigo} onClick={() => onChange(s.codigo)}><span className="block"><strong className="block">{pacote?.titulo ?? s.nome}</strong>{pacote?.nota && <span className="block text-muted-foreground">{pacote.nota}</span>}<span className="block mt-2">{brl(s.valor)} ou {descreverParcelas(parcelas)}</span></span></Opcao>; })}</div><p className="mt-4 text-xs leading-relaxed text-muted-foreground">{nota}</p></div>;
}
