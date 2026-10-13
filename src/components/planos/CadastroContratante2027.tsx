import { useState, type FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { TEXTOS_PLANOS as T, TEXTOS_CHECKOUT as C } from "@/config/planosPublicoTextos";
import { isValidCpfDigits } from "@/lib/cpfValidation";
import { fetchCep, formatCep } from "@/lib/viacep";
import { mascararCpf } from "@/lib/checkoutSite2027";

/** Cadastro único do contratante (identificação + dados do contrato). Fica só em memória. */
export type DadosContratante = {
  nome: string; email: string; whatsapp: string; cpf: string; rg: string; data_nascimento: string;
  cep: string; logradouro: string; numero: string; complemento: string; bairro: string; cidade: string; uf: string;
  aceite: boolean; verificacao_id?: string;
};
const UFS = "AC AL AP AM BA CE DF ES GO MA MT MS MG PA PB PR PE PI RJ RN RS RO RR SC SP SE TO".split(" ");
const VAZIO: DadosContratante = { nome: "", email: "", whatsapp: "", cpf: "", rg: "", data_nascimento: "", cep: "", logradouro: "", numero: "", complemento: "", bairro: "", cidade: "", uf: "RS", aceite: false };
type Cadastro = Partial<Record<"nome" | "email" | "whatsapp" | "data_nascimento" | "cep" | "logradouro" | "numero" | "complemento" | "bairro" | "cidade" | "uf" | "rg", string | null>>;

/** Junta os dados do cadastro aos digitados: campo vazio no cadastro não apaga o que a pessoa escreveu. */
export function preencherComCadastro(atual: DadosContratante, r: Cadastro): DadosContratante {
  const v = (x: string | null | undefined, a: string) => (typeof x === "string" && x.trim() ? x.trim() : a);
  const uf = r.uf?.toUpperCase();
  return {
    ...atual, nome: v(r.nome, atual.nome), email: v(r.email, atual.email), whatsapp: v(r.whatsapp, atual.whatsapp),
    data_nascimento: v(r.data_nascimento?.slice(0, 10), atual.data_nascimento), cep: r.cep ? formatCep(r.cep) : atual.cep,
    logradouro: v(r.logradouro, atual.logradouro), numero: v(r.numero, atual.numero), complemento: v(r.complemento, atual.complemento),
    bairro: v(r.bairro, atual.bairro), cidade: v(r.cidade, atual.cidade), uf: uf && UFS.includes(uf) ? uf : atual.uf, rg: v(r.rg, atual.rg),
  };
}

export function CadastroContratante2027({ previa, onSubmit, enviando, erro }: { previa: boolean; onSubmit: (d: DadosContratante) => void; enviando: boolean; erro?: string }) {
  const [d, setD] = useState<DadosContratante>(VAZIO);
  const [cpfBusca, setCpfBusca] = useState("");
  const [verificacao, setVerificacao] = useState<string | null>(null);
  const [aguardandoCodigo, setAguardandoCodigo] = useState<string | null>(null);
  const [codigo, setCodigo] = useState("");
  const [aviso, setAviso] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [buscandoCep, setBuscandoCep] = useState(false);
  const [cpfErro, setCpfErro] = useState("");
  const [website, setWebsite] = useState("");
  const [faltaErro, setFaltaErro] = useState("");
  const preenchido = !!verificacao;

  function aplicar(r: Cadastro, id: string) {
    setD((x) => preencherComCadastro({ ...x, cpf: cpfBusca }, r));
    setVerificacao(id); setAguardandoCodigo(null); setCodigo(""); setAviso(T.cadastro.preenchido);
  }

  async function buscar() {
    if (!isValidCpfDigits(cpfBusca)) { setAviso(T.identificacao.cpfInvalido); return; }
    setOcupado(true); setAviso("");
    const valor = cpfBusca.replace(/\D/g, "");
    try {
      if (previa) {
        const { data: s } = await supabase.auth.getSession();
        const headers = s.session?.access_token ? { Authorization: `Bearer ${s.session.access_token}` } : undefined;
        const { data } = await supabase.functions.invoke("planos-codigo", { body: { acao: "previa_admin", valor }, headers });
        if (data?.ok && data.verificacao_id) aplicar(data, data.verificacao_id);
        else { setD((x) => ({ ...x, cpf: cpfBusca })); setAviso(T.cadastro.naoEncontradoPrevia); }
        return;
      }
      const { data } = await supabase.functions.invoke("planos-codigo", { body: { acao: "enviar", tipo: "cpf", valor } });
      if (data?.motivo === "limitado") { setAviso(T.identificacao.limitado); return; }
      setD((x) => ({ ...x, cpf: cpfBusca }));
      if (data?.enviado && data.verificacao_id) setAguardandoCodigo(data.verificacao_id);
      else setAviso(T.cadastro.semCodigo);
    } catch { setAviso(T.cadastro.semCodigo); }
    finally { setOcupado(false); }
  }

  async function validar() {
    if (!aguardandoCodigo) return;
    setOcupado(true); setAviso("");
    try {
      const { data } = await supabase.functions.invoke("planos-codigo", { body: { acao: "validar", verificacao_id: aguardandoCodigo, codigo } });
      if (!data?.ok) {
        setAviso(data?.motivo === "errado" ? T.identificacao.codigoErrado(data.restantes ?? 0)
          : data?.motivo === "expirado" ? T.identificacao.codigoExpirado
          : data?.motivo === "limitado" ? T.identificacao.limitado : T.identificacao.codigoBloqueado);
        return;
      }
      const { data: dados } = await supabase.functions.invoke("planos-codigo", { body: { acao: "dados_verificados", verificacao_id: aguardandoCodigo } });
      if (dados?.ok) aplicar(dados, aguardandoCodigo); else setAviso(T.cadastro.semCodigo);
    } catch { setAviso(T.cadastro.semCodigo); }
    finally { setOcupado(false); }
  }

  async function buscarCep(v: string) {
    const cep = formatCep(v);
    setD((x) => ({ ...x, cep }));
    if (cep.replace(/\D/g, "").length !== 8) return;
    setBuscandoCep(true);
    const r = await fetchCep(cep);
    setBuscandoCep(false);
    if (r) setD((x) => ({ ...x, logradouro: r.logradouro || x.logradouro, bairro: r.bairro || x.bairro, cidade: r.localidade || x.cidade, uf: r.uf || x.uf }));
  }

  function enviar(e: FormEvent) {
    e.preventDefault();
    if (website) return;
    if (!isValidCpfDigits(d.cpf)) { setCpfErro(C.contrato.cpfInvalido); return; }
    setCpfErro("");
    const faltando = (["nome", "email", "whatsapp", "data_nascimento", "cep", "logradouro", "numero", "bairro", "cidade"] as const).some((k) => !d[k].trim());
    if (faltando) { setAviso(""); setFaltaErro(T.cadastro.faltando); return; }
    setFaltaErro("");
    onSubmit({ ...d, cpf: d.cpf.replace(/\D/g, ""), verificacao_id: verificacao ?? undefined });
  }

  const campo = (k: keyof DadosContratante, rotulo: string, extra: Record<string, unknown> = {}) => (
    <label className="block text-sm">{rotulo}
      <input className="campo mt-2" value={d[k] as string} onChange={(e) => setD((x) => ({ ...x, [k]: e.target.value }))} {...extra} />
    </label>
  );

  return <div className="space-y-6">
    <section aria-label={T.cadastro.banner} className="border-l-4 border-primary bg-card p-4 space-y-3">
      <p className="font-semibold">{T.cadastro.banner}</p>
      {!preenchido && <div className="flex flex-col sm:flex-row gap-3">
        <input aria-label="CPF para buscar seus dados" inputMode="numeric" autoComplete="off" placeholder="000.000.000-00" className="campo sm:max-w-[220px]"
          value={cpfBusca} disabled={!!aguardandoCodigo} onChange={(e) => { setCpfBusca(mascararCpf(e.target.value)); setAviso(""); }} />
        {!aguardandoCodigo && <Button type="button" variant="outline" className="rounded-none" disabled={ocupado || cpfBusca.replace(/\D/g, "").length !== 11} onClick={buscar}>{ocupado ? C.carregando : T.cadastro.buscar}</Button>}
      </div>}
      {aguardandoCodigo && !preenchido && <div className="space-y-3">
        <p className="text-sm">{T.cadastro.enviado}</p>
        <label className="block text-sm">{T.identificacao.codigoLabel}<input aria-label={T.identificacao.codigoLabel} inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={codigo} onChange={(e) => setCodigo(e.target.value.replace(/\D/g, ""))} className="campo mt-1 tracking-[0.4em] sm:max-w-[220px]" /></label>
        <div className="flex flex-wrap gap-3">
          <Button type="button" className="rounded-none" disabled={ocupado || codigo.length !== 6} onClick={validar}>{T.identificacao.validar}</Button>
          <Button type="button" variant="outline" className="rounded-none" disabled={ocupado} onClick={() => { setAguardandoCodigo(null); setCodigo(""); setAviso(T.cadastro.semCodigo); }}>{T.identificacao.nao}</Button>
        </div>
      </div>}
      {aviso && <p role="status" className="text-sm text-muted-foreground">{aviso}</p>}
    </section>

    <form onSubmit={enviar} className="grid gap-4" noValidate>
      <div className="grid gap-4 sm:grid-cols-2">
        {campo("nome", C.contrato.nome, { required: true, minLength: 3, autoComplete: "name", maxLength: 120 })}
        <label className="block text-sm">{C.contrato.cpf}
          <input className="campo mt-2" inputMode="numeric" autoComplete="off" required value={d.cpf} aria-invalid={!!cpfErro} aria-describedby={cpfErro ? "cad-cpf-erro" : undefined}
            onChange={(e) => { setCpfErro(""); setD((x) => ({ ...x, cpf: mascararCpf(e.target.value) })); }} placeholder="000.000.000-00" />
          {cpfErro && <span id="cad-cpf-erro" role="alert" className="mt-1 block text-xs text-primary">{cpfErro}</span>}
        </label>
        {campo("email", C.contrato.email, { required: true, type: "email", autoComplete: "email", maxLength: 160 })}
        {campo("whatsapp", "WhatsApp", { required: true, type: "tel", inputMode: "tel", autoComplete: "tel", maxLength: 20 })}
        {campo("data_nascimento", C.contrato.nascimento, { type: "date", required: true, autoComplete: "bday" })}
        {campo("rg", C.contrato.rg, { maxLength: 20 })}
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
      <label className="flex gap-3 text-sm text-muted-foreground"><input required type="checkbox" checked={d.aceite} onChange={(e) => setD((x) => ({ ...x, aceite: e.target.checked }))} /><span>{T.cadastro.consentimento} <a href="/privacidade" className="underline">política de privacidade</a>.</span></label>
      <input name="website" aria-hidden="true" tabIndex={-1} className="hidden" value={website} onChange={(e) => setWebsite(e.target.value)} />
      {faltaErro && <p role="alert" className="border-l-2 border-primary pl-3 text-sm">{faltaErro}</p>}
      {erro && <p role="alert" className="border-l-2 border-primary pl-3 text-sm">{erro}</p>}
      <Button type="submit" disabled={enviando || !d.aceite} className="w-full rounded-none h-auto py-4 font-display font-bold uppercase">{enviando ? C.carregando : T.cadastro.continuar}</Button>
      <p className="text-xs text-muted-foreground">{T.cadastro.rodape}</p>
    </form>
  </div>;
}
