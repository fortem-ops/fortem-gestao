import { createContext, useContext, useMemo, type ReactNode } from "react";

export interface StoreScopeValue {
  /** Prefixo das rotas da loja: "/store" (pública) ou "/portal/loja" (portal). */
  basePath: string;
  /** Oculta o header próprio da loja (o Portal já tem o seu). */
  hideHeader: boolean;
  /** Tema forçado no escopo. Quando definido, sobrescreve o tema da loja. */
  forcedTheme?: "light" | "dark";
}

const StoreScopeContext = createContext<StoreScopeValue>({
  basePath: "/store",
  hideHeader: false,
});

export const StoreScopeProvider = ({
  basePath,
  hideHeader = false,
  forcedTheme,
  children,
}: {
  basePath: string;
  hideHeader?: boolean;
  forcedTheme?: "light" | "dark";
  children: ReactNode;
}) => {
  const value = useMemo(() => ({ basePath, hideHeader, forcedTheme }), [basePath, hideHeader, forcedTheme]);
  return (
    <StoreScopeContext.Provider value={value}>{children}</StoreScopeContext.Provider>
  );
};

export const useStoreScope = () => useContext(StoreScopeContext);
