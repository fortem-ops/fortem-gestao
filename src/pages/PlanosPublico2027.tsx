import { useMemo, useState } from "react";
import { z } from "zod";
import { Check, Minus, ArrowLeft, ArrowRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Seo } from "@/components/Seo";
import { cn } from "@/lib/utils";
import {
  FAMILIAS, FREQUENCIAS, NOME_FAMILIA, rotuloFrequencia, formasPermitidas, encontrarItem, itemReferencia,
  precoMensalVitrine, valorCorrida, calcularResumo, brl, descreverParcelas,
  type CatalogoPublico, type Familia2027, type Frequencia2027, type FormaPublica, type ServicoPublico, type PlanoPublico,
} from "@/lib/planosPublico2027";
import type { FormaServicos2027 } from "@/lib/vendas2027";
import fotoNutricao from "@/assets/planos2027/nutricao.jpg";
import fotoReabilitacao from "@/assets/planos2027/reabilitacao.jpg";
import fotoCorrida from "@/assets/planos2027/corrida.jpg";

const PASSOS = ["Plano", "Vantagens", "Turbine", "Acompanhamento", "Pagamento"];

const DESCRICAO: Record<Familia2027, string> = {
  start_2027: "Para você começar com orientação e liberdade. Mensal, sem fidelidade.",
  power_2027: "Treino com acompanhamento e avaliação funcional para você evoluir com método.",
  pro_2027: "A experiência completa: reposição, horário fixo, bota de compressão e duas avaliações.",
};

const cadastroSchema = z.object({
  nome: z.string().trim().min(3, "Informe seu nome completo.").max(120),
  whatsapp: z.string().transform((v) => v.replace(/\D/g, "")).refine((v) => v.length === 10 || v.length === 11, "Informe um WhatsApp válido com DDD."),
  email: z.string().trim().email("Informe um e-mail válido.").max(200),
  cpf: z.string().transform((v) => v.replace(/\D/g, "")).refine((v) => v.length === 0 || v.length === 11, "CPF deve ter 11 dígitos."),
});

