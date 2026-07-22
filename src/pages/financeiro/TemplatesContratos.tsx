import { useEffect, useMemo, useState } from 'react';
import { FileText, History, Pencil, ScrollText, Info, Plus } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  useContratoTemplates,
  useRegulamentoInternoAtivo,
  useHistoricoTemplate,
  useHistoricoRegulamento,
  useSalvarContratoTemplate,
  useSalvarRegulamentoInterno,
  useCriarContratoTemplate,
} from '@/hooks/useContratoTemplates';
import {
  PLANO_LABELS, FORMA_PAGAMENTO_LABELS, type PlanoTipo, type FormaPagamento,
} from '@/types/financeiro';
import {
  aplicarMergeFieldsExemplo, PLANOS_ORDEM,
  type ContratoTemplate, type RegulamentoInternoVersao,
} from '@/types/contratoTemplates';

const fmtDate = (iso: string) => format(new Date(iso), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });

/* ─────────────────────────── Editor de Template ─────────────────────────── */

interface EditorTemplateProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  template: ContratoTemplate | null;
}

function EditorTemplate({ open, onOpenChange, template }: EditorTemplateProps) {
  const [nome, setNome] = useState('');
  const [conteudo, setConteudo] = useState('');
  const salvar = useSalvarContratoTemplate();

  useEffect(() => {
    if (template) {
      setNome(template.nome);
      setConteudo(template.conteudo ?? '');
    }
  }, [template]);

  if (!template) return null;

  const handleSalvar = async () => {
    await salvar.mutateAsync({
      plano_tipo: template.plano_tipo,
      forma_pagamento: template.forma_pagamento,
      nome,
      conteudo,
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[92vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>
            Editar template — {PLANO_LABELS[template.plano_tipo]} · {FORMA_PAGAMENTO_LABELS[template.forma_pagamento]}
          </DialogTitle>
          <DialogDescription>
            Versão atual: v{template.versao}. Salvar cria uma <b>nova versão</b> — contratos já gerados para alunos permanecem inalterados.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3 py-2">
          <div>
            <Label htmlFor="nome">Nome</Label>
            <Input id="nome" value={nome} onChange={(e) => setNome(e.target.value)} />
          </div>
        </div>

        <Tabs defaultValue="editar" className="flex-1 flex flex-col overflow-hidden">
          <TabsList className="w-fit">
            <TabsTrigger value="editar">Editar</TabsTrigger>
            <TabsTrigger value="preview">Pré-visualizar</TabsTrigger>
          </TabsList>

          <TabsContent value="editar" className="flex-1 overflow-auto mt-2">
            <Textarea
              value={conteudo}
              onChange={(e) => setConteudo(e.target.value)}
              className="font-mono text-xs min-h-[420px] h-[52vh]"
              placeholder="HTML do contrato com merge fields — ex: %NOME%, %CPF%, %VALOR_FINAL_CONTRATO%"
            />
            <p className="text-xs text-muted-foreground mt-2">
              Merge fields disponíveis: %NOME%, %CPF%, %RG%, %EMAIL%, %TELEFONE%, %ENDERECO%, %PLANO%, %FREQUENCIA%, %VALOR_BASE%, %VALOR_FINAL_CONTRATO%, %VALOR_MENSAL%, %FORMA_PAGAMENTO%, %PARCELAS%, %DATA_INICIO%, %DATA_FIM%, %DIA%, %MES%, %ANO%, %DATA_HOJE%, %CIDADE%, %ESTADO%.
            </p>
          </TabsContent>

          <TabsContent value="preview" className="flex-1 overflow-auto mt-2">
            <div
              className="prose prose-sm dark:prose-invert max-w-none border rounded-md p-4 bg-background min-h-[420px]"
              dangerouslySetInnerHTML={{ __html: aplicarMergeFieldsExemplo(conteudo) }}
            />
          </TabsContent>
        </Tabs>

        <Alert className="mt-2">
          <Info className="h-4 w-4" />
          <AlertDescription>
            Ao salvar, este template será marcado como v{template.versao + 1}. A versão atual (v{template.versao}) fica arquivada no histórico. Contratos já emitidos <b>não são alterados</b>.
          </AlertDescription>
        </Alert>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSalvar} disabled={salvar.isPending || !nome.trim() || !conteudo.trim()}>
            {salvar.isPending ? 'Salvando…' : 'Salvar nova versão'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ─────────────────────── Criar Novo Template ─────────────────────── */

const FORMAS_TEMPLATE: FormaPagamento[] = ['cartao_recorrencia', 'cartao_parcelado'];
const PLANOS_TEMPLATE: PlanoTipo[] = [
  'start', 'start_plus', 'power', 'pro', 'max',
  'corrida', 'gympass', 'wellhub', 'totalpass', 'outro',
];

interface CriarTemplateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  existentes: ContratoTemplate[];
}

function CriarTemplateDialog({ open, onOpenChange, existentes }: CriarTemplateDialogProps) {
  const [planoTipo, setPlanoTipo] = useState<PlanoTipo | ''>('');
  const [formaPagamento, setFormaPagamento] = useState<FormaPagamento | ''>('');
  const [nome, setNome] = useState('');
  const [conteudo, setConteudo] = useState('');
  const criar = useCriarContratoTemplate();

  useEffect(() => {
    if (open) {
      setPlanoTipo('');
      setFormaPagamento('');
      setNome('');
      setConteudo('');
    }
  }, [open]);

  const duplicado = useMemo(() => {
    if (!planoTipo || !formaPagamento) return false;
    return existentes.some(
      (t) => t.plano_tipo === planoTipo && t.forma_pagamento === formaPagamento && t.ativo,
    );
  }, [planoTipo, formaPagamento, existentes]);

  const podeSalvar =
    !!planoTipo && !!formaPagamento && !duplicado && nome.trim() !== '' && conteudo.trim() !== '';

  const handleCriar = async () => {
    if (!planoTipo || !formaPagamento) return;
    await criar.mutateAsync({
      plano_tipo: planoTipo,
      forma_pagamento: formaPagamento,
      nome,
      conteudo,
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[92vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Criar novo template de contrato</DialogTitle>
          <DialogDescription>
            Selecione o plano e a forma de pagamento. Só é possível criar um template ativo por combinação.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3 py-2 md:grid-cols-2">
          <div>
            <Label>Plano</Label>
            <Select value={planoTipo} onValueChange={(v) => setPlanoTipo(v as PlanoTipo)}>
              <SelectTrigger><SelectValue placeholder="Selecione o plano" /></SelectTrigger>
              <SelectContent>
                {PLANOS_TEMPLATE.map((p) => (
                  <SelectItem key={p} value={p}>{PLANO_LABELS[p]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Forma de pagamento</Label>
            <Select value={formaPagamento} onValueChange={(v) => setFormaPagamento(v as FormaPagamento)}>
              <SelectTrigger><SelectValue placeholder="Selecione a forma" /></SelectTrigger>
              <SelectContent>
                {FORMAS_TEMPLATE.map((f) => (
                  <SelectItem key={f} value={f}>{FORMA_PAGAMENTO_LABELS[f]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {duplicado && (
          <Alert variant="destructive">
            <Info className="h-4 w-4" />
            <AlertDescription>
              Já existe um template ativo para <b>{PLANO_LABELS[planoTipo as PlanoTipo]} · {FORMA_PAGAMENTO_LABELS[formaPagamento as FormaPagamento]}</b>.
              Para alterá-lo, use <b>Editar</b> na lista principal (isso cria uma nova versão preservando a atual).
            </AlertDescription>
          </Alert>
        )}

        <div className="grid gap-3 py-2">
          <div>
            <Label htmlFor="novo-nome">Nome</Label>
            <Input
              id="novo-nome"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Ex: Contrato Pro — Cartão Recorrência"
            />
          </div>
        </div>

        <Tabs defaultValue="editar" className="flex-1 flex flex-col overflow-hidden">
          <TabsList className="w-fit">
            <TabsTrigger value="editar">Editar</TabsTrigger>
            <TabsTrigger value="preview">Pré-visualizar</TabsTrigger>
          </TabsList>

          <TabsContent value="editar" className="flex-1 overflow-auto mt-2">
            <Textarea
              value={conteudo}
              onChange={(e) => setConteudo(e.target.value)}
              className="font-mono text-xs min-h-[420px] h-[52vh]"
              placeholder="HTML do contrato com merge fields — ex: %NOME%, %CPF%, %VALOR_FINAL_CONTRATO%"
            />
            <p className="text-xs text-muted-foreground mt-2">
              Merge fields disponíveis: %NOME%, %CPF%, %RG%, %EMAIL%, %TELEFONE%, %ENDERECO%, %PLANO%, %FREQUENCIA%, %VALOR_BASE%, %VALOR_FINAL_CONTRATO%, %VALOR_MENSAL%, %FORMA_PAGAMENTO%, %PARCELAS%, %DATA_INICIO%, %DATA_FIM%, %DIA%, %MES%, %ANO%, %DATA_HOJE%, %CIDADE%, %ESTADO%.
            </p>
          </TabsContent>

          <TabsContent value="preview" className="flex-1 overflow-auto mt-2">
            <div
              className="prose prose-sm dark:prose-invert max-w-none border rounded-md p-4 bg-background min-h-[420px]"
              dangerouslySetInnerHTML={{ __html: aplicarMergeFieldsExemplo(conteudo) }}
            />
          </TabsContent>
        </Tabs>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleCriar} disabled={!podeSalvar || criar.isPending}>
            {criar.isPending ? 'Criando…' : 'Criar template'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ─────────────────── Editor do Regulamento Interno ─────────────────── */

interface EditorRegulamentoProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  atual: RegulamentoInternoVersao | null;
}

function EditorRegulamento({ open, onOpenChange, atual }: EditorRegulamentoProps) {
  const [conteudo, setConteudo] = useState('');
  const salvar = useSalvarRegulamentoInterno();

  useEffect(() => {
    if (atual) setConteudo(atual.conteudo ?? '');
    else setConteudo('');
  }, [atual]);

  const handleSalvar = async () => {
    await salvar.mutateAsync({ conteudo });
    onOpenChange(false);
  };

  const versaoAtual = atual?.versao ?? 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[92vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Editar Regulamento Interno</DialogTitle>
          <DialogDescription>
            Este texto é compartilhado por <b>todos os contratos</b>. Salvar cria a v{versaoAtual + 1}.
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="editar" className="flex-1 flex flex-col overflow-hidden mt-2">
          <TabsList className="w-fit">
            <TabsTrigger value="editar">Editar</TabsTrigger>
            <TabsTrigger value="preview">Pré-visualizar</TabsTrigger>
          </TabsList>

          <TabsContent value="editar" className="flex-1 overflow-auto mt-2">
            <Textarea
              value={conteudo}
              onChange={(e) => setConteudo(e.target.value)}
              className="font-mono text-xs min-h-[420px] h-[52vh]"
            />
          </TabsContent>

          <TabsContent value="preview" className="flex-1 overflow-auto mt-2">
            <div
              className="prose prose-sm dark:prose-invert max-w-none border rounded-md p-4 bg-background min-h-[420px]"
              dangerouslySetInnerHTML={{ __html: aplicarMergeFieldsExemplo(conteudo) }}
            />
          </TabsContent>
        </Tabs>

        <Alert className="mt-2">
          <Info className="h-4 w-4" />
          <AlertDescription>
            Alterar o regulamento afeta a versão referenciada por <b>novos</b> contratos. Contratos já emitidos mantêm a versão anterior.
          </AlertDescription>
        </Alert>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSalvar} disabled={salvar.isPending || !conteudo.trim()}>
            {salvar.isPending ? 'Salvando…' : 'Salvar nova versão'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ─────────────────────────── Histórico ─────────────────────────── */

interface HistoricoTemplateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  template: ContratoTemplate | null;
}

function HistoricoTemplateDialog({ open, onOpenChange, template }: HistoricoTemplateDialogProps) {
  const { data, isLoading } = useHistoricoTemplate(template?.plano_tipo, template?.forma_pagamento);
  const [selecionada, setSelecionada] = useState<ContratoTemplate | null>(null);

  const versoes = data ?? [];
  const atual = selecionada ?? versoes[0] ?? null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[92vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>
            Histórico — {template ? `${PLANO_LABELS[template.plano_tipo]} · ${FORMA_PAGAMENTO_LABELS[template.forma_pagamento]}` : ''}
          </DialogTitle>
          <DialogDescription>Visualização somente-leitura das versões anteriores.</DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-[240px_1fr] gap-4 flex-1 overflow-hidden">
          <div className="border rounded-md overflow-auto">
            {isLoading ? (
              <div className="p-3 space-y-2"><Skeleton className="h-8" /><Skeleton className="h-8" /></div>
            ) : versoes.length === 0 ? (
              <p className="p-3 text-sm text-muted-foreground">Sem versões.</p>
            ) : (
              <ul className="divide-y">
                {versoes.map((v) => (
                  <li key={v.id}>
                    <button
                      onClick={() => setSelecionada(v)}
                      className={`w-full text-left p-3 hover:bg-muted/50 transition ${atual?.id === v.id ? 'bg-muted' : ''}`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-medium">v{v.versao}</span>
                        {v.ativo && <Badge variant="outline" className="text-[10px]">Ativa</Badge>}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">{fmtDate(v.created_at)}</p>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="border rounded-md p-4 overflow-auto bg-background">
            {atual ? (
              <div
                className="prose prose-sm dark:prose-invert max-w-none"
                dangerouslySetInnerHTML={{ __html: aplicarMergeFieldsExemplo(atual.conteudo ?? '') }}
              />
            ) : (
              <p className="text-sm text-muted-foreground">Selecione uma versão para visualizar.</p>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Fechar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function HistoricoRegulamentoDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const { data, isLoading } = useHistoricoRegulamento();
  const [selecionada, setSelecionada] = useState<RegulamentoInternoVersao | null>(null);

  const versoes = data ?? [];
  const atual = selecionada ?? versoes[0] ?? null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[92vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Histórico do Regulamento Interno</DialogTitle>
          <DialogDescription>Visualização somente-leitura das versões anteriores.</DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-[240px_1fr] gap-4 flex-1 overflow-hidden">
          <div className="border rounded-md overflow-auto">
            {isLoading ? (
              <div className="p-3 space-y-2"><Skeleton className="h-8" /><Skeleton className="h-8" /></div>
            ) : versoes.length === 0 ? (
              <p className="p-3 text-sm text-muted-foreground">Sem versões.</p>
            ) : (
              <ul className="divide-y">
                {versoes.map((v) => (
                  <li key={v.id}>
                    <button
                      onClick={() => setSelecionada(v)}
                      className={`w-full text-left p-3 hover:bg-muted/50 transition ${atual?.id === v.id ? 'bg-muted' : ''}`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-medium">v{v.versao}</span>
                        {v.ativo && <Badge variant="outline" className="text-[10px]">Ativa</Badge>}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">{fmtDate(v.created_at)}</p>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="border rounded-md p-4 overflow-auto bg-background">
            {atual ? (
              <div
                className="prose prose-sm dark:prose-invert max-w-none"
                dangerouslySetInnerHTML={{ __html: aplicarMergeFieldsExemplo(atual.conteudo ?? '') }}
              />
            ) : (
              <p className="text-sm text-muted-foreground">Selecione uma versão para visualizar.</p>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Fechar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ─────────────────────────── Página ─────────────────────────── */

export default function TemplatesContratos() {
  const { data: templates, isLoading } = useContratoTemplates();
  const { data: regulamento, isLoading: loadingReg } = useRegulamentoInternoAtivo();

  const [editando, setEditando] = useState<ContratoTemplate | null>(null);
  const [historico, setHistorico] = useState<ContratoTemplate | null>(null);
  const [editandoReg, setEditandoReg] = useState(false);
  const [historicoReg, setHistoricoReg] = useState(false);

  const porPlano = useMemo(() => {
    const map = new Map<PlanoTipo, ContratoTemplate[]>();
    for (const p of PLANOS_ORDEM) map.set(p, []);
    (templates ?? []).forEach((t) => {
      if (!map.has(t.plano_tipo)) map.set(t.plano_tipo, []);
      map.get(t.plano_tipo)!.push(t);
    });
    return map;
  }, [templates]);

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-7xl mx-auto">
      <header className="space-y-1">
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight flex items-center gap-2">
          <FileText className="h-6 w-6 text-primary" />
          Templates de Contratos
        </h1>
        <p className="text-sm text-muted-foreground">
          Modelos versionados usados para gerar contratos de alunos. Cada plano possui variantes por forma de pagamento.
        </p>
      </header>

      {/* Regulamento Interno — bloco compartilhado */}
      <Card className="border-primary/30">
        <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
          <div className="space-y-1">
            <CardTitle className="flex items-center gap-2 text-lg">
              <ScrollText className="h-5 w-5 text-primary" />
              Regulamento Interno
            </CardTitle>
            <p className="text-xs text-muted-foreground max-w-2xl">
              Texto único aplicado a <b>todos os contratos</b>. Alterá-lo afeta contratos gerados a partir da nova versão.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={() => setHistoricoReg(true)}>
              <History className="h-4 w-4 mr-1" /> Ver histórico
            </Button>
            <Button size="sm" onClick={() => setEditandoReg(true)}>
              <Pencil className="h-4 w-4 mr-1" /> Editar
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loadingReg ? (
            <Skeleton className="h-6 w-40" />
          ) : regulamento ? (
            <div className="flex items-center gap-2 text-sm">
              <Badge variant="outline">v{regulamento.versao} · Ativa</Badge>
              <span className="text-muted-foreground">Atualizada em {fmtDate(regulamento.updated_at)}</span>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Nenhuma versão cadastrada ainda.</p>
          )}
        </CardContent>
      </Card>

      {/* Templates por plano */}
      {isLoading ? (
        <div className="grid gap-4">
          {[0, 1, 2].map((i) => <Skeleton key={i} className="h-40" />)}
        </div>
      ) : (
        <div className="grid gap-4">
          {PLANOS_ORDEM.map((plano) => {
            const items = porPlano.get(plano) ?? [];
            return (
              <Card key={plano}>
                <CardHeader>
                  <CardTitle className="text-lg">{PLANO_LABELS[plano]}</CardTitle>
                </CardHeader>
                <CardContent>
                  {items.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Nenhum template ativo para este plano.</p>
                  ) : (
                    <div className="grid gap-2">
                      {items.map((t) => (
                        <div
                          key={t.id}
                          className="flex flex-wrap items-center justify-between gap-3 border rounded-md p-3 hover:bg-muted/30 transition"
                        >
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="font-medium truncate">{t.nome}</span>
                              <Badge variant="secondary">{FORMA_PAGAMENTO_LABELS[t.forma_pagamento] ?? t.forma_pagamento}</Badge>
                              <Badge variant="outline">v{t.versao}</Badge>
                              <Badge className="bg-green-500/15 text-green-700 dark:text-green-400 border-green-500/30" variant="outline">Ativo</Badge>
                            </div>
                            <p className="text-xs text-muted-foreground mt-1">Atualizado em {fmtDate(t.updated_at)}</p>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <Button variant="outline" size="sm" onClick={() => setHistorico(t)}>
                              <History className="h-4 w-4 mr-1" /> Ver histórico
                            </Button>
                            <Button size="sm" onClick={() => setEditando(t)}>
                              <Pencil className="h-4 w-4 mr-1" /> Editar
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <EditorTemplate
        open={!!editando}
        onOpenChange={(o) => !o && setEditando(null)}
        template={editando}
      />
      <HistoricoTemplateDialog
        open={!!historico}
        onOpenChange={(o) => !o && setHistorico(null)}
        template={historico}
      />
      <EditorRegulamento
        open={editandoReg}
        onOpenChange={setEditandoReg}
        atual={regulamento ?? null}
      />
      <HistoricoRegulamentoDialog open={historicoReg} onOpenChange={setHistoricoReg} />
    </div>
  );
}
