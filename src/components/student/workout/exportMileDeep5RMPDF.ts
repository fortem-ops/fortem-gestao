import type { Tables } from "@/integrations/supabase/types";
import {
  type MileDeep5RMConteudo,
  MILEDEEP5RM_LABEL,
  planoMD5,
  tabelaMD5,
} from "@/lib/mileDeep5RM";
import { MD_LEV_BASE } from "@/lib/mileDeepShared";
import { exportMileDeepPDF } from "./exportMileDeepPDFCore";

export async function exportMileDeep5RMPDF({
  student,
  data,
  semanaPorSlot,
  print,
}: {
  student: Tables<"alunos">;
  data: MileDeep5RMConteudo;
  semanaPorSlot?: Record<string, number>;
  print?: boolean;
}): Promise<void> {
  await exportMileDeepPDF({
    student,
    titulo: MILEDEEP5RM_LABEL,
    refLabel: "5RM",
    aquecimento: data.aquecimento,
    observacoes: data.observacoes,
    print,
    nomeArquivo: `MileDeep-5RM-${student.nome.replace(/\s+/g, "-")}.pdf`,
    sessoes: data.sessoes.map((s, i) => {
      const semana = semanaPorSlot?.[s.slot] ?? 1;
      return {
        slot: s.slot,
        titulo: `Sessão ${i + 1} · ${s.levantamento}`,
        semana,
        plano: planoMD5(s, semana),
        levantamentos: [
          { nome: s.levantamento, base: MD_LEV_BASE[s.levantamento].nome, rm: s.rm5 },
        ],
        auxiliares: s.auxiliares,
        tabela: tabelaMD5(s),
      };
    }),
  });
}
