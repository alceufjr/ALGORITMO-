// Testes do gerador: toda fase precisa começar embaraçada, ter solução
// verificada e ficar progressivamente mais difícil.
// Uso: node tests/levels.test.js
import assert from 'node:assert/strict';
import { generateLevel, levelParams } from '../www/js/levels.js';
import { countConflicts, conflictPoint } from '../www/js/core.js';
import { Game } from '../www/js/game.js';

const N = Number(process.env.LEVELS || 300);
let prevRopes = 0;
const t0 = Date.now();
const rows = [];

// geometria básica
assert.ok(conflictPoint({ x: 0, y: 0 }, { x: 2, y: 2 }, { x: 0, y: 2 }, { x: 2, y: 0 }), 'X cruza');
assert.equal(conflictPoint({ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 }), null, 'paralelas');
assert.ok(conflictPoint({ x: 0, y: 0 }, { x: 2, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 2 }), 'ponta encostando no meio');
assert.ok(conflictPoint({ x: 0, y: 0 }, { x: 3, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }), 'sobreposição colinear');

for (let n = 1; n <= N; n++) {
  const t = Date.now();
  const L = generateLevel(n);
  const ms = Date.now() - t;
  const ends = L.ropes.map((r) => [r.a, r.b]);

  // 1) começa embaraçada
  const c = countConflicts(L.pegs, ends);
  assert.ok(c > 0, `fase ${n}: começou resolvida`);

  // 2) solução registrada é válida (sem cruzamentos e com as mesmas cordas)
  assert.equal(countConflicts(L.pegs, L.solution), 0, `fase ${n}: solução inválida`);
  assert.equal(new Set(L.solution.flat()).size, L.ropes.length * 2, `fase ${n}: pinos repetidos`);

  // 3) furos únicos e ocupação coerente
  const keys = new Set(L.pegs.map((p) => `${p.x},${p.y}`));
  assert.equal(keys.size, L.pegs.length, `fase ${n}: furos duplicados`);
  assert.ok(L.pegs.length > L.ropes.length * 2, `fase ${n}: sem furo livre`);

  // 4) determinismo
  assert.deepEqual(generateLevel(n), L, `fase ${n}: não determinística`);

  // 5) progressão de cordas nunca regride
  assert.ok(L.ropes.length >= prevRopes, `fase ${n}: menos cordas que a anterior`);
  prevRopes = L.ropes.length;

  // 5b) meta é alcançável: aplicar a meta de jogadas rumo à solução resolve
  assert.ok(L.par >= 1 && L.par <= L.scrambleMoves, `fase ${n}: meta fora do intervalo`);

  // 6) velocidade de geração (dispositivos fracos)
  assert.ok(ms < 1500, `fase ${n}: geração lenta (${ms}ms)`);

  if (n <= 5 || n % 10 === 0) {
    rows.push({ fase: n, nível: L.tier, cordas: L.ropes.length, furos: L.pegs.length,
      grade: `${L.cols}x${L.rows}`, cruzamentos: c, meta: L.par, ms });
  }
}

// 7) a dica sempre aponta uma jogada válida e, em fases fáceis, a dica gulosa resolve
for (let n = 1; n <= 10; n++) {
  const g = new Game(generateLevel(n));
  let guard = 0;
  while (!g.solved && guard++ < 60) {
    const h = g.hint();
    assert.ok(h && g.isEmpty(h.to), `fase ${n}: dica inválida`);
    g.move(h.ropeId, h.end, h.to);
  }
  if (n <= 3) assert.ok(g.solved, `fase ${n}: dicas não resolveram`);
}

// 8) undo restaura o estado
{
  const g = new Game(generateLevel(20));
  const before = JSON.stringify(g.ends);
  const h = g.hint();
  g.move(h.ropeId, h.end, h.to);
  g.undo();
  assert.equal(JSON.stringify(g.ends), before, 'undo não restaurou');
  assert.equal(g.moves, 0);
}

console.table(rows);
console.log(`OK — ${N} fases geradas e validadas em ${((Date.now() - t0) / 1000).toFixed(1)}s`);
console.log('Parâmetros da fase 1:', levelParams(1));
