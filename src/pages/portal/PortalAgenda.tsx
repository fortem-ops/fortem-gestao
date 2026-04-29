import { Card } from "@/components/ui/card";
import { CalendarDays, Clock } from "lucide-react";

export default function PortalAgenda() {
  return (
    <div className="space-y-5 animate-fade-in">
      <h1 className="font-heading font-bold text-lg flex items-center gap-2">
        <CalendarDays className="w-5 h-5 text-primary" /> Agenda de Serviços
      </h1>

      <Card className="glass-card p-10 text-center space-y-3">
        <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto">
          <Clock className="w-7 h-7 text-primary" />
        </div>
        <h2 className="font-heading font-semibold">Em breve</h2>
        <p className="text-sm text-muted-foreground max-w-sm mx-auto">
          Você vai poder agendar Nutrição, Fisioterapia e Avaliações direto por aqui, com débito
          automático dos seus créditos.
        </p>
      </Card>
    </div>
  );
}
