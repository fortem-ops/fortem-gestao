import { AlertTriangle } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { CardContrato } from './CardContrato';
import { TimelineCobrancas } from './TimelineCobrancas';
import { useContratosAluno } from '@/hooks/useContratos';

interface Props {
  alunoId: string;
  canManage?: boolean;
}

/**
 * Aba "Contrato & Pagamentos" do perfil do aluno.
 * Renderiza CardContrato + TimelineCobrancas do contrato mais recente ativo.
 */
export function ContratoPagamentosTab({ alunoId, canManage = false }: Props) {
  const { data: contratos, isLoading } = useContratosAluno(alunoId);

  if (isLoading) {
    return <div className="py-8 text-center text-muted-foreground text-sm">Carregando contrato...</div>;
  }

  const contratoAtivo = contratos?.find((c) => c.status === 'ativo' || c.status === 'inadimplente' || c.status === 'suspenso')
    ?? contratos?.[0];

  if (!contratoAtivo) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground text-sm">
          Nenhum contrato cadastrado para este aluno.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {(contratoAtivo.status === 'inadimplente' || contratoAtivo.status === 'suspenso') && (
        <div className="rounded-lg border border-destructive bg-destructive/10 p-4 flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-semibold text-destructive">Acesso suspenso por inadimplência</p>
            <p className="text-sm text-muted-foreground">Regularize o pagamento para reativar o contrato.</p>
          </div>
        </div>
      )}

      <CardContrato contrato={contratoAtivo} />

      <Card>
        <CardContent className="pt-6">
          <h3 className="font-semibold mb-4">Histórico de cobranças</h3>
          <TimelineCobrancas contratoId={contratoAtivo.id} canRegister={canManage} />
        </CardContent>
      </Card>
    </div>
  );
}
