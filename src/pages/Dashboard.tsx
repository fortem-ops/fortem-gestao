import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { StatsCards } from "@/components/dashboard/StatsCards";
import { AlertsWidget } from "@/components/dashboard/AlertsWidget";
import { AdminAlertsWidget } from "@/components/dashboard/AdminAlertsWidget";
import { InadimplentesWidget } from "@/components/dashboard/InadimplentesWidget";
import { TasksWidget } from "@/components/dashboard/TasksWidget";
import { BirthdaysWidget } from "@/components/dashboard/BirthdaysWidget";
import { PlansDistributionWidget } from "@/components/dashboard/PlansDistributionWidget";
import { PipelineWidget } from "@/components/dashboard/PipelineWidget";
import { ClubeWidget } from "@/components/dashboard/ClubeWidget";
import { PontoWidget } from "@/components/dashboard/PontoWidget";
import { LembretePontoBanner } from "@/components/ponto/LembretePontoBanner";
import { LembreteAvaliacoesPendentesBanner } from "@/components/dashboard/LembreteAvaliacoesPendentesBanner";
import { SortableWidget } from "@/components/dashboard/SortableWidget";
import { useDashboardLayout, type DashboardLayout } from "@/hooks/useDashboardLayout";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { LayoutGrid, RotateCcw, Check } from "lucide-react";
import { toast } from "sonner";
import {
  DndContext,
  PointerSensor,
  KeyboardSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";

export default function Dashboard() {
  const { user } = useAuth();
  const [selectedProfessorId, setSelectedProfessorId] = useState<string>("todos");
  const [editing, setEditing] = useState(false);

  const { data: isCoordAdmin } = useQuery({
    queryKey: ["dashboard-isCoordAdmin", user?.id],
    queryFn: async () => {
      const { data } = await supabase.rpc("is_coordinator_or_admin", { _user_id: user!.id });
      return !!data;
    },
    enabled: !!user,
    staleTime: 5 * 60_000,
  });

  const { data: isAdmin } = useQuery({
    queryKey: ["dashboard-isAdmin", user?.id],
    queryFn: async () => {
      const { data } = await supabase.rpc("is_admin", { _user_id: user!.id });
      return !!data;
    },
    enabled: !!user,
    staleTime: 5 * 60_000,
  });

  const { data: professors = [] } = useQuery({
    queryKey: ["dashboard-professors"],
    queryFn: async () => {
      const { data: roles } = await supabase
        .from("user_roles")
        .select("user_id")
        .in("role", ["professor", "coordenador", "admin"]);
      if (!roles?.length) return [];
      const userIds = roles.map((r) => r.user_id);
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, full_name")
        .in("user_id", userIds);
      return (profiles || []).sort((a, b) => a.full_name.localeCompare(b.full_name));
    },
    enabled: !!isCoordAdmin,
    staleTime: 5 * 60_000,
  });

  const effectiveProfessorId = isCoordAdmin
    ? (selectedProfessorId === "todos" ? null : selectedProfessorId)
    : user?.id || null;

  // Default layout per role
  const defaults: DashboardLayout = useMemo(() => {
    if (isCoordAdmin) {
      return {
        main: ["alerts", "plansDistribution", "adminAlerts", "inadimplentes"],
        side: [...(isAdmin ? ["pipeline"] : []), "ponto", "clube", "tasks", "birthdays"],
      };
    }
    return {
      main: ["alerts", "adminAlerts", "plansDistribution"],
      side: ["tasks", "ponto", "birthdays", "clube"],
    };
  }, [isCoordAdmin, isAdmin]);

  const { layout, setLayout, save, reset } = useDashboardLayout(user?.id, defaults);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const widgetMap: Record<string, JSX.Element> = {
    alerts: <AlertsWidget professorId={effectiveProfessorId} />,
    plansDistribution: <PlansDistributionWidget />,
    adminAlerts: <AdminAlertsWidget />,
    inadimplentes: <InadimplentesWidget />,
    pipeline: <PipelineWidget />,
    ponto: <PontoWidget />,
    clube: <ClubeWidget />,
    tasks: <TasksWidget professorId={effectiveProfessorId} />,
    birthdays: <BirthdaysWidget professorId={effectiveProfessorId} />,
  };

  function handleDragEnd(column: "main" | "side") {
    return (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;
      const items = layout[column];
      const oldIndex = items.indexOf(String(active.id));
      const newIndex = items.indexOf(String(over.id));
      if (oldIndex < 0 || newIndex < 0) return;
      setLayout({ ...layout, [column]: arrayMove(items, oldIndex, newIndex) });
    };
  }

  const handleSave = () => {
    save(layout);
    setEditing(false);
    toast.success("Layout do dashboard salvo");
  };

  const handleReset = () => {
    reset();
    toast.success("Layout padrão restaurado");
  };

  const renderColumn = (column: "main" | "side") => (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd(column)}>
      <SortableContext items={layout[column]} strategy={verticalListSortingStrategy}>
        <div className="space-y-6 min-w-0">
          {layout[column].map((key) => {
            const node = widgetMap[key];
            if (!node) return null;
            return (
              <SortableWidget key={key} id={key} editing={editing}>
                {node}
              </SortableWidget>
            );
          })}
        </div>
      </SortableContext>
    </DndContext>
  );

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-heading font-bold text-foreground">Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {isCoordAdmin ? "Visão geral da equipe técnica" : "Sua visão técnica do dia"}
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {isCoordAdmin && (
            <Select value={selectedProfessorId} onValueChange={setSelectedProfessorId}>
              <SelectTrigger className="w-[220px]">
                <SelectValue placeholder="Todos os professores" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os professores</SelectItem>
                {professors.map((p) => (
                  <SelectItem key={p.user_id} value={p.user_id}>
                    {p.full_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {editing ? (
            <>
              <Button variant="outline" size="sm" onClick={handleReset}>
                <RotateCcw className="w-4 h-4 mr-1" /> Restaurar padrão
              </Button>
              <Button size="sm" onClick={handleSave}>
                <Check className="w-4 h-4 mr-1" /> Salvar
              </Button>
            </>
          ) : (
            <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
              <LayoutGrid className="w-4 h-4 mr-1" /> Personalizar
            </Button>
          )}
        </div>
      </div>

      {editing && (
        <div className="rounded-md border border-primary/30 bg-primary/5 px-3 py-2 text-xs text-muted-foreground">
          Arraste pelo ícone <strong className="text-primary">⋮⋮</strong> no canto de cada widget para reorganizar dentro da coluna. Clique em <strong>Salvar</strong> para manter sua preferência.
        </div>
      )}

      <LembretePontoBanner />
      <LembreteAvaliacoesPendentesBanner />

      <StatsCards professorId={effectiveProfessorId} />

      <div className="grid lg:grid-cols-3 gap-6 min-w-0">
        <div className="lg:col-span-2 min-w-0">{renderColumn("main")}</div>
        <div className="min-w-0">{renderColumn("side")}</div>
      </div>
    </div>
  );
}
