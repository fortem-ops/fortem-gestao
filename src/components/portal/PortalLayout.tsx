import { useEffect, useState } from "react";
import { NavLink, Outlet, useNavigate, useLocation } from "react-router-dom";
import { House, Dumbbell, ClipboardCheck, CalendarDays, LogOut, Menu, UserRound, UsersRound, MessageCircle, Settings, ShoppingBag, MessageSquarePlus } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useAuth } from "@/contexts/AuthContext";
import { useStudentPortal } from "@/contexts/StudentPortalContext";
import { PortalPushIncentivo } from "./PortalPushIncentivo";
import { PortalPushContexto } from "./PortalPushContexto";
import { SeloPlano } from "./SeloPlano";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import fortemIcon from "@/assets/fortem-icon.png";
import fortemWordmark from "@/assets/fortem-wordmark.png";
import { cn } from "@/lib/utils";
import { filtrarNavPortal } from "@/lib/portalAgenda";
import { lerReservaPendente } from "@/lib/recoveryReservaPendente";
import { usePortalTema } from "@/hooks/usePortalTema";
import { useMeuPlanoClube } from "@/lib/clubePlano";

const navItems = [
  { to: "/portal/home", label: "Início", icon: House },
  { to: "/portal/treinos", label: "Treinos", icon: Dumbbell },
  { to: "/portal/agenda", label: "Agenda", icon: CalendarDays },
  { to: "/portal/comunidade", label: "Comunidade", icon: UsersRound },
  { to: "/portal/avaliacoes", label: "Evolução", icon: ClipboardCheck },
];


