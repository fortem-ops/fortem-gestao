import { StoreScopeProvider } from "@/components/store/StoreScope";
import StoreIndex from "@/pages/store/StoreIndex";

export default function PortalLoja() {
  return (
    <StoreScopeProvider basePath="/portal/loja" hideHeader forcedTheme="dark">
      <StoreIndex />
    </StoreScopeProvider>
  );
}
