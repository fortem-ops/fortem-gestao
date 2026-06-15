import { SidebarProvider, SidebarTrigger, useSidebar } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { Outlet } from "react-router-dom";
import { GlobalCadastroSearch } from "@/components/GlobalCadastroSearch";
import { NotifChatProvider } from "@/contexts/NotifChatContext";
import { NotificacaoChatDock } from "@/components/notificar/NotificacaoChatDock";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { PanelLeftClose, PanelLeftOpen } from "lucide-react";

function SidebarToggleLabel() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <SidebarTrigger aria-label={collapsed ? "Mostrar menu" : "Esconder menu"}>
          {collapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
        </SidebarTrigger>
      </TooltipTrigger>
      <TooltipContent side="right">
        {collapsed ? "Mostrar menu (Ctrl/Cmd + B)" : "Esconder menu (Ctrl/Cmd + B)"}
      </TooltipContent>
    </Tooltip>
  );
}

export function AppLayout() {
  return (
    <NotifChatProvider>
      <SidebarProvider>
        <div className="min-h-screen flex w-full">
          <AppSidebar />
          <div className="flex-1 flex flex-col min-w-0">
            <header className="h-14 flex items-center gap-2 sm:gap-4 border-b border-border px-2 sm:px-4 shrink-0">
              <SidebarToggleLabel />
              <span className="text-sm text-muted-foreground font-medium hidden md:inline">Fortem Gestão Técnica</span>
              <div className="flex-1 flex justify-center min-w-0">
                <GlobalCadastroSearch />
              </div>
            </header>
            <main className="flex-1 overflow-auto p-3 sm:p-4 md:p-6 min-w-0">
              <Outlet />
            </main>
          </div>
        </div>
        <NotificacaoChatDock />
      </SidebarProvider>
    </NotifChatProvider>
  );
}
