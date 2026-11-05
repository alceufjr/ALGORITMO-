// =============================================================================
// Geometria 2.5D das cordas: splines suaves, enrolamento helicoidal e altura (z)
// -----------------------------------------------------------------------------
// Cada corda é um cilindro elástico tensionado, discretizado em nós densos.
//  1. Nós em linha reta entre as pontas (corda esticada).
//  2. Para cada par enroscado (K != 0 no modelo do jogo), as duas cordas são
//     defletidas em torno de um EIXO COMUM (bissetriz das duas direções):
//       lateral(t) = lado · A · cos(π·voltas·t)    (as cordas se aproximam e trocam de lado)
//       z(t)       = ±sin(π·voltas·t)              (por cima / por baixo, alternando)
//     misturado com a posição original por uma janela C² (smootherstep), então
//     a entrada e a saída da torção não têm quinas.
//  3. Relaxação por restrições (Verlet sem velocidade): mantém as cordas a pelo
//     menos 1 diâmetro de distância quando estão no MESMO nível z, e suaviza a
//     curvatura (tensão). Nos cruzamentos (z opostos) uma passa sobre a outra.
//  4. Reamostragem Catmull-Rom → caminho liso, espessura constante.
// =============================================================================

const smoother = (x) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * x * (x * (x * 6 - 15) + 10));
const unit = (x, y) => { const l = Math.hypot(x, y) || 1; return { x: x / l, y: y / l }; };

/** Reamostra uma polilinha com Catmull-Rom (centrípeta simplificada, uniforme). */
export function catmullRom(pts, sub = 3) {
  if (pts.length < 3) return pts.map((p) => ({ ...p }));
  const out = [];
  const P = (i) => pts[Math.max(0, Math.min(pts.length - 1, i))];
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = P(i - 1), p1 = P(i), p2 = P(i + 1), p3 = P(i + 2);
    for (let k = 0; k < sub; k++) {
      const t = k / sub, t2 = t * t, t3 = t2 * t;
      const f = (a, b, c, d) => 0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
      out.push({ x: f(p0.x, p1.x, p2.x, p3.x), y: f(p0.y, p1.y, p2.y, p3.y), z: f(p0.z, p1.z, p2.z, p3.z) });
    }
  }
  out.push({ ...pts[pts.length - 1] });
  return out;
}

/**
 * Constrói as cordas.
 * @param pos     {id: [a, b]} pontas na tela
 * @param tangles [{i, j, k, over, x, y, ti, tj, crossing}] (ver Renderer.weave)
 * @param opt     {w: espessura, endR: raio da bolinha, lifted: id arrastado}
 * @returns {id: [{x,y,z}, ...]} caminhos lisos, com altura z por nó
 */
