// Gerador procedural de fases com dificuldade progressiva.
//
// Estratégia que GARANTE solução:
//  1. Monta um tabuleiro já resolvido (nenhuma corda cruzando).
//  2. "Embaralha" movendo pontas para furos vazios (movimentos reversíveis).
//  3. O caminho inverso do embaralhamento é uma solução => "par" de jogadas.

import { Rng, hashSeed } from './rng.js';
import { conflictPoint, pointOnSegment, countConflicts } from './core.js';

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
  const scramble = clamp(1 + Math.floor((n - 1) / 2.2), 1, ropes + 8);
  const minConflicts = Math.max(1, Math.floor(ropes * lerp(0.5, 1.4, t)));
  const maxLen = lerp(1.6, 5, t);
  let tier = 'Fácil';
  if (n > 12) tier = 'Médio';
  if (n > 30) tier = 'Difícil';
  if (n > 60) tier = 'Expert';
  if (n > 100) tier = 'Mestre';
  // quão "agressivo" é o embaralhamento (amostras por passo): 2 no início, 10 no fim
  const greed = Math.round(lerp(2, 10, t));
  return { n, ropes, spare, cols, rows, cells, scramble, minConflicts, maxLen, greed, tier };
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

function scramble(p, rng, pegs, ends) {
  const occ = new Set(ends.flat());
  const moves = [];
  let conflicts = 0;
  let last = null;
  const maxSteps = p.scramble + 12;
  for (let step = 0; step < maxSteps; step++) {
    if (step >= p.scramble && conflicts >= p.minConflicts) break;
    const empties = pegs.map((_, i) => i).filter((i) => !occ.has(i));
    let best = null;
    const samples = p.greed;
    for (let s = 0; s < samples; s++) {
      const rope = rng.int(0, ends.length - 1);
      const end = rng.int(0, 1);
      const to = rng.pick(empties);
      if (last && last.rope === rope && last.end === end) continue; // evita mover a mesma ponta 2x seguidas
      const from = ends[rope][end];
      ends[rope][end] = to;
      const c = countConflicts(pegs, ends);
      ends[rope][end] = from;
      const score = c + rng.float() * 0.9;
      if (!best || score > best.score) best = { rope, end, from, to, c, score };
    }
    if (!best) continue;
    ends[best.rope][best.end] = best.to;
    occ.delete(best.from); occ.add(best.to);
    conflicts = best.c;
    moves.push(best);
    last = best;
  }
  return { moves, conflicts };
}

/**
 * Nº de jogadas para levar o tabuleiro atual até a solução conhecida:
 * cada ponta fora do lugar = 1 jogada; cada ciclo de trocas fechado = +1
 * (é preciso "estacionar" uma ponta em furo livre). Escolhe a orientação
 * de cada corda (pontas trocadas ou não) que minimiza o total.
 */
function movesToSolution(ends, solution) {
  const map = new Map(); // peg atual -> peg destino
  for (let i = 0; i < ends.length; i++) {
    const [c0, c1] = ends[i], [s0, s1] = solution[i];
    const keep = (c0 !== s0) + (c1 !== s1);
    const swap = (c0 !== s1) + (c1 !== s0);
    const [t0, t1] = keep <= swap ? [s0, s1] : [s1, s0];
    if (c0 !== t0) map.set(c0, t0);
    if (c1 !== t1) map.set(c1, t1);
  }
  let cycles = 0;
  const seen = new Set();
  for (const start of map.keys()) {
    if (seen.has(start)) continue;
    let cur = start;
    const path = new Set();
    while (map.has(cur) && !seen.has(cur) && !path.has(cur)) { path.add(cur); cur = map.get(cur); }
    if (cur === start) cycles++;
    path.forEach((p) => seen.add(p));
  }
  return map.size + cycles;
}

/** Busca exata (aprofundamento iterativo) do mínimo de jogadas, só p/ fases pequenas. */
function exactPar(pegs, ends, upper) {
  const R = ends.length, E = pegs.length - R * 2;
  const b = 2 * R * E;
  if (Math.pow(b, upper - 1) > 150000) return upper; // grande demais: mantém limite superior
  const occ = new Set(ends.flat());
  const dfs = (depth, lastR, lastE) => {
    if (countConflicts(pegs, ends) === 0) return true;
    if (depth === 0) return false;
    for (let r = 0; r < R; r++) for (let e = 0; e < 2; e++) {
      if (r === lastR && e === lastE) continue;
      const from = ends[r][e];
      for (let to = 0; to < pegs.length; to++) {
        if (occ.has(to)) continue;
        ends[r][e] = to; occ.delete(from); occ.add(to);
        const ok = dfs(depth - 1, r, e);
        ends[r][e] = from; occ.delete(to); occ.add(from);
        if (ok) return true;
      }
    }
    return false;
  };
  for (let d = 1; d < upper; d++) if (dfs(d, -1, -1)) return d;
  return upper;
}

const cache = new Map();

/** Gera (de forma determinística) a fase n. */
export function generateLevel(n) {
  if (cache.has(n)) return JSON.parse(JSON.stringify(cache.get(n)));
  const p = levelParams(n);
  for (let attempt = 0; attempt < 400; attempt++) {
    const rng = new Rng(hashSeed(0xC0DA, n, attempt));
    const solved = buildSolved(p, rng);
    if (!solved) continue;
    const { pegs, ends } = solved;
    const solution = ends.map((e) => e.slice());
    const { moves, conflicts } = scramble(p, rng, pegs, ends);
    if (conflicts === 0) continue;
    if (conflicts < p.minConflicts && attempt < 300) continue;

    const upper = Math.min(moves.length, movesToSolution(ends, solution));
    const par = exactPar(pegs, ends.map((e) => e.slice()), upper);
    const colors = rng.shuffle(PALETTE.slice());
    const level = {
      n,
      tier: p.tier,
      cols: p.cols,
      rows: p.rows,
      pegs,
      ropes: ends.map((e, i) => ({ color: colors[i % colors.length], a: e[0], b: e[1] })),
      par,
      solution,               // um estado final resolvido (para testes/depuração)
      scrambleMoves: moves.length,
      startConflicts: conflicts,
    };
    cache.set(n, level);
    return JSON.parse(JSON.stringify(level));
  }
  throw new Error('Falha ao gerar fase ' + n);
}
