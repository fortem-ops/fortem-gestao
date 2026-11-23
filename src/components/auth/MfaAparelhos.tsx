import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useAuth } from "@/contexts/AuthContext";
import { carregarMfaEstado } from "@/lib/mfa";
import { MfaCadastro } from "./MfaCadastro";

export function MfaAparelhosButton({ collapsed }: { collapsed: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="ghost" size={collapsed ? "icon" : "sm"} className="w-full justify-start text-muted-foreground" onClick={() => setOpen(true)}>
        <ShieldCheck className="h-4 w-4 mr-2 shrink-0" />
        {!collapsed && <span>Meus aparelhos 2FA</span>}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Verificação em duas etapas</DialogTitle></DialogHeader>
          {open && <Conteudo />}
        </DialogContent>
      </Dialog>
    </>
  );
}

function Conteudo() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [adicionando, setAdicionando] = useState(false);
  const { data } = useQuery({ queryKey: ["mfa-estado", user?.id], queryFn: carregarMfaEstado, enabled: !!user });
  const fatores = data?.fatores ?? [];

  if (adicionando) {
    return (
      <MfaCadastro
        nomeAparelho="Reserva"
        onConcluido={() => { setAdicionando(false); void qc.invalidateQueries({ queryKey: ["mfa-estado"] }); }}
      />
    );
  }
  return (
    <div className="space-y-3">
      <ul className="space-y-2">
        {fatores.map((f, i) => (
          <li key={f.id} className="rounded-md border border-border px-3 py-2 text-sm">
            <p className="font-medium text-foreground">{i === 0 ? "Aparelho principal" : `Reserva ${i}`}</p>
            <p className="text-xs text-muted-foreground">Desde {new Date(f.created_at).toLocaleDateString("pt-BR")}</p>
          </li>
        ))}
      </ul>
      {fatores.length < 2 ? (
        <Button className="w-full" variant="outline" onClick={() => setAdicionando(true)}>Adicionar aparelho reserva</Button>
      ) : (
        <p className="text-xs text-muted-foreground">Você já tem um aparelho reserva. Se perder um deles, peça a um admin para redefinir.</p>
      )}
    </div>
  );
}
