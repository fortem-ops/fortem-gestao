import { casaPorNome } from "./index.ts";
Deno.test("nome", () => {
  if (!casaPorNome("PIX ENVIADO - Cp :18236120-Thais dos Santos Bobroski", "Thaís dos Santos")) throw new Error("deveria casar");
  if (casaPorNome("PIX ENVIADO - Cp :1-Joao Silva", "Salário Maria Souza (09/2026)")) throw new Error("não deveria");
  if (casaPorNome("PIX ENVIADO pagamento", "Pagamento aluguel")) throw new Error("stopword");
});
