import { LayoutDashboard, Users, UserX, ClipboardList, CalendarDays, Settings, LogOut, Briefcase, Dumbbell, ClipboardCheck, Library, KanbanSquare, Sparkles, ScanLine, Clock, Users2, FileCheck2, FileText, UserPlus, Target, Bell, FileSignature } from "lucide-react";
import { useNotificacaoRealtime, useUnreadCount } from "@/hooks/useNotificacoes";
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

/* ─── Principal ─── */
const principalItems = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard },
  { title: "Ponto", url: "/ponto", icon: Clock },
  { title: "Tarefas", url: "/tarefas", icon: ClipboardList },
  { title: "Notificar", url: "/notificar", icon: Bell, badge: "unread" as const },
  { title: "Agenda", url: "/agenda", icon: CalendarDays },
];

const principalCoordItems = [
  { title: "Equipe Ponto", url: "/ponto/equipe", icon: Users2 },
  { title: "Relatório Ponto", url: "/ponto/relatorio", icon: FileText },
  { title: "Fechamento Ponto", url: "/ponto/fechamento", icon: FileCheck2 },
];

/* ─── Técnico ─── */
const tecnicoItems = [
  { title: "Banco de Treinos", url: "/banco-treinos", icon: Library },
  { title: "Banco de Exercícios", url: "/exercicios", icon: Dumbbell },
  { title: "Avaliações", url: "/avaliacoes", icon: ClipboardCheck },
  { title: "Carteira de Alunos", url: "/carteira", icon: Briefcase },
];

/* ─── Cadastros ─── */
const cadastrosLeadsAdmin = [
  { title: "Leads", url: "/leads", icon: UserPlus },
];
const cadastrosMidItems = [
  { title: "Prospects", url: "/prospects", icon: Target },
  { title: "Alunos Ativos", url: "/alunos", icon: Users },
  { title: "Alunos Inativos", url: "/alunos-inativos", icon: UserX },
];
const cadastrosAdminItems = [
  { title: "Anexos Jurídicos", url: "/anexos", icon: FileSignature },
];

/* ─── Comercial ─── */
const comercialItems = [
  { title: "Clube FORTEM", url: "/clube", icon: Sparkles },
];

const comercialAdminItems = [
  { title: "Pipeline", url: "/pipeline", icon: KanbanSquare },
];

/* ─── Sistema ─── */
const sistemaAdminItems = [
  { title: "Administração", url: "/admin", icon: Settings },
  { title: "Admin Clube", url: "/admin/clube", icon: Sparkles },
];

const sistemaCoordItems = [
  { title: "Admin Ponto", url: "/admin/ponto", icon: Clock },
];

const sistemaParceiroItems = [
  { title: "Painel Parceiro", url: "/parceiros/scanner", icon: ScanLine },
];

function SidebarItem({ item, isActive }: { item: { title: string; url: string; icon: any; badge?: "unread" }; isActive: (p: string) => boolean }) {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const { data: unread = 0 } = useUnreadCount();
  const showBadge = item.badge === "unread" && unread > 0;
  return (
    <SidebarMenuItem>
      <SidebarMenuButton asChild isActive={isActive(item.url)}>
        <NavLink to={item.url} end={item.url === "/"} activeClassName="bg-sidebar-accent text-sidebar-primary">
          <item.icon className="mr-2 h-4 w-4" />
          {!collapsed && <span className="flex-1">{item.title}</span>}
          {showBadge && (
            <span className={`${collapsed ? "ml-0 absolute right-1 top-1" : "ml-auto"} inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold`}>
              {unread > 99 ? "99+" : unread}
            </span>
          )}
        </NavLink>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const location = useLocation();
  const { signOut, user } = useAuth();
  const isActive = (path: string) => location.pathname === path || (path !== "/" && location.pathname.startsWith(path));
  useNotificacaoRealtime();

  const { data: isCoordAdmin } = useQuery({
    queryKey: ["sidebar-coord-admin", user?.id],
    queryFn: async () => {
      const { data } = await supabase.rpc("is_coordinator_or_admin", { _user_id: user!.id });
      return !!data;
    },
    enabled: !!user,
    staleTime: 5 * 60_000,
  });

  const { data: isAdmin } = useQuery({
    queryKey: ["sidebar-is-admin", user?.id],
    queryFn: async () => {
      const { data } = await supabase.rpc("is_admin", { _user_id: user!.id });
      return !!data;
    },
    enabled: !!user,
    staleTime: 5 * 60_000,
  });

  const { data: isParceiro } = useQuery({
    queryKey: ["sidebar-is-parceiro", user?.id],
    queryFn: async () => {
      if (!user) return false;
      const { data } = await supabase.from("parceiros").select("id").eq("user_id", user.id).eq("ativo", true).maybeSingle();
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

        {/* Principal */}
        <SidebarGroup>
          <SidebarGroupLabel>Principal</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {principalItems.map((item) => (
                <SidebarItem key={item.title} item={item} isActive={isActive} />
              ))}
              {isCoordAdmin && principalCoordItems.map((item) => (
                <SidebarItem key={item.title} item={item} isActive={isActive} />
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Técnico */}
        <SidebarGroup>
          <SidebarGroupLabel>Técnico</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {tecnicoItems.map((item) => (
                <SidebarItem key={item.title} item={item} isActive={isActive} />
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Cadastros */}
        <SidebarGroup>
          <SidebarGroupLabel>Cadastros</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {isAdmin && cadastrosLeadsAdmin.map((item) => (
                <SidebarItem key={item.title} item={item} isActive={isActive} />
              ))}
              {cadastrosMidItems.map((item) => (
                <SidebarItem key={item.title} item={item} isActive={isActive} />
              ))}
              {isAdmin && cadastrosAdminItems.map((item) => (
                <SidebarItem key={item.title} item={item} isActive={isActive} />
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Comercial */}
        <SidebarGroup>
          <SidebarGroupLabel>Comercial</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {comercialItems.map((item) => (
                <SidebarItem key={item.title} item={item} isActive={isActive} />
              ))}
              {isAdmin && comercialAdminItems.map((item) => (
                <SidebarItem key={item.title} item={item} isActive={isActive} />
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Sistema */}
        <SidebarGroup>
          <SidebarGroupLabel>Sistema</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {isAdmin && sistemaAdminItems.map((item) => (
                <SidebarItem key={item.title} item={item} isActive={isActive} />
              ))}
              {isCoordAdmin && sistemaCoordItems.map((item) => (
                <SidebarItem key={item.title} item={item} isActive={isActive} />
              ))}
              {(isParceiro || isAdmin) && sistemaParceiroItems.map((item) => (
                <SidebarItem key={item.title} item={item} isActive={isActive} />
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

