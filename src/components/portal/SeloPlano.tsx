import { ChevronsUp } from "lucide-react";
import { seloDoPlano } from "@/lib/clubePlano";
import { cn } from "@/lib/utils";

interface Props {
  chave?: string | null;
  /** No perfil o Pro ganha cantoneiras vermelhas. */
  cantoneiras?: boolean;
  className?: string;
}

/** Selo do plano: Start contorno cinza, Power contorno vermelho, Pro preenchido. Agregador/Consultoria: nada. */
export function SeloPlano({ chave, cantoneiras = false, className }: Props) {
  const selo = seloDoPlano(chave);
  if (!selo) return null;
  const base = "relative inline-flex h-6 items-center gap-1 px-2 text-[11px] font-bold uppercase tracking-[0.08em] leading-none";
  const rotulo = selo === "start" ? "Start" : selo === "power" ? "Power" : "Pro";
  if (selo === "pro") {
    return (
      <span className={cn(base, "bg-[#c8282a] text-white", className)} style={{ fontFamily: "Archivo, sans-serif" }} aria-label={`Plano ${rotulo}`}>
        <ChevronsUp className="h-3.5 w-3.5" strokeWidth={2.5} aria-hidden />
        {rotulo}
        {cantoneiras && (
          <>
            <span aria-hidden className="absolute -left-1 -top-1 h-2 w-2 border-l-2 border-t-2 border-[#e73c3e]" />
            <span aria-hidden className="absolute -right-1 -top-1 h-2 w-2 border-r-2 border-t-2 border-[#e73c3e]" />
            <span aria-hidden className="absolute -bottom-1 -left-1 h-2 w-2 border-b-2 border-l-2 border-[#e73c3e]" />
            <span aria-hidden className="absolute -bottom-1 -right-1 h-2 w-2 border-b-2 border-r-2 border-[#e73c3e]" />
          </>
        )}
      </span>
    );
  }
  return (
    <span
      className={cn(base, "border", selo === "start" ? "border-[#b1b3b3] text-[#b1b3b3]" : "border-[#e73c3e] text-[#e73c3e]", className)}
      style={{ fontFamily: "Archivo, sans-serif" }}
      aria-label={`Plano ${rotulo}`}
    >
      {rotulo}
    </span>
  );
}
