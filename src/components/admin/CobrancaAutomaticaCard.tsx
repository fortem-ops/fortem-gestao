import { useState } from "react";
import { CreditCard, PauseCircle, PlayCircle } from "lucide-react";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { useUserRoles } from "@/hooks/useUserRoles";
import {
  CHAVE_COBRANCA_RECORRENTE,
  useCobrancaRecorrenteAtiva,
  useSetSistemaConfigBool,
} from "@/hooks/useSistemaConfig";

const FRASE_CONFIRMACAO = "LIGAR COBRANÇA";

/**
 * Controle da trava global da cobrança automática no cartão.
 * Visível para staff; alterável apenas por admin (RLS também garante isso).
 */
export function CobrancaAutomaticaCard() {
  const { data: roles } = useUserRoles();
  const { data: ativa, isLoading } = useCobrancaRecorrenteAtiva();
  const set = useSetSistemaConfigBool(CHAVE_COBRANCA_RECORRENTE);
  const [confirmar, setConfirmar] = useState(false);
  const [frase, setFrase] = useState("");

  if (isLoading) return <Skeleton className="h-32 w-full" />;

  const isAdmin = !!roles?.isAdmin;

  const onToggle = (valor: boolean) => {
    if (valor) {
      setFrase("");
      setConfirmar(true);
      return;
    }
    set.mutate(false);
  };

  return (
    <div className="glass-card rounded-lg p-4 space-y-3">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div>
          <p className="font-medium text-foreground flex items-center gap-2">
            <CreditCard className="w-4 h-4 text-primary" />
            Cobrança automática no cartão
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Cobrança mensal automática dos contratos com cartão de recorrência.
          </p>
        </div>
        <Badge variant="outline" className={ativa ? "" : "status-warning"}>
          {ativa ? (
            <span className="flex items-center gap-1"><PlayCircle className="w-3 h-3" /> Ativa</span>
          ) : (
            <span className="flex items-center gap-1"><PauseCircle className="w-3 h-3" /> Pausada</span>
          )}
        </Badge>
      </div>

      {!ativa && (
        <p className="text-sm text-muted-foreground">
          Enquanto estiver pausada, nenhuma mensalidade é cobrada automaticamente — nem pelo
          agendamento diário, nem por chamada manual. Os recebimentos precisam ser registrados à mão.
        </p>
      )}

      <div className="flex items-center gap-3">
        <Switch
          id="cobranca-automatica"
          checked={!!ativa}
          disabled={!isAdmin || set.isPending}
          onCheckedChange={onToggle}
        />
        <Label htmlFor="cobranca-automatica" className="text-sm">
          {ativa ? "Cobrança automática ligada" : "Cobrança automática pausada"}
        </Label>
      </div>

      {!isAdmin && (
        <p className="text-xs text-muted-foreground">Apenas administradores podem alterar este controle.</p>
      )}

      <Dialog open={confirmar} onOpenChange={(o) => !o && setConfirmar(false)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ligar a cobrança automática no cartão?</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-1 text-sm">
            <p className="text-muted-foreground">
              Ao ligar, o sistema volta a cobrar de verdade no cartão dos alunos com contrato de
              recorrência, em dinheiro real. Mensalidades vencidas em aberto podem ser cobradas na
              próxima execução.
            </p>
            <div className="space-y-1.5">
              <Label htmlFor="frase-confirmacao">
                Digite <span className="font-semibold text-foreground">{FRASE_CONFIRMACAO}</span> para confirmar
              </Label>
              <Input
                id="frase-confirmacao"
                value={frase}
                onChange={(e) => setFrase(e.target.value)}
                placeholder={FRASE_CONFIRMACAO}
                autoComplete="off"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmar(false)}>Cancelar</Button>
            <Button
              disabled={frase.trim().toUpperCase() !== FRASE_CONFIRMACAO || set.isPending}
              onClick={async () => {
                await set.mutateAsync(true);
                setConfirmar(false);
              }}
            >
              Ligar cobrança
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
