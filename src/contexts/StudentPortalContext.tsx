import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./AuthContext";
import type { Tables } from "@/integrations/supabase/types";
import type { SomenteOnline } from "@/lib/portalAgenda";

interface StudentPortalContextType {
  student: Tables<"alunos"> | null;
  loading: boolean;
  unlinked: boolean;
  refetch: () => void;
  /** true só quando confirmado "só Consultoria Online"; null = carregando/erro. */
  somenteOnline?: SomenteOnline;
  somenteOnlineLoading?: boolean;
}

const StudentPortalContext = createContext<StudentPortalContextType | undefined>(undefined);

export function StudentPortalProvider({ children }: { children: ReactNode }) {
  const { user, loading: authLoading } = useAuth();
  const [linkDone, setLinkDone] = useState(false);

  // Chama o RPC e só libera a query quando ele terminar (await real).
  useEffect(() => {
    if (!user || linkDone) return;
    void (async () => {
      try {
        await supabase.rpc("fn_portal_link_aluno");
      } catch {
        // em caso de erro, libera mesmo assim para não travar
      } finally {
        setLinkDone(true);
      }
    })();
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

  // E5a: aluno só Consultoria Online? Erro = null (comportamento atual).
  const alunoId = data?.id;
  const { data: somenteOnlineData, isLoading: somenteOnlineLoading, isError: somenteOnlineErro } = useQuery({
    queryKey: ["portal-somente-online", alunoId],
    enabled: !!alunoId,
    staleTime: 60_000,
    refetchOnWindowFocus: true,
    retry: 1,
    queryFn: async () => {
      const { data: r, error } = await supabase.rpc("fn_aluno_somente_online", { p_aluno_id: alunoId! });
      if (error) throw error;
      return r === true;
    },
  });
  const somenteOnline: SomenteOnline = somenteOnlineErro || somenteOnlineData === undefined ? null : somenteOnlineData;

  const value = useMemo<StudentPortalContextType>(
    () => ({
      student: data ?? null,
      loading: authLoading || !linkDone || isLoading,
      unlinked: !!user && linkDone && !isLoading && !data,
      refetch: () => { void refetch(); },
      somenteOnline,
      somenteOnlineLoading: !!alunoId && somenteOnlineLoading,
    }),
    [data, authLoading, linkDone, isLoading, user, refetch, somenteOnline, alunoId, somenteOnlineLoading],
  );

  return <StudentPortalContext.Provider value={value}>{children}</StudentPortalContext.Provider>;
}

export function useStudentPortal() {
  const ctx = useContext(StudentPortalContext);
  if (!ctx) throw new Error("useStudentPortal must be used within StudentPortalProvider");
  return ctx;
}

/** Versão segura fora do Portal (retorna undefined na loja pública). */
export function useStudentPortalOptional() {
  return useContext(StudentPortalContext);
}

