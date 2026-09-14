// Cupom 20OFF visível até 27/09 (23:59, horário de Brasília).
export const CUPOM_20OFF_LIMITE = Date.UTC(2026, 8, 28, 2, 59, 59);

export const cupom20Vigente = () => Date.now() <= CUPOM_20OFF_LIMITE;
