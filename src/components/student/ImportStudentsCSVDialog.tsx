import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Upload, Download, FileUp, AlertCircle, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import {
  buildTemplateCSV,
  buildTemplateXLSX,
  parseCSV,
  parseXLSX,
  validateRows,
  importStudents,
  loadImportContext,
  CSV_HEADERS,
  type ImportStatus,
  type ValidatedRow,
  type ImportResult,
} from "@/lib/studentImport";

interface Props {
  status: ImportStatus;
  onImported: () => void;
}

export default function ImportStudentsCSVDialog({ status, onImported }: Props) {
  const [open, setOpen] = useState(false);
  const [validated, setValidated] = useState<ValidatedRow[]>([]);
  const [fileName, setFileName] = useState<string>("");
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);

  function reset() {
    setValidated([]);
    setFileName("");
    setResult(null);
  }

  function downloadTemplate() {
    const blob = new Blob([buildTemplateCSV()], { type: "text/csv;charset=utf-8;" });
    triggerDownload(blob, "modelo-importacao-alunos.csv");
  }

  function downloadTemplateXLSX() {
    triggerDownload(buildTemplateXLSX(), "modelo-importacao-alunos.xlsx");
  }

  function triggerDownload(blob: Blob, filename: string) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  async function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setResult(null);
    try {
      const isXlsx = /\.xlsx$/i.test(file.name);
      let rows: Record<string, string>[];
      let ignored: string[] = [];
      if (isXlsx) {
        const parsed = await parseXLSX(file);
        rows = parsed.rows;
        ignored = parsed.ignoredHeaders;
      } else {
        const text = await file.text();
        rows = parseCSV(text);
      }
      if (!rows.length) {
        toast.error("Planilha vazia ou sem linhas de dados.");
        setValidated([]);
        return;
      }
      if (!isXlsx) {
        const unknownHeaders = Object.keys(rows[0]).filter(
          (h) => !CSV_HEADERS.includes(h as any)
        );
        if (unknownHeaders.length) {
          toast.warning(`Colunas desconhecidas ignoradas: ${unknownHeaders.join(", ")}`);
        }
      } else if (ignored.length) {
        toast.warning(`Colunas ignoradas: ${ignored.join(", ")}`);
      }
      const ctx = await loadImportContext(status);
      setValidated(validateRows(rows, ctx));
    } catch (err: any) {
      toast.error(err.message || "Erro ao ler arquivo.");
    } finally {
      e.target.value = "";
    }
  }

  async function runImport() {
    if (!validated.length) return;
    setImporting(true);
    try {
      const ctx = await loadImportContext(status);
      const res = await importStudents(validated, ctx);
      setResult(res);
      if (res.success > 0) {
        toast.success(`${res.success} aluno${res.success > 1 ? "s" : ""} importado${res.success > 1 ? "s" : ""}.`);
        onImported();
      }
      if (res.failed.length) {
        toast.error(`${res.failed.length} linha${res.failed.length > 1 ? "s" : ""} com erro.`);
      }
    } catch (err: any) {
      toast.error(err.message || "Erro na importação.");
    } finally {
      setImporting(false);
    }
  }

  const validCount = validated.filter((v) => v.errors.length === 0).length;
  const errorCount = validated.length - validCount;
  const warningCount = validated.filter((v) => v.warnings.length > 0).length;

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) reset();
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2">
          <Upload className="w-4 h-4" />
          Importar CSV / Excel
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[720px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Importar alunos via CSV ou Excel</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          <div className="rounded-lg border border-border/50 bg-muted/30 p-4 space-y-2 text-sm">
            <p className="font-medium text-foreground">Como preencher a planilha</p>
            <p className="text-muted-foreground">
              Aceitamos <code>.csv</code> (separado por vírgula, UTF-8) ou <code>.xlsx</code>. A primeira linha deve conter os cabeçalhos.
            </p>
            <p className="text-xs text-muted-foreground">
              <b>Cabeçalhos CSV (na ordem):</b>
            </p>
            <ol className="text-xs text-muted-foreground list-decimal ml-5 space-y-0.5">
              <li><b>Dados cadastrais:</b> <code>nome</code> (obrigatório), <code>email</code>, <code>telefone</code>, <code>data_nascimento</code> (AAAA-MM-DD), <code>sexo</code>, <code>frequencia_semanal</code> (0–3), <code>observacoes</code></li>
              <li><b>Documento e endereço:</b> <code>cpf</code>, <code>rg</code>, <code>cep</code>, <code>logradouro</code>, <code>numero</code>, <code>complemento</code>, <code>bairro</code>, <code>cidade</code>, <code>uf</code></li>
              <li><b>Professor:</b> <code>professor_nome</code></li>
              <li><b>Plano (opcional):</b> <code>plano_tipo</code>, <code>plano_valor</code>, <code>plano_data_inicio</code>, <code>plano_consultas</code></li>
              <li><b>Origem (opcional):</b> <code>origem_lead</code></li>
              <li><b>Status (opcional):</b> <code>status_cliente</code> (ativo/encerrado/lead) — quando preenchido, sobrepõe o status da tela</li>
            </ol>
            <p className="text-xs text-muted-foreground">
              <b>Planilha Excel (.xlsx):</b> aceitamos o layout da Fortem com cabeçalhos em português — Cliente, E-mail, Telefone, Data de Nascimento, Sexo, Frequencia Semanal, Professor, Plano, Plano Valor, Plano data de início, Plano Consultas, Origem, Status Cliente, CPF, RG, CEP, Logradouro, Número, Complemento, Bairro, Cidade, UF. Datas podem estar em <code>DD/MM/AAAA</code>. Colunas fora dessa lista (Objetivo, Modalidade, Estado Civil, Responsável, contatos de emergência etc.) são ignoradas com aviso.
            </p>
            <p className="text-xs text-muted-foreground">
              <b>Duplicidade permitida:</b> e-mails/telefones repetidos geram apenas aviso.
            </p>
            <div className="flex gap-3 flex-wrap">
              <Button variant="link" size="sm" className="px-0 h-auto gap-1" onClick={downloadTemplate}>
                <Download className="w-3.5 h-3.5" /> Baixar modelo CSV
              </Button>
              <Button variant="link" size="sm" className="px-0 h-auto gap-1" onClick={downloadTemplateXLSX}>
                <Download className="w-3.5 h-3.5" /> Baixar modelo XLSX
              </Button>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <label className="cursor-pointer">
              <input
                type="file"
                accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                className="hidden"
                onChange={onFileChange}
              />
              <span className="inline-flex items-center gap-2 px-3 py-2 text-sm rounded-md border border-border bg-background hover:bg-muted">
                <FileUp className="w-4 h-4" />
                Escolher arquivo
              </span>
            </label>
            {fileName && <span className="text-sm text-muted-foreground truncate">{fileName}</span>}
          </div>


          {validated.length > 0 && !result && (
            <div className="space-y-3">
              <div className="flex flex-wrap gap-2 text-xs">
                <span className="px-2 py-1 rounded bg-primary/10 text-primary">
                  {validated.length} linha{validated.length > 1 ? "s" : ""}
                </span>
                <span className="px-2 py-1 rounded bg-green-500/10 text-green-600 dark:text-green-400">
                  {validCount} válida{validCount !== 1 ? "s" : ""}
                </span>
                {errorCount > 0 && (
                  <span className="px-2 py-1 rounded bg-destructive/10 text-destructive">
                    {errorCount} com erro
                  </span>
                )}
                {warningCount > 0 && (
                  <span className="px-2 py-1 rounded bg-yellow-500/10 text-yellow-700 dark:text-yellow-400">
                    {warningCount} com avisos
                  </span>
                )}
              </div>

              <div className="max-h-72 overflow-y-auto rounded-lg border border-border/50">
                <table className="w-full text-xs">
                  <thead className="bg-muted/40 sticky top-0">
                    <tr>
                      <th className="text-left p-2">#</th>
                      <th className="text-left p-2">Nome</th>
                      <th className="text-left p-2">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {validated.map((v) => (
                      <tr key={v.index} className="border-t border-border/40 align-top">
                        <td className="p-2 text-muted-foreground">{v.index}</td>
                        <td className="p-2">{v.raw.nome || "(sem nome)"}</td>
                        <td className="p-2 space-y-1">
                          {v.errors.length === 0 && v.warnings.length === 0 && (
                            <span className="text-green-600 dark:text-green-400 inline-flex items-center gap-1">
                              <CheckCircle2 className="w-3.5 h-3.5" /> OK
                            </span>
                          )}
                          {v.errors.map((e, i) => (
                            <div key={`e${i}`} className="text-destructive inline-flex items-start gap-1">
                              <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" /> {e}
                            </div>
                          ))}
                          {v.warnings.map((w, i) => (
                            <div key={`w${i}`} className="text-yellow-700 dark:text-yellow-400 inline-flex items-start gap-1">
                              <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" /> {w}
                            </div>
                          ))}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {result && (
            <div className="rounded-lg border border-border/50 p-4 space-y-2 text-sm">
              <p className="font-medium text-foreground">Resultado da importação</p>
              <p className="text-green-600 dark:text-green-400">✓ {result.success} importado(s) com sucesso</p>
              {result.failed.length > 0 && (
                <>
                  <p className="text-destructive">✗ {result.failed.length} com erro</p>
                  <ul className="text-xs text-muted-foreground space-y-1 max-h-40 overflow-y-auto">
                    {result.failed.map((f) => (
                      <li key={f.index}>
                        Linha {f.index} — <b>{f.nome}</b>: {f.reason}
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </div>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <Button variant="outline" onClick={() => setOpen(false)}>
              {result ? "Fechar" : "Cancelar"}
            </Button>
            {!result && (
              <Button
                onClick={runImport}
                disabled={importing || validCount === 0}
              >
                {importing ? "Importando..." : `Importar ${validCount} aluno${validCount !== 1 ? "s" : ""}`}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
