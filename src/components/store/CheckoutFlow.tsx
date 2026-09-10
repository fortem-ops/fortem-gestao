import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { CheckCircle2, Copy, CreditCard, Loader2, Lock, QrCode } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { supabase } from "@/integrations/supabase/client";
import { formatBRL } from "@/integrations/store/types";
import { useCartLoja, type CartItem } from "@/hooks/useCartLoja";
import { toast } from "sonner";
import { useStoreTheme } from "@/hooks/useStoreTheme";

const IDEMPOTENCY_KEY = "fortem-loja-idempotency";
const PARCELAS = 1;

const onlyDigits = (v: string) => v.replace(/\D/g, "");

const maskCpf = (v: string) =>
  onlyDigits(v)
    .slice(0, 11)
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d{1,2})$/, "$1-$2");

const maskTelefone = (v: string) => {
  const d = onlyDigits(v).slice(0, 11);
  if (d.length <= 10) {
    return d.replace(/(\d{2})(\d)/, "($1) $2").replace(/(\d{4})(\d)/, "$1-$2");
  }
  return d.replace(/(\d{2})(\d)/, "($1) $2").replace(/(\d{5})(\d)/, "$1-$2");
};

const maskCartao = (v: string) =>
  onlyDigits(v).slice(0, 19).replace(/(\d{4})(?=\d)/g, "$1 ");

const maskValidade = (v: string) => {
  const d = onlyDigits(v).slice(0, 4);
  return d.length <= 2 ? d : `${d.slice(0, 2)}/${d.slice(2)}`;
};

const isValidCpf = (raw: string) => {
  const cpf = onlyDigits(raw);
  if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) return false;
  const calc = (len: number) => {
    let sum = 0;
    for (let i = 0; i < len; i++) sum += Number(cpf[i]) * (len + 1 - i);
    const rest = (sum * 10) % 11;
    return rest === 10 ? 0 : rest;
  };
  return calc(9) === Number(cpf[9]) && calc(10) === Number(cpf[10]);
};

const friendlyMessage = (raw?: string | null) => {
  const msg = (raw ?? "").toLowerCase();
  if (!msg) return "Não foi possível concluir o pagamento. Tente outro cartão.";
  if (msg.includes("chave_pix_nao_configurada") || msg.includes("falha_criar_cobranca_pix"))
    return "Não foi possível gerar o PIX agora. Tente novamente em instantes ou use cartão.";
  if (msg.includes("insufficient") || msg.includes("saldo") || msg.includes("limite"))
    return "Cartão sem limite disponível. Tente outro cartão.";
  if (msg.includes("expired") || msg.includes("vencid") || msg.includes("validade"))
    return "Cartão vencido. Confira a validade ou use outro cartão.";
  if (msg.includes("security") || msg.includes("cvv"))
    return "Código de segurança (CVV) inválido.";
  if (msg.includes("invalid") || msg.includes("inválid"))
    return "Dados do cartão inválidos. Confira e tente novamente.";
  if (msg.includes("denied") || msg.includes("negad") || msg.includes("recus"))
    return "Pagamento não autorizado pelo banco. Tente outro cartão.";
  if (msg.includes("timeout") || msg.includes("tempo"))
    return "O banco demorou para responder. Tente novamente.";
  return raw as string;
};

const getIdempotencyKey = () => {
  let key = sessionStorage.getItem(IDEMPOTENCY_KEY);
  if (!key) {
    key = crypto.randomUUID();
    sessionStorage.setItem(IDEMPOTENCY_KEY, key);
  }
  return key;
};

type Step = "dados" | "cartao" | "pix" | "sucesso";
type Metodo = "cartao" | "pix";

interface PixData {
  qr_code_base64: string | null;
  pix_copia_cola: string;
  expira_em: number;
}

interface Props {
  items: CartItem[];
  subtotal: number;
  onBackToCart: () => void;
}

