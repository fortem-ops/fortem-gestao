import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useStudentPortal } from "@/contexts/StudentPortalContext";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { FileText, FileSignature, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface ContratoDocumento {
  id: string;
  aluno_id: string;
  conteudo_gerado: string;
  aceite: boolean;
  data_aceite: string | null;
  formato_aceite: string | null;
  ip_aceite: string | null;
  created_at: string;
}

interface LegalAnnexRow {
  id: string;
  signed_at: string | null;
}

function preencherMergeFields(
  html: string,
  values: { assinatura?: string; aceite?: string; data_aceite?: string; formato_aceite?: string; ip_aceite?: string },
) {
  return html
    .replace(/%ASSINATURA%/g, values.assinatura ?? "")
    .replace(/%ACEITE%/g, values.aceite ?? "")
    .replace(/%DATA_ACEITE%/g, values.data_aceite ?? "")
    .replace(/%FORMATO_ACEITE%/g, values.formato_aceite ?? "")
    .replace(/%IP_ACEITE%/g, values.ip_aceite ?? "");
}

export default function PortalContratos() {
  const { student } = useStudentPortal();
  const qc = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<"aceitar" | "ler">("ler");
  const [aceitando, setAceitando] = useState(false);

  const { data: contratoDoc, isLoading: loadingContrato } = useQuery({
    queryKey: ["portal-contrato-documento", student?.id],
    enabled: !!student,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contratos_documentos")
        .select("id, aluno_id, conteudo_gerado, aceite, data_aceite, formato_aceite, ip_aceite, created_at")
        .eq("aluno_id", student!.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data as ContratoDocumento | null;
    },
  });

  const { data: anexo, isLoading: loadingAnexo } = useQuery({
    queryKey: ["portal-legal-annex", student?.id],
    enabled: !!student,
    queryFn: async () => {
      const cpfDigits = (student?.cpf ?? "").replace(/\D/g, "");
      let query = supabase
        .from("legal_annexes")
        .select("id, signed_at")
        .order("signed_at", { ascending: false, nullsFirst: false })
        .limit(1);

      if (cpfDigits) {
        query = query.or(`aluno_id.eq.${student!.id},cpf.eq.${cpfDigits}`);
      } else {
        query = query.eq("aluno_id", student!.id);
      }
      const { data, error } = await query.maybeSingle();
      if (error) throw error;
      return (data as LegalAnnexRow | null) ?? null;
    },
  });

  const conteudoDialog = useMemo(() => {
    if (!contratoDoc) return "";
    if (contratoDoc.aceite) {
      return preencherMergeFields(contratoDoc.conteudo_gerado, {
        assinatura: "Assinatura eletrônica confirmada",
        aceite: "Aceito",
        data_aceite: contratoDoc.data_aceite
          ? format(new Date(contratoDoc.data_aceite), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })
          : "",
        formato_aceite: "Aceite digital via Portal do Aluno",
        ip_aceite: contratoDoc.ip_aceite ?? "",
      });
    }
    return preencherMergeFields(contratoDoc.conteudo_gerado, {});
  }, [contratoDoc]);

  const abrirParaAceitar = () => {
    setDialogMode("aceitar");
    setDialogOpen(true);
  };
  const abrirParaLer = () => {
    setDialogMode("ler");
    setDialogOpen(true);
  };

  const confirmarAceite = async () => {
    if (!contratoDoc) return;
    setAceitando(true);
    try {
      const { data, error } = await supabase.functions.invoke("aceitar-contrato-documento", {
        body: { contrato_documento_id: contratoDoc.id },
      });
      if (error || (data as any)?.error) {
        throw new Error(error?.message || (data as any)?.error || "Falha ao registrar aceite");
      }
      toast.success("Contrato aceito com sucesso");
      setDialogOpen(false);
      qc.invalidateQueries({ queryKey: ["portal-contrato-documento", student?.id] });
      qc.invalidateQueries({ queryKey: ["portal-home-pendencias", student?.id] });
    } catch (e: any) {
      toast.error(e.message ?? "Erro ao registrar aceite");
    } finally {
      setAceitando(false);
    }
  };

  if (!student) return null;

  return (
    <div className="space-y-5 pb-32 animate-fade-in">
      <div className="pt-2">
        <h1 className="text-2xl font-black text-foreground" style={{ fontFamily: "Archivo,sans-serif" }}>
          Meus Contratos
        </h1>
        <p className="text-sm text-muted-foreground mt-1">Documentos legais da sua matrícula</p>
      </div>

      {/* Bloco 1 — Contrato */}
      <section className="space-y-2">
        <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
          Contrato de Prestação de Serviços
        </p>
        <div className="bg-card border border-border rounded-2xl p-5">
          {loadingContrato ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin" /> Carregando…
            </div>
          ) : !contratoDoc ? (
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#2C2C2C] flex items-center justify-center shrink-0">
                <FileText className="w-5 h-5 text-muted-foreground" />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">Nenhum contrato disponível no momento</p>
                <p className="text-xs text-muted-foreground">Assim que a coordenação gerar seu contrato, ele aparecerá aqui.</p>
              </div>
            </div>
          ) : contratoDoc.aceite ? (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center shrink-0">
                  <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-foreground">Contrato assinado</p>
                  <p className="text-xs text-muted-foreground">
                    Aceito em{" "}
                    {contratoDoc.data_aceite
                      ? format(new Date(contratoDoc.data_aceite), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })
                      : "—"}
                  </p>
                </div>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400">
                  Assinado
                </span>
              </div>
              <Button variant="outline" className="w-full" onClick={abrirParaLer}>
                <FileText className="w-4 h-4 mr-2" /> Ver contrato
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center shrink-0">
                  <AlertCircle className="w-5 h-5 text-amber-400" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-foreground">Pendente de aceite</p>
                  <p className="text-xs text-muted-foreground">Leia o contrato e confirme para concluir sua matrícula.</p>
                </div>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400">
                  Pendente
                </span>
              </div>
              <Button className="w-full" onClick={abrirParaAceitar}>
                <FileSignature className="w-4 h-4 mr-2" /> Ler e Aceitar Contrato
              </Button>
            </div>
          )}
        </div>
      </section>

      {/* Bloco 2 — Anexo I */}
      <section className="space-y-2">
        <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
          Anexo I — Aptidão Física e Uso de Imagem
        </p>
        <div className="bg-card border border-border rounded-2xl p-5">
          {loadingAnexo ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin" /> Carregando…
            </div>
          ) : anexo?.signed_at ? (
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center shrink-0">
                <CheckCircle2 className="w-5 h-5 text-emerald-400" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-foreground">Anexo I assinado</p>
                <p className="text-xs text-muted-foreground">
                  Assinado em {format(new Date(anexo.signed_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                </p>
              </div>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400">
                Assinado
              </span>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center shrink-0">
                  <AlertCircle className="w-5 h-5 text-amber-400" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-foreground">Pendente</p>
                  <p className="text-xs text-muted-foreground">Preencha a declaração de aptidão física e uso de imagem.</p>
                </div>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400">
                  Pendente
                </span>
              </div>
              <Button asChild className="w-full">
                <Link to="/assinar">
                  <FileSignature className="w-4 h-4 mr-2" /> Preencher Anexo I
                </Link>
              </Button>
            </div>
          )}
        </div>
      </section>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>
              {dialogMode === "aceitar" ? "Leia e aceite o contrato" : "Contrato de Prestação de Serviços"}
            </DialogTitle>
          </DialogHeader>
          <div
            className="flex-1 overflow-y-auto rounded-lg border border-border bg-secondary/30 p-4 prose prose-sm prose-invert max-w-none"
            dangerouslySetInnerHTML={{ __html: conteudoDialog }}
          />
          {dialogMode === "aceitar" && (
            <div className="flex flex-col sm:flex-row gap-2 pt-2">
              <Button variant="outline" className="sm:flex-1" onClick={() => setDialogOpen(false)} disabled={aceitando}>
                Cancelar
              </Button>
              <Button className="sm:flex-1" onClick={confirmarAceite} disabled={aceitando}>
                {aceitando ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <CheckCircle2 className="w-4 h-4 mr-2" />}
                Confirmar aceite
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
