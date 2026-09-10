import { StoreScopeProvider } from "@/components/store/StoreScope";
import StoreProductDetail from "@/pages/store/StoreProductDetail";

export default function PortalLojaProduto() {
  return (
    <StoreScopeProvider basePath="/portal/loja" hideHeader forcedTheme="dark">
      <StoreProductDetail />
    </StoreScopeProvider>
  );
}
