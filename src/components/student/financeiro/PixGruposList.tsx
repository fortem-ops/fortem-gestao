import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import type { Tables } from "@/integrations/supabase/types";
import { MAX_CODIGOS, podeGerarCodigo, type GrupoPixStatus } from "@/lib/pixAutomaticoGrupo";
import { PrimeiraMensalidadePix } from "./PrimeiraMensalidadePix";
import { CodigoPixAutorizacao, gerarCodigoGrupo, mensagemErroPix, type CodigoGerado } from "./pixAutomaticoGrupoUi";

type Grupo = Tables<"pix_aut_grupos"> & {
  pix_aut_itens: Tables<"pix_aut_itens">[];
  pix_recorrencias: Pick<Tables<"pix_recorrencias">, "id_rec" | "status" | "raw_response"> | null;
};

const STATUS: Record<GrupoPixStatus, { label: string; cls: string }> = {
  rascunho: { label: "RASCUNHO", cls: "bg-muted text-foreground" },
  aguardando_autorizacao: { label: "AGUARDANDO AUTORIZAÇÃO", cls: "bg-warning/15 text-warning border-warning/30" },
  ativa: { label: "ATIVA", cls: "bg-success/15 text-success border-success/30" },
  falha: { label: "FALHA", cls: "bg-destructive/15 text-destructive border-destructive/30" },
  cancelada: { label: "CANCELADA", cls: "bg-muted text-muted-foreground" },
};

const brl = (v: number | string) => Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const dataBr = (d: string | null) => (d ? d.slice(0, 10).split("-").reverse().join("/") : "—");

function copiaColaSalvo(raw: unknown): string | null {
  const r = raw as { dadosQR?: { pixCopiaECola?: unknown } } | null;
  return typeof r?.dadosQR?.pixCopiaECola === "string" ? r.dadosQR.pixCopiaECola : null;
}

