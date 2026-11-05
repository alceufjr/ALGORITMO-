// Testes do gerador e do modelo de enrosco.
// Uso: node tests/levels.test.js
import assert from 'node:assert/strict';
import { generateLevel, levelParams, generateDaily, dailyDifficulty } from '../www/js/levels.js';
import { THEMES } from '../www/js/themes.js';
import { conflictPoint, sweep, tangleTotal } from '../www/js/core.js';
import { Game } from '../www/js/game.js';

const N = Number(process.env.LEVELS || 300);
const t0 = Date.now();
const rows = [];

// ---- geometria básica
assert.ok(conflictPoint({ x: 0, y: 0 }, { x: 2, y: 2 }, { x: 0, y: 2 }, { x: 2, y: 0 }), 'X cruza');
assert.equal(conflictPoint({ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 }), null, 'paralelas');

// ---- modelo de enrosco
{
  // A vertical curta acima de B horizontal. A passa por cima de B e volta: desenrola.
  const P = [[{ x: 2, y: 0 }, { x: 2, y: 0.5 }], [{ x: 0, y: 1 }, { x: 4, y: 1 }]];
  const K = {};
  sweep(P, K, 0, 1, { x: 2, y: 2 });
  assert.equal(tangleTotal(K), 1, 'cruzou uma vez');
  sweep(P, K, 0, 1, { x: 2, y: 0.5 });
  assert.equal(tangleTotal(K), 0, 'voltar pelo mesmo caminho desenrola');
  // A por cima de B; depois a ponta de B (por baixo) é puxada por cima de A: ENGANCHA.
  sweep(P, K, 0, 1, { x: 2, y: 2 });
  sweep(P, K, 1, 1, { x: 1.5, y: 1 });
  assert.equal(tangleTotal(K), 2, 'enganchou (2 voltas) sem cruzar em linha reta');
  sweep(P, K, 1, 1, { x: 4, y: 1 });
  assert.equal(tangleTotal(K), 1, 'desfazer o último arraste solta o enganche');
  // contornar a ponta de outra corda e voltar ao mesmo lugar por cima não enrola
  const P2 = [[{ x: 0, y: 0 }, { x: 1, y: 0 }], [{ x: 3, y: -1 }, { x: 3, y: 1 }]];
  const K2 = {};
  for (const q of [{ x: 4, y: 0 }, { x: 4, y: 2 }, { x: 2, y: 2 }, { x: 1, y: 0 }]) sweep(P2, K2, 0, 1, q);
  assert.equal(tangleTotal(K2), 0, 'dar a volta pela ponta livre não enrola');
}

let prevRopes = 0;
for (let n = 1; n <= N; n++) {
  const t = Date.now();
  const L = generateLevel(n);
  const ms = Date.now() - t;

  const g = new Game(L);
  assert.ok(g.conflicts > 0, `fase ${n}: começou resolvida`);

  // solução registrada (desfazer os arrastes) resolve de verdade
  const s = new Game(L);
  for (const m of L.solutionMoves) assert.ok(s.move(m.rope, m.end, m.to), `fase ${n}: jogada da solução inválida`);
  assert.ok(s.solved, `fase ${n}: solução não resolve (${s.conflicts})`);
  assert.equal(s.moves, L.scrambleMoves);

  const keys = new Set(L.pegs.map((p) => `${p.x},${p.y}`));
  assert.equal(keys.size, L.pegs.length, `fase ${n}: furos duplicados`);
  assert.ok(L.pegs.length > L.ropes.length * 2, `fase ${n}: sem furo livre`);
  assert.deepEqual(generateLevel(n), L, `fase ${n}: não determinística`);
  assert.ok(L.ropes.length >= prevRopes, `fase ${n}: menos cordas que a anterior`);
  prevRopes = L.ropes.length;
  assert.ok(L.par >= 1 && L.par <= L.scrambleMoves, `fase ${n}: meta fora do intervalo`);
  assert.ok(ms < 2500, `fase ${n}: geração lenta (${ms}ms)`);

  if (n <= 5 || n % 10 === 0) {
    const hooks = Object.values(L.twists).filter((v) => Math.abs(v) >= 2).length;
    rows.push({ fase: n, nível: L.tier, cordas: L.ropes.length, grade: `${L.cols}x${L.rows}`,
      nós: g.conflicts, enganches: hooks, meta: L.par, ms });
  }
}

// dica sempre aponta jogada válida; nas primeiras fases, seguir dicas resolve
for (let n = 1; n <= 8; n++) {
  const g = new Game(generateLevel(n));
  let guard = 0;
  while (!g.solved && guard++ < 40) {
    const h = g.hint();
    assert.ok(h && g.isEmpty(h.to), `fase ${n}: dica inválida`);
    g.move(h.ropeId, h.end, h.to);
  }
  if (n <= 3) assert.ok(g.solved, `fase ${n}: dicas não resolveram`);
}

// desfazer restaura posições e voltas
{
  const g = new Game(generateLevel(20));
  const before = JSON.stringify([g.ends, g.K]);
  const h = g.hint();
  g.move(h.ropeId, h.end, h.to);
  g.undo();
  assert.equal(JSON.stringify([g.ends, g.K]), before, 'undo não restaurou');
  assert.equal(g.moves, 0);
}

// arraste ao vivo: ir e voltar ao mesmo furo pelo mesmo caminho não conta jogada
{
  const g = new Game(generateLevel(10));
  const r = 0, e = 0;
  const p = g.pegs[g.ropes[r].ends[e]];
  g.beginDrag(r, e);
  g.dragTo(p.x + 0.3, p.y + 0.2);
  assert.equal(g.endDrag(-1), false, 'voltar ao lugar não é jogada');
}

// desafio diário
{
  const a = generateDaily('2026-11-05'), b = generateDaily('2026-11-05'), c = generateDaily('2026-11-06');
  assert.deepEqual(a, b, 'diário não determinístico');
  assert.notDeepEqual(a.ropes, c.ropes, 'dias diferentes geraram a mesma fase');
  assert.ok(dailyDifficulty('2026-11-08') > dailyDifficulty('2026-11-02'));
  for (let d = 1; d <= 30; d++) {
    const key = `2027-${String(1 + (d % 12)).padStart(2, '0')}-${String(1 + (d % 28)).padStart(2, '0')}`;
    const L = generateDaily(key);
    const s = new Game(L);
    L.solutionMoves.forEach((m) => s.move(m.rope, m.end, m.to));
    assert.ok(s.solved, `diário ${key}: solução não resolve`);
  }
}

for (const th of THEMES) {
  assert.equal(new Set(th.palette).size, 16, `tema ${th.id}: cores repetidas`);
}

console.table(rows);
console.log(`OK — ${N} fases geradas e validadas em ${((Date.now() - t0) / 1000).toFixed(1)}s`);
console.log('Parâmetros da fase 1:', levelParams(1));
