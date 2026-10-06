import { useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowDown, CalendarDays, Clock3, Loader2, MapPin, Minus, Plus, Users } from "lucide-react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { festa10AnosConfig } from "@/config/festa10anos";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Seo } from "@/components/Seo";
import fortemWordmark from "@/assets/fortem-wordmark.png";

const confirmacaoSchema = z.object({
  nome: z.string().trim().min(2, "Informe seu nome completo.").max(120, "O nome deve ter no máximo 120 caracteres."),
  whatsapp: z.string().transform((value) => value.replace(/\D/g, "")).refine((value) => value.length === 10 || value.length === 11, "Informe um WhatsApp válido com DDD."),
  email: z.string().trim().max(254, "O e-mail deve ter no máximo 254 caracteres.").refine((value) => value === "" || z.string().email().safeParse(value).success, "Informe um e-mail válido."),
  vinculo: z.enum(["aluno_atual", "ex_aluno", "amigo_fortem"], { required_error: "Selecione seu vínculo com a FORTEM." }),
  acompanhantes: z.array(z.string().trim().min(2, "Informe o nome do acompanhante.").max(120, "O nome deve ter no máximo 120 caracteres.")).max(3, "É possível adicionar até 3 acompanhantes."),
  website: z.string().max(0),
});

type FormState = { nome: string; whatsapp: string; email: string; vinculo: string; acompanhantes: string[]; website: string };
type FieldErrors = Partial<Record<"nome" | "whatsapp" | "email" | "vinculo" | "acompanhantes" | "geral", string>>;

const initialForm: FormState = { nome: "", whatsapp: "", email: "", vinculo: "", acompanhantes: [], website: "" };

