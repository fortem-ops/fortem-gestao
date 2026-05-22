import { Card, CardContent } from "@/components/ui/card";
import { Construction } from "lucide-react";

export default function RelatoriosEmBreve({ titulo }: { titulo: string }) {
  return (
    <Card className="glass-card">
      <CardContent className="p-12 text-center space-y-3">
        <Construction className="h-10 w-10 mx-auto text-muted-foreground" />
        <h2 className="text-lg font-display font-semibold">{titulo}</h2>
        <p className="text-sm text-muted-foreground">Em breve — estrutura de dados pronta, página em construção.</p>
      </CardContent>
    </Card>
  );
}
