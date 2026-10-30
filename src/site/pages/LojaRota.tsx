import { LojaPublica } from "../ComercioPublico";
import StoreIndex from "@/pages/store/StoreIndex";
import StoreCart from "@/pages/store/StoreCart";
import StoreProductDetail from "@/pages/store/StoreProductDetail";

/** /store, /store/carrinho e /store/:produtoId dentro do site público. O portal usa as mesmas páginas sem esta casca. */
export default function LojaRota({ pagina }: { pagina: "index" | "carrinho" | "produto" }) {
  return (
    <LojaPublica>
      {pagina === "index" ? <StoreIndex /> : pagina === "carrinho" ? <StoreCart /> : <StoreProductDetail />}
    </LojaPublica>
  );
}
