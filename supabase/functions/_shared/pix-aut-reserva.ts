// Venda reservada ao Pix Automático do mês: nenhum caminho de cartão pode cobrar.
// deno-lint-ignore no-explicit-any
export async function vendaReservadaPix(sup: any, vendaId: string): Promise<boolean> {
  const { data, error } = await sup.rpc("fn_pix_aut_venda_reservada", { p_venda: vendaId });
  if (error) throw new Error(`Falha ao conferir reserva Pix: ${error.message}`);
  return data === true;
}
export const MSG_RESERVA_PIX = "Esta mensalidade está reservada ao Pix Automático do mês e não pode ser cobrada no cartão.";
