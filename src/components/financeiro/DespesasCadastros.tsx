import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ChevronDown, ChevronRight, Pencil, Plus, Search } from "lucide-react";
import {
  useCategoriasDespesa, useCategoriaMutations, useUsoCategorias, useFornecedores, useFornecedorMutations,
} from "@/hooks/useDespesas";
import {
  TIPO_LABELS, compararCodigo, type DespesaCategoria, type DespesaTipo, type Fornecedor, type FornecedorInput,
} from "@/types/despesas";

const errMsg = (e: unknown) => (e instanceof Error ? e.message : "Erro inesperado");

/** Centrais (ordenadas) com suas subcategorias. Ignora categorias antigas (nivel nulo). */
export function useArvoreCategorias(categorias: DespesaCategoria[]) {
  return useMemo(() => {
    const ord = (a: DespesaCategoria, b: DespesaCategoria) =>
      (a.ordem ?? 9999) - (b.ordem ?? 9999) || compararCodigo(a.codigo, b.codigo);
    const centrais = categorias.filter((c) => c.nivel === "central").sort(ord);
    const subsPor = new Map<string, DespesaCategoria[]>();
    categorias.filter((c) => c.nivel === "sub" && c.categoria_pai_id).forEach((c) => {
      const l = subsPor.get(c.categoria_pai_id!) ?? [];
      l.push(c);
      subsPor.set(c.categoria_pai_id!, l);
    });
    subsPor.forEach((l) => l.sort(ord));
    return { centrais, subsPor };
  }, [categorias]);
}

/** Nome de exibição: "1.5 Central › Sub" ou o nome antigo. */
export function nomeCategoria(c: DespesaCategoria | undefined, map: Map<string, DespesaCategoria>) {
  if (!c) return "—";
  if (c.nivel === "sub" && c.categoria_pai_id) {
    const pai = map.get(c.categoria_pai_id);
    return `${pai?.nome ?? ""} › ${c.nome}`;
  }
  return c.nome;
}

