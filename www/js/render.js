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

/** Pontos mais próximos entre dois segmentos que não se cruzam (t, u = posição em cada um). */
function closestPoints(a, b, c, d) {
  const proj = (p, s0, s1) => {
    const dx = s1.x - s0.x, dy = s1.y - s0.y;
    const l2 = dx * dx + dy * dy || 1;
    const t = Math.max(0, Math.min(1, ((p.x - s0.x) * dx + (p.y - s0.y) * dy) / l2));
    return { t, x: s0.x + dx * t, y: s0.y + dy * t };
  };
  const cands = [];
  for (const [p, tp] of [[a, 0], [b, 1]]) {
    const q = proj(p, c, d);
    cands.push({ d: Math.hypot(q.x - p.x, q.y - p.y), p: { x: p.x, y: p.y }, q, t: tp, u: q.t });
  }
  for (const [p, up] of [[c, 0], [d, 1]]) {
    const q = proj(p, a, b);
    cands.push({ d: Math.hypot(q.x - p.x, q.y - p.y), p: { x: q.x, y: q.y }, q: { x: p.x, y: p.y }, t: q.t, u: up });
  }
  cands.sort((x, y) => x.d - y.d);
  const m = cands[0];
  // afasta um pouco das pontas para o enrosco não ficar sob a bolinha
  return { p: m.p, q: m.q, t: Math.min(0.92, Math.max(0.08, m.t)), u: Math.min(0.92, Math.max(0.08, m.u)) };
}

