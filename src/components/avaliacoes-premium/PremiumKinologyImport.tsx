import { useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Upload, Loader2, FileText } from "lucide-react";
import { toast } from "sonner";
import {
  uploadAndParseKinology,
  buildForcaPayload,
  findFuncionalV2AguardandoForca,
  getFuncionalV2DefaultProtocoloId,
} from "@/lib/kinologyImport";
import { AssessmentDateField, todayISO } from "./AssessmentDateField";

interface Props {
  alunoId: string;
}

export function PremiumKinologyImport({ alunoId }: Props) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [data, setData] = useState<string>(todayISO());
  const [dataTouched, setDataTouched] = useState(false);

  async function handleFile(file: File) {
    if (!user) {
      toast.error("Usuário não autenticado");
      return;
    }
    setBusy(true);
    const toastId = "kinology-import";
    try {
      toast.loading("Lendo laudo...", { id: toastId });
      const parsed = await uploadAndParseKinology(alunoId, file);
      if (!parsed.exercicios.length) {
        toast.dismiss(toastId);
        toast.warning("Nenhum exercício reconhecido no laudo.");
        return;
      }
      const forcaPayload = buildForcaPayload(parsed);
      const sourceLabel = parsed.source === "deterministic" ? "leitura direta" : "via IA";

      // Resolve final assessment date:
      // - If the user edited the field manually, that value wins (override final).
      // - Otherwise pre-fill from the laudo's dataEmissao when available.
      // - Fallback: today.
      const finalData = dataTouched
        ? (data || todayISO())
        : (parsed.dataEmissao || data || todayISO());
      if (!dataTouched && parsed.dataEmissao) setData(parsed.dataEmissao);

      const pendente = await findFuncionalV2AguardandoForca(alunoId);

      if (pendente) {
        const novosDados = { ...pendente.dados, forca: forcaPayload };
        const { error } = await supabase
          .from("avaliacoes")
          .update({ dados: novosDados, data: finalData } as never)
          .eq("id", pendente.id);
        if (error) throw error;
        toast.dismiss(toastId);
        toast.success(`Força mesclada com sucesso (${sourceLabel})`, {
          description: `${parsed.exercicios.length} exercício(s) integrados à avaliação existente.`,
        });

      } else {
        const protocoloId = await getFuncionalV2DefaultProtocoloId();
        if (!protocoloId) throw new Error("Protocolo padrão de funcional_v2 não encontrado");
        const { error } = await supabase.from("avaliacoes").insert({
          aluno_id: alunoId,
          avaliador_id: user.id,
          tipo: "funcional_v2",
          protocolo_id: protocoloId,
          data: finalData,
          dados: { metricas: [], forca: forcaPayload },
        } as never);
        if (error) throw error;
        toast.dismiss(toastId);
        toast.success(`Força registrada (${sourceLabel})`, {
          description:
            "Faltam as métricas de mobilidade/flexibilidade para completar a avaliação.",
        });

      }

      qc.invalidateQueries({ queryKey: ["aluno-avaliacoes-consolidadas", alunoId] });
      qc.invalidateQueries({ queryKey: ["avaliacoes-aluno", alunoId] });
      qc.invalidateQueries({ queryKey: ["avaliacoes-global", alunoId] });
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

  return (
    <div className="bio-card p-4 flex items-center justify-between gap-3 flex-wrap">
      <div className="flex items-center gap-3 min-w-0">
        <div className="p-2 rounded-md bg-rose-500/10 border border-rose-500/30 shrink-0">
          <FileText className="w-4 h-4 text-rose-300" />
        </div>
        <div className="min-w-0">
          <p className="bio-label">Laudo Kinology</p>
          <p className="text-sm text-white/70">
            Importe um PDF de dinamometria — se houver uma avaliação aguardando
            força, os dados serão mesclados automaticamente.
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
  );
}
