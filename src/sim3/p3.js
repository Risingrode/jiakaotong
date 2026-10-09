
/* ======================= 渲染（伪3D 透视 + 画家算法） ======================= */
const NEAR = 0.3, SUNX = -0.55, SUNY = -0.83;
const TB = new Float64Array(120), CB = new Float64Array(120);
let FOGC = [207, 225, 242];
function shade(c, k, f) {
  let r = c[0] * k, g = c[1] * k, b = c[2] * k; if (r > 255) r = 255; if (g > 255) g = 255; if (b > 255) b = 255;
  return 'rgb(' + ((r + (FOGC[0] - r) * f) | 0) + ',' + ((g + (FOGC[1] - g) * f) | 0) + ',' + ((b + (FOGC[2] - b) * f) | 0) + ')';
}
function mkCam() { return { x: 0, y: 0, z: 1.2, h: 0, p: 0.05, F: 500, cx: 0, cy: 0, W: 0, H: 0, c: 1, s: 0, cp: 1, sp: 0, tx: 1, far: 420 }; }
function camPrep(K) { K.c = Math.cos(K.h); K.s = Math.sin(K.h); K.cp = Math.cos(K.p); K.sp = Math.sin(K.p); K.tx = (K.W / 2 + 30) / K.F; }
function proj(K, x, y, z, o) {
  const dx = x - K.x, dy = y - K.y, u0 = z - K.z, f0 = dx * K.c + dy * K.s, r = dx * K.s - dy * K.c;
  const f = f0 * K.cp - u0 * K.sp, u = f0 * K.sp + u0 * K.cp;
  o.f = f; if (f <= NEAR) return false;
  o.x = K.cx + r / f * K.F; o.y = K.cy - u / f * K.F; return true;
}
function polyW(ctx, K, P, n, col) {
  let nIn = 0, allR = true, allL = true;
  for (let i = 0; i < n; i++) {
    const j = i * 3, dx = P[j] - K.x, dy = P[j + 1] - K.y, u0 = P[j + 2] - K.z;
    const f0 = dx * K.c + dy * K.s, r = dx * K.s - dy * K.c, f = f0 * K.cp - u0 * K.sp;
    TB[j] = r; TB[j + 1] = f0 * K.sp + u0 * K.cp; TB[j + 2] = f;
    if (f > NEAR) nIn++;
    if (r < f * K.tx) allR = false; if (r > -f * K.tx) allL = false;
  }
  if (!nIn || (nIn === n && (allR || allL))) return false;
  let m = n, S = TB;
  if (nIn < n) {
    m = 0; S = CB;
    for (let i = 0; i < n; i++) {
      const a = i * 3, b = ((i + 1) % n) * 3, fa = TB[a + 2], fb = TB[b + 2], ia = fa > NEAR, ib = fb > NEAR;
      if (ia) { CB[m * 3] = TB[a]; CB[m * 3 + 1] = TB[a + 1]; CB[m * 3 + 2] = fa; m++; }
      if (ia !== ib) { const t = (NEAR - fa) / (fb - fa); CB[m * 3] = TB[a] + (TB[b] - TB[a]) * t; CB[m * 3 + 1] = TB[a + 1] + (TB[b + 1] - TB[a + 1]) * t; CB[m * 3 + 2] = NEAR; m++; }
    }
  }
  ctx.beginPath();
  for (let i = 0; i < m; i++) { const f = S[i * 3 + 2], sx = K.cx + S[i * 3] / f * K.F, sy = K.cy - S[i * 3 + 1] / f * K.F; if (i) ctx.lineTo(sx, sy); else ctx.moveTo(sx, sy); }
  ctx.closePath(); ctx.fillStyle = col; ctx.fill();
  return true;
}
const QP = new Float64Array(12);
function quad(ctx, K, x0, y0, z0, x1, y1, z1, x2, y2, z2, x3, y3, z3, col) {
  QP[0] = x0; QP[1] = y0; QP[2] = z0; QP[3] = x1; QP[4] = y1; QP[5] = z1; QP[6] = x2; QP[7] = y2; QP[8] = z2; QP[9] = x3; QP[10] = y3; QP[11] = z3;
  return polyW(ctx, K, QP, 4, col);
}
/* 有向长方体：返回可见面掩码 1前 2右 4后 8左 16顶 */
function box(ctx, K, x, y, h, l, w, z0, z1, side, top, k, fog) {
  const c = Math.cos(h), s = Math.sin(h), a = l / 2, b = w / 2;
  const X0 = x + c * a - s * b, Y0 = y + s * a + c * b, X1 = x + c * a + s * b, Y1 = y + s * a - c * b;
  const X2 = x - c * a + s * b, Y2 = y - s * a - c * b, X3 = x - c * a - s * b, Y3 = y - s * a + c * b;
  const ex = K.x - x, ey = K.y - y;
  let m = 0;
  const F = (xa, ya, xb, yb, nx, ny, bit, half) => {
    if (ex * nx + ey * ny <= half) return;
    m |= bit; quad(ctx, K, xa, ya, z0, xb, yb, z0, xb, yb, z1, xa, ya, z1, shade(side, k * (0.6 + 0.4 * Math.max(0, nx * SUNX + ny * SUNY)), fog));
  };
  F(X0, Y0, X1, Y1, c, s, 1, a); F(X1, Y1, X2, Y2, s, -c, 2, b); F(X2, Y2, X3, Y3, -c, -s, 4, a); F(X3, Y3, X0, Y0, -s, c, 8, b);
  if (K.z > z1 && top) { m |= 16; quad(ctx, K, X0, Y0, z1, X1, Y1, z1, X2, Y2, z1, X3, Y3, z1, shade(top, k, fog)); }
  return m;
}
/* 面上贴片：face 1前 4后 用 (b0,b1) 横向；2右 8左 用 (a0,a1) 纵向 */
function decal(ctx, K, x, y, h, l, w, face, p0, p1, z0, z1, col) {
  const c = Math.cos(h), s = Math.sin(h), a = l / 2 + 0.02, b = w / 2 + 0.02;
  let ax0, ay0, ax1, ay1;
  if (face === 1 || face === 4) { const A = face === 1 ? a : -a; ax0 = x + c * A - s * p0; ay0 = y + s * A + c * p0; ax1 = x + c * A - s * p1; ay1 = y + s * A + c * p1; }
  else { const B = face === 8 ? b : -b; ax0 = x + c * p0 - s * B; ay0 = y + s * p0 + c * B; ax1 = x + c * p1 - s * B; ay1 = y + s * p1 + c * B; }
  quad(ctx, K, ax0, ay0, z0, ax1, ay1, z0, ax1, ay1, z1, ax0, ay0, z1, col);
}

