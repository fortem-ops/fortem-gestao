import { Navigate, useLocation } from "react-router-dom";
import Leads from "@/pages/Leads";
import { legacyPropostasLocation } from "@/lib/propostasContratos";

export default function LeadsRoute() {
  const { search, hash } = useLocation();
  const target = legacyPropostasLocation(search, hash);
  return target ? <Navigate to={target} replace /> : <Leads />;
}