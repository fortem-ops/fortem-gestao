// Decide quem pode chamar as funções de push (puro, testado no vitest).

export interface Chamador {
  /** Bearer igual à chave de serviço do projeto. */
  chaveServico: boolean;
  /** x-webhook-secret igual ao segredo das rotinas (cron). */
  segredoRotina: boolean;
  /** Usuário autenticado: tem papel de equipe e perfil ativo. null = sem usuário válido. */
  usuario: { staff: boolean; ativo: boolean } | null;
}

export type Acesso = "servidor" | "staff" | "negado";

export function decidirChamador(c: Chamador): Acesso {
  if (c.chaveServico || c.segredoRotina) return "servidor";
  if (c.usuario?.staff && c.usuario.ativo) return "staff";
  return "negado";
}
