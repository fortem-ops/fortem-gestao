// Botão "Cobrar" na mensalidade: só o 1º ciclo de venda manual com cartão recorrente,
// único caminho de cobrança avulsa protegido no servidor (reserva + liquidação atômica).
export function podeCobrarPrimeiroCiclo(p: {
  isAdmin: boolean;
  status: string;
  numeroCiclo: number;
  formaContrato: string | null | undefined;
  tentativas: number;
}): boolean {
  return (
    p.isAdmin &&
    ["pendente", "atrasado"].includes(p.status) &&
    p.numeroCiclo === 1 &&
    p.formaContrato === "cartao_recorrencia"
  );
}
