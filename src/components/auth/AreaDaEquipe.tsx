import { ShieldAlert } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { appEquipeStandalone, lerAmbienteApp } from "@/lib/appInstalavel";

/** Quem não é equipe numa tela da equipe. Nunca redireciona sozinho para o portal. */
export function AreaDaEquipe() {
  const navigate = useNavigate();
  const { signOut, user } = useAuth();
  const noAppEquipe = appEquipeStandalone(lerAmbienteApp());
  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-6">
      <div className="max-w-md w-full flex flex-col items-center gap-4 text-center">
        <div className="w-12 h-12 rounded-2xl bg-muted flex items-center justify-center">
          <ShieldAlert className="w-7 h-7 text-muted-foreground" />
        </div>
        <div className="space-y-1">
          <h1 className="text-lg font-semibold text-foreground">Esta área é da equipe</h1>
          <p className="text-sm text-muted-foreground">
            {user?.email ? `A conta ${user.email} não tem acesso de equipe.` : "Esta conta não tem acesso de equipe."}
            {noAppEquipe ? " O portal do aluno não abre pelo app da equipe." : ""}
          </p>
        </div>
        <div className="flex flex-wrap justify-center gap-2">
          {!noAppEquipe && <Button onClick={() => navigate("/portal", { replace: true })}>Ir para o portal do aluno</Button>}
          <Button variant="outline" onClick={() => signOut().then(() => navigate("/login", { replace: true }))}>
            Sair
          </Button>
        </div>
        <a href="/diagnostico-app" className="text-xs text-muted-foreground underline underline-offset-4">
          Diagnóstico do app
        </a>
      </div>
    </div>
  );
}
