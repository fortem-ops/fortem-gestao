import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

const STORAGE_KEY = "fortem-loja-carrinho";

export interface CartItem {
  produtoId: string;
  varianteId: string | null;
  nome: string;
  tamanho: string | null;
  cor: string | null;
  preco: number;
  quantidade: number;
  imagemUrl: string | null;
  estoqueMax: number;
}

interface CartContextValue {
  items: CartItem[];
  totalItems: number;
  subtotal: number;
  addItem: (item: CartItem) => void;
  updateQuantity: (produtoId: string, varianteId: string | null, quantidade: number) => void;
  removeItem: (produtoId: string, varianteId: string | null) => void;
  clear: () => void;
}

const CartContext = createContext<CartContextValue | undefined>(undefined);

const sameLine = (a: CartItem, produtoId: string, varianteId: string | null) =>
  a.produtoId === produtoId && a.varianteId === varianteId;

const load = (): CartItem[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as CartItem[]) : [];
  } catch {
    return [];
  }
};

export const CartProvider = ({ children }: { children: React.ReactNode }) => {
  const [items, setItems] = useState<CartItem[]>(() => load());

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch {
      /* ignora quota */
    }
  }, [items]);

  const addItem = useCallback((item: CartItem) => {
    setItems((prev) => {
      const idx = prev.findIndex((i) => sameLine(i, item.produtoId, item.varianteId));
      if (idx === -1) return [...prev, item];
      const copy = [...prev];
      const max = item.estoqueMax || copy[idx].estoqueMax || 99;
      copy[idx] = {
        ...copy[idx],
        preco: item.preco,
        estoqueMax: max,
        quantidade: Math.min(copy[idx].quantidade + item.quantidade, max),
      };
      return copy;
    });
  }, []);

  const updateQuantity = useCallback(
    (produtoId: string, varianteId: string | null, quantidade: number) => {
      setItems((prev) =>
        prev
          .map((i) =>
            sameLine(i, produtoId, varianteId)
              ? {
                  ...i,
                  quantidade: Math.max(
                    1,
                    Math.min(quantidade, i.estoqueMax || 99)
                  ),
                }
              : i
          )
          .filter((i) => i.quantidade > 0)
      );
    },
    []
  );

  const removeItem = useCallback((produtoId: string, varianteId: string | null) => {
    setItems((prev) => prev.filter((i) => !sameLine(i, produtoId, varianteId)));
  }, []);

  const clear = useCallback(() => setItems([]), []);

  const value = useMemo<CartContextValue>(
    () => ({
      items,
      totalItems: items.reduce((acc, i) => acc + i.quantidade, 0),
      subtotal: items.reduce((acc, i) => acc + i.preco * i.quantidade, 0),
      addItem,
      updateQuantity,
      removeItem,
      clear,
    }),
    [items, addItem, updateQuantity, removeItem, clear]
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
};

export const useCartLoja = () => {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCartLoja precisa estar dentro de CartProvider");
  return ctx;
};
