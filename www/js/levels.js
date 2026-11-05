// Gerador procedural de fases com dificuldade progressiva.
//
// Estratégia que GARANTE solução:
//  1. Monta um tabuleiro já resolvido (nenhuma corda cruzando).
//  2. "Embaralha" movendo pontas para furos vazios (movimentos reversíveis).
//  3. O caminho inverso do embaralhamento é uma solução => "par" de jogadas.

import { Rng, hashSeed } from './rng.js';
import { conflictPoint, pointOnSegment, sweep, tangleTotal, touchingCount, pegPoints } from './core.js';

export const PALETTE = [
  '#ff4d6d', '#3a86ff', '#38c172', '#ffbe0b', '#9b5de5', '#ff7f11',
  '#00bbf9', '#f15bb5', '#8ac926', '#6c757d', '#e63946', '#2ec4b6',
  '#b5838d', '#4361ee', '#c77dff', '#06d6a0',
];

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;

/** Curva de dificuldade. Infinita: depois do teto de cordas, aperta espaço e embaralhamento. */
export function levelParams(n) {
  const t = clamp((n - 1) / 90, 0, 1);
  const ropes = clamp(2 + Math.floor((n - 1) / 4), 2, 16);
  const spare = ropes <= 3 ? 3 : Math.max(2, Math.round(ropes * lerp(0.85, 0.3, t)));
  // grade "retrato" (celular em pé): no máximo 5 colunas, cresce em linhas
  const cols = ropes <= 3 ? 3 : ropes <= 7 ? 4 : 5;
  const cells = ropes * 2 + spare;
  const rows = Math.max(cols, Math.ceil(cells / cols));
  const scramble = clamp(1 + Math.floor((n - 1) / 2.5), 1, ropes + 6);
  // nº de nós desejado no início (a dificuldade vem da ORDEM de desenrolar, não do volume)
  const targetKnots = Math.max(1, Math.round(ropes * lerp(0.5, 1.5, t)));
  const minConflicts = Math.max(1, Math.round(targetKnots * 0.6));
  const maxMove = lerp(2.2, 4.5, t); // arrastes curtos = enroscos locais
  const maxLen = lerp(1.6, 5, t);
  // chave de tradução do nível (ver i18n.js)
  let tier = 'easy';
  if (n > 12) tier = 'medium';
  if (n > 30) tier = 'hard';
  if (n > 60) tier = 'expert';
  if (n > 100) tier = 'master';
  // quão "agressivo" é o embaralhamento (amostras por passo): 2 no início, 10 no fim
  const greed = Math.round(lerp(2, 10, t));
  return { n, ropes, spare, cols, rows, cells, scramble, targetKnots, minConflicts, maxMove, maxLen, greed, tier };
}

function buildSolved(p, rng) {
  // Furos: grade cols x rows, removendo células aleatórias até sobrar "cells"
  const all = [];
  for (let y = 0; y < p.rows; y++) for (let x = 0; x < p.cols; x++) all.push({ x, y });
  rng.shuffle(all);
  const pegs = all.slice(0, p.cells).sort((a, b) => a.y - b.y || a.x - b.x);

  const free = new Set(pegs.map((_, i) => i));
  const ends = [];
  const occupied = new Set();

  for (let r = 0; r < p.ropes; r++) {
    let placed = false;
    for (let attempt = 0; attempt < 60 && !placed; attempt++) {
      const freeArr = [...free];
      const a = rng.pick(freeArr);
      const cands = rng.shuffle(freeArr.filter((b) => {
        if (b === a) return false;
        const d = Math.hypot(pegs[a].x - pegs[b].x, pegs[a].y - pegs[b].y);
        return d >= 1 && d <= p.maxLen;
      }));
      for (const b of cands) {
        const A = pegs[a], B = pegs[b];
        let ok = true;
        // não pode passar por cima de ponta já existente
        for (const o of occupied) if (pointOnSegment(A, B, pegs[o])) { ok = false; break; }
        if (!ok) continue;
        for (const [c, d] of ends) {
          if (conflictPoint(A, B, pegs[c], pegs[d])) { ok = false; break; }
        }
        if (!ok) continue;
        ends.push([a, b]);
        free.delete(a); free.delete(b);
        occupied.add(a); occupied.add(b);
        placed = true;
        break;
      }
    }
    if (!placed) return null;
  }
  return { pegs, ends };
}

