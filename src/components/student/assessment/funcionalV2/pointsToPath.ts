/** Converte uma lista de pontos [x,y] numa curva suave fechada (Catmull-Rom → Bézier). */
export function pointsToSmoothPath(points: Array<[number, number]>): string {
  const n = points.length;
  if (n < 3) return "";
  const wrap = (i: number) => points[((i % n) + n) % n];
  let d = `M ${points[0][0]} ${points[0][1]} `;
  for (let i = 0; i < n; i++) {
    const p0 = wrap(i - 1);
    const p1 = wrap(i);
    const p2 = wrap(i + 1);
    const p3 = wrap(i + 2);
    const cp1x = p1[0] + (p2[0] - p0[0]) / 6;
    const cp1y = p1[1] + (p2[1] - p0[1]) / 6;
    const cp2x = p2[0] - (p3[0] - p1[0]) / 6;
    const cp2y = p2[1] - (p3[1] - p1[1]) / 6;
    d += `C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p2[0]} ${p2[1]} `;
  }
  return d + "Z";
}

/** Acha o índice de inserção (entre i e i+1) que menos alonga o contorno ao inserir um novo ponto. */
export function bestInsertionIndex(points: Array<[number, number]>, p: [number, number]): number {
  const n = points.length;
  let bestI = 0;
  let bestExtra = Infinity;
  const dist = (a: [number, number], b: [number, number]) => Math.hypot(a[0] - b[0], a[1] - b[1]);
  for (let i = 0; i < n; i++) {
    const a = points[i];
    const b = points[(i + 1) % n];
    const extra = dist(a, p) + dist(p, b) - dist(a, b);
    if (extra < bestExtra) {
      bestExtra = extra;
      bestI = i + 1;
    }
  }
  return bestI;
}