export function CategoriasHierarquia({ canEdit }: { canEdit: boolean }) {
  const { data: categorias = [], isLoading } = useCategoriasDespesa(false);
  const { data: uso = {} } = useUsoCategorias();
  const { alternarAtivo } = useCategoriaMutations();
  const { centrais, subsPor } = useArvoreCategorias(categorias);
  const [abertas, setAbertas] = useState<Set<string>>(new Set());
  const [editor, setEditor] = useState<{ pai?: DespesaCategoria; sub?: DespesaCategoria } | null>(null);

  const toggle = (id: string) => setAbertas((s) => {
    const n = new Set(s);
    if (n.has(id)) n.delete(id); else n.add(id);
    return n;
  });
  const ativar = (id: string, ativo: boolean) =>
    alternarAtivo.mutate({ id, ativo }, { onError: (e) => toast.error(errMsg(e)) });

  return (
    <Card className="glass-card">
      <CardContent className="pt-4 space-y-2">
        <p className="text-xs text-muted-foreground">
          Categorias centrais são definidas pela administração. Aqui você pode criar e editar subcategorias.
          As categorias antigas continuam no histórico, mas não aparecem em lançamentos novos.
        </p>
        {isLoading && <p className="text-sm text-muted-foreground">Carregando…</p>}
        {centrais.map((c) => {
          const subs = subsPor.get(c.id) ?? [];
          const aberta = abertas.has(c.id);
          return (
            <div key={c.id} className={`rounded-md border ${c.ativo ? "" : "opacity-60"}`}>
              <div className="flex items-center gap-2 px-3 py-2">
                <button type="button" onClick={() => toggle(c.id)} className="flex flex-1 items-center gap-2 text-left" aria-expanded={aberta}>
                  {aberta ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                  <span className="text-muted-foreground tabular-nums w-6">{c.codigo}</span>
                  <span className="font-medium">{c.nome}</span>
                  <Badge variant="outline" className="ml-2 text-xs">{subs.length} sub</Badge>
                  <span className="ml-auto text-xs text-muted-foreground">{uso[c.id] ?? 0} lançamento(s)</span>
                </button>
                <Switch checked={c.ativo} disabled={!canEdit} onCheckedChange={(v) => ativar(c.id, v)} aria-label="Ativa" />
              </div>
              {aberta && (
                <div className="border-t px-3 pb-3">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-16">Código</TableHead>
                        <TableHead>Subcategoria</TableHead>
                        <TableHead>Tipo</TableHead>
                        <TableHead className="w-16 text-right">Ordem</TableHead>
                        <TableHead className="text-right">Lançamentos</TableHead>
                        <TableHead>Ativa</TableHead>
                        {canEdit && <TableHead className="w-12" />}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {subs.map((s) => (
                        <TableRow key={s.id} className={s.ativo ? "" : "opacity-60"}>
                          <TableCell className="py-1.5 tabular-nums">{s.codigo}</TableCell>
                          <TableCell className="py-1.5">{s.nome}</TableCell>
                          <TableCell className="py-1.5"><Badge variant={s.tipo === "fixa" ? "secondary" : "outline"}>{TIPO_LABELS[s.tipo]}</Badge></TableCell>
                          <TableCell className="py-1.5 text-right">{s.ordem ?? "—"}</TableCell>
                          <TableCell className="py-1.5 text-right">{uso[s.id] ?? 0}</TableCell>
                          <TableCell className="py-1.5">
                            <Switch checked={s.ativo} disabled={!canEdit} onCheckedChange={(v) => ativar(s.id, v)} />
                          </TableCell>
                          {canEdit && (
                            <TableCell className="py-1.5 text-right">
                              <Button variant="ghost" size="icon" aria-label="Editar subcategoria" onClick={() => setEditor({ pai: c, sub: s })}>
                                <Pencil className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          )}
                        </TableRow>
                      ))}
                      {subs.length === 0 && (
                        <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground text-sm">
                          Sem subcategorias — esta categoria pode ser usada diretamente nos lançamentos.
                        </TableCell></TableRow>
                      )}
                    </TableBody>
                  </Table>
                  {canEdit && (
                    <Button variant="outline" size="sm" className="mt-2" onClick={() => setEditor({ pai: c })}>
                      <Plus className="h-4 w-4 mr-1" /> Nova subcategoria
                    </Button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </CardContent>
      {editor && <SubcategoriaDialog pai={editor.pai} sub={editor.sub} onClose={() => setEditor(null)} />}
    </Card>
  );
}

function SubcategoriaDialog({ pai, sub, onClose }: { pai?: DespesaCategoria; sub?: DespesaCategoria; onClose: () => void }) {
  const { salvarSub } = useCategoriaMutations();
  const [nome, setNome] = useState(sub?.nome ?? "");
  const [tipo, setTipo] = useState<DespesaTipo>(sub?.tipo ?? pai?.tipo ?? "fixa");
  const [ordem, setOrdem] = useState(sub?.ordem != null ? String(sub.ordem) : "");

  const submit = async () => {
    const o = ordem.trim() ? Number(ordem) : null;
    if (o !== null && !Number.isInteger(o)) return toast.error("Ordem deve ser um número inteiro.");
    try {
      await salvarSub.mutateAsync({ id: sub?.id, nome, tipo, ordem: o, pai });
      toast.success(sub ? "Subcategoria atualizada" : "Subcategoria criada");
      onClose();
    } catch (e) { toast.error(errMsg(e)); }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{sub ? "Editar subcategoria" : `Nova subcategoria em ${pai?.nome ?? ""}`}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3">
          <div className="space-y-1"><Label>Nome</Label><Input value={nome} onChange={(e) => setNome(e.target.value)} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Tipo</Label>
              <Select value={tipo} onValueChange={(v) => setTipo(v as DespesaTipo)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="fixa">Fixa</SelectItem>
                  <SelectItem value="variavel">Variável</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Ordem</Label>
              <Input inputMode="numeric" value={ordem} onChange={(e) => setOrdem(e.target.value)} placeholder={sub ? "" : "Automática"} />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={submit} disabled={salvarSub.isPending}>{salvarSub.isPending ? "Salvando…" : "Salvar"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function FornecedoresCadastro({ canEdit }: { canEdit: boolean }) {
  const { data: fornecedores = [], isLoading } = useFornecedores();
  const { data: categorias = [] } = useCategoriasDespesa(false);
  const { alternarAtivo } = useFornecedorMutations();
  const catMap = useMemo(() => new Map(categorias.map((c) => [c.id, c])), [categorias]);
  const [busca, setBusca] = useState("");
  const [aba, setAba] = useState<"todos" | "fornecedores" | "funcionarios">("todos");
  const [editor, setEditor] = useState<{ f?: Fornecedor } | null>(null);

  const linhas = fornecedores
    .filter((f) => aba === "todos" || (aba === "funcionarios" ? f.eh_funcionario : !f.eh_funcionario))
    .filter((f) => !busca.trim() || f.nome.toLowerCase().includes(busca.trim().toLowerCase()));

  return (
    <Card className="glass-card">
      <CardContent className="pt-4 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <Tabs value={aba} onValueChange={(v) => setAba(v as typeof aba)}>
            <TabsList>
              <TabsTrigger value="todos">Todos</TabsTrigger>
              <TabsTrigger value="fornecedores">Fornecedores</TabsTrigger>
              <TabsTrigger value="funcionarios">Funcionários</TabsTrigger>
            </TabsList>
          </Tabs>
          <div className="relative">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input className="pl-8 w-64" placeholder="Buscar por nome" value={busca} onChange={(e) => setBusca(e.target.value)} />
          </div>
          {canEdit && (
            <Button className="ml-auto" onClick={() => setEditor({})}><Plus className="h-4 w-4 mr-1" /> Novo fornecedor</Button>
          )}
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>CPF/CNPJ</TableHead>
              <TableHead>Categoria padrão</TableHead>
              <TableHead>Contato</TableHead>
              <TableHead>Ativo</TableHead>
              {canEdit && <TableHead className="w-12" />}
            </TableRow>
          </TableHeader>
          <TableBody>
            {linhas.map((f) => (
              <TableRow key={f.id} className={f.ativo ? "" : "opacity-60"}>
                <TableCell className="py-1.5">
                  {f.nome}
                  {f.eh_funcionario && <Badge className="ml-2 status-info">Funcionário</Badge>}
                </TableCell>
                <TableCell className="py-1.5">{f.tipo_pessoa ?? "—"}</TableCell>
                <TableCell className="py-1.5 text-xs">{f.cpf_cnpj ?? "—"}</TableCell>
                <TableCell className="py-1.5 text-sm">{f.categoria_padrao_id ? nomeCategoria(catMap.get(f.categoria_padrao_id), catMap) : "—"}</TableCell>
                <TableCell className="py-1.5 text-xs">{[f.telefone, f.email].filter(Boolean).join(" · ") || "—"}</TableCell>
                <TableCell className="py-1.5">
                  <Switch checked={f.ativo} disabled={!canEdit}
                    onCheckedChange={(v) => alternarAtivo.mutate({ id: f.id, ativo: v }, { onError: (e) => toast.error(errMsg(e)) })} />
                </TableCell>
                {canEdit && (
                  <TableCell className="py-1.5 text-right">
                    <Button variant="ghost" size="icon" aria-label="Editar fornecedor" onClick={() => setEditor({ f })}><Pencil className="h-4 w-4" /></Button>
                  </TableCell>
                )}
              </TableRow>
            ))}
            {!isLoading && linhas.length === 0 && (
              <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground">Nenhum fornecedor encontrado</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
      {editor && <FornecedorDialog fornecedor={editor.f} categorias={categorias} onClose={() => setEditor(null)} />}
    </Card>
  );
}

function FornecedorDialog({ fornecedor, categorias, onClose }: {
  fornecedor?: Fornecedor; categorias: DespesaCategoria[]; onClose: () => void;
}) {
  const { salvar } = useFornecedorMutations();
  const { centrais, subsPor } = useArvoreCategorias(categorias);
  const [f, setF] = useState<FornecedorInput>({
    nome: fornecedor?.nome ?? "", tipo_pessoa: fornecedor?.tipo_pessoa ?? "PJ", cpf_cnpj: fornecedor?.cpf_cnpj ?? "",
    categoria_padrao_id: fornecedor?.categoria_padrao_id ?? null, eh_funcionario: fornecedor?.eh_funcionario ?? false,
    telefone: fornecedor?.telefone ?? "", email: fornecedor?.email ?? "", observacao: fornecedor?.observacao ?? "", chave_pix: fornecedor?.chave_pix ?? "",
    ativo: fornecedor?.ativo ?? true,
  });
  const set = <K extends keyof FornecedorInput>(k: K, v: FornecedorInput[K]) => setF((p) => ({ ...p, [k]: v }));
  const vazioNull = (s: string | null) => (s?.trim() ? s.trim() : null);

  const submit = async () => {
    try {
      await salvar.mutateAsync({
        id: fornecedor?.id,
        input: { ...f, cpf_cnpj: vazioNull(f.cpf_cnpj), telefone: vazioNull(f.telefone), email: vazioNull(f.email), observacao: vazioNull(f.observacao), chave_pix: vazioNull(f.chave_pix ?? null) },
      });
      toast.success(fornecedor ? "Fornecedor atualizado" : "Fornecedor cadastrado");
      onClose();
    } catch (e) { toast.error(errMsg(e)); }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>{fornecedor ? "Editar fornecedor" : "Novo fornecedor"}</DialogTitle></DialogHeader>
        <div className="grid gap-3">
          <div className="space-y-1"><Label>Nome</Label><Input value={f.nome} onChange={(e) => set("nome", e.target.value)} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Tipo de pessoa</Label>
              <Select value={f.tipo_pessoa ?? "PJ"} onValueChange={(v) => set("tipo_pessoa", v as "PF" | "PJ")}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="PJ">Pessoa jurídica</SelectItem>
                  <SelectItem value="PF">Pessoa física</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1"><Label>{f.tipo_pessoa === "PF" ? "CPF" : "CNPJ"}</Label><Input value={f.cpf_cnpj ?? ""} onChange={(e) => set("cpf_cnpj", e.target.value)} /></div>
            <div className="space-y-1"><Label>Telefone</Label><Input value={f.telefone ?? ""} onChange={(e) => set("telefone", e.target.value)} /></div>
            <div className="space-y-1"><Label>E-mail</Label><Input type="email" value={f.email ?? ""} onChange={(e) => set("email", e.target.value)} /></div>
          </div>
          <div className="space-y-1">
            <Label>Chave Pix</Label>
            <Input value={f.chave_pix ?? ""} onChange={(e) => set("chave_pix", e.target.value)} placeholder="CPF, CNPJ, e-mail, telefone ou chave aleatória" />
            <p className="text-xs text-muted-foreground">Usada na tela Pagamentos Pix.</p>
          </div>
          <div className="space-y-1">
            <Label>Categoria padrão</Label>
            <Select value={f.categoria_padrao_id ?? "nenhuma"} onValueChange={(v) => set("categoria_padrao_id", v === "nenhuma" ? null : v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="nenhuma">Nenhuma</SelectItem>
                {centrais.map((c) => {
                  const subs = (subsPor.get(c.id) ?? []).filter((s) => s.ativo || s.id === f.categoria_padrao_id);
                  if (subs.length === 0) return <SelectItem key={c.id} value={c.id}>{c.codigo} {c.nome}</SelectItem>;
                  return subs.map((s) => <SelectItem key={s.id} value={s.id}>{s.codigo} {c.nome} › {s.nome}</SelectItem>);
                })}
              </SelectContent>
            </Select>
          </div>
          <div className="flex gap-6">
            <div className="flex items-center gap-2"><Switch id="func" checked={f.eh_funcionario} onCheckedChange={(v) => set("eh_funcionario", v)} /><Label htmlFor="func">Funcionário</Label></div>
            <div className="flex items-center gap-2"><Switch id="ativo" checked={f.ativo} onCheckedChange={(v) => set("ativo", v)} /><Label htmlFor="ativo">Ativo</Label></div>
          </div>
          <div className="space-y-1"><Label>Observação</Label><Textarea rows={2} value={f.observacao ?? ""} onChange={(e) => set("observacao", e.target.value)} /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={submit} disabled={salvar.isPending}>{salvar.isPending ? "Salvando…" : "Salvar"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
