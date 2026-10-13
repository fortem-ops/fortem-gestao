import { useEffect, useRef, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { TEXTOS_CHECKOUT as C } from "@/config/planosPublicoTextos";
import { isValidCpfDigits } from "@/lib/cpfValidation";
import { fetchCep, formatCep } from "@/lib/viacep";
import {
  checkout, dividirCentavos, ErroCheckout, lerCodigo, limparSessao, mascararCpf, rolouAteOFim, type SessaoCheckout,
} from "@/lib/checkoutSite2027";

type Revisao = {
  etapa: string; familia: string; plano_codigo: string; forma_plano: string; parcelas_plano: number;
  plano_centavos: number; servicos: { codigo: string; nome: string; valor_centavos: number }[]; servicos_centavos: number;
  forma_servicos: string | null; parcelas_servicos: number | null; corrida_periodo_meses: number | null;
  corrida_total_centavos: number | null; total_centavos: number;
};
type Contrato = { template_id: string; template_versao: number; conteudo_html: string; hash: string };
type Etapa = "carregando" | "revisao" | "dados" | "contrato" | "aceito";

const brl = (c: number) => (c / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const NOME: Record<string, string> = { start_2027: "Start", power_2027: "Power", pro_2027: "Pro" };
const FREQ: Record<string, string> = { "1x": "1x por semana", "2x": "2x por semana", "3x": "3x por semana", livre: "Livre" };
const UFS = "AC AL AP AM BA CE DF ES GO MA MT MS MG PA PB PR PE PI RJ RN RS RO RR SC SP SE TO".split(" ");

function descreverPagamento(r: Revisao) {
  if (r.forma_plano === "recorrencia") {
    const p = dividirCentavos(r.plano_centavos, r.parcelas_plano);
    return `Recorrência mensal no cartão: ${brl(p[0])} por mês${r.parcelas_plano > 1 ? `, ${r.parcelas_plano} cobranças` : ""}`;
  }
  if (r.forma_plano === "pix_vista") return `Pix à vista: ${brl(r.plano_centavos)}`;
  const comServicos = r.servicos_centavos > 0 && !r.forma_servicos;
  const p = dividirCentavos(r.plano_centavos + (comServicos ? r.servicos_centavos : 0), r.parcelas_plano);
  const iguais = p.every((v) => v === p[0]);
  return `Cartão de crédito em ${r.parcelas_plano}x de ${brl(p[0])}${iguais ? "" : ` (última ${brl(p[p.length - 1])})`}${comServicos ? ", com as consultas" : ""}`;
}

export function CheckoutSite2027({ sessao, etapaInicial, nome, email, onAlterar, onSessaoInvalida }: {
  sessao: SessaoCheckout; etapaInicial?: string; nome: string; email: string;
  onAlterar: () => void; onSessaoInvalida: () => void;
}) {
  const [etapa, setEtapa] = useState<Etapa>("carregando");
  const [revisao, setRevisao] = useState<Revisao | null>(null);
  const [erro, setErro] = useState("");
  const [ocupado, setOcupado] = useState(false);
  // Dados do contratante só em memória (nunca no navegador).
  const [d, setD] = useState({ cpf: "", data_nascimento: "", cep: "", logradouro: "", numero: "", complemento: "", bairro: "", cidade: "", uf: "RS" });
  const [cpfErro, setCpfErro] = useState("");
  const [buscandoCep, setBuscandoCep] = useState(false);
  const [contrato, setContrato] = useState<Contrato | null>(null);
  const [lido, setLido] = useState(false);
  const [marcado, setMarcado] = useState(false);
  const caixa = useRef<HTMLDivElement>(null);
  const titulo = useRef<HTMLHeadingElement>(null);

  function falhou(e: unknown) {
    const msg = e instanceof ErroCheckout ? e.message : C.erroGenerico;
    if (msg.startsWith("Sessão inválida")) { limparSessao(); onSessaoInvalida(); return; }
    setErro(msg);
  }

  async function carregarRevisao() {
    setErro(""); setOcupado(true);
    try {
      const r = await checkout<Revisao>("revisar", sessao);
      setRevisao(r);
      setEtapa(r.etapa === "contrato_aceito" && etapaInicial === "contrato_aceito" ? "aceito" : "revisao");
    } catch (e) { falhou(e); setEtapa("revisao"); }
    setOcupado(false);
  }
  useEffect(() => { carregarRevisao(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);
  useEffect(() => { titulo.current?.focus(); window.scrollTo({ top: 0 }); }, [etapa]);

  // Contrato curto que já cabe na caixa conta como lido.
  useEffect(() => { if (etapa === "contrato" && caixa.current && rolouAteOFim(caixa.current)) setLido(true); }, [etapa, contrato]);

  async function buscarCep(v: string) {
    const cep = formatCep(v);
    setD((x) => ({ ...x, cep }));
    if (cep.replace(/\D/g, "").length !== 8) return;
    setBuscandoCep(true);
    const r = await fetchCep(cep);
    setBuscandoCep(false);
    if (r) setD((x) => ({ ...x, logradouro: r.logradouro || x.logradouro, bairro: r.bairro || x.bairro, cidade: r.localidade || x.cidade, uf: r.uf || x.uf }));
  }

  const contratante = () => ({ ...d, cpf: d.cpf.replace(/\D/g, "") });

  async function gerar(e: FormEvent) {
    e.preventDefault(); setErro("");
    if (!isValidCpfDigits(d.cpf.replace(/\D/g, ""))) { setCpfErro(C.cpfInvalido); return; }
    setCpfErro(""); setOcupado(true);
    try {
      const c = await checkout<Contrato>("gerar_contrato", { ...sessao, contratante: contratante() });
      setContrato(c); setLido(false); setMarcado(false); setEtapa("contrato");
    } catch (e) { falhou(e); }
    setOcupado(false);
  }

  async function aceitar() {
    if (!contrato || !lido || !marcado) return;
    setErro(""); setOcupado(true);
    try {
      await checkout("aceitar", { ...sessao, contratante: contratante(), hash_exibido: contrato.hash, li_e_aceito: true });
      setD((x) => ({ ...x, cpf: "" }));
      setEtapa("aceito");
    } catch (e) {
      falhou(e);
      if (e instanceof ErroCheckout && e.message === C.hashMudou) {
        try { const c = await checkout<Contrato>("gerar_contrato", { ...sessao, contratante: contratante() }); setContrato(c); setLido(false); setMarcado(false); caixa.current?.scrollTo({ top: 0 }); } catch (e2) { falhou(e2); }
      }
    }
    setOcupado(false);
  }

  const Erro = () => erro ? <p role="alert" className="mt-4 border-l-2 border-primary pl-3 text-sm">{erro}</p> : null;
  const H = ({ children, sub }: { children: string; sub?: string }) => <div className="mb-6"><h1 ref={titulo} tabIndex={-1} className="font-display text-2xl sm:text-3xl font-extrabold uppercase leading-tight outline-none">{children}</h1>{sub && <p className="mt-2 text-muted-foreground">{sub}</p>}</div>;
  const campo = (k: keyof typeof d, rotulo: string, extra: Record<string, unknown> = {}) => (
    <label className="block text-sm">{rotulo}
      <input className="campo mt-2" value={d[k]} onChange={(e) => setD((x) => ({ ...x, [k]: e.target.value }))} {...extra} />
    </label>
  );

  if (etapa === "carregando") return <p className="py-10 text-muted-foreground" role="status">{C.carregando}</p>;

  if (etapa === "aceito") return <section className="max-w-2xl py-6"><H sub={C.aceito.texto}>{C.aceito.titulo}</H>
    {revisao && <p className="font-bold">{NOME[revisao.familia]} · {FREQ[lerCodigo(revisao.plano_codigo).frequencia]} · {C.revisao.total} {brl(revisao.total_centavos)}</p>}</section>;

  if (etapa === "revisao") {
    const r = revisao;
    const { frequencia, periodo } = lerCodigo(r?.plano_codigo ?? "");
    const linhas: [string, string][] = r ? [
      [C.revisao.plano, NOME[r.familia] ?? r.familia],
      [C.revisao.frequencia, FREQ[frequencia] ?? frequencia],
      [C.revisao.periodo, periodo === "anual" ? "12 meses" : "Mensal, sem fidelidade"],
      [C.revisao.pagamento, descreverPagamento(r)],
      [C.revisao.acompanhamento, r.servicos.length ? r.servicos.map((s) => `${s.nome.replace(/\s*\(2027\)\s*$/, "")} (${brl(s.valor_centavos)})`).join(", ") +
        (r.forma_servicos ? ` · ${r.forma_servicos === "pix_vista" ? "Pix à vista" : `cartão em ${r.parcelas_servicos}x`}` : "") : C.revisao.nenhum],
      [C.revisao.corrida, r.corrida_total_centavos ? `${r.corrida_periodo_meses === 1 ? "Mensal" : `${r.corrida_periodo_meses} meses`}: ${brl(r.corrida_total_centavos)}, ${C.revisao.corridaParte}` : C.revisao.nenhum],
    ] : [];
    return <section className="max-w-2xl"><p className="text-xs text-primary font-semibold uppercase mb-3">Passo 6 de 9</p><H sub={C.revisao.subtitulo}>{C.revisao.titulo}</H>
      {r && <dl className="border-t border-border">{linhas.map(([k, v]) => <div key={k} className="grid grid-cols-[120px_minmax(0,1fr)] gap-4 border-b border-border py-4 text-sm"><dt className="text-muted-foreground uppercase text-xs font-semibold pt-0.5">{k}</dt><dd>{v}</dd></div>)}
        <div className="flex justify-between gap-4 py-5 text-lg font-bold"><dt className="uppercase font-display">{C.revisao.total}</dt><dd>{brl(r.total_centavos)}</dd></div></dl>}
      <Erro />
      <p className="mt-2 text-sm text-muted-foreground">{C.revisao.avisoAceite}</p>
      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        <Button variant="outline" className="h-auto py-4 rounded-none font-bold uppercase" onClick={onAlterar} disabled={ocupado}>{C.revisao.alterar}</Button>
        {r ? <Button className="h-auto py-4 rounded-none font-bold uppercase" onClick={() => { setErro(""); setEtapa("dados"); }} disabled={ocupado}>{C.revisao.continuar}</Button>
          : <Button className="h-auto py-4 rounded-none font-bold uppercase" onClick={carregarRevisao} disabled={ocupado}>Tentar de novo</Button>}
      </div></section>;
  }

  if (etapa === "dados") return <section className="max-w-2xl"><p className="text-xs text-primary font-semibold uppercase mb-3">Passo 7 de 9</p><H sub={C.contrato.subtitulo}>{C.contrato.titulo}</H>
    <form onSubmit={gerar} className="grid gap-4" noValidate>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-sm">{C.contrato.nome}<input className="campo mt-2" value={nome} readOnly aria-readonly="true" /></label>
        <label className="block text-sm">{C.contrato.email}<input className="campo mt-2" value={email} readOnly aria-readonly="true" /></label>
        <label className="block text-sm">{C.contrato.cpf}
          <input className="campo mt-2" inputMode="numeric" autoComplete="off" required value={d.cpf} aria-invalid={!!cpfErro} aria-describedby={cpfErro ? "cpf-erro" : undefined}
            onChange={(e) => { setCpfErro(""); setD((x) => ({ ...x, cpf: mascararCpf(e.target.value) })); }} placeholder="000.000.000-00" />
          {cpfErro && <span id="cpf-erro" role="alert" className="mt-1 block text-xs text-primary">{cpfErro}</span>}
        </label>
        {campo("data_nascimento", C.contrato.nascimento, { type: "date", required: true, autoComplete: "bday" })}
        <label className="block text-sm">{C.contrato.cep}
          <input className="campo mt-2" inputMode="numeric" autoComplete="postal-code" required value={d.cep} onChange={(e) => buscarCep(e.target.value)} placeholder="00000-000" />
          {buscandoCep && <span role="status" className="mt-1 block text-xs text-muted-foreground">{C.contrato.buscandoCep}</span>}
        </label>
      </div>
      {campo("logradouro", C.contrato.logradouro, { required: true, autoComplete: "address-line1", maxLength: 120 })}
      <div className="grid gap-4 grid-cols-2">
        {campo("numero", C.contrato.numero, { required: true, maxLength: 20 })}
        {campo("complemento", C.contrato.complemento, { maxLength: 80, autoComplete: "address-line2" })}
      </div>
      {campo("bairro", C.contrato.bairro, { required: true, maxLength: 120 })}
      <div className="grid gap-4 grid-cols-[minmax(0,1fr)_96px]">
        {campo("cidade", C.contrato.cidade, { required: true, maxLength: 80, autoComplete: "address-level2" })}
        <label className="block text-sm">{C.contrato.uf}
          <select className="campo mt-2" value={d.uf} onChange={(e) => setD((x) => ({ ...x, uf: e.target.value }))}>{UFS.map((u) => <option key={u}>{u}</option>)}</select>
        </label>
      </div>
      <Erro />
      <div className="mt-2 grid gap-3 sm:grid-cols-2">
        <Button type="button" variant="outline" className="h-auto py-4 rounded-none font-bold uppercase" onClick={() => setEtapa("revisao")} disabled={ocupado}>Voltar</Button>
        <Button type="submit" className="h-auto py-4 rounded-none font-bold uppercase" disabled={ocupado}>{ocupado ? C.carregando : C.contrato.gerar}</Button>
      </div>
    </form></section>;

  // etapa === "contrato"
  return <section className="max-w-3xl"><p className="text-xs text-primary font-semibold uppercase mb-3">Passo 7 de 9</p><H>{C.contrato.titulo}</H>
    <div ref={caixa} tabIndex={0} role="document" aria-label="Texto integral do contrato"
      onScroll={(e) => { if (rolouAteOFim(e.currentTarget)) setLido(true); }}
      className="h-[60vh] overflow-y-auto border border-border bg-card p-4 sm:p-6 text-sm leading-relaxed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring [&_h1]:font-display [&_h1]:text-lg [&_h1]:font-bold [&_h1]:uppercase [&_h1]:mb-3 [&_h2]:font-bold [&_h2]:uppercase [&_h2]:mt-5 [&_h2]:mb-2 [&_p]:mb-3 [&_ul]:list-disc [&_ul]:pl-5"
      dangerouslySetInnerHTML={{ __html: contrato?.conteudo_html ?? "" }} />
    <p className="mt-3 text-sm text-muted-foreground" aria-live="polite">{lido ? C.contrato.lido : C.contrato.leia}</p>
    <label className="mt-4 flex items-start gap-3 text-sm">
      <input type="checkbox" className="mt-1 size-4 accent-[hsl(var(--primary))]" checked={marcado} disabled={!lido} onChange={(e) => setMarcado(e.target.checked)} />
      <span>{C.contrato.liEAceito}</span>
    </label>
    <Erro />
    <div className="mt-6 grid gap-3 sm:grid-cols-2">
      <Button variant="outline" className="h-auto py-4 rounded-none font-bold uppercase" onClick={() => setEtapa("dados")} disabled={ocupado}>{C.contrato.editarDados}</Button>
      <Button className="h-auto py-4 rounded-none font-bold uppercase" onClick={aceitar} disabled={!lido || !marcado || ocupado}>{ocupado ? C.carregando : C.contrato.aceitar}</Button>
    </div>
  </section>;
}
