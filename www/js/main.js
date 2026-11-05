import { CONFIG } from './config.js';
import { generateLevel, generateDaily, todayKey } from './levels.js';
import { Game } from './game.js';
import { Renderer } from './render.js';
import { Store } from './storage.js';
import { Sfx } from './audio.js';
import { Ads } from './ads.js';
import { t, setLang, getLang, detectLang, LANGS, applyI18n } from './i18n.js';
import { THEMES, themeById, applyThemeUI } from './themes.js';

const $ = (s) => document.querySelector(s);
const canvas = $('#board');
const renderer = new Renderer(canvas);
let game = null;
let current = 1;          // fase atual (modo campanha)
let mode = 'campaign';    // 'campaign' | 'daily'
let inputLocked = false;
let markersOn = false;
let undosLeft = 3;
// cronômetro: tempo restante (s) e se está correndo; null = fase sem limite
let timeLeft = null;
let timeUsed = 0;
let lastTick = 0;
let rewardAction = null; // o que o vídeo premiado concede no modal aberto
let lastKnots = 0;

const theme = () => themeById(Store.data.theme);

// ------------------------------------------------------------- telas
function show(id) {
  document.querySelectorAll('.screen').forEach((s) => s.classList.toggle('active', s.id === id));
  if (id === 'play') requestAnimationFrame(() => renderer.resize());
  if (id === 'home') refreshHome();
  if (id === 'levels') buildLevelGrid();
  if (id === 'styles') buildThemeGrid();
}
const isOpen = (id) => !$(id).classList.contains('hidden');

function toast(msg, ms = 1800) {
  const el = $('#toast');
  el.textContent = msg;
  el.classList.remove('hidden');
  clearTimeout(toast._t);
  toast._t = setTimeout(() => el.classList.add('hidden'), ms);
}

