import { useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Upload, Loader2, FileText } from "lucide-react";
import { toast } from "sonner";
import {
  uploadAndParseKinology,
  buildForcaPayload,
  persistirForcaNaData,
  listarDatasForcaExistentes,
  brDateToISO,
  type KinologyParseResult,
} from "@/lib/kinologyImport";
import { AssessmentDateField, todayISO } from "./AssessmentDateField";

interface Props {
  alunoId: string;
}

interface DataOpcao {
  /** data original do laudo em ISO */
  iso: string;
  /** data que será realmente gravada (pode ter override manual) */
  isoFinal: string;
  label: string;
  qtd: number;
  jaRegistrada: boolean;
  atual: boolean;
}

function fmtBR(iso: string) {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

export function PremiumKinologyImport({ alunoId }: Props) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [data, setData] = useState<string>(todayISO());
  const [dataTouched, setDataTouched] = useState(false);

  // Estado do diálogo de histórico (laudos com mais de uma data)
  const [parsed, setParsed] = useState<KinologyParseResult | null>(null);
  const [opcoes, setOpcoes] = useState<DataOpcao[]>([]);
  const [selecionadas, setSelecionadas] = useState<Set<string>>(new Set());
  const [salvando, setSalvando] = useState(false);

  function invalidar() {
    qc.invalidateQueries({ queryKey: ["aluno-avaliacoes-consolidadas", alunoId] });
    qc.invalidateQueries({ queryKey: ["avaliacoes-aluno", alunoId] });
    qc.invalidateQueries({ queryKey: ["avaliacoes-global", alunoId] });
  }

  async function handleFile(file: File) {
    if (!user) {
      toast.error("Usuário não autenticado");
      return;
    }
    setBusy(true);
    const toastId = "kinology-import";
    try {
      toast.loading("Lendo laudo...", { id: toastId });
      const result = await uploadAndParseKinology(alunoId, file);
      if (!result.exercicios.length) {
        toast.dismiss(toastId);
        toast.warning("Nenhum exercício reconhecido no laudo.");
        return;
      }
      const sourceLabel = result.source === "deterministic" ? "leitura direta" : "via IA";

      // Data da medição mais recente do laudo:
      // - se o usuário editou o campo manualmente, esse valor vence;
      // - senão usa a data da própria medição (ou a emissão, ou hoje).
      const dataMedicaoISO =
        brDateToISO(result.exercicios[0]?.data) || brDateToISO(result.dataEmissao);
      const finalData = dataTouched
        ? data || todayISO()
        : dataMedicaoISO || data || todayISO();
      if (!dataTouched && dataMedicaoISO) setData(dataMedicaoISO);

      const historicoISO = result.historico
        .map((h) => ({ iso: brDateToISO(h.data), qtd: h.exercicios.length }))
        .filter((h): h is { iso: string; qtd: number } => !!h.iso);

      // Laudo sem página de evolução (ou com uma única data): fluxo direto.
      if (historicoISO.length <= 1) {
        const modo = await persistirForcaNaData({
          alunoId,
          avaliadorId: user.id,
          dataISO: finalData,
          forcaPayload: buildForcaPayload(result),
        });
        toast.dismiss(toastId);
        if (modo === "merge") {
          toast.success(`Força mesclada com sucesso (${sourceLabel})`, {
            description: `${result.exercicios.length} exercício(s) integrados à avaliação existente.`,
          });
        } else {
          toast.success(`Força registrada (${sourceLabel})`, {
            description:
              "Faltam as métricas de mobilidade/flexibilidade para completar a avaliação.",
          });
        }
        invalidar();
        return;
      }

      // Múltiplas datas — pergunta ao usuário o que importar.
      const existentes = await listarDatasForcaExistentes(alunoId);
      const opts: DataOpcao[] = historicoISO.map((h) => {
        const atual = !!dataMedicaoISO && h.iso === dataMedicaoISO;
        const isoFinal = atual ? finalData : h.iso;
        return {
          iso: h.iso,
          isoFinal,
          label: fmtBR(isoFinal),
          qtd: h.qtd,
          jaRegistrada: existentes.has(isoFinal),
          atual,
        };
      });
      setParsed(result);
      setOpcoes(opts);
      setSelecionadas(new Set(opts.filter((o) => !o.jaRegistrada).map((o) => o.iso)));
      toast.dismiss(toastId);
    } catch (e) {
      console.error("[PremiumKinologyImport] falha ao importar laudo Kinology", {
        name: e instanceof Error ? e.name : undefined,
        message: e instanceof Error ? e.message : String(e),
        stack: e instanceof Error ? e.stack : undefined,
        error: e,
      });
      toast.dismiss(toastId);
      toast.error(e instanceof Error ? e.message : "Erro ao importar laudo");
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function confirmarHistorico() {
    if (!parsed || !user) return;
    const alvos = opcoes.filter((o) => selecionadas.has(o.iso));
    if (!alvos.length) return;
    setSalvando(true);
    try {
      let ok = 0;
      for (const alvo of alvos) {
        const entrada = parsed.historico.find((h) => brDateToISO(h.data) === alvo.iso);
        if (!entrada) continue;
        await persistirForcaNaData({
          alunoId,
          avaliadorId: user.id,
          dataISO: alvo.isoFinal,
          forcaPayload: buildForcaPayload(parsed, entrada.exercicios),
        });
        ok++;
      }
      invalidar();
      toast.success(`${ok} avaliação(ões) de força importada(s)`, {
        description: alvos.map((a) => a.label).join(" · "),
      });
      setParsed(null);
      setOpcoes([]);
    } catch (e) {
      console.error("[PremiumKinologyImport] falha ao gravar histórico", e);
      toast.error(e instanceof Error ? e.message : "Erro ao gravar histórico");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="bio-card p-4 space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3 min-w-0">
          <div className="p-2 rounded-md bg-rose-500/10 border border-rose-500/30 shrink-0">
            <FileText className="w-4 h-4 text-rose-600" />
          </div>
          <div className="min-w-0">
            <p className="bio-label">Laudo Kinology</p>
            <p className="text-sm text-[hsl(var(--bio-ink-muted))]">
              Importe um PDF de dinamometria — se o laudo tiver a página "Evolução de
              Assimetria", você poderá escolher também as datas anteriores.
            </p>
          </div>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="application/pdf"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleFile(f);
          }}
        />
        <Button
          onClick={() => fileRef.current?.click()}
          disabled={busy}
          className="shrink-0"
        >
          {busy ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Processando...
            </>
          ) : (
            <>
              <Upload className="w-4 h-4 mr-2" /> Importar laudo Kinology (PDF)
            </>
          )}
        </Button>
      </div>
      <AssessmentDateField theme="light"
        value={data}
        onChange={(v) => {
          setData(v);
          setDataTouched(true);
        }}
        helperText="Se você não alterar este campo, será usada a data extraída do laudo (ou a data de hoje, caso o laudo não a informe). Alterações manuais têm prioridade e valem para a medição mais recente."
      />

      <Dialog open={!!parsed} onOpenChange={(o) => !o && !salvando && setParsed(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Datas encontradas no laudo</DialogTitle>
            <DialogDescription>
              O laudo contém mais de uma medição. Selecione quais devem ser gravadas
              como avaliações de força.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            {opcoes.map((o) => (
              <label
                key={o.iso}
                className="flex items-center gap-3 rounded-md border p-3 cursor-pointer"
              >
                <Checkbox
                  checked={selecionadas.has(o.iso)}
                  onCheckedChange={(c) =>
                    setSelecionadas((prev) => {
                      const next = new Set(prev);
                      if (c) next.add(o.iso);
                      else next.delete(o.iso);
                      return next;
                    })
                  }
                />
                <div className="min-w-0">
                  <p className="text-sm font-medium">
                    {o.label}
                    {o.atual && (
                      <span className="ml-2 text-xs text-muted-foreground">
                        (medição mais recente)
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {o.qtd} exercício(s)
                    {o.jaRegistrada && " · já registrado (marcar cria um registro adicional)"}
                  </p>
                </div>
              </label>
            ))}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setParsed(null)} disabled={salvando}>
              Cancelar
            </Button>
            <Button
              onClick={confirmarHistorico}
              disabled={salvando || selecionadas.size === 0}
            >
              {salvando ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Gravando...
                </>
              ) : (
                `Importar ${selecionadas.size} data(s)`
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
