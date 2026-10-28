import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Trash2, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { normalizarEmail, normalizarTelefone, telefoneValidoWhatsapp, type CanalDisparo } from "@/lib/disparos";

type Linha = { id: string; canal: CanalDisparo; email_norm: string | null; telefone_norm: string | null; motivo: string | null; origem: string; criado_em: string };

export default function DisparosOptout({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const qc = useQueryClient();
  const [canal, setCanal] = useState<"whatsapp" | "email" | "ambos">("whatsapp");
  const [tel, setTel] = useState("");
  const [email, setEmail] = useState("");
  const [motivo, setMotivo] = useState("");

  const { data = [], isLoading } = useQuery({
    queryKey: ["msg_optout"], enabled: open,
    queryFn: async () => {
      const { data, error } = await supabase.from("msg_optout").select("*").order("criado_em", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Linha[];
    },
  });

  const add = useMutation({
    mutationFn: async () => {
      const rows: Record<string, unknown>[] = [];
      const t = normalizarTelefone(tel); const e = normalizarEmail(email);
      if (canal !== "email") {
        if (!telefoneValidoWhatsapp(tel)) throw new Error("Informe um telefone válido para WhatsApp.");
        rows.push({ canal: "whatsapp", telefone_norm: t, email_norm: e, motivo: motivo || null, origem: "manual" });
      }
      if (canal !== "whatsapp") {
        if (!e || !e.includes("@")) throw new Error("Informe um e-mail válido.");
        rows.push({ canal: "email", email_norm: e, telefone_norm: t, motivo: motivo || null, origem: "manual" });
      }
      const { error } = await supabase.from("msg_optout").insert(rows as never);
      if (error) throw new Error(error.code === "23505" ? "Esse contato já está em opt-out." : error.message);
    },
    onSuccess: () => { toast.success("Contato adicionado ao opt-out"); setTel(""); setEmail(""); setMotivo(""); qc.invalidateQueries({ queryKey: ["msg_optout"] }); qc.invalidateQueries({ queryKey: ["msg_publico"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("msg_optout").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["msg_optout"] }); qc.invalidateQueries({ queryKey: ["msg_publico"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader><DialogTitle>Gerenciar opt-out</DialogTitle></DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <div><Label>Canal</Label>
            <Select value={canal} onValueChange={(v) => setCanal(v as typeof canal)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="whatsapp">WhatsApp</SelectItem>
                <SelectItem value="email">E-mail</SelectItem>
                <SelectItem value="ambos">Ambos</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div><Label>Motivo</Label><Input value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Ex.: pediu para não receber" /></div>
          <div><Label>Telefone</Label><Input value={tel} onChange={(e) => setTel(e.target.value)} placeholder="(51) 99999-9999" /></div>
          <div><Label>E-mail</Label><Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="nome@email.com" /></div>
        </div>
        <div className="flex justify-end"><Button onClick={() => add.mutate()} disabled={add.isPending}>Adicionar</Button></div>
        <div className="max-h-72 overflow-auto border rounded-md divide-y">
          {isLoading ? <div className="p-4 flex justify-center"><Loader2 className="h-4 w-4 animate-spin" /></div>
            : data.length === 0 ? <p className="p-4 text-sm text-muted-foreground text-center">Nenhum contato em opt-out.</p>
            : data.map((o) => (
              <div key={o.id} className="flex items-center gap-3 p-2 text-sm">
                <Badge variant="outline">{o.canal === "email" ? "E-mail" : "WhatsApp"}</Badge>
                <span className="flex-1 truncate">{o.canal === "email" ? o.email_norm : o.telefone_norm}{o.motivo ? ` · ${o.motivo}` : ""}</span>
                <span className="text-xs text-muted-foreground">{new Date(o.criado_em).toLocaleDateString("pt-BR")}</span>
                <Button size="icon" variant="ghost" onClick={() => del.mutate(o.id)} aria-label="Remover"><Trash2 className="h-4 w-4" /></Button>
              </div>
            ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
