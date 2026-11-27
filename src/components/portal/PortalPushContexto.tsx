import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "react-router-dom";
import { useStudentPortal } from "@/contexts/StudentPortalContext";
import { supabase } from "@/integrations/supabase/client";
import { PortalPushIncentivo } from "./PortalPushIncentivo";

export function PortalPushContexto() {
  const { student } = useStudentPortal();
  const { pathname } = useLocation();
  const qc = useQueryClient();
  const [entrouFila, setEntrouFila] = useState(false);
  const ids = useRef<Set<string> | null>(null);
  const documentos = pathname === "/portal/contratos";
  useEffect(() => {
    ids.current = null;
    setEntrouFila(false);
    const observar = () => {
      const filas = qc.getQueryData<{ id: string }[]>(["portal-fila-espera", student?.id]);
      if (!filas) return;
      const novos = new Set(filas.map(f => f.id));
      if (ids.current && [...novos].some(id => !ids.current?.has(id))) setEntrouFila(true);
      ids.current = novos;
    };
    observar();
    return qc.getQueryCache().subscribe(event => {
      if (event.query.queryKey[0] === "portal-fila-espera" && event.query.queryKey[1] === student?.id) observar();
    });
  }, [qc, student?.id]);
  const pendencias = useQuery({
    queryKey: ["portal-push-contexto-documentos", student?.id],
    enabled: documentos && !!student,
    queryFn: async () => {
      if (!student) return false;
      const [docs, anexo] = await Promise.all([
        supabase.from("contratos_documentos").select("id").eq("aluno_id", student.id).eq("aceite", false).limit(1),
        supabase.from("legal_annexes").select("id").eq("aluno_id", student.id).not("signed_at", "is", null).limit(1),
      ]);
      if (docs.error) throw docs.error;
      if (anexo.error) throw anexo.error;
      return !!docs.data?.length || !anexo.data?.length;
    },
  });
  return (pathname === "/portal/agenda" && entrouFila) || (documentos && pendencias.data) ? <PortalPushIncentivo modo="contexto" /> : null;
}
