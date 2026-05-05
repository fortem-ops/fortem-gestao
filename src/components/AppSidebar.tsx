import { LayoutDashboard, Users, ClipboardList, CalendarDays, Settings, LogOut, Briefcase, Dumbbell, ClipboardCheck, Library, KanbanSquare, Sparkles, ScanLine, Clock, Users2, FileCheck2, FileText } from "lucide-react";
import { NavLink } from "@/components/NavLink";
import fortemIcon from "@/assets/fortem-icon.png";
import fortemWordmark from "@/assets/fortem-wordmark.png";
import { useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
  useSidebar,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";

const mainItems = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard },
  { title: "Alunos", url: "/alunos", icon: Users },
  { title: "Avaliações", url: "/avaliacoes", icon: ClipboardCheck },
  { title: "Banco de Treinos", url: "/banco-treinos", icon: Library },
  { title: "Banco de Exercícios", url: "/exercicios", icon: Dumbbell },
  { title: "Carteira de Alunos", url: "/carteira", icon: Briefcase },
  { title: "Pipeline", url: "/pipeline", icon: KanbanSquare },
  { title: "Clube FORTEM", url: "/clube", icon: Sparkles },
  { title: "Ponto", url: "/ponto", icon: Clock },
  { title: "Tarefas", url: "/tarefas", icon: ClipboardList },
  { title: "Agenda", url: "/agenda", icon: CalendarDays },
];

const coordPontoItems = [
  { title: "Equipe (Ponto)", url: "/ponto/equipe", icon: Users2 },
  { title: "Relatório Ponto", url: "/ponto/relatorio", icon: FileText },
  { title: "Fechamento Ponto", url: "/ponto/fechamento", icon: FileCheck2 },
];

const adminItems = [
  { title: "Administração", url: "/admin", icon: Settings },
  { title: "Admin Clube", url: "/admin/clube", icon: Sparkles },
  { title: "Admin Ponto", url: "/admin/ponto", icon: Clock },
  { title: "Painel Parceiro", url: "/parceiros/scanner", icon: ScanLine },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const location = useLocation();
  const { signOut, user } = useAuth();
  const isActive = (path: string) => location.pathname === path || (path !== "/" && location.pathname.startsWith(path));

  const { data: isCoordAdmin } = useQuery({
    queryKey: ["sidebar-coord-admin", user?.id],
    queryFn: async () => {
      const { data } = await supabase.rpc("is_coordinator_or_admin", { _user_id: user!.id });
      return !!data;
    },
    enabled: !!user,
    staleTime: 5 * 60_000,
  });

  return (
    <Sidebar collapsible="icon">
      <SidebarContent>
        <div className="p-4 flex items-center gap-3">
          <img src={fortemIcon} alt="Fortem" className="w-8 h-8 shrink-0 object-contain" />
          {!collapsed && (
            <img src={fortemWordmark} alt="Fortem" className="h-5 object-contain dark:invert" />
          )}
        </div>

        <SidebarGroup>
          <SidebarGroupLabel>Principal</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {mainItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild isActive={isActive(item.url)}>
                    <NavLink to={item.url} end={item.url === "/"} activeClassName="bg-sidebar-accent text-sidebar-primary">
                      <item.icon className="mr-2 h-4 w-4" />
                      {!collapsed && <span>{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
              {isCoordAdmin && coordPontoItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild isActive={isActive(item.url)}>
                    <NavLink to={item.url} activeClassName="bg-sidebar-accent text-sidebar-primary">
                      <item.icon className="mr-2 h-4 w-4" />
                      {!collapsed && <span>{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>Sistema</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {adminItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild isActive={isActive(item.url)}>
                    <NavLink to={item.url} activeClassName="bg-sidebar-accent text-sidebar-primary">
                      <item.icon className="mr-2 h-4 w-4" />
                      {!collapsed && <span>{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="p-3 border-t border-border">
        {!collapsed && user && (
          <p className="text-xs text-muted-foreground truncate mb-2 px-1">
            {user.email}
          </p>
        )}
        <Button
          variant="ghost"
          size={collapsed ? "icon" : "sm"}
          className="w-full justify-start text-muted-foreground hover:text-destructive"
          onClick={signOut}
        >
          <LogOut className="h-4 w-4 mr-2 shrink-0" />
          {!collapsed && <span>Sair</span>}
        </Button>
      </SidebarFooter>
    </Sidebar>
  );
}
