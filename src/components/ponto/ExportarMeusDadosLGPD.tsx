import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Props {
  userId: string;
  nome: string;
}

export function ExportarMeusDadosLGPD({ userId, nome }: Props) {
  const [loading, setLoading] = useState(false);

  const handleExportar = async () => {
    setLoading(true);
    try {
      const [jornadasRes, eventosRes, bancoRes, consentRes] = await Promise.all([
        supabase.from("ponto_jornadas").select("*").eq("usuario_id", userId).order("data"),
        supabase
          .from("ponto_eventos")
          .select("tipo, data_hora, latitude, longitude, dispositivo, fora_do_raio, distancia_m, observacao")
          .eq("usuario_id", userId)
          .order("data_hora"),
        supabase
          .from("ponto_banco_horas")
          .select("data, minutos, tipo, motivo")
          .eq("usuario_id", userId)
          .order("data"),
        supabase
          .from("ponto_consentimento_geo")
          .select("aceito, aceito_em, versao_termo")
          .eq("usuario_id", userId)
          .maybeSingle(),
      ]);

      const data = {
        exportado_em: new Date().toISOString(),
        titular: nome,
        base_legal: "Art. 18 da Lei 13.709/2018 (LGPD)",
        retencao: "5 anos conforme Art. 11 da CLT",
        consentimento_geolocalizacao: consentRes.data ?? null,
        jornadas: jornadasRes.data ?? [],
        eventos: eventosRes.data ?? [],
        banco_horas: bancoRes.data ?? [],
      };

      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `fortem-ponto-${nome.replace(/\s+/g, "-").toLowerCase()}-${new Date()
        .toISOString()
        .slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);

      toast.success("Seus dados foram exportados com sucesso.");
    } catch (err: any) {
      console.error(err);
      toast.error("Erro ao exportar dados: " + (err?.message ?? "tente novamente"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="p-4 space-y-3">
      <div className="flex items-start gap-3">
        <div className="rounded-md bg-primary/10 p-2 text-primary">
          <Download className="h-5 w-5" />
        </div>
        <div className="flex-1 space-y-1">
          <h3 className="font-semibold">Exportar meus dados (LGPD)</h3>
          <p className="text-sm text-muted-foreground">
            Baixe todos os seus registros de ponto, eventos de localização e banco de horas em
            formato JSON estruturado, conforme direito garantido pelo Art. 18 da Lei 13.709/2018
            (LGPD).
          </p>
        </div>
      </div>
      <div className="flex justify-end">
        <Button onClick={handleExportar} disabled={loading} size="sm">
          {loading ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Download className="h-4 w-4 mr-2" />
          )}
          Exportar meus dados
        </Button>
      </div>
    </Card>
  );
}
