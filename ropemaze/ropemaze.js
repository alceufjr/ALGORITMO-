// =============================================================================
// Rope Maze — passe uma corda por TODAS as portas, uma vez cada, sem que dois
// trechos da corda se cruzem dentro da mesma sala. Busca com volta atrás
// (backtracking), passo a passo, igual ao original em jQuery.
//
// Versão moderna (sem jQuery) com correções do original:
//  1. door_sw_n apontava para "door_nw_sw" (não existe); o certo é "door_nw_s".
//  2. a checagem de cruzamento comparava o trecho novo com a tentativa antiga
//     da própria sala atual; agora compara só com trechos já assentados.
//  3. com a busca esgotada o original quebrava; agora informa "sem solução".
//  4. "Count" passa a atualizar também no Next Step.
// Extra: a corda é desenhada (SVG) por onde passa.
// =============================================================================

// Portas de cada região, em ordem HORÁRIA ao redor dela (define o que cruza).
// to: [região do outro lado, nome desta mesma porta vista do outro lado]
// el: id do elemento da porta na página.
export const MAZE = {
  outside: {
    door_out_nw: { to: ['room_nw', 'door_nw_n'], el: 'door_nw_n' },
    door_out_ne: { to: ['room_ne', 'door_ne_n'], el: 'door_ne_n' },
    door_out_en: { to: ['room_ne', 'door_ne_e'], el: 'door_ne_e' },
    door_out_es: { to: ['room_se', 'door_se_e'], el: 'door_se_e' },
    door_out_se: { to: ['room_se', 'door_se_s'], el: 'door_se_s' },
    door_out_s:  { to: ['room_s', 'door_s_s'], el: 'door_s_s' },
    door_out_sw: { to: ['room_sw', 'door_sw_s'], el: 'door_sw_s' },
    door_out_ws: { to: ['room_sw', 'door_sw_w'], el: 'door_sw_w' },
    door_out_wn: { to: ['room_nw', 'door_nw_w'], el: 'door_nw_w' },
  },
  room_nw: {
    door_nw_n: { to: ['outside', 'door_out_nw'], el: 'door_nw_n' },
    door_nw_e: { to: ['room_ne', 'door_ne_w'], el: 'door_nw_e' },
    door_nw_s: { to: ['room_sw', 'door_sw_n'], el: 'door_nw_s' },
    door_nw_w: { to: ['outside', 'door_out_wn'], el: 'door_nw_w' },
  },
  room_ne: {
    door_ne_n:  { to: ['outside', 'door_out_ne'], el: 'door_ne_n' },
    door_ne_e:  { to: ['outside', 'door_out_en'], el: 'door_ne_e' },
    door_ne_se: { to: ['room_se', 'door_se_n'], el: 'door_ne_se' },
    door_ne_sw: { to: ['room_s', 'door_s_n'], el: 'door_ne_sw' },
    door_ne_w:  { to: ['room_nw', 'door_nw_e'], el: 'door_nw_e' },
  },
  room_se: {
    door_se_n: { to: ['room_ne', 'door_ne_se'], el: 'door_ne_se' },
    door_se_e: { to: ['outside', 'door_out_es'], el: 'door_se_e' },
    door_se_s: { to: ['outside', 'door_out_se'], el: 'door_se_s' },
    door_se_w: { to: ['room_s', 'door_s_e'], el: 'door_se_w' },
  },
  room_s: {
    door_s_n: { to: ['room_ne', 'door_ne_sw'], el: 'door_ne_sw' },
    door_s_e: { to: ['room_se', 'door_se_w'], el: 'door_se_w' },
    door_s_s: { to: ['outside', 'door_out_s'], el: 'door_s_s' },
    door_s_w: { to: ['room_sw', 'door_sw_e'], el: 'door_sw_e' },
  },
  room_sw: {
    door_sw_n: { to: ['room_nw', 'door_nw_s'], el: 'door_nw_s' }, // original: 'door_nw_sw' (defeito)
    door_sw_e: { to: ['room_s', 'door_s_w'], el: 'door_sw_e' },
    door_sw_s: { to: ['outside', 'door_out_sw'], el: 'door_sw_s' },
    door_sw_w: { to: ['outside', 'door_out_ws'], el: 'door_sw_w' },
  },
};

/** Dois trechos a→b e c→d na mesma região se cruzam se as portas se intercalam no contorno. */
export function crosses(order, a, b, c, d) {
  if (!a || !b || !c || !d) return false;
  if (a === c || a === d || b === c || b === d) return false;
  const p = (x) => order.indexOf(x);
  if ([a, b, c, d].some((x) => p(x) < 0)) return false;
  const lo = Math.min(p(a), p(b)), hi = Math.max(p(a), p(b));
  const inside = (x) => p(x) > lo && p(x) < hi;
  return inside(c) !== inside(d);
}

/** Busca passo a passo. Cada step() avança uma porta ou volta uma. */
export class RopeSearch {
  constructor(maze = MAZE, start = 'outside') {
    this.maze = maze;
    this.order = Object.fromEntries(Object.entries(maze).map(([r, ds]) => [r, Object.keys(ds)]));
    this.total = new Set(Object.values(maze).flatMap((ds) => Object.values(ds).map((d) => d.el))).size;
    this.used = new Set();                 // portas físicas (id do elemento) já atravessadas
    this.stack = [{ room: start, from: '', to: '', tried: new Set() }];
    this.tries = 0;
    this.state = 'searching';             // 'searching' | 'solved' | 'exhausted'
  }

