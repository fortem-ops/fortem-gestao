import { useEffect, useRef } from "react";
import { Clock3, CreditCard, LockKeyhole, QrCode, ClipboardCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TEXTOS_CHECKOUT as C } from "@/config/planosPublicoTextos";
import { lerCodigo } from "@/lib/checkoutSite2027";

export type RevisaoCheckout = {
  etapa: string; familia: string; plano_codigo: string; forma_plano: string; parcelas_plano: number;
  plano_centavos: number; servicos: { codigo: string; nome: string; valor_centavos: number }[]; servicos_centavos: number;
  forma_servicos: string | null; parcelas_servicos: number | null; corrida_periodo_meses: number | null;
  corrida_total_centavos: number | null; total_centavos: number;
};
export type TelaPagamento = {
  revisao: RevisaoCheckout; aceite_id: string;
  pagamento: { reservado: boolean; validade_pix_segundos: number; formas_permitidas: string[]; parcelas: number[]; parcelas_servicos: number[] };
};
const brl = (c: number) => (c / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const nomes: Record<string, string> = { start_2027: "Start", power_2027: "Power", pro_2027: "Pro" };
const frequencias: Record<string, string> = { "1x": "1x por semana", "2x": "2x por semana", "3x": "3x por semana", livre: "Livre" };
const descrever = (p: number[]) => `${p.length}x de ${brl(p[0] ?? 0)}${p.some((v) => v !== p[0]) ? ` (última ${brl(p[p.length - 1])})` : ""}`;
const controle = "h-auto min-h-12 rounded-none py-4 font-bold uppercase whitespace-normal";

export function PagamentoReservado2027({ tela, confirmacao, onConfirmar, onVoltar, onAlterar }: {
  tela: TelaPagamento; confirmacao: boolean; onConfirmar: () => void; onVoltar: () => void; onAlterar: () => void;
}) {
  const { revisao: r, pagamento: p } = tela;
  const titulo = useRef<HTMLHeadingElement>(null);
  useEffect(() => { titulo.current?.focus(); }, [confirmacao]);
  const codigo = lerCodigo(r.plano_codigo);
  const pix = r.forma_plano === "pix_vista";
  const recorrencia = r.forma_plano === "recorrencia";
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
    <p className="mt-2 text-muted-foreground">{confirmacao ? C.confirmacao.texto : C.pagamento.subtitulo}</p>
    <div className="mt-8 grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_340px]">
      <div className="min-w-0">
        {confirmacao ? <>
          <div role="status" className="flex items-center gap-3 border-y border-border py-5"><ClipboardCheck className="size-6 shrink-0 text-primary" /><strong className="font-display uppercase">{C.confirmacao.status}</strong></div>
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
          {pix ? <div className="mt-6 border-y border-border py-6 text-center">
            <div className="mx-auto flex aspect-square w-48 max-w-full flex-col items-center justify-center gap-4 border border-dashed border-border bg-muted/30 p-5"><QrCode aria-hidden="true" className="size-12 text-muted-foreground" /><span className="text-sm text-muted-foreground">{C.pagamento.pixCodigo}</span></div>
            <p className="mt-5 flex items-center justify-center gap-2 text-xs text-muted-foreground"><Clock3 className="size-4" />{C.pagamento.pixValidade} · {String(Math.floor(p.validade_pix_segundos / 60)).padStart(2, "0")}:00</p>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{C.pagamento.pixAviso}</p>
            <div className="mt-4 border border-border p-3 text-sm text-muted-foreground">{C.pagamento.pixCopia}</div>
          </div> : <div className="mt-6 border-y border-border py-6"><LockKeyhole aria-hidden="true" className="mb-4 size-7 text-muted-foreground" /><p className="text-sm">{C.pagamento.cartaoAviso}</p>{recorrencia && <p className="mt-3 text-sm text-muted-foreground">{C.pagamento.primeiraRecorrencia}</p>}</div>}
          <p role="status" className="mt-5 text-sm font-semibold">{C.pagamento.reservado}</p>
          <Button disabled className={`${controle} mt-4 w-full`} aria-describedby="pagamento-reservado">{C.pagamento.pagar}</Button>
          <span id="pagamento-reservado" className="sr-only">{C.pagamento.reservado}</span>
          <Button className={`${controle} mt-3 w-full`} onClick={onConfirmar}>{C.pagamento.continuar}</Button>
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