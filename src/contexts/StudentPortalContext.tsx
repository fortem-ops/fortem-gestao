import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./AuthContext";
import type { Tables } from "@/integrations/supabase/types";

interface StudentPortalContextType {
  student: Tables<"alunos"> | null;
  loading: boolean;
  /** True quando o usuário está logado mas não está vinculado a nenhum aluno. */
  unlinked: boolean;
  refetch: () => void;
}

const StudentPortalContext = createContext<StudentPortalContextType | undefined>(undefined);

export function StudentPortalProvider({ children }: { children: ReactNode }) {
  const { user, loading: authLoading } = useAuth();
  const [linkAttempted, setLinkAttempted] = useState(false);

  // Tenta vincular automaticamente no primeiro acesso por sessão.
  useEffect(() => {
    if (!user || linkAttempted) return;
    setLinkAttempted(true);
    supabase.rpc("fn_portal_link_aluno").then(() => {
      // Independente do resultado, deixa a query abaixo descobrir o estado real.
    });
  }, [user, linkAttempted]);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["portal-student", user?.id, linkAttempted],
    enabled: !!user && linkAttempted,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("alunos")
        .select("*")
        .eq("user_id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return data as Tables<"alunos"> | null;
    },
  });

  const value = useMemo<StudentPortalContextType>(
    () => ({
      student: data ?? null,
      loading: authLoading || isLoading || !linkAttempted,
      unlinked: !!user && linkAttempted && !isLoading && !data,
      refetch: () => { void refetch(); },
    }),
    [data, authLoading, isLoading, linkAttempted, user, refetch],
  );

  return <StudentPortalContext.Provider value={value}>{children}</StudentPortalContext.Provider>;
}

export function useStudentPortal() {
  const ctx = useContext(StudentPortalContext);
  if (!ctx) throw new Error("useStudentPortal must be used within StudentPortalProvider");
  return ctx;
}
