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
  contratos?: { plano_tipo: string | null } | null;
}

interface LegalAnnexRow {
  id: string;
  signed_at: string | null;
}

const CORRIDA_TIPOS = ["corrida", "corrida_sem_plano"];

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

interface BlocoProps {
  titulo: string;
  subtitulo: string;
  vazioMsg: string;
  loading: boolean;
  doc: ContratoDocumento | null;
  onLer: (doc: ContratoDocumento) => void;
  onAceitar: (doc: ContratoDocumento) => void;
}

function ContratoBloco({ titulo, subtitulo, vazioMsg, loading, doc, onLer, onAceitar }: BlocoProps) {
  return (
    <section className="space-y-2">
      <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">{titulo}</p>
      <div className="bg-card border border-border rounded-2xl p-5">
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin" /> Carregando…
          </div>
        ) : !doc ? (
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#2C2C2C] flex items-center justify-center shrink-0">
              <FileText className="w-5 h-5 text-muted-foreground" />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">Nenhum contrato disponível no momento</p>
              <p className="text-xs text-muted-foreground">{vazioMsg}</p>
            </div>
          </div>
        ) : doc.aceite ? (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center shrink-0">
                <CheckCircle2 className="w-5 h-5 text-emerald-400" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-foreground">{subtitulo}</p>
                <p className="text-xs text-muted-foreground">
                  Aceito em{" "}
                  {doc.data_aceite
                    ? format(new Date(doc.data_aceite), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })
                    : "—"}
                </p>
              </div>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400">
                Assinado
              </span>
            </div>
            <Button variant="outline" className="w-full" onClick={() => onLer(doc)}>
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
                <p className="text-sm font-semibold text-foreground">{subtitulo}</p>
                <p className="text-xs text-muted-foreground">Leia o contrato e confirme para concluir sua matrícula.</p>
              </div>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400">
                Pendente
              </span>
            </div>
            <Button className="w-full" onClick={() => onAceitar(doc)}>
              <FileSignature className="w-4 h-4 mr-2" /> Ler e Aceitar Contrato
            </Button>
          </div>
        )}
      </div>
    </section>
  );
}

export default function PortalContratos() {
  const { student } = useStudentPortal();
  const qc = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<"aceitar" | "ler">("ler");
  const [docAtivo, setDocAtivo] = useState<ContratoDocumento | null>(null);
  const [aceitando, setAceitando] = useState(false);

  const { data: documentos, isLoading: loadingContrato } = useQuery({
    queryKey: ["portal-contrato-documentos", student?.id],
    enabled: !!student,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contratos_documentos")
        .select(
          "id, aluno_id, conteudo_gerado, aceite, data_aceite, formato_aceite, ip_aceite, created_at, contratos(plano_tipo)",
        )
        .eq("aluno_id", student!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as ContratoDocumento[];
    },
  });

  const funcionalDoc = useMemo(
    () => documentos?.find((d) => !CORRIDA_TIPOS.includes(d.contratos?.plano_tipo ?? "")) ?? null,
    [documentos],
  );
  const corridaDoc = useMemo(
    () => documentos?.find((d) => CORRIDA_TIPOS.includes(d.contratos?.plano_tipo ?? "")) ?? null,
    [documentos],
  );

  const { data: anexo, isLoading: loadingAnexo } = useQuery({
    queryKey: ["portal-legal-annex", student?.id],
    enabled: !!student,
    queryFn: async () => {
      const query = supabase
        .from("legal_annexes")
        .select("id, signed_at")
        .eq("aluno_id", student!.id)
        .order("signed_at", { ascending: false, nullsFirst: false })
        .limit(1);
      const { data, error } = await query.maybeSingle();
      if (error) throw error;
      return (data as LegalAnnexRow | null) ?? null;
    },
  });

  const conteudoDialog = useMemo(() => {
    if (!docAtivo) return "";
    if (docAtivo.aceite) {
      return preencherMergeFields(docAtivo.conteudo_gerado, {
        assinatura: "Assinatura eletrônica confirmada",
        aceite: "Aceito",
        data_aceite: docAtivo.data_aceite
          ? format(new Date(docAtivo.data_aceite), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })
          : "",
        formato_aceite: "Aceite digital via Portal do Aluno",
        ip_aceite: docAtivo.ip_aceite ?? "",
      });
    }
    return preencherMergeFields(docAtivo.conteudo_gerado, {});
  }, [docAtivo]);

  const abrirParaAceitar = (doc: ContratoDocumento) => {
    setDocAtivo(doc);
    setDialogMode("aceitar");
    setDialogOpen(true);
  };
  const abrirParaLer = (doc: ContratoDocumento) => {
    setDocAtivo(doc);
    setDialogMode("ler");
    setDialogOpen(true);
  };

  const confirmarAceite = async () => {
    if (!docAtivo) return;
    setAceitando(true);
    try {
      const { data, error } = await supabase.functions.invoke("aceitar-contrato-documento", {
        body: { contrato_documento_id: docAtivo.id },
      });
      if (error || (data as any)?.error) {
        throw new Error(error?.message || (data as any)?.error || "Falha ao registrar aceite");
      }
      toast.success("Contrato aceito com sucesso");
      setDialogOpen(false);
      qc.invalidateQueries({ queryKey: ["portal-contrato-documentos", student?.id] });
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

      {/* Bloco 1 — Treinamento Funcional */}
      <ContratoBloco
        titulo="Treinamento Funcional"
        subtitulo="Contrato de Prestação de Serviços"
        vazioMsg="Assim que a coordenação gerar seu contrato de treinamento, ele aparecerá aqui."
        loading={loadingContrato}
        doc={funcionalDoc}
        onLer={abrirParaLer}
        onAceitar={abrirParaAceitar}
      />

      {/* Bloco 2 — Grupo de Corrida */}
      <ContratoBloco
        titulo="Grupo de Corrida"
        subtitulo="Contrato de Prestação de Serviços — Corrida"
        vazioMsg="Assim que a coordenação gerar seu contrato de Corrida, ele aparecerá aqui."
        loading={loadingContrato}
        doc={corridaDoc}
        onLer={abrirParaLer}
        onAceitar={abrirParaAceitar}
      />

      {/* Bloco 3 — Anexo I */}
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
