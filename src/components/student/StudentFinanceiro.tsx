import { PixAutomaticoSection } from "./financeiro/PixAutomaticoSection";

interface Props {
  student: { id: string; nome: string; cpf?: string | null };
}

export function StudentFinanceiro({ student }: Props) {
  return (
    <div className="space-y-6">
      <PixAutomaticoSection student={student} />
    </div>
  );
}
