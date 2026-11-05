// =============================================================================
// Geometria das cordas — SÓ cálculo, nada de desenho.
// -----------------------------------------------------------------------------
// Cada corda é um segmento RETO entre as duas bolinhas (pontos fixos). Nunca é
// deformada, suavizada ou encurtada: assim ela sempre parece esticada e o que se
// vê é exatamente o que conta para a regra do jogo.
// Os cruzamentos são calculados à parte, com quem passa por cima e por baixo;
// o renderizador usa isso só para a ordem de desenho e a profundidade visual.
// =============================================================================

/** Interseção própria de dois segmentos (t, u = posição ao longo de cada um, 0..1). */
function intersect(a, b, c, d) {
  const rx = b.x - a.x, ry = b.y - a.y, sx = d.x - c.x, sy = d.y - c.y;
  const den = rx * sy - ry * sx;
  if (Math.abs(den) < 1e-9) return null;
  const t = ((c.x - a.x) * sy - (c.y - a.y) * sx) / den;
  const u = ((c.x - a.x) * ry - (c.y - a.y) * rx) / den;
  if (t <= 0 || t >= 1 || u <= 0 || u >= 1) return null;
  return { x: a.x + t * rx, y: a.y + t * ry, t, u };
}

/**
 * @param pos   {id: [a, b]}  pontas de cada corda na tela
 * @param over  (i, j) => id da corda que passa POR CIMA no cruzamento i×j
 *              (vem do modelo do jogo; sem informação, a mais recente)
 * @returns {
 *   segments:  {id: {a, b, len}}              — segmentos retos
 *   crossings: [{x, y, over, under, tOver, tUnder}]
 * }
 */
export function ropeGeometry(pos, over) {
  const segments = {};
  for (const [id, [a, b]] of Object.entries(pos)) {
    segments[id] = { a: { x: a.x, y: a.y }, b: { x: b.x, y: b.y }, len: Math.hypot(b.x - a.x, b.y - a.y) };
  }
  const ids = Object.keys(segments).map(Number).sort((x, y) => x - y);
  const crossings = [];
  for (let x = 0; x < ids.length; x++) {
    for (let y = x + 1; y < ids.length; y++) {
      const i = ids[x], j = ids[y];
      const A = segments[i], B = segments[j];
      const p = intersect(A.a, A.b, B.a, B.b);
      if (!p) continue;
      const top = over(i, j);
      crossings.push({
        x: p.x, y: p.y,
        over: top, under: top === i ? j : i,
        tOver: top === i ? p.t : p.u, tUnder: top === i ? p.u : p.t,
      });
    }
  }
  return { segments, crossings };
}
