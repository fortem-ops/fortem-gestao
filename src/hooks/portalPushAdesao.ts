export function calcularAdesaoPush(ativos: readonly string[], inscritos: readonly string[]) {
  const comPush = new Set(inscritos);
  const alunos = new Set(ativos);
  const total = alunos.size;
  const quantidade = [...alunos].filter(id => comPush.has(id)).length;
  return { total, quantidade, percentual: total ? quantidade / total * 100 : 0 };
}

