// Estado de uma partida: jogadas, desfazer, vitória, dica.
import { analyze, countConflicts } from './core.js';

export class Game {
  constructor(level, palette = null) {
    this.level = level;
    this.pegs = level.pegs;
    const color = (r) => (palette ? palette[r.c % palette.length] : r.color || '#888888');
    this.ropes = level.ropes.map((r, i) => ({ id: i, color: color(r), ends: [r.a, r.b] }));
    this.order = this.ropes.map((r) => r.id); // ordem de desenho (último = por cima)
    this.moves = 0;
    this.history = [];
    this.refresh();
  }

  get ends() { return this.ropes.map((r) => r.ends); }

  refresh() {
    this.state = analyze(this.pegs, this.ends, true);
  }

  get conflicts() { return this.state.total; }
  get solved() { return this.state.total === 0; }

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

  move(ropeId, end, toPeg) {
    const rope = this.ropes[ropeId];
    const from = rope.ends[end];
    if (from === toPeg || !this.isEmpty(toPeg)) return false;
    rope.ends[end] = toPeg;
    this.history.push({ ropeId, end, from, to: toPeg });
    this.moves++;
    this.bringToTop(ropeId);
    this.refresh();
    return true;
  }

  undo() {
    const h = this.history.pop();
    if (!h) return false;
    this.ropes[h.ropeId].ends[h.end] = h.from;
    this.moves = Math.max(0, this.moves - 1);
    this.refresh();
    return true;
  }

  /** Melhor jogada gulosa: a que mais reduz cruzamentos. */
  hint() {
    const ends = this.ends.map((e) => e.slice());
    const empties = this.pegs.map((_, i) => i).filter((i) => this.isEmpty(i));
    let best = null;
    for (const r of this.ropes) {
      if (this.state.perRope[r.id] === 0) continue; // só cordas com problema
      for (let e = 0; e < 2; e++) {
        const from = ends[r.id][e];
        for (const to of empties) {
          ends[r.id][e] = to;
          const c = countConflicts(this.pegs, ends);
          ends[r.id][e] = from;
          const tie = this.state.perRope[r.id];
          if (!best || c < best.c || (c === best.c && tie > best.tie)) {
            best = { ropeId: r.id, end: e, to, c, tie };
          }
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
