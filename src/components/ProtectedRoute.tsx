import { Navigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Activity } from "lucide-react";
import { userHasStaffAccess } from "@/lib/authAccess";

export function ProtectedRoute({ children, requireStaff = false }: { children: React.ReactNode; requireStaff?: boolean }) {
  const { user, loading } = useAuth();
  const [checkingAccess, setCheckingAccess] = useState(false);
  const [hasStaffAccess, setHasStaffAccess] = useState<boolean | null>(null);

  useEffect(() => {
    if (!requireStaff || !user) {
      setHasStaffAccess(null);
      setCheckingAccess(false);
      return;
    }

    let cancelled = false;
    setCheckingAccess(true);
    userHasStaffAccess(user.id)
      .then((allowed) => {
        if (!cancelled) setHasStaffAccess(allowed);
      })
      .catch(() => {
        if (!cancelled) setHasStaffAccess(false);
      })
      .finally(() => {
        if (!cancelled) setCheckingAccess(false);
      });

    return () => {
      cancelled = true;
    };
  }, [requireStaff, user]);

  if (loading || checkingAccess) {
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

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (requireStaff && hasStaffAccess === false) {
    return <Navigate to="/portal" replace />;
  }

  return <>{children}</>;
}
