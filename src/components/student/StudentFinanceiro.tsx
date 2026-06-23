import { PixAutomaticoSection } from "./financeiro/PixAutomaticoSection";
import { CartoesSection } from "./financeiro/CartoesSection";

interface Props {
  student: { id: string; nome: string; cpf?: string | null };
}

export function StudentFinanceiro({ student }: Props) {
  return (
    <div className="space-y-6">
      <PixAutomaticoSection student={student} />
      <CartoesSection student={student} />
    </div>
  );
}