function mascaraTelefone(v: string) {
  const d = v.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 2) return d;
  if (d.length <= 7) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, d.length - 4)}-${d.slice(-4)}`;
}
function mascaraCpf(v: string) {
  const d = v.replace(/\D/g, "").slice(0, 11);
  return d.replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d{1,2})$/, "$1-$2");
}

function Titulo({ kicker, children }: { kicker: string; children: React.ReactNode }) {
  return (
    <div className="mb-6">
      <p className="text-xs font-semibold tracking-[0.2em] text-primary uppercase">{kicker}</p>
      <h2 className="mt-2 font-display text-2xl sm:text-3xl font-extrabold uppercase leading-tight text-foreground">{children}</h2>
    </div>
  );
}

function Opcao({ ativo, onClick, children, disabled, className }: { ativo: boolean; onClick: () => void; children: React.ReactNode; disabled?: boolean; className?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={ativo}
      className={cn(
        "border text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        ativo ? "border-primary bg-primary/10" : "border-border bg-card hover:border-foreground/40",
        disabled && "opacity-40 cursor-not-allowed hover:border-border",
        className,
      )}
    >
      {children}
    </button>
  );
}

export default function PlanosPublico2027({ catalogo }: { catalogo: CatalogoPublico }) {
  const [passo, setPasso] = useState(0);
  const [freq, setFreq] = useState<Frequencia2027>("2x");
  const [familia, setFamilia] = useState<Familia2027>("power_2027");
  const [nutri, setNutri] = useState<string | null>(null);
  const [reab, setReab] = useState<string | null>(null);
  const [corrida, setCorrida] = useState(false);
  const [forma, setForma] = useState<FormaPublica>("cartao_parcelado");
  const [parcelas, setParcelas] = useState(12);
  const [formaServicos, setFormaServicos] = useState<FormaServicos2027>("cartao_parcelado");
  const [parcelasServicos, setParcelasServicos] = useState(6);
  const [form, setForm] = useState({ nome: "", whatsapp: "", email: "", cpf: "", website: "", aceite: false });
  const [erros, setErros] = useState<Record<string, string>>({});
  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState(false);

  const formas = formasPermitidas(familia);
  const formaEfetiva: FormaPublica = formas.includes(forma) ? forma : formas[0];
  const item = encontrarItem(catalogo, familia, freq, formaEfetiva);
  const ref = itemReferencia(catalogo, familia, freq);
  const servicosEscolhidos = useMemo(
    () => catalogo.servicos.filter((s) => s.codigo === nutri || s.codigo === reab),
    [catalogo.servicos, nutri, reab],
  );
  const corridaValor = valorCorrida(catalogo, familia);

  const resumo = useMemo(() => {
    if (!item) return null;
    try {
      return calcularResumo({ item, servicos: servicosEscolhidos, forma: formaEfetiva, parcelas, formaServicos, parcelasServicos });
    } catch {
      return null;
    }
  }, [item, servicosEscolhidos, formaEfetiva, parcelas, formaServicos, parcelasServicos]);

  const ir = (n: number) => {
    setPasso(n);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    if (form.website) return; // honeypot
    const r = cadastroSchema.safeParse(form);
    const novos: Record<string, string> = {};
    if (!r.success) r.error.issues.forEach((i) => (novos[String(i.path[0])] = i.message));
    if (!form.aceite) novos.aceite = "Autorize o contato para continuar.";
    setErros(novos);
    if (!r.success || !form.aceite || !item || !resumo) return;
    setEnviando(true);
    const { error } = await supabase.rpc("fn_proposta_plano_2027_criar" as any, {
      p: {
        previa: catalogo.previa,
        nome: r.data.nome, whatsapp: r.data.whatsapp, email: r.data.email, cpf: r.data.cpf,
        plano_codigo: item.codigo, forma_plano: formaEfetiva, parcelas_plano: parcelas,
        servicos: servicosEscolhidos.map((s) => s.codigo),
        forma_servicos: formaServicos, parcelas_servicos: parcelasServicos, corrida,
      },
    });
    setEnviando(false);
    if (error) {
      setErros({ geral: error.message || "Não foi possível enviar agora. Tente novamente." });
      return;
    }
    setEnviado(true);
    window.scrollTo({ top: 0 });
  }

  const nutris = catalogo.servicos.filter((s) => s.atividade === "Nutrição");
  const reabs = catalogo.servicos.filter((s) => s.atividade === "Reabilitação");
  const servicosNo12x = formaEfetiva !== "recorrencia";

  return (
    <div data-planos2027="true" className="min-h-screen bg-background text-foreground">
      <Seo title="Planos FORTEM — monte o seu plano" description="Escolha frequência, plano e acompanhamento e veja o valor exato do seu plano FORTEM." />
      {catalogo.previa && (
        <div className="bg-primary text-primary-foreground text-center text-xs font-semibold tracking-wider uppercase py-2 px-4">
          Prévia — itens ainda não estão à venda
        </div>
      )}
      <header className="border-b border-border">
        <div className="mx-auto max-w-5xl px-4 py-5 flex items-center justify-between">
          <span className="font-display text-xl font-black tracking-tight">FORTEM</span>
          <span className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Monte seu plano</span>
        </div>
      </header>

      {enviado ? (
        <main className="mx-auto max-w-2xl px-4 py-16">
          <Titulo kicker="Cadastro recebido">A equipe FORTEM entra em contato</Titulo>
          <p className="text-muted-foreground">
            Recebemos a sua escolha. Em breve você recebe uma mensagem no WhatsApp para confirmar os detalhes e concluir a matrícula.
          </p>
          {resumo && item && (
            <div className="mt-8 border border-border bg-card p-5">
              <p className="text-sm text-muted-foreground uppercase tracking-wider">Seu plano</p>
              <p className="mt-1 font-display text-xl font-bold uppercase">{NOME_FAMILIA[familia]} · {rotuloFrequencia(freq)}</p>
              <p className="mt-3 text-sm">Total: <strong>{brl(resumo.totalGeral)}</strong></p>
            </div>
          )}
        </main>
      ) : (
        <main className="mx-auto max-w-5xl px-4 pb-32 pt-6">
          <ol className="grid grid-cols-5 gap-1 mb-8" aria-label="Etapas">
            {PASSOS.map((p, i) => (
              <li key={p}>
                <button type="button" onClick={() => i < passo && ir(i)} disabled={i > passo} className="w-full text-left" aria-current={i === passo ? "step" : undefined}>
                  <span className={cn("block h-1", i <= passo ? "bg-primary" : "bg-border")} />
                  <span className={cn("mt-2 hidden sm:block text-[11px] uppercase tracking-wider", i === passo ? "text-foreground" : "text-muted-foreground")}>
                    {i + 1}. {p}
                  </span>
                </button>
              </li>
            ))}
          </ol>
          <p className="sm:hidden -mt-5 mb-6 text-[11px] uppercase tracking-wider text-muted-foreground">Passo {passo + 1} de 5 · {PASSOS[passo]}</p>

          {passo === 0 && (
            <section>
              <Titulo kicker="Passo 1">Quantas vezes por semana você quer treinar</Titulo>
              <div className="grid grid-cols-4 gap-2 mb-8">
                {FREQUENCIAS.map((f) => (
                  <Opcao key={f} ativo={freq === f} onClick={() => setFreq(f)} className="py-3 text-center">
                    <span className="font-display font-bold uppercase">{f === "livre" ? "Livre" : f}</span>
                  </Opcao>
                ))}
              </div>
              <h3 className="font-display text-lg font-bold uppercase mb-3">Escolha o seu plano</h3>
              <div className="grid gap-3 md:grid-cols-3">
                {FAMILIAS.map((fam) => {
                  const preco = precoMensalVitrine(catalogo, fam, freq);
                  const indisponivel = preco === null;
                  return (
                    <Opcao key={fam} ativo={familia === fam} disabled={indisponivel} onClick={() => setFamilia(fam)} className="p-5">
                      <span className="font-display text-2xl font-black uppercase">{NOME_FAMILIA[fam]}</span>
                      <span className="mt-2 block text-sm text-muted-foreground min-h-[3rem]">{DESCRICAO[fam]}</span>
                      <span className="mt-4 block">
                        {indisponivel ? (
                          <span className="text-sm uppercase tracking-wider text-muted-foreground">Indisponível</span>
                        ) : (
                          <>
                            <span className="font-display text-3xl font-extrabold">{brl(preco)}</span>
                            <span className="text-sm text-muted-foreground"> /mês</span>
                          </>
                        )}
                      </span>
                      {fam === "start_2027" && !indisponivel && <span className="mt-1 block text-xs text-muted-foreground">Recorrência mensal no cartão</span>}
                      {fam !== "start_2027" && !indisponivel && <span className="mt-1 block text-xs text-muted-foreground">Plano de 12 meses</span>}
                    </Opcao>
                  );
                })}
              </div>
            </section>
          )}

          {passo === 1 && (
            <section>
              <Titulo kicker="Passo 2">Vantagens de cada plano</Titulo>
              <Comparativo catalogo={catalogo} freq={freq} familia={familia} onEscolher={setFamilia} />
            </section>
          )}

          {passo === 2 && (
            <section>
              <Titulo kicker="Passo 3">Turbine o seu plano</Titulo>
              <p className="text-muted-foreground mb-6 max-w-2xl">Some ao seu treino o acompanhamento de quem é referência em cada área. Você escolhe os pacotes no próximo passo.</p>
              <div className="grid gap-4 md:grid-cols-3">
                {[
                  { foto: fotoNutricao, area: "Nutrição", nome: "Jéssica Elkfury", texto: "Plano alimentar alinhado ao seu treino e às suas metas, com acompanhamento de composição corporal." },
                  { foto: fotoReabilitacao, area: "Reabilitação", nome: "Júlia Assis Brasil", texto: "Recuperação de lesões e prevenção, integrada à rotina de treino com a equipe." },
                  { foto: fotoCorrida, area: "Grupo de corrida", nome: "Yasmim Ávila", texto: "Treinos de corrida em grupo com planilha e orientação técnica." },
                ].map((p) => (
                  <article key={p.area} className="border border-border bg-card">
                    <img src={p.foto} alt={`${p.nome}, ${p.area}`} loading="lazy" width={768} height={960} className="aspect-[4/5] w-full object-cover" />
                    <div className="p-4">
                      <p className="text-xs uppercase tracking-[0.2em] text-primary">{p.area}</p>
                      <h3 className="mt-1 font-display text-lg font-bold uppercase">{p.nome}</h3>
                      <p className="mt-2 text-sm text-muted-foreground">{p.texto}</p>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          )}

          {passo === 3 && (
            <section className="space-y-8">
              <Titulo kicker="Passo 4">Escolha o seu acompanhamento</Titulo>
              <GrupoServico titulo="Nutrição" itens={nutris} valor={nutri} onChange={setNutri} />
              <GrupoServico titulo="Reabilitação" itens={reabs} valor={reab} onChange={setReab} />
              <div>
                <h3 className="font-display text-lg font-bold uppercase mb-3">Grupo de corrida</h3>
                <div className="grid gap-2 sm:grid-cols-2">
                  <Opcao ativo={!corrida} onClick={() => setCorrida(false)} className="p-4"><span className="font-semibold">Nenhum</span></Opcao>
                  <Opcao ativo={corrida} disabled={corridaValor === null} onClick={() => setCorrida(true)} className="p-4">
                    <span className="font-semibold">Grupo de corrida</span>
                    <span className="block text-sm text-muted-foreground">
                      {corridaValor === null ? "Indisponível" : `${brl(corridaValor)} por mês, combinado com a equipe na matrícula`}
                    </span>
                  </Opcao>
                </div>
              </div>
            </section>
          )}

          {passo === 4 && (
            <section className="grid gap-8 lg:grid-cols-[1fr_380px]">
              <div className="space-y-8">
                <div>
                  <Titulo kicker="Passo 5">Forma de pagamento</Titulo>
                  <div className="grid gap-2">
                    {formas.map((f) => {
                      const it = encontrarItem(catalogo, familia, freq, f);
                      return (
                        <Opcao key={f} ativo={formaEfetiva === f} disabled={!it} onClick={() => setForma(f)} className="p-4">
                          <span className="font-semibold">
                            {f === "cartao_parcelado" ? "Cartão em até 12x" : f === "pix_vista" ? "Pix à vista" : "Recorrência mensal no cartão"}
                          </span>
                          <span className="block text-sm text-muted-foreground">
                            {!it ? "Indisponível" :
                              f === "recorrencia"
                                ? familia === "start_2027"
                                  ? `${brl(it.valor)} por mês, sem fidelidade`
                                  : `${brl(it.valor)} + ${brl(it.taxa_recorrencia)} de taxa = ${brl(Number(it.valor) + Number(it.taxa_recorrencia))} por mês, por 12 meses`
                                : f === "pix_vista" ? `${brl(it.valor)} em um pagamento` : `${brl(it.valor)} em até 12x`}
                          </span>
                        </Opcao>
                      );
                    })}
                  </div>
                  {formaEfetiva === "cartao_parcelado" && (
                    <label className="mt-4 block text-sm">
                      <span className="text-muted-foreground">Número de parcelas</span>
                      <select value={parcelas} onChange={(e) => setParcelas(Number(e.target.value))} className="mt-1 block w-full border border-input bg-card px-3 py-2">
                        {Array.from({ length: 12 }, (_, i) => i + 1).map((n) => <option key={n} value={n}>{n}x</option>)}
                      </select>
                    </label>
                  )}
                </div>

                {servicosEscolhidos.length > 0 && !servicosNo12x && (
                  <div>
                    <h3 className="font-display text-lg font-bold uppercase mb-3">Pagamento do acompanhamento</h3>
                    <div className="grid gap-2 sm:grid-cols-2">
                      <Opcao ativo={formaServicos === "cartao_parcelado"} onClick={() => setFormaServicos("cartao_parcelado")} className="p-4"><span className="font-semibold">Cartão em até 6x</span></Opcao>
                      <Opcao ativo={formaServicos === "pix_vista"} onClick={() => setFormaServicos("pix_vista")} className="p-4"><span className="font-semibold">Pix à vista</span></Opcao>
                    </div>
                    {formaServicos === "cartao_parcelado" && (
                      <select aria-label="Parcelas do acompanhamento" value={parcelasServicos} onChange={(e) => setParcelasServicos(Number(e.target.value))} className="mt-3 block w-full border border-input bg-card px-3 py-2 text-sm">
                        {Array.from({ length: 6 }, (_, i) => i + 1).map((n) => <option key={n} value={n}>{n}x</option>)}
                      </select>
                    )}
                  </div>
                )}

                <form onSubmit={enviar} noValidate className="space-y-4">
                  <h3 className="font-display text-lg font-bold uppercase">Seus dados</h3>
                  <Campo id="nome" label="Nome completo" erro={erros.nome}>
                    <input id="nome" autoComplete="name" value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} className="campo" />
                  </Campo>
                  <Campo id="whatsapp" label="WhatsApp" erro={erros.whatsapp}>
                    <input id="whatsapp" inputMode="tel" autoComplete="tel" value={form.whatsapp} onChange={(e) => setForm({ ...form, whatsapp: mascaraTelefone(e.target.value) })} className="campo" />
                  </Campo>
                  <Campo id="email" label="E-mail" erro={erros.email}>
                    <input id="email" type="email" autoComplete="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="campo" />
                  </Campo>
                  <Campo id="cpf" label="CPF (opcional)" erro={erros.cpf}>
                    <input id="cpf" inputMode="numeric" value={form.cpf} onChange={(e) => setForm({ ...form, cpf: mascaraCpf(e.target.value) })} className="campo" />
                  </Campo>
                  <input tabIndex={-1} autoComplete="off" aria-hidden="true" className="hidden" value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })} name="website" />
                  <label className="flex gap-3 text-sm text-muted-foreground">
                    <input type="checkbox" checked={form.aceite} onChange={(e) => setForm({ ...form, aceite: e.target.checked })} className="mt-1 accent-[hsl(var(--primary))]" />
                    <span>Autorizo a FORTEM a entrar em contato comigo sobre este plano, conforme a <a href="/privacidade" className="underline">política de privacidade</a>.</span>
                  </label>
                  {erros.aceite && <p className="text-sm text-primary">{erros.aceite}</p>}
                  {erros.geral && <p role="alert" className="text-sm text-primary">{erros.geral}</p>}
                  <button type="submit" disabled={enviando || !resumo} className="w-full bg-primary text-primary-foreground py-4 font-display font-bold uppercase tracking-wider disabled:opacity-50">
                    {enviando ? "Enviando..." : "Quero este plano"}
                  </button>
                  <p className="text-xs text-muted-foreground">Nada é cobrado agora. A equipe FORTEM entra em contato para concluir a matrícula.</p>
                </form>
              </div>
              <Resumo familia={familia} freq={freq} item={item} resumo={resumo} servicos={servicosEscolhidos} corrida={corrida} corridaValor={corridaValor} />
            </section>
          )}

          {passo < 4 && (
            <div className="fixed inset-x-0 bottom-0 border-t border-border bg-background/95 backdrop-blur">
              <div className="mx-auto max-w-5xl px-4 py-3 flex items-center gap-3">
                {passo > 0 && (
                  <button type="button" onClick={() => ir(passo - 1)} className="border border-border px-4 py-3" aria-label="Voltar">
                    <ArrowLeft className="h-4 w-4" />
                  </button>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-xs uppercase tracking-wider text-muted-foreground truncate">{NOME_FAMILIA[familia]} · {rotuloFrequencia(freq)}</p>
                  {ref && <p className="font-display font-bold">{brl(precoMensalVitrine(catalogo, familia, freq) ?? 0)} /mês</p>}
                </div>
                <button type="button" disabled={!ref} onClick={() => ir(passo + 1)} className="bg-primary text-primary-foreground px-5 py-3 font-display font-bold uppercase tracking-wider flex items-center gap-2 disabled:opacity-50">
                  Continuar <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}
          {passo === 4 && (
            <button type="button" onClick={() => ir(3)} className="mt-8 text-sm text-muted-foreground underline">Voltar ao acompanhamento</button>
          )}
        </main>
      )}
    </div>
  );
}

function Campo({ id, label, erro, children }: { id: string; label: string; erro?: string; children: React.ReactNode }) {
  return (
    <div>
      <label htmlFor={id} className="block text-sm text-muted-foreground mb-1">{label}</label>
      {children}
      {erro && <p className="mt-1 text-sm text-primary">{erro}</p>}
    </div>
  );
}

function GrupoServico({ titulo, itens, valor, onChange }: { titulo: string; itens: ServicoPublico[]; valor: string | null; onChange: (v: string | null) => void }) {
  return (
    <div>
      <h3 className="font-display text-lg font-bold uppercase mb-3">{titulo}</h3>
      <div className="grid gap-2 sm:grid-cols-3">
        <Opcao ativo={valor === null} onClick={() => onChange(null)} className="p-4"><span className="font-semibold">Nenhum</span></Opcao>
        {itens.length === 0 && <div className="border border-border p-4 text-sm text-muted-foreground">Indisponível</div>}
        {itens.map((s) => (
          <Opcao key={s.codigo} ativo={valor === s.codigo} onClick={() => onChange(s.codigo)} className="p-4">
            <span className="font-semibold">{s.nome.replace(/\s*\(2027\)\s*/, "").replace(/^Nutrição - |^Reabilitação - /, "")}</span>
            <span className="block text-sm text-muted-foreground">{brl(Number(s.valor))}</span>
          </Opcao>
        ))}
      </div>
    </div>
  );
}

function Comparativo({ catalogo, freq, familia, onEscolher }: { catalogo: CatalogoPublico; freq: Frequencia2027; familia: Familia2027; onEscolher: (f: Familia2027) => void }) {
  const itens = FAMILIAS.map((f) => itemReferencia(catalogo, f, freq));
  const linhas: { rotulo: string; valor: (p: PlanoPublico) => string | boolean }[] = [
    { rotulo: "Treinos", valor: (p) => (p.ilimitado ? "Livre" : rotuloFrequencia(p.frequencia)) },
    { rotulo: "Fidelidade", valor: (p) => (p.fidelidade_meses ? `${p.fidelidade_meses} meses` : "Sem fidelidade") },
    { rotulo: "Licença", valor: (p) => (p.licenca_dias ? `${p.licenca_dias} dias` : false) },
    { rotulo: "Avaliação funcional", valor: (p) => (p.avaliacoes_funcionais ? `${p.avaliacoes_funcionais} no ano` : false) },
    { rotulo: "Reposição de aulas", valor: (p) => (p.reposicao_saldo_pct ? `${p.reposicao_saldo_pct}%` : false) },
    { rotulo: "Fixar horário", valor: (p) => p.permite_fixar_horario },
    { rotulo: "Bota de compressão", valor: (p) => (p.bota_compressao_mes ? `${p.bota_compressao_mes} por mês` : false) },
    { rotulo: "Clube FORTEM", valor: (p) => (p.nivel_clube ? `Nível ${p.nivel_clube}` : false) },
  ];
  return (
    <div className="overflow-x-auto -mx-4 px-4">
      <table className="w-full min-w-[520px] border-collapse text-sm">
        <thead>
          <tr>
            <th className="text-left p-3 border-b border-border font-normal text-muted-foreground" />
            {FAMILIAS.map((f, i) => (
              <th key={f} className={cn("p-3 border-b-2 text-center", familia === f ? "border-primary" : "border-border")}>
                <button type="button" disabled={!itens[i]} onClick={() => onEscolher(f)} className="font-display text-lg font-black uppercase disabled:opacity-40">
                  {NOME_FAMILIA[f]}
                </button>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {linhas.map((l) => (
            <tr key={l.rotulo} className="border-b border-border">
              <td className="p-3 text-muted-foreground">{l.rotulo}</td>
              {itens.map((p, i) => {
                const v = p ? l.valor(p) : "Indisponível";
                return (
                  <td key={i} className={cn("p-3 text-center", familia === FAMILIAS[i] && "bg-primary/5")}>
                    {v === true ? <Check className="mx-auto h-4 w-4 text-primary" aria-label="Incluso" /> :
                      v === false ? <Minus className="mx-auto h-4 w-4 text-muted-foreground" aria-label="Não incluso" /> :
                      <span className="capitalize-first">{v}</span>}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Resumo({ familia, freq, item, resumo, servicos, corrida, corridaValor }: {
  familia: Familia2027; freq: Frequencia2027; item?: PlanoPublico; resumo: ReturnType<typeof calcularResumo> | null;
  servicos: ServicoPublico[]; corrida: boolean; corridaValor: number | null;
}) {
  return (
    <aside className="border border-border bg-card p-5 h-fit lg:sticky lg:top-6">
      <p className="text-xs uppercase tracking-[0.2em] text-primary">Resumo</p>
      <p className="mt-1 font-display text-2xl font-black uppercase">{NOME_FAMILIA[familia]} · {freq === "livre" ? "Livre" : freq}</p>
      {!item || !resumo ? (
        <p className="mt-4 text-sm text-muted-foreground">Combinação indisponível. Revise sua escolha.</p>
      ) : (
        <dl className="mt-4 space-y-3 text-sm">
          <div className="flex justify-between gap-4"><dt className="text-muted-foreground">Plano</dt><dd>{brl(resumo.totalPlano)}</dd></div>
          <div className="text-xs text-muted-foreground -mt-2">{descreverParcelas(resumo.plano.parcelas)}{item.familia === "start_2027" ? " por mês, renovação mensal" : ""}</div>
          {servicos.map((s) => (
            <div key={s.codigo} className="flex justify-between gap-4"><dt className="text-muted-foreground">{s.nome.replace(/\s*\(2027\)\s*/, "")}</dt><dd>{brl(Number(s.valor))}</dd></div>
          ))}
          {resumo.servicosAvulsos && (
            <div className="text-xs text-muted-foreground -mt-2">Acompanhamento à parte: {descreverParcelas(resumo.servicosAvulsos.parcelas)}</div>
          )}
          {servicos.length > 0 && !resumo.servicosAvulsos && <div className="text-xs text-muted-foreground -mt-2">Acompanhamento incluído nas parcelas do plano</div>}
          <div className="flex justify-between gap-4 border-t border-border pt-3 font-display text-lg font-bold">
            <dt>Total</dt><dd>{brl(resumo.totalGeral)}</dd>
          </div>
          {corrida && corridaValor !== null && (
            <p className="text-xs text-muted-foreground">Grupo de corrida: {brl(corridaValor)} por mês, à parte.</p>
          )}
        </dl>
      )}
    </aside>
  );
}
