// Progresso salvo localmente (localStorage funciona também dentro do app nativo).
import { CONFIG } from './config.js';

const KEY = 'desata.save.v1';

const defaults = () => ({
  unlocked: 1,          // maior fase liberada
  stars: {},            // { [fase]: 1..3 }
  hints: CONFIG.hints.initial,
  sound: true,
  vibration: true,
  noAds: false,         // true após compra "Remover anúncios"
  levelsSinceAd: 0,
  completed: 0,
  lang: null,           // null = idioma do aparelho
  theme: 'classic',
  ownedThemes: ['classic'],
  daily: { last: null, streak: 0, best: 0, done: {} }, // done: { 'AAAA-MM-DD': estrelas }
});

let data = defaults();
try {
  const raw = localStorage.getItem(KEY);
  if (raw) data = { ...defaults(), ...JSON.parse(raw) };
} catch { /* modo privado / bloqueado */ }

export const Store = {
  get data() { return data; },
  save() {
    try { localStorage.setItem(KEY, JSON.stringify(data)); } catch { /* ignora */ }
  },
  set(patch) { Object.assign(data, patch); this.save(); },
  totalStars() { return Object.values(data.stars).reduce((a, b) => a + b, 0); },
  completeLevel(n, stars) {
    data.stars[n] = Math.max(data.stars[n] || 0, stars);
    data.unlocked = Math.max(data.unlocked, n + 1);
    data.completed++;
    this.save();
  },
  /** Registra o desafio diário concluído e atualiza a sequência de dias. */
  completeDaily(dateKey, stars) {
    const d = data.daily;
    const first = !d.done[dateKey];
    d.done[dateKey] = Math.max(d.done[dateKey] || 0, stars);
    if (first) {
      const y = new Date(dateKey + 'T12:00:00');
      y.setDate(y.getDate() - 1);
      const p = (x) => String(x).padStart(2, '0');
      const yKey = `${y.getFullYear()}-${p(y.getMonth() + 1)}-${p(y.getDate())}`;
      d.streak = d.last === yKey ? d.streak + 1 : 1;
      d.best = Math.max(d.best, d.streak);
      d.last = dateKey;
    }
    this.save();
    return first;
  },
  /** Sequência vigente (zera se pulou um dia). */
  currentStreak(todayKey) {
    const d = data.daily;
    if (!d.last) return 0;
    const diff = Math.round((new Date(todayKey + 'T12:00:00') - new Date(d.last + 'T12:00:00')) / 864e5);
    return diff <= 1 ? d.streak : 0;
  },
  reset() { data = defaults(); this.save(); },
};
