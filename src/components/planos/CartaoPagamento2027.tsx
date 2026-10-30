import { useEffect, useRef, useState, type FormEvent } from "react";
import { AlertCircle, Loader2, LockKeyhole } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { TEXTOS_CHECKOUT as C } from "@/config/planosPublicoTextos";
import { rastrearCompraPlano } from "@/site/rastreamento";
import { checkout, type SessaoCheckout } from "@/lib/checkoutSite2027";
import {
  INTERVALO_CARTAO_MS, faseCartao, faseTravada, mascararNumeroCartao, mascararValidade, validarCartao,
  type FaseCartao, type TentativaCartaoTela,
} from "@/lib/cartaoPlanos2027";

type Tentativa = NonNullable<TentativaCartaoTela> & { id: string; simulado: boolean; valor_centavos: number; total_proposta_centavos: number; parcelas: number };
type Resposta = { tentativa: Tentativa | null; cartao_esgotado?: boolean };
const controle = "h-auto min-h-12 rounded-none py-4 font-bold uppercase whitespace-normal";
const brl = (c: number) => (c / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const vazio = { numero: "", nome: "", validade: "", cvv: "" };

/** Cartão no /planos: real (Rede, pelo servidor) ou simulação da prévia admin (nada é enviado). */
export function CartaoPagamento2027({ sessao, simulacao, parcelas, parcelasEscolhida, onEscolherParcelas, onAprovado, onTravado, chamar = checkout, testeReal, valorCheio }: {
  sessao: SessaoCheckout; simulacao: boolean; parcelas: number[]; parcelasEscolhida?: number; onEscolherParcelas?: (n: number) => void;
  /** Teste real armado (só proposta de teste admin): valor em centavos que o servidor vai cobrar, sempre 1x. */
  testeReal?: number | null; valorCheio?: number;
  onAprovado: (simulado: boolean) => void; onTravado: (travado: boolean) => void;
  chamar?: typeof checkout;
}) {
  const [t, setT] = useState<Tentativa | null>(null);
  const [esgotado, setEsgotado] = useState(false);
  const [novo, setNovo] = useState(false);
  const [campos, setCampos] = useState(vazio);
  const [erro, setErro] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const aviso = useRef<HTMLDivElement>(null);
  const aplicar = (r: Resposta) => { setT(r.tentativa); setEsgotado(r.cartao_esgotado === true); setNovo(false); };
  const faseServidor = faseCartao(t, esgotado);
  const fase: FaseCartao = novo && (faseServidor === "recusado" || faseServidor === "expirado") ? "formulario" : faseServidor;
  const travado = faseTravada(fase);
  const testeAtivo = !simulacao && typeof testeReal === "number" && testeReal > 0;

  useEffect(() => { chamar<Resposta>("status_cartao", sessao).then(aplicar).catch(() => {}); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);
  useEffect(() => { onTravado(travado); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [travado]);
  useEffect(() => { if (fase === "aprovado" && t) { if (!t.simulado && t.valor_centavos === t.total_proposta_centavos) rastrearCompraPlano(t.id, t.valor_centavos); onAprovado(t.simulado); } /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [fase]);
  useEffect(() => { if (fase !== "formulario") aviso.current?.focus(); }, [fase]);
  useEffect(() => {
    if (!travado) return;
    const id = setInterval(() => { chamar<Resposta>("status_cartao", sessao).then(aplicar).catch(() => {}); }, INTERVALO_CARTAO_MS);
    return () => clearInterval(id);
  }, [travado, sessao, chamar]);

  async function enviar(e: FormEvent, simular?: "aprovado" | "recusado") {
    e.preventDefault();
    setErro("");
    const v = validarCartao(campos);
    if (v.ok === false) { setErro(v.erro); return; }
    // Apaga os dados da tela antes de qualquer espera: não ficam em estado depois do envio.
    setCampos(vazio);
    setOcupado(true);
    try {
      // Teste real: o servidor cobra sempre 1x; não enviamos a escolha de parcelas.
      const parcelasEnvio = testeAtivo ? null : onEscolherParcelas ? parcelasEscolhida ?? parcelas.length : null;
      const corpo = { ...sessao, ...(parcelasEnvio ? { parcelas: parcelasEnvio } : {}), ...(simulacao ? { simular: simular ?? "aprovado" } : { cartao: v.cartao }) };
      aplicar(await chamar<Resposta>(simulacao ? "pagar_cartao" : "tokenizar_cartao", corpo));
    } catch (err) {
      setErro(err instanceof Error ? err.message : C.erroGenerico);
      chamar<Resposta>("status_cartao", sessao).then(aplicar).catch(() => {});
    } finally { setOcupado(false); }
  }

  const n = parcelas.length;
  const resumoParcelas = `${n}x de ${brl(parcelas[0] ?? 0)}${parcelas.some((x) => x !== parcelas[0]) ? ` (última ${brl(parcelas[n - 1])})` : ""}`;
  const teste = t && !t.simulado && t.valor_centavos !== t.total_proposta_centavos;

  return <div className="mt-6 border-y border-border py-6">
    {simulacao && <p role="note" className="mb-4 border border-primary/60 p-3 text-sm font-semibold">{C.pagamento.simulacao}</p>}
    {teste && <p className="mb-4 text-sm font-semibold">{C.pagamento.valorTeste(brl(t!.valor_centavos))}</p>}
    {fase === "formulario" ? <form noValidate autoComplete="off" onSubmit={(e) => enviar(e)} className="grid gap-4">
      <label className="block text-sm">{C.cartao.numero}
        <Input className="mt-2 rounded-none" inputMode="numeric" autoComplete="off" name="fortem-cc-n" spellCheck={false} value={campos.numero} maxLength={23}
          onChange={(e) => setCampos((c) => ({ ...c, numero: mascararNumeroCartao(e.target.value) }))} /></label>
      <label className="block text-sm">{C.cartao.nome}
        <Input className="mt-2 rounded-none uppercase" autoComplete="off" name="fortem-cc-t" spellCheck={false} value={campos.nome} maxLength={26}
          onChange={(e) => setCampos((c) => ({ ...c, nome: e.target.value }))} /></label>
      <div className="grid grid-cols-2 gap-4">
        <label className="block text-sm">{C.cartao.validade}
          <Input className="mt-2 rounded-none" inputMode="numeric" autoComplete="off" name="fortem-cc-v" value={campos.validade} maxLength={5}
            onChange={(e) => setCampos((c) => ({ ...c, validade: mascararValidade(e.target.value) }))} /></label>
        <label className="block text-sm">{C.cartao.cvv}
          <Input className="mt-2 rounded-none" type="password" inputMode="numeric" autoComplete="off" name="fortem-cc-c" value={campos.cvv} maxLength={4}
            onChange={(e) => setCampos((c) => ({ ...c, cvv: e.target.value.replace(/\D/g, "").slice(0, 4) }))} /></label>
      </div>
      {testeAtivo ? <p role="note" className="border-2 border-primary p-3 text-sm font-bold">{C.pagamento.testeRealAviso(brl(testeReal!), brl(valorCheio ?? 0))}</p>
      : <label className="block text-sm">{C.cartao.parcelas}
        {onEscolherParcelas ? <>
          <select className="campo mt-2" value={parcelasEscolhida ?? n} onChange={(e) => onEscolherParcelas(Number(e.target.value))} aria-describedby="cartao-parcelas-aviso">
            {Array.from({ length: 12 }, (_, i) => i + 1).map((k) => <option key={k} value={k}>{k}x</option>)}
          </select>
          <span className="mt-2 block font-bold">{resumoParcelas}</span>
        </> : <>
          <select className="campo mt-2" value={n} onChange={() => {}} aria-describedby="cartao-parcelas-aviso">
            <option value={n}>{resumoParcelas}</option>
          </select>
        </>}</label>}
      {!testeAtivo && <p id="cartao-parcelas-aviso" className="text-xs text-muted-foreground">{C.pagamento.escolhaAviso}</p>}
      <p className="flex gap-2 text-xs text-muted-foreground"><LockKeyhole aria-hidden="true" className="size-4 shrink-0" />{simulacao ? C.cartao.simulacaoAviso : C.cartao.seguro}</p>
      {simulacao ? <div className="grid gap-3 sm:grid-cols-2">
        <Button type="submit" className={controle} disabled={ocupado}>{C.pagamento.simularAprovar}</Button>
        <Button type="button" variant="outline" className={controle} disabled={ocupado} onClick={(e) => enviar(e, "recusado")}>{C.pagamento.simularRecusar}</Button>
      </div> : <Button type="submit" className={`${controle} w-full`} disabled={ocupado}>{ocupado ? C.cartao.validando : testeAtivo ? C.pagamento.testeRealBotao(brl(testeReal!)) : `${C.cartao.pagar} · ${resumoParcelas}`}</Button>}
    </form> : <div ref={aviso} tabIndex={-1} className="outline-none">
      {travado && <div role="status" aria-live="polite" className="flex items-start gap-3">
        <Loader2 aria-hidden="true" className="size-6 shrink-0 animate-spin text-primary" />
        <div><p className="font-semibold">{fase === "validando" ? C.cartao.validando : fase === "cobrando" ? C.cartao.processando : C.cartao.confirmando}</p>
          <p className="mt-1 text-sm text-muted-foreground">{fase === "confirmando" ? C.cartao.confirmandoTexto : C.cartao.aguarde}</p></div>
      </div>}
      {(fase === "recusado" || fase === "expirado") && <div role="alert">
        <p className="flex items-center gap-2 font-semibold"><AlertCircle aria-hidden="true" className="size-5 text-destructive" />{fase === "recusado" ? C.cartao.recusado : C.cartao.expirado}</p>
        <p className="mt-2 text-sm text-muted-foreground">{fase === "recusado" ? C.cartao.recusadoTexto : C.cartao.expiradoTexto}</p>
        <Button className={`${controle} mt-5 w-full`} onClick={() => { setErro(""); setNovo(true); }}>{C.cartao.outro}</Button>
      </div>}
      {fase === "esgotado" && <div role="alert">
        <p className="font-semibold">{C.cartao.esgotado}</p>
        <p className="mt-2 text-sm text-muted-foreground">{C.cartao.esgotadoTexto}</p>
      </div>}
      {fase === "aprovado" && <p role="status" className="font-semibold">{t?.simulado ? C.pagamento.aprovadoSimulado : C.pagamento.aprovado}</p>}
    </div>}
    {erro && <p role="alert" className="mt-4 text-sm font-semibold text-destructive">{erro}</p>}
  </div>;
}
