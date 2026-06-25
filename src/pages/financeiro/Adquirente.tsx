import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useAdquirente } from '@/hooks/useAdquirente';
import { useUserRoles } from '@/hooks/useUserRoles';
import { BANDEIRAS, MODALIDADES, type Bandeira, type Modalidade, type AdquirenteTaxa } from '@/types/adquirente';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Save, Undo2, Percent } from 'lucide-react';

type TaxasMap = Record<string, AdquirenteTaxa>; // key: `${bandeira}_${modalidade}`

const keyOf = (b: Bandeira, m: Modalidade) => `${b}_${m}`;

export default function Adquirente() {
  const [adquirente, setAdquirente] = useState<string>('rede');
  const { taxasQ, configQ, salvar } = useAdquirente(adquirente);
  const { data: roles } = useUserRoles();
  const canEdit = !!roles?.isCoordAdmin;
  const { toast } = useToast();

  const taxasMap = useMemo<TaxasMap>(() => {
    const map: TaxasMap = {};
    (taxasQ.data ?? []).forEach((t) => {
      map[keyOf(t.bandeira, t.modalidade)] = t;
    });
    return map;
  }, [taxasQ.data]);

  const [draftTaxas, setDraftTaxas] = useState<Record<string, string>>({});
  const [draftAluguel, setDraftAluguel] = useState<string>('');

  // Sincroniza drafts quando dados chegam
  useEffect(() => {
    if (taxasQ.data) {
      const d: Record<string, string> = {};
      taxasQ.data.forEach((t) => {
        d[t.id] = String(Number(t.taxa_percentual)).replace('.', ',');
      });
      setDraftTaxas(d);
    }
  }, [taxasQ.data]);

  useEffect(() => {
    if (configQ.data) {
      setDraftAluguel(String(Number(configQ.data.aluguel_mensal)).replace('.', ','));
    } else if (configQ.isFetched) {
      setDraftAluguel('0');
    }
  }, [configQ.data, configQ.isFetched]);

  const parseNumber = (v: string): number => {
    const n = parseFloat(v.replace(/\./g, '').replace(',', '.'));
    return isNaN(n) ? 0 : n;
  };

  const isDirty = useMemo(() => {
    if (!taxasQ.data) return false;
    const taxaChanged = taxasQ.data.some(
      (t) => parseNumber(draftTaxas[t.id] ?? '') !== Number(t.taxa_percentual),
    );
    const aluguelAtual = configQ.data ? Number(configQ.data.aluguel_mensal) : 0;
    const aluguelChanged = parseNumber(draftAluguel) !== aluguelAtual;
    return taxaChanged || aluguelChanged;
  }, [draftTaxas, draftAluguel, taxasQ.data, configQ.data]);

  const handleSalvar = async () => {
    const taxasPayload = (taxasQ.data ?? []).map((t) => ({
      id: t.id,
      taxa_percentual: parseNumber(draftTaxas[t.id] ?? '0'),
    }));
    for (const t of taxasPayload) {
      if (t.taxa_percentual < 0 || t.taxa_percentual > 100) {
        toast({ title: 'Taxa inválida', description: 'As taxas devem estar entre 0 e 100%.', variant: 'destructive' });
        return;
      }
    }
    const aluguel = parseNumber(draftAluguel);
    if (aluguel < 0) {
      toast({ title: 'Aluguel inválido', description: 'O valor deve ser maior ou igual a zero.', variant: 'destructive' });
      return;
    }
    try {
      await salvar.mutateAsync({ taxas: taxasPayload, aluguel_mensal: aluguel });
      toast({ title: 'Configurações salvas', description: 'Taxas MDR e aluguel atualizados.' });
    } catch (e: any) {
      toast({ title: 'Erro ao salvar', description: e?.message ?? 'Tente novamente.', variant: 'destructive' });
    }
  };

  const handleDescartar = () => {
    if (taxasQ.data) {
      const d: Record<string, string> = {};
      taxasQ.data.forEach((t) => { d[t.id] = String(Number(t.taxa_percentual)).replace('.', ','); });
      setDraftTaxas(d);
    }
    if (configQ.data) {
      setDraftAluguel(String(Number(configQ.data.aluguel_mensal)).replace('.', ','));
    }
  };

  const loading = taxasQ.isLoading || configQ.isLoading;

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Percent className="h-6 w-6 text-primary" /> Adquirente
          </h1>
          <p className="text-sm text-muted-foreground">
            Configure as taxas MDR e o custo fixo da maquininha. Esses valores serão usados nos cálculos de recebíveis.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Label className="text-xs text-muted-foreground">Adquirente</Label>
          <Select value={adquirente} onValueChange={setAdquirente}>
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="rede">Rede</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {!canEdit && (
        <Badge variant="secondary">Modo somente leitura — apenas Admin/Coordenador podem editar.</Badge>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Taxas MDR (%)</CardTitle>
          <CardDescription>
            Percentual descontado pelo adquirente em cada transação, por bandeira e modalidade.
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
                    <tr key={b.value} className="border-b last:border-0">
                      <td className="p-2 font-medium">{b.label}</td>
                      {MODALIDADES.map((m) => {
                        const t = taxasMap[keyOf(b.value, m.value)];
                        if (!t) return <td key={m.value} className="p-2 text-muted-foreground">—</td>;
                        const val = draftTaxas[t.id] ?? '';
                        const isZero = parseNumber(val) === 0;
                        return (
                          <td key={m.value} className="p-2">
                            <div className="relative max-w-[140px]">
                              <Input
                                value={val}
                                onChange={(e) => setDraftTaxas((d) => ({ ...d, [t.id]: e.target.value }))}
                                placeholder="0,00"
                                inputMode="decimal"
                                disabled={!canEdit}
                                className={isZero ? 'border-yellow-500/40 pr-8' : 'pr-8'}
                              />
                              <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">%</span>
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

      {canEdit && (
        <div className="sticky bottom-4 flex justify-end gap-2">
          <Button variant="outline" onClick={handleDescartar} disabled={!isDirty || salvar.isPending}>
            <Undo2 className="h-4 w-4 mr-2" /> Descartar
          </Button>
          <Button onClick={handleSalvar} disabled={!isDirty || salvar.isPending}>
            {salvar.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
            Salvar alterações
          </Button>
        </div>
      )}
    </div>
  );
}
