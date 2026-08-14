import { Navigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { Activity, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { userHasStaffAccess } from "@/lib/authAccess";

function FullScreenLoader() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-3">
        <div className="w-12 h-12 rounded-2xl bg-primary flex items-center justify-center animate-pulse">
          <Activity className="w-7 h-7 text-primary-foreground" />
        </div>
        <p className="text-muted-foreground text-sm">Carregando...</p>
      </div>
    </div>
  );
}

function AccessCheckError({
  onRetry,
  onSignOut,
  isRetrying,
}: {
  onRetry: () => void;
  onSignOut: () => void;
  isRetrying: boolean;
}) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-6">
      <div className="max-w-md w-full flex flex-col items-center gap-4 text-center">
        <div className="w-12 h-12 rounded-2xl bg-destructive/15 flex items-center justify-center">
          <AlertTriangle className="w-7 h-7 text-destructive" />
        </div>
        <div className="space-y-1">
          <h1 className="text-lg font-semibold text-foreground">
            Não foi possível verificar seu acesso
          </h1>
          <p className="text-sm text-muted-foreground">
            Houve uma falha de conexão com o servidor. Tente novamente em alguns
            instantes.
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={onRetry} disabled={isRetrying}>
            {isRetrying ? "Tentando..." : "Tentar novamente"}
          </Button>
          <Button variant="outline" onClick={onSignOut}>
            Sair
          </Button>
        </div>
      </div>
    </div>
  );
}

export function ProtectedRoute({
  children,
  requireStaff = false,
}: {
  children: React.ReactNode;
  requireStaff?: boolean;
}) {
  const { user, isReady, signOut } = useAuth();

  // Cacheia o resultado de roles (evita requery a cada navegação).
  const {
    data: hasStaffAccess,
    isLoading: checkingAccess,
    isError,
    isFetching,
    refetch,
  } = useQuery({
    queryKey: ["staff-access", user?.id],
    queryFn: () => (user ? userHasStaffAccess(user.id) : Promise.resolve(false)),
    enabled: isReady && requireStaff && !!user,
    staleTime: 5 * 60_000,
    gcTime: 10 * 60_000,
    retry: 2,
    retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 5000),
  });

  // Enquanto auth não terminou de carregar, NUNCA decidir redirect — evita flash de /login.
  if (!isReady) return <FullScreenLoader />;

  if (!user) return <Navigate to="/login" replace />;

  if (requireStaff) {
    // Falha na verificação = acesso NEGADO (nunca liberar staff por erro),
    // mas com tela acionável em vez de loader infinito.
    if (isError) {
      return (
        <AccessCheckError
          onRetry={() => refetch()}
          onSignOut={() => signOut()}
          isRetrying={isFetching}
        />
      );
    }
    if (checkingAccess || hasStaffAccess === undefined) return <FullScreenLoader />;
    if (!hasStaffAccess) return <Navigate to="/portal" replace />;
  }

  return <>{children}</>;
}

