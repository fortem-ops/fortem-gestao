import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, Flame, AlarmClock, CalendarRange, User, Users } from "lucide-react";
import { cn } from "@/lib/utils";

export type QuickFilter = "todos" | "meus" | "quentes" | "parados" | "semana";

export interface PipelineFiltersValue {
  search: string;
  professorId: string | null;
  origem: string | null;
  quick: QuickFilter;
}

interface Props {
  value: PipelineFiltersValue;
  onChange: (v: PipelineFiltersValue) => void;
}

const QUICK_OPTIONS: { id: QuickFilter; label: string; icon: any }[] = [
  { id: "todos", label: "Todos", icon: Users },
  { id: "meus", label: "Meus leads", icon: User },
  { id: "quentes", label: "Quentes", icon: Flame },
  { id: "parados", label: "Parados", icon: AlarmClock },
  { id: "semana", label: "Esta semana", icon: CalendarRange },
];

export function PipelineFilters({ value, onChange }: Props) {
  const { user } = useAuth();

  const { data: professors = [] } = useQuery({
    queryKey: ["pipeline-filter-professors"],
    queryFn: async () => {
      const { data: roles } = await supabase
        .from("user_roles")
        .select("user_id")
        .in("role", ["professor", "coordenador", "admin"]);
      const userIds = (roles || []).map((r) => r.user_id);
      if (!userIds.length) return [];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, full_name")
        .in("user_id", userIds);
      return (profiles || []).sort((a, b) => a.full_name.localeCompare(b.full_name));
    },
    staleTime: 5 * 60_000,
  });

  const { data: origens = [] } = useQuery({
    queryKey: ["pipeline-filter-origens"],
    queryFn: async () => {
      const { data } = await supabase.from("pipeline_metadata").select("origem_lead").not("origem_lead", "is", null);
      const set = new Set<string>();
      (data || []).forEach((d: any) => d.origem_lead && set.add(d.origem_lead));
      return Array.from(set).sort();
    },
    staleTime: 5 * 60_000,
  });

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-1.5">
        {QUICK_OPTIONS.map((opt) => {
          const Icon = opt.icon;
          const active = value.quick === opt.id;
          const disabled = opt.id === "meus" && !user;
          return (
            <button
              key={opt.id}
              type="button"
              disabled={disabled}
              onClick={() => onChange({ ...value, quick: opt.id })}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                active
                  ? "border-primary bg-primary/15 text-primary"
                  : "border-border bg-card text-muted-foreground hover:text-foreground hover:border-primary/40",
                disabled && "opacity-50 cursor-not-allowed",
              )}
            >
              <Icon className="w-3.5 h-3.5" />
              {opt.label}
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            value={value.search}
            onChange={(e) => onChange({ ...value, search: e.target.value })}
            placeholder="Buscar lead por nome..."
            className="pl-8"
          />
        </div>

        <Select
          value={value.professorId ?? "all"}
          onValueChange={(v) => onChange({ ...value, professorId: v === "all" ? null : v })}
        >
          <SelectTrigger className="w-[200px]"><SelectValue placeholder="Professor" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos professores</SelectItem>
            {professors.map((p) => (
              <SelectItem key={p.user_id} value={p.user_id}>{p.full_name}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={value.origem ?? "all"}
          onValueChange={(v) => onChange({ ...value, origem: v === "all" ? null : v })}
        >
          <SelectTrigger className="w-[180px]"><SelectValue placeholder="Origem" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas origens</SelectItem>
            {origens.map((o) => (
              <SelectItem key={o} value={o}>{o}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
