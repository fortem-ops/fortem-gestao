import { useEffect, useRef, useState } from "react";
import { Clock3, CreditCard, LockKeyhole, QrCode, ClipboardCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TEXTOS_CHECKOUT as C } from "@/config/planosPublicoTextos";
import { checkout, lerCodigo, type SessaoCheckout } from "@/lib/checkoutSite2027";

type TentativaTela = { id: string; tipo: "pix" | "cartao"; simulado: boolean; valor_centavos: number; total_proposta_centavos: number; parcelas: number; status: "pendente" | "aprovado" | "recusado" | "expirado"; expira_em: string | null };
type RespostaPagamento = { tentativa: TentativaTela | null; pix_copia_cola?: string | null };

export type RevisaoCheckout = {
  etapa: string; familia: string; plano_codigo: string; forma_plano: string; parcelas_plano: number;
  plano_centavos: number; servicos: { codigo: string; nome: string; valor_centavos: number }[]; servicos_centavos: number;
  forma_servicos: string | null; parcelas_servicos: number | null; corrida_periodo_meses: number | null;
  corrida_total_centavos: number | null; total_centavos: number;
};
export type TelaPagamento = {
  revisao: RevisaoCheckout; aceite_id: string;
  pagamento: { reservado: boolean; cartao_a_combinar?: boolean; validade_pix_segundos: number; formas_permitidas: string[]; parcelas: number[]; parcelas_servicos: number[] };
};
const brl = (c: number) => (c / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const nomes: Record<string, string> = { start_2027: "Start", power_2027: "Power", pro_2027: "Pro" };
const frequencias: Record<string, string> = { "1x": "1x por semana", "2x": "2x por semana", "3x": "3x por semana", livre: "Livre" };
const descrever = (p: number[]) => `${p.length}x de ${brl(p[0] ?? 0)}${p.some((v) => v !== p[0]) ? ` (última ${brl(p[p.length - 1])})` : ""}`;
const controle = "h-auto min-h-12 rounded-none py-4 font-bold uppercase whitespace-normal";

function restante(expira: string | null, agora: number) {
  const s = Math.max(0, Math.floor(((expira ? Date.parse(expira) : 0) - agora) / 1000));
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

/** Pix à vista e cartão até 12x. Valores e modo sempre do servidor; sem campos de cartão. */
function PagamentoAtivo({ sessao, pix, onAprovado }: { sessao: SessaoCheckout; pix: boolean; onAprovado: (simulado: boolean) => void }) {
  const [t, setT] = useState<TentativaTela | null>(null);
  const [copia, setCopia] = useState<string | null>(null);
  const [erro, setErro] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [copiado, setCopiado] = useState(false);
  const [agora, setAgora] = useState(Date.now());
  const aplicar = (r: RespostaPagamento) => { setT(r.tentativa); if (r.pix_copia_cola !== undefined) setCopia(r.pix_copia_cola ?? null); };
  async function chamar(acao: string, extra: Record<string, unknown> = {}) {
    setOcupado(true); setErro("");
    try { aplicar(await checkout<RespostaPagamento>(acao, { ...sessao, ...extra })); }
    catch (e) { setErro(e instanceof Error ? e.message : C.erroGenerico); }
    finally { setOcupado(false); }
  }
  useEffect(() => { checkout<RespostaPagamento>("status_pagamento", sessao).then(aplicar).catch(() => {}); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);
  useEffect(() => { if (t?.status === "aprovado") onAprovado(t.simulado); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [t?.status]);
  const pendentePix = pix && t?.tipo === "pix" && t.status === "pendente";
  useEffect(() => {
    if (!pendentePix) return;
    const relogio = setInterval(() => setAgora(Date.now()), 1000);
    const consulta = setInterval(() => { checkout<RespostaPagamento>("status_pagamento", sessao).then(aplicar).catch(() => {}); }, 5000);
    return () => { clearInterval(relogio); clearInterval(consulta); };
  }, [pendentePix, sessao]);
  const teste = t && !t.simulado && t.valor_centavos !== t.total_proposta_centavos;
  return <div className="mt-6 border-y border-border py-6">
    {t?.simulado && <p role="note" className="mb-4 border border-primary/60 p-3 text-sm font-semibold">{C.pagamento.simulacao}</p>}
    {teste && <p className="mb-4 text-sm font-semibold">{C.pagamento.valorTeste(brl(t!.valor_centavos))}</p>}
    {pix ? <>
      {pendentePix ? <div className="text-center">
        <div className="mx-auto flex aspect-square w-48 max-w-full flex-col items-center justify-center gap-4 border border-dashed border-border bg-muted/30 p-5"><QrCode aria-hidden="true" className="size-12 text-muted-foreground" /><span className="text-sm text-muted-foreground">{t!.simulado ? C.pagamento.pixSimulado : C.pagamento.aguardandoPix}</span></div>
        <p className="mt-5 flex items-center justify-center gap-2 text-sm" aria-live="off"><Clock3 className="size-4" />{C.pagamento.restante} · {restante(t!.expira_em, agora)}</p>
        <p role="status" className="mt-3 text-sm text-muted-foreground">{C.pagamento.aguardandoPix}</p>
        {copia && <div className="mt-4 grid gap-2"><code className="block break-all border border-border p-3 text-left text-xs">{copia}</code>
          <Button variant="outline" className={controle} onClick={() => { navigator.clipboard?.writeText(copia).then(() => setCopiado(true)).catch(() => {}); }}>{copiado ? C.pagamento.copiado : C.pagamento.copiar}</Button></div>}
        {t!.simulado && <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <Button className={controle} disabled={ocupado} onClick={() => chamar("simular_pix", { resultado: "aprovado" })}>{C.pagamento.simularPago}</Button>
          <Button variant="outline" className={controle} disabled={ocupado} onClick={() => chamar("simular_pix", { resultado: "expirado" })}>{C.pagamento.simularExpirar}</Button>
        </div>}
      </div> : <>
        {t?.status === "expirado" && <p role="alert" className="mb-4 text-sm">{C.pagamento.pixExpirado}</p>}
        <Button className={`${controle} w-full`} disabled={ocupado} onClick={() => chamar("pagar_pix")}>{t?.status === "expirado" ? C.pagamento.novoPix : C.pagamento.gerarPix}</Button>
      </>}
    </> : <>
      <LockKeyhole aria-hidden="true" className="mb-4 size-7 text-muted-foreground" />
      <p className="text-sm text-muted-foreground">{C.pagamento.cartaoSimulado}</p>
      {t?.status === "recusado" && <p role="alert" className="mt-4 text-sm font-semibold">{C.pagamento.recusado}</p>}
      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <Button className={controle} disabled={ocupado} onClick={() => chamar("pagar_cartao", { simular: "aprovado" })}>{C.pagamento.simularAprovar}</Button>
        <Button variant="outline" className={controle} disabled={ocupado} onClick={() => chamar("pagar_cartao", { simular: "recusado" })}>{C.pagamento.simularRecusar}</Button>
      </div>
    </>}
    {erro && <p role="alert" className="mt-4 text-sm font-semibold text-destructive">{erro}</p>}
  </div>;
}

export function PagamentoReservado2027({ tela, sessao, confirmacao, onConfirmar, onVoltar, onAlterar }: {
  tela: TelaPagamento; sessao: SessaoCheckout; confirmacao: boolean; onConfirmar: () => void; onVoltar: () => void; onAlterar: () => void;
}) {
  const [aprovado, setAprovado] = useState<null | "real" | "simulado">(null);
  const { revisao: r, pagamento: p } = tela;
  const titulo = useRef<HTMLHeadingElement>(null);
  useEffect(() => { titulo.current?.focus(); }, [confirmacao]);
  const codigo = lerCodigo(r.plano_codigo);
  const pix = r.forma_plano === "pix_vista";
  const recorrencia = r.forma_plano === "recorrencia";
  const combinar = !pix && p.cartao_a_combinar === true;
  const [avisando, setAvisando] = useState(false);
  const [erroCombinar, setErroCombinar] = useState("");
  async function combinarComEquipe() {
    setAvisando(true); setErroCombinar("");
    try { await checkout("cartao_combinar", sessao); onConfirmar(); }
    catch (e) { setErroCombinar(e instanceof Error ? e.message : C.erroGenerico); }
    finally { setAvisando(false); }
  }
  const forma = pix ? C.pagamento.pix : recorrencia ? C.pagamento.recorrencia : C.pagamento.cartao;
  const linhas = [
    [C.revisao.frequencia, frequencias[codigo.frequencia] ?? codigo.frequencia],
    [C.revisao.periodo, r.familia === "start_2027" ? "Mensal, sem fidelidade" : "12 meses"],
    [C.revisao.pagamento, `${forma} · ${recorrencia ? `${brl(p.parcelas[0])} por mês` : pix ? brl(r.plano_centavos) : descrever(p.parcelas)}`],
    [C.revisao.acompanhamento, r.servicos.length ? r.servicos.map((s) => `${s.nome.replace(/\s*\(2027\)\s*$/, "")} · ${brl(s.valor_centavos)}`).join(", ") + (p.parcelas_servicos.length ? ` · ${r.forma_servicos === "pix_vista" ? C.pagamento.pix : descrever(p.parcelas_servicos)}` : "") : C.revisao.nenhum],
    [C.revisao.corrida, r.corrida_total_centavos ? `${r.corrida_periodo_meses} ${r.corrida_periodo_meses === 1 ? "mês" : "meses"} · ${brl(r.corrida_total_centavos)} · ${C.revisao.corridaParte}` : C.revisao.nenhum],
  ];
  return <section className="max-w-5xl">
    <p className="mb-3 text-xs font-semibold uppercase text-primary">{confirmacao ? C.confirmacao.passo : C.pagamento.passo}</p>
    <h1 ref={titulo} tabIndex={-1} className="font-display text-2xl sm:text-3xl font-extrabold uppercase leading-tight outline-none">{confirmacao ? C.confirmacao.titulo : C.pagamento.titulo}</h1>
    <p className="mt-2 text-muted-foreground">{confirmacao ? (aprovado ? C.confirmacao.textoAprovado : C.confirmacao.texto) : C.pagamento.subtitulo}</p>
    <div className="mt-8 grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_340px]">
      <div className="min-w-0">
        {confirmacao ? <>
          <div role="status" className="flex items-center gap-3 border-y border-border py-5"><ClipboardCheck className="size-6 shrink-0 text-primary" /><strong className="font-display uppercase">{aprovado === "simulado" ? C.pagamento.aprovadoSimulado : aprovado ? C.pagamento.aprovado : C.confirmacao.status}</strong></div>
          <h2 className="mt-7 font-display text-lg font-bold uppercase">{C.confirmacao.proximos}</h2>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{C.confirmacao.equipe}</p>
          <Button variant="outline" className={`${controle} mt-7 w-full`} onClick={onVoltar}>{C.pagamento.voltar}</Button>
        </> : <>
          <h2 className="font-display text-lg font-bold uppercase">{C.pagamento.forma}</h2>
          <div role="group" aria-label={C.pagamento.forma} className="mt-4 grid gap-3">
            {p.formas_permitidas.map((f) => <Button key={f} variant="outline" aria-pressed={true} className={`${controle} justify-start gap-3 border-primary bg-primary/10 px-4`}><span aria-hidden="true">{pix ? <QrCode /> : <CreditCard />}</span>{forma}</Button>)}
          </div>
          {!pix && !recorrencia && <label className="mt-5 block text-sm">{C.pagamento.parcelas}<select disabled value={p.parcelas.length} className="campo mt-2"><option value={p.parcelas.length}>{descrever(p.parcelas)}</option></select></label>}
          <p className="mt-4 text-xs leading-relaxed text-muted-foreground">{C.pagamento.escolhaAviso}</p>
          {combinar ? <>
            <div className="mt-6 border-y border-border py-6"><LockKeyhole aria-hidden="true" className="mb-4 size-7 text-muted-foreground" /><p className="text-sm">{C.pagamento.cartaoAviso}</p><p className="mt-3 text-sm text-muted-foreground">{C.pagamento.combinar}</p></div>
            <Button className={`${controle} mt-5 w-full`} disabled={avisando} onClick={combinarComEquipe}>{C.pagamento.combinarBotao}</Button>
            {erroCombinar && <p role="alert" className="mt-4 text-sm font-semibold text-destructive">{erroCombinar}</p>}
          </> : recorrencia ? <>
            <div className="mt-6 border-y border-border py-6"><LockKeyhole aria-hidden="true" className="mb-4 size-7 text-muted-foreground" /><p className="text-sm">{C.pagamento.cartaoAviso}</p><p className="mt-3 text-sm text-muted-foreground">{C.pagamento.primeiraRecorrencia}</p></div>
            <p role="status" className="mt-5 text-sm font-semibold">{C.pagamento.reservado}</p>
            <Button disabled className={`${controle} mt-4 w-full`}>{C.pagamento.pagar}</Button>
          </> : <PagamentoAtivo sessao={sessao} pix={pix} onAprovado={(sim) => { setAprovado(sim ? "simulado" : "real"); onConfirmar(); }} />}
          {recorrencia && !combinar && <Button className={`${controle} mt-3 w-full`} onClick={onConfirmar}>{C.pagamento.continuar}</Button>}
        </>}
      </div>
      <aside className="min-w-0 border-t border-border pt-6 lg:border-l lg:border-t-0 lg:pl-6 lg:pt-0">
        <h2 className="font-display text-lg font-bold uppercase">{C.pagamento.resumo}</h2>
        <p className="mt-5 font-display text-2xl font-bold uppercase">{nomes[r.familia] ?? r.familia}</p>
        <dl className="mt-4 text-sm">{linhas.map(([k, v]) => <div key={k} className="border-b border-border py-3"><dt className="text-xs font-semibold uppercase text-muted-foreground">{k}</dt><dd className="mt-2 break-words leading-relaxed">{v}</dd></div>)}<div className="flex flex-wrap justify-between gap-3 py-5 font-bold"><dt className="font-display uppercase">{C.revisao.total}</dt><dd>{brl(r.total_centavos)}</dd></div></dl>
        <Button variant="outline" className={`${controle} w-full`} onClick={onAlterar}>{C.revisao.alterar}</Button>
        <p className="mt-3 text-xs leading-relaxed text-muted-foreground">{C.revisao.avisoAceite}</p>
      </aside>
    </div>
  </section>;
}