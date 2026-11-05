// Teste de ponta a ponta no navegador (Playwright): abre o jogo, resolve
// fases arrastando com o "mouse" e confere vitória, estrelas e progresso.
// Uso: npx serve www -l 8080 &  depois  node tests/e2e.test.js [--shots dir]
import { chromium } from 'playwright';
import assert from 'node:assert/strict';

const URL = process.env.URL || 'http://localhost:8080/index.html';
const shotsIdx = process.argv.indexOf('--shots');
const shots = shotsIdx > 0 ? process.argv[shotsIdx + 1] : null;
const snap = async (page, name) => shots && page.screenshot({ path: `${shots}/${name}.png` });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 400, height: 820 }, deviceScaleFactor: shots ? 2 : 1 });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));

await page.goto(URL);
await page.evaluate(() => localStorage.clear());
await page.reload();
await snap(page, '1-menu');

// Arrasta uma ponta de corda até um furo, como um jogador faria.
async function drag(ropeId, end, to) {
  const pts = await page.evaluate(([r, e, t]) => {
    const g = window.__desenrola.game;
    const box = document.querySelector('#board').getBoundingClientRect();
    const rd = window.__desenrolaRenderer;
    const peg = (id) => { const p = rd.pegPos(id); return { x: box.left + p.x, y: box.top + p.y }; };
    return { from: peg(g.ropes[r].ends[e]), to: peg(t) };
  }, [ropeId, end, to]);
  await page.mouse.move(pts.from.x, pts.from.y);
  await page.mouse.down();
  await page.mouse.move((pts.from.x + pts.to.x) / 2, (pts.from.y + pts.to.y) / 2, { steps: 4 });
  await page.mouse.move(pts.to.x, pts.to.y, { steps: 4 });
  await page.mouse.up();
}

// Resolve usando a solução registrada (move cada ponta para seu lugar final).
async function solveCurrent() {
  for (let guard = 0; guard < 200; guard++) {
    const step = await page.evaluate(() => {
      const g = window.__desenrola.game;
      if (g.solved) return null;
      const sol = g.level.solution;
      const occ = new Map();
      g.ropes.forEach((r) => r.ends.forEach((p, e) => occ.set(p, { r: r.id, e })));
      // procura ponta fora do lugar cujo destino esteja livre
      for (const r of g.ropes) for (let e = 0; e < 2; e++) {
        const target = sol[r.id][e];
        if (r.ends[e] !== target && !occ.has(target)) return { r: r.id, e, to: target };
      }
      // ciclo: estaciona uma ponta deslocada em qualquer furo livre
      for (const r of g.ropes) for (let e = 0; e < 2; e++) {
        if (r.ends[e] !== sol[r.id][e]) {
          const free = g.pegs.findIndex((_, i) => !occ.has(i) && !sol.flat().includes(i));
          const any = free >= 0 ? free : g.pegs.findIndex((_, i) => !occ.has(i));
          return { r: r.id, e, to: any };
        }
      }
      return null;
    });
    if (!step) return;
    await drag(step.r, step.e, step.to);
  }
}

await page.click('#btnPlay');
await page.waitForTimeout(300);
await snap(page, '2-fase1');
assert.equal(await page.textContent('#hudLevel'), '1');

await solveCurrent();
await page.waitForSelector('#winModal:not(.hidden)', { timeout: 4000 });
await snap(page, '3-vitoria');
assert.equal(await page.evaluate(() => window.__desenrola.Store.data.unlocked), 2);

// Avança algumas fases (a fase 4 dispara intersticial simulado no modo teste)
for (let n = 2; n <= 5; n++) {
  await page.click('#btnNext');
  const mock = await page.waitForSelector('.mock-ad', { timeout: 800 }).catch(() => null);
  if (mock) {
    await snap(page, '4-anuncio-teste');
    await page.waitForSelector('.mock-ad button:not([disabled])', { timeout: 6000 });
    await page.click('.mock-ad button');
  }
  await page.waitForFunction((x) => document.querySelector('#hudLevel').textContent === String(x), n);
  await solveCurrent();
  await page.waitForSelector('#winModal:not(.hidden)', { timeout: 4000 });
}
assert.equal(await page.evaluate(() => window.__desenrola.Store.data.unlocked), 6);

// Fase avançada: tela cheia de cordas + marcadores
await page.evaluate(() => { document.querySelector('#winModal').classList.add('hidden'); window.__desenrola.startLevel(45); });
await page.waitForTimeout(300);
await snap(page, '5-fase45');
await page.click('#btnMarkers');
await page.waitForTimeout(200);
await snap(page, '6-fase45-marcadores');

// Dica: consome 1 dica e desenha a sugestão
const before = await page.evaluate(() => window.__desenrola.Store.data.hints);
await page.click('#btnHint');
await page.waitForTimeout(500);
await snap(page, '7-dica');
assert.equal(await page.evaluate(() => window.__desenrola.Store.data.hints), before - 1);

// Desfazer
const g0 = await page.evaluate(() => JSON.stringify(window.__desenrola.game.ends));
const h = await page.evaluate(() => window.__desenrola.game.hint());
await drag(h.ropeId, h.end, h.to);
assert.equal(await page.evaluate(() => window.__desenrola.game.moves), 1);
await page.click('#btnUndo');
assert.equal(await page.evaluate(() => JSON.stringify(window.__desenrola.game.ends)), g0);

// Tela de fases
await page.click('#play .back');
await page.click('#btnLevels');
await page.waitForTimeout(300);
await snap(page, '8-fases');

assert.deepEqual(errors, [], 'erros no console: ' + errors.join('\n'));
await browser.close();
console.log('E2E OK — 5 fases resolvidas via arrastar, anúncio de teste, dica, desfazer, seleção de fases.');
