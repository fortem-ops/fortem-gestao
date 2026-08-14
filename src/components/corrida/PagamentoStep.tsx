import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, CheckCircle2, CreditCard, Loader2, ShieldCheck } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";

/* ------------------------------------------------------------------ */

export interface DadosPessoaisPagamento {
  nome: string;
  sobrenome: string;
  email: string;
  cpf: string;
  telefone: string;
  data_nascimento: string;
}

export interface PedidoCriado {
  aluno_id: string;
  contrato_id: string | null;
  venda_id: string;
  cartao_token: string;
  contratos_documentos_ids: string[];
  contratos_documentos: { id: string; nome: string; conteudo_gerado: string }[];
}

interface Props {
  payloadPedido: Record<string, unknown>;
  dadosIniciais: DadosPessoaisPagamento;
  inscricaoId?: string | null;
  /** Quando informado, o wizard assume o pós-pagamento (etapa de inscrição na prova). */
  onSucesso?: (protocolo: string) => void;
  totalHoje: number;
  resumoLinhas: { label: string; valor: number }[];
  onVoltar: () => void;
  pedido: PedidoCriado | null;
  setPedido: (p: PedidoCriado | null) => void;
}

type Fase = "dados" | "cartao" | "contrato" | "confirmando" | "cobrando" | "sucesso" | "erro";

const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const Card = ({ children, className = "" }: { children: React.ReactNode; className?: string }) => (
  <div className={`bg-card border border-border rounded-2xl p-5 shadow-card ${className}`}>{children}</div>
);

const Field = ({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
  inputMode,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
  inputMode?: "text" | "numeric";
}) => (
  <label className="block">
    <span className="block text-sm font-medium mb-1">{label}</span>
    <input
      type={type}
      value={value}
      inputMode={inputMode}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      className="w-full rounded-xl border border-border bg-background px-3 py-2 outline-none focus:border-primary"
    />
  </label>
);

const maskCard = (v: string) =>
  v.replace(/\D/g, "").slice(0, 19).replace(/(\d{4})(?=\d)/g, "$1 ").trim();

const maskValidade = (v: string) => {
  const d = v.replace(/\D/g, "").slice(0, 6);
  return d.length <= 2 ? d : `${d.slice(0, 2)}/${d.slice(2)}`;
};

const MENSAGENS_ERRO: Record<string, string> = {
  muitas_tentativas: "Muitas tentativas em pouco tempo. Aguarde um minuto e tente novamente.",
  token_expirado: "Sua sessão de pagamento expirou. Recomece o pedido.",
  cartao_ainda_nao_cadastrado: "Não recebemos os dados do cartão. Tente cadastrar novamente.",
  cartao_ainda_nao_confirmado: "O cartão ainda não foi confirmado pela operadora. Tente novamente.",
  contrato_nao_aceito: "É preciso aceitar os documentos antes de pagar.",
  cartao_inativo_ou_invalido: "Cartão inválido ou inativo. Tente outro cartão.",
  falha_criptograma: "A operadora não autorizou o uso deste cartão. Tente outro cartão.",
};

const amigavel = (code?: string | null, fallback = "Não foi possível concluir. Tente novamente.") =>
  (code && MENSAGENS_ERRO[code]) || fallback;

/* ------------------------------------------------------------------ */

