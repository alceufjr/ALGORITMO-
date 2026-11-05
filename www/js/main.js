import { CONFIG } from './config.js';
import { generateLevel } from './levels.js';
import { Game } from './game.js';
import { Renderer } from './render.js';
import { Store } from './storage.js';
import { Sfx } from './audio.js';
import { Ads } from './ads.js';

const $ = (s) => document.querySelector(s);
const canvas = $('#board');
const renderer = new Renderer(canvas);
let game = null;
let current = 1;
let inputLocked = false;
let markersOn = false;

// ------------------------------------------------------------- telas
function show(id) {
  document.querySelectorAll('.screen').forEach((s) => s.classList.toggle('active', s.id === id));
  if (id === 'play') requestAnimationFrame(() => renderer.resize());
  if (id === 'home') refreshHome();
  if (id === 'levels') buildLevelGrid();
}

function toast(msg, ms = 1600) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.remove('hidden');
  clearTimeout(toast._t);
  toast._t = setTimeout(() => t.classList.add('hidden'), ms);
}

function refreshHome() {
  const d = Store.data;
  $('#playLevel').textContent = d.unlocked > 1 ? `· ${d.unlocked}` : '';
  $('#totalStars').textContent = Store.totalStars();
  $('#btnSound').classList.toggle('off', !d.sound);
  $('#btnVibe').classList.toggle('off', !d.vibration);
  $('#btnNoAds').classList.toggle('hidden', !CONFIG.iap.enabled || d.noAds);
}

function buildLevelGrid() {
  const d = Store.data;
  const max = Math.ceil((d.unlocked + 20) / 20) * 20;
  const grid = $('#levelGrid');
  grid.innerHTML = '';
  $('#levelsStars').textContent = Store.totalStars();
  for (let n = 1; n <= max; n++) {
    const b = document.createElement('button');
    const locked = n > d.unlocked;
    b.className = 'btn lvl' + (locked ? ' locked' : '') + (n === d.unlocked ? ' current' : '');
    const s = d.stars[n] || 0;
    b.innerHTML = locked ? '🔒' : `${n}<small>${'★'.repeat(s)}${'☆'.repeat(3 - s)}</small>`;
    if (!locked) b.onclick = () => { Sfx.click(); startLevel(n); };
    grid.appendChild(b);
  }
  requestAnimationFrame(() => {
    const cur = grid.querySelector('.current');
    if (cur) cur.scrollIntoView({ block: 'center' });
  });
}

// ------------------------------------------------------------- partida
function startLevel(n) {
  current = n;
  game = new Game(generateLevel(n));
  inputLocked = false;
  renderer.setGame(game);
  renderer.showMarkers = n <= 3 || markersOn;
  $('#tutorial').classList.toggle('hidden', n > 2);
  show('play');
  updateHud();
  if (n === 1) setTimeout(() => showHint(true), 900);
}

function updateHud() {
  $('#hudLevel').textContent = current;
  $('#hudTier').textContent = game.level.tier;
  $('#hudMoves').textContent = game.moves;
  $('#hudPar').textContent = game.level.par;
  $('#hudKnots').textContent = game.conflicts;
  $('#hudKnotsLabel').textContent = game.conflicts === 1 ? 'cruzamento' : 'cruzamentos';
  $('.knots').classList.toggle('done', game.conflicts === 0);
  $('#hintCount').textContent = Store.data.hints > 0 ? Store.data.hints : '+';
  $('#btnUndo').disabled = game.history.length === 0;
  $('#btnMarkers').classList.toggle('off', !renderer.showMarkers);
  renderer.dirty = true;
}

function onWin() {
  inputLocked = true;
  Sfx.win();
  renderer.winT = performance.now();
  renderer.burst();
  const stars = game.stars();
  Store.completeLevel(current, stars);
  let bonus = false;
  if (current % CONFIG.hints.bonusEveryLevels === 0 && !Store.data[`bonus${current}`]) {
    Store.set({ hints: Store.data.hints + 1, [`bonus${current}`]: true });
    bonus = true;
  }
  setTimeout(() => {
    renderer.winT = 0;
    $('#winStars').querySelectorAll('span').forEach((s, i) => s.classList.toggle('on', i < stars));
    $('#winText').textContent = `${game.moves} jogada${game.moves === 1 ? '' : 's'} · meta ${game.level.par}`;
    $('#winBonus').classList.toggle('hidden', !bonus);
    $('#winModal').classList.remove('hidden');
  }, 1100);
}

async function nextLevel() {
  $('#winModal').classList.add('hidden');
  const since = await Ads.levelCompleted(current);
  Store.set({ levelsSinceAd: since });
  startLevel(current + 1);
}

function showHint(free = false) {
  if (!game || inputLocked) return;
  const h = game.hint();
  if (!h) return;
  if (!free) {
    if (Store.data.hints <= 0) {
      $('#hintReward').textContent = CONFIG.hints.perRewarded;
      $('#hintModal').classList.remove('hidden');
      return;
    }
    Store.set({ hints: Store.data.hints - 1 });
  }
  renderer.hint = { ...h, t0: performance.now() };
  updateHud();
}

// ------------------------------------------------------------- entrada (toque/mouse)
function pt(e) {
  const r = canvas.getBoundingClientRect();
  return { x: e.clientX - r.left, y: e.clientY - r.top };
}

