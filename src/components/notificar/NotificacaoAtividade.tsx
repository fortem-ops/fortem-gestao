import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  hist: any[];
  dests: any[];
  profileMap: Record<string, string>;
}

const fmt = (d: string) => format(new Date(d), "dd/MM HH:mm", { locale: ptBR });

export function NotificacaoAtividade({ open, onOpenChange, hist, dests, profileMap }: Props) {
  const histOrdenado = [...(hist ?? [])].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
  );
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Atividade</SheetTitle>
          <SheetDescription className="sr-only">Destinatários e histórico da conversa</SheetDescription>
        </SheetHeader>

        <section className="mt-6 space-y-2">
          <h3 className="text-[11px] uppercase tracking-wide text-muted-foreground">Destinatários</h3>
          {(dests ?? []).length === 0 && <p className="text-sm text-muted-foreground">Nenhum destinatário.</p>}
          <ul className="divide-y border rounded-md">
            {(dests ?? []).map((d: any) => (
              <li key={d.id ?? d.usuario_id} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                <span className="min-w-0 truncate">{profileMap[d.usuario_id] ?? "—"}</span>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {d.visualizado_em ? `Visualizou em ${fmt(d.visualizado_em)}` : "Ainda não visualizou"}
                </span>
              </li>
            ))}
          </ul>
        </section>

        <section className="mt-6 space-y-2">
          <h3 className="text-[11px] uppercase tracking-wide text-muted-foreground">Histórico</h3>
          {histOrdenado.length === 0 && <p className="text-sm text-muted-foreground">Sem registros.</p>}
          <ul className="space-y-1.5">
            {histOrdenado.map((h: any) => (
              <li key={h.id} className="text-xs text-muted-foreground">
                {h.acao.replace("_", " ")} {h.usuario_id ? `por ${profileMap[h.usuario_id] ?? "—"}` : ""} em {fmt(h.created_at)}
              </li>
            ))}
          </ul>
        </section>
      </SheetContent>
    </Sheet>
  );
}
