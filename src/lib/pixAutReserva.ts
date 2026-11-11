import { supabase } from "@/integrations/supabase/client";

export type LinhaReserva = { id: string; pix_aut_grupo_id: string | null };

/** Ids de cobranças reservadas ao Pix Automático do mês (precisam de confirmação antes da baixa manual). */
export function reservadasPix(linhas: LinhaReserva[]): string[] {
  return linhas.filter((l) => l.pix_aut_grupo_id !== null).map((l) => l.id);
}

export function mensagemConfirmacaoReserva(qtd: number): string {
  const alvo = qtd === 1 ? "Esta mensalidade está reservada" : `${qtd} mensalidades estão reservadas`;
  return `${alvo} ao Pix Automático do mês. Se a cobrança já foi enviada ao Inter, o débito pode acontecer mesmo assim e será preciso cancelar no Inter ou estornar. Liberar a reserva e dar baixa manual?`;
}

/**
 * Antes da baixa manual: se alguma cobrança estiver reservada ao Pix, pede confirmação e libera a reserva
 * no servidor (só admin). Devolve false quando a equipe desiste.
 */
export async function confirmarBaixaReservadaPix(
  cobrancaIds: string[],
  confirmar: (msg: string) => boolean = (m) => window.confirm(m),
): Promise<boolean> {
  if (!cobrancaIds.length) return true;
  const { data, error } = await supabase.from("cobrancas").select("id, pix_aut_grupo_id").in("id", cobrancaIds);
  if (error) throw error;
  const ids = reservadasPix((data ?? []) as LinhaReserva[]);
  if (!ids.length) return true;
  if (!confirmar(mensagemConfirmacaoReserva(ids.length))) return false;
  for (const id of ids) {
    const { error: e } = await supabase.rpc("fn_pix_aut_liberar_reserva", { p_tabela: "cobrancas", p_id: id, p_motivo: "baixa manual confirmada" });
    if (e) throw new Error(e.message.includes("sem_permissao") ? "Só admin pode liberar a reserva do Pix Automático." : e.message);
  }
  return true;
}