canvas.addEventListener('pointerdown', (e) => {
  if (!game || inputLocked || renderer.drag) return;
  const p = pt(e);
  const hit = renderer.hitEnd(p.x, p.y);
  if (!hit) return;
  canvas.setPointerCapture(e.pointerId);
  renderer.drag = { ...hit, x: p.x, y: p.y, target: -1, pid: e.pointerId };
  renderer.hint = null;
  game.bringToTop(hit.ropeId);
  Sfx.pick();
});

canvas.addEventListener('pointermove', (e) => {
  const d = renderer.drag;
  if (!d || d.pid !== e.pointerId) return;
  const p = pt(e);
  d.x = p.x; d.y = p.y;
  const peg = renderer.pegAt(p.x, p.y);
  const own = game.ropes[d.ropeId].ends[d.end];
  d.target = peg >= 0 && peg !== own && game.isEmpty(peg) ? peg : -1;
});

function endDrag(e) {
  const d = renderer.drag;
  if (!d || d.pid !== e.pointerId) return;
  renderer.drag = null;
  const before = game.conflicts;
  if (d.target >= 0 && game.move(d.ropeId, d.end, d.target)) {
    renderer.snap = { ropeId: d.ropeId, end: d.end, x: d.x, y: d.y, t0: performance.now() };
    if (game.conflicts < before) Sfx.untangle(); else Sfx.drop();
    updateHud();
    if (game.solved) onWin();
  } else {
    renderer.snap = { ropeId: d.ropeId, end: d.end, x: d.x, y: d.y, t0: performance.now() };
    Sfx.cancel();
  }
}
canvas.addEventListener('pointerup', endDrag);
canvas.addEventListener('pointercancel', endDrag);

// ------------------------------------------------------------- botões
document.querySelectorAll('[data-go]').forEach((b) =>
  b.addEventListener('click', () => { Sfx.click(); show(b.dataset.go); }));

$('#btnPlay').onclick = () => { Sfx.click(); startLevel(Store.data.unlocked); };
$('#btnLevels').onclick = () => { Sfx.click(); show('levels'); };
$('#btnSound').onclick = () => { Store.set({ sound: !Store.data.sound }); applySettings(); Sfx.click(); refreshHome(); };
$('#btnVibe').onclick = () => { Store.set({ vibration: !Store.data.vibration }); applySettings(); Sfx.buzz(30); refreshHome(); };
$('#btnUndo').onclick = () => { if (!inputLocked && game.undo()) { Sfx.click(); updateHud(); } };
$('#btnRestart').onclick = () => { if (!inputLocked) { Sfx.click(); startLevel(current); } };
$('#btnMarkers').onclick = () => {
  markersOn = !renderer.showMarkers;
  renderer.showMarkers = markersOn;
  Sfx.click();
  updateHud();
};
$('#btnHint').onclick = () => { Sfx.click(); showHint(); };
$('#btnNext').onclick = () => { Sfx.click(); nextLevel(); };
$('#btnReplay').onclick = () => { Sfx.click(); $('#winModal').classList.add('hidden'); startLevel(current); };
$('#btnHintCancel').onclick = () => $('#hintModal').classList.add('hidden');
$('#btnHintWatch').onclick = async () => {
  $('#hintModal').classList.add('hidden');
  const ok = await Ads.rewarded();
  if (ok) {
    Store.set({ hints: Store.data.hints + CONFIG.hints.perRewarded });
    toast(`+${CONFIG.hints.perRewarded} dicas 💡`);
    updateHud();
  } else {
    toast('Anúncio indisponível. Tente novamente.');
  }
};
$('#btnNoAds').onclick = async () => {
  // Integração de compra: ver docs/PUBLICACAO.md (RevenueCat / cordova-plugin-purchase).
  toast('Compra ainda não configurada');
};

function applySettings() {
  Sfx.enabled = Store.data.sound;
  Sfx.vibration = Store.data.vibration;
}

// ------------------------------------------------------------- loop
function frame(now) {
  if (game && $('#play').classList.contains('active') && (renderer.dirty || renderer.animating)) {
    renderer.draw(now);
  }
  requestAnimationFrame(frame);
}

window.addEventListener('resize', () => renderer.resize());

// ------------------------------------------------------------- inicialização
async function boot() {
  applySettings();
  refreshHome();
  requestAnimationFrame(frame);

  await Ads.init({
    noAds: Store.data.noAds,
    levelsSinceAd: Store.data.levelsSinceAd,
    hooks: {
      onPause: () => Sfx.setMuted(true),
      onResume: () => Sfx.setMuted(false),
      onBannerHeight: (h) => {
        document.documentElement.style.setProperty('--banner', `${h}px`);
        renderer.resize();
      },
    },
  });

  // Botão "voltar" do Android
  const cap = window.Capacitor;
  if (cap && cap.isNativePlatform && cap.isNativePlatform() && cap.registerPlugin) {
    const App = cap.registerPlugin('App');
    App.addListener('backButton', () => {
      if (!$('#winModal').classList.contains('hidden')) return;
      if (!$('#hintModal').classList.contains('hidden')) { $('#hintModal').classList.add('hidden'); return; }
      if ($('#home').classList.contains('active')) App.exitApp();
      else show('home');
    });
  }

  // PWA offline (somente web)
  if ('serviceWorker' in navigator && !(cap && cap.isNativePlatform && cap.isNativePlatform()) && location.protocol === 'https:') {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
}
boot();

// Ganchos para depuração no console
window.__desenrola = { startLevel, get game() { return game; }, Store };
window.__desenrolaRenderer = renderer;
