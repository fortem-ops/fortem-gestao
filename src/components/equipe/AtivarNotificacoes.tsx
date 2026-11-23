import { Bell, BellOff, BellRing } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useEquipePush } from "@/hooks/useEquipePush";
import { TEXTO_ESTADO } from "@/lib/equipePush";

export function AtivarNotificacoes() {
  const { estado, carregando, ativar, desativar } = useEquipePush();
  const Icone = estado === "ativado" ? BellRing : estado === "desativado" ? Bell : BellOff;
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Notificações no aparelho">
          <Icone className={estado === "ativado" ? "h-4 w-4 text-primary" : "h-4 w-4"} />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72 space-y-3">
        <p className="text-sm font-medium">Notificações no celular</p>
        <p className="text-sm text-muted-foreground">{TEXTO_ESTADO[estado]}</p>
        {estado === "desativado" && (
          <Button className="w-full" onClick={() => void ativar()} disabled={carregando}>Ativar notificações</Button>
        )}
        {estado === "ativado" && (
          <Button variant="outline" className="w-full" onClick={() => void desativar()} disabled={carregando}>
            Desativar neste aparelho
          </Button>
        )}
      </PopoverContent>
    </Popover>
  );
}
