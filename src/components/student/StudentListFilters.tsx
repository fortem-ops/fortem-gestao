import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search, Filter, SlidersHorizontal, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Separator } from "@/components/ui/separator";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";

export type PresencaFiltro = "todos" | "com" | "sem";

export interface DadosCadastraisFiltro {
  email: PresencaFiltro;
  cpf: PresencaFiltro;
  telefone: PresencaFiltro;
  rg: PresencaFiltro;
  dataNascimento: PresencaFiltro;
  endereco: PresencaFiltro;
  foto: PresencaFiltro;
}

export type UltimaAvalFuncFiltro = "todos" | "em_dia" | "pendente" | "atrasada";
export type ServicoPlanoDispFiltro = "todos" | "avaliacao_funcional" | "nutricao" | "reabilitacao";

export interface StudentFilters {
  search: string;
  status: string;
  frequencia: string;
  servicosPlano: string;
  servicosContratados: string;
  professor: string;
  tipoPlano: string;
  vip: string;
  ultimaAvaliacaoFuncional: UltimaAvalFuncFiltro;
  servicoPlanoDisponivel: ServicoPlanoDispFiltro;
  dataInicioDe: Date | undefined;
  dataInicioAte: Date | undefined;
  dataFinalDe: Date | undefined;
  dataFinalAte: Date | undefined;
  dadosCadastrais: DadosCadastraisFiltro;
}

const defaultDados: DadosCadastraisFiltro = {
  email: "todos",
  cpf: "todos",
  telefone: "todos",
  rg: "todos",
  dataNascimento: "todos",
  endereco: "todos",
  foto: "todos",
};

const defaultFilters: StudentFilters = {
  search: "",
  status: "todos",
  frequencia: "todos",
  servicosPlano: "todos",
  servicosContratados: "todos",
  professor: "todos",
  tipoPlano: "todos",
  vip: "todos",
  ultimaAvaliacaoFuncional: "todos",
  servicoPlanoDisponivel: "todos",
  dataInicioDe: undefined,
  dataInicioAte: undefined,
  dataFinalDe: undefined,
  dataFinalAte: undefined,
  dadosCadastrais: { ...defaultDados },
};


interface Props {
  filters: StudentFilters;
  onChange: (filters: StudentFilters) => void;
  professors: { id: string; name: string }[];
}

const DADOS_LABELS: { key: keyof DadosCadastraisFiltro; label: string }[] = [
  { key: "email", label: "E-mail" },
  { key: "cpf", label: "CPF" },
  { key: "telefone", label: "Telefone" },
  { key: "rg", label: "RG" },
  { key: "dataNascimento", label: "Data de nascimento" },
  { key: "endereco", label: "Endereço" },
  { key: "foto", label: "Foto" },
];

