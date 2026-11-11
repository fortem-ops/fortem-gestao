// Rótulo do aviso interno de compra recusada. Corrida só quando há inscrição da Corrida ligada à venda.
export type ContextoRecusa = {
  fluxo: "loja" | "corrida";
  venda_id?: string | null;
  pedido_id?: string | null;
  tem_inscricao_corrida: boolean;
  item_venda?: { familia?: string | null; nome?: string | null } | null;
};

const FAMILIAS: Record<string, string> = {
  semestral_2027: "Plano Semestral", start_2027: "Plano Start", power_2027: "Plano Power", pro_2027: "Plano Pro",
};

export function rotuloRecusa(c: ContextoRecusa): { fluxoLabel: string; referencia: string } {
  if (c.pedido_id) return { fluxoLabel: "Loja", referencia: `Pedido da Loja ${c.pedido_id}` };
  if (c.venda_id && (c.tem_inscricao_corrida || c.fluxo === "corrida")) return { fluxoLabel: "Corrida", referencia: `Inscrição da Corrida (venda ${c.venda_id})` };
  if (c.venda_id) {
    const grupo = (c.item_venda?.familia && FAMILIAS[c.item_venda.familia]) || "Venda";
    const nome = c.item_venda?.nome ?? "";
    return { fluxoLabel: grupo, referencia: `${nome ? `${grupo} · ${nome}` : grupo} (venda ${c.venda_id})` };
  }
  return c.fluxo === "corrida"
    ? { fluxoLabel: "Corrida", referencia: "Inscrição da Corrida" }
    : { fluxoLabel: "Loja", referencia: "Compra na Loja" };
}
