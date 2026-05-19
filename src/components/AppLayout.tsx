import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { Outlet } from "react-router-dom";
import { GlobalCadastroSearch } from "@/components/GlobalCadastroSearch";
import { NotifChatProvider } from "@/contexts/NotifChatContext";
import { NotificacaoChatDock } from "@/components/notificar/NotificacaoChatDock";

export function AppLayout() {
  return (
    <NotifChatProvider>
      <SidebarProvider>
        <div className="min-h-screen flex w-full">
          <AppSidebar />
          <div className="flex-1 flex flex-col min-w-0">
            <header className="h-14 flex items-center gap-4 border-b border-border px-4 shrink-0">
              <SidebarTrigger />
              <span className="text-sm text-muted-foreground font-medium hidden sm:inline">Fortem Gestão Técnica</span>
              <div className="flex-1 flex justify-center">
                <GlobalCadastroSearch />
              </div>
            </header>
            <main className="flex-1 overflow-auto p-6">
              <Outlet />
            </main>
          </div>
        </div>
        <NotificacaoChatDock />
      </SidebarProvider>
    </NotifChatProvider>
  );
}
