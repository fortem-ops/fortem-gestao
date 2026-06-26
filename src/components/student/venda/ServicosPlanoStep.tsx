import { Check, Activity, Utensils, HeartPulse, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import type { OpcaoConsulta, ServicosBase } from "@/lib/vendas-servicos";

type Props = {
  nomePlano: string;
  regra: ServicosBase;
  opcaoSelecionadaId: string | null;
  onOpcaoChange: (op: OpcaoConsulta | null) => void;
};

export function ServicosPlanoStep({ nomePlano, regra, opcaoSelecionadaId, onOpcaoChange }: Props) {
  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-primary/30 bg-primary/5 p-4 space-y-2">
        <div className="text-xs uppercase tracking-wide text-muted-foreground">Incluído no {nomePlano}</div>
        <div className="flex flex-wrap items-center gap-2">
          {regra.avaliacao_funcional > 0 && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/15 text-primary px-3 py-1 text-sm font-medium">
              <Activity className="w-3.5 h-3.5" />
              {regra.avaliacao_funcional}× Avaliação Funcional
            </span>
          )}
          {regra.consultas_fixas?.nutricao ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/15 text-primary px-3 py-1 text-sm font-medium">
              <Utensils className="w-3.5 h-3.5" />
              {regra.consultas_fixas.nutricao}× Nutrição
            </span>
          ) : null}
          {regra.consultas_fixas?.reabilitacao ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/15 text-primary px-3 py-1 text-sm font-medium">
              <HeartPulse className="w-3.5 h-3.5" />
              {regra.consultas_fixas.reabilitacao}× Reabilitação
            </span>
          ) : null}
        </div>
      </div>

      {regra.opcoes_consulta.length > 0 && (
        <div className="space-y-2">
          <div className="text-sm font-medium">Escolha o complemento de consultas</div>
          {regra.opcoes_consulta.map((op) => {
            const selected = opcaoSelecionadaId === op.id;
            const Icon = op.definir_depois
              ? Clock
              : op.nutricao && op.reabilitacao
                ? Activity
                : op.nutricao
                  ? Utensils
                  : HeartPulse;
            return (
              <button
                key={op.id}
                type="button"
                onClick={() => onOpcaoChange(op)}
                className={cn(
                  "w-full flex items-center gap-3 rounded-xl border px-4 py-3 text-left transition",
                  selected ? "border-primary bg-primary/5 ring-2 ring-primary/20" : "border-border hover:border-primary/40",
                )}
              >
                <Icon className={cn("w-5 h-5", selected ? "text-primary" : "text-muted-foreground")} />
                <span className="flex-1 font-medium">{op.label}</span>
                {selected && <Check className="w-5 h-5 text-primary" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