  get count() { return this.used.size; }

  /** Avança 1 passo. Retorna {type:'enter'|'back', el, n} ou null se terminou. */
  step() {
    if (this.state !== 'searching') return null;
    const top = this.stack[this.stack.length - 1];
    const order = this.order[top.room];
    for (const d of order) {
      const info = this.maze[top.room][d];
      if (this.used.has(info.el) || top.tried.has(d)) continue;
      // só compara com trechos já assentados nesta sala (não com a própria tentativa antiga)
      const clash = this.stack.slice(0, -1).some((s) => s.room === top.room && crosses(order, top.from, d, s.from, s.to));
      if (clash) continue;
      top.to = d;
      this.used.add(info.el);
      this.stack.push({ room: info.to[0], from: info.to[1], to: '', tried: new Set() });
      this.tries++;
      if (this.used.size === this.total) this.state = 'solved';
      return { type: 'enter', el: info.el, n: this.stack.length - 1 };
    }
    // nenhuma porta serve: volta atrás
    this.stack.pop();
    if (!this.stack.length) { this.state = 'exhausted'; return null; }
    const prev = this.stack[this.stack.length - 1];
    const el = this.maze[prev.room][prev.to].el;
    this.used.delete(el);
    prev.tried.add(prev.to);
    prev.to = '';
    return { type: 'back', el };
  }

  /** Caminho atual: lista de {room, from, to} (to vazio na última região). */
  path() { return this.stack.map((s) => ({ room: s.room, from: s.from, to: s.to })); }
}

// ----------------------------------------------------------------------------- página
function mountPage() {
  const $ = (id) => document.getElementById(id);
  const mazeEl = $('maze');
  const svg = $('rope');
  const countEl = $('count'), triesEl = $('tries'), statusEl = $('status');
  const btnStep = $('nextstep'), btnRun = $('run'), btnStop = $('stop');
  let search = new RopeSearch();
  let timer = null;

  // centro de cada porta, em coordenadas do labirinto
  const center = (el) => {
    const m = mazeEl.getBoundingClientRect();
    const r = $(el).getBoundingClientRect();
    return { x: r.left - m.left + r.width / 2, y: r.top - m.top + r.height / 2 };
  };
  const W = 640, H = 480, C = { x: W / 2, y: H / 2 };
  const roomCenter = (room) => {
    const r = $(room).getBoundingClientRect(), m = mazeEl.getBoundingClientRect();
    return { x: r.left - m.left + r.width / 2, y: r.top - m.top + r.height / 2 };
  };
  // fora do prédio a corda faz uma curva por fora (afastada do centro)
  const outward = (p, k = 70) => {
    const dx = p.x - C.x, dy = p.y - C.y, l = Math.hypot(dx, dy) || 1;
    return { x: p.x + (dx / l) * k, y: p.y + (dy / l) * k };
  };

  function drawRope() {
    const path = search.path();
    let d = '';
    path.forEach((seg, i) => {
      const fromP = seg.from ? center(search.maze[seg.room][seg.from]?.el ?? elOf(seg.room, seg.from)) : null;
      const toP = seg.to ? center(search.maze[seg.room][seg.to].el) : null;
      if (seg.room === 'outside') {
        if (!fromP && toP) { const s = outward(toP, 24); d += `M${s.x},${s.y} L${toP.x},${toP.y} `; }
        else if (fromP && toP) {
          const c1 = outward(fromP), c2 = outward(toP);
          d += `C${c1.x},${c1.y} ${c2.x},${c2.y} ${toP.x},${toP.y} `;
        } else if (fromP) { const e = outward(fromP, 40); d += `L${e.x},${e.y} `; }
      } else if (toP) {
        if (i === 0) d += `M${fromP.x},${fromP.y} `;
        d += `L${toP.x},${toP.y} `;
      } else if (fromP) {
        const rc = roomCenter(seg.room);
        d += `L${(fromP.x + rc.x) / 2},${(fromP.y + rc.y) / 2} `; // ponta da corda dentro da sala final
      }
    });
    svg.innerHTML = d ? `<path d="${d}"/>` : '';
  }
  function elOf(room, door) { return search.maze[room][door].el; }

  function render(ev) {
    if (ev) {
      const el = $(ev.el);
      if (ev.type === 'enter') { el.textContent = ev.n; el.classList.remove('tried'); el.classList.add('entered'); }
      else { el.textContent = ''; el.classList.remove('entered'); el.classList.add('tried'); }
    }
    countEl.textContent = search.count;
    triesEl.textContent = search.tries;
    drawRope();
    if (search.state === 'solved') {
      statusEl.textContent = `Resolvido! A corda passou pelas ${search.total} portas sem se cruzar.`;
      stop();
    } else if (search.state === 'exhausted') {
      statusEl.textContent = 'Sem solução: todas as combinações foram testadas.';
      stop();
    }
    const done = search.state !== 'searching';
    btnStep.disabled = done;
    btnRun.disabled = done || !!timer;
  }

  function stop() {
    clearInterval(timer);
    timer = null;
    btnRun.disabled = search.state !== 'searching';
  }

  btnStep.onclick = () => render(search.step());
  btnRun.onclick = () => {
    if (timer || search.state !== 'searching') return;
    timer = setInterval(() => render(search.step()), 60);
    btnRun.disabled = true;
  };
  btnStop.onclick = stop;
  render(null);
  window.__ropemaze = { get search() { return search; } };
}

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mountPage);
  else mountPage();
}
