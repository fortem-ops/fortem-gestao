import { createContext, useContext, useMemo, type ReactNode } from "react";

export interface StoreScopeValue {
  /** Prefixo das rotas da loja: "/store" (pública) ou "/portal/loja" (portal). */
  basePath: string;
  /** Oculta o header próprio da loja (o Portal já tem o seu). */
  hideHeader: boolean;
}

const StoreScopeContext = createContext<StoreScopeValue>({
  basePath: "/store",
  hideHeader: false,
});

export const StoreScopeProvider = ({
  basePath,
  hideHeader = false,
  children,
}: {
  basePath: string;
  hideHeader?: boolean;
  children: ReactNode;
}) => {
  const value = useMemo(() => ({ basePath, hideHeader }), [basePath, hideHeader]);
  return (
    <StoreScopeContext.Provider value={value}>{children}</StoreScopeContext.Provider>
  );
};

export const useStoreScope = () => useContext(StoreScopeContext);
