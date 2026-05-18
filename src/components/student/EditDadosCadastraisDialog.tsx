import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { fetchCep, formatCep } from "@/lib/viacep";
import { SEXO_OPTIONS } from "@/lib/leads";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  alunoId: string;
}

function formatCPF(v: string) {
  const d = v.replace(/\D/g, "").slice(0, 11);
  return d
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
}

export function EditDadosCadastraisDialog({ open, onOpenChange, alunoId }: Props) {
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    nome: "",
    data_nascimento: "",
    sexo: "",
    cpf: "",
    rg: "",
    telefone: "",
    email: "",
    cep: "",
    logradouro: "",
    numero: "",
    complemento: "",
    bairro: "",
    cidade: "",
    uf: "",
  });

  useEffect(() => {
    if (!open) return;
    (async () => {
      const { data } = await supabase
        .from("alunos")
        .select("nome,data_nascimento,sexo,cpf,rg,telefone,email,cep,logradouro,numero,complemento,bairro,cidade,uf" as any)
        .eq("id", alunoId)
        .maybeSingle();
      if (data) {
        const a: any = data;
        setForm({
          nome: a.nome || "",
          data_nascimento: a.data_nascimento || "",
          sexo: a.sexo || "",
          cpf: a.cpf || "",
          rg: a.rg || "",
          telefone: a.telefone || "",
          email: a.email || "",
          cep: a.cep || "",
          logradouro: a.logradouro || "",
          numero: a.numero || "",
          complemento: a.complemento || "",
          bairro: a.bairro || "",
          cidade: a.cidade || "",
          uf: a.uf || "",
        });
      }
    })();
  }, [open, alunoId]);

  function set<K extends keyof typeof form>(k: K, v: string) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function handleCepBlur() {
    const r = await fetchCep(form.cep);
    if (r) {
      setForm((f) => ({
        ...f,
        logradouro: r.logradouro || f.logradouro,
        bairro: r.bairro || f.bairro,
        cidade: r.localidade || f.cidade,
        uf: r.uf || f.uf,
      }));
    }
  }

  async function save() {
    if (!form.nome.trim()) return toast.error("Nome é obrigatório");
    setBusy(true);
    const { error } = await supabase
      .from("alunos")
      .update({
        nome: form.nome.trim(),
        data_nascimento: form.data_nascimento || null,
        sexo: form.sexo || null,
        cpf: form.cpf.trim() || null,
        rg: form.rg.trim() || null,
        telefone: form.telefone.trim() || null,
        email: form.email.trim() || null,
        cep: form.cep.trim() || null,
        logradouro: form.logradouro.trim() || null,
        numero: form.numero.trim() || null,
        complemento: form.complemento.trim() || null,
        bairro: form.bairro.trim() || null,
        cidade: form.cidade.trim() || null,
        uf: form.uf.trim() || null,
      } as any)
      .eq("id", alunoId);
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Dados cadastrais atualizados");
    qc.invalidateQueries({ queryKey: ["aluno", alunoId] });
    qc.invalidateQueries({ queryKey: ["student", alunoId] });
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Editar dados cadastrais</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label className="text-xs">Nome *</Label>
            <Input value={form.nome} onChange={(e) => set("nome", e.target.value)} />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label className="text-xs">Data de nascimento</Label>
              <Input type="date" value={form.data_nascimento} onChange={(e) => set("data_nascimento", e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">Sexo</Label>
              <Select value={form.sexo} onValueChange={(v) => set("sexo", v)}>
                <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>
                  {SEXO_OPTIONS.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Telefone</Label>
              <Input value={form.telefone} onChange={(e) => set("telefone", e.target.value)} placeholder="(11) 99999-0000" />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label className="text-xs">CPF</Label>
              <Input value={form.cpf} onChange={(e) => set("cpf", formatCPF(e.target.value))} placeholder="000.000.000-00" />
            </div>
            <div>
              <Label className="text-xs">RG</Label>
              <Input value={form.rg} onChange={(e) => set("rg", e.target.value)} placeholder="00.000.000-0" />
            </div>
            <div>
              <Label className="text-xs">Email</Label>
              <Input type="email" value={form.email} onChange={(e) => set("email", e.target.value)} />
            </div>
          </div>

          <div className="pt-2 border-t border-border space-y-3">
            <p className="text-xs font-medium uppercase text-muted-foreground">Endereço</p>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label className="text-xs">CEP</Label>
                <Input value={form.cep} onChange={(e) => set("cep", formatCep(e.target.value))} onBlur={handleCepBlur} placeholder="00000-000" />
              </div>
              <div className="col-span-2">
                <Label className="text-xs">Logradouro</Label>
                <Input value={form.logradouro} onChange={(e) => set("logradouro", e.target.value)} />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label className="text-xs">Número</Label>
                <Input value={form.numero} onChange={(e) => set("numero", e.target.value)} />
              </div>
              <div className="col-span-2">
                <Label className="text-xs">Complemento</Label>
                <Input value={form.complemento} onChange={(e) => set("complemento", e.target.value)} />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label className="text-xs">Bairro</Label>
                <Input value={form.bairro} onChange={(e) => set("bairro", e.target.value)} />
              </div>
              <div>
                <Label className="text-xs">Cidade</Label>
                <Input value={form.cidade} onChange={(e) => set("cidade", e.target.value)} />
              </div>
              <div>
                <Label className="text-xs">UF</Label>
                <Input value={form.uf} onChange={(e) => set("uf", e.target.value.toUpperCase().slice(0, 2))} />
              </div>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={save} disabled={busy}>{busy ? "Salvando..." : "Salvar"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