/* ----- 静态场景几何（一次生成） ----- */
const C_ASP = [78, 82, 90], C_ASP2 = [72, 76, 84], C_WALK = [196, 192, 186], C_CURB = [222, 220, 214], C_WHITE = [240, 240, 236], C_YEL = [242, 190, 40], C_GRASS = [108, 150, 82];
let GEO = null;
function geo() {
  if (GEO) return GEO;
  const W = getWorld(), flat = [], objs = [];
  const add = (pts, col, L) => {
    const n = pts.length / 2, P = new Float64Array(n * 3); let cx = 0, cy = 0;
    for (let i = 0; i < n; i++) { P[i * 3] = pts[i * 2]; P[i * 3 + 1] = pts[i * 2 + 1]; P[i * 3 + 2] = L > 3 ? 0.02 : L > 1 ? 0.01 : 0; cx += pts[i * 2]; cy += pts[i * 2 + 1]; }
    cx /= n; cy /= n; let rad = 0; for (let i = 0; i < n; i++) rad = Math.max(rad, Math.hypot(pts[i * 2] - cx, pts[i * 2 + 1] - cy));
    flat.push({ P, n, col, L, cx, cy, rad });
  };
  const rect = (r, s0, s1, u0, u1, col, L) => { const a = roadPt(r, s0, u0), b = roadPt(r, s1, u0), c = roadPt(r, s1, u1), d = roadPt(r, s0, u1); add([a.x, a.y, b.x, b.y, c.x, c.y, d.x, d.y], col, L); };
  const lrect = (L, a0, a1, b0, b1, col, lay) => { // 车道局部坐标（a 前进, b 左）
    const P = [[a0, b0], [a1, b0], [a1, b1], [a0, b1]].map(([a, b]) => [L.x0 + L.hx * a - L.hy * b, L.y0 + L.hy * a + L.hx * b]);
    add([].concat(...P), col, lay);
  };
  W.roads.forEach(r => {
    for (let s = 0; s < r.len; s += 40) {
      const e = Math.min(r.len, s + 40);
      rect(r, s, e, -CURB, CURB, (s / 40) % 2 ? C_ASP : C_ASP2, 1);
      rect(r, s, e, CURB, CURB + WALK, C_WALK, 0); rect(r, s, e, -CURB - WALK, -CURB, C_WALK, 0);
      rect(r, s, e, CURB, CURB + 0.3, C_CURB, 0.5); rect(r, s, e, -CURB - 0.3, -CURB, C_CURB, 0.5);
    }
    const dash = (u, s0, s1, col, dl, gl, wd) => { for (let s = s0; s < s1; s += dl + gl) rect(r, s, Math.min(s1, s + dl), u - wd / 2, u + wd / 2, col, 4); };
    const solid = (u, s0, s1, col, wd) => { for (let s = s0; s < s1; s += 20) rect(r, s, Math.min(s1, s + 20), u - wd / 2, u + wd / 2, col, 4); };
    const a = SL, b = r.len - SL;
    if (r.uturn) { solid(0.2, a, r.uturn[0], C_YEL, 0.15); solid(-0.2, a, r.uturn[0], C_YEL, 0.15); solid(0.2, r.uturn[1], b, C_YEL, 0.15); solid(-0.2, r.uturn[1], b, C_YEL, 0.15); dash(0, r.uturn[0], r.uturn[1], C_YEL, 3, 3, 0.15); }
    else { solid(0.2, a, b, C_YEL, 0.15); solid(-0.2, a, b, C_YEL, 0.15); }
    dash(LW, a, b - 30, C_WHITE, 4, 6, 0.15); solid(LW, b - 30, b, C_WHITE, 0.15);
    solid(-LW, a, a + 30, C_WHITE, 0.15); dash(-LW, a + 30, b, C_WHITE, 4, 6, 0.15);
    const ep = [[a, b]], em = [[a, b]];
    const cut = (arr, s0, s1, u) => { const [x0, x1] = arr.pop(); arr.push([x0, s0]); dash(u, s0, s1, C_WHITE, 2, 2, 0.15); arr.push([s1, x1]); };
    if (r.start0) cut(ep, a, r.start0, HALF);
    if (r.bay) { cut(ep, r.bay[0], r.bay[1], HALF); [r.bay[0], r.bay[1]].forEach(s => rect(r, s - 0.1, s + 0.1, HALF, CURB, C_YEL, 4)); rect(r, r.bay[0], r.bay[1], CURB - 0.25, CURB - 0.1, C_YEL, 4); }
    if (r.uturn) cut(em, r.uturn[0] - 12, r.uturn[1] + 12, -HALF);
    ep.forEach(([x0, x1]) => x1 > x0 && solid(HALF, x0, x1, C_WHITE, 0.15)); em.forEach(([x0, x1]) => x1 > x0 && solid(-HALF, x0, x1, C_WHITE, 0.15));
    // 路口人行横道 + 停止线 + 导向箭头
    [[r.a, 1], [r.b, -1]].forEach(([n, d]) => {
      if (!n.sig) return;
      const s0 = d > 0 ? 11 : r.len - 15;
      for (let u = -CURB + 0.6; u < CURB - 0.5; u += 1.0) rect(r, s0, s0 + 4, u, u + 0.45, C_WHITE, 4);
      if (d > 0) rect(r, SL - 0.45, SL, -HALF, -0.3, C_WHITE, 4); else rect(r, r.len - SL, r.len - SL + 0.45, 0.3, HALF, C_WHITE, 4);
    });
    r.lanes.forEach(L => {
      if (!L.end.sig) return;
      const ms = L.conns.map(c => c.m), A0 = L.len - 12;
      const st = () => { lrect(L, A0, A0 + 3.4, -0.15, 0.15, C_WHITE, 4); quad3(L, A0 + 3.4, A0 + 5.2, 0); };
      const turn = sgn => { lrect(L, A0, A0 + 2.4, -0.15, 0.15, C_WHITE, 4); lrect(L, A0 + 2.0, A0 + 2.4, 0, sgn * 1.0, C_WHITE, 4); tri(L, A0 + 1.55, A0 + 2.85, sgn * 1.0, sgn * 1.75); };
      const quad3 = (L, a0, a1, b) => { const p = (aa, bb) => [L.x0 + L.hx * aa - L.hy * bb, L.y0 + L.hy * aa + L.hx * bb]; add([...p(a0, b - 0.55), ...p(a0, b + 0.55), ...p(a1, b)], C_WHITE, 4); };
      const tri = (L, a0, a1, b0, b1) => { const p = (aa, bb) => [L.x0 + L.hx * aa - L.hy * bb, L.y0 + L.hy * aa + L.hx * bb]; add([...p(a0, b0), ...p(a1, b0), ...p((a0 + a1) / 2, b1)], C_WHITE, 4); };
      if (ms.includes('S')) st(); if (ms.includes('L')) turn(1); if (ms.includes('R')) turn(-1);
    });
  });
  W.zones.forEach(z => { if (z.type === 'school') [z.s0, z.s1 - 12].forEach(s => rect(z.road, s, s + 12, -HALF, HALF, [150, 60, 52], 3)); });
  W.cws.forEach(cw => {
    const r = cw.road;
    for (let u = -CURB + 0.6; u < CURB - 0.5; u += 1.0) rect(r, cw.s - 2.5, cw.s + 2.5, u, u + 0.45, C_WHITE, 4);
    rect(r, cw.s - 4.5, cw.s - 4.2, 0.3, HALF, C_WHITE, 4); rect(r, cw.s + 4.2, cw.s + 4.5, -HALF, -0.3, C_WHITE, 4);
    [-30, -50, 30, 50].forEach(o => {
      const s = cw.s + o, U = o < 0 ? 5.25 : -5.25;
      [U, U > 0 ? 1.75 : -1.75].forEach(u => {
        const p = (ds, du) => roadPt(r, s + ds, u + du), q = [p(-1.6, 0), p(0, 0.55), p(1.6, 0), p(0, -0.55)], q2 = [p(-1.1, 0), p(0, 0.32), p(1.1, 0), p(0, -0.32)];
        add([q[0].x, q[0].y, q[1].x, q[1].y, q[2].x, q[2].y, q[3].x, q[3].y], C_WHITE, 4); add([q2[0].x, q2[0].y, q2[1].x, q2[1].y, q2[2].x, q2[2].y, q2[3].x, q2[3].y], C_ASP, 4.5);
      });
    });
  });
  W.nodes.forEach(n => {
    const sq = (x0, y0, x1, y1, col, L) => add([x0, y0, x1, y0, x1, y1, x0, y1], col, L);
    sq(n.x - CURB, n.y - CURB, n.x + CURB, n.y + CURB, C_ASP, 2);
    const E = CURB + WALK;
    [[1, 1], [1, -1], [-1, 1], [-1, -1]].forEach(([a, b]) => sq(n.x + a * CURB, n.y + b * CURB, n.x + a * E, n.y + b * E, C_WALK, 0));
    const has = (ox, oy) => n.legs.some(g => Math.abs(g.ox - ox) + Math.abs(g.oy - oy) < 0.1);
    if (!has(1, 0)) sq(n.x + CURB, n.y - CURB, n.x + E, n.y + CURB, C_WALK, 0);
    if (!has(-1, 0)) sq(n.x - E, n.y - CURB, n.x - CURB, n.y + CURB, C_WALK, 0);
    if (!has(0, 1)) sq(n.x - CURB, n.y + CURB, n.x + CURB, n.y + E, C_WALK, 0);
    if (!has(0, -1)) sq(n.x - CURB, n.y - E, n.x + CURB, n.y - CURB, C_WALK, 0);
    if (n.sig) n.legs.forEach(g => {
      const tx = -g.ox, ty = -g.oy, rx = ty, ry = -tx;
      objs.push({ t: 'sig', x: n.x + tx * (CURB + 1.6) + rx * (CURB + 1.0), y: n.y + ty * (CURB + 1.6) + ry * (CURB + 1.0), tx, ty, rx, ry, node: n, ax: Math.abs(tx) > 0.5 ? 'EW' : 'NS', rad: 8 });
    });
  });
  flat.sort((a, b) => a.L - b.L);
  W.blds.forEach(b => objs.push({ t: 'bld', x: b.x, y: b.y, b, rad: Math.hypot(b.l, b.w) / 2, nl: 0.25 + rnd() * 0.5 }));
  W.trees.forEach(tr => objs.push({ t: 'tree', x: tr.x, y: tr.y, tr, rad: tr.r }));
  W.lamps.forEach(l => objs.push({ t: 'lamp', x: l.x, y: l.y, l, rad: 2 }));
  W.signs.forEach(sg => objs.push({ t: 'sign', x: sg.x, y: sg.y, sg, rad: 1 }));
  W.props.forEach(p => objs.push({ t: p.kind, x: p.x, y: p.y, p, rad: p.l ? p.l / 2 : 4 }));
  const stars = []; for (let i = 0; i < 140; i++) stars.push([rnd() * TAU, rnd() * 0.5 + 0.02, rnd()]);
  const hills = []; for (let i = 0; i < 96; i++) hills.push(0.012 + 0.03 * Math.abs(Math.sin(i * 0.37) * Math.cos(i * 0.13)) + rnd() * 0.012);
  const sky = []; for (let i = 0; i < 64; i++) sky.push(rnd() < 0.6 ? 0.012 + rnd() * 0.05 : 0);
  GEO = { flat, objs, stars, hills, sky };
  return GEO;
}

