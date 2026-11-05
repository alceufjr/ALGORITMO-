import { buildRopes, zRuns } from './ropes.js';
// Renderização em Canvas 2D: furos, cordas trançadas, pinos, dicas e confete.

function shade(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  if (amt < 0) { r *= 1 + amt; g *= 1 + amt; b *= 1 + amt; }
  else { r += (255 - r) * amt; g += (255 - g) * amt; b += (255 - b) * amt; }
  return `rgb(${r | 0},${g | 0},${b | 0})`;
}

const ease = (t) => 1 - Math.pow(1 - t, 3);

/** Interseção própria de dois segmentos (t, u = posição ao longo de cada um, 0..1). */
function segCross(a, b, c, d) {
  const rx = b.x - a.x, ry = b.y - a.y, sx = d.x - c.x, sy = d.y - c.y;
  const den = rx * sy - ry * sx;
  if (Math.abs(den) < 1e-9) return null;
  const t = ((c.x - a.x) * sy - (c.y - a.y) * sx) / den;
  const u = ((c.x - a.x) * ry - (c.y - a.y) * rx) / den;
  if (t <= 0.001 || t >= 0.999 || u <= 0.001 || u >= 0.999) return null;
  return { x: a.x + t * rx, y: a.y + t * ry, t, u };
}

/**
 * Onde desenhar um ENGANCHE entre dois segmentos que não se cruzam: o trecho de
 * maior aproximação. Para cordas quase paralelas, o meio do trecho em que estão
 * igualmente próximas (e não uma das pontas).
 */