export function usePixGrupos(alunoId: string) {
  return useQuery({
    queryKey: ["pix_aut_grupos", alunoId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pix_aut_grupos")
        .select("*, pix_aut_itens(*), pix_recorrencias(id_rec, status, raw_response)")
        .eq("aluno_id", alunoId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as Grupo[];
    },
  });
}

export function PixGruposList({ alunoId, isAdmin }: { alunoId: string; isAdmin: boolean }) {
  const qc = useQueryClient();
  const q = usePixGrupos(alunoId);
  const [codigo, setCodigo] = useState<CodigoGerado | null>(null);
  const [ocupado, setOcupado] = useState<string | null>(null);
  const atualizar = () => {
    qc.invalidateQueries({ queryKey: ["pix_aut_grupos", alunoId] });
    qc.invalidateQueries({ queryKey: ["pix_rec", alunoId] });
  };

  async function novoCodigo(g: Grupo) {
    setOcupado(g.id);
    try { setCodigo(await gerarCodigoGrupo(g.id)); toast.success("Novo código gerado"); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Falha ao gerar código"); }
    finally { setOcupado(null); atualizar(); }
  }

  async function cancelar(g: Grupo) {
    setOcupado(g.id);
    try {
      const rec = g.pix_recorrencias;
      if (rec?.id_rec && ["CRIADA", "AGUARDANDO_AUTORIZACAO", "AUTORIZADA"].includes(rec.status)) {
        const { data, error } = await supabase.functions.invoke("pix-cancelar-recorrencia", {
          body: { idRec: rec.id_rec, motivo: "Cancelada pela equipe" },
        });
        const d = data as { error?: string } | null;
        if (error || d?.error) throw new Error(d?.error ?? error?.message);
      }
      const { error } = await supabase.rpc("fn_pix_aut_grupo_cancelar", { p_grupo: g.id, p_motivo: "Cancelada pela equipe" });
      if (error) throw new Error(mensagemErroPix(error.message));
      toast.success("Autorização cancelada");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao cancelar");
    } finally { setOcupado(null); atualizar(); }
  }

  const grupos = q.data ?? [];
  if (q.isLoading) return <p className="text-sm text-muted-foreground">Carregando...</p>;
  if (grupos.length === 0) return null;

  return (
    <div className="space-y-3">
      {grupos.map((g) => {
        const st = STATUS[g.status as GrupoPixStatus] ?? STATUS.rascunho;
        const copia = copiaColaSalvo(g.pix_recorrencias?.raw_response);
        const ativos = g.pix_aut_itens.filter((i) => !i.ativo_ate || g.status === "cancelada");
        return (
          <div key={g.id} className="rounded-md border p-4 space-y-3 text-sm">
            <div className="flex items-center justify-between gap-2">
              <div className="font-medium">Autorização de {dataBr(g.created_at)}</div>
              <Badge variant="outline" className={st.cls}>{st.label}</Badge>
            </div>
            <div className="divide-y rounded-md border">
              {ativos.map((i) => (
                <div key={i.id} className="flex justify-between p-2">
                  <span>{i.descricao ?? "Item"} <span className="text-xs text-muted-foreground">({i.item_tipo === "plano" ? "plano adicional" : "contrato"})</span></span>
                  <span>{brl(i.valor)}</span>
                </div>
              ))}
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
              <div><div className="text-muted-foreground">Soma</div><div className="font-semibold">{brl(g.valor_soma)}</div></div>
              <div><div className="text-muted-foreground">Valor máximo sugerido</div><div className="font-semibold">{brl(g.valor_teto)}</div></div>
              <div><div className="text-muted-foreground">Dia do débito</div><div className="font-semibold">{dataBr(g.dia_debito)}</div></div>
              <div><div className="text-muted-foreground">Códigos usados</div><div className="font-semibold">{g.codigos_gerados} de {MAX_CODIGOS}</div></div>
            </div>
            {g.status === "aguardando_autorizacao" && g.codigo_expira_em && (
              <p className="text-xs text-muted-foreground">Código válido até {new Date(g.codigo_expira_em).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}.</p>
            )}
            {(g.status === "aguardando_autorizacao" || g.status === "ativa") && <PrimeiraMensalidadePix grupoId={g.id} isAdmin={isAdmin} />}
            {g.motivo && g.status !== "ativa" && <p className="text-xs text-muted-foreground">Motivo: {g.motivo}</p>}
            {g.status === "ativa" && (
              <p className="text-xs text-muted-foreground">
                Autorizada. A cobrança mensal automática ainda não está ativa: as mensalidades seguem cobradas como hoje.
                Voltar ao cartão ficará disponível em uma próxima etapa.
              </p>
            )}
            {isAdmin && g.status !== "ativa" && g.status !== "cancelada" && (
              <div className="flex flex-wrap gap-2">
                {copia && g.status === "aguardando_autorizacao" && (
                  <Button size="sm" variant="outline" onClick={() => setCodigo({
                    pix_copia_cola: copia, expira: g.codigo_expira_em ?? new Date().toISOString(),
                    codigo_numero: g.codigos_gerados, solicitacao_app: false,
                  })}>Ver código</Button>
                )}
                {podeGerarCodigo(g.status as GrupoPixStatus, g.codigos_gerados) && (
                  <Button size="sm" variant="outline" disabled={ocupado === g.id} onClick={() => novoCodigo(g)}>
                    {g.codigos_gerados === 0 ? "Gerar código" : "Gerar novo código"}
                  </Button>
                )}
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button size="sm" variant="destructive" disabled={ocupado === g.id}>Cancelar</Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Cancelar esta autorização?</AlertDialogTitle>
                      <AlertDialogDescription>O código deixa de valer no banco e os itens ficam livres.</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Voltar</AlertDialogCancel>
                      <AlertDialogAction onClick={() => cancelar(g)}>Confirmar</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            )}
          </div>
        );
      })}
      <Dialog open={!!codigo} onOpenChange={(v) => { if (!v) setCodigo(null); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Código de autorização</DialogTitle></DialogHeader>
          {codigo && <CodigoPixAutorizacao codigo={codigo} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}
