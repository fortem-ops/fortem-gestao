import { NavLink, Outlet } from "react-router-dom";
import { BarChart3, DollarSign, ClipboardList, XCircle, CalendarRange, KanbanSquare, Activity, Users2, Home } from "lucide-react";
import { cn } from "@/lib/utils";

const items = [
  { to: "/relatorios", end: true, label: "Visão geral", icon: Home },
  { to: "/relatorios/vendas", label: "Vendas", icon: BarChart3 },
  { to: "/relatorios/financeiro", label: "Financeiro", icon: DollarSign },
  { to: "/relatorios/planos", label: "Planos", icon: ClipboardList },
  { to: "/relatorios/cancelamentos", label: "Cancelamentos", icon: XCircle },
  { to: "/relatorios/servicos", label: "Serviços", icon: CalendarRange },
  { to: "/relatorios/crm", label: "CRM", icon: KanbanSquare },
  { to: "/relatorios/tecnicos", label: "Técnicos", icon: Activity },
  { to: "/relatorios/equipe", label: "Equipe", icon: Users2 },
];

export function RelatoriosLayout() {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <BarChart3 className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-display font-semibold">Relatórios</h1>
      </div>
      <nav className="flex flex-wrap gap-2 border-b border-border pb-3">
        {items.map((it) => (
          <NavLink
            key={it.to}
            to={it.to}
            end={it.end}
            className={({ isActive }) =>
              cn(
                "inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-sm transition-colors",
                isActive
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-muted/70 hover:text-foreground",
              )
            }
          >
            <it.icon className="h-4 w-4" />
            {it.label}
          </NavLink>
        ))}
      </nav>
      <Outlet />
    </div>
  );
}
