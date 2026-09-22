import type { Tables } from "@/integrations/supabase/types";
import {
  type MileDeep1RMConteudo,
  MILEDEEP1RM_LABEL,
  levantamentosDoParMD1,
  planoMD1,
  tabelaMD1,
} from "@/lib/mileDeep1RM";
import { MD_LEV_BASE } from "@/lib/mileDeepShared";
import { exportMileDeepPDF } from "./exportMileDeepPDFCore";

export async function exportMileDeep1RMPDF({
  student,
  data,
  semanaPorSlot,
  print,
}: {
  student: Tables<"alunos">;
  data: MileDeep1RMConteudo;
  semanaPorSlot?: Record<string, number>;
  print?: boolean;
}): Promise<void> {
  await exportMileDeepPDF({
    student,
    titulo: MILEDEEP1RM_LABEL,
    refLabel: "1RM",
    aquecimento: data.aquecimento,
    observacoes: data.observacoes,
    print,
    nomeArquivo: `MileDeep-${student.nome.replace(/\s+/g, "-")}.pdf`,
    sessoes: data.pares.map((par, i) => {
      const semana = semanaPorSlot?.[par.slot] ?? 1;
      return {
        slot: par.slot,
        titulo: `Sessão ${i + 1} · Par ${i + 1}`,
        semana,
        plano: planoMD1(par, semana),
        levantamentos: levantamentosDoParMD1(par).map((l) => ({
          nome: l.levantamento,
          base: MD_LEV_BASE[l.levantamento].nome,
          rm: l.rm1,
        })),
        auxiliares: par.auxiliares,
        tabela: tabelaMD1(par),
      };
    }),
  });
}