// Embaralha com arrastes em linha reta, que ENROLAM as cordas (modelo de core.js).
// Desfazer na ordem inversa, pelo mesmo caminho, sempre resolve.
function scramble(p, rng, pegs, ends) {
  const occ = new Set(ends.flat());
  const K = {};
  const moves = [];
  let conflicts = 0;
  let last = null;
  const maxSteps = p.scramble + 12;
  for (let step = 0; step < maxSteps; step++) {
    if (step >= p.scramble && conflicts >= p.minConflicts) break;
    if (conflicts >= p.targetKnots && step >= Math.ceil(p.scramble / 2)) break;
    const empties = pegs.map((_, i) => i).filter((i) => !occ.has(i));
    const base = pegPoints(pegs, ends);
    let best = null;
    for (let s = 0; s < p.greed + 4; s++) {
      const rope = rng.int(0, ends.length - 1);
      const end = rng.int(0, 1);
      const here = pegs[ends[rope][end]];
      const near = empties.filter((i) => Math.hypot(pegs[i].x - here.x, pegs[i].y - here.y) <= p.maxMove);
      if (!near.length) continue;
      const to = rng.pick(near);
      if (last && last.rope === rope && last.end === end) continue; // evita mover a mesma ponta 2x seguidas
      const K2 = { ...K };
      const P = base.map((pair) => pair.map((q) => ({ ...q })));
      sweep(P, K2, rope, end, pegs[to]);
      const from = ends[rope][end];
      ends[rope][end] = to;
      const c = tangleTotal(K2) + touchingCount(pegs, ends);
      ends[rope][end] = from;
      // aproxima do alvo de nós; acima do alvo é penalizado
      const score = -Math.abs(c - p.targetKnots) + rng.float() * 1.5;
      if (!best || score > best.score) best = { rope, end, from, to, c, score, K: K2 };
    }
    if (!best) continue;
    ends[best.rope][best.end] = best.to;
    occ.delete(best.from); occ.add(best.to);
    for (const k of Object.keys(K)) delete K[k];
    Object.assign(K, best.K);
    conflicts = best.c;
    moves.push({ rope: best.rope, end: best.end, from: best.from, to: best.to });
    last = best;
  }
  return { moves, conflicts, K };
}

/** Busca exata do mínimo de jogadas (arrastes retos), só para fases pequenas. */
function exactPar(pegs, ends, K, upper) {
  const R = ends.length, E = pegs.length - R * 2;
  const b = 2 * R * E;
  const dfs = (ends, K, depth, lastR, lastE) => {
    if (tangleTotal(K) + touchingCount(pegs, ends) === 0) return true;
    if (depth === 0) return false;
    const occ = new Set(ends.flat());
    for (let r = 0; r < R; r++) for (let e = 0; e < 2; e++) {
      if (r === lastR && e === lastE) continue;
      for (let to = 0; to < pegs.length; to++) {
        if (occ.has(to)) continue;
        const K2 = { ...K };
        sweep(pegPoints(pegs, ends), K2, r, e, pegs[to]);
        const e2 = ends.map((x) => x.slice());
        e2[r][e] = to;
        if (dfs(e2, K2, depth - 1, r, e)) return true;
      }
    }
    return false;
  };
  // procura soluções curtas enquanto a busca for barata; senão fica o limite superior
  for (let d = 1; d < upper && Math.pow(b, d) * R <= 40000; d++) if (dfs(ends, K, d, -1, -1)) return d;
  return upper;
}

const cache = new Map();

/**
 * Gera (de forma determinística) a fase n.
 * salt != 0 cria uma variação diferente com a MESMA dificuldade (usado no desafio diário).
 */
export function generateLevel(n, salt = 0) {
  const key = `${n}:${salt}`;
  if (cache.has(key)) return JSON.parse(JSON.stringify(cache.get(key)));
  const p = levelParams(n);
  for (let attempt = 0; attempt < 400; attempt++) {
    const rng = new Rng(salt ? hashSeed(0xDA1E, salt, n, attempt) : hashSeed(0xC0DA, n, attempt));
    const solved = buildSolved(p, rng);
    if (!solved) continue;
    const { pegs, ends } = solved;
    const solution = ends.map((e) => e.slice());
    const { moves, conflicts, K } = scramble(p, rng, pegs, ends);
    if (conflicts === 0) continue;
    if (conflicts < p.minConflicts && attempt < 300) continue;

    const par = exactPar(pegs, ends.map((e) => e.slice()), K, moves.length);
    const colors = rng.shuffle(PALETTE.map((_, i) => i)); // índices: o tema escolhe a cor
    const level = {
      n,
      tier: p.tier,
      cols: p.cols,
      rows: p.rows,
      pegs,
      ropes: ends.map((e, i) => ({ c: colors[i % colors.length], a: e[0], b: e[1] })),
      twists: K,              // voltas iniciais entre pares de cordas ("i,j": n)
      par,
      solution,               // tabuleiro resolvido de origem
      // desfazer estes arrastes (do último ao primeiro, de "to" para "from") resolve
      solutionMoves: moves.slice().reverse().map((m) => ({ rope: m.rope, end: m.end, to: m.from })),
      scrambleMoves: moves.length,
      startConflicts: conflicts,
    };
    cache.set(key, level);
    return JSON.parse(JSON.stringify(level));
  }
  throw new Error('Falha ao gerar fase ' + n);
}

// ------------------------------------------------------------ desafio diário
export function todayKey(d = new Date()) {
  const p = (x) => String(x).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** Dificuldade sobe ao longo da semana: segunda mais leve, domingo mais pesado. */
export function dailyDifficulty(dateKey) {
  const [y, m, d] = dateKey.split('-').map(Number);
  const dow = (new Date(y, m - 1, d).getDay() + 6) % 7; // 0 = segunda
  return 16 + dow * 5;                                   // equivale às fases 16..46
}

export function generateDaily(dateKey) {
  const salt = Number(dateKey.replace(/-/g, '')); // ex.: 20261105
  const level = generateLevel(dailyDifficulty(dateKey), salt);
  level.daily = dateKey;
  return level;
}
