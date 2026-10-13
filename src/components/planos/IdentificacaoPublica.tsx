import { useState, type FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { TEXTOS_PLANOS as T } from "@/config/planosPublicoTextos";
import { isValidCpfDigits } from "@/lib/cpfValidation";

export type IdentificacaoPublica = { tipo_identificacao: "novo" | "aluno" | "ex_aluno"; nome: string; whatsapp: string; email: string; cpf: string; aceite: boolean; confirmar_vinculo: boolean; verificacao_id?: string };
type Busca = "telefone" | "cpf";
type Envio = { enviado: boolean; verificacao_id?: string; email_mascarado?: string; motivo?: string };

/** Ponto de integração do Turnstile: sem site key, nenhum widget é carregado. */
export const TURNSTILE_SITE_KEY = "";

export function IdentificacaoPublicaForm({ onSubmit, enviando, erro }: { onSubmit: (dados: IdentificacaoPublica) => void; enviando: boolean; erro?: string }) {
  const [tipo, setTipo] = useState<IdentificacaoPublica["tipo_identificacao"]>("novo");
  const [busca, setBusca] = useState<Busca>("telefone");
  const [valorBusca, setValorBusca] = useState("");
  const [form, setForm] = useState({ nome: "", whatsapp: "", email: "", cpf: "", aceite: false });
  const [resultado, setResultado] = useState<{ existe: boolean; nome_mascarado?: string } | null>(null);
  const [envio, setEnvio] = useState<Envio | null>(null);
  const [codigo, setCodigo] = useState("");
  const [verificacaoId, setVerificacaoId] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [aviso, setAviso] = useState("");
  const [website, setWebsite] = useState("");
  const confirmado = !!verificacaoId;
  const novo = tipo === "novo" || resultado?.existe === false;
  const whatsappDaBusca = tipo !== "novo" && busca === "telefone";

  function limparBusca() { setResultado(null); setEnvio(null); setCodigo(""); setVerificacaoId(null); setAviso(""); }
  function seguirComoNovo(msg: string) { setResultado({ existe: false }); setEnvio(null); setAviso(msg); }

  async function buscar() {
    if (busca === "cpf" && !isValidCpfDigits(valorBusca)) { setAviso(T.identificacao.cpfInvalido); return; }
    setOcupado(true); setAviso("");
    const { data, error } = await supabase.rpc("fn_planos_identificar" as any, { p: { tipo: busca, valor: valorBusca.replace(/\D/g, "") } });
    setOcupado(false);
    if (error) { setAviso("Não foi possível consultar agora. Tente novamente mais tarde."); return; }
    const r = data as { existe: boolean; nome_mascarado?: string; limitado?: boolean };
    if (r.limitado) { setAviso(T.identificacao.limitado); return; }
    setResultado(r); if (!r.existe) setAviso(T.identificacao.naoEncontrado);
  }

  async function enviarCodigo() {
    setOcupado(true); setAviso(""); setCodigo("");
    const { data, error } = await supabase.functions.invoke("planos-codigo", { body: { acao: "enviar", tipo: busca, valor: valorBusca.replace(/\D/g, "") } });
    setOcupado(false);
    const r = (data ?? {}) as Envio;
    if (error || !r.enviado) {
      if (r.motivo === "limitado") { setAviso(T.identificacao.limitado); return; }
      seguirComoNovo(T.identificacao.semEmail); return;
    }
    setEnvio(r);
  }

  async function validarCodigo() {
    if (!envio?.verificacao_id) return;
    setOcupado(true); setAviso("");
    const { data } = await supabase.functions.invoke("planos-codigo", { body: { acao: "validar", verificacao_id: envio.verificacao_id, codigo } });
    setOcupado(false);
    const r = (data ?? {}) as { ok?: boolean; motivo?: string; restantes?: number };
    if (r.ok) { setVerificacaoId(envio.verificacao_id); return; }
    setAviso(r.motivo === "errado" ? T.identificacao.codigoErrado(r.restantes ?? 0)
      : r.motivo === "expirado" ? T.identificacao.codigoExpirado
      : r.motivo === "limitado" ? T.identificacao.limitado : T.identificacao.codigoBloqueado);
  }

  function enviar(e: FormEvent) {
    e.preventDefault();
    if (website) return;
    if (novo && form.cpf && !isValidCpfDigits(form.cpf)) { setAviso(T.identificacao.cpfInvalido); return; }
    const whatsapp = whatsappDaBusca ? valorBusca : form.whatsapp;
    const cpf = form.cpf || (tipo !== "novo" && busca === "cpf" && !confirmado ? valorBusca : "");
    onSubmit({ ...form, cpf, whatsapp, tipo_identificacao: tipo, confirmar_vinculo: confirmado && !novo, verificacao_id: confirmado && !novo ? verificacaoId! : undefined });
  }

  return <form onSubmit={enviar} className="space-y-4">
    <div className="grid grid-cols-3 gap-2" role="group" aria-label={T.identificacao.titulo}>{Object.entries(T.identificacao.tipos).map(([key, label]) => <Button key={key} type="button" variant={tipo === key ? "default" : "outline"} className="rounded-none h-auto py-3 whitespace-normal" aria-pressed={tipo === key} onClick={() => { setTipo(key as IdentificacaoPublica["tipo_identificacao"]); limparBusca(); setValorBusca(""); setForm({ ...form, nome: "", email: "", cpf: "" }); }}>{label}</Button>)}</div>

    {tipo !== "novo" && <>
      <div className="space-y-2">
        <p className="text-sm">{T.identificacao.buscarPor}</p>
        <div className="grid grid-cols-2 gap-2" role="group" aria-label={T.identificacao.buscarPor}>
          {(["telefone", "cpf"] as Busca[]).map((b) => <Button key={b} type="button" variant={busca === b ? "default" : "outline"} className="rounded-none" aria-pressed={busca === b} disabled={confirmado} onClick={() => { setBusca(b); setValorBusca(""); limparBusca(); }}>{b === "telefone" ? T.identificacao.porCelular : T.identificacao.porCpf}</Button>)}
        </div>
      </div>
      <label className="block text-sm">{busca === "telefone" ? "WhatsApp" : "CPF"}<input required aria-label={busca === "telefone" ? "WhatsApp" : "CPF"} autoComplete={busca === "telefone" ? "tel" : "off"} inputMode={busca === "telefone" ? "tel" : "numeric"} maxLength={busca === "cpf" ? 14 : 20} disabled={confirmado} value={valorBusca} onChange={(e) => { setValorBusca(e.target.value); limparBusca(); }} className="campo mt-1" /></label>
      {!resultado && <Button type="button" variant="outline" className="rounded-none" disabled={ocupado || !valorBusca} onClick={buscar}>{ocupado ? "Buscando..." : T.identificacao.buscar}</Button>}
      {resultado?.existe && !envio && !confirmado && <div className="space-y-3"><p>{T.identificacao.confirmacao(resultado.nome_mascarado ?? "")}</p><div className="flex gap-3"><Button type="button" className="rounded-none" disabled={ocupado} onClick={enviarCodigo}>{ocupado ? "Enviando..." : T.identificacao.sim}</Button><Button type="button" variant="outline" className="rounded-none" onClick={() => seguirComoNovo(T.identificacao.naoEncontrado)}>{T.identificacao.nao}</Button></div></div>}
      {envio?.enviado && !confirmado && <div className="space-y-3">
        <p className="text-sm">{T.identificacao.codigoEnviado(envio.email_mascarado ?? "")}</p>
        <label className="block text-sm">{T.identificacao.codigoLabel}<input aria-label={T.identificacao.codigoLabel} inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={codigo} onChange={(e) => setCodigo(e.target.value.replace(/\D/g, ""))} className="campo mt-1 tracking-[0.4em]" /></label>
        <div className="flex flex-wrap gap-3"><Button type="button" className="rounded-none" disabled={ocupado || codigo.length !== 6} onClick={validarCodigo}>{T.identificacao.validar}</Button><Button type="button" variant="outline" className="rounded-none" disabled={ocupado} onClick={enviarCodigo}>{T.identificacao.reenviar}</Button></div>
      </div>}
    </>}

    {aviso && <p role="status" className="text-sm text-muted-foreground">{aviso}</p>}
    {(novo || confirmado) && !whatsappDaBusca && <label className="block text-sm">WhatsApp<input required aria-label="WhatsApp para contato" autoComplete="tel" inputMode="tel" value={form.whatsapp} onChange={(e) => setForm({ ...form, whatsapp: e.target.value })} className="campo mt-1" /></label>}
    {novo && <label className="block text-sm">Nome completo<input required minLength={3} maxLength={120} aria-label="Nome completo" autoComplete="name" className="campo mt-1" value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} /></label>}
    {(novo || confirmado) && <>
      {confirmado && <p className="text-sm text-muted-foreground">{T.identificacao.confirmado}</p>}
      {novo && <label className="block text-sm">E-mail<input required type="email" aria-label="E-mail" autoComplete="email" className="campo mt-1" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></label>}
      {novo && <label className="block text-sm">CPF (opcional)<input aria-label="CPF (opcional)" inputMode="numeric" maxLength={14} className="campo mt-1" value={form.cpf} onChange={(e) => setForm({ ...form, cpf: e.target.value })} /></label>}
      <label className="flex gap-3 text-sm text-muted-foreground"><input required type="checkbox" checked={form.aceite} onChange={(e) => setForm({ ...form, aceite: e.target.checked })} /><span>Autorizo a FORTEM a entrar em contato comigo sobre este plano, conforme a <a href="/privacidade" className="underline">política de privacidade</a>.</span></label>
      <Button type="submit" disabled={enviando} className="w-full rounded-none h-auto py-4 font-display font-bold uppercase">{enviando ? "Enviando..." : "Quero este plano"}</Button>
      <p className="text-xs text-muted-foreground">Nada é cobrado agora. A equipe FORTEM entra em contato para concluir a matrícula.</p>
    </>}
    <input name="website" aria-hidden="true" tabIndex={-1} className="hidden" value={website} onChange={(e) => setWebsite(e.target.value)} />
    {erro && <p role="alert" className="text-sm text-primary">{erro}</p>}
  </form>;
}