export function buildRopes(pos, tangles, opt) {
  const { w, endR, lifted } = opt;
  const step = Math.max(3, w * 0.45);
  const ropes = {};

  // 1) nós densos em linha reta
  for (const id of Object.keys(pos)) {
    const [a, b] = pos[id];
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    const n = Math.max(2, Math.ceil(len / step));
    const nodes = [];
    for (let k = 0; k <= n; k++) {
      const t = k / n;
      nodes.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, z: 0, t, dx: 0, dy: 0, wsum: 0 });
    }
    ropes[id] = { a, b, len, nodes, dir: unit(b.x - a.x, b.y - a.y) };
  }

  // espaço livre em torno de cada enrosco, ao longo de cada corda
  const per = {};
  for (const c of tangles) { (per[c.i] ||= []).push(c); (per[c.j] ||= []).push(c); }
  const room = new Map();
  for (const [key, arr] of Object.entries(per)) {
    const r = ropes[key];
    const tOf = (c) => (c.i === +key ? c.ti : c.tj);
    arr.sort((x, y) => tOf(x) - tOf(y));
    arr.forEach((c, k) => {
      const d = tOf(c) * r.len;
      const prev = k > 0 ? (d - tOf(arr[k - 1]) * r.len) / 2 : d - endR * 1.1;
      const next = k < arr.length - 1 ? (tOf(arr[k + 1]) * r.len - d) / 2 : r.len - d - endR * 1.1;
      room.set(c, Math.min(room.has(c) ? room.get(c) : Infinity, prev, next));
    });
  }

  // 2) deflexão helicoidal em torno do eixo comum de cada par
  for (const c of tangles) {
    const turns = Math.min(Math.abs(c.k), 6);
    const RI = ropes[c.i], RJ = ropes[c.j];
    const d1 = RI.dir;
    let d2 = RJ.dir;
    const flipJ = d1.x * d2.x + d1.y * d2.y < 0;
    if (flipJ) d2 = { x: -d2.x, y: -d2.y };
    const u = unit(d1.x + d2.x, d1.y + d2.y);          // eixo comum
    const nrm = { x: -u.y, y: u.x };
    const want = w * (1.4 + 1.6 * turns);              // meia-extensão desejada
    const H = Math.max(w * 0.9, Math.min(want, (room.get(c) ?? want) * 0.95));
    // raio da hélice: nos lados de cada meia-volta as cordas se afastam 1 diâmetro + contorno,
    // então a troca por cima/por baixo acontece onde elas NÃO se encostam (sem emendas)
    const A = Math.min((w + 11) / 2, H * 0.45);
    const plateau = turns === 1 ? 0.25 : 0.55;          // trecho com hélice "cheia"

    for (const id of [c.i, c.j]) {
      const R = ropes[id];
      const flip = id === c.j && flipJ;
      const zSign = id === c.over ? 1 : -1;
      for (const nd of R.nodes) {
        // coordenadas no sistema do eixo (s ao longo, l lateral) — posição esticada original
        const ox = R.a.x + (R.b.x - R.a.x) * nd.t, oy = R.a.y + (R.b.y - R.a.y) * nd.t;
        let s = (ox - c.x) * u.x + (oy - c.y) * u.y;
        const l0 = (ox - c.x) * nrm.x + (oy - c.y) * nrm.y;
        if (Math.abs(s) >= H) continue;
        // janela C²: 1 no meio, 0 nas bordas, derivadas nulas nas bordas
        const e = (Math.abs(s) / H - plateau) / (1 - plateau);
        const win = 1 - smoother(e);
        const tt = (flip ? -s : s) / (2 * H) + 0.5;     // 0..1 no sentido de percurso
        // lado de entrada: o lado (lateral) em que a corda chega ao início da janela
        const sIn = flip ? H : -H;
        const ex = c.x + u.x * sIn, ey = c.y + u.y * sIn;
        const lIn = projLateral(R, ex, ey, u, nrm, c);
        const side = Math.abs(lIn) > 1e-6 ? Math.sign(lIn) : (id === c.i ? 1 : -1);
        const lh = side * A * Math.cos(Math.PI * turns * tt);
        const lat = l0 + (lh - l0) * win;
        nd.dx += (c.x + u.x * s + nrm.x * lat) - ox;
        nd.dy += (c.y + u.y * s + nrm.y * lat) - oy;
        // altura: alterna a cada meia-volta, sempre começando com "over" por cima
        nd.z += zSign * Math.sin(Math.PI * turns * tt) * win;
        nd.wsum = Math.max(nd.wsum, win);
      }
    }
  }

  // tensão: suaviza o campo de deslocamento (laplaciano, pontas fixas) → curvas sem quinas
  for (const R of Object.values(ropes)) {
    const N = R.nodes;
    for (let it = 0; it < 3; it++) {
      for (let k = 1; k < N.length - 1; k++) {
        const n = N[k];
        if (n.wsum <= 0 && N[k - 1].wsum <= 0 && N[k + 1].wsum <= 0) continue;
        n.dx += ((N[k - 1].dx + N[k + 1].dx) / 2 - n.dx) * 0.5;
        n.dy += ((N[k - 1].dy + N[k + 1].dy) / 2 - n.dy) * 0.5;
        n.z += ((N[k - 1].z + N[k + 1].z) / 2 - n.z) * 0.3;
      }
    }
  }

  // aplica deflexões; corda arrastada sobe
  for (const [id, R] of Object.entries(ropes)) {
    const lift = +id === lifted ? 2 : 0;
    for (const nd of R.nodes) {
      nd.x += nd.dx; nd.y += nd.dy;
      nd.z = Math.max(-1.2, Math.min(1.2, nd.z)) + lift;
    }
  }

  // 3) relaxação: colisão de cilindros no mesmo nível + tensão (suaviza curvatura)
  relax(ropes, w, tangles);

  // 4) splines
  const out = {};
  for (const [id, R] of Object.entries(ropes)) out[id] = catmullRom(R.nodes, 3);
  return out;
}

