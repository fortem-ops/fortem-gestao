import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { useAdquirente, useMeiosPagamento } from '@/hooks/useAdquirente';
import { useUserRoles } from '@/hooks/useUserRoles';
import {
  BANDEIRAS, MODALIDADES, MODALIDADES_PARCELADAS,
  type Bandeira, type Modalidade, type AdquirenteTaxa, type PrazoUnidade, type MeioPagamento,
} from '@/types/adquirente';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Save, Undo2, Percent, Plus } from 'lucide-react';

type TaxasMap = Record<string, AdquirenteTaxa>;
type TaxaDraft = { taxa: string; prazo: string; unidade: PrazoUnidade; intervalo: string };
type MeioDraft = { taxa: string; prazo: string; unidade: PrazoUnidade; ativo: boolean };

const keyOf = (b: Bandeira, m: Modalidade) => `${b}_${m}`;
const fmt = (n: number | null | undefined) => String(Number(n ?? 0)).replace('.', ',');
const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const MEIO_LABEL: Record<MeioPagamento, string> = { pix: 'Pix', boleto: 'Boleto', dinheiro: 'Dinheiro' };

const parseNumber = (v: string): number => {
  const n = parseFloat(v.replace(/\./g, '').replace(',', '.'));
  return isNaN(n) ? 0 : n;
};
const parseIntOrNull = (v: string): number | null => {
  if (v.trim() === '') return null;
  const n = parseInt(v, 10);
  return isNaN(n) ? null : n;
};

function UnidadeSelect({ value, onChange, disabled }: { value: PrazoUnidade; onChange: (v: PrazoUnidade) => void; disabled?: boolean }) {
  return (
    <Select value={value} onValueChange={(v) => onChange(v as PrazoUnidade)} disabled={disabled}>
      <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
      <SelectContent>
        <SelectItem value="corridos">Corridos</SelectItem>
        <SelectItem value="uteis">Úteis</SelectItem>
      </SelectContent>
    </Select>
  );
}