export function StudentListFilters({ filters, onChange, professors }: Props) {
  const [showAdvanced, setShowAdvanced] = useState(false);

  const { data: tiposPlano = [] } = useQuery({
    queryKey: ["planos-tipos-distinct"],
    queryFn: async () => {
      const { data } = await supabase.from("planos").select("tipo").not("tipo", "is", null);
      const set = new Set<string>();
      (data || []).forEach((d: any) => d.tipo && set.add(d.tipo));
      return Array.from(set).sort();
    },
    staleTime: 5 * 60_000,
  });

  const update = (partial: Partial<StudentFilters>) => onChange({ ...filters, ...partial });
  const updateDados = (partial: Partial<DadosCadastraisFiltro>) =>
    onChange({ ...filters, dadosCadastrais: { ...filters.dadosCadastrais, ...partial } });

  const dadosActiveCount = DADOS_LABELS.filter(({ key }) => filters.dadosCadastrais[key] !== "todos").length;

  const activeCount = [
    filters.status !== "todos",
    filters.frequencia !== "todos",
    filters.servicosPlano !== "todos",
    filters.servicosContratados !== "todos",
    filters.professor !== "todos",
    filters.tipoPlano !== "todos",
    filters.vip !== "todos",
    !!filters.dataInicioDe,
    !!filters.dataInicioAte,
    !!filters.dataFinalDe,
    !!filters.dataFinalAte,
  ].filter(Boolean).length + dadosActiveCount;


  const clearAll = () => onChange({ ...defaultFilters, search: filters.search });

  return (
    <div className="space-y-3">
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome ou email..."
            value={filters.search}
            onChange={(e) => update({ search: e.target.value })}
            className="pl-10"
          />
        </div>
        <Select value={filters.status} onValueChange={(v) => update({ status: v })}>
          <SelectTrigger className="w-[160px]">
            <Filter className="w-4 h-4 mr-2" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos</SelectItem>
            <SelectItem value="ativo">Ativos</SelectItem>
            <SelectItem value="licenca">Licença</SelectItem>
            <SelectItem value="encerrado">Encerrados</SelectItem>
          </SelectContent>
        </Select>
        <Button
          variant={showAdvanced ? "secondary" : "outline"}
          size="default"
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="gap-2"
        >
          <SlidersHorizontal className="w-4 h-4" />
          Filtros
          {activeCount > 0 && (
            <Badge variant="default" className="ml-1 h-5 w-5 p-0 flex items-center justify-center text-[10px]">
              {activeCount}
            </Badge>
          )}
        </Button>
      </div>

      {showAdvanced && (
        <div className="glass-card rounded-lg p-4 space-y-4 animate-fade-in">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-foreground">Filtros Avançados</h3>
            {activeCount > 0 && (
              <Button variant="ghost" size="sm" onClick={clearAll} className="text-xs gap-1">
                <X className="w-3 h-3" /> Limpar filtros
              </Button>
            )}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground">Frequência</label>
              <Select value={filters.frequencia} onValueChange={(v) => update({ frequencia: v })}>
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todas</SelectItem>
                  <SelectItem value="livre">Livre</SelectItem>
                  <SelectItem value="1">1x/semana</SelectItem>
                  <SelectItem value="2">2x/semana</SelectItem>
                  <SelectItem value="3">3x/semana</SelectItem>
                  <SelectItem value="4">4x/semana</SelectItem>
                  <SelectItem value="5">5x/semana</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground">Serviços do Plano</label>
              <Select value={filters.servicosPlano} onValueChange={(v) => update({ servicosPlano: v })}>
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  <SelectItem value="com">Com serviços</SelectItem>
                  <SelectItem value="sem">Sem serviços</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground">Serviços Contratados</label>
              <Select value={filters.servicosContratados} onValueChange={(v) => update({ servicosContratados: v })}>
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  <SelectItem value="com">Com contratados</SelectItem>
                  <SelectItem value="sem">Sem contratados</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground">Professor Responsável</label>
              <Select value={filters.professor} onValueChange={(v) => update({ professor: v })}>
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  {professors.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground">Tipo de Plano</label>
              <Select value={filters.tipoPlano} onValueChange={(v) => update({ tipoPlano: v })}>
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  {tiposPlano.map((t) => (
                    <SelectItem key={t} value={t}>{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground">Plano VIP</label>
              <Select value={filters.vip} onValueChange={(v) => update({ vip: v })}>
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  <SelectItem value="sim">VIP</SelectItem>
                  <SelectItem value="nao">Não VIP</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground">Início Plano (de)</label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("w-full h-9 justify-start text-left font-normal text-sm", !filters.dataInicioDe && "text-muted-foreground")}>
                    {filters.dataInicioDe ? format(filters.dataInicioDe, "dd/MM/yyyy") : "Selecionar..."}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={filters.dataInicioDe} onSelect={(d) => update({ dataInicioDe: d })} locale={ptBR} className="p-3 pointer-events-auto" />
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground">Início Plano (até)</label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("w-full h-9 justify-start text-left font-normal text-sm", !filters.dataInicioAte && "text-muted-foreground")}>
                    {filters.dataInicioAte ? format(filters.dataInicioAte, "dd/MM/yyyy") : "Selecionar..."}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={filters.dataInicioAte} onSelect={(d) => update({ dataInicioAte: d })} locale={ptBR} className="p-3 pointer-events-auto" />
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground">Data Final Plano (de)</label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("w-full h-9 justify-start text-left font-normal text-sm", !filters.dataFinalDe && "text-muted-foreground")}>
                    {filters.dataFinalDe ? format(filters.dataFinalDe, "dd/MM/yyyy") : "Selecionar..."}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={filters.dataFinalDe} onSelect={(d) => update({ dataFinalDe: d })} locale={ptBR} className="p-3 pointer-events-auto" />
                </PopoverContent>
              </Popover>
            </div>


            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground">Data Final Plano (até)</label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("w-full h-9 justify-start text-left font-normal text-sm", !filters.dataFinalAte && "text-muted-foreground")}>
                    {filters.dataFinalAte ? format(filters.dataFinalAte, "dd/MM/yyyy") : "Selecionar..."}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={filters.dataFinalAte} onSelect={(d) => update({ dataFinalAte: d })} locale={ptBR} className="p-3 pointer-events-auto" />
                </PopoverContent>
              </Popover>
            </div>
          </div>

          <Separator />

          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <h4 className="text-sm font-semibold text-foreground">Dados Cadastrais</h4>
              {dadosActiveCount > 0 && (
                <Badge variant="outline" className="text-[10px]">{dadosActiveCount} ativo{dadosActiveCount !== 1 ? "s" : ""}</Badge>
              )}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
              {DADOS_LABELS.map(({ key, label }) => (
                <div key={key} className="space-y-1.5">
                  <label className="text-xs text-muted-foreground">{label}</label>
                  <Select
                    value={filters.dadosCadastrais[key]}
                    onValueChange={(v) => updateDados({ [key]: v as PresencaFiltro } as Partial<DadosCadastraisFiltro>)}
                  >
                    <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todos">Todos</SelectItem>
                      <SelectItem value="com">Com {label.toLowerCase()}</SelectItem>
                      <SelectItem value="sem">Sem {label.toLowerCase()}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export { defaultFilters };
