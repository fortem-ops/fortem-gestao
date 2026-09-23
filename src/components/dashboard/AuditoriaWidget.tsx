import { useNavigate } from "react-router-dom";
import { ShieldAlert } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAuditoriaResumo } from "@/hooks/useAuditoria";

const CATEGORIA_LABEL: Record<string, string> = {
  pagamento: "Pagamentos",
  integracao: "Integrações",
  creditos: "Créditos",
  agenda_servicos: "Agenda de Serviços",
  pipeline: "Pipeline",
};

export function AuditoriaWidget() {
  const navigate = useNavigate();
  const { data } = useAuditoriaResumo();

  if (!data || data.abertos === 0) return null;

  const temCritico = data.criticos > 0;

  return (
    <div className={`glass-card rounded-lg p-5 ${temCritico ? "border border-destructive/40" : ""}`}>
      <h3 className="font-heading font-semibold text-foreground mb-3 flex items-center gap-2">
        <ShieldAlert className={`w-4 h-4 ${temCritico ? "text-destructive" : "text-warning"}`} />
        Auditoria
        <Badge variant={temCritico ? "destructive" : "outline"} className="ml-auto">
          {data.abertos}
        </Badge>
      </h3>

      <p className="text-sm text-muted-foreground">
        {temCritico
          ? `${data.criticos} inconsistência(s) crítica(s) e ${data.atencao} de atenção aguardando revisão.`
          : `${data.atencao} inconsistência(s) de atenção aguardando revisão.`}
      </p>

      <div className="flex flex-wrap gap-1.5 mt-3">
        {data.porCategoria.map((c) => (
          <Badge key={c.categoria} variant="secondary" className="text-xs">
            {(CATEGORIA_LABEL[c.categoria] ?? c.categoria)}: {c.total}
          </Badge>
        ))}
      </div>

      <Button size="sm" variant="outline" className="mt-4 w-full" onClick={() => navigate("/auditoria")}>
        Abrir Auditoria
      </Button>
    </div>
  );
}
