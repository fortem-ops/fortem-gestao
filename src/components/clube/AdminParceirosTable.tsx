import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Pencil } from "lucide-react";
import { toast } from "sonner";
import type { Database } from "@/integrations/supabase/types";

type Parceiro = Database["public"]["Tables"]["parceiros"]["Row"];
type ModoVal = Database["public"]["Enums"]["parceiro_modo_validacao"];

const MODO_LABEL: Record<ModoVal, string> = {
  qr_scan: "QR Scan",
  cpf_manual: "CPF Manual",
  lista_nome: "Lista de nome",
};

const emptyForm = {
  id: "",
  nome: "",
  categoria: "",
  descricao: "",
  logo_url: "",
  responsavel_nome: "",
  responsavel_contato: "",
  email_login: "",
  endereco: "",
  ativo: true,
  modo_validacao: "qr_scan" as ModoVal,
};

export function AdminParceirosTable() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [novaSenha, setNovaSenha] = useState("");
  const [saving, setSaving] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["clube-parceiros-admin"],
    queryFn: async () => {
      const { data, error } = await supabase.from("parceiros").select("*").order("nome");
      if (error) throw error;
      return data as Parceiro[];
    },
  });

  function openNew() {
    setForm(emptyForm);
    setNovaSenha("");
    setOpen(true);
  }

  function openEdit(p: Parceiro) {
    setForm({
      id: p.id,
      nome: p.nome,
      categoria: p.categoria,
      descricao: p.descricao || "",
      logo_url: p.logo_url || "",
      responsavel_nome: p.responsavel_nome || "",
      responsavel_contato: p.responsavel_contato || "",
      email_login: p.email_login || "",
      endereco: (p as any).endereco || "",
      ativo: p.ativo,
      modo_validacao: p.modo_validacao,
    });
    setNovaSenha("");
    setOpen(true);
  }

  async function save() {
    if (!form.nome || !form.categoria) {
      toast.error("Nome e categoria são obrigatórios.");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        nome: form.nome,
        categoria: form.categoria,
        descricao: form.descricao || null,
        logo_url: form.logo_url || null,
        responsavel_nome: form.responsavel_nome || null,
        responsavel_contato: form.responsavel_contato || null,
        email_login: form.email_login || null,
        endereco: form.endereco || null,
        ativo: form.ativo,
        modo_validacao: form.modo_validacao,
      };
      let parceiroId = form.id;
      if (form.id) {
        const { error } = await supabase.from("parceiros").update(payload).eq("id", form.id);
        if (error) throw error;
      } else {
        const { data: inserted, error } = await supabase.from("parceiros").insert(payload).select("id").single();
        if (error) throw error;
        parceiroId = inserted!.id;
      }
      if (novaSenha && parceiroId) {
        const { error: errSenha } = await supabase.rpc("fn_parceiro_set_senha", {
          p_parceiro_id: parceiroId,
          p_senha: novaSenha,
        });
        if (errSenha) throw errSenha;
      }
      toast.success("Parceiro salvo");
      setNovaSenha("");
      setOpen(false);
      qc.invalidateQueries({ queryKey: ["clube-parceiros-admin"] });
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function toggleAtivo(p: Parceiro) {
    const { error } = await supabase.from("parceiros").update({ ativo: !p.ativo }).eq("id", p.id);
    if (error) toast.error(error.message);
    else qc.invalidateQueries({ queryKey: ["clube-parceiros-admin"] });
  }

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button onClick={openNew} className="gap-2">
              <Plus className="w-4 h-4" /> Novo parceiro
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>{form.id ? "Editar" : "Novo"} parceiro</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div>
                <Label>Nome *</Label>
                <Input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Categoria *</Label>
                  <Input value={form.categoria} onChange={(e) => setForm({ ...form, categoria: e.target.value })} />
                </div>
                <div>
                  <Label>Modo de validação</Label>
                  <Select value={form.modo_validacao} onValueChange={(v) => setForm({ ...form, modo_validacao: v as ModoVal })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {(Object.keys(MODO_LABEL) as ModoVal[]).map((m) => (
                        <SelectItem key={m} value={m}>{MODO_LABEL[m]}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label>Descrição</Label>
                <Textarea rows={2} value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Responsável</Label>
                  <Input value={form.responsavel_nome} onChange={(e) => setForm({ ...form, responsavel_nome: e.target.value })} />
                </div>
                <div>
                  <Label>Contato</Label>
                  <Input value={form.responsavel_contato} onChange={(e) => setForm({ ...form, responsavel_contato: e.target.value })} />
                </div>
              </div>
              <div>
                <Label>Email de login do parceiro</Label>
                <Input type="email" value={form.email_login} onChange={(e) => setForm({ ...form, email_login: e.target.value })} />
              </div>
              <div>
                <Label>Senha de acesso {form.id ? "(deixe vazio para não alterar)" : ""}</Label>
                <Input
                  type="password"
                  value={novaSenha}
                  onChange={(e) => setNovaSenha(e.target.value)}
                  placeholder="Nova senha..."
                  autoComplete="new-password"
                />
                <p className="text-[10px] text-muted-foreground mt-1">
                  O parceiro usará este e-mail + senha em <span className="font-mono">/parceiro/login</span>
                </p>
              </div>
              <div>
                <Label>Endereço (para link do Google Maps)</Label>
                <Input
                  value={form.endereco}
                  onChange={(e) => setForm({ ...form, endereco: e.target.value })}
                  placeholder="Av. Paulista, 1000 — São Paulo/SP"
                />
              </div>
              <div>
                <Label>Logo URL</Label>
                <Input value={form.logo_url} onChange={(e) => setForm({ ...form, logo_url: e.target.value })} />
              </div>
              <div className="flex items-center gap-2 pt-2">
                <Switch checked={form.ativo} onCheckedChange={(v) => setForm({ ...form, ativo: v })} />
                <Label>Parceiro ativo</Label>
              </div>
              <Button className="w-full" onClick={save} disabled={saving}>
                {saving ? "Salvando..." : "Salvar"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <Skeleton className="h-64" />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Categoria</TableHead>
              <TableHead>Modo</TableHead>
              <TableHead>Pontuação</TableHead>
              <TableHead>Ativo</TableHead>
              <TableHead>Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data?.map((p) => (
              <TableRow key={p.id}>
                <TableCell className="font-medium">{p.nome}</TableCell>
                <TableCell><Badge variant="outline">{p.categoria}</Badge></TableCell>
                <TableCell className="text-xs">{MODO_LABEL[p.modo_validacao]}</TableCell>
                <TableCell>{p.pontuacao_engajamento}</TableCell>
                <TableCell>
                  <Switch checked={p.ativo} onCheckedChange={() => toggleAtivo(p)} />
                </TableCell>
                <TableCell>
                  <Button size="icon" variant="ghost" onClick={() => openEdit(p)}>
                    <Pencil className="w-4 h-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {!data?.length && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                  Nenhum parceiro cadastrado.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
