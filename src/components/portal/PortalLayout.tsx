import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { House, Dumbbell, ClipboardCheck, Sparkles, CalendarDays, LogOut, Bell } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useStudentPortal } from "@/contexts/StudentPortalContext";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import fortemIcon from "@/assets/fortem-icon.png";
import fortemWordmark from "@/assets/fortem-wordmark.png";
import { cn } from "@/lib/utils";

const navItems = [
  { to: "/portal/home", label: "Home", icon: House },
  { to: "/portal/treinos", label: "Treinos", icon: Dumbbell },
  { to: "/portal/avaliacoes", label: "Avaliações", icon: ClipboardCheck },
  { to: "/portal/clube", label: "Clube", icon: Sparkles },
  { to: "/portal/agenda", label: "Agenda", icon: CalendarDays },
];

export function PortalLayout() {
  const { signOut, user } = useAuth();
  const { student, loading, unlinked } = useStudentPortal();
  const navigate = useNavigate();
  const { isSupported, isSubscribed, isLoading: pushLoading, permission, subscribe } = usePushNotifications();

  if (loading) {
    return (
      <div data-portal="true" className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <img src={fortemIcon} alt="Fortem" className="w-14 h-14 animate-pulse" />
          <p className="text-muted-foreground text-xs tracking-wider">carregando...</p>
        </div>
      </div>
    );
  }

  if (unlinked) {
    return (
      <div data-portal="true" className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="glass-card max-w-md w-full p-8 text-center space-y-4 rounded-2xl">
          <img src={fortemIcon} alt="Fortem" className="mx-auto w-14 h-14" />
          <h1 className="text-xl font-heading font-bold">Conta ainda não vinculada</h1>
          <p className="text-sm text-muted-foreground">
            Você está logado como <strong>{user?.email}</strong>, mas esse e-mail ainda não está
            cadastrado na FORTEM. Fale com seu professor para liberar o acesso.
          </p>
          <Button variant="outline" className="w-full" onClick={() => signOut().then(() => navigate("/portal/login"))}>
            <LogOut className="w-4 h-4 mr-2" /> Sair
          </Button>
        </div>
      </div>
    );
  }

  const initial = student?.nome?.charAt(0) ?? "?";

  return (
    <div data-portal="true" className="min-h-screen bg-background flex flex-col">
      {/* Top bar */}
      <header data-portal="true" className="sticky top-0 z-30 border-b border-border bg-background">
        <div className="max-w-3xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <img src={fortemIcon} alt="Fortem" className="w-7 h-7" />
            <img src={fortemWordmark} alt="Fortem" className="h-4 invert hidden sm:block" />
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-muted-foreground truncate max-w-[140px]">{student?.nome?.split(' ')[0]}</span>
            <button
              onClick={() => navigate("/portal/perfil")}
              className="rounded-full ring-1 ring-border hover:ring-primary transition"
              title="Perfil"
            >
              <Avatar className="w-8 h-8">
                {student?.foto_url && <AvatarImage src={student.foto_url} alt={student.nome} />}
                <AvatarFallback className="bg-secondary text-foreground text-xs font-semibold">
                  {initial}
                </AvatarFallback>
              </Avatar>
            </button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => signOut().then(() => navigate("/portal/login"))}
              title="Sair"
            >
              <LogOut className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </header>

      {/* Banner de ativação de notificações */}
      {isSupported && !isSubscribed && permission !== "denied" && (
        <div className="bg-primary/10 border-b border-primary/20 px-4 py-2.5 flex items-center gap-3">
          <Bell className="w-4 h-4 text-primary shrink-0" />
          <p className="text-xs text-foreground flex-1">
            Ative as notificações para receber alertas de treino, renovação e mais.
          </p>
          <button
            onClick={subscribe}
            disabled={pushLoading}
            className="text-xs font-bold text-primary whitespace-nowrap"
          >
            {pushLoading ? "..." : "Ativar"}
          </button>
        </div>
      )}

      {/* Conteúdo */}
      <main className="flex-1 max-w-3xl w-full mx-auto px-4 pt-4 pb-28">
        <Outlet />
      </main>

      {/* Bottom nav */}
      <nav data-portal="true" className="fixed bottom-0 inset-x-0 border-t border-border bg-card z-40">
        <div className="max-w-3xl mx-auto grid grid-cols-5">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                cn(
                  "flex flex-col items-center justify-center py-3 pb-6 gap-1 text-[10px] tracking-wide transition-colors",
                  isActive ? "text-primary" : "text-muted-foreground hover:text-foreground",
                )
              }
            >
              <item.icon className="w-5 h-5" strokeWidth={2} />
              <span>{item.label}</span>
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
}