const PagamentoStep = ({
  payloadPedido,
  dadosIniciais,
  inscricaoId,
  onSucesso,
  totalHoje,
  resumoLinhas,
  onVoltar,
  pedido,
  setPedido,
}: Props) => {
  const rotaPedido = String(payloadPedido.rota ?? "");
  const periodoPedido = String(payloadPedido.periodo ?? "");
  const maxParcelas = rotaPedido === "prospect" ? 12 : 10;
  const parcelamentoDisponivel =
    rotaPedido !== "somente_provas" && !(rotaPedido === "prospect" && periodoPedido === "mensal");
  const [parcelasEscolhidas, setParcelasEscolhidas] = useState(maxParcelas);

  const [fase, setFase] = useState<Fase>("cartao");
  const [erro, setErro] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const dados = dadosIniciais;

  const [aceites, setAceites] = useState<Record<string, boolean>>({});
  const [cartao, setCartao] = useState({ holder: "", numero: "", validade: "", cvv: "" });
  const [resultado, setResultado] = useState<{ ok: boolean; mensagem: string; protocolo?: string } | null>(null);

  const criandoRef = useRef(false);
  const [tokenizationId, setTokenizationId] = useState<string | null>(null);
  const [aceiteFeito, setAceiteFeito] = useState(false);

  // chave de idempotência: criada uma única vez por sessão de checkout
  const idempotencyKey = useMemo(() => {
    const SK = "corrida_checkout_idempotency_key";
    try {
      const atual = sessionStorage.getItem(SK);
      if (atual) return atual;
      const nova = crypto.randomUUID();
      sessionStorage.setItem(SK, nova);
      return nova;
    } catch {
      return crypto.randomUUID();
    }
  }, []);



  /* ---------------- b) criar pedido (uma única vez) ---------------- */

  const criarPedido = useCallback(
    async (dp: DadosPessoaisPagamento, parcelasSel?: number): Promise<PedidoCriado | null> => {
      if (pedido) return pedido;
      if (criandoRef.current) return null;
      criandoRef.current = true;
      setErro(null);
      try {
        const { data, error } = await supabase.functions.invoke("corrida-criar-pedido", {
          body: {
            ...payloadPedido,
            inscricaoId: inscricaoId ?? null,
            parcelas: parcelamentoDisponivel ? (parcelasSel ?? parcelasEscolhidas) : 1,
            idempotency_key: idempotencyKey,

            dadosPessoais: {
              nome: dp.nome.trim(),
              sobrenome: dp.sobrenome.trim(),
              email: dp.email.trim(),
              cpf: dp.cpf.replace(/\D/g, ""),
              telefone: dp.telefone.trim(),
              data_nascimento: dp.data_nascimento,
            },
          },
        });
        if (error || !data?.ok) throw new Error("falha_criar_pedido");
        const novo: PedidoCriado = {
          aluno_id: data.aluno_id,
          contrato_id: data.contrato_id ?? null,
          venda_id: data.venda_id,
          cartao_token: data.cartao_token,
          contratos_documentos_ids: data.contratos_documentos_ids ?? [],
          contratos_documentos: data.contratos_documentos ?? [],
        };
        setPedido(novo);
        return novo;
      } catch {
        setErro("Não conseguimos gerar o seu pedido agora. Confira os dados e tente novamente.");
        return null;
      } finally {
        criandoRef.current = false;
      }
    },
    [payloadPedido, pedido, setPedido, idempotencyKey, parcelamentoDisponivel, parcelasEscolhidas, inscricaoId],
  );


  const documentos = pedido?.contratos_documentos ?? [];
  const todosAceitos = documentos.length > 0 && documentos.every((d) => aceites[d.id]);

  /* ---------------- c) aceitar contrato ---------------- */

  const aceitarContrato = async () => {
    if (!pedido || loading) return;
    setLoading(true);
    setErro(null);
    try {
      const { data, error } = await supabase.functions.invoke("corrida-aceitar-contrato", {
        body: {
          contratos_documentos_ids: pedido.contratos_documentos_ids,
          formato_aceite: "checkout_corrida",
        },
      });
      if (error || !data?.ok) throw new Error(data?.error ?? "falha");
      setAceiteFeito(true);
      if (tokenizationId) {
        setFase("confirmando");
        void aguardarConfirmacao(tokenizationId, pedido);
      } else {
        setFase("cartao");
      }
    } catch (e) {
      setErro(amigavel((e as Error)?.message, "Não conseguimos registrar o seu aceite. Tente novamente."));
    } finally {
      setLoading(false);
    }
  };

  /* ---------------- d/e/f) cartão → confirmação → cobrança ---------------- */

  const cartaoValido =
    cartao.holder.trim().length > 2 &&
    cartao.numero.replace(/\D/g, "").length >= 13 &&
    /^\d{2}\/\d{2,4}$/.test(cartao.validade) &&
    cartao.cvv.replace(/\D/g, "").length >= 3;

  const cobrar = async (p: PedidoCriado) => {
    setFase("cobrando");
    try {
      const { data, error } = await supabase.functions.invoke("corrida-cobrar-pedido", {
        body: { cartao_token: p.cartao_token, venda_id: p.venda_id, contrato_id: p.contrato_id },
      });
      if (error) throw new Error("rede");
      if (data?.success) {
        setResultado({ ok: true, mensagem: "Pagamento confirmado!", protocolo: p.venda_id });
        setFase("sucesso");
        try {
          if (typeof window.gtag === "function") {
            window.gtag("event", "conversion", {
              send_to: "AW-797888979/pcbICLnAjakZENOju_wC",
              value: totalHoje,
              currency: "BRL",
              transaction_id: String(p.venda_id),
            });
          }
        } catch {
          /* silencia falhas do gtag para não quebrar o fluxo */
        }
        return;
      }
      const msg =
        data?.return_message ||
        amigavel(data?.error, "Cartão recusado pela operadora. Tente outro cartão.");
      setResultado({ ok: false, mensagem: msg });
      setFase("erro");
    } catch {
      setResultado({
        ok: false,
        mensagem: "Falha de comunicação ao processar o pagamento. Tente novamente.",
      });
      setFase("erro");
    }
  };

  const aguardarConfirmacao = async (tokId: string, p: PedidoCriado) => {
    const limite = Date.now() + 90_000;
    while (Date.now() < limite) {
      await new Promise((r) => setTimeout(r, 3000));
      try {
        const { data } = await supabase.functions.invoke("corrida-status-tokenizacao", {
          body: { tokenization_id: tokId },
        });
        const status = String(data?.status ?? "").toLowerCase();
        if (status === "active" && data?.cartao_salvo_id) {
          await cobrar(p);
          return;
        }
        if (status === "failed" || status === "denied") {
          setResultado({ ok: false, mensagem: "O cartão não foi validado pela operadora. Tente outro cartão." });
          setFase("erro");
          return;
        }
      } catch {
        /* segue tentando até o limite */
      }
    }
    setResultado({
      ok: false,
      mensagem: "A confirmação do cartão demorou mais que o esperado. Tente novamente ou use outro cartão.",
    });
    setFase("erro");
  };

  /** Tela combinada: cria o pedido (com o parcelamento escolhido) e, em seguida,
   *  envia o cartão para tokenização. O pedido só é criado uma vez (idempotência). */
  const confirmarCartaoEParcelas = async () => {
    if (loading || !cartaoValido) return;
    setLoading(true);
    setErro(null);
    try {
      const p = pedido ?? (await criarPedido(dados, parcelasEscolhidas));
      if (!p) return; // erro já sinalizado por criarPedido

      const [mm, yy] = cartao.validade.split("/");
      const { data, error } = await supabase.functions.invoke("rede-salvar-cartao", {
        body: {
          token: p.cartao_token,
          card_number: cartao.numero.replace(/\D/g, ""),
          card_holder: cartao.holder.trim(),
          expiration_month: mm,
          expiration_year: yy,
          security_code: cartao.cvv.replace(/\D/g, ""),
          origem: "link_cadastro",
        },
      });
      if (error || !data?.success || !data?.tokenization_id) {
        throw new Error(data?.error ?? "Não foi possível validar o cartão. Confira os dados e tente novamente.");
      }
      const tokId = String(data.tokenization_id);
      setTokenizationId(tokId);

      const precisaAceite = !aceiteFeito && !!p.contrato_id && (p.contratos_documentos?.length ?? 0) > 0;
      if (precisaAceite) {
        setFase("contrato");
      } else {
        setFase("confirmando");
        void aguardarConfirmacao(tokId, p);
      }
    } catch (e) {
      setErro(amigavel((e as Error)?.message, (e as Error)?.message || "Não foi possível validar o cartão."));
    } finally {
      setLoading(false);
    }
  };

  const nomeExibicao = useMemo(
    () => [dados.nome, dados.sobrenome].filter(Boolean).join(" ").trim(),
    [dados.nome, dados.sobrenome],
  );


  /* ---------------- render ---------------- */

  const sucesso = fase === "sucesso" && !!resultado?.ok;

  useEffect(() => {
    if (sucesso && onSucesso && resultado?.protocolo) onSucesso(resultado.protocolo);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sucesso]);

  if (sucesso) {
    if (onSucesso) {
      return (
        <Card className="text-center py-10">
          <Loader2 className="w-10 h-10 animate-spin text-primary mx-auto mb-4" />
          <p className="font-display text-lg font-bold">Pagamento confirmado! Seguindo...</p>
        </Card>
      );
    }
    return (
      <Card className="text-center py-10">
        <CheckCircle2 className="w-14 h-14 text-primary mx-auto mb-4" />
        <h3 className="font-display text-2xl font-bold mb-2">Pagamento confirmado!</h3>
        <p className="text-sm text-muted-foreground mb-4">Protocolo: {resultado?.protocolo}</p>
        <ul className="text-sm text-left max-w-md mx-auto divide-y divide-border">
          {resumoLinhas.map((l, i) => (
            <li key={i} className="py-2 flex justify-between gap-4">
              <span>{l.label}</span>
              <span className="font-semibold whitespace-nowrap">{l.valor === 0 ? "Grátis" : brl(l.valor)}</span>
            </li>
          ))}
        </ul>
        <p className="text-muted-foreground mt-5">Enviaremos os próximos passos por e-mail e WhatsApp.</p>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* a) dados pessoais (já coletados na etapa Dados Cadastrais) */}
      <Card className="flex items-center gap-3">
        <ShieldCheck className="w-5 h-5 text-primary shrink-0" />
        <p className="text-sm">
          Pagamento em nome de: <strong>{nomeExibicao}</strong>
        </p>
      </Card>



      {/* c) contratos */}
      {pedido && fase === "contrato" && documentos.length > 0 && (
        <Card>
          <h3 className="font-display text-xl font-bold mb-4">Revise e aceite os documentos</h3>
          <div className="space-y-5">
            {documentos.map((d) => (
              <div key={d.id}>
                <p className="font-semibold mb-2">{d.nome}</p>
                <div
                  className="max-h-64 overflow-y-auto rounded-xl border border-border bg-secondary/40 p-4 text-sm prose prose-sm max-w-none"
                  dangerouslySetInnerHTML={{ __html: d.conteudo_gerado }}
                />
                <label className="flex items-start gap-3 mt-3 text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    checked={!!aceites[d.id]}
                    onChange={(e) => setAceites({ ...aceites, [d.id]: e.target.checked })}
                    className="mt-1"
                  />
                  <span>Li e aceito o {d.nome}.</span>
                </label>
              </div>
            ))}
          </div>
          <button
            onClick={aceitarContrato}
            disabled={!todosAceitos || loading}
            className="mt-5 w-full bg-primary text-primary-foreground py-3 rounded-xl font-display font-semibold flex items-center justify-center gap-2 disabled:opacity-60"
          >
            {loading && <Loader2 className="w-4 h-4 animate-spin" />} Aceitar e continuar
          </button>
        </Card>
      )}

      {/* b) cartão + parcelamento (mesma tela) */}
      {fase === "cartao" && (
        <Card>
          <h3 className="font-display text-xl font-bold mb-1 flex items-center gap-2">
            <CreditCard className="w-5 h-5" /> Pagamento
          </h3>
          <p className="text-sm text-muted-foreground mb-4">Total de hoje: {brl(totalHoje)}</p>
          <div className="grid gap-3">
            <Field
              label="Nome impresso no cartão"
              value={cartao.holder}
              onChange={(v) => setCartao({ ...cartao, holder: v.toUpperCase() })}
            />
            <Field
              label="Número do cartão"
              value={cartao.numero}
              inputMode="numeric"
              placeholder="0000 0000 0000 0000"
              onChange={(v) => setCartao({ ...cartao, numero: maskCard(v) })}
            />
            <div className="grid grid-cols-2 gap-3">
              <Field
                label="Validade (MM/AA)"
                value={cartao.validade}
                inputMode="numeric"
                placeholder="12/29"
                onChange={(v) => setCartao({ ...cartao, validade: maskValidade(v) })}
              />
              <Field
                label="CVV"
                value={cartao.cvv}
                inputMode="numeric"
                placeholder="123"
                onChange={(v) => setCartao({ ...cartao, cvv: v.replace(/\D/g, "").slice(0, 4) })}
              />
            </div>

            {parcelamentoDisponivel && (
              <label className="block">
                <span className="block text-sm font-medium mb-1">Número de parcelas</span>
                <select
                  id="parcelas-pagamento"
                  value={parcelasEscolhidas}
                  onChange={(e) => setParcelasEscolhidas(Number(e.target.value))}
                  disabled={!!pedido}
                  className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm disabled:opacity-60"
                >
                  {Array.from({ length: maxParcelas }, (_, i) => i + 1).map((n) => (
                    <option key={n} value={n}>
                      {n}x de {brl(totalHoje / n)}
                    </option>
                  ))}
                </select>
              </label>
            )}
          </div>
          <button
            onClick={confirmarCartaoEParcelas}
            disabled={!cartaoValido || loading}
            className="mt-5 w-full bg-primary text-primary-foreground py-4 rounded-xl font-display font-semibold text-lg glow-red flex items-center justify-center gap-2 disabled:opacity-60"
          >
            {loading && <Loader2 className="w-5 h-5 animate-spin" />} Continuar
          </button>
        </Card>
      )}


      {/* e/f) processando */}
      {(fase === "confirmando" || fase === "cobrando") && (
        <Card className="text-center py-10">
          <Loader2 className="w-10 h-10 animate-spin text-primary mx-auto mb-4" />
          <p className="font-display text-lg font-bold">
            {fase === "confirmando" ? "Confirmando seu cartão..." : "Processando o pagamento..."}
          </p>
          <p className="text-sm text-muted-foreground mt-1">Isso pode levar alguns segundos. Não feche esta página.</p>
        </Card>
      )}

      {/* g) erro */}
      {fase === "erro" && (
        <Card className="text-center py-8">
          <h3 className="font-display text-xl font-bold mb-2">Pagamento não concluído</h3>
          <p className="text-sm text-muted-foreground mb-5">{resultado?.mensagem}</p>
          <button
            onClick={() => {
              setResultado(null);
              setCartao({ holder: "", numero: "", validade: "", cvv: "" });
              setFase("cartao");
            }}
            className="bg-primary text-primary-foreground px-8 py-3 rounded-xl font-display font-semibold"
          >
            Tentar com outro cartão
          </button>
        </Card>
      )}

      {erro && <div className="rounded-xl border border-primary/40 bg-primary/5 p-4 text-sm">{erro}</div>}

      {fase !== "confirmando" && fase !== "cobrando" && (
        <div className="pt-2">
          <button
            onClick={onVoltar}
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="w-4 h-4" /> Voltar
          </button>
        </div>
      )}
    </div>
  );
};

export default PagamentoStep;