function refreshHome() {
  const d = Store.data;
  $('#playLevel').textContent = d.unlocked > 1 ? `· ${d.unlocked}` : '';
  $('#totalStars').textContent = t('stars_won', { n: Store.totalStars() });
  $('#btnSound').classList.toggle('off', !d.sound);
  $('#btnVibe').classList.toggle('off', !d.vibration);
  $('#btnNoAds').classList.toggle('hidden', !CONFIG.iap.enabled || d.noAds);
  $('#btnLang').textContent = getLang().toUpperCase();
  const today = todayKey();
  const done = !!d.daily.done[today];
  const streak = Store.currentStreak(today);
  $('#btnDaily').classList.toggle('done', done);
  $('#dailyLabel').textContent = done ? t('daily_done_btn') : t('daily');
  $('#dailyStreak').textContent = streak > 0 ? t('streak', { n: streak }) : '';
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

// mini-prévia do tema: 3 cordas cruzadas sobre o fundo do tema
function themePreview(th) {
  const c = th.palette;
  const o = th.board.outline;
  const rope = (x1, y1, x2, y2, col) =>
    `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${o}" stroke-width="11" stroke-linecap="round"/>
     <line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${col}" stroke-width="7" stroke-linecap="round"/>
     <circle cx="${x1}" cy="${y1}" r="9" fill="${col}" stroke="${o}" stroke-width="3"/>
     <circle cx="${x2}" cy="${y2}" r="9" fill="${col}" stroke="${o}" stroke-width="3"/>`;
  return `<svg viewBox="0 0 140 90">
    <rect width="140" height="90" fill="${th.ui.bg}"/>
    <circle cx="70" cy="18" r="8" fill="${th.board.peg}"/><circle cx="70" cy="72" r="8" fill="${th.board.peg}"/>
    ${rope(20, 18, 120, 72, c[0])}${rope(20, 72, 120, 18, c[1])}${rope(45, 45, 100, 45, c[3])}
  </svg>`;
}

function buildThemeGrid() {
  const d = Store.data;
  const stars = Store.totalStars();
  $('#stylesStars').textContent = stars;
  const grid = $('#themeGrid');
  grid.innerHTML = '';
  for (const th of THEMES) {
    const owned = d.ownedThemes.includes(th.id) || th.unlock.type === 'free' ||
      (th.unlock.type === 'stars' && stars >= th.unlock.n);
    const active = d.theme === th.id;
    const card = document.createElement('div');
    card.className = 'theme-card' + (active ? ' active' : '');
    let label;
    if (active) label = t('equipped');
    else if (owned) label = t('equip');
    else if (th.unlock.type === 'stars') label = t('unlock_stars', { n: th.unlock.n });
    else label = t('unlock_ad');
    card.innerHTML = `${themePreview(th)}<h3>${t('theme_' + th.id)}</h3>
      <button class="btn ${owned && !active ? 'primary' : ''}" ${active ? 'disabled' : ''}>${label}</button>`;
    card.querySelector('button').onclick = async () => {
      Sfx.click();
      if (owned) return equipTheme(th.id);
      if (th.unlock.type === 'stars') return toast(t('need_stars', { n: th.unlock.n - stars }));
      if (await Ads.rewarded()) {
        Store.set({ ownedThemes: [...new Set([...d.ownedThemes, th.id])] });
        toast(t('theme_unlocked'));
        equipTheme(th.id);
      } else toast(t('ad_unavailable'));
    };
    grid.appendChild(card);
  }
}

function equipTheme(id) {
  const d = Store.data;
  Store.set({ theme: id, ownedThemes: [...new Set([...d.ownedThemes, id])] });
  applyTheme();
  buildThemeGrid();
}

function applyTheme() {
  const th = theme();
  applyThemeUI(th);
  renderer.board = th.board;
  renderer.dirty = true;
}

// ------------------------------------------------------------- partida
function begin(level) {
  game = new Game(level, theme().palette);
  inputLocked = false;
  renderer.setGame(game);
  renderer.showMarkers = (mode === 'campaign' && current <= 2) || markersOn;
  undosLeft = CONFIG.undo.freePerLevel;
  // tempo limite da fase (o tutorial não tem)
  const T = CONFIG.timer;
  const limited = T.enabled && (mode === 'daily' || current >= T.fromLevel);
  timeLeft = limited ? T.base + T.perMove * level.par : null;
  timeUsed = 0;
  lastTick = performance.now();
  $('#timeModal').classList.add('hidden');
  // dica do tutorial (fases 1–5)
  const tip = mode === 'campaign' ? level.tip : null;
  const tipEl = $('#tutorial');
  tipEl.classList.toggle('hidden', !tip);
  if (tip) { tipEl.innerHTML = t(tip); tipEl.style.animation = 'none'; void tipEl.offsetWidth; tipEl.style.animation = ''; }
  // transição de entrada do tabuleiro
  const wrap = $('#boardWrap');
  wrap.classList.remove('board-in'); void wrap.offsetWidth; wrap.classList.add('board-in');
  show('play');
  updateHud();
}

function startLevel(n) {
  mode = 'campaign';
  current = n;
  begin(generateLevel(n));
  if (n === 1) setTimeout(() => showHint(true), 900);
}

function startDaily() {
  mode = 'daily';
  begin(generateDaily(todayKey()));
}

function updateHud() {
  $('#hudTitle').textContent = mode === 'daily' ? t('daily_title') : t('level', { n: current });
  const date = new Date().toLocaleDateString(getLang() === 'pt' ? 'pt-BR' : getLang(), { day: 'numeric', month: 'short' });
  $('#hudTier').textContent = mode === 'daily' ? `${date} · ${t('tier_' + game.level.tier)}` : t('tier_' + game.level.tier);
  $('#hudMoves').textContent = game.moves;
  $('#hudPar').textContent = game.level.par;
  $('#hudKnots').textContent = game.conflicts;
  $('#hudKnotsLabel').textContent = game.conflicts === 1 ? t('crossing_one') : t('crossing_many');
  $('.knots').classList.toggle('done', game.conflicts === 0);
  $('#hintCount').textContent = Store.data.hints > 0 ? Store.data.hints : '+';
  $('#btnUndo').disabled = game.history.length === 0;
  $('#undoCount').textContent = undosLeft > 0 ? undosLeft : '+';
  $('#btnMarkers').classList.toggle('off', !renderer.showMarkers);
  updateTimer();
  renderer.dirty = true;
}

const fmtTime = (sec) => {
  const v = Math.max(0, Math.ceil(sec));
  return `${Math.floor(v / 60)}:${String(v % 60).padStart(2, '0')}`;
};

function updateTimer() {
  const el = $('#hudTime');
  el.classList.toggle('hidden', timeLeft === null);
  if (timeLeft === null) return;
  el.textContent = `⏱ ${fmtTime(timeLeft)}`;
  el.classList.toggle('warn', timeLeft <= CONFIG.timer.warnAt);
}

/** O relógio só corre com o tabuleiro visível e sem janela/anúncio aberto. */
function timerRunning() {
  return game && timeLeft !== null && !inputLocked && !document.hidden &&
    $('#play').classList.contains('active') &&
    !document.querySelector('.modal:not(.hidden)') && !document.querySelector('.mock-ad');
}

function tickTimer(now) {
  const dt = Math.min(0.25, (now - lastTick) / 1000);
  lastTick = now;
  if (!timerRunning()) return;
  timeLeft -= dt;
  timeUsed += dt;
  if (timeLeft <= 0) { timeLeft = 0; onTimeUp(); }
  updateTimer();
}

function onTimeUp() {
  inputLocked = true;
  if (renderer.drag) { renderer.drag = null; game.endDrag(-1); }
  Sfx.cancel();
  Sfx.buzz([60, 40, 60]);
  $('#timeModalBody').innerHTML = t('time_up_body', { n: CONFIG.timer.extraRewarded });
  $('#btnTimeMore').textContent = t('more_time', { n: CONFIG.timer.extraRewarded });
  $('#timeModal').classList.remove('hidden');
}

function onWin() {
  inputLocked = true;
  Sfx.win();
  renderer.winT = performance.now();
  renderer.burst();
  const stars = game.stars();
  let bonus = '';
  if (mode === 'daily') {
    const first = Store.completeDaily(game.level.daily, stars);
    if (first) { Store.set({ hints: Store.data.hints + 1 }); bonus = t('daily_reward'); }
  } else {
    Store.completeLevel(current, stars);
    if (current % CONFIG.hints.bonusEveryLevels === 0 && !Store.data[`bonus${current}`]) {
      Store.set({ hints: Store.data.hints + 1, [`bonus${current}`]: true });
      bonus = t('bonus_hint');
    }
  }
  setTimeout(() => {
    renderer.winT = 0;
    $('#winStars').querySelectorAll('span').forEach((s, i) => s.classList.toggle('on', i < stars));
    $('#winPerfect').textContent = t('perfect');
    $('#winPerfect').classList.toggle('hidden', !(stars === 3 && game.moves <= game.level.par));
    let text = t('moves_line', { m: game.moves, p: game.level.par });
    if (timeLeft !== null) text += ` · ${t('time_line', { t: fmtTime(timeUsed) })}`;
    if (mode === 'daily') text += ` · ${t('streak', { n: Store.currentStreak(todayKey()) })}\n${t('daily_win')}`;
    $('#winText').innerText = text;
    $('#winBonus').textContent = bonus;
    $('#winBonus').classList.toggle('hidden', !bonus);
    $('#btnNext').textContent = mode === 'daily' ? t('home') : t('next');
    $('#winModal').classList.remove('hidden');
  }, 1100);
}

async function nextLevel() {
  $('#winModal').classList.add('hidden');
  const since = await Ads.levelCompleted(mode === 'daily' ? 99 : current);
  Store.set({ levelsSinceAd: since });
  if (mode === 'daily') show('home');
  else startLevel(current + 1);
}

function openReward(kind) {
  rewardAction = kind;
  const hints = kind === 'hints';
  $('#hintModalTitle').textContent = hints ? t('no_hints_title') : t('no_undo_title');
  $('#hintModalBody').innerHTML = hints
    ? t('no_hints_body', { n: CONFIG.hints.perRewarded })
    : t('no_undo_body', { n: CONFIG.undo.perRewarded });
  $('#hintModal').classList.remove('hidden');
}

function doUndo() {
  if (inputLocked || !game.history.length) return;
  if (undosLeft <= 0) { openReward('undo'); return; }
  if (game.undo()) { undosLeft--; Sfx.click(); updateHud(); }
}

function showHint(free = false) {
  if (!game || inputLocked) return;
  const h = game.hint();
  if (!h) return;
  if (!free) {
    if (Store.data.hints <= 0) {
      openReward('hints');
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
  game.beginDrag(hit.ropeId, hit.end);
  lastKnots = game.conflicts;
  Sfx.pick();
});

canvas.addEventListener('pointermove', (e) => {
  const d = renderer.drag;
  if (!d || d.pid !== e.pointerId) return;
  const p = pt(e);
  d.x = p.x; d.y = p.y;
  // o caminho do dedo enrola/desenrola as cordas em tempo real
  const gp = renderer.toGrid(p.x, p.y);
  game.dragTo(gp.x, gp.y);
  if (game.conflicts !== lastKnots) {
    if (game.conflicts < lastKnots) Sfx.untangle(); else Sfx.tangle();
    lastKnots = game.conflicts;
    updateHud();
  }
  const peg = renderer.pegAt(p.x, p.y);
  const own = game.ropes[d.ropeId].ends[d.end];
  d.target = peg >= 0 && peg !== own && game.isEmpty(peg) ? peg : -1;
});

function endDrag(e) {
  const d = renderer.drag;
  if (!d || d.pid !== e.pointerId) return;
  renderer.drag = null;
  renderer.snap = { ropeId: d.ropeId, end: d.end, x: d.x, y: d.y, t0: performance.now() };
  const moved = game.endDrag(d.target);
  if (moved) Sfx.drop(); else Sfx.cancel();
  updateHud();
  if (game.solved) onWin();
}
canvas.addEventListener('pointerup', endDrag);
canvas.addEventListener('pointercancel', endDrag);

// ------------------------------------------------------------- botões
document.querySelectorAll('[data-go]').forEach((b) =>
  b.addEventListener('click', () => { Sfx.click(); show(b.dataset.go); }));

$('#btnPlay').onclick = () => { Sfx.click(); startLevel(Store.data.unlocked); };
$('#btnDaily').onclick = () => { Sfx.click(); startDaily(); };
$('#btnLevels').onclick = () => { Sfx.click(); show('levels'); };
$('#btnStyles').onclick = () => { Sfx.click(); show('styles'); };
$('#btnLang').onclick = () => {
  const next = LANGS[(LANGS.indexOf(getLang()) + 1) % LANGS.length];
  Store.set({ lang: next });
  setLang(next);
  Sfx.click();
  refreshHome();
};
$('#btnSound').onclick = () => { Store.set({ sound: !Store.data.sound }); applySettings(); Sfx.click(); refreshHome(); };
$('#btnVibe').onclick = () => { Store.set({ vibration: !Store.data.vibration }); applySettings(); Sfx.buzz(30); refreshHome(); };
$('#btnUndo').onclick = doUndo;
$('#btnRestart').onclick = () => {
  if (inputLocked) return;
  Sfx.click();
  if (mode === 'daily') startDaily(); else startLevel(current);
};
$('#btnMarkers').onclick = () => {
  markersOn = !renderer.showMarkers;
  renderer.showMarkers = markersOn;
  Sfx.click();
  updateHud();
};
$('#btnHint').onclick = () => { Sfx.click(); showHint(); };
$('#btnNext').onclick = () => { Sfx.click(); nextLevel(); };
$('#btnReplay').onclick = () => {
  Sfx.click();
  $('#winModal').classList.add('hidden');
  if (mode === 'daily') startDaily(); else startLevel(current);
};
$('#btnTimeRetry').onclick = () => {
  Sfx.click();
  $('#timeModal').classList.add('hidden');
  if (mode === 'daily') startDaily(); else startLevel(current);
};
$('#btnTimeMore').onclick = async () => {
  $('#timeModal').classList.add('hidden');
  const ok = await Ads.rewarded();
  if (ok) {
    timeLeft = CONFIG.timer.extraRewarded;
    inputLocked = false;
    lastTick = performance.now();
    toast(t('time_plus', { n: CONFIG.timer.extraRewarded }));
    updateTimer();
  } else {
    toast(t('ad_unavailable'));
    $('#timeModal').classList.remove('hidden');
  }
};
$('#btnHintCancel').onclick = () => $('#hintModal').classList.add('hidden');
$('#btnHintWatch').onclick = async () => {
  $('#hintModal').classList.add('hidden');
  const kind = rewardAction;
  const ok = await Ads.rewarded();
  if (!ok) { toast(t('ad_unavailable')); return; }
  if (kind === 'undo') {
    undosLeft += CONFIG.undo.perRewarded;
    toast(t('undo_plus', { n: CONFIG.undo.perRewarded }));
  } else {
    Store.set({ hints: Store.data.hints + CONFIG.hints.perRewarded });
    toast(t('hints_plus', { n: CONFIG.hints.perRewarded }));
  }
  updateHud();
};
$('#btnNoAds').onclick = async () => {
  // Integração de compra: ver docs/PUBLICACAO.md (RevenueCat).
  toast(t('purchase_na'));
};

function applySettings() {
  Sfx.enabled = Store.data.sound;
  Sfx.vibration = Store.data.vibration;
}

// ------------------------------------------------------------- loop
function frame(now) {
  tickTimer(now);
  if (game && $('#play').classList.contains('active') && (renderer.dirty || renderer.animating)) {
    renderer.draw(now);
  }
  requestAnimationFrame(frame);
}

window.addEventListener('resize', () => renderer.resize());

// ------------------------------------------------------------- inicialização
async function boot() {
  setLang(Store.data.lang || detectLang());
  applyI18n();
  applyTheme();
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
  const native = !!(cap && cap.isNativePlatform && cap.isNativePlatform());
  if (native && cap.registerPlugin) {
    const App = cap.registerPlugin('App');
    App.addListener('backButton', () => {
      if (isOpen('#winModal') || isOpen('#timeModal')) return;
      if (isOpen('#hintModal')) { $('#hintModal').classList.add('hidden'); return; }
      if ($('#home').classList.contains('active')) App.exitApp();
      else show('home');
    });
  }

  // PWA offline (somente web)
  if ('serviceWorker' in navigator && !native && location.protocol === 'https:') {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
}
boot();

// Ganchos para testes/depuração no console
window.__desata = { startLevel, startDaily, get game() { return game; }, Store, renderer,
  get timeLeft() { return timeLeft; }, setTime(v) { timeLeft = v; updateTimer(); } };
