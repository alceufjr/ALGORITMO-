// Geometria exata (coordenadas inteiras da grade) e análise de cruzamentos.

function orient(a, b, c) {
  const v = (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
  return v > 0 ? 1 : v < 0 ? -1 : 0;
}

// p é colinear com ab e está estritamente entre a e b?
function strictlyInside(a, b, p) {
  if (p.x === a.x && p.y === a.y) return false;
  if (p.x === b.x && p.y === b.y) return false;
  return (
    Math.min(a.x, b.x) <= p.x && p.x <= Math.max(a.x, b.x) &&
    Math.min(a.y, b.y) <= p.y && p.y <= Math.max(a.y, b.y)
  );
}

export function pointOnSegment(a, b, p) {
  return orient(a, b, p) === 0 && strictlyInside(a, b, p);
}

/**
 * Duas cordas "conflitam" se:
 *  - se cruzam propriamente, ou
 *  - a ponta de uma encosta no meio da outra (inclui sobreposição colinear).
 * Retorna o ponto de conflito (float) ou null.
 */
export function conflictPoint(a, b, c, d) {
  const o1 = orient(a, b, c), o2 = orient(a, b, d);
  const o3 = orient(c, d, a), o4 = orient(c, d, b);
  if (o1 * o2 < 0 && o3 * o4 < 0) {
    const den = (a.x - b.x) * (c.y - d.y) - (a.y - b.y) * (c.x - d.x);
    const t = ((a.x - c.x) * (c.y - d.y) - (a.y - c.y) * (c.x - d.x)) / den;
    return { x: a.x + t * (b.x - a.x), y: a.y + t * (b.y - a.y) };
  }
  if (o1 === 0 && strictlyInside(a, b, c)) return { x: c.x, y: c.y };
  if (o2 === 0 && strictlyInside(a, b, d)) return { x: d.x, y: d.y };
  if (o3 === 0 && strictlyInside(c, d, a)) return { x: a.x, y: a.y };
  if (o4 === 0 && strictlyInside(c, d, b)) return { x: b.x, y: b.y };
  return null;
}

/**
 * Analisa o tabuleiro.
 * @param pegs  [{x,y}]
 * @param ends  [[pegA, pegB], ...] uma entrada por corda
 * @returns {total, perRope:number[], points:[{x,y,a,b}]}
 */
export function analyze(pegs, ends, withPoints = false) {
  const n = ends.length;
  const perRope = new Array(n).fill(0);
  const points = [];
  let total = 0;
  for (let i = 0; i < n; i++) {
    const a = pegs[ends[i][0]], b = pegs[ends[i][1]];
    for (let j = i + 1; j < n; j++) {
      const c = pegs[ends[j][0]], d = pegs[ends[j][1]];
      const p = conflictPoint(a, b, c, d);
      if (p) {
        total++; perRope[i]++; perRope[j]++;
        if (withPoints) points.push({ x: p.x, y: p.y, a: i, b: j });
      }
    }
  }
  return { total, perRope, points };
}

// Conta apenas o total (rápido, usado pelo gerador e pela dica).
export function countConflicts(pegs, ends) {
  let total = 0;
  for (let i = 0; i < ends.length; i++) {
    const a = pegs[ends[i][0]], b = pegs[ends[i][1]];
    for (let j = i + 1; j < ends.length; j++) {
      if (conflictPoint(a, b, pegs[ends[j][0]], pegs[ends[j][1]])) total++;
    }
  }
  return total;
}

// ===========================================================================
// MODELO DE NÓS (por cima / por baixo)
// ---------------------------------------------------------------------------
// Um nó é um par de cordas que se CRUZA (sempre visível). K["i,j"] guarda só
// quem passa por cima (+1: corda i, -1: corda j). A corda arrastada passa por
// cima ao criar um cruzamento. Quando as cordas deixam de se cruzar, o nó some.
// ===========================================================================
const EPS = 1e-9;
// empate (colinear) conta como +1: perturbação simbólica, mantém tudo consistente
const sgn = (v) => (v > EPS ? 1 : v < -EPS ? -1 : 1);
const ori = (a, b, c) => sgn((b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x));

export function straightCross(a, b, c, d) {
  return ori(a, b, c) * ori(a, b, d) < 0 && ori(c, d, a) * ori(c, d, b) < 0;
}
export const pairKey = (i, j) => (i < j ? `${i},${j}` : `${j},${i}`);

/**
 * Move a ponta `e` da corda `r` até `to` em passos pequenos, atualizando K.
 * P: [[{x,y},{x,y}], ...] posições atuais (é alterado). Coordenadas da grade.
 */
export function sweep(P, K, r, e, to, step = 0.06) {
  const from = P[r][e];
  const dx = to.x - from.x, dy = to.y - from.y;
  const n = Math.max(1, Math.ceil(Math.hypot(dx, dy) / step));
  for (let s = 1; s <= n; s++) {
    const prev = P[r][e];
    const next = s === n ? { x: to.x, y: to.y } : { x: from.x + (dx * s) / n, y: from.y + (dy * s) / n };
    for (let q = 0; q < P.length; q++) {
      if (q === r) continue;
      const i = Math.min(r, q), j = Math.max(r, q);
      const before = straightCross(P[r][0], P[r][1], P[q][0], P[q][1]);
            P[r][e] = next;
      const after = straightCross(P[r][0], P[r][1], P[q][0], P[q][1]);
      if (before !== after) {
        const key = `${i},${j}`;
        if (after) {
          // nasce um nó VISÍVEL: a corda que se move passa por cima
          K[key] = r === i ? 1 : -1;
        } else {
          // deixaram de se cruzar: o nó se desfaz (nunca fica nó escondido)
          delete K[key];
        }
      }
      P[r][e] = prev;
    }
    P[r][e] = next;
  }
}

/** Nº de nós = nº de pares de cordas que se cruzam (cada cruzamento é 1 nó visível). */
export const tangleTotal = (K) => Object.values(K).filter((v) => v !== 0).length;

/** Pontas pousadas exatamente sobre outra corda (situação ambígua: também conta como nó). */
export function touchingCount(pegs, ends) {
  return touchingPegs(pegs, ends).length;
}

/** Furos cuja bolinha está pousada sobre outra corda (cada um conta como nó). */
export function touchingPegs(pegs, ends) {
  const out = [];
  for (let i = 0; i < ends.length; i++) {
    for (let j = 0; j < ends.length; j++) {
      if (i === j) continue;
      const a = pegs[ends[j][0]], b = pegs[ends[j][1]];
      for (const p of ends[i]) if (pointOnSegment(a, b, pegs[p])) out.push(p);
    }
  }
  return out;
}

export const pegPoints = (pegs, ends) => ends.map(([a, b]) => [{ ...pegs[a] }, { ...pegs[b] }]);