export function PortalLayout() {
  const { signOut, user } = useAuth();
  const { student, loading, unlinked, linkReason, somenteOnline } = useStudentPortal();
  const itensNav = filtrarNavPortal(navItems, somenteOnline);
  const navigate = useNavigate();
  const [menuAberto, setMenuAberto] = useState(false);
  const { pathname } = useLocation();
  const { tema } = usePortalTema();
  const { data: meuPlano } = useMeuPlanoClube(!!student);

  // Diálogos, sheets e toasts montam em document.body (fora do wrapper):
  // aplica o tema do portal ao body enquanto o portal estiver aberto.
  useEffect(() => {
    document.body.setAttribute("data-portal", "true");
    document.body.setAttribute("data-portal-tema", tema);
    return () => {
      document.body.removeAttribute("data-portal");
      document.body.removeAttribute("data-portal-tema");
    };
  }, [tema]);

  // Compra avulsa de Recovery com horário guardado (ex.: PIX pago e página fechada):
  // ao abrir o portal, leva à Agenda, que confirma o horário se ainda houver vaga.
  useEffect(() => {
    if (!student?.id) return;
    if (window.location.pathname.startsWith("/portal/agenda")) return;
    if (lerReservaPendente(student.id)) navigate("/portal/agenda", { replace: true });
  }, [student?.id, navigate]);


  if (loading) {
    return (
      <div data-portal="true" data-portal-tema={tema} className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <img src={fortemIcon} alt="Fortem" className="w-14 h-14 animate-pulse" />
          <p className="text-muted-foreground text-xs tracking-wider">carregando...</p>
        </div>
      </div>
    );
  }

  if (unlinked) {
    const emailLogado = user?.email ?? "";
    const textoWpp = encodeURIComponent(
      `Olá! Tentei entrar no Portal do Aluno com o e-mail ${emailLogado}, mas minha conta apareceu como ainda não vinculada. Podem me ajudar?`,
    );
    const urlWpp = `https://wa.me/555135199451?text=${textoWpp}`;
    const mensagem =
      linkReason === "ja_vinculado_outra_conta"
        ? "Esse e-mail já está vinculado a outra conta de acesso na FORTEM. Nossa equipe já foi avisada para ajustar o vínculo, ou você pode falar conosco pelo WhatsApp."
        : "Esse e-mail ainda não está vinculado a um cadastro de aluno na FORTEM. Nossa equipe já foi avisada — se preferir, chame no WhatsApp para liberarmos seu acesso.";
    return (
      <div data-portal="true" data-portal-tema={tema} className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="glass-card max-w-md w-full p-8 text-center space-y-4 rounded-2xl">
          <img src={fortemIcon} alt="Fortem" className="mx-auto w-14 h-14" />
          <h1 className="text-xl font-heading font-bold">Conta ainda não vinculada</h1>
          <p className="text-sm text-muted-foreground">
            Você entrou como <strong>{emailLogado}</strong>. {mensagem}
          </p>
          <Button asChild className="w-full">
            <a href={urlWpp} target="_blank" rel="noopener noreferrer">
              <MessageCircle className="w-4 h-4 mr-2" /> Falar com a equipe no WhatsApp
            </a>
          </Button>
          <Button variant="outline" className="w-full" onClick={() => signOut().then(() => navigate("/portal/login"))}>
            <LogOut className="w-4 h-4 mr-2" /> Sair
          </Button>
        </div>
      </div>
    );
  }

  const initial = student?.nome?.charAt(0) ?? "?";

  return (
    <div data-portal="true" data-portal-tema={tema} className="min-h-screen bg-background flex flex-col">
      {/* Top bar */}
      <header data-portal="true" data-portal-tema={tema} className="sticky top-0 z-30 border-b border-border bg-background">
        <div className="max-w-3xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setMenuAberto(true)}
              className="-ml-2 w-11 h-11 flex items-center justify-center text-foreground"
              aria-label="Abrir menu"
            >
              <Menu className="w-5 h-5" />
            </button>
            <img src={fortemIcon} alt="Fortem" className="w-7 h-7" />
            <img src={fortemWordmark} alt="Fortem" className={cn("h-4 hidden sm:block", tema !== "claro" && "invert")} />
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-muted-foreground truncate max-w-[140px]">{student?.nome?.split(' ')[0]}</span>
            <button
              onClick={() => navigate("/portal/perfil")}
              className="w-11 h-11 flex items-center justify-center rounded-full ring-1 ring-border hover:ring-primary transition"
              title="Perfil"
              aria-label="Perfil"

            >
              <Avatar className="w-8 h-8">
                {student?.foto_url && <AvatarImage src={student.foto_url} alt={student.nome} />}
                <AvatarFallback className="bg-secondary text-foreground text-xs font-semibold">
                  {initial}
                </AvatarFallback>
              </Avatar>
            </button>
          </div>
        </div>
      </header>

      <Sheet open={menuAberto} onOpenChange={setMenuAberto}>
        <SheetContent
          side="left"
          data-portal="true"
          data-portal-tema={tema}
          className="w-[82vw] max-w-[320px] rounded-none border-r border-[#4A4B4B] bg-background p-0"
          style={{ fontFamily: "Archivo, sans-serif" }}
        >
          <SheetHeader className="border-b border-[#4A4B4B] px-5 py-4 text-left">
            <SheetTitle className="text-[13px] font-bold uppercase tracking-[0.08em] text-[#B1B3B3]">Menu</SheetTitle>
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-base font-black uppercase text-foreground truncate">{student?.nome}</p>
              <SeloPlano chave={meuPlano?.chave} />
            </div>
          </SheetHeader>
          <nav className="flex flex-col py-2">
            {[
              { to: "/portal/perfil", label: "Perfil, plano e pagamentos", icon: UserRound },
              { to: "/portal/loja", label: "Loja da FORTEM", icon: ShoppingBag },
              { to: "/portal/sugestoes", label: "Sugestões de melhorias", icon: MessageSquarePlus },
              { to: "/portal/configuracoes", label: "Configurações do app", icon: Settings },
            ].map((item) => (
              <button
                key={item.to}
                type="button"
                onClick={() => { setMenuAberto(false); navigate(item.to); }}
                className="flex min-h-[52px] items-center gap-3 px-5 text-left text-[13px] font-bold uppercase tracking-[0.08em] text-foreground hover:bg-[#1a1a1a]"
              >
                <item.icon className="h-5 w-5 text-[#B1B3B3]" />
                {item.label}
              </button>
            ))}
            <button
              type="button"
              onClick={() => { setMenuAberto(false); signOut().then(() => navigate("/portal/login")); }}
              className="mt-2 flex min-h-[52px] items-center gap-3 border-t border-[#4A4B4B] px-5 text-left text-[13px] font-bold uppercase tracking-[0.08em] text-[#e73c3e] hover:bg-[#1a1a1a]"
            >
              <LogOut className="h-5 w-5" />
              Sair
            </button>
          </nav>
        </SheetContent>
      </Sheet>

      {/* Conteúdo */}
      <main className="flex-1 max-w-3xl w-full mx-auto px-4 pt-4 pb-28">
        {(pathname === "/portal" || pathname === "/portal/home") && <div className="mb-4"><PortalPushIncentivo /></div>}
        <PortalPushContexto />
        <Outlet />
      </main>

      {/* Bottom nav */}
      <nav data-portal="true" data-portal-tema={tema} className="fixed bottom-0 inset-x-0 border-t border-border bg-background z-40">
        <div className={cn("max-w-3xl mx-auto grid", itensNav.length === 4 ? "grid-cols-4" : "grid-cols-5")}>
          {itensNav.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                cn(
                  "flex min-h-[56px] flex-col items-center justify-center gap-1 border-t-2 pt-2 pb-5 text-[11px] font-bold uppercase tracking-[0.06em] transition-colors",
                  isActive
                    ? "border-[#E73C3E] text-[#E73C3E]"
                    : "border-transparent text-[#B1B3B3] hover:text-foreground",
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