export default function Adquirente() {
  const [adquirente, setAdquirente] = useState<string>('rede');
  const { adquirentesDisponiveisQ, taxasQ, configQ, salvar, criarAdquirente } = useAdquirente(adquirente);
  const { meiosQ, salvar: salvarMeios } = useMeiosPagamento();
  const { data: roles } = useUserRoles();
  const canEdit = !!roles?.isCoordAdmin;
  const { toast } = useToast();

  const taxasMap = useMemo<TaxasMap>(() => {
    const map: TaxasMap = {};
    (taxasQ.data ?? []).forEach((t) => { map[keyOf(t.bandeira, t.modalidade)] = t; });
    return map;
  }, [taxasQ.data]);

  const [draftTaxas, setDraftTaxas] = useState<Record<string, TaxaDraft>>({});
  const [draftAluguel, setDraftAluguel] = useState<string>('');
  const [draftBandeira, setDraftBandeira] = useState<Bandeira>('visa');
  const [draftMeios, setDraftMeios] = useState<Record<string, MeioDraft>>({});
  const [novoOpen, setNovoOpen] = useState(false);
  const [novoNome, setNovoNome] = useState('');

  const buildTaxasDraft = () => {
    const d: Record<string, TaxaDraft> = {};
    (taxasQ.data ?? []).forEach((t) => {
      d[t.id] = {
        taxa: fmt(t.taxa_percentual),
        prazo: String(t.prazo_recebimento_dias ?? 0),
        unidade: (t.prazo_unidade ?? 'corridos') as PrazoUnidade,
        intervalo: t.intervalo_parcelas_dias == null ? '' : String(t.intervalo_parcelas_dias),
      };
    });
    return d;
  };
  const buildMeiosDraft = () => {
    const d: Record<string, MeioDraft> = {};
    (meiosQ.data ?? []).forEach((m) => {
      d[m.meio] = { taxa: fmt(m.taxa_percentual), prazo: String(m.prazo_recebimento_dias ?? 0), unidade: m.prazo_unidade ?? 'corridos', ativo: !!m.ativo };
    });
    return d;
  };

  useEffect(() => { if (taxasQ.data) setDraftTaxas(buildTaxasDraft()); }, [taxasQ.data]);
  useEffect(() => { if (meiosQ.data) setDraftMeios(buildMeiosDraft()); }, [meiosQ.data]);
  useEffect(() => {
    if (configQ.data) {
      setDraftAluguel(fmt(configQ.data.aluguel_mensal));
      setDraftBandeira(configQ.data.bandeira_padrao ?? 'visa');
    } else if (configQ.isFetched) {
      setDraftAluguel('0');
      setDraftBandeira('visa');
    }
  }, [configQ.data, configQ.isFetched]);

  const isParcelada = (m: Modalidade) => MODALIDADES_PARCELADAS.includes(m);

  const isDirty = useMemo(() => {
    if (!taxasQ.data) return false;
    const taxaChanged = taxasQ.data.some((t) => {
      const d = draftTaxas[t.id];
      if (!d) return false;
      return (
        parseNumber(d.taxa) !== Number(t.taxa_percentual) ||
        (parseIntOrNull(d.prazo) ?? 0) !== Number(t.prazo_recebimento_dias ?? 0) ||
        d.unidade !== (t.prazo_unidade ?? 'corridos') ||
        (isParcelada(t.modalidade) && parseIntOrNull(d.intervalo) !== (t.intervalo_parcelas_dias ?? null))
      );
    });
    const aluguelAtual = configQ.data ? Number(configQ.data.aluguel_mensal) : 0;
    const bandeiraAtual = configQ.data?.bandeira_padrao ?? 'visa';
    return taxaChanged || parseNumber(draftAluguel) !== aluguelAtual || draftBandeira !== bandeiraAtual;
  }, [draftTaxas, draftAluguel, draftBandeira, taxasQ.data, configQ.data]);

  const meiosDirty = useMemo(() => {
    if (!meiosQ.data) return false;
    return meiosQ.data.some((m) => {
      const d = draftMeios[m.meio];
      if (!d) return false;
      return (
        parseNumber(d.taxa) !== Number(m.taxa_percentual) ||
        (parseIntOrNull(d.prazo) ?? 0) !== Number(m.prazo_recebimento_dias ?? 0) ||
        d.unidade !== m.prazo_unidade ||
        d.ativo !== !!m.ativo
      );
    });
  }, [draftMeios, meiosQ.data]);

  const handleSalvar = async () => {
    const taxasPayload = (taxasQ.data ?? []).map((t) => {
      const d = draftTaxas[t.id];
      return {
        id: t.id,
        taxa_percentual: parseNumber(d?.taxa ?? '0'),
        prazo_recebimento_dias: parseIntOrNull(d?.prazo ?? '0') ?? 0,
        prazo_unidade: d?.unidade ?? 'corridos',
        intervalo_parcelas_dias: isParcelada(t.modalidade) ? parseIntOrNull(d?.intervalo ?? '') : null,
      };
    });
    for (const t of taxasPayload) {
      if (t.taxa_percentual < 0 || t.taxa_percentual > 100) {
        toast({ title: 'Taxa inválida', description: 'As taxas devem estar entre 0 e 100%.', variant: 'destructive' });
        return;
      }
      if (t.prazo_recebimento_dias < 0 || (t.intervalo_parcelas_dias ?? 0) < 0) {
        toast({ title: 'Prazo inválido', description: 'Prazos e intervalos não podem ser negativos.', variant: 'destructive' });
        return;
      }
    }
    const aluguel = parseNumber(draftAluguel);
    if (aluguel < 0) {
      toast({ title: 'Aluguel inválido', description: 'O valor deve ser maior ou igual a zero.', variant: 'destructive' });
      return;
    }
    try {
      await salvar.mutateAsync({ taxas: taxasPayload, aluguel_mensal: aluguel, bandeira_padrao: draftBandeira });
      toast({ title: 'Configurações salvas', description: 'Taxas, prazos, aluguel e bandeira padrão atualizados.' });
    } catch (e: any) {
      toast({ title: 'Erro ao salvar', description: e?.message ?? 'Tente novamente.', variant: 'destructive' });
    }
  };

  const handleDescartar = () => {
    setDraftTaxas(buildTaxasDraft());
    if (configQ.data) {
      setDraftAluguel(fmt(configQ.data.aluguel_mensal));
      setDraftBandeira(configQ.data.bandeira_padrao ?? 'visa');
    }
  };

  const handleSalvarMeios = async () => {
    const itens = (meiosQ.data ?? []).map((m) => {
      const d = draftMeios[m.meio];
      return {
        meio: m.meio,
        taxa_percentual: parseNumber(d?.taxa ?? '0'),
        prazo_recebimento_dias: parseIntOrNull(d?.prazo ?? '0') ?? 0,
        prazo_unidade: d?.unidade ?? 'corridos',
        ativo: d?.ativo ?? m.ativo,
      };
    });
    if (itens.some((i) => i.taxa_percentual < 0 || i.taxa_percentual > 100 || i.prazo_recebimento_dias < 0)) {
      toast({ title: 'Valores inválidos', description: 'Taxas entre 0 e 100% e prazos não negativos.', variant: 'destructive' });
      return;
    }
    try {
      await salvarMeios.mutateAsync(itens);
      toast({ title: 'Meios de recebimento salvos' });
    } catch (e: any) {
      toast({ title: 'Erro ao salvar', description: e?.message ?? 'Tente novamente.', variant: 'destructive' });
    }
  };

  const handleCriar = async () => {
    const nome = novoNome.trim().toLowerCase();
    if (!/^[a-z0-9_-]+$/.test(nome)) {
      toast({ title: 'Nome inválido', description: 'Use letras minúsculas, números, "-" ou "_", sem espaços.', variant: 'destructive' });
      return;
    }
    if ((adquirentesDisponiveisQ.data ?? []).includes(nome)) {
      toast({ title: 'Adquirente já existe', variant: 'destructive' });
      return;
    }
    try {
      await criarAdquirente.mutateAsync(nome);
      setAdquirente(nome);
      setNovoOpen(false);
      setNovoNome('');
      toast({ title: 'Adquirente criado', description: `${capitalize(nome)} criado com taxas zeradas.` });
    } catch (e: any) {
      toast({ title: 'Erro ao criar', description: e?.message ?? 'Tente novamente.', variant: 'destructive' });
    }
  };

  const updTaxa = (id: string, patch: Partial<TaxaDraft>) =>
    setDraftTaxas((d) => ({ ...d, [id]: { ...d[id], ...patch } }));
  const updMeio = (meio: string, patch: Partial<MeioDraft>) =>
    setDraftMeios((d) => ({ ...d, [meio]: { ...d[meio], ...patch } }));

  const opcoes = adquirentesDisponiveisQ.data?.length ? adquirentesDisponiveisQ.data : [adquirente];
  const loading = taxasQ.isLoading || configQ.isLoading;

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Percent className="h-6 w-6 text-primary" /> Adquirente
          </h1>
          <p className="text-sm text-muted-foreground">
            Configure as taxas MDR, prazos e o custo fixo da maquininha. Esses valores serão usados nos cálculos de recebíveis.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Label className="text-xs text-muted-foreground">Adquirente</Label>
          <Select value={adquirente} onValueChange={setAdquirente}>
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              {opcoes.map((a) => (
                <SelectItem key={a} value={a}>{capitalize(a)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {canEdit && (
            <Button variant="outline" size="sm" onClick={() => setNovoOpen(true)}>
              <Plus className="h-4 w-4 mr-1" /> Novo adquirente
            </Button>
          )}
        </div>
      </div>

      {!canEdit && (
        <Badge variant="secondary">Modo somente leitura — apenas Admin/Coordenador podem editar.</Badge>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Taxas MDR (%) e prazos</CardTitle>
          <CardDescription>
            Percentual descontado pelo adquirente e prazo de recebimento, por bandeira e modalidade.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-2 font-medium w-40">Bandeira</th>
                    {MODALIDADES.map((m) => (
                      <th key={m.value} className="text-left p-2 font-medium">
                        <div>{m.label}</div>
                        {m.hint && <div className="text-[10px] uppercase text-muted-foreground">{m.hint}</div>}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {BANDEIRAS.map((b) => (
                    <tr key={b.value} className="border-b last:border-0 align-top">
                      <td className="p-2 font-medium">{b.label}</td>
                      {MODALIDADES.map((m) => {
                        const t = taxasMap[keyOf(b.value, m.value)];
                        if (!t) return <td key={m.value} className="p-2 text-muted-foreground">—</td>;
                        const d = draftTaxas[t.id] ?? { taxa: '', prazo: '0', unidade: 'corridos' as PrazoUnidade, intervalo: '' };
                        const isZero = parseNumber(d.taxa) === 0;
                        return (
                          <td key={m.value} className="p-2">
                            <div className="max-w-[160px] space-y-1.5">
                              <div className="relative">
                                <Input
                                  value={d.taxa}
                                  onChange={(e) => updTaxa(t.id, { taxa: e.target.value })}
                                  placeholder="0,00"
                                  inputMode="decimal"
                                  disabled={!canEdit}
                                  className={isZero ? 'border-yellow-500/40 pr-8' : 'pr-8'}
                                />
                                <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">%</span>
                              </div>
                              <div className="grid grid-cols-2 gap-1">
                                <div>
                                  <Label className="text-[10px] text-muted-foreground">Prazo (dias)</Label>
                                  <Input
                                    type="number"
                                    min={0}
                                    value={d.prazo}
                                    onChange={(e) => updTaxa(t.id, { prazo: e.target.value })}
                                    disabled={!canEdit}
                                    className="h-8 text-xs"
                                  />
                                </div>
                                <div>
                                  <Label className="text-[10px] text-muted-foreground">Unidade</Label>
                                  <UnidadeSelect value={d.unidade} onChange={(v) => updTaxa(t.id, { unidade: v })} disabled={!canEdit} />
                                </div>
                              </div>
                              {isParcelada(m.value) && (
                                <div>
                                  <Label className="text-[10px] text-muted-foreground">Intervalo entre parcelas (dias)</Label>
                                  <Input
                                    type="number"
                                    min={0}
                                    value={d.intervalo}
                                    onChange={(e) => updTaxa(t.id, { intervalo: e.target.value })}
                                    placeholder="—"
                                    disabled={!canEdit}
                                    className="h-8 text-xs"
                                  />
                                </div>
                              )}
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="text-xs text-muted-foreground mt-3">
                Campos destacados em amarelo ainda não foram configurados (valor = 0).
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Aluguel da máquina</CardTitle>
          <CardDescription>Custo fixo mensal cobrado pelo adquirente pela maquininha (POS).</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="max-w-xs">
            <Label className="text-xs text-muted-foreground">Valor mensal (R$)</Label>
            <div className="relative">
              <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">R$</span>
              <Input
                value={draftAluguel}
                onChange={(e) => setDraftAluguel(e.target.value)}
                placeholder="0,00"
                inputMode="decimal"
                disabled={!canEdit}
                className="pl-9"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Bandeira padrão</CardTitle>
          <CardDescription>Usada para calcular a taxa quando a venda não registrar a bandeira do cartão.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="max-w-xs">
            <Select value={draftBandeira} onValueChange={(v) => setDraftBandeira(v as Bandeira)} disabled={!canEdit}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {BANDEIRAS.map((b) => (
                  <SelectItem key={b.value} value={b.value}>{b.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {canEdit && (
        <div className="sticky bottom-4 z-10 flex justify-end gap-2">
          <Button variant="outline" onClick={handleDescartar} disabled={!isDirty || salvar.isPending}>
            <Undo2 className="h-4 w-4 mr-2" /> Descartar
          </Button>
          <Button onClick={handleSalvar} disabled={!isDirty || salvar.isPending}>
            {salvar.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
            Salvar alterações
          </Button>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Outros meios de recebimento</CardTitle>
          <CardDescription>Taxas e prazos de Pix, Boleto e Dinheiro.</CardDescription>
        </CardHeader>
        <CardContent>
          {meiosQ.isLoading ? (
            <div className="flex justify-center py-6"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : (meiosQ.data ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum meio de recebimento configurado.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-2 font-medium">Meio</th>
                    <th className="text-left p-2 font-medium">Taxa (%)</th>
                    <th className="text-left p-2 font-medium">Prazo (dias)</th>
                    <th className="text-left p-2 font-medium">Unidade</th>
                    <th className="text-left p-2 font-medium">Ativo</th>
                  </tr>
                </thead>
                <tbody>
                  {(meiosQ.data ?? []).map((m) => {
                    const d = draftMeios[m.meio] ?? { taxa: '', prazo: '0', unidade: 'corridos' as PrazoUnidade, ativo: m.ativo };
                    return (
                      <tr key={m.meio} className="border-b last:border-0">
                        <td className="p-2 font-medium">{MEIO_LABEL[m.meio] ?? capitalize(m.meio)}</td>
                        <td className="p-2">
                          <div className="relative max-w-[120px]">
                            <Input value={d.taxa} onChange={(e) => updMeio(m.meio, { taxa: e.target.value })} placeholder="0,00" inputMode="decimal" disabled={!canEdit} className="pr-8" />
                            <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">%</span>
                          </div>
                        </td>
                        <td className="p-2">
                          <Input type="number" min={0} value={d.prazo} onChange={(e) => updMeio(m.meio, { prazo: e.target.value })} disabled={!canEdit} className="max-w-[100px]" />
                        </td>
                        <td className="p-2">
                          <div className="max-w-[120px]">
                            <UnidadeSelect value={d.unidade} onChange={(v) => updMeio(m.meio, { unidade: v })} disabled={!canEdit} />
                          </div>
                        </td>
                        <td className="p-2">
                          <Switch checked={d.ativo} onCheckedChange={(v) => updMeio(m.meio, { ativo: v })} disabled={!canEdit} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {canEdit && (
                <div className="flex justify-end gap-2 mt-4">
                  <Button variant="outline" onClick={() => setDraftMeios(buildMeiosDraft())} disabled={!meiosDirty || salvarMeios.isPending}>
                    <Undo2 className="h-4 w-4 mr-2" /> Descartar
                  </Button>
                  <Button onClick={handleSalvarMeios} disabled={!meiosDirty || salvarMeios.isPending}>
                    {salvarMeios.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                    Salvar
                  </Button>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={novoOpen} onOpenChange={setNovoOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Novo adquirente</DialogTitle>
            <DialogDescription>Nome em minúsculas, sem espaços (ex.: cielo, stone).</DialogDescription>
          </DialogHeader>
          <Input
            value={novoNome}
            onChange={(e) => setNovoNome(e.target.value.toLowerCase().replace(/\s+/g, ''))}
            placeholder="ex.: cielo"
            autoFocus
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setNovoOpen(false)}>Cancelar</Button>
            <Button onClick={handleCriar} disabled={!novoNome.trim() || criarAdquirente.isPending}>
              {criarAdquirente.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Criar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
