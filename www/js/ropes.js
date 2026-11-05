// =============================================================================
// Geometria 2.5D das cordas: Física de Colisão Contínua + Enrolamento Suave
// =============================================================================

const smoother = (x) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * x * (x * (x * 6 - 15) + 10));
const unit = (x, y) => { const l = Math.hypot(x, y) || 1; return { x: x / l, y: y / l }; };

/** Reamostra uma polilinha com Catmull-Rom garantindo curvatura orgânica. */
export function catmullRom(pts, sub = 4) {
  if (pts.length < 3) return pts.map((p) => ({ ...p }));
  const out = [];
  const P = (i) => pts[Math.max(0, Math.min(pts.length - 1, i))];
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = P(i - 1), p1 = P(i), p2 = P(i + 1), p3 = P(i + 2);
    for (let k = 0; k < sub; k++) {
      const t = k / sub, t2 = t * t, t3 = t2 * t;
      const f = (a, b, c, d) =>
        0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
      out.push({
        x: f(p0.x, p1.x, p2.x, p3.x),
        y: f(p0.y, p1.y, p2.y, p3.y),
        z: f(p0.z, p1.z, p2.z, p3.z),
      });
    }
  }
  out.push({ ...pts[pts.length - 1] });
  return out;
}

/**
 * Constrói as cordas com física de entrelaçamento real (estilo Twisted Tangle).
 */
export function buildRopes(pos, tangles, opt) {
  const { w, lifted } = opt;
  const step = Math.max(3, w * 0.38); // malha mais densa evita quinas
  const ropes = {};

  // 1) Nós densos inicialmente em linha reta entre as pontas
  for (const id of Object.keys(pos)) {
    const [a, b] = pos[id];
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    const n = Math.max(4, Math.ceil(len / step));
    const nodes = [];
    for (let k = 0; k <= n; k++) {
      const t = k / n;
      nodes.push({
        x: a.x + (b.x - a.x) * t,
        y: a.y + (b.y - a.y) * t,
        z: 0,
        t,
        pinned: k === 0 || k === n,
      });
    }
    ropes[id] = { a, b, len, nodes, dir: unit(b.x - a.x, b.y - a.y) };
  }

  // 2) Calcula o entrelaçamento sem esmagar o ângulo natural das cordas
  for (const c of tangles) {
    const turns = Math.min(Math.abs(c.k), 6);
    if (turns === 0) continue;

    const RI = ropes[c.i], RJ = ropes[c.j];
    const d1 = RI.dir;
    let d2 = RJ.dir;
    const dot = d1.x * d2.x + d1.y * d2.y;
    const flipJ = dot < 0;
    if (flipJ) d2 = { x: -d2.x, y: -d2.y };

    // Eixo médio do par
    const u = unit(d1.x + d2.x, d1.y + d2.y);
    const nrm = { x: -u.y, y: u.x };

    // Zona de influência ampla e suave (evita degraus abruptos)
    const H = w * (2.2 + 1.4 * turns);
    // Raio da torção helicoidal (metade do diâmetro para encostarem perfeitamente)
    const radius = w * 0.48;

    for (const id of [c.i, c.j]) {
      const R = ropes[id];
      const isOverFirst = id === c.over;
      const signSide = id === c.i ? 1 : -1;
      const tCenter = id === c.i ? c.ti : c.tj;

      for (const nd of R.nodes) {
        if (nd.pinned) continue;

        // Distância ao longo da própria corda até o centro do cruzamento
        const distAlong = (nd.t - tCenter) * R.len * (id === c.j && flipJ ? -1 : 1);
        if (Math.abs(distAlong) >= H) continue;

        // uNorm vai de -1 a +1 dentro da zona de torção
        const uNorm = distAlong / H;
        // Envelope gaussiano/C² suave (0 nas pontas, 1 no meio, sem quinas)
        const env = 1 - smoother(Math.abs(uNorm));

        if (turns === 1) {
          // CRUZAMENTO SIMPLES (1 volta):
          // A corda mantém sua trajetória, ganhando apenas um leve arco orgânico
          // (deflexão de tensão) e passando nitidamente por cima/baixo em Z.
          const zArc = (isOverFirst ? 1 : -1) * Math.cos(uNorm * Math.PI * 0.5);
          const tensionBow = signSide * (w * 0.18) * env;

          nd.x += nrm.x * tensionBow;
          nd.y += nrm.y * tensionBow;
          nd.z += zArc * env;
        } else {
          // MÚLTIPLAS VOLTAS (Torção Helicoidal / Espiral):
          // Aproxima suavemente ambas as cordas para o eixo central e gira em hélice
          const phase = uNorm * (turns * Math.PI * 0.5); // fase da espiral
          const pullToAxis = Math.pow(env, 0.7); // puxa suavemente para o feixe central

          // Ponto correspondente no eixo central da torção
          const axisX = c.x + u.x * distAlong;
          const axisY = c.y + u.y * distAlong;

          // Deslocamento senoidal da trança (troca de lado a cada meia volta)
          const braidOffset = signSide * radius * Math.sin(phase + (isOverFirst ? 0 : Math.PI));
          const targetX = axisX + nrm.x * braidOffset;
          const targetY = axisY + nrm.y * braidOffset;

          nd.x = nd.x + (targetX - nd.x) * pullToAxis;
          nd.y = nd.y + (targetY - nd.y) * pullToAxis;

          // Altura Z defasada em 90 graus do deslocamento lateral (hélice 3D real)
          const zWave = (isOverFirst ? 1 : -1) * Math.cos(phase);
          nd.z += zWave * env;
        }
      }
    }
  }

  // Eleva corda sendo arrastada pelo jogador
  for (const [id, R] of Object.entries(ropes)) {
    if (+id === lifted) {
      for (const nd of R.nodes) nd.z += 2.5;
    }
  }

  // 3) Relaxação global (suaviza TODOS os nós da corda para eliminar qualquer quina)
  relaxAndSmooth(ropes, w, tangles);

  // 4) Interpolação Spline final
  const out = {};
  for (const [id, R] of Object.entries(ropes)) {
    out[id] = catmullRom(R.nodes, 4);
  }
  return out;
}

