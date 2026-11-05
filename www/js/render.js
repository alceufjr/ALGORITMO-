// Renderização em Canvas 2D: furos, cordas trançadas, pinos, dicas e confete.

function shade(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  if (amt < 0) { r *= 1 + amt; g *= 1 + amt; b *= 1 + amt; }
  else { r += (255 - r) * amt; g += (255 - g) * amt; b += (255 - b) * amt; }
  return `rgb(${r | 0},${g | 0},${b | 0})`;
}

const ease = (t) => 1 - Math.pow(1 - t, 3);

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
    this.ropeW = Math.max(6, cell * 0.17);
  }

  pegPos(id) {
    const p = this.g.pegs[id];
    return { x: this.ox + p.x * this.cell, y: this.oy + p.y * this.cell };
  }
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
    const occ = new Set(g.ropes.flatMap((r) => r.ends));
    g.pegs.forEach((_, i) => {
      const p = this.pegPos(i);
      const target = this.drag && this.drag.target === i;
      ctx.beginPath();
      ctx.arc(p.x, p.y, this.pegR, 0, Math.PI * 2);
      ctx.fillStyle = target ? '#ffe9a8' : '#d8cdc6';
      ctx.fill();
      ctx.beginPath();
      ctx.arc(p.x, p.y + 1.5, this.pegR * 0.78, 0, Math.PI * 2);
      ctx.fillStyle = target ? '#ffd45c' : occ.has(i) ? '#c9bdb5' : '#cbbfb7';
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

    // cordas (na ordem de profundidade); pontas sempre por cima p/ continuarem agarráveis
    const pos = {};
    for (const id of g.order) {
      const r = g.ropes[id];
      pos[id] = [this.endPos(id, 0, now), this.endPos(id, 1, now)];
      const lifted = this.drag && this.drag.ropeId === id;
      this.drawRope(pos[id][0], pos[id][1], r.color, lifted, pulse);
    }
    for (const id of g.order) {
      const r = g.ropes[id];
      const lifted = this.drag && this.drag.ropeId === id;
      this.drawBall(pos[id][0], r.color, lifted && this.drag.end === 0);
      this.drawBall(pos[id][1], r.color, lifted && this.drag.end === 1);
    }

    // marcadores de cruzamento (tutorial / acessibilidade)
    if (this.showMarkers && !this.drag && !this.winT) {
      for (const p of g.state.points) {
        const s = this.toScreen(p.x, p.y);
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

  drawRope(a, b, color, lifted, pulse) {
    const ctx = this.ctx;
    const w = this.ropeW * (lifted ? 1.12 : 1);
    const dx = b.x - a.x, dy = b.y - a.y;
    const len = Math.hypot(dx, dy) || 1;
    const ux = dx / len, uy = dy / len;
    const nx = -uy, ny = ux;

    ctx.lineCap = 'round';
    // sombra
    ctx.strokeStyle = lifted ? 'rgba(0,0,0,.22)' : 'rgba(60,30,20,.16)';
    ctx.lineWidth = w + 2;
    const so = lifted ? 7 : 3;
    ctx.beginPath(); ctx.moveTo(a.x + so * 0.4, a.y + so); ctx.lineTo(b.x + so * 0.4, b.y + so); ctx.stroke();
    // contorno
    ctx.strokeStyle = '#2b1d1a';
    ctx.lineWidth = w + 4;
    ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
    // corpo
    ctx.strokeStyle = pulse ? shade(color, 0.25 * pulse) : color;
    ctx.lineWidth = w;
    ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
    // trança: listras diagonais
    ctx.save();
    ctx.lineCap = 'butt';
    ctx.strokeStyle = shade(color, -0.22);
    ctx.lineWidth = Math.max(1.5, w * 0.2);
    const step = w * 0.85;
    const half = w * 0.44;
    ctx.beginPath();
    for (let t = step * 0.5; t < len; t += step) {
      const px = a.x + ux * t, py = a.y + uy * t;
      ctx.moveTo(px + nx * half - ux * w * 0.3, py + ny * half - uy * w * 0.3);
      ctx.lineTo(px - nx * half + ux * w * 0.3, py - ny * half + uy * w * 0.3);
    }
    ctx.stroke();
    // brilho
    ctx.strokeStyle = 'rgba(255,255,255,.28)';
    ctx.lineWidth = Math.max(1, w * 0.16);
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(a.x + nx * w * 0.22, a.y + ny * w * 0.22);
    ctx.lineTo(b.x + nx * w * 0.22, b.y + ny * w * 0.22);
    ctx.stroke();
    ctx.restore();
  }

  drawBall(p, color, lifted) {
    const ctx = this.ctx;
    const R = this.pegR * (lifted ? 1.15 : 1);
    const y = p.y - (lifted ? 4 : 0);
    ctx.beginPath();
    ctx.arc(p.x, y, R + 2, 0, Math.PI * 2);
    ctx.fillStyle = '#2b1d1a';
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
    ctx.strokeStyle = '#2b1d1a';
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
