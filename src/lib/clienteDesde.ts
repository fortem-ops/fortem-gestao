// "Cliente desde": o menor planos.data_inicio prevalece; sem plano, usa alunos.aluno_desde (data manual).
export function dataClienteDesde(menorInicioPlano: string | null | undefined, alunoDesde: string | null | undefined): string | null {
  const p = menorInicioPlano ? menorInicioPlano.slice(0, 10) : null;
  if (p) return p;
  return alunoDesde ? alunoDesde.slice(0, 10) : null;
}

/** Menor data_inicio por aluno (datas ISO "aaaa-mm-dd" comparam como texto). */
export function menorInicioPorAluno(rows: { aluno_id: string; data_inicio: string | null }[]): Record<string, string> {
  const m: Record<string, string> = {};
  for (const r of rows) {
    if (!r.data_inicio) continue;
    const d = r.data_inicio.slice(0, 10);
    if (!m[r.aluno_id] || d < m[r.aluno_id]) m[r.aluno_id] = d;
  }
  return m;
}

function iso(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Filtro de intervalo (inclusivo). Com algum limite preenchido, quem não tem data fica de fora. */
export function matchClienteDesde(data: string | null, de?: Date, ate?: Date): boolean {
  if (!de && !ate) return true;
  if (!data) return false;
  if (de && data < iso(de)) return false;
  if (ate && data > iso(ate)) return false;
  return true;
}
