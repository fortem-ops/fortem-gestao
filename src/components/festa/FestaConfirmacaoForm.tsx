import { useEffect, useMemo, useRef, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Check, Copy, Loader2, Plus, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { festa10AnosConfig, type OpcaoConsumo, type OpcaoIntolerancia, type Vinculo } from "@/config/festa10anos";
import { brlCentavos, calcularTotalFesta, confirmacoesAbertas, maskWhatsApp, whatsappValido } from "@/lib/festa10anos";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Pessoa = { nome: string; consumo: OpcaoConsumo[]; intolerancias: OpcaoIntolerancia[] };
type Resultado = {
  status: "aguardando_pagamento" | "confirmado" | "isento" | "cancelado";
  pessoas: number;
  total_centavos: number;
  acesso?: string;
  pix?: { copia_e_cola: string; expira_em?: string | null } | null;
  existente?: boolean;
};

const cfg = festa10AnosConfig;
const vazio = (): Pessoa => ({ nome: "", consumo: [], intolerancias: [] });

function toggle<T>(lista: T[], v: T) {
  return lista.includes(v) ? lista.filter((x) => x !== v) : [...lista, v];
}

function Opcoes<T extends string>({ legenda, opcoes, valores, onChange, idBase }: {
  legenda: string; opcoes: readonly { valor: T; rotulo: string }[]; valores: T[]; onChange: (v: T[]) => void; idBase: string;
}) {
  return (
    <fieldset>
      <legend className="text-sm font-medium">{legenda}</legend>
      <div className="mt-2 flex flex-wrap gap-2">
        {opcoes.map((o) => {
          const ativo = valores.includes(o.valor);
          return (
            <label key={o.valor} htmlFor={`${idBase}-${o.valor}`}
              className={`flex min-h-11 cursor-pointer items-center gap-2 border px-4 text-sm transition-colors focus-within:ring-2 focus-within:ring-ring ${ativo ? "festa-marca-border border-2 bg-accent" : "border-border"}`}>
              <input id={`${idBase}-${o.valor}`} type="checkbox" className="sr-only" checked={ativo} onChange={() => onChange(toggle(valores, o.valor))} />
              <span aria-hidden className={`flex h-4 w-4 items-center justify-center border ${ativo ? "festa-marca-bg border-transparent" : "border-muted-foreground"}`}>{ativo && <Check className="h-3 w-3" />}</span>
              {o.rotulo}
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

async function chamar(body: Record<string, unknown>) {
  const { data, error } = await supabase.functions.invoke("festa-confirmar", { body });
  if (error) {
    let msg = "Não foi possível concluir agora. Tente novamente em alguns instantes.";
    try { const j = await (error as any).context?.json?.(); if (j?.erro) msg = j.erro; } catch { /* sem corpo */ }
    throw new Error(msg);
  }
  return data;
}

function PixPagamento({ r, onAtualizar }: { r: Resultado; onAtualizar: (r: Resultado) => void }) {
  const [copiado, setCopiado] = useState(false);
  const [gerando, setGerando] = useState(false);
  const [erro, setErro] = useState("");

  useEffect(() => {
    if (r.status !== "aguardando_pagamento" || !r.acesso) return;
    const t = setInterval(async () => {
      try { const d = await chamar({ acao: "status", acesso: r.acesso }); if (d?.status && d.status !== r.status) onAtualizar({ ...r, ...d }); } catch { /* tenta de novo */ }
    }, 6000);
    return () => clearInterval(t);
  }, [r, onAtualizar]);

  const novoQr = async () => {
    setGerando(true); setErro("");
    try { const d = await chamar({ acao: "novo_pix", acesso: r.acesso }); onAtualizar({ ...r, ...d }); }
    catch (e) { setErro((e as Error).message); }
    setGerando(false);
  };

  if (!r.pix?.copia_e_cola) {
    return (
      <div className="border border-border p-6" role="status">
        <p className="font-semibold">Sua confirmação foi registrada e aguarda pagamento.</p>
        <p className="mt-2 text-sm text-muted-foreground">O código PIX ainda não está disponível. Nossa equipe enviará o pagamento pelo seu WhatsApp.</p>
        <p className="mt-4 text-sm">Total: <strong>{brlCentavos(r.total_centavos)}</strong></p>
        {r.acesso && <Button variant="outline" className="mt-5 min-h-11" disabled={gerando} onClick={novoQr}>{gerando && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Tentar gerar o código PIX</Button>}
        {erro && <p className="mt-3 text-sm text-destructive" role="alert">{erro}</p>}
      </div>
    );
  }
  return (
    <div className="border border-border p-6">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] festa-marca">Pagamento por PIX</p>
      <p className="mt-3 text-2xl font-bold">{brlCentavos(r.total_centavos)}</p>
      <div className="mt-5 w-fit bg-foreground p-3"><QRCodeSVG value={r.pix.copia_e_cola} size={200} aria-label="QR Code PIX" /></div>
      <p className="mt-5 max-w-md text-sm leading-relaxed text-muted-foreground">{cfg.confirmacao.pixInstrucao}</p>
      <Button className="mt-5 min-h-11" onClick={async () => { await navigator.clipboard.writeText(r.pix!.copia_e_cola); setCopiado(true); setTimeout(() => setCopiado(false), 2500); }}>
        {copiado ? <Check className="mr-2 h-4 w-4" /> : <Copy className="mr-2 h-4 w-4" />}{copiado ? "Código copiado" : "Copiar código PIX"}
      </Button>
      <p className="mt-4 flex items-center gap-2 text-sm text-muted-foreground" role="status"><Loader2 className="h-4 w-4 animate-spin" />Aguardando a identificação do pagamento.</p>
      <button type="button" onClick={novoQr} disabled={gerando} className="mt-3 min-h-11 text-sm underline underline-offset-4">O código venceu? Gerar novo QR Code</button>
      {erro && <p className="mt-2 text-sm text-destructive" role="alert">{erro}</p>}
    </div>
  );
}

export default function FestaConfirmacaoForm({ onConfirmado }: { onConfirmado?: () => void }) {
  const [titular, setTitular] = useState<Pessoa>(vazio());
  const [whatsapp, setWhatsapp] = useState("");
  const [email, setEmail] = useState("");
  const [vinculo, setVinculo] = useState<Vinculo | "">("");
  const [acomp, setAcomp] = useState<Pessoa[]>([]);
  const [voucher, setVoucher] = useState("");
  const [voucherOk, setVoucherOk] = useState<string | null>(null);
  const [voucherMsg, setVoucherMsg] = useState("");
  const [aplicando, setAplicando] = useState(false);
  const [website, setWebsite] = useState("");
  const [erros, setErros] = useState<Record<string, string>>({});
  const [enviando, setEnviando] = useState(false);
  const [resultado, setResultado] = useState<Resultado | null>(null);
  const topo = useRef<HTMLDivElement>(null);
  const aberto = confirmacoesAbertas();
  const total = useMemo(() => calcularTotalFesta(acomp.length, !!voucherOk), [acomp.length, voucherOk]);

  useEffect(() => {
    if (resultado && resultado.status !== "aguardando_pagamento") onConfirmado?.();
  }, [resultado, onConfirmado]);

  if (!aberto) return <div className="border-l-2 festa-marca-border py-4 pl-6" role="status"><p className="text-xl font-semibold">{cfg.confirmacao.encerrado}</p></div>;

  if (resultado) {
    const confirmado = resultado.status === "confirmado" || resultado.status === "isento";
    return (
      <div ref={topo} className="space-y-5" aria-live="polite">
        {resultado.existente && <p className="text-sm text-muted-foreground">Já existe uma confirmação para este WhatsApp.</p>}
        {confirmado ? (
          <div className="border-l-2 festa-marca-border py-4 pl-6" role="status">
            <p className="text-3xl font-bold">Presença confirmada</p>
            <p className="mt-3 text-muted-foreground">{resultado.pessoas} {resultado.pessoas === 1 ? "pessoa" : "pessoas"} · {resultado.status === "isento" ? "isento" : brlCentavos(resultado.total_centavos)}</p>
            <p className="mt-2 text-muted-foreground">Nos vemos em 14 de novembro.</p>
          </div>
        ) : resultado.status === "cancelado" ? (
          <p className="text-muted-foreground">Esta confirmação foi cancelada. Para reativar, fale com a equipe.</p>
        ) : (
          <PixPagamento r={resultado} onAtualizar={setResultado} />
        )}
      </div>
    );
  }

  const aplicarVoucher = async () => {
    setVoucherMsg(""); setAplicando(true);
    try {
      const d = await chamar({ acao: "voucher", codigo: voucher.trim() });
      if (d?.valido) { setVoucherOk(voucher.trim()); setVoucherMsg("Voucher aplicado. Valores isentos para todos os inscritos."); }
      else { setVoucherOk(null); setVoucherMsg("Voucher inválido."); }
    } catch (e) { setVoucherMsg((e as Error).message); }
    setAplicando(false);
  };

  const enviar = async (e: React.FormEvent) => {
    e.preventDefault();
    const err: Record<string, string> = {};
    if (titular.nome.trim().length < 3) err.nome = "Informe seu nome completo.";
    if (!whatsappValido(whatsapp)) err.whatsapp = "Informe um celular com DDD, por exemplo (51) 99999-9999.";
    if (email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) err.email = "Informe um e-mail válido.";
    if (!vinculo) err.vinculo = "Selecione seu vínculo com a FORTEM.";
    acomp.forEach((a, i) => { if (a.nome.trim().length < 2) err[`a${i}`] = "Informe o nome do acompanhante."; });
    setErros(err);
    if (Object.keys(err).length) return;
    if (website) return;
    setEnviando(true);
    try {
      const d = await chamar({
        acao: "confirmar",
        nome: titular.nome.trim(), whatsapp: whatsapp.replace(/\D/g, ""), email: email.trim(), vinculo,
        consumo: titular.consumo, intolerancias: titular.intolerancias,
        acompanhantes: acomp.map((a) => ({ nome: a.nome.trim(), consumo: a.consumo, intolerancias: a.intolerancias })),
        voucher: voucherOk ?? "",
      });
      setResultado(d);
      setTimeout(() => topo.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
    } catch (e2) { setErros({ geral: (e2 as Error).message }); }
    setEnviando(false);
  };

  const n = acomp.length;
  const lim = cfg.limiteAcompanhantes;

  return (
    <form onSubmit={enviar} noValidate className="space-y-7">
      <div>
        <label htmlFor="festa-nome" className="text-sm font-medium">Nome completo <span aria-hidden>*</span></label>
        <Input id="festa-nome" autoComplete="name" maxLength={120} value={titular.nome} onChange={(e) => setTitular({ ...titular, nome: e.target.value })} aria-invalid={!!erros.nome} className="mt-2 h-12" />
        {erros.nome && <p className="mt-1.5 text-sm text-destructive" role="alert">{erros.nome}</p>}
      </div>
      <div className="grid gap-7 sm:grid-cols-2">
        <div>
          <label htmlFor="festa-whatsapp" className="text-sm font-medium">WhatsApp <span aria-hidden>*</span></label>
          <Input id="festa-whatsapp" type="tel" inputMode="tel" autoComplete="tel" placeholder="(51) 99999-9999" maxLength={15} value={whatsapp} onChange={(e) => setWhatsapp(maskWhatsApp(e.target.value))} aria-invalid={!!erros.whatsapp} className="mt-2 h-12" />
          {erros.whatsapp && <p className="mt-1.5 text-sm text-destructive" role="alert">{erros.whatsapp}</p>}
        </div>
        <div>
          <label htmlFor="festa-email" className="text-sm font-medium">E-mail <span className="text-muted-foreground">(opcional)</span></label>
          <Input id="festa-email" type="email" autoComplete="email" maxLength={254} value={email} onChange={(e) => setEmail(e.target.value)} aria-invalid={!!erros.email} className="mt-2 h-12" />
          {erros.email && <p className="mt-1.5 text-sm text-destructive" role="alert">{erros.email}</p>}
        </div>
      </div>
      <fieldset>
        <legend className="text-sm font-medium">Vínculo com a FORTEM <span aria-hidden>*</span></legend>
        <div className="mt-2 grid gap-2 sm:grid-cols-3">
          {cfg.vinculos.map((v) => (
            <label key={v.valor} className={`flex min-h-11 cursor-pointer items-center gap-3 border px-4 text-sm focus-within:ring-2 focus-within:ring-ring ${vinculo === v.valor ? "festa-marca-border border-2 bg-accent" : "border-border"}`}>
              <input type="radio" name="vinculo" value={v.valor} checked={vinculo === v.valor} onChange={() => setVinculo(v.valor)} className="sr-only" />
              <span aria-hidden className={`h-3 w-3 border ${vinculo === v.valor ? "festa-marca-bg border-transparent" : "border-muted-foreground"}`} />{v.rotulo}
            </label>
          ))}
        </div>
        {erros.vinculo && <p className="mt-1.5 text-sm text-destructive" role="alert">{erros.vinculo}</p>}
      </fieldset>
      <Opcoes idBase="festa-consumo" legenda="O que você vai consumir" opcoes={cfg.consumos} valores={titular.consumo} onChange={(v) => setTitular({ ...titular, consumo: v })} />
      <Opcoes idBase="festa-intol" legenda="Intolerância alimentar, se houver" opcoes={cfg.intolerancias} valores={titular.intolerancias} onChange={(v) => setTitular({ ...titular, intolerancias: v })} />

      <div className="space-y-5 border-t border-border pt-7">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm font-medium">Acompanhantes</p>
          <p className="text-sm text-muted-foreground" aria-live="polite">{n} de {lim} acompanhantes</p>
        </div>
        {acomp.map((a, i) => (
          <div key={i} className="space-y-5 border border-border p-5">
            <div className="flex items-end gap-2">
              <div className="flex-1">
                <label htmlFor={`festa-a${i}`} className="text-sm font-medium">Nome do acompanhante {i + 1}</label>
                <Input id={`festa-a${i}`} maxLength={120} value={a.nome} onChange={(e) => setAcomp(acomp.map((x, j) => j === i ? { ...x, nome: e.target.value } : x))} aria-invalid={!!erros[`a${i}`]} className="mt-2 h-12" />
              </div>
              <Button type="button" variant="outline" size="icon" className="h-12 w-12" aria-label={`Remover acompanhante ${i + 1}`} onClick={() => setAcomp(acomp.filter((_, j) => j !== i))}><X className="h-4 w-4" /></Button>
            </div>
            {erros[`a${i}`] && <p className="text-sm text-destructive" role="alert">{erros[`a${i}`]}</p>}
            <Opcoes idBase={`festa-a${i}-c`} legenda="Consumo" opcoes={cfg.consumos} valores={a.consumo} onChange={(v) => setAcomp(acomp.map((x, j) => j === i ? { ...x, consumo: v } : x))} />
            <Opcoes idBase={`festa-a${i}-i`} legenda="Intolerância alimentar, se houver" opcoes={cfg.intolerancias} valores={a.intolerancias} onChange={(v) => setAcomp(acomp.map((x, j) => j === i ? { ...x, intolerancias: v } : x))} />
          </div>
        ))}
        {n < lim && <Button type="button" variant="outline" className="min-h-11" onClick={() => setAcomp([...acomp, vazio()])}><Plus className="mr-2 h-4 w-4" />Adicionar acompanhante</Button>}
      </div>

      <div className="border-t border-border pt-7">
        <label htmlFor="festa-voucher" className="text-sm font-medium">Voucher (cupom de desconto, se houver)</label>
        <div className="mt-2 flex gap-2">
          <Input id="festa-voucher" maxLength={40} autoComplete="off" value={voucher} onChange={(e) => { setVoucher(e.target.value); setVoucherOk(null); setVoucherMsg(""); }} className="h-12" />
          <Button type="button" variant="outline" className="h-12" disabled={!voucher.trim() || aplicando} onClick={aplicarVoucher}>{aplicando && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Aplicar</Button>
        </div>
        {voucherMsg && <p className={`mt-1.5 text-sm ${voucherOk ? "text-muted-foreground" : "text-destructive"}`} role="status">{voucherMsg}</p>}
      </div>

      <div className="border border-border bg-card p-5 text-sm" aria-live="polite">
        <div className="flex justify-between"><span>1 convidado</span><span>{voucherOk ? "R$ 0,00" : brlCentavos(cfg.valores.convidadoCentavos)}</span></div>
        {n > 0 && <div className="mt-2 flex justify-between"><span>{n} {n === 1 ? "acompanhante" : "acompanhantes"} · {brlCentavos(cfg.valores.acompanhanteCentavos)} cada</span><span>{voucherOk ? "R$ 0,00" : brlCentavos(n * cfg.valores.acompanhanteCentavos)}</span></div>}
        <div className="mt-4 flex justify-between border-t border-border pt-4 text-base font-bold"><span>Total</span><span>{brlCentavos(total)}</span></div>
      </div>

      <div className="absolute -left-[10000px] h-px w-px overflow-hidden" aria-hidden="true">
        <label htmlFor="festa-website">Website</label>
        <input id="festa-website" tabIndex={-1} autoComplete="off" value={website} onChange={(e) => setWebsite(e.target.value)} />
      </div>
      {erros.geral && <p className="text-sm text-destructive" role="alert">{erros.geral}</p>}
      <div className="space-y-3">
        <Button type="submit" size="lg" disabled={enviando} className="min-h-12 w-full px-8 font-bold uppercase tracking-[0.12em] sm:w-auto">
          {enviando && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{enviando ? "Enviando" : "Confirmar presença"}
        </Button>
        <p className="text-xs text-muted-foreground">{cfg.confirmacao.privacidade}</p>
      </div>
    </form>
  );
}
