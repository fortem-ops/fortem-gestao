import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./AuthContext";
import type { Tables } from "@/integrations/supabase/types";

interface StudentPortalContextType {
  student: Tables<"alunos"> | null;
  loading: boolean;
  unlinked: boolean;
  refetch: () => void;
}

const StudentPortalContext = createContext<StudentPortalContextType | undefined>(undefined);

export function StudentPortalProvider({ children }: { children: ReactNode }) {
  const { user, loading: authLoading } = useAuth();
  const [linkDone, setLinkDone] = useState(false);

  // Chama o RPC e só libera a query quando ele terminar (await real).
  useEffect(() => {
    if (!user || linkDone) return;
    supabase.rpc("fn_portal_link_aluno").then(() => {
      setLinkDone(true);
    }).catch(() => {
      setLinkDone(true); // em caso de erro, libera mesmo assim para não travar
    });
  }, [user, linkDone]);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["portal-student", user?.id],
    enabled: !!user && linkDone,  // só roda APÓS o RPC concluir
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
      loading: authLoading || !linkDone || isLoading,
      unlinked: !!user && linkDone && !isLoading && !data,
      refetch: () => { void refetch(); },
    }),
    [data, authLoading, linkDone, isLoading, user, refetch],
  );

  return <StudentPortalContext.Provider value={value}>{children}</StudentPortalContext.Provider>;
}

export function useStudentPortal() {
  const ctx = useContext(StudentPortalContext);
  if (!ctx) throw new Error("useStudentPortal must be used within StudentPortalProvider");
  return ctx;
}
