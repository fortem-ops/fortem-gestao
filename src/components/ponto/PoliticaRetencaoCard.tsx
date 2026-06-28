import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Shield, ChevronDown, ChevronRight } from "lucide-react";

interface Props {
  defaultExpanded?: boolean;
}

export function PoliticaRetencaoCard({ defaultExpanded = false }: Props) {
  const [expanded, setExpanded] = useState(defaultExpanded);

  const { data: politica } = useQuery({
    queryKey: ["ponto-politica-retencao"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ponto_politica_retencao" as any)
        .select("*")
        .order("vigente_desde", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data as any;
    },
  });

  if (!politica) return null;

  const vigenteDesde = new Date(politica.vigente_desde).toLocaleDateString("pt-BR");

  return (
    <Card className="p-3 border-muted text-xs">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center gap-2 text-left"
      >
        {expanded ? (
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
        ) : (
          <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
        )}
        <Shield className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="font-medium flex-1">Política de retenção de dados</span>
        <Badge variant="outline" className="text-[10px] py-0 h-5">
          LGPD · Art. 37
        </Badge>
      </button>

      {expanded && (
        <div className="mt-3 space-y-1.5 text-muted-foreground pl-6">
          <p>
            <span className="text-foreground">Retenção de registros:</span>{" "}
            {politica.retencao_jornadas_anos} anos
          </p>
          <p>
            <span className="text-foreground">Retenção de eventos de localização:</span>{" "}
            {politica.retencao_eventos_anos} anos
          </p>
          <p>
            <span className="text-foreground">Retenção do banco de horas:</span>{" "}
            {politica.retencao_banco_horas_anos} anos
          </p>
          <p>
            <span className="text-foreground">Base legal:</span> {politica.base_legal}
          </p>
          <p>
            <span className="text-foreground">Responsável pelo tratamento:</span>{" "}
            {politica.responsavel_dados}
          </p>
          {politica.contato_dpo && (
            <p>
              <span className="text-foreground">Contato DPO:</span> {politica.contato_dpo}
            </p>
          )}
          <p>
            <span className="text-foreground">Vigente desde:</span> {vigenteDesde} (versão{" "}
            {politica.versao})
          </p>
        </div>
      )}
    </Card>
  );
}
