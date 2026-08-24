import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { fetchCep, formatCep } from "@/lib/viacep";
import { findAlunoByCpf, isValidCpfDigits, normalizeCpf } from "@/lib/cpfValidation";

const schema = z.object({
  nome: z.string().trim().min(2, "Nome deve ter pelo menos 2 caracteres").max(100),
  email: z.string().trim().email("E-mail inválido").max(255).or(z.literal("")),
  telefone: z.string().trim().max(20).or(z.literal("")),
  cpf: z.string().trim().or(z.literal("")),
  data_nascimento: z.string().or(z.literal("")),
  cep: z.string().trim().or(z.literal("")),
  logradouro: z.string().trim().max(200).or(z.literal("")),
  numero: z.string().trim().max(20).or(z.literal("")),
  complemento: z.string().trim().max(100).or(z.literal("")),
  bairro: z.string().trim().max(100).or(z.literal("")),
  cidade: z.string().trim().max(100).or(z.literal("")),
  uf: z.string().trim().max(2).or(z.literal("")),
  responsavel_id: z.string().optional(),
  observacoes: z.string().trim().max(1000).or(z.literal("")),
});

type FormValues = z.infer<typeof schema>;

const defaultValues: FormValues = {
  nome: "", email: "", telefone: "", cpf: "", data_nascimento: "",
  cep: "", logradouro: "", numero: "", complemento: "", bairro: "", cidade: "", uf: "",
  responsavel_id: undefined, observacoes: "",
};

interface Props {
  onCreated: () => void;
}

export default function AddClienteAvulsoDialog({ onCreated }: Props) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [profissionais, setProfissionais] = useState<{ user_id: string; full_name: string }[]>([]);

  const form = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues });

  useEffect(() => {
    if (!open) return;
    (async () => {
      const { data: roles } = await supabase
        .from("user_roles")
        .select("user_id, role")
        .in("role", ["nutricionista", "fisioterapeuta", "coordenador", "admin"]);
      if (!roles?.length) return;
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, full_name")
        .in("user_id", roles.map((r) => r.user_id));
      if (profiles) setProfissionais(profiles.filter((p) => !!p.full_name) as any);
    })();
  }, [open]);

  async function handleCepBlur(value: string) {
    const res = await fetchCep(value);
    if (!res) return;
    form.setValue("logradouro", res.logradouro || "");
    form.setValue("bairro", res.bairro || "");
    form.setValue("cidade", res.localidade || "");
    form.setValue("uf", res.uf || "");
  }

  async function onSubmit(values: FormValues) {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { toast.error("Você precisa estar logado."); return; }

      const cpfDigits = normalizeCpf(values.cpf);
      if (cpfDigits) {
        if (!isValidCpfDigits(cpfDigits)) {
          toast.error("CPF inválido.");
          return;
        }
        const existente = await findAlunoByCpf(cpfDigits);
        if (existente) {
          toast.error(`CPF já cadastrado para ${existente.nome}.`);
          return;
        }
      }

      const { data: cliente, error } = await supabase
        .from("alunos")
        .insert({
          nome: values.nome,
          email: values.email || null,
          telefone: values.telefone || null,
          data_nascimento: values.data_nascimento || null,
          status: "avulso",
          cep: values.cep || null,
          logradouro: values.logradouro || null,
          numero: values.numero || null,
          complemento: values.complemento || null,
          bairro: values.bairro || null,
          cidade: values.cidade || null,
          uf: values.uf || null,
          observacoes: values.observacoes || null,
          responsavel_id: values.responsavel_id || user.id,
        })
        .select("id")
        .single();
      if (error) throw error;

      if (cpfDigits.length === 11 && cliente) {
        const { error: cpfErr } = await supabase.rpc("fn_update_cpf", {
          p_aluno_id: cliente.id,
          p_novo_cpf: cpfDigits,
        });
        if (cpfErr) console.error("Erro ao gravar CPF:", cpfErr);
      }

      toast.success("Cliente avulso cadastrado!");
      form.reset(defaultValues);
      setOpen(false);
      onCreated();
    } catch (err: any) {
      toast.error(err?.message || "Erro ao cadastrar cliente avulso.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-2"><Plus className="w-4 h-4" />Novo Cliente Avulso</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[560px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Cadastrar Cliente Avulso</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 mt-2">
            <FormField
              control={form.control}
              name="nome"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nome *</FormLabel>
                  <FormControl><Input placeholder="Nome completo" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>E-mail</FormLabel>
                    <FormControl><Input type="email" placeholder="email@exemplo.com" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="telefone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Telefone</FormLabel>
                    <FormControl><Input placeholder="(51) 99999-9999" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="cpf"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>CPF</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="000.000.000-00"
                        {...field}
                        onChange={(e) => field.onChange(e.target.value.replace(/\D/g, "").slice(0, 11))}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="data_nascimento"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Data de Nascimento</FormLabel>
                    <FormControl><Input type="date" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-3 gap-3">
              <FormField
                control={form.control}
                name="cep"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>CEP</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="00000-000"
                        {...field}
                        onChange={(e) => field.onChange(formatCep(e.target.value))}
                        onBlur={(e) => handleCepBlur(e.target.value)}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="logradouro"
                render={({ field }) => (
                  <FormItem className="col-span-2">
                    <FormLabel>Logradouro</FormLabel>
                    <FormControl><Input placeholder="Rua / Avenida" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-3 gap-3">
              <FormField
                control={form.control}
                name="numero"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Número</FormLabel>
                    <FormControl><Input {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="complemento"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Complemento</FormLabel>
                    <FormControl><Input {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="bairro"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Bairro</FormLabel>
                    <FormControl><Input {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-3 gap-3">
              <FormField
                control={form.control}
                name="cidade"
                render={({ field }) => (
                  <FormItem className="col-span-2">
                    <FormLabel>Cidade</FormLabel>
                    <FormControl><Input {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="uf"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>UF</FormLabel>
                    <FormControl>
                      <Input
                        maxLength={2}
                        {...field}
                        onChange={(e) => field.onChange(e.target.value.toUpperCase().slice(0, 2))}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="responsavel_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Profissional Responsável</FormLabel>
                  <Select value={field.value || ""} onValueChange={field.onChange}>
                    <FormControl><SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger></FormControl>
                    <SelectContent>
                      {profissionais.map((p) => (
                        <SelectItem key={p.user_id} value={p.user_id}>{p.full_name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="observacoes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Observações</FormLabel>
                  <FormControl><Textarea rows={3} placeholder="Serviços de interesse, histórico, etc." {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="ghost" onClick={() => setOpen(false)} disabled={loading}>
                Cancelar
              </Button>
              <Button type="submit" disabled={loading}>
                {loading ? "Cadastrando…" : "Cadastrar"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