function closestPoints(a, b, c, d) {
  const proj = (p, s0, s1) => {
    const dx = s1.x - s0.x, dy = s1.y - s0.y;
    const l2 = dx * dx + dy * dy || 1;
    const t = Math.max(0, Math.min(1, ((p.x - s0.x) * dx + (p.y - s0.y) * dy) / l2));
    return { t, x: s0.x + dx * t, y: s0.y + dy * t };
  };
  const samples = [];
  for (let k = 0; k <= 24; k++) {
    const t = 0.12 + (0.76 * k) / 24;
    const p = { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
    const q = proj(p, c, d);
    if (q.t < 0.12 || q.t > 0.88) continue;
    samples.push({ t, u: q.t, p, q, d: Math.hypot(q.x - p.x, q.y - p.y) });
  }
  if (!samples.length) {
    const p = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    const q = proj(p, c, d);
    return { p, q, t: 0.5, u: Math.min(0.88, Math.max(0.12, q.t)) };
  }
  const min = Math.min(...samples.map((x) => x.d));
  const near = samples.filter((x) => x.d <= min * 1.04 + 0.5);
  const m = near[Math.floor(near.length / 2)];
  return { p: m.p, q: m.q, t: m.t, u: m.u };
}

export class Renderer {
  constructor(canvas) {
    this.c = canvas;
    this.ctx = canvas.getContext('2d');
    this.g = null;
    this.drag = null;       // {ropeId,end,x,y,target}
    this.snap = null;       // animação de encaixe
    this.hint = null;       // {ropeId,end,to,t0}
    this.particles = [];
    this.showMarkers = false;
    this.board = { peg: '#d8cdc6', pegInner: '#cbbfb7', outline: '#2b1d1a' }; // cores do tema
    this.winT = 0;
    this.dirty = true;
    this.resize();
  }

  resize() {
    const r = this.c.getBoundingClientRect();
    this.dpr = Math.min(window.devicePixelRatio || 1, 3);
    this.w = Math.max(1, r.width);
    this.h = Math.max(1, r.height);
    this.c.width = Math.round(this.w * this.dpr);
    this.c.height = Math.round(this.h * this.dpr);
    this.layout();
    this.dirty = true;
  }

  setGame(g) {
    this.g = g;
    this.drag = this.snap = this.hint = null;
    this.particles = [];
    this.winT = 0;
    this.layout();
    this.dirty = true;
  }

  layout() {
    if (!this.g) return;
    const { cols, rows } = this.g.level;
    const cell = Math.min(this.w / (cols + 0.3), this.h / (rows + 0.3), 120);
    this.cell = cell;
    this.ox = (this.w - (cols - 1) * cell) / 2;
    this.oy = (this.h - (rows - 1) * cell) / 2;
    this.pegR = cell * 0.27;
    this.ropeW = Math.max(7, cell * 0.2);
  }

  pegPos(id) {
    const p = this.g.pegs[id];
    return { x: this.ox + p.x * this.cell, y: this.oy + p.y * this.cell };
  }
  toGrid(x, y) { return { x: (x - this.ox) / this.cell, y: (y - this.oy) / this.cell }; }
  toScreen(gx, gy) { return { x: this.ox + gx * this.cell, y: this.oy + gy * this.cell }; }

  endPos(ropeId, end, now) {
    if (this.drag && this.drag.ropeId === ropeId && this.drag.end === end) return { x: this.drag.x, y: this.drag.y };
    if (this.snap && this.snap.ropeId === ropeId && this.snap.end === end) {
      const t = Math.min(1, (now - this.snap.t0) / 140);
      const to = this.pegPos(this.g.ropes[ropeId].ends[end]);
      if (t >= 1) { this.snap = null; return to; }
      const k = ease(t);
      return { x: this.snap.x + (to.x - this.snap.x) * k, y: this.snap.y + (to.y - this.snap.y) * k };
    }
    return this.pegPos(this.g.ropes[ropeId].ends[end]);
  }

  hitEnd(x, y) {
    const order = this.g.order;
    let best = null, bd = this.cell * 0.48;
    for (let i = order.length - 1; i >= 0; i--) {
      const r = this.g.ropes[order[i]];
      for (let e = 0; e < 2; e++) {
        const p = this.pegPos(r.ends[e]);
        const d = Math.hypot(p.x - x, p.y - y);
        if (d < bd - 0.5) { bd = d; best = { ropeId: r.id, end: e }; }
      }
    }
    return best;
  }

  pegAt(x, y) {
    let best = -1, bd = this.cell * 0.55;
    this.g.pegs.forEach((_, i) => {
      const p = this.pegPos(i);
      const d = Math.hypot(p.x - x, p.y - y);
      if (d < bd) { bd = d; best = i; }
    });
    return best;
  }

  burst(n = 120) {
    const colors = this.g.ropes.map((r) => r.color);
    for (let i = 0; i < n; i++) {
      this.particles.push({
        x: this.w / 2 + (Math.random() - 0.5) * this.w * 0.4,
        y: this.h * 0.35,
        vx: (Math.random() - 0.5) * 12,
        vy: -Math.random() * 12 - 4,
        r: 3 + Math.random() * 5,
        a: Math.random() * Math.PI,
        va: (Math.random() - 0.5) * 0.4,
        c: colors[i % colors.length],
        life: 1,
      });
    }
  }

  get animating() {
    return !!(this.drag || this.snap || this.hint || this.particles.length || this.winT);
  }

  // -------------------------------------------------------------- desenho
  draw(now) {
    const ctx = this.ctx;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.clearRect(0, 0, this.w, this.h);
    if (!this.g) return;
    const g = this.g;

    // furos
    g.pegs.forEach((_, i) => {
      const p = this.pegPos(i);
      const target = this.drag && this.drag.target === i;
      ctx.beginPath();
      ctx.arc(p.x, p.y, this.pegR, 0, Math.PI * 2);
      ctx.fillStyle = target ? '#ffe9a8' : this.board.peg;
      ctx.fill();
      ctx.beginPath();
      ctx.arc(p.x, p.y + 1.5, this.pegR * 0.78, 0, Math.PI * 2);
      ctx.fillStyle = target ? '#ffd45c' : this.board.pegInner;
      ctx.fill();
      if (target) {
        ctx.lineWidth = 3;
        ctx.strokeStyle = '#ffb703';
        ctx.beginPath();
        ctx.arc(p.x, p.y, this.pegR + 4 + Math.sin(now / 120) * 2, 0, Math.PI * 2);
        ctx.stroke();
      }
    });

    const pulse = this.winT ? 0.5 + 0.5 * Math.sin(now / 90) : 0;

    // ---- cordas: física 2.5D (ropes.js) + desenho por trechos ordenados em z ----
    const pos = {};
    for (const id of g.order) pos[id] = [this.endPos(id, 0, now), this.endPos(id, 1, now)];
    const dragged = this.drag ? this.drag.ropeId : -1;
    const tangles = this.weave(pos);
    const paths = buildRopes(pos, tangles, { w: this.ropeW, endR: this.pegR, lifted: dragged });
    this.drawRopes(paths, pulse);

    for (const id of g.order) {
      const r = g.ropes[id];
      const lifted = id === dragged;
      this.drawBall(pos[id][0], r.color, lifted && this.drag.end === 0);
      this.drawBall(pos[id][1], r.color, lifted && this.drag.end === 1);
    }

    // marcadores de cruzamento (tutorial / acessibilidade)
    if (this.showMarkers && !this.drag && !this.winT) {
      for (const s of this.lastList || []) {
        ctx.beginPath();
        ctx.arc(s.x, s.y, this.ropeW * 0.75, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(230,57,70,.92)';
        ctx.fill();
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2;
        const k = this.ropeW * 0.32;
        ctx.beginPath();
        ctx.moveTo(s.x - k, s.y - k); ctx.lineTo(s.x + k, s.y + k);
        ctx.moveTo(s.x + k, s.y - k); ctx.lineTo(s.x - k, s.y + k);
        ctx.stroke();
      }
    }

    if (this.hint) this.drawHint(now);
    this.drawParticles();
    this.dirty = false;
  }

  /**
   * Enroscos a desenhar, vindos do modelo do jogo (g.K): para cada par com voltas,
   * o ponto onde ficam (cruzamento em linha reta, ou o ponto mais próximo entre as
   * cordas quando estão ENGANCHADAS sem se cruzar) e quem fica por cima.
   */
  weave(pos) {
    const list = [];
    for (const [key, k] of Object.entries(this.g.K)) {
      if (!k) continue;
      const [i, j] = key.split(',').map(Number);
      const p = segCross(pos[i][0], pos[i][1], pos[j][0], pos[j][1]);
      let c;
      if (p) c = { i, j, x: p.x, y: p.y, ti: p.t, tj: p.u, crossing: true };
      else {
        const q = closestPoints(pos[i][0], pos[i][1], pos[j][0], pos[j][1]);
        c = { i, j, x: (q.p.x + q.q.x) / 2, y: (q.p.y + q.q.y) / 2, ti: q.t, tj: q.u, crossing: false, pi: q.p };
      }
      c.k = k;
      c.over = k > 0 ? i : j;
      list.push(c);
    }
    this.lastList = list;
    return list;
  }

  /**
   * Desenha as cordas em 2.5D:
   *  - sombra no chão de todas as cordas;
   *  - trechos ordenados por altura (z). Cada trecho: sombra projetada (se elevado),
   *    contorno preto, cor, listras diagonais e brilho. Assim o contorno do trecho de
   *    cima recobre limpo o trecho de baixo nos cruzamentos.
   * Espessura constante; extremidades dos trechos em "butt" (as pontas reais ficam
   * sob as bolinhas) e junções arredondadas.
   */
  drawRopes(paths, pulse) {
    const ctx = this.ctx;
    const g = this.g;
    const w = this.ropeW;
    const outline = this.board.outline;
    const dragged = this.drag ? this.drag.ropeId : -1;

    // comprimento acumulado (textura contínua ao longo de toda a corda)
    const arc = {};
    for (const [id, P] of Object.entries(paths)) {
      const s = [0];
      for (let k = 1; k < P.length; k++) s.push(s[k - 1] + Math.hypot(P[k].x - P[k - 1].x, P[k].y - P[k - 1].y));
      arc[id] = s;
    }
    const trace = (P, from, to, dx = 0, dy = 0) => {
      ctx.beginPath();
      ctx.moveTo(P[from].x + dx, P[from].y + dy);
      for (let k = from + 1; k <= to; k++) ctx.lineTo(P[k].x + dx, P[k].y + dy);
    };

    ctx.save();
    ctx.lineJoin = 'round';

    // sombra no chão
    ctx.lineCap = 'round';
    for (const id of g.order) {
      const P = paths[id];
      const up = id === dragged;
      ctx.strokeStyle = up ? 'rgba(0,0,0,.2)' : 'rgba(60,30,20,.15)';
      ctx.lineWidth = w + 3;
      trace(P, 0, P.length - 1, up ? 4 : 1.5, up ? 9 : 3.5);
      ctx.stroke();
    }

    ctx.lineCap = 'butt';
    for (const run of zRuns(paths, g.order, w + 5.5)) {
      const P = paths[run.id];
      const color = g.ropes[run.id].color;
      const body = pulse ? shade(color, 0.25 * pulse) : color;
      const { from, to } = run;
      if (to <= from) continue;
      const S = arc[run.id];

      // sombra projetada sobre o que está embaixo — aparada nas emendas com a própria
      // corda (ali ela não toca ninguém) e com pontas redondas, para não deixar corte
      if (run.level >= 2) {
        const trim = Math.ceil((w * 1.3) / Math.max(1, (S[to] - S[from]) / Math.max(1, to - from)));
        const f2 = from === 0 ? 0 : Math.min(to, from + trim);
        const t2 = to === P.length - 1 ? to : Math.max(f2, to - trim);
        if (t2 > f2) {
          ctx.save();
          ctx.lineCap = 'round';
          ctx.strokeStyle = 'rgba(0,0,0,.24)';
          ctx.lineWidth = w + 2;
          trace(P, f2, t2, 1.5, run.level === 3 ? 8 : 4);
          ctx.stroke();
          ctx.restore();
        }
      }
      // contorno preto (primeiro), depois a cor
      ctx.strokeStyle = outline;
      ctx.lineWidth = w + 5;
      trace(P, from, to); ctx.stroke();
      ctx.strokeStyle = body;
      ctx.lineWidth = w;
      trace(P, from, to); ctx.stroke();

      // listras diagonais da trança, posicionadas pelo comprimento de arco
      const stepS = w * 0.85, half = w * 0.42;
      ctx.strokeStyle = shade(color, -0.24);
      ctx.lineWidth = Math.max(1.5, w * 0.2);
      ctx.beginPath();
      let k = from;
      for (let sv = Math.ceil(S[from] / stepS) * stepS + stepS * 0.5; sv < S[to]; sv += stepS) {
        while (k < to - 1 && S[k + 1] < sv) k++;
        const a = P[k], b = P[k + 1];
        const seg = S[k + 1] - S[k] || 1;
        const f = (sv - S[k]) / seg;
        const px = a.x + (b.x - a.x) * f, py = a.y + (b.y - a.y) * f;
        const ux = (b.x - a.x) / seg, uy = (b.y - a.y) / seg, nx = -uy, ny = ux;
        ctx.moveTo(px + nx * half - ux * w * 0.3, py + ny * half - uy * w * 0.3);
        ctx.lineTo(px - nx * half + ux * w * 0.3, py - ny * half + uy * w * 0.3);
      }
      ctx.stroke();

      // brilho cilíndrico (faixa clara deslocada para um lado)
      ctx.strokeStyle = 'rgba(255,255,255,.3)';
      ctx.lineWidth = Math.max(1, w * 0.16);
      ctx.beginPath();
      for (let q = from; q <= to; q++) {
        const a = P[Math.max(0, q - 1)], b = P[Math.min(P.length - 1, q + 1)];
        const l = Math.hypot(b.x - a.x, b.y - a.y) || 1;
        const ox = (-(b.y - a.y) / l) * w * 0.22, oy = ((b.x - a.x) / l) * w * 0.22;
        if (q === from) ctx.moveTo(P[q].x + ox, P[q].y + oy); else ctx.lineTo(P[q].x + ox, P[q].y + oy);
      }
      ctx.stroke();
    }
    ctx.restore();
  }

  drawBall(p, color, lifted) {
    const ctx = this.ctx;
    const R = this.pegR * (lifted ? 1.15 : 1);
    const y = p.y - (lifted ? 4 : 0);
    ctx.beginPath();
    ctx.arc(p.x, y, R + 2, 0, Math.PI * 2);
    ctx.fillStyle = this.board.outline;
    ctx.fill();
    ctx.beginPath();
    ctx.arc(p.x, y, R, 0, Math.PI * 2);
    ctx.fillStyle = shade(color, 0.55);
    ctx.fill();
    const gr = ctx.createRadialGradient(p.x - R * 0.3, y - R * 0.35, R * 0.1, p.x, y, R * 0.8);
    gr.addColorStop(0, shade(color, 0.6));
    gr.addColorStop(0.45, color);
    gr.addColorStop(1, shade(color, -0.3));
    ctx.beginPath();
    ctx.arc(p.x, y, R * 0.76, 0, Math.PI * 2);
    ctx.fillStyle = gr;
    ctx.fill();
    ctx.strokeStyle = 'rgba(43,29,26,.55)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(p.x - R * 0.25, y - R * 0.32, R * 0.22, R * 0.13, -0.6, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,255,255,.75)';
    ctx.fill();
  }

  drawHint(now) {
    const ctx = this.ctx;
    const h = this.hint;
    const el = (now - h.t0) / 1000;
    if (el > 6) { this.hint = null; return; }
    const from = this.pegPos(this.g.ropes[h.ropeId].ends[h.end]);
    const to = this.pegPos(h.to);
    const k = ease((el % 1.4) / 1.1 > 1 ? 1 : (el % 1.4) / 1.1);
    ctx.save();
    ctx.setLineDash([8, 8]);
    ctx.lineDashOffset = -now / 30;
    ctx.strokeStyle = 'rgba(43,29,26,.7)';
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(from.x, from.y); ctx.lineTo(to.x, to.y); ctx.stroke();
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.arc(to.x, to.y, this.pegR + 6 + Math.sin(now / 150) * 3, 0, Math.PI * 2);
    ctx.strokeStyle = '#ffb703';
    ctx.lineWidth = 4;
    ctx.stroke();
    // "mãozinha" fantasma
    const x = from.x + (to.x - from.x) * k, y = from.y + (to.y - from.y) * k;
    ctx.globalAlpha = 0.85;
    ctx.beginPath();
    ctx.arc(x, y, this.pegR * 0.75, 0, Math.PI * 2);
    ctx.fillStyle = '#fff';
    ctx.fill();
    ctx.strokeStyle = this.board.outline;
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.restore();
  }

  drawParticles() {
    const ctx = this.ctx;
    for (const p of this.particles) {
      p.vy += 0.35; p.vx *= 0.99;
      p.x += p.vx; p.y += p.vy; p.a += p.va;
      p.life -= 0.008;
      ctx.save();
      ctx.globalAlpha = Math.max(0, p.life);
      ctx.translate(p.x, p.y);
      ctx.rotate(p.a);
      ctx.fillStyle = p.c;
      ctx.fillRect(-p.r, -p.r * 0.5, p.r * 2, p.r);
      ctx.restore();
    }
    this.particles = this.particles.filter((p) => p.life > 0 && p.y < this.h + 40);
  }
}