/**
 * Suavização global de tensão elástica (Verlet Laplacian) em toda a extensão da corda.
 */
function relaxAndSmooth(ropes, w, tangles) {
  const allRopes = Object.values(ropes);
  const minD = w * 0.96;
  // colisão só entre cordas ENROSCADAS: cordas soltas ficam retas e no lugar real,
  // para o desenho nunca esconder nem inventar um cruzamento
  const pairs = tangles.map((c) => [ropes[c.i], ropes[c.j]]);

  for (let iter = 0; iter < 8; iter++) {
    // Colisão suave entre cordas quando estão na mesma altura Z (impede sobreposição paralela feia)
    for (const [RA, RB] of pairs) {
      {
        const P = RA.nodes, Q = RB.nodes;
        // otimização: pula pares de cordas cujas caixas envolventes estão longe
        // (não muda o resultado: nenhum par de nós ficaria a menos de minD)
        if (!boxesNear(P, Q, minD)) continue;
        for (let a = 1; a < P.length - 1; a++) {
          const p = P[a];
          for (let b = 1; b < Q.length - 1; b++) {
            const q = Q[b];
            // Se uma está claramente por cima da outra (cruzamento), permite passar livremente
            if (Math.abs(p.z - q.z) > 0.35) continue;

            const dx = q.x - p.x, dy = q.y - p.y;
            const d = Math.hypot(dx, dy);
            if (d < minD && d > 1e-5) {
              const push = (minD - d) * 0.25;
              const ux = dx / d, uy = dy / d;
              p.x -= ux * push; p.y -= uy * push;
              q.x += ux * push; q.y += uy * push;
            }
          }
        }
      }
    }

    // Tensão contínua ao longo de TODA a corda (elimina qualquer dobra/quina na entrada dos cruzamentos)
    for (const R of allRopes) {
      const N = R.nodes;
      for (let k = 1; k < N.length - 1; k++) {
        N[k].x += ((N[k - 1].x + N[k + 1].x) * 0.5 - N[k].x) * 0.35;
        N[k].y += ((N[k - 1].y + N[k + 1].y) * 0.5 - N[k].y) * 0.35;
        N[k].z += ((N[k - 1].z + N[k + 1].z) * 0.5 - N[k].z) * 0.20;
      }
    }
  }
}

function boxesNear(P, Q, pad) {
  let ax0 = Infinity, ay0 = Infinity, ax1 = -Infinity, ay1 = -Infinity;
  for (const p of P) { if (p.x < ax0) ax0 = p.x; if (p.x > ax1) ax1 = p.x; if (p.y < ay0) ay0 = p.y; if (p.y > ay1) ay1 = p.y; }
  let bx0 = Infinity, by0 = Infinity, bx1 = -Infinity, by1 = -Infinity;
  for (const q of Q) { if (q.x < bx0) bx0 = q.x; if (q.x > bx1) bx1 = q.x; if (q.y < by0) by0 = q.y; if (q.y > by1) by1 = q.y; }
  return !(ax1 + pad < bx0 || bx1 + pad < ax0 || ay1 + pad < by0 || by1 + pad < ay0);
}

/**
 * Divide as cordas em micro-segmentos ordenados por altura Z contínua.
 * Isso garante que o contorno preto da corda de cima corte perfeitamente a corda de baixo.
 */
export function zRuns(paths, order) {
  const runs = [];
  const chunkSize = 4; // trechos curtos garantem ordenação Z precisa em espirais apertadas

  order.forEach((id, rank) => {
    const P = paths[id];
    for (let k = 0; k < P.length - 1; k += chunkSize) {
      const from = Math.max(0, k);
      const to = Math.min(P.length - 1, k + chunkSize);
      // Calcula o Z médio do sub-segmento
      let zSum = 0;
      for (let m = from; m <= to; m++) zSum += P[m].z;
      const zAvg = zSum / (to - from + 1);

      runs.push({
        id,
        from,
        to,
        level: Math.round(zAvg * 100), // precisão centesimal de profundidade
        rank,
      });
    }
  });

  runs.sort((a, b) => a.level - b.level || a.rank - b.rank);
  return runs;
}
