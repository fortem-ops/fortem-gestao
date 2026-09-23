import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSupabaseMutation } from "@/hooks/useSupabaseMutation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ShieldCheck } from "lucide-react";
import { CobrancaAutomaticaCard } from "./CobrancaAutomaticaCard";

interface Certificado {
  id: string;
  chave: string;
  nome: string;
  descricao: string | null;
  data_validade: string | null;
  dias_alerta: number;
  ativo: boolean;
}

function diasRestantes(data: string | null) {
  if (!data) return null;
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const alvo = new Date(data + "T00:00:00");
  return Math.round((alvo.getTime() - hoje.getTime()) / 86_400_000);
}

function CertificadoCard({ cert }: { cert: Certificado }) {
  const [validade, setValidade] = useState(cert.data_validade ?? "");
  const [diasAlerta, setDiasAlerta] = useState(String(cert.dias_alerta));

  useEffect(() => {
    setValidade(cert.data_validade ?? "");
    setDiasAlerta(String(cert.dias_alerta));
  }, [cert.data_validade, cert.dias_alerta]);

  const salvar = useSupabaseMutation<void, void>({
    mutationFn: async () => {
      const { data: userData } = await supabase.auth.getUser();
      const { error } = await supabase
        .from("integracao_certificados")
        .update({
          data_validade: validade || null,
          dias_alerta: Number(diasAlerta) || 30,
          atualizado_por: userData?.user?.id ?? null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", cert.id);
      if (error) throw error;
    },
    successMessage: "Validade do certificado atualizada",
    invalidates: [["integracao-certificados"], ["auditoria-resumo"]],
  });

  const dias = diasRestantes(validade || cert.data_validade);
  const alerta = dias !== null && dias <= cert.dias_alerta;

  return (
    <div className="glass-card rounded-lg p-4 space-y-3">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div>
          <p className="font-medium text-foreground flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-primary" />
            {cert.nome}
          </p>
          {cert.descricao && <p className="text-xs text-muted-foreground mt-0.5">{cert.descricao}</p>}
        </div>
        {dias !== null && (
          <Badge variant="outline" className={alerta ? "status-warning" : ""}>
            {dias < 0 ? `Vencido há ${Math.abs(dias)} dias` : `Vence em ${dias} dias`}
          </Badge>
        )}
      </div>

      <div className="grid sm:grid-cols-3 gap-3">
        <div className="space-y-1">
          <Label htmlFor={`validade-${cert.id}`}>Data de validade</Label>
          <Input
            id={`validade-${cert.id}`}
            type="date"
            value={validade}
            onChange={(e) => setValidade(e.target.value)}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor={`alerta-${cert.id}`}>Avisar com (dias)</Label>
          <Input
            id={`alerta-${cert.id}`}
            type="number"
            min={1}
            value={diasAlerta}
            onChange={(e) => setDiasAlerta(e.target.value)}
          />
        </div>
        <div className="flex items-end">
          <Button onClick={() => salvar.mutate()} disabled={salvar.isPending} className="w-full">
            Salvar
          </Button>
        </div>
      </div>
    </div>
  );
}

export function AdminIntegracoes() {
  const { data, isLoading } = useQuery({
    queryKey: ["integracao-certificados"],
    queryFn: async (): Promise<Certificado[]> => {
      const { data, error } = await supabase
        .from("integracao_certificados")
        .select("*")
        .order("nome");
      if (error) throw error;
      return (data || []) as unknown as Certificado[];
    },
    staleTime: 60_000,
  });

  if (isLoading) return <Skeleton className="h-40 w-full" />;

  return (
    <div className="space-y-4">
      <CobrancaAutomaticaCard />
      <p className="text-sm text-muted-foreground">
        Validade dos certificados usados nas integrações. A auditoria avisa automaticamente quando a data
        estiver próxima.
      </p>
      {(data || []).map((cert) => (
        <CertificadoCard key={cert.id} cert={cert} />
      ))}
    </div>
  );
}
