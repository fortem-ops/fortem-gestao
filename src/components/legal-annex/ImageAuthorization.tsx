import { Check, Camera, CameraOff } from "lucide-react";
import { cn } from "@/lib/utils";

interface ImageAuthorizationProps {
  authorized: boolean | null;
  onAuthChange: (authorized: boolean) => void;
  error?: string;
}

const ImageAuthorization = ({ authorized, onAuthChange, error }: ImageAuthorizationProps) => (
  <div className="space-y-3">
    <h3 className="section-title text-base">Direito de Uso de Imagem</h3>
    <div className="legal-text p-4 bg-card rounded-xl card-shadow">
      <p>Autorizo, de forma gratuita e livre, a utilização da minha imagem, voz e nome pela <strong className="text-foreground">FORTEM TREINAMENTO FÍSICO LTDA</strong>, para fins de divulgação institucional, publicitária e promocional, em meios digitais e físicos.</p>
      <p className="mt-2">Declaro estar ciente de que esta autorização pode ser revogada a qualquer momento mediante solicitação formal.</p>
    </div>
    <div className="grid grid-cols-2 gap-3">
      {([true, false] as const).map((val) => {
        const Icon = val ? Camera : CameraOff;
        return (
          <button
            key={String(val)}
            type="button"
            onClick={() => onAuthChange(val)}
            className={cn(
              "flex flex-col items-center gap-3 p-5 rounded-xl transition-all duration-200 bg-card card-shadow hover:card-shadow-hover",
              authorized === val ? "ring-2 ring-primary bg-primary/5" : "ring-1 ring-transparent"
            )}
          >
            <Icon className={cn("w-6 h-6", authorized === val ? "text-primary" : "text-muted-foreground")} />
            <span className="text-sm font-medium text-foreground">{val ? "Autorizo" : "Não autorizo"}</span>
            {authorized === val && <Check className="w-4 h-4 text-primary" />}
          </button>
        );
      })}
    </div>
    {error && <p className="text-destructive text-xs">{error}</p>}
  </div>
);

export default ImageAuthorization;
