import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, Check, ArrowLeft, Gift, Shirt } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

/* ------------------------------------------------------------------ */
/* Tipos                                                               */
/* ------------------------------------------------------------------ */

type Rota = "aluno" | "somente_corrida" | "prospect" | "somente_provas";
type Tier = "start" | "start_plus" | "power" | "pro" | "max";
type Distancia = "5K" | "10K" | "21K" | "42K";

interface PlanoCatalogo {
  nome: string;
  periodo_meses: number;
  valor: number;
}

interface CampanhaItem {
  id: string;
  tipo: string;
  rota: string | null;
  tier: string | null;
  nivel: string | null;
  prova_nome: string | null;
  distancia: string | null;
  descricao: string | null;
  valor: number;
  isento: boolean;
  condicao: string | null;
  imagem_url?: string | null;
}

const AVAL_VALOR_CHEIO = 250;

const TIER_NOME: Record<Tier, string> = {
  start: "Corrida - Start",
  start_plus: "Corrida - Start+",
  power: "Corrida - Power",
  pro: "Corrida - Pro",
  max: "Corrida - Max",
};

const TIER_LABEL: Record<Tier, string> = {
  start: "Start",
  start_plus: "Start+",
  power: "Power",
  pro: "Pro",
  max: "Max",
};

const DISTANCIAS: Distancia[] = ["5K", "10K", "21K", "42K"];

/* Datas oficiais das provas (fixas no componente) */
const PROVA_LABEL: Record<"NB" | "MIPOA", string> = {
  NB: "NB 42k 2027",
  MIPOA: "42ª Maratona Internacional de Porto Alegre 2027",
};

const PROVA_DATAS: Record<"NB" | "MIPOA", { curtas: string; maratona: string }> = {
  NB: { curtas: "21 de agosto de 2027", maratona: "22 de agosto de 2027" },
  MIPOA: { curtas: "5 de junho de 2027", maratona: "6 de junho de 2027" },
};

const dataProva = (prova: "NB" | "MIPOA", distancia: Distancia) =>
  distancia === "42K" ? PROVA_DATAS[prova].maratona : PROVA_DATAS[prova].curtas;

const brl = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const maskCpf = (v: string) =>
  v
    .replace(/\D/g, "")
    .slice(0, 11)
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/(\d{3})\.(\d{3})\.(\d{3})(\d)/, "$1.$2.$3-$4");

/* ------------------------------------------------------------------ */
/* UI helpers                                                          */
/* ------------------------------------------------------------------ */

const Card = ({ children, className = "" }: { children: React.ReactNode; className?: string }) => (
  <div className={`bg-card border border-border rounded-2xl p-5 shadow-card ${className}`}>{children}</div>
);

