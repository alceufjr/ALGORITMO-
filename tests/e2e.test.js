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
const page = await browser.newPage({ viewport: { width: 400, height: 820 }, deviceScaleFactor: shots ? 2 : 1, locale: 'pt-BR' });
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
    const g = window.__desata.game;
    const box = document.querySelector('#board').getBoundingClientRect();
    const rd = window.__desata.renderer;
    const peg = (id) => { const p = rd.pegPos(id); return { x: box.left + p.x, y: box.top + p.y }; };
    return { from: peg(g.ropes[r].ends[e]), to: peg(t) };
  }, [ropeId, end, to]);
  await page.mouse.move(pts.from.x, pts.from.y);
  await page.mouse.down();
  await page.mouse.move((pts.from.x + pts.to.x) / 2, (pts.from.y + pts.to.y) / 2, { steps: 4 });
  await page.mouse.move(pts.to.x, pts.to.y, { steps: 4 });
  await page.mouse.up();
}

// Resolve desfazendo os arrastes do embaralhamento, em linha reta, pelo mesmo caminho.
async function solveCurrent() {
  const steps = await page.evaluate(() => window.__desata.game.level.solutionMoves);
  for (const m of steps) await drag(m.rope, m.end, m.to);
}

await page.click('#btnPlay');
await page.waitForTimeout(300);
await snap(page, '2-fase1');
assert.equal(await page.textContent('#hudTitle'), 'Fase 1');

await solveCurrent();
await page.waitForSelector('#winModal:not(.hidden)', { timeout: 4000 });
await snap(page, '3-vitoria');
assert.equal(await page.evaluate(() => window.__desata.Store.data.unlocked), 2);

// Avança algumas fases (a fase 4 dispara intersticial simulado no modo teste)
for (let n = 2; n <= 5; n++) {
  await page.click('#btnNext');
  const mock = await page.waitForSelector('.mock-ad', { timeout: 800 }).catch(() => null);
  if (mock) {
    await snap(page, '4-anuncio-teste');
    await page.waitForSelector('.mock-ad button:not([disabled])', { timeout: 6000 });
    await page.click('.mock-ad button');
  }
  await page.waitForFunction((x) => document.querySelector('#hudTitle').textContent === `Fase ${x}`, n);
  await solveCurrent();
  await page.waitForSelector('#winModal:not(.hidden)', { timeout: 4000 });
}
assert.equal(await page.evaluate(() => window.__desata.Store.data.unlocked), 6);

// Fase avançada: tela cheia de cordas + marcadores
await page.evaluate(() => { document.querySelector('#winModal').classList.add('hidden'); window.__desata.startLevel(45); });
await page.waitForTimeout(300);
await snap(page, '5-fase45');
await page.click('#btnMarkers');
await page.waitForTimeout(200);
await snap(page, '6-fase45-marcadores');

// Dica: consome 1 dica e desenha a sugestão
const before = await page.evaluate(() => window.__desata.Store.data.hints);
await page.click('#btnHint');
await page.waitForTimeout(500);
await snap(page, '7-dica');
assert.equal(await page.evaluate(() => window.__desata.Store.data.hints), before - 1);

// Desfazer
const g0 = await page.evaluate(() => JSON.stringify(window.__desata.game.ends));
const h = await page.evaluate(() => window.__desata.game.hint());
await drag(h.ropeId, h.end, h.to);
assert.ok(await page.evaluate(() => window.__desata.game.moves) >= 1);
await page.click('#btnUndo');
assert.equal(await page.evaluate(() => JSON.stringify(window.__desata.game.ends)), g0);

// Tela de fases
await page.click('#play .back');
await page.click('#btnLevels');
await page.waitForTimeout(300);
await snap(page, '8-fases');
await page.click('#levels .back');

// Desafio diário: resolve, confere sequência e dica de recompensa
const hintsBefore = await page.evaluate(() => window.__desata.Store.data.hints);
await page.click('#btnDaily');
await page.waitForTimeout(300);
await snap(page, '9-diario');
await solveCurrent();
await page.waitForSelector('#winModal:not(.hidden)', { timeout: 4000 });
assert.equal(await page.evaluate(() => window.__desata.Store.data.daily.streak), 1);
assert.equal(await page.evaluate(() => window.__desata.Store.data.hints), hintsBefore + 1);
await page.click('#btnNext');
const mock2 = await page.waitForSelector('.mock-ad', { timeout: 800 }).catch(() => null);
if (mock2) { await page.waitForSelector('.mock-ad button:not([disabled])', { timeout: 6000 }); await page.click('.mock-ad button'); }
await page.waitForSelector('#home.active');
assert.match(await page.textContent('#btnDaily'), /🔥 1/);

// Temas: desbloqueia "Oceano" com anúncio premiado (simulado) e equipa
await page.click('#btnStyles');
await page.waitForTimeout(200);
const oceanBtn = page.locator('.theme-card').nth(1).locator('button');
await oceanBtn.click();
await page.waitForSelector('.mock-ad button:not([disabled])', { timeout: 8000 });
await page.click('.mock-ad button');
await page.waitForFunction(() => window.__desata.Store.data.theme === 'ocean');
await snap(page, '10-estilos');
await page.click('#styles .back');
await page.click('#btnPlay');
await page.waitForTimeout(300);
await snap(page, '11-tema-oceano');
const ropeColor = await page.evaluate(() => window.__desata.game.ropes[0].color);
assert.ok(['#0077b6', '#00b4d8', '#ff6b6b', '#ffd166', '#06d6a0', '#118ab2', '#ef476f', '#f78c6b',
  '#83c5be', '#3a0ca3', '#4cc9f0', '#e76f51', '#2a9d8f', '#e9c46a', '#264653', '#90e0ef'].includes(ropeColor), 'cor fora do tema');

// Idioma: PT -> EN
await page.click('#play .back');
await page.click('#btnLang');
assert.equal(await page.textContent('#btnPlay [data-i18n="play"]'), 'Play');
await snap(page, '12-menu-en');

assert.deepEqual(errors, [], 'erros no console: ' + errors.join('\n'));
await browser.close();
console.log('E2E OK — fases, anúncio de teste, dica, desfazer, seleção de fases, desafio diário, temas e idioma.');