const CheckoutFlow = ({ items, subtotal, onBackToCart }: Props) => {
  const { clear } = useCartLoja();
  const { theme, palette } = useStoreTheme();
  const separatorBg = theme === "dark" ? "bg-neutral-800" : "bg-neutral-200";
  const [step, setStep] = useState<Step>("dados");
  const [loading, setLoading] = useState(false);
  const [statusText, setStatusText] = useState("");
  const [erro, setErro] = useState<string | null>(null);

  const [pedidoId, setPedidoId] = useState<string | null>(null);
  const [pedidoNumero, setPedidoNumero] = useState<string | null>(null);
  const cartaoTokenRef = useRef<string | null>(null);
  const tokenizationIdRef = useRef<string | null>(null);
  const [metodo, setMetodo] = useState<Metodo | null>(null);
  const [pix, setPix] = useState<PixData | null>(null);
  const [segundosRestantes, setSegundosRestantes] = useState(0);

  const [dados, setDados] = useState({
    nome: "",
    sobrenome: "",
    email: "",
    cpf: "",
    telefone: "",
  });

  const [cartao, setCartao] = useState({
    numero: "",
    nomeImpresso: "",
    validade: "",
    cvv: "",
  });

  const dadosValidos = useMemo(
    () =>
      dados.nome.trim().length >= 2 &&
      dados.sobrenome.trim().length >= 2 &&
      /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(dados.email.trim()) &&
      isValidCpf(dados.cpf) &&
      onlyDigits(dados.telefone).length >= 10,
    [dados]
  );

  const cartaoValido = useMemo(() => {
    const num = onlyDigits(cartao.numero);
    const val = onlyDigits(cartao.validade);
    const mes = Number(val.slice(0, 2));
    return (
      num.length >= 13 &&
      cartao.nomeImpresso.trim().length >= 3 &&
      val.length === 4 &&
      mes >= 1 &&
      mes <= 12 &&
      onlyDigits(cartao.cvv).length >= 3
    );
  }, [cartao]);

  const garantirPedido = useCallback(async (): Promise<string | null> => {
    if (pedidoId) return pedidoId;
    setStatusText("Criando seu pedido...");
    {
      const { data, error } = await supabase.functions.invoke(
        "loja-criar-pedido",
        {

          body: {
            itens: items
              .filter((i) => i.varianteId)
              .map((i) => ({ variante_id: i.varianteId, quantidade: i.quantidade })),
            dadosPessoais: {
              nome: `${dados.nome.trim()} ${dados.sobrenome.trim()}`.trim(),
              cpf: onlyDigits(dados.cpf),
              telefone: onlyDigits(dados.telefone),
              email: dados.email.trim(),
            },
            parcelas: PARCELAS,
            idempotency_key: getIdempotencyKey(),
          },
        }
      );

      if (error) throw new Error(error.message);

      if (data?.ok === false) {
        if (data?.error === "estoque_insuficiente") {
          toast.error(
            "Um dos produtos esgotou enquanto você navegava. Revise seu carrinho."
          );
          onBackToCart();
          return null;
        }
        throw new Error(friendlyMessage(data?.error));
      }

      if (!data?.pedido_id) {
        throw new Error("Não foi possível criar o pedido. Tente novamente.");
      }

      setPedidoId(data.pedido_id);
      setPedidoNumero(data.pedido_id);
      cartaoTokenRef.current = data.cartao_token ?? null;
      return data.pedido_id as string;
    }
  }, [items, dados, onBackToCart, pedidoId]);

  const gerarPix = useCallback(
    async (id: string) => {
      setStatusText("Gerando o código PIX...");
      const { data, error } = await supabase.functions.invoke("loja-criar-pix", {
        body: { pedido_id: id },
      });
      if (error) throw new Error(error.message);
      if (data?.ja_pago === true) {
        sessionStorage.removeItem(IDEMPOTENCY_KEY);
        clear();
        setStep("sucesso");
        return;
      }
      if (data?.ok === false || !data?.pix_copia_cola) {
        throw new Error(friendlyMessage(data?.error));
      }
      setPix({
        qr_code_base64: data.qr_code_base64 ?? null,
        pix_copia_cola: data.pix_copia_cola,
        expira_em: Number(data.expira_em ?? 1800),
      });
      setSegundosRestantes(Number(data.expira_em ?? 1800));
      setStep("pix");
    },
    [clear]
  );

  const avancar = useCallback(async () => {
    setErro(null);
    setLoading(true);
    try {
      const id = await garantirPedido();
      if (!id) return;
      if (metodo === "pix") {
        await gerarPix(id);
      } else {
        setStep("cartao");
      }
    } catch (e) {
      setErro(friendlyMessage(e instanceof Error ? e.message : null));
    } finally {
      setLoading(false);
      setStatusText("");
    }
  }, [garantirPedido, gerarPix, metodo]);

  const regerarPix = useCallback(async () => {
    if (!pedidoId) return;
    setErro(null);
    setLoading(true);
    try {
      await gerarPix(pedidoId);
    } catch (e) {
      setErro(friendlyMessage(e instanceof Error ? e.message : null));
    } finally {
      setLoading(false);
      setStatusText("");
    }
  }, [gerarPix, pedidoId]);

  // Contador regressivo do QR
  useEffect(() => {
    if (step !== "pix" || segundosRestantes <= 0) return;
    const t = setInterval(() => setSegundosRestantes((s) => (s > 0 ? s - 1 : 0)), 1000);
    return () => clearInterval(t);
  }, [step, segundosRestantes]);

  // Polling do status do pedido
  useEffect(() => {
    if (step !== "pix" || !pedidoId) return;
    let ativo = true;
    const t = setInterval(async () => {
      const { data } = await supabase.functions.invoke("loja-status-pedido", {
        body: { pedido_id: pedidoId },
      });
      if (!ativo) return;
      if (data?.status === "pago") {
        clearInterval(t);
        sessionStorage.removeItem(IDEMPOTENCY_KEY);
        clear();
        setStep("sucesso");
      }
    }, 3000);
    return () => {
      ativo = false;
      clearInterval(t);
    };
  }, [step, pedidoId, clear]);


  const aguardarTokenizacao = useCallback(async (tokenizationId: string) => {
    for (let i = 0; i < 20; i++) {
      const { data, error } = await supabase.functions.invoke(
        "loja-status-tokenizacao",
        { body: { tokenization_id: tokenizationId } }
      );
      if (error) throw new Error(error.message);
      if (data?.status === "active") return true;
      if (data?.status === "failed" || data?.status === "error") {
        throw new Error(friendlyMessage(data?.return_message));
      }
      await new Promise((r) => setTimeout(r, 1500));
    }
    throw new Error("A confirmação do cartão demorou demais. Tente novamente.");
  }, []);

  const pagar = useCallback(async () => {
    if (!pedidoId) {
      setErro("Pedido não encontrado. Volte ao carrinho e tente novamente.");
      return;
    }
    setErro(null);
    setLoading(true);
    try {
      const token = cartaoTokenRef.current;
      if (!token) {
        throw new Error("Link do pedido não encontrado. Volte ao carrinho.");
      }
      const val = onlyDigits(cartao.validade);

      setStatusText("Protegendo os dados do seu cartão...");
      const { data: salvo, error: erroSalvar } =
        await supabase.functions.invoke("rede-salvar-cartao", {
          body: {
            token,
            card_number: onlyDigits(cartao.numero),
            card_holder: cartao.nomeImpresso.trim(),
            expiration_month: val.slice(0, 2),
            expiration_year: `20${val.slice(2, 4)}`,
            security_code: onlyDigits(cartao.cvv),
            origem: "link_cadastro",
          },
        });
      if (erroSalvar) throw new Error(erroSalvar.message);
      if (salvo?.success === false) {
        throw new Error(friendlyMessage(salvo?.return_message ?? salvo?.message));
      }

      const tokenizationId = salvo?.tokenization_id;
      if (!tokenizationId) {
        throw new Error("Não foi possível iniciar a tokenização do cartão.");
      }
      tokenizationIdRef.current = tokenizationId;

      setStatusText("Confirmando seu cartão com o banco...");
      await aguardarTokenizacao(tokenizationId);

      setStatusText("Processando o pagamento...");
      const { data: cobranca, error: erroCobranca } =
        await supabase.functions.invoke("loja-cobrar-pedido", {
          body: { cartao_token: token, pedido_id: pedidoId, parcelas: PARCELAS },
        });
      if (erroCobranca) throw new Error(erroCobranca.message);
      if (!cobranca?.success) {
        throw new Error(
          friendlyMessage(cobranca?.return_message ?? cobranca?.message)
        );
      }

      setPedidoNumero(
        cobranca?.pedido_numero ?? cobranca?.numero ?? pedidoNumero ?? pedidoId
      );
      sessionStorage.removeItem(IDEMPOTENCY_KEY);
      clear();
      setStep("sucesso");
    } catch (e) {
      setErro(friendlyMessage(e instanceof Error ? e.message : null));
    } finally {
      setLoading(false);
      setStatusText("");
    }
  }, [pedidoId, pedidoNumero, cartao, aguardarTokenizacao, clear]);

  if (step === "sucesso") {
    return (
      <Card className={`mt-5 rounded-2xl p-6 text-center ${palette.card}`}>
        <CheckCircle2 className="mx-auto h-12 w-12 text-primary" />
        <h2 className="mt-3 font-display text-xl font-black uppercase tracking-tight">
          Pagamento aprovado
        </h2>
        <p className={`mt-2 text-sm ${palette.muted}`}>
          Pedido{" "}
          <span className={`font-bold ${palette.text}`}>
            {pedidoNumero ?? "confirmado"}
          </span>
          . Você vai receber os detalhes por e-mail.
        </p>
        <Button asChild className="mt-5 w-full sm:w-auto">
          <Link to="/store">Voltar para a loja</Link>
        </Button>
      </Card>
    );
  }

  if (step === "pix" && pix) {
    const expirado = segundosRestantes <= 0;
    const mm = String(Math.floor(segundosRestantes / 60)).padStart(2, "0");
    const ss = String(segundosRestantes % 60).padStart(2, "0");
    const qrSrc = pix.qr_code_base64
      ? pix.qr_code_base64.startsWith("data:")
        ? pix.qr_code_base64
        : `data:image/png;base64,${pix.qr_code_base64}`
      : null;

    return (
      <Card className={`mt-5 rounded-2xl p-4 ${palette.card}`}>
        <div className="flex items-center justify-between">
          <p className="font-display text-sm font-bold uppercase tracking-wide">
            Pagamento com PIX
          </p>
          <span className={`flex items-center gap-1 text-xs ${palette.muted}`}>
            <Lock className="h-3.5 w-3.5" /> Ambiente seguro
          </span>
        </div>

        <Separator className={`my-4 ${separatorBg}`} />

        {expirado ? (
          <div className="text-center">
            <p className="text-sm font-semibold">O código PIX expirou. Gere um novo.</p>
            <Button className="mt-4 w-full" disabled={loading} onClick={regerarPix}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {statusText || "Gerando..."}
                </>
              ) : (
                "Gerar novo código PIX"
              )}
            </Button>
          </div>
        ) : (
          <>
            {qrSrc && (
              <img
                src={qrSrc}
                alt="QR Code para pagamento PIX"
                className="mx-auto w-full max-w-[260px] rounded-xl bg-white p-3"
              />
            )}

            <p className={`mt-4 text-center text-sm ${palette.muted}`}>
              Escaneie o QR code ou copie o código no app do seu banco. Assim que o
              pagamento for confirmado, a página atualiza automaticamente.
            </p>

            <div className="mt-4 grid gap-2">
              <Label htmlFor="pix-codigo">PIX Copia e Cola</Label>
              <Input
                id="pix-codigo"
                readOnly
                value={pix.pix_copia_cola}
                className={`${palette.input} text-xs`}
                onFocus={(e) => e.currentTarget.select()}
              />
              <Button
                size="lg"
                className="w-full"
                onClick={async () => {
                  await navigator.clipboard.writeText(pix.pix_copia_cola);
                  toast.success("Código copiado");
                }}
              >
                <Copy className="mr-2 h-4 w-4" />
                Copiar código
              </Button>
            </div>

            <p className={`mt-3 text-center text-xs ${palette.muted}`}>
              O código expira em {mm}:{ss}
            </p>

            <div className="mt-4 flex items-center justify-between">
              <span className={`text-sm ${palette.muted}`}>Total</span>
              <span className="font-display text-xl font-black">
                {formatBRL(subtotal)}
              </span>
            </div>
          </>
        )}

        {erro && (
          <p className="mt-3 rounded-xl bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {erro}
          </p>
        )}

        <Button
          variant="ghost"
          className={`mt-2 w-full ${palette.muted}`}
          onClick={() => setStep("dados")}
        >
          Voltar
        </Button>
      </Card>
    );
  }

  return (
    <Card className={`mt-5 rounded-2xl p-4 ${palette.card}`}>
      <div className="flex items-center justify-between">
        <p className="font-display text-sm font-bold uppercase tracking-wide">
          {step === "dados" ? "Seus dados" : "Pagamento com cartão"}
        </p>
        <span className={`flex items-center gap-1 text-xs ${palette.muted}`}>
          <Lock className="h-3.5 w-3.5" /> Ambiente seguro
        </span>
      </div>

      <Separator className={`my-4 ${separatorBg}`} />

      {step === "dados" ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="grid gap-1.5">
            <Label htmlFor="nome">Nome</Label>
            <Input
              id="nome"
              value={dados.nome}
              autoComplete="given-name"
              className={palette.input}
              onChange={(e) => setDados({ ...dados, nome: e.target.value })}
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="sobrenome">Sobrenome</Label>
            <Input
              id="sobrenome"
              value={dados.sobrenome}
              autoComplete="family-name"
              className={palette.input}
              onChange={(e) => setDados({ ...dados, sobrenome: e.target.value })}
            />
          </div>
          <div className="grid gap-1.5 sm:col-span-2">
            <Label htmlFor="email">E-mail</Label>
            <Input
              id="email"
              type="email"
              inputMode="email"
              value={dados.email}
              autoComplete="email"
              className={palette.input}
              onChange={(e) => setDados({ ...dados, email: e.target.value })}
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="cpf">CPF</Label>
            <Input
              id="cpf"
              inputMode="numeric"
              value={dados.cpf}
              className={palette.input}
              onChange={(e) => setDados({ ...dados, cpf: maskCpf(e.target.value) })}
              placeholder="000.000.000-00"
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="telefone">Telefone</Label>
            <Input
              id="telefone"
              inputMode="tel"
              value={dados.telefone}
              className={palette.input}
              onChange={(e) =>
                setDados({ ...dados, telefone: maskTelefone(e.target.value) })
              }
              placeholder="(51) 90000-0000"
            />
          </div>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="grid gap-1.5 sm:col-span-2">
            <Label htmlFor="numero">Número do cartão</Label>
            <Input
              id="numero"
              inputMode="numeric"
              autoComplete="cc-number"
              value={cartao.numero}
              className={palette.input}
              onChange={(e) =>
                setCartao({ ...cartao, numero: maskCartao(e.target.value) })
              }
              placeholder="0000 0000 0000 0000"
            />
          </div>
          <div className="grid gap-1.5 sm:col-span-2">
            <Label htmlFor="nomeImpresso">Nome impresso no cartão</Label>
            <Input
              id="nomeImpresso"
              autoComplete="cc-name"
              value={cartao.nomeImpresso}
              className={palette.input}
              onChange={(e) =>
                setCartao({ ...cartao, nomeImpresso: e.target.value })
              }
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="validade">Validade</Label>
            <Input
              id="validade"
              inputMode="numeric"
              autoComplete="cc-exp"
              value={cartao.validade}
              className={palette.input}
              onChange={(e) =>
                setCartao({ ...cartao, validade: maskValidade(e.target.value) })
              }
              placeholder="MM/AA"
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="cvv">CVV</Label>
            <Input
              id="cvv"
              inputMode="numeric"
              autoComplete="cc-csc"
              value={cartao.cvv}
              className={palette.input}
              onChange={(e) =>
                setCartao({ ...cartao, cvv: onlyDigits(e.target.value).slice(0, 4) })
              }
              placeholder="000"
            />
          </div>
        </div>
      )}

      {erro && (
        <p className="mt-3 rounded-xl bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {erro}
        </p>
      )}

      <div className="mt-4 flex items-center justify-between">
        <span className={`text-sm ${palette.muted}`}>Total</span>
        <span className="font-display text-xl font-black">{formatBRL(subtotal)}</span>
      </div>

      <Button
        size="lg"
        className="mt-4 w-full"
        disabled={loading || (step === "dados" ? !dadosValidos : !cartaoValido)}
        onClick={() => (step === "dados" ? criarPedido() : pagar())}
      >
        {loading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            {statusText || "Processando..."}
          </>
        ) : step === "dados" ? (
          "Continuar para o pagamento"
        ) : (
          <>
            <CreditCard className="mr-2 h-4 w-4" />
            Pagar {formatBRL(subtotal)}
          </>
        )}
      </Button>

      {!loading && (
        <Button
          variant="ghost"
          className={`mt-2 w-full ${palette.muted}`}
          onClick={() => (step === "dados" ? onBackToCart() : setStep("dados"))}
        >
          Voltar
        </Button>
      )}
    </Card>
  );
};

export default CheckoutFlow;