const maskWhatsApp = (value: string) => {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  if (digits.length <= 2) return digits ? `(${digits}` : "";
  if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  if (digits.length <= 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
};

const toInternationalPhone = (value: string) => {
  const digits = value.replace(/\D/g, "");
  return digits.startsWith("55") ? digits : `55${digits}`;
};

function Reveal({ children, className = "", delay = 0 }: { children: React.ReactNode; className?: string; delay?: number }) {
  const reduced = useReducedMotion();
  return <motion.div initial={reduced ? false : { opacity: 0, y: 24 }} whileInView={reduced ? undefined : { opacity: 1, y: 0 }} viewport={{ once: true, amount: 0.15 }} transition={{ duration: 0.65, delay, ease: [0.22, 1, 0.36, 1] }} className={className}>{children}</motion.div>;
}

function FieldError({ message }: { message?: string }) {
  return message ? <p className="mt-1.5 text-sm text-destructive" role="alert">{message}</p> : null;
}

export default function Festa10Anos() {
  const [form, setForm] = useState<FormState>(initialForm);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [confirmed, setConfirmed] = useState<number | null>(null);
  const [alreadyConfirmed, setAlreadyConfirmed] = useState(false);
  const config = festa10AnosConfig;

  const scrollToForm = () => document.getElementById("confirmar-presenca")?.scrollIntoView({ behavior: "smooth", block: "start" });

  const update = (field: keyof FormState, value: FormState[keyof FormState]) => {
    setForm((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined, geral: undefined }));
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setErrors({});
    const parsed = confirmacaoSchema.safeParse(form);
    if (!parsed.success) {
      const next: FieldErrors = {};
      parsed.error.issues.forEach((issue) => {
        const key = issue.path[0] as keyof FieldErrors;
        if (key === "website") return;
        if (!next[key]) next[key] = issue.message;
      });
      setErrors(next);
      return;
    }
    if (parsed.data.website) return;

    setSubmitting(true);
    const acompanhantes = parsed.data.acompanhantes.map((nome) => nome.trim());
    const { error } = await supabase.from("festa_confirmacoes").insert({
      nome: parsed.data.nome.trim(),
      whatsapp: toInternationalPhone(parsed.data.whatsapp),
      email: parsed.data.email.trim() || null,
      vinculo: parsed.data.vinculo,
      acompanhantes,
      total_pessoas: 1 + acompanhantes.length,
    });
    setSubmitting(false);

    if (!error) {
      setConfirmed(1 + acompanhantes.length);
      setForm(initialForm);
      return;
    }
    if (error.code === "23505") {
      setAlreadyConfirmed(true);
      return;
    }
    setErrors({ geral: "Não foi possível confirmar agora. Tente novamente em alguns instantes." });
  };

  return (
    <main data-festa="10anos" className="min-h-screen overflow-hidden bg-background text-foreground">
      <Seo title="FORTEM · 10 anos | 14.11.26" description="Dez anos de movimento. Confirme sua presença na festa de 10 anos da FORTEM, em 14 de novembro de 2026." path="/10anos" />

      <section className="relative flex min-h-[92svh] flex-col px-5 pb-10 pt-7 sm:px-8 lg:px-12">
        <header className="mx-auto flex w-full max-w-7xl items-center justify-between">
          <img src={fortemWordmark} alt="FORTEM" className="h-5 w-auto object-contain invert sm:h-6" />
          <span className="text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground">10 anos</span>
        </header>
        <div className="mx-auto flex w-full max-w-7xl flex-1 flex-col justify-center py-16 sm:py-20">
          <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.7 }} className="text-xs font-semibold uppercase tracking-[0.32em] text-primary">{config.hero.selo}</motion.p>
          <motion.h1 initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }} className="mt-5 font-display text-[clamp(4.5rem,21vw,13rem)] font-black leading-[0.78] text-foreground">{config.dataCurta}</motion.h1>
          <div className="mt-10 max-w-2xl border-l-2 border-primary pl-5 sm:mt-14 sm:pl-7">
            <p className="font-display text-xl font-semibold uppercase tracking-[0.08em] sm:text-3xl">{config.hero.titulo}</p>
            <p className="mt-4 max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg">{config.hero.texto}</p>
          </div>
          <Button size="lg" onClick={scrollToForm} className="mt-9 w-fit rounded-sm px-7">Confirmar presença<ArrowDown className="ml-2 h-4 w-4" /></Button>
        </div>
        <p className="mx-auto w-full max-w-7xl text-xs uppercase tracking-[0.2em] text-muted-foreground">Porto Alegre · 2026</p>
      </section>

      <section className="border-t border-border px-5 py-24 sm:px-8 sm:py-32 lg:px-12">
        <div className="mx-auto max-w-7xl">
          <Reveal><p className="text-xs font-semibold uppercase tracking-[0.24em] text-primary">{config.historia.titulo}</p><h2 className="mt-5 max-w-3xl font-display text-4xl font-semibold leading-tight sm:text-6xl">{config.historia.abertura}</h2></Reveal>
          <div className="relative mt-20 space-y-20 before:absolute before:bottom-0 before:left-[2.9rem] before:top-0 before:w-px before:bg-border md:mt-28 md:space-y-28 md:before:left-1/2">
            {config.historia.marcos.map((marco, index) => (
              <Reveal key={`${marco.ano}-${marco.titulo}`} className="relative">
                <span className="absolute left-[2.55rem] top-0 z-10 h-3 w-3 rounded-full border-2 border-primary bg-background md:left-1/2 md:-translate-x-1/2" />
                <article className="grid gap-8 pl-20 md:grid-cols-2 md:gap-20 md:pl-0">
                  <div className={index % 2 === 0 ? "md:pr-10" : "md:order-2 md:pl-10"}>
                    <div className="aspect-[3/2] overflow-hidden bg-muted"><img src={marco.imagem} alt={marco.imagemAlt} width={1200} height={800} loading="lazy" className="h-full w-full object-cover opacity-80 grayscale" /></div>
                  </div>
                  <div className={`flex flex-col justify-center ${index % 2 === 0 ? "md:pl-10" : "md:order-1 md:pr-10 md:text-right"}`}>
                    <p className="font-display text-5xl font-bold text-primary/90 sm:text-6xl">{marco.ano}</p>
                    <h3 className="mt-4 text-xl font-semibold sm:text-2xl">{marco.titulo}</h3>
                    <p className="mt-3 leading-relaxed text-muted-foreground">{marco.texto}</p>
                  </div>
                </article>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section className="border-y border-border bg-card px-5 py-24 sm:px-8 sm:py-32 lg:px-12">
        <div className="mx-auto max-w-7xl">
          <Reveal><p className="text-xs font-semibold uppercase tracking-[0.24em] text-primary">A festa</p><h2 className="mt-5 font-display text-4xl font-semibold sm:text-6xl">Uma noite para celebrar.</h2></Reveal>
          <div className="mt-14 grid gap-px overflow-hidden border border-border bg-border md:grid-cols-3">
            <div className="bg-card p-7"><CalendarDays className="h-5 w-5 text-primary" /><p className="mt-5 text-xs uppercase tracking-[0.18em] text-muted-foreground">Data</p><p className="mt-2 text-lg font-semibold">{config.dataExtenso}</p></div>
            <div className="bg-card p-7"><Clock3 className="h-5 w-5 text-primary" /><p className="mt-5 text-xs uppercase tracking-[0.18em] text-muted-foreground">Horário</p><p className="mt-2 text-lg font-semibold">{config.horario}</p></div>
            <div className="bg-card p-7"><MapPin className="h-5 w-5 text-primary" /><p className="mt-5 text-xs uppercase tracking-[0.18em] text-muted-foreground">Local</p><p className="mt-2 text-lg font-semibold">{config.local}</p></div>
          </div>
          <div className="mt-16 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">{config.atracoes.map((atracao, index) => <Reveal key={atracao.titulo} delay={index * 0.06}><article className="h-full border-t border-primary/60 pt-5"><p className="text-lg font-semibold">{atracao.titulo}</p><p className="mt-2 text-sm leading-relaxed text-muted-foreground">{atracao.texto}</p></article></Reveal>)}</div>
          <p className="mt-14 text-sm text-muted-foreground">{config.aviso}</p>
        </div>
      </section>

      <section id="confirmar-presenca" className="scroll-mt-6 px-5 py-24 sm:px-8 sm:py-32 lg:px-12">
        <div className="mx-auto grid max-w-7xl gap-14 lg:grid-cols-[0.8fr_1.2fr] lg:gap-24">
          <Reveal><p className="text-xs font-semibold uppercase tracking-[0.24em] text-primary">Confirme sua presença</p><h2 className="mt-5 font-display text-4xl font-semibold leading-tight sm:text-6xl">Queremos celebrar com você.</h2><p className="mt-6 max-w-md leading-relaxed text-muted-foreground">Reserve seu lugar e inclua quem estará com você nessa noite.</p></Reveal>
          <Reveal>
            {confirmed !== null ? (
              <div className="border-l-2 border-primary py-4 pl-7" role="status"><p className="font-display text-3xl font-semibold">Presença confirmada.</p><p className="mt-3 text-muted-foreground">Nos vemos em 14 de novembro.</p><p className="mt-7 flex items-center gap-2 text-sm"><Users className="h-4 w-4 text-primary" />{confirmed} {confirmed === 1 ? "pessoa confirmada" : "pessoas confirmadas"}</p></div>
            ) : alreadyConfirmed ? (
              <div className="border-l-2 border-primary py-4 pl-7" role="status"><p className="font-display text-3xl font-semibold">Já temos a sua confirmação.</p><p className="mt-3 text-muted-foreground">Para alterar, fale com a gente.</p></div>
            ) : (
              <form onSubmit={submit} noValidate className="space-y-6">
                <div><label htmlFor="festa-nome" className="text-sm font-medium">Nome completo <span aria-hidden="true">*</span></label><Input id="festa-nome" autoComplete="name" maxLength={120} value={form.nome} onChange={(event) => update("nome", event.target.value)} aria-invalid={!!errors.nome} aria-describedby={errors.nome ? "festa-nome-error" : undefined} className="mt-2 h-12 rounded-sm" /><span id="festa-nome-error"><FieldError message={errors.nome} /></span></div>
                <div className="grid gap-6 sm:grid-cols-2">
                  <div><label htmlFor="festa-whatsapp" className="text-sm font-medium">WhatsApp <span aria-hidden="true">*</span></label><Input id="festa-whatsapp" type="tel" inputMode="tel" autoComplete="tel" placeholder="(51) 99999-9999" maxLength={15} value={form.whatsapp} onChange={(event) => update("whatsapp", maskWhatsApp(event.target.value))} aria-invalid={!!errors.whatsapp} className="mt-2 h-12 rounded-sm" /><FieldError message={errors.whatsapp} /></div>
                  <div><label htmlFor="festa-email" className="text-sm font-medium">E-mail <span className="text-muted-foreground">(opcional)</span></label><Input id="festa-email" type="email" autoComplete="email" maxLength={254} value={form.email} onChange={(event) => update("email", event.target.value)} aria-invalid={!!errors.email} className="mt-2 h-12 rounded-sm" /><FieldError message={errors.email} /></div>
                </div>
                <div><label htmlFor="festa-vinculo" className="text-sm font-medium">Vínculo com a FORTEM <span aria-hidden="true">*</span></label><Select value={form.vinculo} onValueChange={(value) => update("vinculo", value)}><SelectTrigger id="festa-vinculo" aria-invalid={!!errors.vinculo} className="mt-2 h-12 rounded-sm"><SelectValue placeholder="Selecione uma opção" /></SelectTrigger><SelectContent><SelectItem value="aluno_atual">Aluno atual</SelectItem><SelectItem value="ex_aluno">Ex-aluno</SelectItem><SelectItem value="amigo_fortem">Amigo(a) da FORTEM</SelectItem></SelectContent></Select><FieldError message={errors.vinculo} /></div>
                <div className="space-y-4">{form.acompanhantes.map((acompanhante, index) => <div key={index}><div className="flex items-end gap-2"><div className="flex-1"><label htmlFor={`festa-acompanhante-${index}`} className="text-sm font-medium">Nome do acompanhante {index + 1}</label><Input id={`festa-acompanhante-${index}`} maxLength={120} value={acompanhante} onChange={(event) => { const next = [...form.acompanhantes]; next[index] = event.target.value; update("acompanhantes", next); }} className="mt-2 h-12 rounded-sm" /></div><Button type="button" variant="ghost" size="icon" aria-label={`Remover acompanhante ${index + 1}`} onClick={() => update("acompanhantes", form.acompanhantes.filter((_, itemIndex) => itemIndex !== index))} className="h-12 w-12"><Minus className="h-4 w-4" /></Button></div></div>)}<FieldError message={errors.acompanhantes} />{form.acompanhantes.length < 3 && <Button type="button" variant="outline" onClick={() => update("acompanhantes", [...form.acompanhantes, ""])} className="rounded-sm"><Plus className="mr-2 h-4 w-4" />Adicionar acompanhante</Button>}</div>
                <div className="absolute -left-[10000px] top-auto h-px w-px overflow-hidden" aria-hidden="true"><label htmlFor="festa-website">Website</label><Input id="festa-website" name="website" tabIndex={-1} autoComplete="off" value={form.website} onChange={(event) => update("website", event.target.value)} /></div>
                <FieldError message={errors.geral} />
                <Button type="submit" size="lg" disabled={submitting} className="w-full rounded-sm sm:w-auto">{submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{submitting ? "Confirmando..." : "Confirmar presença"}</Button>
              </form>
            )}
          </Reveal>
        </div>
      </section>

      <footer className="border-t border-border px-5 py-10 sm:px-8 lg:px-12"><div className="mx-auto flex max-w-7xl flex-col gap-6 sm:flex-row sm:items-center sm:justify-between"><div className="flex items-center gap-5"><img src={fortemWordmark} alt="FORTEM" className="h-5 w-auto invert" /><span className="h-4 w-px bg-border" /><span className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">FORTEM · 10 ANOS</span></div>{config.instagram.url && <a href={config.instagram.url} target="_blank" rel="noreferrer" className="text-sm text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">{config.instagram.usuario}</a>}</div></footer>
    </main>
  );
}