/* ----- 绘制各种物体 ----- */
const PP = { x: 0, y: 0, f: 0 }, PQ = { x: 0, y: 0, f: 0 };
const SIGC = { R: '#ff3b30', Y: '#ffc400', G: '#2bea74' };
function drawCar(ctx, K, a, k, fog, R) {
  const c = Math.cos(a.h), s = Math.sin(a.h);
  const cs = corners(a.x, a.y, a.h, a.l + 0.2, a.w + 0.2);
  quad(ctx, K, cs[0][0], cs[0][1], 0.012, cs[1][0], cs[1][1], 0.012, cs[2][0], cs[2][1], 0.012, cs[3][0], cs[3][1], 0.012, R.night ? 'rgba(0,0,0,.35)' : 'rgba(20,24,30,.32)');
  const col = a.col, glass = R.night ? [18, 22, 30] : [52, 66, 82];
  let mB;
  if (a.kind === 'bus') {
    box(ctx, K, a.x, a.y, a.h, a.l - 0.4, a.w - 0.08, 0.02, 0.5, [25, 25, 28], null, k, fog);
    mB = box(ctx, K, a.x, a.y, a.h, a.l, a.w, 0.35, a.ht, col, [235, 235, 232], k, fog);
    const gl = shade(glass, 1, fog);
    if (fog < 0.85) {
      if (mB & 8) decal(ctx, K, a.x, a.y, a.h, a.l, a.w, 8, -a.l / 2 + 0.6, a.l / 2 - 1.2, 1.35, 2.55, gl);
      if (mB & 2) decal(ctx, K, a.x, a.y, a.h, a.l, a.w, 2, -a.l / 2 + 0.6, a.l / 2 - 1.2, 1.35, 2.55, gl);
      if (mB & 1) decal(ctx, K, a.x, a.y, a.h, a.l, a.w, 1, -a.w / 2 + 0.15, a.w / 2 - 0.15, 1.0, 2.75, gl);
      if (mB & 4) decal(ctx, K, a.x, a.y, a.h, a.l, a.w, 4, -a.w / 2 + 0.25, a.w / 2 - 0.25, 1.6, 2.6, gl);
      if (mB & 2) decal(ctx, K, a.x, a.y, a.h, a.l, a.w, 2, -a.l / 2 + 0.3, a.l / 2 - 0.3, 0.9, 1.05, shade([250, 250, 250], k, fog));
      if (mB & 8) decal(ctx, K, a.x, a.y, a.h, a.l, a.w, 8, -a.l / 2 + 0.3, a.l / 2 - 0.3, 0.9, 1.05, shade([250, 250, 250], k, fog));
    }
  } else {
    box(ctx, K, a.x, a.y, a.h, a.l - 1.3, a.w - 0.1, 0.02, 0.42, [22, 22, 24], null, k, fog);
    mB = box(ctx, K, a.x, a.y, a.h, a.l, a.w, 0.3, 0.86, col, col, k, fog);
    const cl = a.l * 0.5, off = -a.l * 0.06, cx = a.x + c * off, cy = a.y + s * off, ch = a.ht || 1.45;
    const mC = box(ctx, K, cx, cy, a.h, cl, a.w * 0.86, 0.86, ch, glass, col, Math.min(k, 1.3), fog);
    if (a.coach && fog < 0.6) box(ctx, K, cx - c * 0.2, cy - s * 0.2, a.h, 0.45, 0.95, ch, ch + 0.26, [250, 196, 30], [250, 210, 60], k, fog);
    if (fog < 0.8 && (mC & 10)) { // 车门立柱
      const pc = shade(col, k * 0.9, fog);
      if (mC & 8) decal(ctx, K, cx, cy, a.h, cl, a.w * 0.86, 8, -0.04, 0.06, 0.86, ch, pc);
      if (mC & 2) decal(ctx, K, cx, cy, a.h, cl, a.w * 0.86, 2, -0.04, 0.06, 0.86, ch, pc);
    }
  }
  if (fog > 0.85) return;
  const hw = a.w / 2, zl0 = a.kind === 'bus' ? 0.6 : 0.6, zl1 = zl0 + 0.16;
  const blink = (R.t % 0.8) < 0.42;
  if (mB & 4) {
    const on = a.brk, tc = on ? '#ff2a2a' : R.night ? '#a01818' : '#b3262a';
    decal(ctx, K, a.x, a.y, a.h, a.l, a.w, 4, hw - 0.42, hw - 0.08, zl0, zl1, tc);
    decal(ctx, K, a.x, a.y, a.h, a.l, a.w, 4, -hw + 0.08, -hw + 0.42, zl0, zl1, tc);
    if (blink && (a.sig === 'L' || a.haz)) decal(ctx, K, a.x, a.y, a.h, a.l, a.w, 4, hw - 0.42, hw - 0.08, zl1, zl1 + 0.08, '#ffb020');
    if (blink && (a.sig === 'R' || a.haz)) decal(ctx, K, a.x, a.y, a.h, a.l, a.w, 4, -hw + 0.08, -hw + 0.42, zl1, zl1 + 0.08, '#ffb020');
    if (a.kind !== 'bus') decal(ctx, K, a.x, a.y, a.h, a.l, a.w, 4, -0.35, 0.35, 0.4, 0.52, shade([240, 240, 230], k, fog));
  }
  if (mB & 1) {
    const hc = R.night && a.hl !== 0 ? '#fffbe8' : shade([225, 228, 232], k, fog);
    decal(ctx, K, a.x, a.y, a.h, a.l, a.w, 1, hw - 0.48, hw - 0.1, zl0, zl1, hc);
    decal(ctx, K, a.x, a.y, a.h, a.l, a.w, 1, -hw + 0.1, -hw + 0.48, zl0, zl1, hc);
    if (blink && (a.sig === 'L' || a.haz)) decal(ctx, K, a.x, a.y, a.h, a.l, a.w, 1, hw - 0.16, hw - 0.02, zl0 - 0.1, zl1, '#ffb020');
    if (blink && (a.sig === 'R' || a.haz)) decal(ctx, K, a.x, a.y, a.h, a.l, a.w, 1, -hw + 0.02, -hw + 0.16, zl0 - 0.1, zl1, '#ffb020');
  }
  if (blink && (a.sig || a.haz)) {
    if ((mB & 8) && (a.sig === 'L' || a.haz)) decal(ctx, K, a.x, a.y, a.h, a.l, a.w, 8, a.l / 2 - 0.9, a.l / 2 - 0.7, 0.7, 0.78, '#ffb020');
    if ((mB & 2) && (a.sig === 'R' || a.haz)) decal(ctx, K, a.x, a.y, a.h, a.l, a.w, 2, a.l / 2 - 0.9, a.l / 2 - 0.7, 0.7, 0.78, '#ffb020');
  }
  if (R.night) R.glows.push(a);
}
function carGlows(ctx, K, R) {
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  for (const a of R.glows) {
    const c = Math.cos(a.h), s = Math.sin(a.h), hw = a.w / 2 - 0.3;
    for (const [dir, colr, rad] of [[1, '255,245,220', a.hl === 2 ? 2.4 : 1.1], [-1, '255,40,30', a.brk ? 0.9 : 0.45]]) {
      if (a.hl === 0 && dir > 0) continue;
      for (const sd of [1, -1]) {
        const x = a.x + c * dir * a.l / 2 - s * sd * hw, y = a.y + s * dir * a.l / 2 + c * sd * hw;
        if (!proj(K, x, y, 0.68, PP)) continue;
        const facing = ((K.x - x) * c + (K.y - y) * s) * dir > 0;
        if (!facing) continue;
        const r = Math.min(120, rad * K.F / PP.f);
        if (r < 0.8) continue;
        const g = ctx.createRadialGradient(PP.x, PP.y, 0, PP.x, PP.y, r);
        g.addColorStop(0, 'rgba(' + colr + ',.95)'); g.addColorStop(0.25, 'rgba(' + colr + ',.35)'); g.addColorStop(1, 'rgba(' + colr + ',0)');
        ctx.fillStyle = g; ctx.fillRect(PP.x - r, PP.y - r, r * 2, r * 2);
      }
    }
  }
  ctx.restore();
}
function drawPerson(ctx, K, p, k, fog, R, ht) {
  if (!proj(K, p.x, p.y, 0, PP) || !proj(K, p.x, p.y, ht, PQ)) return;
  const H = PP.y - PQ.y; if (H < 1.5) return;
  const x = PP.x, w = H * 0.26, sw = Math.sin(p.ph || 0) * H * 0.09;
  ctx.lineCap = 'round';
  ctx.strokeStyle = shade([40, 44, 56], k, fog); ctx.lineWidth = Math.max(1, w * 0.36);
  ctx.beginPath(); ctx.moveTo(x, PP.y - H * 0.46); ctx.lineTo(x - sw, PP.y); ctx.moveTo(x, PP.y - H * 0.46); ctx.lineTo(x + sw, PP.y); ctx.stroke();
  ctx.fillStyle = shade(p.col, k, fog);
  ctx.beginPath(); if (ctx.roundRect) ctx.roundRect(x - w / 2, PP.y - H * 0.82, w, H * 0.4, w * 0.3); else ctx.rect(x - w / 2, PP.y - H * 0.82, w, H * 0.4); ctx.fill();
  ctx.fillStyle = shade([236, 196, 160], k, fog); ctx.beginPath(); ctx.arc(x, PP.y - H * 0.9, H * 0.09, 0, TAU); ctx.fill();
  ctx.fillStyle = shade([30, 26, 24], k, fog); ctx.beginPath(); ctx.arc(x, PP.y - H * 0.93, H * 0.085, PI, TAU); ctx.fill();
  if (p.kid) { ctx.fillStyle = shade([230, 60, 50], k, fog); ctx.fillRect(x - w * 0.55, PP.y - H * 0.8, w * 0.22, H * 0.3); }
}
function drawBike(ctx, K, b, k, fog, R) {
  const c = Math.cos(b.h), s = Math.sin(b.h);
  if (!proj(K, b.x - c * 0.8, b.y - s * 0.8, 0.35, PP) || !proj(K, b.x + c * 0.8, b.y + s * 0.8, 0.35, PQ)) return;
  const r = 0.33 * K.F / ((PP.f + PQ.f) / 2); if (r < 0.6) return;
  ctx.strokeStyle = shade([30, 30, 34], k, fog); ctx.lineWidth = Math.max(1, r * 0.18);
  ctx.beginPath(); ctx.ellipse(PP.x, PP.y, Math.max(1, Math.abs(PQ.x - PP.x) * 0.25 + r * 0.25), r, 0, 0, TAU); ctx.stroke();
  ctx.beginPath(); ctx.ellipse(PQ.x, PQ.y, Math.max(1, Math.abs(PQ.x - PP.x) * 0.25 + r * 0.25), r, 0, 0, TAU); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(PP.x, PP.y); ctx.lineTo((PP.x + PQ.x) / 2, PP.y - r * 1.4); ctx.lineTo(PQ.x, PQ.y); ctx.stroke();
  drawPerson(ctx, K, { x: b.x, y: b.y, col: b.col, ph: 0 }, k, fog, R, 1.75);
}
function drawTree(ctx, K, tr, k, fog, R) {
  if (!proj(K, tr.x, tr.y, 0, PP) || !proj(K, tr.x, tr.y, tr.ht * 0.62, PQ)) return;
  const sc = K.F / PP.f, rr2 = tr.r * sc; if (rr2 < 0.7) return;
  ctx.strokeStyle = shade([110, 82, 60], k, fog); ctx.lineWidth = Math.max(1, 0.28 * sc);
  ctx.beginPath(); ctx.moveTo(PP.x, PP.y); ctx.lineTo(PQ.x, PQ.y); ctx.stroke();
  ctx.fillStyle = shade([58, 112, 58], k, fog); ctx.beginPath(); ctx.arc(PQ.x, PQ.y, rr2, 0, TAU); ctx.fill();
  if (rr2 > 3) { ctx.fillStyle = shade([86, 146, 74], k, fog); ctx.beginPath(); ctx.arc(PQ.x - rr2 * 0.25, PQ.y - rr2 * 0.3, rr2 * 0.62, 0, TAU); ctx.fill(); }
}
function drawLamp(ctx, K, l, k, fog, R) {
  if (!proj(K, l.x, l.y, 0, PP) || !proj(K, l.x, l.y, 8, PQ)) return;
  const sc = K.F / PP.f; if (sc < 0.3) return;
  ctx.strokeStyle = shade([120, 126, 134], k, fog); ctx.lineWidth = Math.max(1, 0.16 * sc);
  ctx.beginPath(); ctx.moveTo(PP.x, PP.y); ctx.lineTo(PQ.x, PQ.y);
  const hx = l.x + Math.cos(l.h) * 1.8, hy = l.y + Math.sin(l.h) * 1.8;
  if (proj(K, hx, hy, 8, PP)) { ctx.lineTo(PP.x, PP.y); ctx.stroke(); ctx.fillStyle = R.night ? '#fff3cf' : shade([90, 96, 104], k, fog); ctx.fillRect(PP.x - 0.35 * sc, PP.y - 0.06 * sc, 0.7 * sc, 0.22 * sc);
    if (R.night) R.lampG.push([PP.x, PP.y, sc]); }
  else ctx.stroke();
}
function signFace(ctx, kind, val, x, y, r, k) {
  ctx.save(); ctx.translate(x, y); ctx.globalAlpha = Math.max(0.25, Math.min(1, k));
  if (kind === 'speed' || kind === 'nohorn') {
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.fill();
    ctx.strokeStyle = '#d61f26'; ctx.lineWidth = r * 0.2; ctx.beginPath(); ctx.arc(0, 0, r * 0.88, 0, TAU); ctx.stroke();
    if (kind === 'speed') { if (r > 4) { ctx.fillStyle = '#111'; ctx.font = 'bold ' + (r * 0.95) + 'px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(String(val), 0, r * 0.06); } }
    else { ctx.fillStyle = '#111'; ctx.beginPath(); ctx.moveTo(-r * .45, -r * .15); ctx.lineTo(-r * .2, -r * .15); ctx.lineTo(r * .3, -r * .45); ctx.lineTo(r * .3, r * .45); ctx.lineTo(-r * .2, r * .15); ctx.lineTo(-r * .45, r * .15); ctx.fill(); ctx.strokeStyle = '#d61f26'; ctx.lineWidth = r * .16; ctx.beginPath(); ctx.moveTo(-r * .62, -r * .62); ctx.lineTo(r * .62, r * .62); ctx.stroke(); }
  } else if (kind === 'school') {
    ctx.fillStyle = '#f5c400'; ctx.strokeStyle = '#111'; ctx.lineWidth = r * 0.1; ctx.beginPath(); ctx.moveTo(0, -r); ctx.lineTo(r * 1.05, r * 0.8); ctx.lineTo(-r * 1.05, r * 0.8); ctx.closePath(); ctx.fill(); ctx.stroke();
    if (r > 4) { ctx.fillStyle = '#111'; [[-0.3, 0.2], [0.25, 0.32]].forEach(([dx, sz]) => { ctx.beginPath(); ctx.arc(dx * r, -0.05 * r - sz * r * 0.2, r * 0.11, 0, TAU); ctx.fill(); ctx.fillRect(dx * r - r * 0.09, 0.02 * r, r * 0.18, r * 0.42); }); }
  } else if (kind === 'cw') {
    ctx.fillStyle = '#1556c0'; ctx.fillRect(-r, -r, r * 2, r * 2); ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.moveTo(0, -r * .8); ctx.lineTo(r * .8, r * .6); ctx.lineTo(-r * .8, r * .6); ctx.closePath(); ctx.fill();
    if (r > 4) { ctx.fillStyle = '#111'; ctx.beginPath(); ctx.arc(0, -r * .2, r * .1, 0, TAU); ctx.fill(); ctx.fillRect(-r * .06, -r * .1, r * .12, r * .4); for (let i = -2; i <= 2; i++) ctx.fillRect(i * r * .2 - r * .07, r * .42, r * .12, r * .12); }
  } else if (kind === 'bus') {
    ctx.fillStyle = '#1556c0'; ctx.fillRect(-r * .8, -r, r * 1.6, r * 2); ctx.fillStyle = '#fff';
    if (r > 4) { ctx.font = 'bold ' + r * 0.5 + 'px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('公交', 0, -r * 0.35); ctx.fillText('车站', 0, r * 0.35); }
  } else if (kind === 'uturn') {
    ctx.fillStyle = '#1556c0'; ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.fill(); ctx.strokeStyle = '#fff'; ctx.lineWidth = r * .17; ctx.beginPath(); ctx.moveTo(r * .35, r * .55); ctx.lineTo(r * .35, -r * .1); ctx.arc(0, -r * .1, r * .35, 0, PI, true); ctx.lineTo(-r * .35, r * .25); ctx.stroke();
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.moveTo(-r * .62, r * .2); ctx.lineTo(-r * .08, r * .2); ctx.lineTo(-r * .35, r * .62); ctx.fill();
  } else if (kind === 'schoolname') {
    ctx.fillStyle = '#fff'; ctx.fillRect(-r * 1.6, -r * 0.5, r * 3.2, r); ctx.strokeStyle = '#1556c0'; ctx.lineWidth = r * 0.08; ctx.strokeRect(-r * 1.55, -r * .45, r * 3.1, r * .9);
    if (r > 5) { ctx.fillStyle = '#1556c0'; ctx.font = 'bold ' + r * 0.5 + 'px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('学校区域', 0, 0); }
  }
  ctx.restore();
}
function drawSign(ctx, K, sg, k, fog, R) {
  const z = sg.kind === 'schoolname' ? 2.0 : 2.6;
  if (!proj(K, sg.x, sg.y, 0, PP) || !proj(K, sg.x, sg.y, z, PQ)) return;
  const sc = K.F / PP.f; if (sc < 0.4) return;
  ctx.strokeStyle = shade([150, 156, 164], k, fog); ctx.lineWidth = Math.max(1, 0.08 * sc);
  ctx.beginPath(); ctx.moveTo(PP.x, PP.y); ctx.lineTo(PQ.x, PQ.y); ctx.stroke();
  const front = (K.x - sg.x) * Math.cos(sg.fh) + (K.y - sg.y) * Math.sin(sg.fh) > 0;
  const r = 0.4 * sc;
  if (!front) { ctx.fillStyle = shade([150, 156, 164], k, fog); ctx.beginPath(); ctx.arc(PQ.x, PQ.y, r, 0, TAU); ctx.fill(); return; }
  signFace(ctx, sg.kind, sg.val, PQ.x, PQ.y, r, R.night ? Math.max(0.55, k) : 1 - fog * 0.7);
}
function drawSignal(ctx, K, o, k, fog, R) {
  const H = 6.2, armL = 7.2;
  box(ctx, K, o.x, o.y, Math.atan2(o.ty, o.tx), 0.26, 0.26, 0, H, [110, 116, 124], [110, 116, 124], k, fog);
  const ax = o.x - o.rx * armL / 2, ay = o.y - o.ry * armL / 2;
  box(ctx, K, ax, ay, Math.atan2(o.ry, o.rx), armL, 0.18, H - 0.25, H - 0.05, [110, 116, 124], [110, 116, 124], k, fog);
  const front = (K.x - o.x) * -o.tx + (K.y - o.y) * -o.ty > 0;
  const hds = [['L', armL - 0.6], ['S', armL - 2.0]];
  for (const [mv, d] of hds) {
    const hx = o.x - o.rx * d, hy = o.y - o.ry * d;
    box(ctx, K, hx, hy, Math.atan2(o.ty, o.tx), 0.36, 0.5, H - 1.55, H - 0.25, [28, 30, 34], [28, 30, 34], k, fog);
    if (!front || fog > 0.9) continue;
    const st = sigState(o.node, o.ax, mv, R.t).c;
    ['R', 'Y', 'G'].forEach((cc, i) => {
      if (!proj(K, hx - o.tx * 0.2, hy - o.ty * 0.2, H - 0.5 - i * 0.4, PP)) return;
      const rad = 0.15 * K.F / PP.f; if (rad < 0.5) return;
      const on = st === cc;
      if (on) {
        const gr = rad * (R.night ? 6 : 3.2), g = ctx.createRadialGradient(PP.x, PP.y, 0, PP.x, PP.y, gr);
        g.addColorStop(0, SIGC[cc] + 'cc'); g.addColorStop(1, SIGC[cc] + '00'); ctx.fillStyle = g; ctx.fillRect(PP.x - gr, PP.y - gr, gr * 2, gr * 2);
      }
      ctx.fillStyle = on ? SIGC[cc] : '#2a2c30'; ctx.beginPath(); ctx.arc(PP.x, PP.y, rad, 0, TAU); ctx.fill();
      if (on && mv === 'L' && rad > 2.5) { ctx.fillStyle = '#111'; ctx.beginPath(); ctx.moveTo(PP.x - rad * .7, PP.y); ctx.lineTo(PP.x - rad * .1, PP.y - rad * .55); ctx.lineTo(PP.x - rad * .1, PP.y - rad * .2); ctx.lineTo(PP.x + rad * .65, PP.y - rad * .2); ctx.lineTo(PP.x + rad * .65, PP.y + rad * .2); ctx.lineTo(PP.x - rad * .1, PP.y + rad * .2); ctx.lineTo(PP.x - rad * .1, PP.y + rad * .55); ctx.fill(); }
    });
  }
}
function drawBld(ctx, K, o, k, fog, R, d) {
  const b = o.b;
  const m = box(ctx, K, b.x, b.y, b.h, b.l, b.w, 0, b.z, b.col, b.roof || [b.col[0] * 0.8, b.col[1] * 0.8, b.col[2] * 0.82], k, fog);
  if (!b.win || d > 160 || fog > 0.7) return;
  const floors = Math.min(R.lite ? 3 : 10, Math.floor(b.z / 3.3)), lit = R.night;
  for (const face of [1, 2, 4, 8]) {
    if (!(m & face)) continue;
    const along = face === 1 || face === 4, len = along ? b.w : b.l, half = len / 2 - 1.2;
    if (half < 1) continue;
    for (let f = 0; f < floors; f++) {
      const z0 = f * 3.3 + 1.1, col = lit ? (((f * 7 + (o.nl * 100 | 0)) % 5) < 3 ? '#ffd98a' : '#2a3040') : shade([92, 112, 134], k, fog);
      decal(ctx, K, b.x, b.y, b.h, b.l, b.w, face, -half, half, z0, z0 + 1.3, col);
    }
  }
}
function drawProp(ctx, K, o, k, fog, R) {
  const p = o.p;
  if (o.t === 'bus') { drawCar(ctx, K, { x: p.x, y: p.y, h: p.h, l: p.l, w: p.w, ht: p.ht, col: p.col, kind: 'bus', brk: false, sig: '', haz: true, hl: 1 }, k, fog, R); return; }
  if (o.t === 'shelter') {
    box(ctx, K, p.x + Math.cos(p.h + PI / 2) * -0.0, p.y, p.h, 6, 0.12, 0, 2.5, [150, 190, 220], null, k, fog);
    box(ctx, K, p.x, p.y, p.h, 6.4, 1.8, 2.5, 2.7, [40, 90, 170], [40, 90, 170], k, fog);
    return;
  }
  if (o.t === 'fence') { box(ctx, K, p.x, p.y, p.h, p.l, 0.12, 0, 1.5, [60, 120, 90], [60, 120, 90], k, fog); return; }
  if (o.t === 'gate') {
    const c = Math.cos(p.h), s = Math.sin(p.h);
    [-4, 4].forEach(dd => box(ctx, K, p.x + c * dd, p.y + s * dd, p.h, 0.8, 0.8, 0, 3.6, [200, 80, 60], [180, 70, 50], k, fog));
    const m = box(ctx, K, p.x, p.y, p.h, 9.6, 0.6, 3.6, 4.6, [200, 80, 60], [180, 70, 50], k, fog);
    if (proj(K, p.x, p.y, 4.1, PP) && (m & 10)) { const sc = K.F / PP.f; if (sc > 4) { ctx.fillStyle = '#ffe9a8'; ctx.font = 'bold ' + (0.62 * sc) + 'px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('育才小学', PP.x, PP.y); } }
  }
}
/* 场景渲染：sky → ground → flat → 夜间地面光 → 物体（远到近） → 光晕 */
function drawScene(ctx, K, sim, R) {
  const G = geo(), W = sim.W, night = sim.night, t = sim.t;
  FOGC = night ? [10, 13, 22] : [207, 225, 242];
  camPrep(K);
  const hy = K.cy - Math.tan(K.p) * K.F;
  // 天空
  const sg = ctx.createLinearGradient(0, hy - K.F * 0.6, 0, hy);
  if (night) { sg.addColorStop(0, '#02040b'); sg.addColorStop(1, '#16203a'); } else { sg.addColorStop(0, '#4f8fd6'); sg.addColorStop(0.7, '#a8cdf0'); sg.addColorStop(1, '#d6e8f7'); }
  ctx.fillStyle = sg; ctx.fillRect(0, 0, K.W, Math.max(0, hy + 2));
  const azX = az => { const rel = angN(az - K.h); return Math.abs(rel) < 1.45 ? K.cx - Math.tan(rel) * K.F : null; };
  if (night && !R.lite) {
    ctx.fillStyle = '#fff';
    for (const [az, el, b] of G.stars) { const x = azX(az); if (x == null) continue; const y = hy - Math.tan(el) * K.F; ctx.globalAlpha = 0.35 + b * 0.6; ctx.fillRect(x, y, b > 0.8 ? 2 : 1.2, b > 0.8 ? 2 : 1.2); }
    ctx.globalAlpha = 1; const mx = azX(2.4); if (mx != null) { ctx.fillStyle = '#f4f1dc'; ctx.beginPath(); ctx.arc(mx, hy - K.F * 0.42, Math.max(6, K.F * 0.022), 0, TAU); ctx.fill(); }
  }
  // 远山 + 城市天际线
  const ridge = (arr, col, scale) => {
    ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(0, hy + 1);
    const n = arr.length; let started = false;
    for (let i = 0; i <= n * 2; i++) {
      const az = i / (n * 2) * TAU, x = azX(az); if (x == null) { continue; }
      const v = arr[i % n] * scale + (arr[(i + 1) % n] * scale - arr[i % n] * scale) * 0;
      if (!started) { ctx.lineTo(x, hy + 1); started = true; }
      ctx.lineTo(x, hy - v * K.F);
    }
    ctx.lineTo(K.W, hy + 1); ctx.closePath(); ctx.fill();
  };
  if (!R.lite) { ridge(G.hills, night ? '#0d1424' : '#9db8cf', 1); ridge(G.sky, night ? '#121a2c' : '#b7c9d8', 1); }
  // 地面
  const gg = ctx.createLinearGradient(0, hy, 0, K.H);
  const gc = night ? [18, 26, 20] : C_GRASS;
  gg.addColorStop(0, 'rgb(' + FOGC.join(',') + ')'); gg.addColorStop(0.08, shade(gc, night ? 0.25 : 0.95, 0.3)); gg.addColorStop(1, shade(gc, night ? 0.3 : 1, 0));
  ctx.fillStyle = gg; ctx.fillRect(0, hy, K.W, K.H - hy);
  // 平面要素
  const far = K.far, far2 = far * far, mkFar = R.lite ? 70 : 170;
  const nk = night ? 0.3 : 1;
  for (const p of G.flat) {
    const dx = p.cx - K.x, dy = p.cy - K.y, d2 = dx * dx + dy * dy, lim = (p.L >= 4 ? mkFar : far) + p.rad;
    if (d2 > lim * lim) continue;
    const fw = dx * K.c + dy * K.s; if (fw < -p.rad - 2) continue;
    const d = Math.sqrt(d2), fg = d < 50 ? 0 : Math.min(0.92, Math.pow((d - 50) / (far - 50), 1.25));
    polyW(ctx, K, p.P, p.n, shade(p.col, nk * (p.L >= 4 && night ? 1.25 : 1), fg));
  }
  // 夜间：路灯光池 + 前照灯光束（叠加）
  R.glows = []; R.lampG = []; R.night = night; R.t = t;
  if (night) {
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    for (const l of W.lamps) {
      const dx = l.x - K.x, dy = l.y - K.y; if (dx * dx + dy * dy > 130 * 130) continue;
      const gx = l.x + Math.cos(l.h) * 3, gy = l.y + Math.sin(l.h) * 3;
      if (!proj(K, gx, gy, 0, PP)) continue;
      const rx = 11 * K.F / PP.f, ry = Math.max(2, rx * Math.min(1, (K.z + 0.5) / Math.max(PP.f, 1) * 1.6));
      const g = ctx.createRadialGradient(PP.x, PP.y, 0, PP.x, PP.y, rx);
      g.addColorStop(0, 'rgba(255,190,110,.32)'); g.addColorStop(1, 'rgba(255,190,110,0)');
      ctx.fillStyle = g; ctx.save(); ctx.translate(PP.x, PP.y); ctx.scale(1, ry / rx); ctx.translate(-PP.x, -PP.y); ctx.fillRect(PP.x - rx, PP.y - rx, rx * 2, rx * 2); ctx.restore();
    }
    const beamCars = [{ c: sim.pl, b: beam(sim.pl.L), on: sim.pl.L.rot > 0 || sim.pl.L.flash }];
    for (const bc of beamCars) {
      if (bc.b === 'off') { if (!bc.on) continue; }
      const c = bc.c, hi = bc.b === 'high', len = hi ? 120 : bc.b === 'low' ? 42 : 8, sp = hi ? 0.2 : 0.42, ch = Math.cos(c.h), sh = Math.sin(c.h);
      const ds = [2.3, 4, 7, 12, 20, 30, 45, 65, 90, 120].filter(d => d <= len + 0.1);
      const pts = [];
      for (const d of ds) { const w = 0.9 + (d - 2.3) * sp + (hi ? 0 : 0); pts.push([c.x + ch * d + sh * (w + (hi ? 0 : 0.6)), c.y + sh * d - ch * (w + (hi ? 0 : 0.6))]); }
      for (let i = ds.length - 1; i >= 0; i--) { const d = ds[i], w = 0.9 + (d - 2.3) * sp * (hi ? 1 : 0.75); pts.push([c.x + ch * d - sh * w, c.y + sh * d + ch * w]); }
      const P = new Float64Array(pts.length * 3); pts.forEach((p, i) => { P[i * 3] = p[0]; P[i * 3 + 1] = p[1]; P[i * 3 + 2] = 0.03; });
      proj(K, c.x + ch * 3, c.y + sh * 3, 0, PP); const y0 = PP.f > NEAR ? PP.y : K.H;
      proj(K, c.x + ch * len, c.y + sh * len, 0, PQ); const y1 = PQ.f > NEAR ? PQ.y : hy;
      const g = ctx.createLinearGradient(0, Math.min(K.H, y0), 0, y1);
      g.addColorStop(0, hi ? 'rgba(255,244,214,.62)' : 'rgba(255,238,200,.55)'); g.addColorStop(0.55, hi ? 'rgba(255,244,214,.3)' : 'rgba(255,238,200,.22)'); g.addColorStop(1, 'rgba(255,238,200,0)');
      polyW(ctx, K, P, pts.length, g);
    }
    ctx.restore();
  }
  // 物体收集
  const list = R.list || (R.list = []); list.length = 0;
  const pl = sim.pl, ph = beam(pl.L), bl = ph === 'high' ? 120 : ph === 'low' ? 45 : 0, pch = Math.cos(pl.h), psh = Math.sin(pl.h);
  const push = (o, x, y, rad, maxd) => {
    const dx = x - K.x, dy = y - K.y, d2 = dx * dx + dy * dy, md = Math.min(far, maxd) + rad; if (d2 > md * md) return;
    const fw = dx * K.c + dy * K.s; if (fw < -rad - 1) return;
    const lat = dx * K.s - dy * K.c; if (Math.abs(lat) > Math.max(0, fw) * K.tx + rad + 4) return;
    list.push({ o, x, y, d: Math.sqrt(d2), fw });
  };
  for (const o of G.objs) push(o, o.x, o.y, o.rad, o.t === 'tree' ? (R.lite ? 90 : 230) : o.t === 'lamp' ? 190 : o.t === 'sign' ? 140 : o.t === 'sig' ? 300 : far);
  for (const a of sim.ai) push({ t: 'car', a }, a.x, a.y, a.l / 2, far);
  for (const st of sim.cw) for (const p of st.peds) push({ t: 'ped', p }, p.x, p.y, 0.5, 160);
  for (const b of sim.cyc) push({ t: 'bike', b }, b.x, b.y, 1, 160);
  for (const w of sim.walkers) push({ t: 'ped', p: w }, w.x, w.y, 0.5, 120);
  if (R.showPlayer) push({ t: 'car', a: R.plCar }, pl.x, pl.y, 2.5, far);
  list.sort((a, b) => b.fw - a.fw);
  for (const it of list) {
    const o = it.o, d = it.d, fg = d < 50 ? 0 : Math.min(0.92, Math.pow((d - 50) / (far - 50), 1.25));
    let k = 1;
    if (night) {
      k = o.t === 'bld' ? 0.2 : 0.24;
      if (bl) { const dx = it.x - pl.x, dy = it.y - pl.y, f = dx * pch + dy * psh, l = Math.abs(-dx * psh + dy * pch); if (f > 0 && f < bl && l < f * (ph === 'high' ? 0.25 : 0.45) + 2.5) k += (1 - f / bl) * (ph === 'high' ? 1.1 : 0.9); }
    }
    switch (o.t) {
      case 'bld': drawBld(ctx, K, o, k, fg, R, d); break;
      case 'tree': drawTree(ctx, K, o.tr, k, fg, R); break;
      case 'lamp': drawLamp(ctx, K, o.l, k, fg, R); break;
      case 'sign': drawSign(ctx, K, o.sg, k, fg, R); break;
      case 'sig': drawSignal(ctx, K, o, k, fg, R); break;
      case 'car': {
        const a = o.a;
        if (a === R.plCar) { a.x = pl.x; a.y = pl.y; a.h = pl.h; }
        a.hl = night ? (a === R.plCar ? (ph === 'high' ? 2 : ph === 'low' ? 1 : 0) : (a.slow || a.kind ? 1 : 1)) : 0;
        drawCar(ctx, K, a, k, fg, R); break;
      }
      case 'ped': drawPerson(ctx, K, o.p, k, fg, R, o.p.kid ? 1.25 : 1.7); break;
      case 'bike': drawBike(ctx, K, o.b, k, fg, R); break;
      default: drawProp(ctx, K, o, k, fg, R);
    }
  }
  if (night) {
    carGlows(ctx, K, R);
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    for (const [x, y, sc] of R.lampG) { const r = Math.min(80, 2.2 * sc); const g = ctx.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, 'rgba(255,230,170,.8)'); g.addColorStop(1, 'rgba(255,200,120,0)'); ctx.fillStyle = g; ctx.fillRect(x - r, y - r, r * 2, r * 2); }
    ctx.restore();
  }
}

/* ----- 俯视图 ----- */
function drawTop(ctx, sim, Wd, Ht, R) {
  const G = geo(), pl = sim.pl, sc = R.topZoom || 5.2, night = sim.night;
  ctx.save();
  ctx.fillStyle = night ? '#141c18' : '#7fa766'; ctx.fillRect(0, 0, Wd, Ht);
  ctx.translate(Wd / 2, Ht * 0.58); ctx.scale(sc, -sc); ctx.rotate(-(pl.h - PI / 2)); ctx.translate(-pl.x, -pl.y);
  const rad = Math.hypot(Wd, Ht) / sc * 0.7, nk = night ? 0.45 : 1;
  FOGC = [0, 0, 0];
  for (const p of G.flat) {
    if (Math.abs(p.cx - pl.x) > rad + p.rad || Math.abs(p.cy - pl.y) > rad + p.rad) continue;
    ctx.fillStyle = shade(p.col, nk, 0); ctx.beginPath(); for (let i = 0; i < p.n; i++) { if (i) ctx.lineTo(p.P[i * 3], p.P[i * 3 + 1]); else ctx.moveTo(p.P[0], p.P[1]); } ctx.fill();
  }
  const rect = (x, y, h, l, w, col) => { const cs = corners(x, y, h, l, w); ctx.fillStyle = col; ctx.beginPath(); cs.forEach((q, i) => i ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1])); ctx.fill(); };
  for (const o of G.objs) {
    if (Math.abs(o.x - pl.x) > rad + 30 || Math.abs(o.y - pl.y) > rad + 30) continue;
    if (o.t === 'bld') { const b = o.b; rect(b.x, b.y, b.h, b.l, b.w, shade(b.roof || [b.col[0] * .82, b.col[1] * .82, b.col[2] * .84], nk, 0)); }
    else if (o.t === 'tree') { ctx.fillStyle = night ? '#1d3a1f' : '#3f7a3c'; ctx.beginPath(); ctx.arc(o.x, o.y, o.tr.r, 0, TAU); ctx.fill(); }
    else if (o.t === 'sig') {
      const st = sigState(o.node, o.ax, 'S', sim.t).c, sl = sigState(o.node, o.ax, 'L', sim.t).c;
      const bx = o.node.x - o.tx * (SL + 1.2), by = o.node.y - o.ty * (SL + 1.2);
      [[1.75, sl], [5.25, st]].forEach(([u, c]) => { ctx.fillStyle = SIGC[c]; ctx.beginPath(); ctx.arc(bx + o.rx * u, by + o.ry * u, 0.9, 0, TAU); ctx.fill(); });
    } else if (o.t === 'bus' || o.t === 'shelter') rect(o.p.x, o.p.y, o.p.h, o.p.l || 6.4, o.p.w || 1.8, o.t === 'bus' ? 'rgb(40,150,90)' : '#2b5aa8');
  }
  const car = (a, col) => { rect(a.x, a.y, a.h, a.l, a.w, col); const c = Math.cos(a.h), s = Math.sin(a.h); rect(a.x + c * a.l * 0.12, a.y + s * a.l * 0.12, a.h, a.l * 0.22, a.w * 0.8, 'rgba(20,30,45,.75)'); };
  for (const a of sim.ai) car(a, shade(a.col, nk, 0));
  ctx.fillStyle = '#ffd25a';
  for (const st of sim.cw) for (const p of st.peds) { ctx.beginPath(); ctx.arc(p.x, p.y, 0.45, 0, TAU); ctx.fill(); }
  for (const w of sim.walkers) { ctx.beginPath(); ctx.arc(w.x, w.y, 0.4, 0, TAU); ctx.fill(); }
  for (const b of sim.cyc) rect(b.x, b.y, b.h, 1.7, 0.6, '#ffb347');
  if (night) { const b = beam(pl.L); if (b !== 'off') { const L = b === 'high' ? 90 : 38, c = Math.cos(pl.h), s = Math.sin(pl.h); const g = ctx.createRadialGradient(pl.x, pl.y, 2, pl.x, pl.y, L); g.addColorStop(0, 'rgba(255,240,200,.5)'); g.addColorStop(1, 'rgba(255,240,200,0)'); ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(pl.x + c * 2, pl.y + s * 2); const sp = b === 'high' ? 0.22 : 0.4; ctx.lineTo(pl.x + c * L - s * L * sp, pl.y + s * L + c * L * sp); ctx.lineTo(pl.x + c * L + s * L * sp, pl.y + s * L - c * L * sp); ctx.fill(); } }
  car({ x: pl.x, y: pl.y, h: pl.h, l: CAR_L, w: CAR_W }, '#ff7a1a');
  // 车轮
  const c = Math.cos(pl.h), s = Math.sin(pl.h), d = clamp(pl.sw / SR, -MAXD, MAXD);
  for (const [a, b, f] of [[1.3, 0.8, 1], [1.3, -0.8, 1], [-1.3, 0.8, 0], [-1.3, -0.8, 0]]) rect(pl.x + c * a - s * b, pl.y + s * a + c * b, pl.h + (f ? d : 0), 0.65, 0.25, '#111');
  ctx.restore();
}
/* ----- 小地图 ----- */
let MINI = null;
function miniMap(sz) {
  if (MINI && MINI.sz === sz) return MINI;
  const W = getWorld(), cv = document.createElement('canvas'), pad = 30, sc = sz / (GX[2] + pad * 2);
  cv.width = sz; cv.height = Math.round((GY[2] + pad * 2) * sc);
  const g = cv.getContext('2d'); g.fillStyle = 'rgba(16,22,32,.78)'; g.fillRect(0, 0, cv.width, cv.height);
  const X = x => (x + pad) * sc, Y = y => cv.height - (y + pad) * sc;
  g.fillStyle = 'rgba(255,255,255,.08)'; W.blds.forEach(b => g.fillRect(X(b.x) - 1.5, Y(b.y) - 1.5, 3, 3));
  g.strokeStyle = '#9aa6b8'; g.lineWidth = Math.max(2, 14 * sc); g.lineCap = 'round';
  W.roads.forEach(r => { g.beginPath(); g.moveTo(X(r.ax), Y(r.ay)); g.lineTo(X(r.b.x), Y(r.b.y)); g.stroke(); });
  g.strokeStyle = 'rgba(249,115,22,.85)'; g.lineWidth = Math.max(1.5, 4 * sc);
  ['H00', 'V10', 'V11', 'H21'].forEach(id => { const r = W.R[id]; g.beginPath(); g.moveTo(X(r.ax), Y(r.ay)); g.lineTo(X(r.b.x), Y(r.b.y)); g.stroke(); });
  W.nodes.forEach(n => { if (n.sig) { g.fillStyle = '#fff'; g.beginPath(); g.arc(X(n.x), Y(n.y), 2, 0, TAU); g.fill(); } });
  MINI = { cv, sz, X, Y, sc }; return MINI;
}
