import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Copy, MessageCircle } from "lucide-react";
import { toast } from "sonner";
import { MOTIVO_SEM_PONTOS_ALUNO, STATUS_INDICACAO } from "@/lib/indicacoes";
import type { RegrasClube } from "@/lib/clubePlano";

interface MinhasIndicacoes {
  codigo: string | null;
  convertidas_ano: number;
  indicacoes: { nome: string; status: string; pontos: number; sem_pontos_motivo: string | null; criada_em: string }[];
}

const titulo = "text-[13px] font-bold uppercase tracking-[0.08em] text-[hsl(180,1%,70%)]";

/** Card "Indique um amigo" + "Minhas indicações". Dados só do próprio aluno, via fn_indicacao_minhas. */
export function IndiqueUmAmigo({ regras }: { regras?: RegrasClube | null }) {
  const { data } = useQuery({
    queryKey: ["portal-minhas-indicacoes"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("fn_indicacao_minhas" as any);
      if (error) throw error;
      return data as unknown as MinhasIndicacoes | null;
    },
  });
  if (!data?.codigo) return null;

  const ptsInd = regras?.pontos_indicacao ?? 100;
  const ptsAmigo = regras?.pontos_indicado ?? 50;
  const teto = regras?.teto_indicacoes_ano ?? 10;
  const link = `${window.location.origin}/experimental?ind=${data.codigo}`;
  const texto = `Treino na FORTEM e acho que você vai gostar. Agende uma aula experimental por este link: ${link}`;

  return (
    <>
      <Card className="glass-card rounded-none p-4 space-y-3">
        <p className={titulo}>Indique um amigo</p>
        <div className="flex items-center gap-2">
          <code className="flex-1 bg-muted/50 px-3 py-2 text-lg font-bold tracking-wider" style={{ fontFamily: "Archivo,sans-serif" }}>{data.codigo}</code>
          <Button size="icon" variant="outline" className="h-11 w-11 rounded-none" aria-label="Copiar código"
            onClick={() => { navigator.clipboard.writeText(data.codigo!); toast.success("Código copiado"); }}>
            <Copy className="h-4 w-4" />
          </Button>
        </div>
        <Button asChild className="h-11 w-full rounded-none uppercase tracking-wide">
          <a href={`https://wa.me/?text=${encodeURIComponent(texto)}`} target="_blank" rel="noopener noreferrer">
            <MessageCircle className="mr-2 h-4 w-4" /> Compartilhar pelo WhatsApp
          </a>
        </Button>
        <ul className="space-y-1 text-xs text-muted-foreground">
          <li>Você ganha {ptsInd} pontos por indicado que contratar um plano FORTEM (não vale Wellhub ou Total Pass).</li>
          <li>Seu amigo ganha {ptsAmigo} pontos.</li>
          <li>Limite de {teto} indicações com pontos por ano.</li>
        </ul>
        <p className="text-xs text-foreground">
          Indicações convertidas com pontos neste ano: <strong>{data.convertidas_ano}</strong> de {teto}
        </p>
      </Card>

      {data.indicacoes.length > 0 && (
        <section>
          <p className={`${titulo} mb-3`}>Minhas indicações</p>
          <div className="space-y-1">
            {data.indicacoes.map((i, idx) => (
              <div key={idx} className="flex items-center justify-between gap-3 border-b border-border py-3 last:border-0">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-foreground">{i.nome}</p>
                  <p className="mt-0.5 text-xs uppercase tracking-wide text-muted-foreground">{STATUS_INDICACAO[i.status] || i.status}</p>
                  {i.status === "convertida" && i.pontos <= 0 && (
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {(i.sem_pontos_motivo && MOTIVO_SEM_PONTOS_ALUNO[i.sem_pontos_motivo]) || "Sem pontos"}
                    </p>
                  )}
                </div>
                <span className="text-sm font-black text-foreground" style={{ fontFamily: "Archivo,sans-serif" }}>
                  {i.pontos > 0 ? `+${i.pontos}` : "—"}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}
    </>
  );
}
