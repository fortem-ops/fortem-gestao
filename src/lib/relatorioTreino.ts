export function destinoRelatorioTreino(alunoId: string, treinoId: string, fase: string | null): string {
  const protocolo = fase?.toLowerCase().includes("corrida") ? "Treinos de corrida" : "Treinos de força";
  return `/avaliacoes?${new URLSearchParams({ aluno: alunoId, new: "1", tipo: "relatorioforca", protocolo, treino: treinoId })}`;
}