function unit(x, y) { const l = Math.hypot(x, y) || 1; return { x: x / l, y: y / l }; }


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
    this.layers = new Map();
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

    // ---- cordas ----------------------------------------------------------
    // 1) pontas na tela   2) cruzamentos + quem passa por cima
    // 3) em cada cruzamento com espaço, os dois fios se TORCEM juntos (enrosco)
    // 4) desenha cada corda como caminho; 5) refaz o "por cima" em cada ponto da torção
    const pos = {};
    for (const id of g.order) pos[id] = [this.endPos(id, 0, now), this.endPos(id, 1, now)];
    const list = this.weave(pos);
    this.computeTwists(pos, list);
    const paths = {};
    for (const id of g.order) paths[id] = this.ropePath(+id, pos, list);
    const dragged = this.drag ? this.drag.ropeId : -1;

    for (const id of g.order) {
      this.drawRope(paths[id], g.ropes[id].color, id === dragged, pulse);
    }
    this.drawCrossings(paths, list, pulse);

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
   * Torção: perto do enrosco os dois fios são puxados um para o outro e dão |K|
   * meias-voltas ao longo da bissetriz (ímpar: saem trocados = cruzados;
   * par: voltam ao próprio lado = enganchados). Sem espaço, uma volta simples
   * vira um cruzamento comum; enganches são sempre desenhados.
   */
  computeTwists(pos, list) {
    const w = this.ropeW;
    const per = {};
    for (const c of list) { (per[c.i] ||= []).push(c); (per[c.j] ||= []).push(c); }
    const room = new Map();
    for (const [key, arr] of Object.entries(per)) {
      const r = +key;
      const [a, b] = pos[r];
      const len = Math.hypot(b.x - a.x, b.y - a.y);
      const tOf = (c) => (c.i === r ? c.ti : c.tj);
      arr.sort((x, y) => tOf(x) - tOf(y));
      arr.forEach((c, k) => {
        const d = tOf(c) * len;
        const prev = k > 0 ? (d - tOf(arr[k - 1]) * len) / 2 : d - this.pegR * 1.2;
        const next = k < arr.length - 1 ? (tOf(arr[k + 1]) * len - d) / 2 : len - d - this.pegR * 1.2;
        room.set(c, Math.min(room.has(c) ? room.get(c) : Infinity, prev, next));
      });
    }
    for (const c of list) {
      const turns = Math.min(Math.abs(c.k), 6);
      let half = Math.min(w * 2.7, room.get(c) - w * 0.15);
      c.twist = null;
      if (turns === 1 && half < w * 0.6) continue;           // cruzamento simples
      if (turns > 1) half = Math.max(half, w * 0.55 * turns); // enganche: sempre visível
      const [a1, b1] = pos[c.i], [a2, b2] = pos[c.j];
      const d1 = unit(b1.x - a1.x, b1.y - a1.y);
      let d2 = unit(b2.x - a2.x, b2.y - a2.y);
      const flipJ = d1.x * d2.x + d1.y * d2.y < 0;
      if (flipJ) d2 = { x: -d2.x, y: -d2.y };
      const u = unit(d1.x + d2.x, d1.y + d2.y);
      const n = { x: -u.y, y: u.x };
      let sideI;
      if (c.crossing) sideI = -(d1.x * n.x + d1.y * n.y) >= 0 ? 1 : -1;
      else sideI = (c.pi.x - c.x) * n.x + (c.pi.y - c.y) * n.y >= 0 ? 1 : -1;
      const amp = turns === 1 ? Math.min(w * 0.45, half * 0.45) : w * 0.5;
      c.twist = {
        S: { x: c.x - u.x * half, y: c.y - u.y * half }, u, n, L: half * 2, amp, turns,
        side: { [c.i]: sideI, [c.j]: -sideI },
        flip: { [c.i]: false, [c.j]: flipJ },
      };
    }
  }

  twistPoint(T, s, side) {
    const off = side * T.amp * Math.cos((T.turns * Math.PI * s) / T.L);
    return { x: T.S.x + T.u.x * s + T.n.x * off, y: T.S.y + T.u.y * s + T.n.y * off };
  }

  /** Caminho da corda: reta entre as pontas, desviando para cada torção. */
  ropePath(r, pos, list) {
    const [a, b] = pos[r];
    const mine = list.filter((c) => c.twist && (c.i === r || c.j === r))
      .sort((x, y) => (x.i === r ? x.ti : x.tj) - (y.i === r ? y.ti : y.tj));
    const pts = [a];
    const N = 18;
    for (const c of mine) {
      const T = c.twist;
      for (let k = 0; k <= N; k++) {
        const s = (T.flip[r] ? N - k : k) / N * T.L;
        pts.push(this.twistPoint(T, s, T.side[r]));
      }
    }
    pts.push(b);
    return pts;
  }

  /** Refaz o fio de cima em cada ponto de cruzamento, com sombra no de baixo. */
  drawCrossings(paths, list, pulse) {
    const ctx = this.ctx;
    const g = this.g;
    const dragged = this.drag ? this.drag.ropeId : -1;
    const spots = [];
    for (const c of list) {
      const other = c.over === c.i ? c.j : c.i;
      if (c.twist) {
        // na torção os fios se cruzam 1 ou 3 vezes, alternando por cima / por baixo
        const T = c.twist;
        for (let k = 0; k < T.turns; k++) {
          const top = k % 2 === 0 ? c.over : other;
          const bottom = top === c.over ? other : c.over;
          const s = T.L * (2 * k + 1) / (2 * T.turns);
          const r = Math.min(this.ropeW * (T.turns === 1 ? 1.3 : 0.95), (T.L / T.turns) * 0.55 + this.ropeW * 0.3);
          spots.push({ top, bottom, x: T.S.x + T.u.x * s, y: T.S.y + T.u.y * s, r });
        }
      } else {
        spots.push({ top: c.over, bottom: other, x: c.x, y: c.y, r: this.ropeW * 1.6 });
      }
    }
    // a arrastada por último, para nunca ficar coberta
    spots.sort((p, q) => (p.top === dragged) - (q.top === dragged));
    for (const p of spots) {
      ctx.save();
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.clip();
      ctx.drawImage(this.ropeLayer(p.bottom, paths[p.bottom], g.ropes[p.bottom].color, p.bottom === dragged, pulse), 0, 0, this.w, this.h);
      // sombra só sobre o fio de baixo: anéis concêntricos da versão escura dele
      const dark = this.ropeLayer(p.bottom, paths[p.bottom], g.ropes[p.bottom].color, p.bottom === dragged, pulse, true);
      for (const k of [1, 0.72, 0.45]) {
        ctx.save();
        ctx.beginPath();
        ctx.arc(p.x + 1, p.y + 2, p.r * k, 0, Math.PI * 2);
        ctx.clip();
        ctx.globalAlpha = 0.3;
        ctx.drawImage(dark, 0, 0, this.w, this.h);
        ctx.restore();
      }
      ctx.drawImage(this.ropeLayer(p.top, paths[p.top], g.ropes[p.top].color, p.top === dragged, pulse), 0, 0, this.w, this.h);
      ctx.restore();
    }
  }

  /** Camada fora da tela com a corda desenhada (em cache até ela mudar). */
  ropeLayer(id, pts, color, lifted, pulse, dark = false) {
    this.layers ||= new Map();
    const key = pts.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(';') +
      [color, lifted, pulse, this.c.width, this.c.height, this.ropeW].join();
    const slot = dark ? `${id}d` : id;
    let L = this.layers.get(slot);
    if (L && L.key === key) return L.canvas;
    if (!L) { L = { canvas: document.createElement('canvas') }; this.layers.set(slot, L); }
    const cv = L.canvas;
    if (cv.width !== this.c.width || cv.height !== this.c.height) { cv.width = this.c.width; cv.height = this.c.height; }
    const lc = cv.getContext('2d');
    lc.setTransform(1, 0, 0, 1, 0, 0);
    lc.clearRect(0, 0, cv.width, cv.height);
    lc.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    const main = this.ctx;
    this.ctx = lc;
    try { this.drawRope(pts, dark ? '#000000' : color, lifted, pulse); } finally { this.ctx = main; }
    L.key = key;
    return cv;
  }

  /** Desenha uma corda trançada ao longo de um caminho (lista de pontos). */
  drawRope(pts, color, lifted, pulse) {
    const ctx = this.ctx;
    const w = this.ropeW * (lifted ? 1.12 : 1);
    const line = (dx = 0, dy = 0) => {
      ctx.beginPath();
      ctx.moveTo(pts[0].x + dx, pts[0].y + dy);
      for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x + dx, pts[i].y + dy);
    };
    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    // sombra
    const so = lifted ? 7 : 3;
    ctx.strokeStyle = lifted ? 'rgba(0,0,0,.22)' : 'rgba(60,30,20,.16)';
    ctx.lineWidth = w + 2;
    line(so * 0.4, so); ctx.stroke();
    // contorno + corpo
    ctx.strokeStyle = this.board.outline;
    ctx.lineWidth = w + 5;
    line(); ctx.stroke();
    ctx.strokeStyle = pulse ? shade(color, 0.25 * pulse) : color;
    ctx.lineWidth = w;
    line(); ctx.stroke();
    // trança: listras diagonais ao longo do comprimento (segue as curvas)
    ctx.lineCap = 'butt';
    ctx.strokeStyle = shade(color, -0.22);
    ctx.lineWidth = Math.max(1.5, w * 0.2);
    const step = w * 0.85, half = w * 0.42;
    let carry = step * 0.5;
    ctx.beginPath();
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1], b = pts[i];
      const len = Math.hypot(b.x - a.x, b.y - a.y);
      if (len < 0.01) continue;
      const ux = (b.x - a.x) / len, uy = (b.y - a.y) / len, nx = -uy, ny = ux;
      let t = carry;
      for (; t < len; t += step) {
        const px = a.x + ux * t, py = a.y + uy * t;
        ctx.moveTo(px + nx * half - ux * w * 0.3, py + ny * half - uy * w * 0.3);
        ctx.lineTo(px - nx * half + ux * w * 0.3, py - ny * half + uy * w * 0.3);
      }
      carry = t - len;
    }
    ctx.stroke();
    // brilho (deslocado para um lado de cada trecho)
    ctx.strokeStyle = 'rgba(255,255,255,.28)';
    ctx.lineWidth = Math.max(1, w * 0.16);
    ctx.lineCap = 'round';
    ctx.beginPath();
    for (let i = 0; i < pts.length; i++) {
      const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)];
      const l = Math.hypot(b.x - a.x, b.y - a.y) || 1;
      const ox = (-(b.y - a.y) / l) * w * 0.22, oy = ((b.x - a.x) / l) * w * 0.22;
      if (i === 0) ctx.moveTo(pts[i].x + ox, pts[i].y + oy); else ctx.lineTo(pts[i].x + ox, pts[i].y + oy);
    }
    ctx.stroke();
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
