import { ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";

interface AvisoDocumentosPendentesProps {
  contratosPendentes: number;
  anexoPendente: boolean;
}

export function AvisoDocumentosPendentes({
  contratosPendentes,
  anexoPendente,
}: AvisoDocumentosPendentesProps) {
  if (contratosPendentes === 0 && !anexoPendente) return null;

  const detalhes = [
    contratosPendentes > 0
      ? `${contratosPendentes} ${contratosPendentes === 1 ? "contrato" : "contratos"}`
      : null,
    anexoPendente ? "Anexo I" : null,
  ].filter(Boolean).join(" · ");

  return (
    <Link
      to="/portal/contratos"
      aria-label="Revisar e aceitar documentos"
      className="flex min-h-[44px] items-center gap-3 border border-[#E3B341]/50 px-4 py-2 text-[#E3B341]"
    >
      <span className="flex-1 truncate text-sm font-bold">
        Documentos pendentes de aceite
        <span className="font-normal text-[#B1B3B3]">{` · ${detalhes}`}</span>
      </span>
      <ArrowRight className="h-4 w-4 shrink-0" />
    </Link>
  );
}
