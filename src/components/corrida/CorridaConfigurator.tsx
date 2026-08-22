import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2, Check, ArrowLeft, ArrowRight, Gift, Shirt } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import CorridaStepper, { type StepDef } from "./CorridaStepper";
import CaminhoSection from "./CaminhoSection";
import InscricaoProvaStep from "./InscricaoProvaStep";
import DadosCadastraisStep from "./DadosCadastraisStep";
import {
  inscricaoFormInicial,
  dadosCadastraisValidos,
  inscricaoProvaValida,
  type InscricaoForm,
  type ProvaPedido,
} from "./inscricaoForm";
import PagamentoStep, { type PedidoCriado } from "./PagamentoStep";
import {
  calcularResumoCorrida,
  dataProva,
  brl,
  nomePlanoExibicao,
  PROVA_LABEL,
  type Rota,
  type Tier,
  type Distancia,
  type ProvaKey,
  type PlanoCatalogo,
  type CampanhaItem,
} from "@/lib/corridaPreco";

/* ------------------------------------------------------------------ */
/* Tipos                                                               */
/* ------------------------------------------------------------------ */

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
  const [rota, setRota] = useState<Rota | null>(null);
  const [tier, setTier] = useState<Tier | null>(null);
  const [nome, setNome] = useState<string | null>(null);
  const [stepIdx, setStepIdx] = useState(0);

  // seleções
  const [periodo, setPeriodo] = useState<"mensal" | "anual">("anual"); // prospect

  const [distanciaCortesia, setDistanciaCortesia] = useState<Distancia>("5K");
  const [kitNivel, setKitNivel] = useState<string | null>(null);
  const [mipoa, setMipoa] = useState(false);
  const [distanciaMipoa, setDistanciaMipoa] = useState<Distancia>("5K");
  const [avaliacao, setAvaliacao] = useState(false);
  // somente_provas: seleção múltipla
  const [provasSel, setProvasSel] = useState<Record<ProvaKey, { ativo: boolean; distancia: Distancia }>>({
    NB: { ativo: true, distancia: "5K" },
    MIPOA: { ativo: false, distancia: "5K" },
  });

  // inscrição na prova
  const [alunoId] = useState<string | null>(null);
  const [form, setForm] = useState<InscricaoForm>(() => inscricaoFormInicial());
  const [enviando, setEnviando] = useState(false);
  const [protocolo, setProtocolo] = useState<string | null>(null);
  const [erroEnvio, setErroEnvio] = useState<string | null>(null);
  const [pedido, setPedido] = useState<PedidoCriado | null>(null);
  const [inscricaoId, setInscricaoId] = useState<string | null>(null);
  const [pagamentoOk, setPagamentoOk] = useState(false);
  const [inscricaoProvaOk, setInscricaoProvaOk] = useState(false);

  const escolherRota = (
    r: Rota,
    t: Tier | null = null,
    n: string | null = null,
    prefill?: Record<string, string | null> & { cpfDigits?: string | null },
  ) => {
    setRota(r);
    setTier(t);
    setNome(n);
    setKitNivel(null);
    setMipoa(false);
    setDistanciaMipoa("5K");
    setAvaliacao(false);
    setDistanciaCortesia("5K");
    setPeriodo("anual");
    
    setProvasSel({ NB: { ativo: true, distancia: "5K" }, MIPOA: { ativo: false, distancia: "5K" } });
    setProtocolo(null);
    setErroEnvio(null);
    setPedido(null);
    setInscricaoId(null);
    setPagamentoOk(false);
    setInscricaoProvaOk(false);
    setForm(
      inscricaoFormInicial({
        nome: prefill?.nome ?? null,
        sobrenome: prefill?.sobrenome ?? null,
        email: prefill?.email ?? null,
        telefone: prefill?.telefone ?? null,
        data_nascimento: prefill?.data_nascimento ?? null,
        cep: prefill?.cep ?? null,
        logradouro: prefill?.logradouro ?? null,
        numero: prefill?.numero ?? null,
        complemento: prefill?.complemento ?? null,
        bairro: prefill?.bairro ?? null,
        cidade: prefill?.cidade ?? null,
        uf: prefill?.uf ?? null,
        cpf: prefill?.cpfDigits ?? null,
      }),
    );
    setStepIdx(1);
    setTimeout(
      () => document.getElementById("configurador")?.scrollIntoView({ behavior: "smooth", block: "start" }),
      60,
    );
  };

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

  /* --------------------------- Provas do pedido --------------------------- */

  const provasPedido: ProvaPedido[] = useMemo(() => {
    if (!rota) return [];
    const lista: ProvaPedido[] = [];
    if (rota === "somente_provas") {
      (["NB", "MIPOA"] as ProvaKey[]).forEach((pk) => {
        if (provasSel[pk].ativo) lista.push({ prova: pk, distancia: provasSel[pk].distancia });
      });
      return lista;
    }
    const cortesiaAtiva = rota !== "prospect" || periodo === "anual";
    if (cortesiaAtiva) lista.push({ prova: "NB", distancia: distanciaCortesia });
    if (mipoa) lista.push({ prova: "MIPOA", distancia: distanciaMipoa });
    return lista;
  }, [rota, periodo, distanciaCortesia, mipoa, distanciaMipoa, provasSel]);

  /* --------------------------- Etapas --------------------------- */

  const steps: StepDef[] = useMemo(() => {
    const base: StepDef[] = [{ id: "identificacao", label: "Identificação" }];
    if (!rota) return base;
    base.push({ id: "oferta", label: "Oferta" });
    if (rota !== "somente_provas") base.push({ id: "provas", label: "Provas" });
    if (rota === "prospect" || rota === "somente_provas") base.push({ id: "matricula", label: "Matrícula" });
    base.push({ id: "servicos", label: "Serviços" });
    base.push({ id: "dados", label: "Dados" });
    base.push({ id: "resumo", label: "Resumo" });
    base.push({ id: "pagamento", label: "Pagamento" });
    if (provasPedido.length > 0) base.push({ id: "inscricao", label: "Inscrição" });
    return base;
  }, [rota, provasPedido]);

  const stepAtual = steps[Math.min(stepIdx, steps.length - 1)]?.id ?? "identificacao";

  const stepsSemIdentificacao = useMemo(() => steps.filter((s) => s.id !== "identificacao"), [steps]);
  const stepperCurrent = stepsSemIdentificacao.findIndex((s) => s.id === stepAtual);

  const irPara = (i: number) => {
    if (i === 0) {
      setRota(null);
      setTier(null);
      setNome(null);
    }
    setStepIdx(i);
    setTimeout(
      () => document.getElementById("configurador")?.scrollIntoView({ behavior: "smooth", block: "start" }),
      60,
    );
  };

  /* --------------------------- Dados da oferta --------------------------- */

  const oferta = useMemo(() => {
    if (!rota) return null;

    const cortesia = itens.find((i) => i.tipo === "cortesia_nb");
    const mipoaItem = itens.find((i) => i.tipo === "mipoa" && i.rota === "ambos");

    if (rota === "somente_provas") {
      const provaValor = (prova: ProvaKey, distancia: Distancia) =>
        itens.find(
          (i) => i.tipo === "prova_avulsa" && i.prova_nome === prova && i.distancia === distancia,
        );
      const kits = itens
        .filter((i) => i.tipo === "kit_fortem" && i.rota === "somente_provas")
        .sort((a, b) => (a.nivel ?? "").localeCompare(b.nivel ?? ""));
      const aval = itens.find((i) => i.tipo === "avaliacao_funcional" && i.tier === "somente_provas");
      return { provaValor, kits, aval, cortesia: null, mipoaItem: null, planoAnual: null, planoMensal: null };
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
      provaValor: null,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rota, tier, itens, planos]);

  const maxParcelas = rota === "prospect" ? 12 : 10;


  /* --------------------------- Resumo --------------------------- */

  const resumo = useMemo(
    () =>
      calcularResumoCorrida({
        oferta,
        rota,
        periodo,
        distanciaCortesia,
        kitNivel,
        mipoa,
        distanciaMipoa,
        avaliacao,
        provasSel,
        maxParcelas,
      }),
    [oferta, rota, periodo, distanciaCortesia, kitNivel, mipoa, distanciaMipoa, avaliacao, provasSel, maxParcelas],
  );

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

  /* --------------------------- Navegação --------------------------- */

  const Nav = ({ podeContinuar = true }: { podeContinuar?: boolean }) => (
    <div className="flex items-center justify-between gap-3 pt-2">
      <button
        onClick={() => irPara(stepIdx - 1)}
        className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="w-4 h-4" /> Voltar
      </button>
      <button
        onClick={() => irPara(stepIdx + 1)}
        disabled={!podeContinuar}
        className="bg-primary text-primary-foreground px-8 py-3 rounded-xl font-display font-semibold glow-red flex items-center gap-2 disabled:opacity-50"
      >
        Continuar <ArrowRight className="w-4 h-4" />
      </button>
    </div>
  );

  /* --------------------------- Etapas de conteúdo --------------------------- */

  const renderOferta = () => {
    if (!oferta) return null;

    if (rota === "somente_provas") {
      return (
        <Card>
          <h3 className="font-display text-xl font-bold mb-1">{tituloRota()}</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Escolha uma ou as duas provas — cada uma com a sua distância.
          </p>

          <div className="space-y-4">
            {(["NB", "MIPOA"] as ProvaKey[]).map((pk) => {
              const sel = provasSel[pk];
              const item = oferta.provaValor?.(pk, sel.distancia);
              return (
                <div
                  key={pk}
                  className={`rounded-xl border p-4 transition-all ${
                    sel.ativo ? "border-primary bg-primary/5" : "border-border"
                  }`}
                >
                  <Toggle
                    active={sel.ativo}
                    onClick={() =>
                      setProvasSel((s) => ({ ...s, [pk]: { ...s[pk], ativo: !s[pk].ativo } }))
                    }
                    title={PROVA_LABEL[pk]}
                    subtitle={dataProva(pk, sel.distancia)}
                    price={item ? brl(Number(item.valor)) : "—"}
                  />
                  {sel.ativo && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {DISTANCIAS.map((d) => (
                        <Pill
                          key={d}
                          active={sel.distancia === d}
                          onClick={() => setProvasSel((s) => ({ ...s, [pk]: { ...s[pk], distancia: d } }))}
                        >
                          {d}
                        </Pill>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <ul className="space-y-2 mt-5">
            {["Inscrição da prova", "Retiramos seu kit da prova", "Acesso à estrutura da Fortem no dia da prova"].map(
              (b) => (
                <li key={b} className="flex items-start gap-2 text-sm">
                  <Check className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                  <span>{b}</span>
                </li>
              ),
            )}
          </ul>
          <p className="text-sm text-muted-foreground mt-4">
            Pagamento via crédito à vista — sem parcelamento.
          </p>
        </Card>
      );
    }

    const anual = rota !== "prospect" || periodo === "anual";
    const p = anual ? oferta.planoAnual : oferta.planoMensal;

    return (
      <Card>
        {nome && <p className="text-primary font-semibold mb-1">Olá, {nome}!</p>}
        <h3 className="font-display text-xl font-bold mb-4">{tituloRota()}</h3>

        {rota === "prospect" && (
          <div className="flex gap-2 mb-4">
            <Pill active={periodo === "mensal"} onClick={() => setPeriodo("mensal")}>
              Mensal
            </Pill>
            <Pill
              active={periodo === "anual"}
              onClick={() => setPeriodo("anual")}
            >
              Anual
            </Pill>
          </div>
        )}

        {!p ? (
          <p className="text-muted-foreground">Plano indisponível.</p>
        ) : (
          <div>
            <div className="flex items-end gap-3 flex-wrap">
              <span className="font-display text-4xl font-bold">
                {brl(anual ? Number(p.valor) / 12 : Number(p.valor))}
              </span>
              <span className="text-muted-foreground">/mês</span>
              {anual && oferta.planoMensal && (
                <span className="text-muted-foreground line-through">
                  {brl(Number(oferta.planoMensal.valor))}/mês
                </span>
              )}
            </div>
            {anual && (
              <p className="text-sm text-muted-foreground mt-1">
                {brl(Number(p.valor))} no plano anual · em até {maxParcelas}x
              </p>
            )}
          </div>
        )}
      </Card>
    );
  };

  const renderProvas = () => {
    if (!oferta) return null;
    return (
      <Card>
        <h3 className="font-display text-xl font-bold mb-4">Suas provas</h3>

        {rota === "prospect" && periodo === "mensal" ? (
          <p className="text-sm text-muted-foreground rounded-xl bg-muted p-4">
            A cortesia de inscrição + kit da NB 42k 2027 é exclusiva do plano Anual.
          </p>
        ) : (
          oferta.cortesia && (
            <div className="rounded-xl border border-primary/30 bg-primary/5 p-4">
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

        {oferta.mipoaItem && (
          <div className="mt-4">
            <Toggle
              active={mipoa}
              onClick={() => setMipoa((v) => !v)}
              title="+MIPOA 2027"
              subtitle={`${oferta.mipoaItem.descricao ?? "42ª Maratona Internacional de Porto Alegre"} · ${dataProva("MIPOA", distanciaMipoa)}`}
              price={brl(Number(oferta.mipoaItem.valor))}
            />
            {mipoa && (
              <div className="mt-3 flex flex-wrap items-center gap-2">
                {DISTANCIAS.map((d) => (
                  <Pill key={d} active={distanciaMipoa === d} onClick={() => setDistanciaMipoa(d)}>
                    {d}
                  </Pill>
                ))}
                <span className="text-sm text-muted-foreground ml-1">
                  Preço único, independente da distância.
                </span>
              </div>
            )}
          </div>
        )}
      </Card>
    );
  };

  const renderMatricula = () => {
    if (!oferta) return null;
    return (
      <Card>
        <h3 className="font-display text-xl font-bold mb-1">Kit Fortem</h3>
        {oferta.kits.length === 0 ? (
          <p className="text-sm text-muted-foreground mt-2">Nenhum kit disponível para esta opção.</p>
        ) : (
          <>
            <p className="text-sm text-muted-foreground mb-4">
              {rota === "prospect"
                ? "Escolha o seu kit para continuar."
                : oferta.kits[0]?.isento
                  ? "Grátis — escolha o seu."
                  : "Escolha o seu kit."}
            </p>

            <div className="space-y-2">
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
              {rota !== "prospect" && (
                <Toggle
                  active={kitNivel === null}
                  onClick={() => setKitNivel(null)}
                  title="Não adicionar Kit Fortem"
                  subtitle="Seguir sem kit por enquanto."
                />
              )}

            </div>
          </>
        )}
      </Card>
    );
  };

  const renderServicos = () => {
    if (!oferta) return null;
    return (
      <Card>
        <h3 className="font-display text-xl font-bold mb-4">Serviços</h3>
        {oferta.aval ? (
          <div className="space-y-2">
            <Toggle
              active={avaliacao}
              onClick={() => setAvaliacao(true)}
              title="Avaliação Funcional e de Força"
              subtitle={`Análise de assimetria e risco de lesões. Avaliação quantitativa da mobilidade articular, flexibilidade muscular e níveis de força com dinamômetro.${
                rota === "somente_provas" ? " Leve o resultado para o seu treinador." : ""
              }`}
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
            <Toggle
              active={!avaliacao}
              onClick={() => setAvaliacao(false)}
              title="Não adicionar avaliação"
              subtitle="Seguir sem a avaliação por enquanto."
            />
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Nenhum serviço adicional disponível.</p>
        )}
      </Card>
    );
  };

  const exigeTermo = rota !== "somente_provas";

  const enviarDadosCadastrais = async () => {
    if (!rota || !resumo) return;
    if (inscricaoId) {
      irPara(stepIdx + 1);
      return;
    }
    setErroEnvio(null);
    setEnviando(true);
    try {
      const { data, error } = await supabase.functions.invoke("corrida-registrar-inscricao", {
        body: {
          rota,
          aluno_id: alunoId,
          nome: form.nome.trim(),
          sobrenome: form.sobrenome.trim(),
          email: form.email.trim(),
          cpf: form.cpf.replace(/\D/g, ""),
          data_nascimento: form.data_nascimento,
          telefone: form.telefone.trim(),
          cep: form.cep.replace(/\D/g, ""),
          logradouro: form.logradouro.trim(),
          numero: form.numero.trim(),
          complemento: form.complemento.trim() || null,
          bairro: form.bairro.trim(),
          cidade: form.cidade.trim(),
          uf: form.uf.trim().toUpperCase(),
          provas: provasPedido,
          pedido_resumo: {
            linhas: resumo.linhas,
            total_hoje: resumo.hoje,
            recorrente_mensal: resumo.recorrente,
          },
        },
      });
      if (error || !data?.ok) throw error ?? new Error("falha");
      setInscricaoId(String(data.inscricao_id));
      irPara(stepIdx + 1);
    } catch {
      setErroEnvio(
        "Não conseguimos registrar os seus dados agora. Confira o preenchimento e tente novamente em alguns minutos.",
      );
    } finally {
      setEnviando(false);
    }
  };

  const enviarInscricaoProva = async () => {
    if (!inscricaoId) return;
    setErroEnvio(null);
    setEnviando(true);
    try {
      const { data, error } = await supabase.functions.invoke("corrida-atualizar-inscricao-prova", {
        body: {
          inscricao_id: inscricaoId,
          ritmo_corrida: form.ritmo_corrida,
          local_nascimento: form.local_nascimento,
          participou_nb_2026: provasPedido.some((p) => p.prova === "NB") ? form.participou_nb_2026 : null,
          participou_mipoa_2026: provasPedido.some((p) => p.prova === "MIPOA")
            ? form.participou_mipoa_2026
            : null,
          marca_tenis: form.marca_tenis,
          como_soube: form.como_soube,
          camiseta_nb: provasPedido.some((p) => p.prova === "NB") ? form.camiseta_nb : null,
          camiseta_mipoa: provasPedido.some((p) => p.prova === "MIPOA") ? form.camiseta_mipoa : null,
          aceite_inscricao: form.aceite_inscricao,
          aceite_termo_aptidao: exigeTermo ? form.aceite_termo_aptidao : null,
        },
      });
      if (error || !data?.ok) throw error ?? new Error("falha");
      setProtocolo(String(data.protocolo));
      setInscricaoProvaOk(true);
      setTimeout(
        () => document.getElementById("configurador")?.scrollIntoView({ behavior: "smooth", block: "start" }),
        60,
      );
    } catch {
      setErroEnvio(
        "Não conseguimos concluir a sua inscrição na prova agora. Tente novamente em alguns minutos.",
      );
    } finally {
      setEnviando(false);
    }
  };

  const payloadPedido = useMemo(() => {
    const cortesiaAtiva = rota !== "somente_provas" && (rota !== "prospect" || periodo === "anual");
    return {
      rota,
      alunoId,
      tier,
      periodo,
      kitNivel,
      avaliacao,
      cortesiaNb: { ativo: cortesiaAtiva, distancia: distanciaCortesia },
      mipoa: { ativo: rota !== "somente_provas" && mipoa, distancia: distanciaMipoa },
      provasSel: provasPedido.map((p) => ({
        prova: p.prova,
        nome: PROVA_LABEL[p.prova],
        distancia: p.distancia,
      })),
      pedidoResumo: {
        linhas: resumo?.linhas ?? [],
        total: resumo?.hoje ?? 0,
        recorrente_mensal: resumo?.recorrente ?? 0,
      },
    } as Record<string, unknown>;
  }, [rota, alunoId, tier, periodo, kitNivel, avaliacao, distanciaCortesia, mipoa, distanciaMipoa, provasPedido, resumo]);

  const renderPagamento = () => {
    const temInscricao = provasPedido.length > 0;
    return (
      <PagamentoStep
        payloadPedido={payloadPedido}
        dadosIniciais={{
          nome: form.nome.trim(),
          sobrenome: form.sobrenome.trim(),
          email: form.email.trim(),
          cpf: form.cpf,
          telefone: form.telefone.trim(),
          data_nascimento: form.data_nascimento,
        }}
        inscricaoId={inscricaoId}
        onSucesso={
          temInscricao
            ? () => {
                setPagamentoOk(true);
                irPara(stepIdx + 1);
              }
            : undefined
        }
        totalHoje={resumo?.hoje ?? 0}
        resumoLinhas={resumo?.linhas ?? []}
        onVoltar={() => irPara(stepIdx - 1)}
        pedido={pedido}
        setPedido={setPedido}
      />
    );
  };

  const renderResumo = () => {
    if (!resumo) return null;



    return (
      <>
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
            {rota === "somente_provas" ? (
              <p className="text-xs text-muted-foreground pt-2">
                Pagamento via crédito à vista — sem parcelamento.
              </p>
            ) : (
              (rota !== "prospect" || periodo === "anual") && (
                <p className="text-xs text-muted-foreground pt-2">
                  Parcelável em até {maxParcelas}x — escolha o parcelamento na etapa de pagamento.
                </p>
              )
            )}
          </div>
        </Card>

        {erroEnvio && (
          <div className="rounded-xl border border-primary/40 bg-primary/5 p-4 text-sm">{erroEnvio}</div>
        )}

        <div className="flex items-center justify-between gap-3 pt-2">
          <button
            onClick={() => irPara(stepIdx - 1)}
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="w-4 h-4" /> Voltar
          </button>
        </div>

        <button
          onClick={() => irPara(stepIdx + 1)}
          className="w-full bg-primary text-primary-foreground py-4 rounded-xl font-display font-semibold text-lg glow-red flex items-center justify-center gap-2"
        >
          Continuar para o pagamento
        </button>
      </>
    );
  };

  /* --------------------------- Render --------------------------- */

  return (
    <section id="configurador" className="py-20 md:py-28 bg-secondary/60">
      <div className="container mx-auto px-6 max-w-3xl">

        {stepAtual !== "identificacao" && stepperCurrent >= 0 && (
          <div className="mb-8">
            <CorridaStepper steps={stepsSemIdentificacao} current={stepperCurrent} />
          </div>
        )}

        {stepAtual === "identificacao" ? (
          <CaminhoSection onSelect={escolherRota} />
        ) : carregando ? (
          <Card className="flex items-center justify-center gap-3 py-12 text-muted-foreground">
            <Loader2 className="w-5 h-5 animate-spin" /> Carregando ofertas...
          </Card>
        ) : (
          <div className="space-y-4">
            {stepAtual === "oferta" && (
              <>
                {renderOferta()}
                <Nav
                  podeContinuar={rota !== "somente_provas" || provasSel.NB.ativo || provasSel.MIPOA.ativo}
                />
              </>
            )}
            {stepAtual === "provas" && (
              <>
                {renderProvas()}
                <Nav />
              </>
            )}
            {stepAtual === "matricula" && (
              <>
                {renderMatricula()}
                <Nav
                  podeContinuar={
                    rota !== "prospect" || oferta?.kits.length === 0 || kitNivel !== null
                  }
                />

              </>
            )}
            {stepAtual === "servicos" && (
              <>
                {renderServicos()}
                <Nav />
              </>
            )}
            {stepAtual === "dados" && (
              <>
                <DadosCadastraisStep form={form} setForm={setForm} />
                {erroEnvio && (
                  <div className="rounded-xl border border-primary/40 bg-primary/5 p-4 text-sm">{erroEnvio}</div>
                )}
                <div className="flex items-center justify-between gap-3 pt-2">
                  <button
                    onClick={() => irPara(stepIdx - 1)}
                    className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
                  >
                    <ArrowLeft className="w-4 h-4" /> Voltar
                  </button>
                  <button
                    onClick={enviarDadosCadastrais}
                    disabled={enviando || !dadosCadastraisValidos(form)}
                    className="bg-primary text-primary-foreground px-8 py-3 rounded-xl font-display font-semibold glow-red flex items-center gap-2 disabled:opacity-50"
                  >
                    {enviando && <Loader2 className="w-4 h-4 animate-spin" />}
                    Continuar <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </>
            )}
            {stepAtual === "resumo" && renderResumo()}
            {stepAtual === "pagamento" && renderPagamento()}
            {stepAtual === "inscricao" &&
              (inscricaoProvaOk ? (
                <Card className="text-center py-10">
                  <Check className="w-14 h-14 text-primary mx-auto mb-4" />
                  <h3 className="font-display text-2xl font-bold mb-2">Tudo pronto!</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    Pagamento confirmado e inscrição enviada. Protocolo: {protocolo}
                  </p>
                  <p className="text-muted-foreground">
                    Enviaremos os próximos passos por e-mail e WhatsApp.
                  </p>
                </Card>
              ) : (
                <>
                  {pagamentoOk && (
                    <Card className="flex items-center gap-3">
                      <Check className="w-5 h-5 text-primary shrink-0" />
                      <p className="text-sm">
                        Pagamento confirmado! Falta só completar os dados da sua inscrição na prova.
                      </p>
                    </Card>
                  )}
                  <InscricaoProvaStep
                    form={form}
                    setForm={setForm}
                    provas={provasPedido}
                    exigeTermo={exigeTermo}
                  />
                  {erroEnvio && (
                    <div className="rounded-xl border border-primary/40 bg-primary/5 p-4 text-sm">{erroEnvio}</div>
                  )}
                  <button
                    onClick={enviarInscricaoProva}
                    disabled={enviando || !inscricaoProvaValida(form, provasPedido, exigeTermo)}
                    className="w-full bg-primary text-primary-foreground py-4 rounded-xl font-display font-semibold text-lg glow-red flex items-center justify-center gap-2 disabled:opacity-60"
                  >
                    {enviando && <Loader2 className="w-5 h-5 animate-spin" />}
                    Enviar inscrição
                  </button>
                </>
              ))}
          </div>
        )}
      </div>
    </section>
  );
};

export default CorridaConfigurator;
