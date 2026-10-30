import { useEffect, type ReactNode } from "react";
import { useLocation } from "react-router-dom";
import { SiteLayout } from "./SiteLayout";
import { StoreScopeProvider } from "@/components/store/StoreScope";
import type { OrigemWhatsApp } from "./config";
import "./comercio.css";

/** Marca o documento enquanto montado, para janelas (diálogos/menus) abertas fora da árvore seguirem o visual. */
function useMarcaPortal() {
  useEffect(() => {
    document.documentElement.classList.add("sp-comercio-portal");
    return () => document.documentElement.classList.remove("sp-comercio-portal");
  }, []);
}

interface Props {
  titulo: string;
  descricao: string;
  path: string;
  origem: OrigemWhatsApp;
  jsonLd?: Record<string, unknown>[];
  children: ReactNode;
}

/** Casca visual do site público para páginas de compra/inscrição. Só layout; não toca na lógica das páginas. */
export function ComercioPublico({ titulo, descricao, path, origem, jsonLd, children }: Props) {
  useMarcaPortal();
  return (
    <SiteLayout titulo={titulo} descricao={descricao} path={path} origem={origem} jsonLd={jsonLd}>
      <div className="sp-comercio">{children}</div>
    </SiteLayout>
  );
}

/** Loja pública (/store): mesmo escopo de antes, com tema claro fixo dentro do site. */
export function LojaPublica({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  const carrinho = pathname.startsWith("/store/carrinho");
  return (
    <ComercioPublico
      titulo={carrinho ? "Carrinho · Loja FORTEM" : "Loja FORTEM · Produtos e brindes"}
      descricao="Loja online da FORTEM em Porto Alegre: camisetas, acessórios e produtos da marca, com compra pelo site."
      path={carrinho ? "/store/carrinho" : pathname}
      origem="loja"
    >
      <StoreScopeProvider basePath="/store" forcedTheme="light">{children}</StoreScopeProvider>
    </ComercioPublico>
  );
}
