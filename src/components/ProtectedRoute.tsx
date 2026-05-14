import { Navigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { Activity } from "lucide-react";
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

export function ProtectedRoute({
  children,
  requireStaff = false,
}: {
  children: React.ReactNode;
  requireStaff?: boolean;
}) {
  const { user, isReady } = useAuth();

  // Cacheia o resultado de roles (evita requery a cada navegação).
  const { data: hasStaffAccess, isLoading: checkingAccess } = useQuery({
    queryKey: ["staff-access", user?.id],
    queryFn: () => (user ? userHasStaffAccess(user.id) : Promise.resolve(false)),
    enabled: isReady && requireStaff && !!user,
    staleTime: 5 * 60_000,
    gcTime: 10 * 60_000,
  });

  // Enquanto auth não terminou de carregar, NUNCA decidir redirect — evita flash de /login.
  if (!isReady) return <FullScreenLoader />;

  if (!user) return <Navigate to="/login" replace />;

  if (requireStaff) {
    if (checkingAccess || hasStaffAccess === undefined) return <FullScreenLoader />;
    if (!hasStaffAccess) return <Navigate to="/portal" replace />;
  }

  return <>{children}</>;
}
