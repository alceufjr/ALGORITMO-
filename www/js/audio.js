// Efeitos sonoros sintetizados (sem arquivos de áudio => sem problemas de licença).
let ctx = null;
let muted = false;

function ac() {
  if (!ctx) {
    const C = window.AudioContext || window.webkitAudioContext;
    if (!C) return null;
    ctx = new C();
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

function tone(freq, dur, type = 'sine', vol = 0.18, when = 0, slide = 0) {
  const a = ac();
  if (!a || muted) return;
  const t = a.currentTime + when;
  const o = a.createOscillator();
  const g = a.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (slide) o.frequency.exponentialRampToValueAtTime(freq * slide, t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(a.destination);
  o.start(t);
  o.stop(t + dur + 0.02);
}

export const Sfx = {
  enabled: true,
  vibration: true,
  setMuted(m) { muted = m; },
  pick() { if (this.enabled) tone(520, 0.08, 'triangle', 0.15, 0, 1.4); this.buzz(8); },
  drop() { if (this.enabled) tone(330, 0.1, 'triangle', 0.18, 0, 0.7); this.buzz(12); },
  cancel() { if (this.enabled) tone(200, 0.12, 'sine', 0.12, 0, 0.8); },
  tangle() { if (this.enabled) tone(240, 0.07, 'sawtooth', 0.05, 0, 0.8); this.buzz(6); },
  untangle() { if (this.enabled) { tone(660, 0.08, 'sine', 0.12); tone(880, 0.1, 'sine', 0.1, 0.06); } },
  win() {
    if (!this.enabled) return;
    [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.22, 'triangle', 0.16, i * 0.09));
    this.buzz([20, 40, 30]);
  },
  click() { if (this.enabled) tone(440, 0.05, 'square', 0.06); },
  buzz(p) {
    if (this.vibration && navigator.vibrate) { try { navigator.vibrate(p); } catch { /* */ } }
  },
};
