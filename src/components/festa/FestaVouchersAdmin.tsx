import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { brlCentavos } from "@/lib/festa10anos";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const db = supabase as any;
type Voucher = { id: string; codigo_exibicao: string | null; descricao: string | null; desconto_pct: number; desconto_centavos_pessoa: number | null; ativo: boolean; usos: number; criado_em: string };

export default function FestaVouchersAdmin() {
  const qc = useQueryClient();
  const [aberto, setAberto] = useState(false);
  const [codigo, setCodigo] = useState("");
  const [descricao, setDescricao] = useState("");
  const [valor, setValor] = useState("");

  const { data: itens = [], isLoading } = useQuery({
    queryKey: ["festa-vouchers"],
    queryFn: async () => {
      const { data, error } = await db.from("festa_vouchers").select("id, codigo_exibicao, descricao, desconto_pct, desconto_centavos_pessoa, ativo, usos, criado_em").order("criado_em", { ascending: false });
      if (error) throw error;
      return data as Voucher[];
    },
  });

  const criar = useMutation({
    mutationFn: async () => {
      const centavos = Math.round(Number(valor.replace(/\./g, "").replace(",", ".")) * 100);
      if (!Number.isFinite(centavos) || centavos <= 0) throw new Error("Informe o desconto em reais.");
      const { error } = await db.rpc("fn_festa_voucher_criar", { p_codigo: codigo, p_descricao: descricao, p_desconto_centavos: centavos });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Voucher criado"); setAberto(false); setCodigo(""); setDescricao(""); setValor(""); qc.invalidateQueries({ queryKey: ["festa-vouchers"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const alternar = useMutation({
    mutationFn: async (v: Voucher) => {
      const { error } = await db.from("festa_vouchers").update({ ativo: !v.ativo }).eq("id", v.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["festa-vouchers"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Card className="p-4 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">Vouchers aceitos no site /10anos. O desconto vale por pessoa inscrita.</p>
        <Button onClick={() => setAberto(true)}><Plus className="mr-2 h-4 w-4" />Novo voucher</Button>
      </div>
      <Table>
        <TableHeader><TableRow><TableHead>Código</TableHead><TableHead>Descrição</TableHead><TableHead>Desconto</TableHead><TableHead>Usos</TableHead><TableHead>Ativo</TableHead></TableRow></TableHeader>
        <TableBody>
          {isLoading ? <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">Carregando…</TableCell></TableRow>
            : !itens.length ? <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">Nenhum voucher.</TableCell></TableRow>
            : itens.map((v) => (
              <TableRow key={v.id}>
                <TableCell className="font-mono">{v.codigo_exibicao ?? "—"}</TableCell>
                <TableCell>{v.descricao ?? "—"}</TableCell>
                <TableCell>{v.desconto_pct === 100 ? "Isenção total" : v.desconto_centavos_pessoa ? `${brlCentavos(v.desconto_centavos_pessoa)} por pessoa` : "—"}</TableCell>
                <TableCell>{v.usos}</TableCell>
                <TableCell><Switch checked={v.ativo} onCheckedChange={() => alternar.mutate(v)} aria-label="Ativo" /></TableCell>
              </TableRow>
            ))}
        </TableBody>
      </Table>

      <Dialog open={aberto} onOpenChange={setAberto}>
        <DialogContent>
          <DialogHeader><DialogTitle>Novo voucher</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5"><Label htmlFor="v-cod">Código</Label><Input id="v-cod" maxLength={40} value={codigo} onChange={(e) => setCodigo(e.target.value)} placeholder="AMIGO20" /></div>
            <div className="space-y-1.5"><Label htmlFor="v-desc">Descrição</Label><Input id="v-desc" value={descricao} onChange={(e) => setDescricao(e.target.value)} /></div>
            <div className="space-y-1.5"><Label htmlFor="v-val">Desconto por pessoa (R$)</Label><Input id="v-val" inputMode="decimal" value={valor} onChange={(e) => setValor(e.target.value)} placeholder="20,00" /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAberto(false)}>Cancelar</Button>
            <Button disabled={criar.isPending || codigo.trim().length < 3 || !valor} onClick={() => criar.mutate()}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
