import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { User, Dumbbell, ClipboardCheck, Sparkles, CalendarDays, LogOut, Activity } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useStudentPortal } from "@/contexts/StudentPortalContext";
import { Button } from "@/components/ui/button";
import fortemIcon from "@/assets/fortem-icon.png";
import fortemWordmark from "@/assets/fortem-wordmark.png";
import { cn } from "@/lib/utils";

const navItems = [
  { to: "/portal", label: "Perfil", icon: User, end: true },
  { to: "/portal/treinos", label: "Treinos", icon: Dumbbell },
  { to: "/portal/avaliacoes", label: "Avaliações", icon: ClipboardCheck },
  { to: "/portal/clube", label: "Clube", icon: Sparkles },
  { to: "/portal/agenda", label: "Agenda", icon: CalendarDays },
];

export function PortalLayout() {
  const { signOut, user } = useAuth();
  const { student, loading, unlinked } = useStudentPortal();
  const navigate = useNavigate();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-primary flex items-center justify-center animate-pulse">
            <Activity className="w-7 h-7 text-primary-foreground" />
          </div>
          <p className="text-muted-foreground text-sm">Carregando portal...</p>
        </div>
      </div>
    );
  }

  if (unlinked) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
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

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Top bar */}
      <header className="sticky top-0 z-30 border-b border-border bg-background/80 backdrop-blur">
        <div className="max-w-3xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <img src={fortemIcon} alt="Fortem" className="w-7 h-7" />
            <img src={fortemWordmark} alt="Fortem" className="h-4 dark:invert hidden sm:block" />
            <span className="text-xs text-muted-foreground hidden md:inline">· Portal do Aluno</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground truncate max-w-[140px]">{student?.nome}</span>
            <Button variant="ghost" size="icon" onClick={() => signOut().then(() => navigate("/portal/login"))} title="Sair">
              <LogOut className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </header>

      {/* Conteúdo */}
      <main className="flex-1 max-w-3xl w-full mx-auto px-4 pt-4 pb-24">
        <Outlet />
      </main>

      {/* Bottom nav */}
      <nav className="fixed bottom-0 inset-x-0 border-t border-border bg-background/95 backdrop-blur z-40">
        <div className="max-w-3xl mx-auto grid grid-cols-5">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                cn(
                  "flex flex-col items-center justify-center py-2.5 gap-0.5 text-[10px] transition-colors",
                  isActive ? "text-primary" : "text-muted-foreground hover:text-foreground",
                )
              }
            >
              <item.icon className="w-5 h-5" />
              <span>{item.label}</span>
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
}