function projLateral(R, x, y, u, nrm, c) {
  // ponto da corda esticada mais próximo de (x,y) projetado no eixo lateral
  const dx = R.b.x - R.a.x, dy = R.b.y - R.a.y;
  const l2 = dx * dx + dy * dy || 1;
  const t = Math.max(0, Math.min(1, ((x - R.a.x) * dx + (y - R.a.y) * dy) / l2));
  const px = R.a.x + dx * t, py = R.a.y + dy * t;
  return (px - c.x) * nrm.x + (py - c.y) * nrm.y;
}

function relax(ropes, w, tangles) {
  const pairs = tangles.map((c) => [ropes[c.i], ropes[c.j]]);
  const minD = w * 1.02;
  for (let it = 0; it < 4; it++) {
    // colisão: só entre nós deslocados (perto dos enroscos) e no mesmo nível de altura
    for (const [P, Q] of pairs) {
      for (const p of P.nodes) {
        if (p.wsum < 0.05) continue;
        for (const q of Q.nodes) {
          if (q.wsum < 0.05) continue;
          if (Math.abs(p.z - q.z) > 0.9) continue;      // um passa por cima do outro: sem colisão
          const dx = q.x - p.x, dy = q.y - p.y;
          const d = Math.hypot(dx, dy);
          if (d >= minD || d < 1e-6) continue;
          const push = ((minD - d) / 2) * 0.5;
          const ux = dx / d, uy = dy / d;
          const kp = p.wsum, kq = q.wsum;
          p.x -= ux * push * kp; p.y -= uy * push * kp;
          q.x += ux * push * kq; q.y += uy * push * kq;
        }
      }
    }
    // tensão: laplaciano suave nos nós deslocados; pontas fixas
    for (const R of Object.values(ropes)) {
      const N = R.nodes;
      for (let k = 1; k < N.length - 1; k++) {
        const n = N[k];
        if (n.wsum < 0.02) continue;
        const mx = (N[k - 1].x + N[k + 1].x) / 2, my = (N[k - 1].y + N[k + 1].y) / 2;
        const a = 0.25 * n.wsum;
        n.x += (mx - n.x) * a; n.y += (my - n.y) * a;
      }
    }
  }
}

/**
 * Divide cada corda em trechos contínuos por NÍVEL e devolve a lista ordenada de
 * baixo para cima. O nível de um ponto só muda onde a corda ENCOSTA em outra:
 *   0 = por baixo de alguém, 1 = livre, 2 = por cima de alguém, 3 = arrastada.
 * Como fora das áreas de contato tudo é nível 1, as emendas entre trechos caem em
 * lugares onde a corda não toca nenhuma outra, e ficam invisíveis.
 */
export function zRuns(paths, order, touch) {
  const ids = order.map(String);
  const lv = {};
  for (const id of ids) lv[id] = paths[id].map((p) => (p.z > 1.5 ? 3 : 1));
  // grade espacial para achar contatos rápido
  const cell = touch;
  const grid = new Map();
  const keyOf = (x, y) => `${Math.floor(x / cell)},${Math.floor(y / cell)}`;
  for (const id of ids) paths[id].forEach((p, k) => {
    const key = keyOf(p.x, p.y);
    if (!grid.has(key)) grid.set(key, []);
    grid.get(key).push([id, k]);
  });
  for (const id of ids) {
    const P = paths[id];
    P.forEach((p, k) => {
      if (lv[id][k] === 3) return;
      let over = false, under = false;
      const cx = Math.floor(p.x / cell), cy = Math.floor(p.y / cell);
      for (let gx = cx - 1; gx <= cx + 1; gx++) for (let gy = cy - 1; gy <= cy + 1; gy++) {
        for (const [oid, ok] of grid.get(`${gx},${gy}`) || []) {
          if (oid === id) continue;
          const q = paths[oid][ok];
          if (Math.hypot(q.x - p.x, q.y - p.y) >= touch) continue;
          if (p.z > q.z + 0.05) over = true; else if (p.z < q.z - 0.05) under = true;
        }
      }
      lv[id][k] = under ? 0 : over ? 2 : 1;
    });
  }
  const runs = [];
  ids.forEach((id, rank) => {
    const L = lv[id];
    let start = 0;
    for (let k = 1; k <= L.length; k++) {
      if (k === L.length || L[k] !== L[start]) {
        runs.push({ id, from: Math.max(0, start - 1), to: Math.min(L.length - 1, k), level: L[start], rank });
        start = k;
      }
    }
  });
  runs.sort((a, b) => a.level - b.level || a.rank - b.rank);
  return runs;
}
