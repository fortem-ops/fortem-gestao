import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ImageOff, Minus, Plus, Trash2 } from "lucide-react";
import StoreHeader from "@/components/store/StoreHeader";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { useCartLoja } from "@/hooks/useCartLoja";
import { formatBRL } from "@/integrations/store/types";
import CheckoutFlow, { PEDIDO_PAGO_KEY } from "@/components/store/CheckoutFlow";
import { useStoreTheme } from "@/hooks/useStoreTheme";
import { useStoreScope } from "@/components/store/StoreScope";

const StoreCart = () => {
  const { items, subtotal, updateQuantity, removeItem } = useCartLoja();
  const [cupom, setCupom] = useState("");
  // Se houve pagamento aprovado nesta sessão, retoma o checkout (tela de
  // sucesso) mesmo depois de um recarregamento da página.
  const [checkout, setCheckout] = useState(() => {
    try {
      return sessionStorage.getItem(PEDIDO_PAGO_KEY) !== null;
    } catch {
      return false;
    }
  });
  const { theme, palette } = useStoreTheme();
  const { basePath, hideHeader } = useStoreScope();
  const barBg = theme === "dark" ? "bg-neutral-950/95" : "bg-white/95";
  const separatorBg = theme === "dark" ? "bg-neutral-800" : "bg-neutral-200";

  // Fora do checkout (carrinho editável), descarta qualquer idempotency key
  // de uma tentativa anterior — evita reaproveitar pedido com valor antigo.
  useEffect(() => {
    if (!checkout) sessionStorage.removeItem("fortem-loja-idempotency");
  }, [checkout]);

  return (
    <div className={`min-h-screen pb-28 sm:pb-10 ${palette.bg} ${palette.text}`}>
      {!hideHeader && <StoreHeader backTo={basePath} title="Carrinho" />}

      <main className="mx-auto max-w-3xl px-4 py-6">
        <h1 className="font-display text-2xl font-black uppercase tracking-tight">
          Seu carrinho
        </h1>

        {checkout ? (
          <CheckoutFlow
            items={items}
            subtotal={subtotal}
            onBackToCart={() => setCheckout(false)}
          />
        ) : items.length === 0 ? (
          <div className="mt-10 text-center">
            <p className={`text-sm ${palette.muted}`}>Seu carrinho está vazio.</p>
            <Button asChild className="mt-4">
              <Link to={basePath}>Ver produtos</Link>
            </Button>
          </div>
        ) : (
          <>
            <div className="mt-5 space-y-3">
              {items.map((item) => (
                <Card
                  key={`${item.produtoId}-${item.varianteId ?? "base"}`}
                  className={`flex gap-3 rounded-2xl p-3 ${palette.card}`}
                >
                  <div
                    className={`h-20 w-20 shrink-0 overflow-hidden rounded-xl ${palette.surface}`}
                  >
                    {item.imagemUrl ? (
                      <img
                        src={item.imagemUrl}
                        alt={item.nome}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div
                        className={`flex h-full w-full items-center justify-center ${palette.muted}`}
                      >
                        <ImageOff className="h-5 w-5" />
                      </div>
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <Link
                        to={`${basePath}/${item.produtoId}`}
                        className={`line-clamp-2 font-display text-sm font-bold leading-tight ${palette.text}`}
                      >
                        {item.nome}
                      </Link>
                      <Button
                        size="icon"
                        variant="ghost"
                        aria-label="Remover item"
                        className={`h-8 w-8 shrink-0 ${palette.muted}`}
                        onClick={() => removeItem(item.produtoId, item.varianteId)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>

                    {(item.tamanho || item.cor) && (
                      <p className={`mt-0.5 text-xs ${palette.muted}`}>
                        {[item.tamanho, item.cor].filter(Boolean).join(" • ")}
                      </p>
                    )}

                    <div className="mt-2 flex items-center justify-between gap-2">
                      <div
                        className={`flex items-center gap-1 rounded-full border p-1 ${palette.border}`}
                      >
                        <Button
                          size="icon"
                          variant="ghost"
                          className={`h-7 w-7 rounded-full ${palette.text}`}
                          aria-label="Diminuir quantidade"
                          onClick={() =>
                            updateQuantity(
                              item.produtoId,
                              item.varianteId,
                              item.quantidade - 1
                            )
                          }
                          disabled={item.quantidade <= 1}
                        >
                          <Minus className="h-3.5 w-3.5" />
                        </Button>
                        <span className={`w-7 text-center text-sm font-bold ${palette.text}`}>
                          {item.quantidade}
                        </span>
                        <Button
                          size="icon"
                          variant="ghost"
                          className={`h-7 w-7 rounded-full ${palette.text}`}
                          aria-label="Aumentar quantidade"
                          onClick={() =>
                            updateQuantity(
                              item.produtoId,
                              item.varianteId,
                              item.quantidade + 1
                            )
                          }
                          disabled={item.quantidade >= (item.estoqueMax || 99)}
                        >
                          <Plus className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                      <p className="text-sm font-bold text-primary">
                        {formatBRL(item.preco * item.quantidade)}
                      </p>
                    </div>
                  </div>
                </Card>
              ))}
            </div>

            <Card className={`mt-5 rounded-2xl p-4 ${palette.card}`}>
              <p className="text-sm font-semibold">Cupom de desconto</p>
              <div className="mt-2 flex gap-2">
                <Input
                  value={cupom}
                  onChange={(e) => setCupom(e.target.value.toUpperCase())}
                  placeholder="Digite seu cupom"
                  aria-label="Cupom de desconto"
                  className={palette.input}
                />
                <Button
                  variant="outline"
                  className={palette.card}
                  onClick={() =>
                    toast.info("Validação de cupom disponível em breve.")
                  }
                >
                  Aplicar
                </Button>
              </div>
              <p className={`mt-2 text-xs ${palette.muted}`}>
                A validação de cupons entra no ar em breve.
              </p>

              <Separator className={`my-4 ${separatorBg}`} />

              <div className="flex items-center justify-between">
                <span className={`text-sm ${palette.muted}`}>Subtotal</span>
                <span className="font-display text-xl font-black">
                  {formatBRL(subtotal)}
                </span>
              </div>

              <div className="mt-4 hidden sm:block">
                <Button
                  size="lg"
                  className="w-full"
                  onClick={() => setCheckout(true)}
                >
                  Finalizar compra
                </Button>
              </div>
            </Card>
          </>
        )}
      </main>

      {items.length > 0 && !checkout && (
        <div
          className={`fixed inset-x-0 ${hideHeader ? "bottom-20" : "bottom-0"} z-40 border-t p-3 backdrop-blur sm:hidden ${palette.border} ${barBg} ${palette.text}`}
        >
          <div className="mb-2 flex items-center justify-between">
            <span className={`text-xs ${palette.muted}`}>Subtotal</span>
            <span className="font-display text-lg font-black">
              {formatBRL(subtotal)}
            </span>
          </div>
          <Button size="lg" className="w-full" onClick={() => setCheckout(true)}>
            Finalizar compra
          </Button>
        </div>
      )}
    </div>
  );
};

export default StoreCart;
