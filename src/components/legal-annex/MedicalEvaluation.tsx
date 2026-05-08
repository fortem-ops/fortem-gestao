import { useRef } from "react";
import { Check, Upload, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

interface MedicalEvaluationProps {
  status: "ok" | "restricao" | null;
  onStatusChange: (status: "ok" | "restricao") => void;
  attestFile: File | null;
  onFileChange: (file: File | null) => void;
  error?: string;
}

const MedicalEvaluation = ({ status, onStatusChange, attestFile, onFileChange, error }: MedicalEvaluationProps) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="space-y-3">
      <h3 className="section-title text-base">Avaliação Médica</h3>
      <p className="body-text text-sm">Selecione a opção que melhor descreve sua condição:</p>

      {(["ok", "restricao"] as const).map((opt) => (
        <button
          key={opt}
          type="button"
          onClick={() => onStatusChange(opt)}
          className={cn(
            "w-full flex items-start gap-4 p-4 rounded-xl transition-all duration-200 text-left bg-card card-shadow hover:card-shadow-hover",
            status === opt ? "ring-2 ring-primary bg-primary/5" : "ring-1 ring-transparent"
          )}
        >
          <div className={cn(
            "mt-0.5 flex-shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors",
            status === opt ? "border-primary bg-primary" : "border-muted-foreground/30"
          )}>
            {status === opt && <Check className="w-3 h-3 text-primary-foreground" />}
          </div>
          <div>
            <p className="text-sm font-medium text-foreground">
              {opt === "ok"
                ? "Nenhum médico informou restrições à prática de atividade física"
                : "Possuo limitações atestadas por médico que não impedem a prática"}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {opt === "ok" ? "Estou apto(a) sem restrições" : "Requer upload de atestado médico"}
            </p>
          </div>
        </button>
      ))}

      {status === "restricao" && (
        <div className="ml-9 mt-2 animate-in fade-in slide-in-from-top-2 duration-300">
          <input ref={fileInputRef} type="file" accept=".pdf,.jpg,.jpeg,.png" className="hidden" onChange={(e) => onFileChange(e.target.files?.[0] || null)} />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className={cn(
              "w-full flex items-center gap-3 p-4 rounded-xl border-2 border-dashed transition-all",
              attestFile ? "border-success bg-success/5" : "border-muted-foreground/20 hover:border-primary/50"
            )}
          >
            {attestFile ? (
              <>
                <Check className="w-5 h-5 text-success" />
                <span className="text-sm text-foreground font-medium">{attestFile.name}</span>
              </>
            ) : (
              <>
                <Upload className="w-5 h-5 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Upload do atestado médico (PDF/JPG)</span>
              </>
            )}
          </button>
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 text-destructive text-xs ml-1">
          <AlertTriangle className="w-3 h-3" />
          {error}
        </div>
      )}
    </div>
  );
};

export default MedicalEvaluation;
