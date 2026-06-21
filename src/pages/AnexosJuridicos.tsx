import { useState, useMemo } from "react";
import { Shield, Search, Filter, Users, RefreshCw, Eye, Trash2, FileText, Link2, ExternalLink, Download } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import AnnexDetailModal, { AnnexDetail } from "@/components/legal-annex/AnnexDetailModal";
import { Link } from "react-router-dom";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";

type MedicalType = "ok" | "restricao";
type DocType = "anexo" | "experimental";

interface AnnexRow extends AnnexDetail {
  aluno_id: string | null;
  aluno?: { id: string; nome: string } | null;
}

const fetchAnnexes = async (): Promise<AnnexRow[]> => {
  const { data, error } = await supabase
    .from("legal_annexes")
    .select("id, nome, cpf, email, telefone, data_nascimento, signed_at, valid_until, medical_status, image_usage, signature_data, ip_address, attachment_url, document_type, emergency_contact_name, emergency_contact_phone, aluno_id, aluno:alunos(id, nome)")
    .order("signed_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as AnnexRow[];
};

const fetchAlunosByCpf = async (): Promise<Map<string, { id: string; nome: string }>> => {
  const map = new Map<string, { id: string; nome: string }>();
  const { data } = await supabase.from("alunos").select("id, nome, cpf").not("cpf", "is", null);
  (data ?? []).forEach((a: any) => {
    const norm = (a.cpf || "").replace(/\D/g, "");
    if (norm) map.set(norm, { id: a.id, nome: a.nome });
  });
  return map;
};

const AnexosJuridicos = () => {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [medicalFilter, setMedicalFilter] = useState<MedicalType | "all">("all");
  const [docFilter, setDocFilter] = useState<DocType | "all">("all");
  const [imageFilter, setImageFilter] = useState<"true" | "false" | "all">("all");
  const [selected, setSelected] = useState<AnnexRow | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AnnexRow | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [importing, setImporting] = useState(false);

  const { data: annexes = [], isLoading, refetch } = useQuery({ queryKey: ["legal_annexes"], queryFn: fetchAnnexes });

  const { data: alunosByCpf } = useQuery({
    queryKey: ["alunos_by_cpf_all"],
    queryFn: fetchAlunosByCpf,
  });

  const handleImport = async () => {
    setImporting(true);
    try {
      const { data, error } = await supabase.functions.invoke("migrate-from-consent-care");
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success("Importação concluída", { description: `${data.imported} importados, ${data.skipped} já existiam, ${data.errors} erros (de ${data.total_source} encontrados na origem).` });
      qc.invalidateQueries({ queryKey: ["legal_annexes"] });
    } catch (e: any) {
      toast.error("Erro na importação", { description: e.message });
    } finally {
      setImporting(false);
      setImportOpen(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    const { error } = await supabase.from("legal_annexes").delete().eq("id", deleteTarget.id);
    if (error) toast.error("Erro ao excluir", { description: error.message });
    else { toast("Registro excluído com sucesso"); qc.invalidateQueries({ queryKey: ["legal_annexes"] }); }
    setDeleteTarget(null);
  };

  const filtered = useMemo(() => annexes.filter((d) => {
    if (search && !d.nome.toLowerCase().includes(search.toLowerCase()) && !d.cpf.includes(search)) return false;
    if (medicalFilter !== "all" && d.medical_status !== medicalFilter) return false;
    if (docFilter !== "all" && d.document_type !== docFilter) return false;
    if (imageFilter !== "all" && d.image_usage !== (imageFilter === "true")) return false;
    return true;
  }), [search, medicalFilter, imageFilter, docFilter, annexes]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <Shield className="w-6 h-6 text-primary" />
          <div>
            <h1 className="text-2xl font-semibold">Anexos Jurídicos</h1>
            <p className="text-sm text-muted-foreground">Documentos de aptidão física e uso de imagem</p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button variant="outline" size="sm" asChild className="gap-2">
            <a href="/assinar" target="_blank" rel="noopener noreferrer">
              <ExternalLink className="w-4 h-4" /> <span className="hidden sm:inline">Link de assinatura</span>
            </a>
          </Button>
          <Button variant="outline" size="sm" onClick={() => setImportOpen(true)} className="gap-2" disabled={importing}>
            <Download className="w-4 h-4" /> <span className="hidden sm:inline">{importing ? "Importando..." : "Importar Consent & Care"}</span>
          </Button>
          <Button variant="ghost" size="sm" onClick={() => refetch()} className="gap-1.5">
            <RefreshCw className="w-4 h-4" /> <span className="hidden sm:inline">Atualizar</span>
          </Button>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Users className="w-4 h-4" /> {annexes.length}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por nome ou CPF..." className="pl-9 h-10" />
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Filter className="w-4 h-4 text-muted-foreground" />
          <select value={docFilter} onChange={(e) => setDocFilter(e.target.value as DocType | "all")} className="h-10 rounded-md border border-input bg-background px-3 text-sm">
            <option value="all">Todos os tipos</option>
            <option value="anexo">Anexo padrão</option>
            <option value="experimental">Treino Experimental</option>
          </select>
          <select value={medicalFilter} onChange={(e) => setMedicalFilter(e.target.value as MedicalType | "all")} className="h-10 rounded-md border border-input bg-background px-3 text-sm">
            <option value="all">Avaliação médica</option>
            <option value="ok">Sem restrições</option>
            <option value="restricao">Com restrições</option>
          </select>
          <select value={imageFilter} onChange={(e) => setImageFilter(e.target.value as any)} className="h-10 rounded-md border border-input bg-background px-3 text-sm">
            <option value="all">Uso de imagem</option>
            <option value="true">Autorizado</option>
            <option value="false">Não autorizado</option>
          </select>
        </div>
      </div>

      <div className="bg-card rounded-2xl card-shadow overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-16 text-muted-foreground text-sm">Carregando documentos...</div>
        ) : (
          <div className="overflow-x-auto">
          <table className="w-full min-w-[720px]">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left text-xs font-medium text-muted-foreground px-5 py-3">Nome</th>
                <th className="text-left text-xs font-medium text-muted-foreground px-5 py-3">Tipo</th>
                <th className="text-left text-xs font-medium text-muted-foreground px-5 py-3">CPF</th>
                <th className="text-left text-xs font-medium text-muted-foreground px-5 py-3">Assinado em</th>
                <th className="text-left text-xs font-medium text-muted-foreground px-5 py-3">Médico</th>
                <th className="text-left text-xs font-medium text-muted-foreground px-5 py-3">Imagem</th>
                <th className="text-left text-xs font-medium text-muted-foreground px-5 py-3">Aluno vinculado</th>
                <th className="text-center text-xs font-medium text-muted-foreground px-3 py-3">Ações</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((doc) => {
                const isExp = doc.document_type === "experimental";
                return (
                  <tr key={doc.id} className="border-b border-border/50 last:border-0 hover:bg-secondary/30 transition-colors">
                    <td className="px-5 py-4 text-sm font-medium">{doc.nome}</td>
                    <td className="px-5 py-4">
                      <span className={cn("inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium", isExp ? "bg-info/15 text-info" : "bg-primary/10 text-primary")}>
                        {isExp ? "Experimental" : "Anexo"}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-sm font-mono text-muted-foreground tabular-nums">{doc.cpf}</td>
                    <td className="px-5 py-4 text-sm text-muted-foreground">{new Date(doc.signed_at).toLocaleDateString("pt-BR")}</td>
                    <td className="px-5 py-4 text-sm text-muted-foreground">{doc.medical_status === "ok" ? "OK" : "Restrição"}</td>
                    <td className="px-5 py-4 text-sm text-muted-foreground">{isExp ? "—" : doc.image_usage ? "Sim" : "Não"}</td>
                    <td className="px-5 py-4 text-sm">
                      {(() => {
                        const match = alunosByCpf?.get((doc.cpf || "").replace(/\D/g, ""));
                        if (!match) return <span className="text-muted-foreground/60 text-xs">—</span>;
                        return (
                          <Link to={`/alunos/${match.id}`} className="inline-flex items-center gap-1 text-primary hover:underline">
                            <Link2 className="w-3 h-3" /> {match.nome}
                          </Link>
                        );
                      })()}
                    </td>
                    <td className="px-3 py-4 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <button onClick={() => setSelected(doc)} className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground" title="Ver detalhes">
                          <Eye className="w-4 h-4" />
                        </button>
                        {doc.attachment_url && (() => {
                          let safe = false;
                          try { const u = new URL(doc.attachment_url); safe = u.protocol === "https:" || u.protocol === "http:"; } catch { safe = false; }
                          return safe ? (
                            <a href={doc.attachment_url} target="_blank" rel="noopener noreferrer" className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground" title="Ver atestado">
                              <FileText className="w-4 h-4" />
                            </a>
                          ) : null;
                        })()}
                        <button onClick={() => setDeleteTarget(doc)} className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive" title="Excluir">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr><td colSpan={8} className="px-5 py-12 text-center text-sm text-muted-foreground">Nenhum documento encontrado</td></tr>
              )}
            </tbody>
          </table>
          </div>
        )}
      </div>

      <AnnexDetailModal annex={selected} open={!!selected} onClose={() => setSelected(null)} />

      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir registro</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir o registro de <strong>{deleteTarget?.nome}</strong>? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={importOpen} onOpenChange={(o) => !o && setImportOpen(false)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Importar do Consent & Care</AlertDialogTitle>
            <AlertDialogDescription>
              Vou ler todos os termos assinados no projeto Consent & Care e trazer para cá.
              Registros já existentes (mesmo CPF e mesma data de assinatura) são ignorados.
              Pode levar alguns minutos.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={importing}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleImport} disabled={importing}>
              {importing ? "Importando..." : "Importar agora"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default AnexosJuridicos;
