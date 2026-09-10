import { useState } from "react";
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
import CheckoutFlow from "@/components/store/CheckoutFlow";

const StoreCart = () => {
  const { items, subtotal, updateQuantity, removeItem } = useCartLoja();
  const [cupom, setCupom] = useState("");
  const [checkout, setCheckout] = useState(false);

  return (
    <div className="min-h-screen bg-background pb-28 sm:pb-10">
      <StoreHeader backTo="/store" title="Carrinho" />

      <main className="mx-auto max-w-3xl px-4 py-6">
        <h1 className="font-display text-2xl font-black uppercase tracking-tight">
          Seu carrinho
        </h1>

        {items.length === 0 ? (
          <div className="mt-10 text-center">
            <p className="text-sm text-muted-foreground">
              Seu carrinho está vazio.
            </p>
            <Button asChild className="mt-4">
              <Link to="/store">Ver produtos</Link>
            </Button>
          </div>
        ) : (
          <>
            <div className="mt-5 space-y-3">
              {items.map((item) => (
                <Card
                  key={`${item.produtoId}-${item.varianteId ?? "base"}`}
                  className="flex gap-3 rounded-2xl p-3"
                >
                  <div className="h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-muted">
                    {item.imagemUrl ? (
                      <img
                        src={item.imagemUrl}
                        alt={item.nome}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                        <ImageOff className="h-5 w-5" />
                      </div>
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <Link
                        to={`/store/${item.produtoId}`}
                        className="line-clamp-2 font-display text-sm font-bold leading-tight"
                      >
                        {item.nome}
                      </Link>
                      <Button
                        size="icon"
                        variant="ghost"
                        aria-label="Remover item"
                        className="h-8 w-8 shrink-0 text-muted-foreground"
                        onClick={() => removeItem(item.produtoId, item.varianteId)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>

                    {(item.tamanho || item.cor) && (
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {[item.tamanho, item.cor].filter(Boolean).join(" • ")}
                      </p>
                    )}

                    <div className="mt-2 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1 rounded-full border border-border p-1">
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7 rounded-full"
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
                        <span className="w-7 text-center text-sm font-bold">
                          {item.quantidade}
                        </span>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7 rounded-full"
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

            {checkout ? (
              <CheckoutFlow
                items={items}
                subtotal={subtotal}
                onBackToCart={() => setCheckout(false)}
              />
            ) : (
              <Card className="mt-5 rounded-2xl p-4">
                <p className="text-sm font-semibold">Cupom de desconto</p>
                <div className="mt-2 flex gap-2">
                  <Input
                    value={cupom}
                    onChange={(e) => setCupom(e.target.value.toUpperCase())}
                    placeholder="Digite seu cupom"
                    aria-label="Cupom de desconto"
                  />
                  <Button
                    variant="outline"
                    onClick={() =>
                      toast.info("Validação de cupom disponível em breve.")
                    }
                  >
                    Aplicar
                  </Button>
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  A validação de cupons entra no ar em breve.
                </p>

                <Separator className="my-4" />

                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Subtotal</span>
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
            )}
          </>
        )}
      </main>

      {items.length > 0 && !checkout && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 p-3 backdrop-blur sm:hidden">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs text-muted-foreground">Subtotal</span>
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
