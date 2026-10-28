import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Loader2, Mail, MessageCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

type Canal = "email" | "whatsapp";
type Status = "rascunho" | "a_cadastrar" | "aprovado";
type Variavel = { pos: number; fonte: "campo" | "fixo"; valor: string };
type Modelo = {
  id: string; nome: string; canal: Canal; meta_nome: string | null; idioma: string;
  categoria: string | null; texto: string | null; variaveis: Variavel[]; assunto: string | null;
  corpo_html: string | null; status: Status;
};

const STATUS_LABEL: Record<Status, string> = { rascunho: "Rascunho", a_cadastrar: "A cadastrar na Meta", aprovado: "Aprovado" };
const CAMPOS = [
  { v: "primeiro_nome", l: "Primeiro nome" },
  { v: "nome_aluno", l: "Nome completo" },
  { v: "email", l: "E-mail" },
  { v: "telefone", l: "Telefone" },
  { v: "link_festa", l: "Link da festa" },
  { v: "prazo_confirmacao", l: "Prazo de confirmação" },
];
export const VARIAVEIS_EMAIL = ["%NOME_ALUNO%", "%PRIMEIRO_NOME%", "%EMAIL%", "%TELEFONE%", "%LINK_FESTA%", "%PRAZO_CONFIRMACAO%"];

const vazio = (): Omit<Modelo, "id"> => ({
  nome: "", canal: "whatsapp", meta_nome: "", idioma: "pt_BR", categoria: "MARKETING",
  texto: "", variaveis: [], assunto: "", corpo_html: "", status: "rascunho",
});

function contarVariaveis(texto: string): number {
  const nums = [...texto.matchAll(/\{\{(\d+)\}\}/g)].map((m) => Number(m[1]));
  return nums.length ? Math.max(...nums) : 0;
}

