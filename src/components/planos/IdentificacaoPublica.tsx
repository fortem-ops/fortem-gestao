import { useState, type FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { TEXTOS_PLANOS as T } from "@/config/planosPublicoTextos";

export type IdentificacaoPublica = { tipo_identificacao: "novo" | "aluno" | "ex_aluno"; nome: string; whatsapp: string; email: string; cpf: string; aceite: boolean; confirmar_vinculo: boolean };
export function IdentificacaoPublicaForm({ onSubmit, enviando, erro }: { onSubmit: (dados: IdentificacaoPublica) => void; enviando: boolean; erro?: string }) {
  const [tipo, setTipo] = useState<IdentificacaoPublica["tipo_identificacao"]>("novo");
  const [form, setForm] = useState({ nome: "", whatsapp: "", email: "", cpf: "", aceite: false });
  const [resultado, setResultado] = useState<{ existe: boolean; nome_mascarado?: string } | null>(null);
  const [confirmado, setConfirmado] = useState(false);
  const [buscando, setBuscando] = useState(false);
  const [aviso, setAviso] = useState("");
  const [website, setWebsite] = useState("");
  const novo = tipo === "novo" || resultado?.existe === false;
  async function buscar() {
    setBuscando(true); setAviso("");
    const { data, error } = await supabase.rpc("fn_planos_identificar_telefone", { p_telefone: form.whatsapp });
    setBuscando(false);
    if (error) { setAviso("Não foi possível consultar agora. Tente novamente mais tarde."); return; }
    const r = data as { existe: boolean; nome_mascarado?: string; limitado?: boolean };
    if (r.limitado) { setAviso("Muitas consultas. Tente novamente mais tarde."); return; }
    setResultado(r); if (!r.existe) setAviso(T.identificacao.naoEncontrado);
  }
  function enviar(e: FormEvent) {
    e.preventDefault();
    if (website) return;
    onSubmit({ ...form, tipo_identificacao: tipo, confirmar_vinculo: confirmado && !novo });
  }
  return <form onSubmit={enviar} className="space-y-4">
    <div className="grid grid-cols-3 gap-2" role="group" aria-label={T.identificacao.titulo}>{Object.entries(T.identificacao.tipos).map(([key, label]) => <Button key={key} type="button" variant={tipo === key ? "default" : "outline"} className="rounded-none h-auto py-3 whitespace-normal" aria-pressed={tipo === key} onClick={() => { setTipo(key as IdentificacaoPublica["tipo_identificacao"]); setResultado(null); setConfirmado(false); setAviso(""); setForm({ ...form, nome: "", email: "", cpf: "" }); }}>{label}</Button>)}</div>
    <label className="block text-sm">WhatsApp<input required aria-label="WhatsApp" autoComplete="tel" inputMode="tel" value={form.whatsapp} onChange={(e) => { setForm({ ...form, whatsapp: e.target.value }); setResultado(null); setConfirmado(false); }} className="campo mt-1" /></label>
    {!novo && !resultado && <Button type="button" variant="outline" className="rounded-none" disabled={buscando} onClick={buscar}>{buscando ? "Buscando..." : T.identificacao.buscar}</Button>}
    {resultado?.existe && !confirmado && <div className="space-y-3"><p>{T.identificacao.confirmacao(resultado.nome_mascarado ?? "")}</p><div className="flex gap-3"><Button type="button" className="rounded-none" onClick={() => setConfirmado(true)}>{T.identificacao.sim}</Button><Button type="button" variant="outline" className="rounded-none" onClick={() => { setResultado({ existe: false }); setConfirmado(false); setAviso(T.identificacao.naoEncontrado); }}>{T.identificacao.nao}</Button></div></div>}
    {aviso && <p role="status" className="text-sm text-muted-foreground">{aviso}</p>}
    {novo && <label className="block text-sm">Nome completo<input required minLength={3} maxLength={120} aria-label="Nome completo" autoComplete="name" className="campo mt-1" value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} /></label>}
    {(novo || confirmado) && <>
      {confirmado && <p className="text-sm text-muted-foreground">{T.identificacao.confirmado}</p>}
      <label className="block text-sm">{novo ? "E-mail" : `${T.identificacao.email} (se ainda não cadastrou)`}<input required={novo} type="email" aria-label="E-mail" autoComplete="email" className="campo mt-1" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></label>
      {novo && <label className="block text-sm">CPF (opcional)<input aria-label="CPF (opcional)" inputMode="numeric" className="campo mt-1" value={form.cpf} onChange={(e) => setForm({ ...form, cpf: e.target.value })} /></label>}
      <label className="flex gap-3 text-sm text-muted-foreground"><input required type="checkbox" checked={form.aceite} onChange={(e) => setForm({ ...form, aceite: e.target.checked })} /><span>Autorizo a FORTEM a entrar em contato comigo sobre este plano, conforme a <a href="/privacidade" className="underline">política de privacidade</a>.</span></label>
      <Button type="submit" disabled={enviando} className="w-full rounded-none h-auto py-4 font-display font-bold uppercase">{enviando ? "Enviando..." : "Quero este plano"}</Button>
      <p className="text-xs text-muted-foreground">Nada é cobrado agora. A equipe FORTEM entra em contato para concluir a matrícula.</p>
    </>}
    <input name="website" aria-hidden="true" tabIndex={-1} className="hidden" value={website} onChange={(e) => setWebsite(e.target.value)} />
    {erro && <p role="alert" className="text-sm text-primary">{erro}</p>}
  </form>;
}