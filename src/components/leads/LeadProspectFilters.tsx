import { useState } from "react";
import { Search, Filter, SlidersHorizontal, X, Calendar as CalendarIcon } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";

export type Periodo = "sempre" | "mes_atual" | "mes_passado" | "meses_passados" | "custom";

export interface LeadProspectFiltersState {
  search: string;
  primary: string; // origem (leads) ou stage (prospects)
  periodo: Periodo;
  mesPassado: string; // "YYYY-MM"
  customDe?: Date;
  customAte?: Date;
  responsavel: string; // só leads
  agenda: string; // só prospects ("all"|"sim"|"nao")
}

export const defaultLeadProspectFilters: LeadProspectFiltersState = {
  search: "",
  primary: "all",
  periodo: "sempre",
  mesPassado: "",
  customDe: undefined,
  customAte: undefined,
  responsavel: "all",
  agenda: "all",
};

interface PrimaryOption { value: string; label: string }

interface Props {
  mode: "leads" | "prospects";
  filters: LeadProspectFiltersState;
  onChange: (f: LeadProspectFiltersState) => void;
  primaryOptions: PrimaryOption[];
  primaryLabel: string;
  responsaveis?: { id: string; nome: string }[];
  mesesDisponiveis: { value: string; label: string }[];
  searchPlaceholder?: string;
}

export function LeadProspectFilters({
  mode, filters, onChange, primaryOptions, primaryLabel, responsaveis = [], mesesDisponiveis, searchPlaceholder,
}: Props) {
  const [showAdvanced, setShowAdvanced] = useState(false);
  const update = (p: Partial<LeadProspectFiltersState>) => onChange({ ...filters, ...p });

  const activeCount = [
    filters.periodo !== "sempre",
    mode === "leads" && filters.responsavel !== "all",
    mode === "prospects" && filters.agenda !== "all",
  ].filter(Boolean).length;

  const clearAll = () => onChange({ ...defaultLeadProspectFilters, search: filters.search, primary: filters.primary });

  return (
    <div className="space-y-3">
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder={searchPlaceholder || "Buscar por nome..."}
            value={filters.search}
            onChange={(e) => update({ search: e.target.value })}
            className="pl-10"
          />
        </div>
        <Select value={filters.primary} onValueChange={(v) => update({ primary: v })}>
          <SelectTrigger className="w-[220px]">
            <Filter className="w-4 h-4 mr-2" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{primaryLabel}</SelectItem>
            {primaryOptions.map((o) => (
              <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
            ))}
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
              <label className="text-xs text-muted-foreground">Período</label>
              <Select value={filters.periodo} onValueChange={(v) => update({ periodo: v as Periodo })}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="sempre">Desde sempre</SelectItem>
                  <SelectItem value="mes_atual">Mês atual</SelectItem>
                  <SelectItem value="mes_passado">Mês passado</SelectItem>
                  <SelectItem value="meses_passados">Meses passados</SelectItem>
                  <SelectItem value="custom">Customizado</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {filters.periodo === "meses_passados" && (
              <div className="space-y-1.5">
                <label className="text-xs text-muted-foreground">Mês</label>
                <Select value={filters.mesPassado} onValueChange={(v) => update({ mesPassado: v })}>
                  <SelectTrigger className="h-9 capitalize"><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {mesesDisponiveis.length === 0 ? (
                      <div className="px-2 py-1.5 text-xs text-muted-foreground">Nenhum disponível</div>
                    ) : mesesDisponiveis.map((m) => (
                      <SelectItem key={m.value} value={m.value} className="capitalize">{m.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {filters.periodo === "custom" && (
              <>
                <div className="space-y-1.5">
                  <label className="text-xs text-muted-foreground">De</label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className={cn("w-full h-9 justify-start text-left font-normal text-sm", !filters.customDe && "text-muted-foreground")}>
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {filters.customDe ? format(filters.customDe, "dd/MM/yyyy") : "Selecionar..."}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar mode="single" selected={filters.customDe} onSelect={(d) => update({ customDe: d })} locale={ptBR} className="p-3 pointer-events-auto" />
                    </PopoverContent>
                  </Popover>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs text-muted-foreground">Até</label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className={cn("w-full h-9 justify-start text-left font-normal text-sm", !filters.customAte && "text-muted-foreground")}>
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {filters.customAte ? format(filters.customAte, "dd/MM/yyyy") : "Selecionar..."}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar mode="single" selected={filters.customAte} onSelect={(d) => update({ customAte: d })} locale={ptBR} className="p-3 pointer-events-auto" />
                    </PopoverContent>
                  </Popover>
                </div>
              </>
            )}

            {mode === "leads" && (
              <div className="space-y-1.5">
                <label className="text-xs text-muted-foreground">Responsável</label>
                <Select value={filters.responsavel} onValueChange={(v) => update({ responsavel: v })}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    {responsaveis.map((r) => (
                      <SelectItem key={r.id} value={r.id}>{r.nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {mode === "prospects" && (
              <div className="space-y-1.5">
                <label className="text-xs text-muted-foreground">Agendamento</label>
                <Select value={filters.agenda} onValueChange={(v) => update({ agenda: v })}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="sim">Com agendamento</SelectItem>
                    <SelectItem value="nao">Sem agendamento</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