export default function DisparosModelos() {
  const qc = useQueryClient();
  const [aberto, setAberto] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(vazio());
  const [excluir, setExcluir] = useState<Modelo | null>(null);

  const { data: modelos = [], isLoading } = useQuery({
    queryKey: ["msg_modelos"],
    queryFn: async () => {
      const { data, error } = await supabase.from("msg_modelos").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as Modelo[];
    },
  });

  const nVars = useMemo(() => (form.canal === "whatsapp" ? contarVariaveis(form.texto ?? "") : 0), [form.canal, form.texto]);
  const variaveis: Variavel[] = Array.from({ length: nVars }, (_, i) =>
    form.variaveis.find((v) => v.pos === i + 1) ?? { pos: i + 1, fonte: "campo", valor: "primeiro_nome" });

  const setVar = (pos: number, patch: Partial<Variavel>) => {
    const lista = variaveis.map((v) => (v.pos === pos ? { ...v, ...patch } : v));
    setForm({ ...form, variaveis: lista });
  };

  const salvar = useMutation({
    mutationFn: async () => {
      if (!form.nome.trim()) throw new Error("Informe o nome interno.");
      const base = { nome: form.nome.trim(), canal: form.canal, status: form.status };
      const payload = form.canal === "whatsapp"
        ? {
            ...base, meta_nome: form.meta_nome?.trim() || null, idioma: form.idioma || "pt_BR",
            categoria: form.categoria, texto: form.texto, variaveis: variaveis, assunto: null, corpo_html: null,
          }
        : {
            ...base, meta_nome: null, categoria: null, texto: null, variaveis: [],
            assunto: form.assunto?.trim() || null, corpo_html: form.corpo_html,
          };
      if (form.canal === "whatsapp" && form.status === "aprovado" && !payload.meta_nome)
        throw new Error("Para marcar como aprovado, informe o nome do modelo na Meta.");
      if (form.canal === "email" && (!payload.assunto || !form.corpo_html?.trim()))
        throw new Error("Informe assunto e corpo do e-mail.");
      const q = editId
        ? supabase.from("msg_modelos").update(payload as never).eq("id", editId)
        : supabase.from("msg_modelos").insert(payload as never);
      const { error } = await q;
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Modelo salvo");
      setAberto(false);
      qc.invalidateQueries({ queryKey: ["msg_modelos"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remover = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("msg_modelos").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Modelo excluído"); setExcluir(null); qc.invalidateQueries({ queryKey: ["msg_modelos"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const novo = () => { setEditId(null); setForm(vazio()); setAberto(true); };
  const editar = (m: Modelo) => {
    setEditId(m.id);
    setForm({ ...m, meta_nome: m.meta_nome ?? "", texto: m.texto ?? "", assunto: m.assunto ?? "", corpo_html: m.corpo_html ?? "", variaveis: m.variaveis ?? [] });
    setAberto(true);
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={novo}><Plus className="h-4 w-4 mr-1" /> Novo modelo</Button>
      </div>
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex justify-center py-10"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
          ) : modelos.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">Nenhum modelo cadastrado.</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="border-b text-left text-muted-foreground">
                <tr>
                  <th className="p-3 font-medium">Modelo</th>
                  <th className="p-3 font-medium">Canal</th>
                  <th className="p-3 font-medium">Nome na Meta</th>
                  <th className="p-3 font-medium">Status</th>
                  <th className="p-3" />
                </tr>
              </thead>
              <tbody>
                {modelos.map((m) => (
                  <tr key={m.id} className="border-b last:border-0">
                    <td className="p-3 font-medium">{m.nome}</td>
                    <td className="p-3">
                      <span className="inline-flex items-center gap-1">
                        {m.canal === "email" ? <Mail className="h-4 w-4" /> : <MessageCircle className="h-4 w-4" />}
                        {m.canal === "email" ? "E-mail" : "WhatsApp"}
                      </span>
                    </td>
                    <td className="p-3 text-muted-foreground">{m.meta_nome || "—"}</td>
                    <td className="p-3">
                      <Badge variant={m.status === "aprovado" ? "default" : m.status === "a_cadastrar" ? "secondary" : "outline"}>
                        {STATUS_LABEL[m.status]}
                      </Badge>
                    </td>
                    <td className="p-3 text-right whitespace-nowrap">
                      <Button size="icon" variant="ghost" aria-label="Editar" onClick={() => editar(m)}><Pencil className="h-4 w-4" /></Button>
                      <Button size="icon" variant="ghost" aria-label="Excluir" onClick={() => setExcluir(m)}><Trash2 className="h-4 w-4" /></Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      <Dialog open={aberto} onOpenChange={setAberto}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editId ? "Editar modelo" : "Novo modelo"}</DialogTitle></DialogHeader>
          <div className="grid gap-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Nome interno</Label>
                <Input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>Canal</Label>
                <Select value={form.canal} onValueChange={(v) => setForm({ ...form, canal: v as Canal })} disabled={!!editId}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="whatsapp">WhatsApp</SelectItem>
                    <SelectItem value="email">E-mail</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {form.canal === "whatsapp" ? (
              <>
                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-1.5 col-span-3 sm:col-span-1">
                    <Label>Nome do modelo na Meta</Label>
                    <Input value={form.meta_nome ?? ""} placeholder="ex.: convite_festa_10anos" onChange={(e) => setForm({ ...form, meta_nome: e.target.value })} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Idioma</Label>
                    <Input value={form.idioma} onChange={(e) => setForm({ ...form, idioma: e.target.value })} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Categoria</Label>
                    <Select value={form.categoria ?? "MARKETING"} onValueChange={(v) => setForm({ ...form, categoria: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="MARKETING">Marketing</SelectItem>
                        <SelectItem value="UTILITY">Utilidade</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">O nome deve ser idêntico ao aprovado na Meta.</p>
                <div className="space-y-1.5">
                  <Label>Texto aprovado</Label>
                  <Textarea rows={5} value={form.texto ?? ""} placeholder="Olá {{1}}, ..." onChange={(e) => setForm({ ...form, texto: e.target.value })} />
                </div>
                {variaveis.length > 0 && (
                  <div className="space-y-2">
                    <Label>O que cada variável recebe</Label>
                    {variaveis.map((v) => (
                      <div key={v.pos} className="grid grid-cols-[60px_140px_1fr] items-center gap-2">
                        <span className="text-sm font-mono">{`{{${v.pos}}}`}</span>
                        <Select value={v.fonte} onValueChange={(f) => setVar(v.pos, { fonte: f as Variavel["fonte"], valor: f === "campo" ? "primeiro_nome" : "" })}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="campo">Campo do aluno</SelectItem>
                            <SelectItem value="fixo">Valor fixo</SelectItem>
                          </SelectContent>
                        </Select>
                        {v.fonte === "campo" ? (
                          <Select value={v.valor} onValueChange={(val) => setVar(v.pos, { valor: val })}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>{CAMPOS.map((c) => <SelectItem key={c.v} value={c.v}>{c.l}</SelectItem>)}</SelectContent>
                          </Select>
                        ) : (
                          <Input value={v.valor} placeholder="ex.: https://soufortem.com.br/10anos" onChange={(e) => setVar(v.pos, { valor: e.target.value })} />
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <>
                <div className="space-y-1.5">
                  <Label>Assunto</Label>
                  <Input value={form.assunto ?? ""} onChange={(e) => setForm({ ...form, assunto: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label>Corpo</Label>
                  <Textarea rows={8} value={form.corpo_html ?? ""} onChange={(e) => setForm({ ...form, corpo_html: e.target.value })} />
                  <p className="text-xs text-muted-foreground">Variáveis: {VARIAVEIS_EMAIL.join(" ")}</p>
                </div>
              </>
            )}

            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v as Status })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(Object.keys(STATUS_LABEL) as Status[]).map((s) => <SelectItem key={s} value={s}>{STATUS_LABEL[s]}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAberto(false)}>Cancelar</Button>
            <Button onClick={() => salvar.mutate()} disabled={salvar.isPending}>
              {salvar.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />} Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!excluir} onOpenChange={(o) => !o && setExcluir(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir modelo?</AlertDialogTitle>
            <AlertDialogDescription>"{excluir?.nome}" será removido. Isso não altera nada na Meta.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => excluir && remover.mutate(excluir.id)}>Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
