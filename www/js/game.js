// Estado de uma partida: cordas que se ENROLAM conforme o caminho do arraste.
// Ver o modelo em core.js (sweep). Vence quando nenhum par de cordas tem voltas.
import { sweep, tangleTotal, touchingCount, pegPoints } from './core.js';

const canonK = (K) => JSON.stringify(Object.keys(K).sort().map((k) => [k, K[k]]));

export class Game {
  constructor(level, palette = null) {
    this.level = level;
    this.pegs = level.pegs;
    const color = (r) => (palette ? palette[r.c % palette.length] : r.color || '#888888');
    this.ropes = level.ropes.map((r, i) => ({ id: i, color: color(r), ends: [r.a, r.b] }));
    this.K = { ...(level.twists || {}) };   // voltas entre pares de cordas
    this.order = this.ropes.map((r) => r.id); // ordem de desenho (último = por cima)
    this.moves = 0;
    this.history = [];
    this.live = null;                        // ponta sendo arrastada {r,e,x,y,snap}
    this.refresh();
  }

  get ends() { return this.ropes.map((r) => r.ends); }

  /** Posição (grade) de cada ponta, considerando a ponta em arraste. */
  points() {
    const P = pegPoints(this.pegs, this.ends);
    if (this.live) P[this.live.r][this.live.e] = { x: this.live.x, y: this.live.y };
    return P;
  }

  refresh() {
    const perRope = new Array(this.ropes.length).fill(0);
    for (const [key, v] of Object.entries(this.K)) {
      const [i, j] = key.split(',').map(Number);
      perRope[i] += Math.abs(v);
      perRope[j] += Math.abs(v);
    }
    const twists = tangleTotal(this.K);
    const touching = this.live ? 0 : touchingCount(this.pegs, this.ends);
    this.state = { total: twists + touching, twists, touching, perRope };
  }

  get conflicts() { return this.state.total; }
  get solved() { return !this.live && this.state.total === 0; }

  occupant(pegId) {
    for (const r of this.ropes) {
      if (r.ends[0] === pegId) return { rope: r.id, end: 0 };
      if (r.ends[1] === pegId) return { rope: r.id, end: 1 };
    }
    return null;
  }
  isEmpty(pegId) { return this.occupant(pegId) === null; }

  bringToTop(ropeId) {
    this.order = this.order.filter((id) => id !== ropeId);
    this.order.push(ropeId);
  }

  snapshot() { return { ends: this.ends.map((e) => e.slice()), K: { ...this.K } }; }

  // ------------------------------------------------------------ arraste ao vivo
  beginDrag(r, e) {
    const p = this.pegs[this.ropes[r].ends[e]];
    this.live = { r, e, x: p.x, y: p.y, snap: this.snapshot() };
    this.bringToTop(r);
  }

  /** Acompanha o dedo (coordenadas da grade): enrola/desenrola pelo caminho. */
  dragTo(x, y) {
    if (!this.live) return;
    const P = this.points();
    sweep(P, this.K, this.live.r, this.live.e, { x, y });
    this.live.x = x; this.live.y = y;
    this.refresh();
  }

  /** Solta: vai até o furo escolhido (ou volta ao de origem). Retorna true se contou jogada. */
  endDrag(toPeg) {
    if (!this.live) return false;
    const { r, e, snap } = this.live;
    const from = this.ropes[r].ends[e];
    const ok = toPeg >= 0 && toPeg !== from && this.isEmpty(toPeg);
    const dest = ok ? toPeg : from;
    const P = this.points();
    sweep(P, this.K, r, e, this.pegs[dest]);
    this.live = null;
    this.ropes[r].ends[e] = dest;
    // voltar ao mesmo furo dando a volta em outra corda também muda o enrosco
    const changed = ok || canonK(this.K) !== canonK(snap.K);
    if (changed) { this.history.push(snap); this.moves++; }
    this.refresh();
    return changed;
  }

  // ------------------------------------------------------------ jogada em linha reta
  move(ropeId, end, toPeg) {
    const rope = this.ropes[ropeId];
    if (rope.ends[end] === toPeg || !this.isEmpty(toPeg)) return false;
    const snap = this.snapshot();
    const P = this.points();
    sweep(P, this.K, ropeId, end, this.pegs[toPeg]);
    rope.ends[end] = toPeg;
    this.history.push(snap);
    this.moves++;
    this.bringToTop(ropeId);
    this.refresh();
    return true;
  }

  undo() {
    const h = this.history.pop();
    if (!h) return false;
    h.ends.forEach((e, i) => { this.ropes[i].ends = e.slice(); });
    this.K = { ...h.K };
    this.moves = Math.max(0, this.moves - 1);
    this.refresh();
    return true;
  }

  /** Dica: a jogada em linha reta que mais reduz os nós. */
  hint() {
    const empties = this.pegs.map((_, i) => i).filter((i) => this.isEmpty(i));
    const base = this.points();
    let best = null;
    for (const r of this.ropes) {
      if (this.state.perRope[r.id] === 0 && this.state.touching === 0) continue;
      for (let e = 0; e < 2; e++) {
        for (const to of empties) {
          const K = { ...this.K };
          const P = base.map((pair) => pair.map((p) => ({ ...p })));
          sweep(P, K, r.id, e, this.pegs[to]);
          const ends = this.ends.map((x) => x.slice());
          ends[r.id][e] = to;
          const c = tangleTotal(K) + touchingCount(this.pegs, ends);
          const tie = this.state.perRope[r.id];
          if (!best || c < best.c || (c === best.c && tie > best.tie)) best = { ropeId: r.id, end: e, to, c, tie };
        }
      }
    }
    return best;
  }

  stars() {
    const par = this.level.par;
    if (this.moves <= par) return 3;
    if (this.moves <= par + Math.ceil(par * 0.5) + 1) return 2;
    return 1;
  }
}