const Toggle = ({
  active,
  onClick,
  title,
  subtitle,
  price,
  priceNode,
  leading,
  disabled,
}: {
  active: boolean;
  onClick: () => void;
  title: string;
  subtitle?: string;
  price?: string;
  priceNode?: React.ReactNode;
  leading?: React.ReactNode;
  disabled?: boolean;
}) => (
  <button
    type="button"
    disabled={disabled}
    onClick={onClick}
    className={`w-full text-left flex items-center gap-3 rounded-xl border p-4 transition-all ${
      active ? "border-primary bg-primary/5" : "border-border hover:border-primary/40"
    } ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
  >
    <span
      className={`shrink-0 w-5 h-5 rounded-md border flex items-center justify-center ${
        active ? "bg-primary border-primary text-primary-foreground" : "border-border"
      }`}
    >
      {active && <Check className="w-3.5 h-3.5" />}
    </span>
    {leading}
    <span className="flex-1">
      <span className="block font-semibold">{title}</span>
      {subtitle && <span className="block text-sm text-muted-foreground">{subtitle}</span>}
    </span>
    {priceNode
      ? priceNode
      : price && <span className="font-display font-bold whitespace-nowrap">{price}</span>}
  </button>
);

const KitThumb = ({ url }: { url?: string | null }) =>
  url ? (
    <img
      src={url}
      alt=""
      className="shrink-0 w-14 h-14 rounded-lg object-cover border border-border"
      loading="lazy"
    />
  ) : (
    <span className="shrink-0 w-14 h-14 rounded-lg bg-muted border border-border flex items-center justify-center text-muted-foreground">
      <Shirt className="w-6 h-6" />
    </span>
  );


const Pill = ({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) => (
  <button
    type="button"
    onClick={onClick}
    className={`px-4 py-2 rounded-full text-sm font-semibold border transition-all ${
      active
        ? "bg-primary text-primary-foreground border-primary"
        : "border-border text-foreground hover:border-primary/50"
    }`}
  >
    {children}
  </button>
);

/* ------------------------------------------------------------------ */
/* Componente                                                          */
/* ------------------------------------------------------------------ */

const CorridaConfigurator = () => {
  const [step, setStep] = useState<"identificacao" | "oferta" | "resumo">("identificacao");
  const [rota, setRota] = useState<Rota | null>(null);
  const [tier, setTier] = useState<Tier | null>(null);
  const [nome, setNome] = useState<string | null>(null);

  const [cpf, setCpf] = useState("");
  const [verificando, setVerificando] = useState(false);
  const [erroCpf, setErroCpf] = useState<string | null>(null);
  const [naoEncontrado, setNaoEncontrado] = useState(false);

  // seleções
  const [periodo, setPeriodo] = useState<"mensal" | "anual">("anual"); // prospect
  const [distanciaCortesia, setDistanciaCortesia] = useState<Distancia>("5K");
  const [kitNivel, setKitNivel] = useState<string | null>(null);
  const [mipoa, setMipoa] = useState(false);
  const [avaliacao, setAvaliacao] = useState(false);
  const [provaNome, setProvaNome] = useState<"NB" | "MIPOA">("NB");
  const [provaDistancia, setProvaDistancia] = useState<Distancia>("5K");

  const { data: planos = [], isLoading: loadingPlanos } = useQuery({
    queryKey: ["corrida-planos-catalogo"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("planos_catalogo")
        .select("nome, periodo_meses, valor")
        .eq("atividade", "corrida");
      if (error) throw error;
      return (data ?? []) as PlanoCatalogo[];
    },
  });

  const { data: itens = [], isLoading: loadingItens } = useQuery({
    queryKey: ["corrida-campanha-itens"],
    queryFn: async () => {
      const { data, error } = await supabase.from("corrida_campanha_itens").select("*");
      if (error) throw error;
      return (data ?? []) as CampanhaItem[];
    },
  });

  const carregando = loadingPlanos || loadingItens;

  const plano = (nomePlano: string, meses: number) =>
    planos.find((p) => p.nome === nomePlano && p.periodo_meses === meses);

  const resetSelecoes = () => {
    setKitNivel(null);
    setMipoa(false);
    setAvaliacao(false);
    setDistanciaCortesia("5K");
    setPeriodo("anual");
    setProvaNome("NB");
    setProvaDistancia("5K");
  };

  const irPara = (r: Rota, t: Tier | null = null, n: string | null = null) => {
    resetSelecoes();
    setRota(r);
    setTier(t);
    setNome(n);
    setStep("oferta");
  };

  /* --------------------------- Etapa 1 --------------------------- */

  const verificarCpf = async () => {
    setErroCpf(null);
    setNaoEncontrado(false);
    const digits = cpf.replace(/\D/g, "");
    if (digits.length !== 11) {
      setErroCpf("Informe um CPF válido com 11 dígitos.");
      return;
    }
    setVerificando(true);
    try {
      const { data, error } = await supabase.functions.invoke("corrida-lookup-cpf", {
        body: { cpf: digits },
      });
      if (error) throw error;
      if (data?.found) {
        irPara(data.rota === "aluno" ? "aluno" : "somente_corrida", data.tier ?? null, data.primeiro_nome ?? null);
      } else {
        setNaoEncontrado(true);
      }
    } catch {
      setErroCpf("Não conseguimos verificar seu CPF agora. Tente novamente em alguns minutos.");
    } finally {
      setVerificando(false);
    }
  };

  /* --------------------------- Dados da oferta --------------------------- */

  const oferta = useMemo(() => {
    if (!rota) return null;

    const cortesia = itens.find((i) => i.tipo === "cortesia_nb");
    const mipoaItem = itens.find((i) => i.tipo === "mipoa" && i.rota === "ambos");

    if (rota === "somente_provas") {
      const provaItem = itens.find(
        (i) => i.tipo === "prova_avulsa" && i.prova_nome === provaNome && i.distancia === provaDistancia,
      );
      const kits = itens
        .filter((i) => i.tipo === "kit_fortem" && i.rota === "somente_provas")
        .sort((a, b) => (a.nivel ?? "").localeCompare(b.nivel ?? ""));
      const aval = itens.find((i) => i.tipo === "avaliacao_funcional" && i.tier === "somente_provas");
      return { provaItem, kits, aval, cortesia: null, mipoaItem: null, planoAnual: null, planoMensal: null };
    }

    let nomePlano: string;
    let tierAval: string;
    let kitRota: string;

    if (rota === "aluno" && tier) {
      nomePlano = TIER_NOME[tier];
      tierAval = tier;
      kitRota = "aluno";
    } else if (rota === "somente_corrida") {
      nomePlano = "Corrida - Sem Plano";
      tierAval = "somente_corrida";
      kitRota = "aluno";
    } else {
      nomePlano = "Corrida - Prospect";
      tierAval = "prospect";
      kitRota = "prospect";
    }

    const kits = itens
      .filter((i) => i.tipo === "kit_fortem" && i.rota === kitRota)
      .sort((a, b) => (a.nivel ?? "").localeCompare(b.nivel ?? ""));
    const aval = itens.find((i) => i.tipo === "avaliacao_funcional" && i.tier === tierAval);

    return {
      planoAnual: plano(nomePlano, 12),
      planoMensal: plano(nomePlano, 1),
      kits,
      aval,
      cortesia,
      mipoaItem,
      provaItem: null,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rota, tier, itens, planos, provaNome, provaDistancia]);

  /* --------------------------- Resumo --------------------------- */

  const resumo = useMemo(() => {
    if (!oferta || !rota) return null;
    const linhas: { label: string; valor: number; nota?: string }[] = [];
    let hoje = 0;
    let recorrente = 0;

    if (rota === "somente_provas") {
      if (oferta.provaItem) {
        linhas.push({
          label: `${PROVA_LABEL[oferta.provaItem.prova_nome === "NB" ? "NB" : "MIPOA"]} — ${provaDistancia} · ${dataProva(oferta.provaItem.prova_nome === "NB" ? "NB" : "MIPOA", provaDistancia)}`,
          valor: Number(oferta.provaItem.valor),
        });
        hoje += Number(oferta.provaItem.valor);
      }
    } else {
      const anual = rota !== "prospect" || periodo === "anual";
      const p = anual ? oferta.planoAnual : oferta.planoMensal;
      if (p) {
        if (anual) {
          linhas.push({
            label: `${p.nome} — Plano Anual`,
            valor: Number(p.valor),
            nota: `equivale a ${brl(Number(p.valor) / 12)}/mês`,
          });
          hoje += Number(p.valor);
        } else {
          linhas.push({ label: `${p.nome} — Mensal`, valor: Number(p.valor), nota: "recorrência mensal no cartão" });
          hoje += Number(p.valor);
          recorrente = Number(p.valor);
        }
      }
      const cortesiaAtiva = oferta.cortesia && (rota !== "prospect" || periodo === "anual");
      if (cortesiaAtiva) {
        linhas.push({
          label: `Cortesia: ${oferta.cortesia!.descricao} — ${distanciaCortesia} · ${dataProva("NB", distanciaCortesia)}`,
          valor: 0,
        });
      }
    }

    if (kitNivel) {
      const kit = oferta.kits.find((k) => k.nivel === kitNivel);
      if (kit) {
        linhas.push({ label: `Kit Fortem — ${kit.descricao}`, valor: kit.isento ? 0 : Number(kit.valor) });
        if (!kit.isento) hoje += Number(kit.valor);
      }
    }
    if (mipoa && oferta.mipoaItem) {
      linhas.push({
        label: `+MIPOA 2027 — ${oferta.mipoaItem.descricao} · 5 e 6 de junho de 2027`,
        valor: Number(oferta.mipoaItem.valor),
      });
      hoje += Number(oferta.mipoaItem.valor);
    }
    if (avaliacao && oferta.aval) {
      linhas.push({ label: oferta.aval.descricao ?? "Avaliação Funcional", valor: Number(oferta.aval.valor) });
      hoje += Number(oferta.aval.valor);
    }

    return { linhas, hoje, recorrente };
  }, [oferta, rota, periodo, distanciaCortesia, kitNivel, mipoa, avaliacao, provaDistancia]);

  /* --------------------------- Render --------------------------- */

  const voltar = () => {
    if (step === "resumo") setStep("oferta");
    else {
      setStep("identificacao");
      setRota(null);
      setTier(null);
      setNome(null);
    }
  };

  const tituloRota = () => {
    switch (rota) {
      case "aluno":
        return `Você é aluno Fortem${tier ? ` — Plano ${TIER_LABEL[tier]}` : ""}`;
      case "somente_corrida":
        return "Assessoria de Corrida (sem plano de treino)";
      case "prospect":
        return "Assessoria de Corrida — Novo corredor";
      case "somente_provas":
        return "Inscrição avulsa em provas";
      default:
        return "";
    }
  };

  return (
    <section id="configurador" className="py-20 md:py-28 bg-secondary/60">
      <div className="container mx-auto px-6 max-w-3xl">
        <div className="text-center mb-10">
          <p className="text-primary font-display font-semibold tracking-[0.25em] uppercase text-xs mb-3">
            Monte sua oferta
          </p>
          <h2 className="font-display text-3xl md:text-4xl font-bold">
            Descubra seu plano de corrida
          </h2>
        </div>

        {carregando ? (
          <Card className="flex items-center justify-center gap-3 py-12 text-muted-foreground">
            <Loader2 className="w-5 h-5 animate-spin" /> Carregando ofertas...
          </Card>
        ) : step === "identificacao" ? (
          <Card>
            <label className="block text-sm font-semibold mb-2" htmlFor="cpf-corrida">
              Seu CPF
            </label>
            <div className="flex flex-col sm:flex-row gap-3">
              <input
                id="cpf-corrida"
                inputMode="numeric"
                value={cpf}
                onChange={(e) => setCpf(maskCpf(e.target.value))}
                placeholder="000.000.000-00"
                className="flex-1 rounded-xl border border-border bg-background px-4 py-3 outline-none focus:border-primary"
              />
              <button
                onClick={verificarCpf}
                disabled={verificando}
                className="bg-primary text-primary-foreground px-6 py-3 rounded-xl font-display font-semibold disabled:opacity-60 flex items-center justify-center gap-2"
              >
                {verificando && <Loader2 className="w-4 h-4 animate-spin" />}
                Verificar CPF
              </button>
            </div>

            {erroCpf && <p className="mt-3 text-sm text-primary">{erroCpf}</p>}

            {naoEncontrado && (
              <div className="mt-4 rounded-xl bg-muted p-4">
                <p className="text-sm mb-3">CPF não encontrado na nossa base.</p>
                <button
                  onClick={() => irPara("prospect")}
                  className="text-sm font-semibold text-primary underline underline-offset-4"
                >
                  Continuar como visitante →
                </button>
              </div>
            )}

            <div className="mt-6 flex flex-col gap-2 text-sm">
              <button
                onClick={() => irPara("prospect")}
                className="text-left font-semibold text-primary hover:opacity-80"
              >
                Não sou aluno →
              </button>
              <button
                onClick={() => irPara("somente_provas")}
                className="text-left font-semibold text-primary hover:opacity-80"
              >
                Quero só me inscrever numa prova →
              </button>
            </div>
          </Card>
        ) : step === "oferta" && oferta ? (
          <div className="space-y-4">
            <button onClick={voltar} className="flex items-center gap-2 text-sm text-muted-foreground">
              <ArrowLeft className="w-4 h-4" /> Voltar
            </button>

            <Card>
              {nome && <p className="text-primary font-semibold mb-1">Olá, {nome}!</p>}
              <h3 className="font-display text-xl font-bold mb-4">{tituloRota()}</h3>

              {rota === "prospect" && (
                <div className="flex gap-2 mb-4">
                  <Pill active={periodo === "mensal"} onClick={() => setPeriodo("mensal")}>
                    Mensal
                  </Pill>
                  <Pill active={periodo === "anual"} onClick={() => setPeriodo("anual")}>
                    Anual
                  </Pill>
                </div>
              )}

              {rota === "somente_provas" ? (
                <div className="space-y-4">
                  <div>
                    <p className="text-sm font-semibold mb-2">Prova</p>
                    <div className="flex gap-2">
                      <Pill active={provaNome === "NB"} onClick={() => setProvaNome("NB")}>
                        NB 42k 2027
                      </Pill>
                      <Pill active={provaNome === "MIPOA"} onClick={() => setProvaNome("MIPOA")}>
                        MIPOA
                      </Pill>
                    </div>
                  </div>
                  <div>
                    <p className="text-sm font-semibold mb-2">Distância</p>
                    <div className="flex flex-wrap gap-2">
                      {DISTANCIAS.map((d) => (
                        <Pill key={d} active={provaDistancia === d} onClick={() => setProvaDistancia(d)}>
                          {d}
                        </Pill>
                      ))}
                    </div>
                  </div>
                  {oferta.provaItem && (
                    <div className="flex items-end gap-3 flex-wrap">
                      <p className="font-display text-3xl font-bold">{brl(Number(oferta.provaItem.valor))}</p>
                      <p className="text-sm text-muted-foreground pb-1">
                        {PROVA_LABEL[provaNome]} · {dataProva(provaNome, provaDistancia)}
                      </p>
                    </div>
                  )}
                  <p className="text-sm text-muted-foreground">
                    Pagamento via Pix ou crédito à vista — sem parcelamento.
                  </p>
                </div>
              ) : (
                <div>
                  {(() => {
                    const anual = rota !== "prospect" || periodo === "anual";
                    const p = anual ? oferta.planoAnual : oferta.planoMensal;
                    if (!p) return <p className="text-muted-foreground">Plano indisponível.</p>;
                    return (
                      <div>
                        <div className="flex items-end gap-3 flex-wrap">
                          <span className="font-display text-4xl font-bold">{brl(Number(p.valor))}</span>
                          {anual ? (
                            <>
                              <span className="text-muted-foreground">no plano anual</span>
                              {oferta.planoMensal && (
                                <span className="text-muted-foreground line-through">
                                  {brl(Number(oferta.planoMensal.valor))}/mês
                                </span>
                              )}
                            </>
                          ) : (
                            <span className="text-muted-foreground">/mês</span>
                          )}
                        </div>
                        {anual && (
                          <p className="text-sm text-muted-foreground mt-1">
                            equivale a {brl(Number(p.valor) / 12)}/mês
                            {rota === "prospect" && " · parcelável em até 10x"}
                          </p>
                        )}
                      </div>
                    );
                  })()}

                  {/* Cortesia NB */}
                  {rota === "prospect" && periodo === "mensal" ? (
                    <p className="mt-5 text-sm text-muted-foreground rounded-xl bg-muted p-4">
                      A cortesia de inscrição + kit da NB 42k 2027 é exclusiva do plano Anual.
                    </p>
                  ) : (
                    oferta.cortesia && (
                      <div className="mt-5 rounded-xl border border-primary/30 bg-primary/5 p-4">
                        <p className="flex items-center gap-2 font-semibold">
                          <Gift className="w-4 h-4 text-primary" /> Cortesia inclusa: {oferta.cortesia.descricao}
                        </p>
                        <p className="text-sm text-muted-foreground mt-2 mb-2">Escolha sua distância:</p>
                        <div className="flex flex-wrap items-center gap-2">
                          {DISTANCIAS.map((d) => (
                            <Pill key={d} active={distanciaCortesia === d} onClick={() => setDistanciaCortesia(d)}>
                              {d}
                            </Pill>
                          ))}
                          <span className="text-sm text-muted-foreground ml-1">
                            NB 42k 2027 · {dataProva("NB", distanciaCortesia)}
                          </span>
                        </div>
                      </div>
                    )
                  )}
                </div>
              )}
            </Card>

            {/* Upsells */}
            <Card>
              <h4 className="font-display font-bold mb-3">
                {rota === "somente_provas" ? "Adicione ao seu pedido" : "Turbine seu plano"}
              </h4>

              {oferta.kits.length > 0 && (
                <>
                  <p className="text-sm font-semibold mb-2">
                    Kit Fortem{" "}
                    {oferta.kits[0]?.isento && (
                      <span className="text-primary">— grátis, escolha o seu</span>
                    )}
                  </p>
                  <div className="space-y-2 mb-5">
                    {oferta.kits.map((k) => (
                      <Toggle
                        key={k.id}
                        active={kitNivel === k.nivel}
                        onClick={() => setKitNivel(kitNivel === k.nivel ? null : k.nivel)}
                        title={k.descricao ?? k.nivel ?? "Kit"}
                        leading={<KitThumb url={k.imagem_url} />}
                        price={k.isento ? "Grátis" : brl(Number(k.valor))}
                      />
                    ))}
                  </div>
                </>
              )}

              {oferta.mipoaItem && (
                <Toggle
                  active={mipoa}
                  onClick={() => setMipoa((v) => !v)}
                  title="+MIPOA 2027"
                  subtitle={oferta.mipoaItem.descricao ?? undefined}
                  price={brl(Number(oferta.mipoaItem.valor))}
                />
              )}

              {oferta.aval && (
                <div className="mt-2">
                  <Toggle
                    active={avaliacao}
                    onClick={() => setAvaliacao((v) => !v)}
                    title="Avaliação Funcional e de Força"
                    subtitle={
                      rota === "somente_provas"
                        ? "Leve o resultado para o seu treinador."
                        : oferta.aval.descricao ?? undefined
                    }
                    priceNode={
                      Number(oferta.aval.valor) < AVAL_VALOR_CHEIO ? (
                        <span className="text-right whitespace-nowrap">
                          <span className="block text-xs text-muted-foreground line-through">
                            De {brl(AVAL_VALOR_CHEIO)}
                          </span>
                          <span className="block font-display font-bold">
                            por {brl(Number(oferta.aval.valor))}
                          </span>
                        </span>
                      ) : (
                        <span className="font-display font-bold whitespace-nowrap">
                          {brl(Number(oferta.aval.valor))}
                        </span>
                      )
                    }
                  />
                </div>
              )}
            </Card>

            <button
              onClick={() => setStep("resumo")}
              className="w-full bg-primary text-primary-foreground py-4 rounded-xl font-display font-semibold text-lg glow-red"
            >
              Ver resumo
            </button>
          </div>
        ) : step === "resumo" && resumo ? (
          <div className="space-y-4">
            <button onClick={voltar} className="flex items-center gap-2 text-sm text-muted-foreground">
              <ArrowLeft className="w-4 h-4" /> Voltar
            </button>

            <Card>
              <h3 className="font-display text-xl font-bold mb-4">Resumo do seu pedido</h3>
              <ul className="divide-y divide-border">
                {resumo.linhas.map((l, i) => (
                  <li key={i} className="py-3 flex items-start justify-between gap-4">
                    <span>
                      <span className="block">{l.label}</span>
                      {l.nota && <span className="block text-xs text-muted-foreground">{l.nota}</span>}
                    </span>
                    <span className="font-semibold whitespace-nowrap">
                      {l.valor === 0 ? "Grátis" : brl(l.valor)}
                    </span>
                  </li>
                ))}
              </ul>

              <div className="mt-4 pt-4 border-t border-border space-y-1">
                <div className="flex justify-between font-display text-lg font-bold">
                  <span>{rota === "somente_provas" ? "Total" : "Cobrança de hoje"}</span>
                  <span>{brl(resumo.hoje)}</span>
                </div>
                {resumo.recorrente > 0 && (
                  <div className="flex justify-between text-sm text-muted-foreground">
                    <span>Depois</span>
                    <span>{brl(resumo.recorrente)}/mês</span>
                  </div>
                )}
                {rota === "somente_provas" && (
                  <p className="text-xs text-muted-foreground pt-2">
                    Pagamento via Pix ou crédito à vista — sem parcelamento.
                  </p>
                )}
              </div>
            </Card>

            <button
              onClick={() => toast("Em breve", { description: "A inscrição online será liberada em breve." })}
              className="w-full bg-primary text-primary-foreground py-4 rounded-xl font-display font-semibold text-lg glow-red"
            >
              Continuar para inscrição
            </button>
          </div>
        ) : null}
      </div>
    </section>
  );
};

export default CorridaConfigurator;
