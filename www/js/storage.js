// Progresso salvo localmente (localStorage funciona também dentro do app nativo).
import { CONFIG } from './config.js';

const KEY = 'desenrola.save.v1';

const defaults = () => ({
  unlocked: 1,          // maior fase liberada
  stars: {},            // { [fase]: 1..3 }
  hints: CONFIG.hints.initial,
  sound: true,
  vibration: true,
  noAds: false,         // true após compra "Remover anúncios"
  levelsSinceAd: 0,
  completed: 0,
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
  reset() { data = defaults(); this.save(); },
};
