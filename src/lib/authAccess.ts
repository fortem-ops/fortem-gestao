import { supabase } from "@/integrations/supabase/client";
import { registrarDiag } from "@/lib/diagnosticoApp";

export const STAFF_ROLES = [
  "admin",
  "coordenador",
  "professor",
  "nutricionista",
  "fisioterapeuta",
] as const;

export type StatusPapel = "equipe" | "nao_equipe" | "erro";
export interface ResultadoPapel {
  status: StatusPapel;
  papeis: string[];
  tentativas: number;
  motivo?: string;
}

export interface DepsPapel {
  /** Sessão confirmada no servidor (token válido) ou null. */
  sessaoConfirmada: () => Promise<{ userId: string } | null>;
  renovar: () => Promise<void>;
  /** Todos os papéis do usuário; lança em erro do banco. */
  papeis: (userId: string) => Promise<string[]>;
  esperar: (ms: number) => Promise<void>;
  registrar: (ev: Record<string, unknown>) => void;
}

export const TENTATIVAS_PAPEL = 3;

/**
 * Checa se o usuário é da equipe sem nunca concluir "não é equipe" por engano:
 * - sem sessão confirmada = erro (consulta sem token devolve lista vazia pela RLS);
 * - lista vazia = renova a sessão e tenta de novo; só na última conclui "não é equipe".
 */
export async function checarPapelEquipe(userId: string, deps: DepsPapel = depsPadrao): Promise<ResultadoPapel> {
  let ultimo: ResultadoPapel = { status: "erro", papeis: [], tentativas: 0, motivo: "nao_iniciado" };
  for (let i = 1; i <= TENTATIVAS_PAPEL; i++) {
    const final = i === TENTATIVAS_PAPEL;
    let sessao: { userId: string } | null = null;
    try {
      sessao = await deps.sessaoConfirmada();
    } catch {
      sessao = null;
    }
    if (!sessao || sessao.userId !== userId) {
      ultimo = { status: "erro", papeis: [], tentativas: i, motivo: sessao ? "sessao_de_outro_usuario" : "sem_sessao_confirmada" };
      deps.registrar({ tipo: "checagem_papel", tentativa: i, sessao_confirmada: false, resultado: "erro", erro: ultimo.motivo });
    } else {
      try {
        const papeis = await deps.papeis(userId);
        const equipe = papeis.some((p) => (STAFF_ROLES as readonly string[]).includes(p));
        deps.registrar({ tipo: "checagem_papel", tentativa: i, sessao_confirmada: true, papeis, resultado: equipe ? "equipe" : papeis.length ? "nao_equipe" : "lista_vazia" });
        if (equipe) return { status: "equipe", papeis, tentativas: i };
        // Algum papel lido (ex.: aluno) = a RLS respondeu de verdade: não é equipe.
        if (papeis.length > 0 || final) return { status: "nao_equipe", papeis, tentativas: i };
        ultimo = { status: "nao_equipe", papeis, tentativas: i };
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        ultimo = { status: "erro", papeis: [], tentativas: i, motivo: msg.slice(0, 80) };
        deps.registrar({ tipo: "checagem_papel", tentativa: i, sessao_confirmada: true, resultado: "erro", erro: ultimo.motivo });
      }
    }
    if (!final) {
      try {
        await deps.renovar();
      } catch {
        /* tenta de novo mesmo assim */
      }
      await deps.esperar(600 * i);
    }
  }
  return ultimo;
}

const depsPadrao: DepsPapel = {
  sessaoConfirmada: async () => {
    const { data } = await supabase.auth.getSession();
    let session = data.session;
    if (!session) return null;
    const expiraMs = (session.expires_at ?? 0) * 1000;
    if (expiraMs - Date.now() < 60_000) {
      const r = await supabase.auth.refreshSession();
      session = r.data.session;
      if (!session) return null;
    }
    const { data: u, error } = await supabase.auth.getUser();
    if (error || !u.user) return null;
    return { userId: u.user.id };
  },
  renovar: async () => {
    await supabase.auth.refreshSession();
  },
  papeis: async (userId) => {
    const { data, error } = await supabase.from("user_roles").select("role").eq("user_id", userId);
    if (error) throw error;
    return (data ?? []).map((r) => String(r.role));
  },
  esperar: (ms) => new Promise((r) => setTimeout(r, ms)),
  registrar: registrarDiag,
};

/** true = equipe, false = confirmado que não é equipe; lança se não deu para confirmar. */
export async function userHasStaffAccess(userId: string): Promise<boolean> {
  const r = await checarPapelEquipe(userId);
  if (r.status === "erro") throw new Error(r.motivo ?? "checagem_papel_falhou");
  return r.status === "equipe";
}

/** Tela de Usuários: mostra equipe e quem não tem papel; quem é só aluno não aparece. */
export function usuarioApareceNaEquipe(roles: readonly string[]): boolean {
  if (roles.length === 0) return true;
  return roles.some((r) => (STAFF_ROLES as readonly string[]).includes(r));
}
