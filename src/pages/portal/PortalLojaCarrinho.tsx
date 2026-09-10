import { StoreScopeProvider } from "@/components/store/StoreScope";
import StoreCart from "@/pages/store/StoreCart";

export default function PortalLojaCarrinho() {
  return (
    <StoreScopeProvider basePath="/portal/loja" hideHeader forcedTheme="dark">
      <StoreCart />
    </StoreScopeProvider>
  );
}
