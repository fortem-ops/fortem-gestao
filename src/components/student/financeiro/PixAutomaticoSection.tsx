import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { AtivarPixDialog } from "./AtivarPixDialog";
import { GerarCobrancaDialog } from "./GerarCobrancaDialog";

interface Props { student: { id: string; nome: string } }

const brl = (v: number | string | null | undefined) =>
  (typeof v === "number" ? v : Number(v ?? 0)).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const statusBadgeVariant: Record<string, { label: string; cls: string }> = {
  CRIADA: { label: "CRIADA", cls: "bg-muted text-foreground" },
  AGUARDANDO_AUTORIZACAO: { label: "AGUARDANDO AUTORIZAÇÃO", cls: "bg-yellow-500/15 text-yellow-500 border-yellow-500/30" },
  AUTORIZADA: { label: "ATIVA", cls: "bg-green-500/15 text-green-500 border-green-500/30" },
  CANCELADA: { label: "CANCELADA", cls: "bg-red-500/15 text-red-500 border-red-500/30" },
  REJEITADA: { label: "REJEITADA", cls: "bg-red-500/15 text-red-500 border-red-500/30" },
  LIQUIDADA: { label: "LIQUIDADA", cls: "bg-green-500/15 text-green-500 border-green-500/30" },
  AGENDADA: { label: "AGENDADA", cls: "bg-blue-500/15 text-blue-500 border-blue-500/30" },
};

function StatusBadge({ status }: { status: string }) {
  const meta = statusBadgeVariant[status] ?? { label: status, cls: "bg-muted text-foreground" };
  return <Badge variant="outline" className={meta.cls}>{meta.label}</Badge>;
}

export function PixAutomaticoSection({ student }: Props) {
  const qc = useQueryClient();
  const [openAtivar, setOpenAtivar] = useState(false);
  const [openCobranca, setOpenCobranca] = useState(false);
  const [cancelando, setCancelando] = useState(false);

  const recQuery = useQuery({
    queryKey: ["pix_rec", student.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pix_recorrencias" as any)
        .select("*")
        .eq("aluno_id", student.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data as any;
    },
  });

  const cobQuery = useQuery({
    queryKey: ["pix_cob", student.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pix_cobrancas" as any)
        .select("*")
        .eq("aluno_id", student.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });

  useEffect(() => {
    const ch = supabase
      .channel(`pix-${student.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "pix_recorrencias", filter: `aluno_id=eq.${student.id}` },
        () => qc.invalidateQueries({ queryKey: ["pix_rec", student.id] }))
      .on("postgres_changes", { event: "*", schema: "public", table: "pix_cobrancas", filter: `aluno_id=eq.${student.id}` },
        () => qc.invalidateQueries({ queryKey: ["pix_cob", student.id] }))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [student.id, qc]);

  const rec = recQuery.data;
  const recAtiva = rec && ["AGUARDANDO_AUTORIZACAO", "AUTORIZADA"].includes(rec.status);

  async function handleCancelar() {
    if (!rec?.id_rec) return;
    setCancelando(true);
    try {
      const { data, error } = await supabase.functions.invoke("pix-cancelar-recorrencia", {
        body: { idRec: rec.id_rec },
      });
      if (error || data?.error) throw new Error(data?.error || error?.message);
      toast.success("Pix Automático cancelado");
      qc.invalidateQueries({ queryKey: ["pix_rec", student.id] });
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao cancelar");
    } finally {
      setCancelando(false);
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2">
        <div>
          <CardTitle>Pix Automático</CardTitle>
          <p className="text-sm text-muted-foreground mt-1">
            Recorrência mensal via Banco Inter, debitada automaticamente após autorização do aluno.
          </p>
        </div>
        {rec && <StatusBadge status={rec.status} />}
      </CardHeader>
      <CardContent className="space-y-6">
        {!recAtiva && (
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 rounded-md border border-dashed p-4">
            <p className="text-sm text-muted-foreground">
              {rec ? "A recorrência anterior está encerrada." : "Nenhuma recorrência ativa para este aluno."}
            </p>
            <Button onClick={() => setOpenAtivar(true)}>Ativar Pix Automático</Button>
          </div>
        )}

        {rec?.status === "AGUARDANDO_AUTORIZACAO" && (
          <div className="rounded-md bg-yellow-500/10 border border-yellow-500/30 p-4 text-sm">
            O aluno receberá uma notificação no app do banco para autorizar.
            Após a autorização, as cobranças serão debitadas automaticamente todo mês.
          </div>
        )}

        {rec?.status === "AUTORIZADA" && (
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 rounded-md border p-4">
            <div className="text-sm">
              <div>Valor mínimo: <strong>{brl(rec.valor_minimo)}</strong></div>
              <div className="text-muted-foreground">Início {rec.data_inicio}{rec.data_fim ? ` · Fim ${rec.data_fim}` : ""}</div>
            </div>
            <Button onClick={() => setOpenCobranca(true)}>Gerar cobrança do mês</Button>
          </div>
        )}

        <div>
          <h4 className="text-sm font-medium mb-2">Histórico de cobranças</h4>
          {cobQuery.isLoading ? (
            <p className="text-sm text-muted-foreground">Carregando...</p>
          ) : (cobQuery.data?.length ?? 0) === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma cobrança registrada.</p>
          ) : (
            <div className="divide-y border rounded-md">
              {cobQuery.data!.map((c) => (
                <div key={c.id} className="flex items-center justify-between p-3 text-sm">
                  <div>
                    <div className="font-medium">{brl(c.valor)}</div>
                    <div className="text-xs text-muted-foreground">
                      Vence {c.data_vencimento} · txid {String(c.txid).slice(0, 10)}…
                      {c.descricao ? ` · ${c.descricao}` : ""}
                    </div>
                    {c.motivo_rejeicao && (
                      <div className="text-xs text-red-500 mt-1">Motivo: {c.motivo_rejeicao}</div>
                    )}
                  </div>
                  <StatusBadge status={c.status} />
                </div>
              ))}
            </div>
          )}
        </div>

        {recAtiva && (
          <div className="pt-2 border-t">
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" size="sm" disabled={cancelando}>
                  Cancelar Pix Automático
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Cancelar Pix Automático?</AlertDialogTitle>
                  <AlertDialogDescription>
                    A recorrência será encerrada no banco e não serão geradas mais cobranças automáticas.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Voltar</AlertDialogCancel>
                  <AlertDialogAction onClick={handleCancelar}>Confirmar cancelamento</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        )}
      </CardContent>

      <AtivarPixDialog
        open={openAtivar} onOpenChange={setOpenAtivar}
        alunoId={student.id}
        onDone={() => qc.invalidateQueries({ queryKey: ["pix_rec", student.id] })}
      />
      {rec?.id_rec && (
        <GerarCobrancaDialog
          open={openCobranca} onOpenChange={setOpenCobranca}
          idRec={rec.id_rec}
          onDone={() => qc.invalidateQueries({ queryKey: ["pix_cob", student.id] })}
        />
      )}
    </Card>
  );
}
