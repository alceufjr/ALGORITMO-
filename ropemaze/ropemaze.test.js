// Testes do Rope Maze: busca acha solução válida (todas as portas, uma vez, sem cruzar).
// Uso: node ropemaze/ropemaze.test.js
import assert from 'node:assert/strict';
import { MAZE, RopeSearch, crosses } from './ropemaze.js';

// cada porta referenciada do outro lado existe e aponta de volta (corrige o "door_nw_sw")
for (const [room, doors] of Object.entries(MAZE)) {
  for (const [name, d] of Object.entries(doors)) {
    const [r2, n2] = d.to;
    assert.ok(MAZE[r2][n2], `${room}.${name} aponta para porta inexistente ${r2}.${n2}`);
    assert.deepEqual(MAZE[r2][n2].to, [room, name], `${room}.${name} não é recíproca`);
    assert.equal(MAZE[r2][n2].el, d.el, `${room}.${name}: elementos diferentes`);
  }
}

// cruzamento: cordas intercaladas no contorno se cruzam
const sq = ['a', 'b', 'c', 'd'];
assert.equal(crosses(sq, 'a', 'c', 'b', 'd'), true);
assert.equal(crosses(sq, 'a', 'b', 'c', 'd'), false);

const s = new RopeSearch();
let guard = 0;
while (s.state === 'searching' && guard++ < 1e6) s.step();
assert.equal(s.state, 'solved', 'deveria achar solução');
assert.equal(s.count, 15);

// valida a solução de forma independente
const path = s.path();
const seen = new Set();
for (const seg of path) if (seg.to) {
  const el = MAZE[seg.room][seg.to].el;
  assert.ok(!seen.has(el), `porta repetida ${el}`);
  seen.add(el);
}
assert.equal(seen.size, 15);
for (let i = 0; i < path.length; i++) for (let j = i + 1; j < path.length; j++) {
  const A = path[i], B = path[j];
  if (A.room !== B.room) continue;
  assert.ok(!crosses(Object.keys(MAZE[A.room]), A.from, A.to, B.from, B.to), `cruzamento em ${A.room}`);
}
console.log(`OK — solução com ${s.count} portas em ${s.tries} tentativas; termina em ${path.at(-1).room}`);
