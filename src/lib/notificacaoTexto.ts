/**
 * Ajustes só de EXIBIÇÃO no texto das notificações (o texto gravado não muda).
 * O aviso de inadimplência 2027 junta família + frequência; na Consultoria a
 * frequência do catálogo é "livre", que não faz sentido para o plano online.
 */
export function descricaoNotificacaoExibicao(descricao: string | null | undefined): string {
  if (!descricao) return descricao ?? "";
  return descricao.split("Consultoria Online livre").join("Consultoria Online");
}
