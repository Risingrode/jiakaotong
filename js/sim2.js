/* 驾考通 · 科目二 场地驾驶模拟器（倒车入库 / 侧方停车 / 坡道定点停车和起步 / 直角转弯 / 曲线行驶）
 * 纯 Canvas 2D，零依赖。单位：米、秒、弧度。坐标：x 向东，y 向南（与画布一致），航向角 th 顺时针为正。
 * 结构：① 纯逻辑核心（几何 / 场地 / 物理 / 评判 / 教学演示）——可在 node 中单元测试；② 界面层（App.define('sim2')）。 */
(function () {
  'use strict';
  const PI = Math.PI, D2R = PI / 180, W2RPM = 60 / (2 * PI), RPM2W = 1 / W2RPM;
  const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
  const lerp = (a, b, t) => a + (b - a) * t;
  const wrap = a => { while (a > PI) a -= 2 * PI; while (a < -PI) a += 2 * PI; return a; };
  const hyp = Math.hypot;

  /* ================= 车辆参数（桑塔纳/捷达类教练车） ================= */
  const CAR = {
    L: 4.6, W: 1.8, WB: 2.6, FO: 0.95, RO: 1.05, TR: 1.52, MAXD: 35 * D2R, SWMAX: 540, // 方向盘中位到打死 540°（一圈半）
    M: 1250, RW: 0.3, TW: 0.2, TL: 0.62
  };
  const KMAX = Math.tan(CAR.MAXD) / CAR.WB;       // 最大曲率（后轴中心）
  const RMIN = 1 / KMAX;                           // ≈3.71m
  const GEARS_M = { R: -3.6, N: 0, 1: 3.45, 2: 1.94, 3: 1.29 };
  const FD = 4.1, JE = 0.22, CMAX = 260, IDLE_W = 900 * RPM2W, STALL_W = 380 * RPM2W, G = 9.81;

  /* ================= 几何工具 ================= */
  function segPtD2(px, py, ax, ay, bx, by) {
    const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy;
    let t = l2 ? ((px - ax) * dx + (py - ay) * dy) / l2 : 0; t = clamp(t, 0, 1);
    const qx = ax + t * dx - px, qy = ay + t * dy - py; return qx * qx + qy * qy;
  }
  function segX(ax, ay, bx, by, cx, cy, dx, dy) {
    const d1 = (bx - ax) * (cy - ay) - (by - ay) * (cx - ax), d2 = (bx - ax) * (dy - ay) - (by - ay) * (dx - ax);
    const d3 = (dx - cx) * (ay - cy) - (dy - cy) * (ax - cx), d4 = (dx - cx) * (by - cy) - (dy - cy) * (bx - cx);
    return ((d1 > 0) !== (d2 > 0)) && ((d3 > 0) !== (d4 > 0));
  }
  function segSegD(a, b, c, d) {
    if (segX(a[0], a[1], b[0], b[1], c[0], c[1], d[0], d[1])) return 0;
    return Math.sqrt(Math.min(segPtD2(a[0], a[1], c[0], c[1], d[0], d[1]), segPtD2(b[0], b[1], c[0], c[1], d[0], d[1]),
      segPtD2(c[0], c[1], a[0], a[1], b[0], b[1]), segPtD2(d[0], d[1], a[0], a[1], b[0], b[1])));
  }
  function inPoly(x, y, poly) {
    let ins = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const xi = poly[i][0], yi = poly[i][1], xj = poly[j][0], yj = poly[j][1];
      if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) ins = !ins;
    }
    return ins;
  }
  function arcPts(cx, cy, r, a0, a1, step = 0.25) {
    const n = Math.max(2, Math.ceil(Math.abs(a1 - a0) * r / step)), o = [];
    for (let i = 0; i <= n; i++) { const a = a0 + (a1 - a0) * i / n; o.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]); }
    return o;
  }
  // 车辆局部坐标（lx 向前，ly 向右，原点后轴中心）→ 世界
  function toW(c, lx, ly) { const co = Math.cos(c.th), si = Math.sin(c.th); return [c.x + lx * co - ly * si, c.y + lx * si + ly * co]; }
  function toL(c, X, Y) { const co = Math.cos(c.th), si = Math.sin(c.th), dx = X - c.x, dy = Y - c.y; return [dx * co + dy * si, -dx * si + dy * co]; }
  function bodyPoly(c, m = 0) {
    const f = CAR.WB + CAR.FO + m, r = -CAR.RO - m, w = CAR.W / 2 + m;
    return [toW(c, f, -w), toW(c, f, w), toW(c, r, w), toW(c, r, -w)];
  }
  // 轮胎：返回 [中心, 方向端点a, b]（接地印迹按 0.24m 长胶囊）
  function wheels(c) {
    const t = CAR.TR / 2, o = [];
    const dl = Math.atan(CAR.WB / (CAR.WB / Math.tan(c.delta || 1e-9) + t)), dr = Math.atan(CAR.WB / (CAR.WB / Math.tan(c.delta || 1e-9) - t));
    const spec = [[CAR.WB, -t, Math.abs(c.delta) < 1e-6 ? 0 : dl, 'FL'], [CAR.WB, t, Math.abs(c.delta) < 1e-6 ? 0 : dr, 'FR'], [0, -t, 0, 'RL'], [0, t, 0, 'RR']];
    for (const [lx, ly, a, id] of spec) {
      const p = toW(c, lx, ly), h = c.th + a, hl = 0.08;
      o.push({ id, p, a: h, s: [p[0] - Math.cos(h) * hl, p[1] - Math.sin(h) * hl], e: [p[0] + Math.cos(h) * hl, p[1] + Math.sin(h) * hl] });
    }
    return o;
  }

  /* ================= 场地（统一考场：五项 + 连接道路） ================= */
  const WHITE = '#f3f3ee', YEL = '#f5c518';
  function Ln(pts, o) {
    const l = Object.assign({ pts, w: 0.15, col: WHITE, judge: null, name: '', dash: null }, o);
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    pts.forEach(p => { x0 = Math.min(x0, p[0]); y0 = Math.min(y0, p[1]); x1 = Math.max(x1, p[0]); y1 = Math.max(y1, p[1]); });
    l.bb = [x0 - 0.3, y0 - 0.3, x1 + 0.3, y1 + 0.3]; return l;
  }
  const DK = { gx0: -1.2, gx1: 1.2, gy0: 6.9, gy1: 12.2, rx0: -16, rx1: 16, cl: -8.1, cr: 8.1 };   // 倒库：库宽2.4=车宽+0.6，库长5.3=车长+0.7，车道宽6.9=1.5×车长，库至控制线6.9=1.5×车长
  const PD = { x0: 40, x1: 88, y0: 1.5, y1: 5.5, r0: 46, r1: 64, t1: 68, d1: 78, stop: 57, gu: 0.10, gd: 0.18 }; // 坡道：坡度10%，路宽4m
  PD.h = (PD.r1 - PD.r0) * PD.gu;
  const CF = { x0: 95, x1: 135, y0: 1.55, y1: 5.05, gx0: 110, gx1: 117.9, gy1: 7.65, start: 100, end: 130 };      // 侧方：库长7.9=1.5×车长+1，库宽2.6=车宽+0.8，车道宽3.5
  const QX = { x: 150, y: -15, R: 5.75, hw: 1.75 };                                                                 // 曲线：外圆半径7.5、内圆半径4.0，路宽3.5
  const ZJ = { xc: 127, x0: 125.2, x1: 128.8, yo: -41.8, yi: -38.2, xEnd: 111 };                                    // 直角：路宽3.6=轴距+1m

  function buildCourse() {
    const lines = [], roads = [], labels = [], poles = [];
    const add = (fx, l) => { l.fx = fx; lines.push(l); return l; };
    /* 倒车入库 */
    roads.push({ type: 'rect', r: [DK.rx0, 0, DK.rx1, DK.gy0] }, { type: 'rect', r: [DK.gx0, DK.gy0, DK.gx1, DK.gy1] });
    add('daoku', Ln([[DK.rx0, 0], [DK.rx1, 0]], { judge: 'body', name: '车道边线' }));
    add('daoku', Ln([[DK.rx0, DK.gy0], [DK.gx0, DK.gy0]], { judge: 'body', name: '车道边线' }));
    add('daoku', Ln([[DK.gx1, DK.gy0], [DK.rx1, DK.gy0]], { judge: 'body', name: '车道边线' }));
    add('daoku', Ln([[DK.gx0, DK.gy0], [DK.gx0, DK.gy1], [DK.gx1, DK.gy1], [DK.gx1, DK.gy0]], { judge: 'body', name: '库位边线' }));
    add('daoku', Ln([[DK.cl, 0], [DK.cl, DK.gy0]], { col: YEL, name: '控制线' }));
    add('daoku', Ln([[DK.cr, 0], [DK.cr, DK.gy0]], { col: YEL, name: '控制线' }));
    poles.push([DK.gx0 - 0.35, DK.gy1 + 0.35], [DK.gx1 + 0.35, DK.gy1 + 0.35], [DK.cl, -0.45], [DK.cr, -0.45]);
    labels.push({ t: '倒车入库', x: 0, y: 14.2, s: 1.3 }, { t: '控制线', x: DK.cl, y: -1.1, s: 0.55 }, { t: '控制线', x: DK.cr, y: -1.1, s: 0.55 });
    /* 坡道定点停车和起步 */
    roads.push({ type: 'rect', r: [PD.x0, PD.y0, PD.x1, PD.y1], slope: true });
    add('podao', Ln([[PD.x0, PD.y0], [PD.x1, PD.y0]], { judge: 'wheel', name: '道路边缘线' }));
    add('podao', Ln([[PD.x0, PD.y1], [PD.x1, PD.y1]], { judge: 'wheel', name: '道路边缘线' }));
    add('podao', Ln([[PD.stop, PD.y0 + 0.1], [PD.stop, PD.y1 - 0.1]], { col: YEL, w: 0.2, name: '桩杆线', dash: [0.5, 0.3] }));
    poles.push([PD.stop, PD.y1 + 0.45], [PD.stop, PD.y0 - 0.45]);
    labels.push({ t: '坡道定点停车和起步', x: 62, y: 8.6, s: 1.1 });
    /* 侧方停车 */
    roads.push({ type: 'rect', r: [CF.x0, CF.y0, CF.x1, CF.y1] }, { type: 'rect', r: [CF.gx0, CF.y1, CF.gx1, CF.gy1] });
    add('cefang', Ln([[CF.x0, CF.y0], [CF.x1, CF.y0]], { judge: 'wheel', name: '车道边线' }));
    add('cefang', Ln([[CF.x0, CF.y1], [CF.gx0, CF.y1]], { judge: 'wheel', name: '车道边线' }));
    add('cefang', Ln([[CF.gx1, CF.y1], [CF.x1, CF.y1]], { judge: 'wheel', name: '车道边线' }));
    add('cefang', Ln([[CF.gx0, CF.y1], [CF.gx0, CF.gy1], [CF.gx1, CF.gy1], [CF.gx1, CF.y1]], { judge: 'body', name: '库位边线' }));
    add('cefang', Ln([[CF.start, CF.y0], [CF.start, CF.y1]], { col: YEL, name: '起点线', dash: [0.6, 0.4] }));
    add('cefang', Ln([[CF.end, CF.y0], [CF.end, CF.y1]], { col: YEL, name: '终点线', dash: [0.6, 0.4] }));
    labels.push({ t: '侧方停车', x: 114, y: 10.2, s: 1.2 });
    /* 曲线行驶（S 弯） */
    const c1 = [QX.x - QX.R, QX.y], c2 = [QX.x - 3 * QX.R, QX.y], ro = QX.R + QX.hw, ri = QX.R - QX.hw;
    const qc = [[QX.x, -6]].concat(arcPts(c1[0], c1[1], QX.R, 0, -PI), arcPts(c2[0], c2[1], QX.R, 0, PI).slice(1), [[QX.x - 4 * QX.R, -21]]);
    roads.push({ type: 'band', pts: qc, w: 2 * QX.hw });
    const qA = [[QX.x + QX.hw, -6]].concat(arcPts(c1[0], c1[1], ro, 0, -PI), arcPts(c2[0], c2[1], ri, 0, PI).slice(1), [[QX.x - 4 * QX.R + QX.hw, -21]]);
    const qB = [[QX.x - QX.hw, -6]].concat(arcPts(c1[0], c1[1], ri, 0, -PI), arcPts(c2[0], c2[1], ro, 0, PI).slice(1), [[QX.x - 4 * QX.R - QX.hw, -21]]);
    add('quxian', Ln(qA, { judge: 'wheel', name: '道路边缘线' }));
    add('quxian', Ln(qB, { judge: 'wheel', name: '道路边缘线' }));
    add('quxian', Ln([[QX.x - QX.hw, -10], [QX.x + QX.hw, -10]], { col: YEL, name: '入口', dash: [0.5, 0.3] }));
    add('quxian', Ln([[QX.x - 4 * QX.R - QX.hw, -19.5], [QX.x - 4 * QX.R + QX.hw, -19.5]], { col: YEL, name: '出口', dash: [0.5, 0.3] }));
    labels.push({ t: '曲线行驶', x: 145, y: -25.5, s: 1.2 });
    /* 直角转弯（左转） */
    roads.push({ type: 'band', pts: [[ZJ.xc, -24.5], [ZJ.xc, -40], [ZJ.xEnd - 2, -40]], w: 3.6, join: 'miter' });
    add('zhijiao', Ln([[ZJ.x1, -24.5], [ZJ.x1, ZJ.yo], [ZJ.xEnd - 2, ZJ.yo]], { judge: 'wheel', name: '道路边缘线' }));
    add('zhijiao', Ln([[ZJ.x0, -24.5], [ZJ.x0, ZJ.yi], [ZJ.xEnd - 2, ZJ.yi]], { judge: 'wheel', name: '道路边缘线' }));
    add('zhijiao', Ln([[ZJ.x0, -26.5], [ZJ.x1, -26.5]], { col: YEL, name: '入口', dash: [0.5, 0.3] }));
    add('zhijiao', Ln([[ZJ.xEnd + 2, ZJ.yo], [ZJ.xEnd + 2, ZJ.yi]], { col: YEL, name: '出口', dash: [0.5, 0.3] }));
    labels.push({ t: '直角转弯', x: 119, y: -45, s: 1.2 });
    /* 连接道路（考试路线） */
    const conn = [
      [[-34, 3.45], [DK.rx0, 3.45]], [[DK.rx1, 3.45], [PD.x0, 3.5]], [[PD.x1, 3.5], [CF.x0, 3.3]],
      [[CF.x1, 3.3], [141, 3.3], [146, 1.8], [149.2, -1.5], [150, -6]], [[QX.x - 4 * QX.R, -21], [ZJ.xc, -24.5]],
      [[ZJ.xEnd - 2, -40], [92, -40], [86, -36], [84, -28], [84, -20]]
    ];
    conn.forEach(p => roads.unshift({ type: 'band', pts: p, w: 6.6, conn: true }));
    labels.push({ t: '起点', x: -27, y: -1.2, s: 0.9 }, { t: '终点', x: 84, y: -16, s: 0.9 });
    return { lines, roads, labels, poles, bounds: [-40, -60, 172, 26] };
  }
  const COURSE = buildCourse();

  // 坡道高程（m）
  function heightAt(x, y) {
    if (y < PD.y0 - 2.2 || y > PD.y1 + 2.2 || x < PD.r0 || x > PD.d1) return 0;
    if (x < PD.r1) return (x - PD.r0) * PD.gu;
    if (x < PD.t1) return PD.h;
    return Math.max(0, PD.h - (x - PD.t1) * PD.gd);
  }
  function slopeOf(c) { // 沿车头方向的坡度正弦（上坡为正）
    const f = toW(c, CAR.WB, 0); return clamp((heightAt(f[0], f[1]) - heightAt(c.x, c.y)) / CAR.WB, -0.3, 0.3);
  }

  /* ================= 物理：运动学单车模型 + 发动机/离合/变速器 ================= */
  function newCar(trans, pose) {
    return {
      trans, x: pose.x, y: pose.y, th: pose.th, v: 0, sw: 0, delta: 0, thr: 0, brk: 0, clu: 0, hb: true,
      gear: trans === 'auto' ? 'P' : 'N', on: false, we: 0, odo: 0, stallT: 0, sig: 0, sigArm: 0, belt: false, horn: false,
      slope: 0, h: 0, events: []
    };
  }
  function engage(p) { if (p >= 0.8) return 0; if (p <= 0.4) return 1; const s = (0.8 - p) / 0.4; return s * s; }
  function engTq(c, w, thr) {
    const fric = w > 0.3 ? 5 + 0.03 * w + 0.00006 * w * w : 0;
    if (!c.on) return -fric * 1.6;
    const rpm = w * W2RPM;
    const tmax = rpm < 1000 ? 70 + rpm * 0.04 : rpm < 3800 ? 110 + (rpm - 1000) * 0.016 : Math.max(0, 155 - (rpm - 3800) * 0.025);
    if (rpm > 6300) thr = 0;
    const gov = clamp((IDLE_W - w) * 2.5, 0, 46) * (1 - thr * 0.7);
    return thr * tmax + gov - fric;
  }
  function stepCar(c, dt) {
    c.delta = clamp(c.sw, -CAR.SWMAX, CAR.SWMAX) / CAR.SWMAX * CAR.MAXD;
    c.slope = slopeOf(c);
    const M = CAR.M, Fg = -M * G * c.slope;
    let Ffr = 0.015 * M * G + c.brk * 9500 + (c.hb ? 7500 : 0);
    let v = c.v;
    if (c.trans === 'manual') {
      const a = GEARS_M[c.gear] * FD / CAR.RW, e = c.gear === 'N' ? 0 : engage(c.clu);
      const Te = engTq(c, c.we, c.thr);
      let Tc = 0;
      if (e > 0) {
        const C = e * CMAX, k = 4000, dw = c.we - a * v;
        Tc = k * (dw + dt * (Te / JE - a * Fg / M)) / (1 + k * dt * (1 / JE + a * a / M));
        Tc = clamp(Tc, -C, C);
      }
      c.we += dt / JE * (Te - Tc);
      v += dt / M * (Tc * a + Fg);
      if (c.we < 0) c.we = 0;
      if (c.on && c.we < STALL_W) { c.stallT += dt; if (c.stallT > 0.12) { c.on = false; c.events.push('stall'); } } else c.stallT = 0;
    } else {
      const dir = c.gear === 'D' ? 1 : c.gear === 'R' ? -1 : 0;
      let F = 0;
      if (c.on && dir) {
        const vd = v * dir;
        F = dir * (1250 * clamp(1 - vd / 1.7, 0, 1.3) + c.thr * 4200 * clamp(1 - Math.abs(v) / 16, 0, 1));
      }
      if (c.gear === 'P') Ffr += 30000;
      v += dt / M * (F + Fg);
      const tw = c.on ? IDLE_W * (1 + c.thr * (dir ? 2.6 : 4.5)) + Math.abs(v) * 25 * (dir ? 1 : 0) : 0;
      c.we += (tw - c.we) * Math.min(1, dt * (c.on ? 5 : 3));
    }
    const dv = Ffr * dt / M;
    if (Math.abs(v) <= dv) v = 0; else v -= Math.sign(v) * dv;
    c.v = v;
    const ds = v * dt;
    c.x += ds * Math.cos(c.th); c.y += ds * Math.sin(c.th);
    c.th = wrap(c.th + ds * Math.tan(c.delta) / CAR.WB);
    c.odo += ds;
    c.h = heightAt(c.x + Math.cos(c.th) * 1.3, c.y + Math.sin(c.th) * 1.3);
    // 转向灯随方向盘回正自动跳回
    if (c.sig) {
      if (c.sw * c.sig > 270) c.sigArm = 1;
      else if (c.sigArm && c.sw * c.sig < 60) { c.sig = 0; c.sigArm = 0; c.events.push('sigoff'); }
    }
    const B = COURSE.bounds; // 场地围栏
    if (c.x < B[0] + 3 || c.x > B[2] - 3 || c.y < B[1] + 3 || c.y > B[3] - 3) {
      c.x = clamp(c.x, B[0] + 3, B[2] - 3); c.y = clamp(c.y, B[1] + 3, B[3] - 3); c.v = 0; c.events.push('wall');
    }
  }
  function ignite(c) {
    if (c.on) return 'on';
    if (c.trans === 'auto' && c.gear !== 'P' && c.gear !== 'N') return 'gear';
    c.on = true; c.we = Math.max(c.we, IDLE_W * 1.1); c.stallT = 0; return 'ok';
  }
  // 换挡（手动挡需踩离合）
  function shift(c, g) {
    if (c.gear === g) return 'same';
    if (c.trans === 'manual') {
      if (!(g in GEARS_M)) return 'bad';
      if (g !== 'N' && c.clu < 0.75) return 'clutch';
      if (g === 'R' && c.v > 0.3) return 'grind';
      if (g !== 'R' && g !== 'N' && c.v < -0.3) return 'grind';
    } else {
      if (!/^[PRND]$/.test(g)) return 'bad';
      if ((g === 'P' || g === 'R' || g === 'D') && Math.abs(c.v) > 0.6 && g !== 'D' && c.gear !== 'N') return 'moving';
      if ((g === 'R' && c.v > 0.4) || (g === 'D' && c.v < -0.4) || (g === 'P' && Math.abs(c.v) > 0.2)) return 'moving';
      if (c.brk < 0.2 && (c.gear === 'P' || g === 'P') && c.on) return 'brake';
    }
    c.gear = g; return 'ok';
  }

  /* ================= 教学演示（路径 + 跟踪控制） ================= */
  const DS = 0.05;
  // ops: [d(带符号距离), k(转向曲率 tanδ/L，右打为正)]
  function pathFrom(pose, ops) {
    let { x, y, th } = pose; const pts = [{ x, y, th, k: ops[0][1] }];
    for (let [d, k] of ops) {
      if (typeof d === 'function') d = d({ x, y, th });
      const n = Math.max(1, Math.round(Math.abs(d) / DS)), s = d / n;
      for (let i = 0; i < n; i++) {
        const thm = th + s * k / 2; x += s * Math.cos(thm); y += s * Math.sin(thm); th += s * k; pts.push({ x, y, th, k });
      }
    }
    return pts;
  }
  function arcLen(R, deg) { return R * deg * D2R; }
  function legsFor(item) {
    const L = [], k = 1 / 4.0, R = 4.0;
    let pose;
    const leg = (dir, ops, o) => { const pts = pathFrom(pose, ops); const e = pts[pts.length - 1]; pose = { x: e.x, y: e.y, th: e.th }; L.push(Object.assign({ dir, pts, vmax: dir > 0 ? 1.0 : 0.7 }, o)); };
    if (item === 'daoku') {
      const yl = DK.gy0 - R - 0.08, fx = 0, ystop = DK.gy1 - 0.35 - CAR.RO, Rx = 4.5, kx = 1 / Rx, yr = yl + Rx, xs = 6.2;
      pose = { x: -14, y: yl, th: 0 };
      leg(1, [[xs + 14, 0]], { tip: '起步直线前进，车身与库前线保持约1.5–2米；右后视镜看到控制线后继续前进，两前轮越过右侧控制线后停车', vmax: 1.5 });
      leg(-1, [[-(xs - (fx + R)), 0], [-arcLen(R, 90), k], [q => -(ystop - q.y), 0]], { tip: '挂倒挡缓慢倒车，右后视镜下沿看到库角时向右打满（约一圈半）；车身将正时观察两侧后视镜，车身与库边线平行即回正；左后视镜下沿与库前线重合时停车', wait: 0.6 });
      leg(1, [[ystop - yr, 0], [arcLen(Rx, 90), -kx], [q => q.x + xs, 0]], { tip: '挂一挡前进出库，车头盖住对面车道边线约1/3时（或前轮越过库口线）向左打满；车身摆正后回正方向，两前轮越过左侧控制线后停车', wait: 0.6 });
      leg(-1, [[q => -(-(fx) - R - q.x), 0], [-arcLen(R, 90), -k], [q => -(ystop - q.y), 0]], { tip: '挂倒挡，左后视镜下沿看到库角时向左打满；观察两侧距离，车身摆正后回正，停车点同上', wait: 0.6 });
      leg(1, [[ystop - yr, 0], [arcLen(Rx, 90), kx], [q => 10 - q.x, 0]], { tip: '前进出库，适时向右打满，车身摆正后回正，驶过右侧控制线完成项目', wait: 0.6 });
    } else if (item === 'cefang') {
      const P = CF_PLAN;
      pose = { x: CF.x0 + 1, y: P.y, th: 0 };
      leg(1, [[P.x - pose.x, 0]], { tip: '沿车道直线行驶，右侧车身距车道边线约30–50cm；右后视镜中库前角移到车身后部（车尾在库前线内约1米）时停车', vmax: 1.5 });
      leg(-1, [[-arcLen(R, P.a1), k], [-P.s, 0], [-arcLen(R, P.a1), -k]], { tip: '挂倒挡，右后视镜看到库前角（或库前角到车门把手）时向右打满；左后视镜看到库后角（车身约30–45°）回正；右前轮过库口线（右后视镜车身与库边线距离约30cm）时向左打满，车身摆正后停车回正', wait: 0.6 });
      leg(1, [[arcLen(P.rx, P.b1), -1 / P.rx], [P.s2, 0], [arcLen(P.rx, P.b1), 1 / P.rx], [q => CF.end + 3 - q.x, 0]], { tip: '停车后开启左转向灯（3秒以上），挂一挡前进，向左打方向驶出库位；左前轮接近车道边线前向右回正，驶离库位', wait: 3.2, sig: -1 });
    } else if (item === 'podao') {
      const yy = PD.y1 - 0.075 - 0.2 - CAR.W / 2;
      pose = { x: 41, y: yy, th: 0 };
      leg(1, [[PD.stop - 0.08 - (CAR.WB + CAR.FO) - 41, 0]], { tip: '右侧车身距边缘线30cm内（引擎盖右1/3对准右边线）直线上坡，桩杆与车门把手/右后视镜对齐时踩离合踩刹车停车，拉手刹', vmax: 1.2 });
      leg(1, [[PD.x1 - 4 - pose.x, 0]], { tip: '踩离合挂一挡，右脚轻踩油门（约1500转），缓抬离合至半联动，车身抖动、发动机声音变沉时松手刹，稳住离合起步', wait: 2.5, hill: true, vmax: 1.6 });
    } else if (item === 'quxian') {
      const r = QX.R - 0.1;
      pose = { x: QX.x - 0.1, y: -5, th: -PI / 2 };
      leg(1, [[q => q.y - QX.y, 0], [arcLen(r, 180), -1 / r], [arcLen(r, 180), 1 / r], [q => q.y + 22, 0]], { tip: '一挡低速入弯，左转弯时车头左角（雨刮器左端）沿右边线行驶；转换右转弯时车头右角沿左边线行驶，眼睛看远、少量连续修正', vmax: 1.0 });
    } else if (item === 'zhijiao') {
      const R2 = RMIN + 0.03, ro = Math.hypot(R2 + CAR.TR / 2 + 0.09, CAR.WB + 0.08), cx = ZJ.x1 - 0.075 - ro - 0.08, cy = ZJ.yo + 0.075 + ro + 0.08;
      pose = { x: cx + R2, y: -23, th: -PI / 2 };
      leg(1, [[-(cy - (-23)), 0], [arcLen(R2, 90), -1 / R2], [(cx - (ZJ.xEnd - 1)), 0]], { tip: '进入前开左转向灯，车身靠右（距右边线约30cm）；左后视镜（或车门把手）与内直角点对齐时向左打满，车身摆正后回正、关闭转向灯', vmax: 0.8, sig: -1, wait: 0.5 });
    }
    return L;
  }
  // 侧方路径参数（离线搜索得到并已验证无压线）
  const CF_PLAN = { y: 3.65, x: 117.93, a1: 32, s: 2.707, b1: 34, rx: 5, s2: 1.5 };
  function swFromK(k) { return clamp(Math.atan(CAR.WB * k) / CAR.MAXD * CAR.SWMAX, -CAR.SWMAX, CAR.SWMAX); }
  function createAuto(item, car) {
    const legs = legsFor(item);
    const A = { legs, li: 0, idx: 0, phase: 'wait', t: 0, I: 0, done: !legs.length, tip: legs[0] ? legs[0].tip : '', hillHold: false, kh: 1.9, ke: 0.65 };
    legs.forEach(L => { const i = L.pts.findIndex(p => Math.abs(p.k) > 1e-6); L.sigUntil = i < 0 ? 0 : i + 10; });
    A.step = function (dt) {
      const c = car; if (A.done) { c.thr = 0; c.brk = 1; if (c.trans === 'manual') c.clu = 1; return; }
      const leg = legs[A.li], man = c.trans === 'manual';
      A.tip = leg.tip; A.t += dt;
      const steerTo = (tgt, rate = 420) => { c.sw += clamp(tgt - c.sw, -rate * dt, rate * dt); };
      if (!c.belt) c.belt = true;
      if (!c.on) { if (man) c.clu = 1; c.brk = 1; ignite(c); return; }
      if (A.phase === 'wait') {
        c.thr = 0; c.brk = 1; if (man) c.clu = 1;
        if (leg.sig != null && c.sig !== leg.sig) { c.sig = leg.sig; c.sigArm = 0; }
        if (Math.abs(c.v) < 0.01) {
          if (leg.hill) c.hb = true;
          const g = man ? (leg.dir > 0 ? '1' : 'R') : (leg.dir > 0 ? 'D' : 'R');
          if (c.gear !== g) shift(c, g);
          steerTo(swFromK(leg.pts[Math.min(leg.pts.length - 1, 6)].k));
          if (A.t > (leg.wait || 0.4) && Math.abs(c.sw - swFromK(leg.pts[Math.min(leg.pts.length - 1, 6)].k)) < 15) {
            A.phase = 'go'; A.idx = 0; A.I = 0; A.t = 0; A.hillHold = !!leg.hill;
            if (!leg.hill) c.hb = false;
          }
        }
        return;
      }
      // 跟踪
      const P = leg.pts; let bi = A.idx, bd = 1e9;
      for (let i = A.idx; i < Math.min(P.length, A.idx + 60); i++) { const d = (P[i].x - c.x) ** 2 + (P[i].y - c.y) ** 2; if (d < bd) { bd = d; bi = i; } }
      A.idx = bi; const p = P[bi], rem = (P.length - 1 - bi) * DS;
      const pre = Math.min(P.length - 1, bi + Math.round((0.25 + Math.abs(c.v) * 0.55) / DS));
      const dir = leg.dir, phiP = p.th + (dir < 0 ? PI : 0), phiC = c.th + (dir < 0 ? PI : 0);
      const el = (c.x - p.x) * -Math.sin(phiP) + (c.y - p.y) * Math.cos(phiP);
      const kt = A.kh * wrap(phiP - phiC) - A.ke * el;
      if (leg.sig != null && bi < leg.sigUntil && c.sig !== leg.sig) { c.sig = leg.sig; c.sigArm = 0; }
      steerTo(swFromK(P[pre].k + dir * kt));
      const sp = Math.abs(c.v);
      let vt = Math.min(leg.vmax, 0.12 + 0.85 * Math.sqrt(Math.max(0, rem - 0.04)));
      if (c.slope * dir > 0.05) vt = Math.min(vt, 0.9);
      if (rem < 0.06 || (dir > 0 ? c.v < -0.4 : false)) {
        if (rem < 0.06) {
          c.thr = 0; c.brk = 1; if (man) c.clu = 1;
          if (sp < 0.01) { A.li++; A.phase = 'wait'; A.t = 0; if (A.li >= legs.length) { A.done = true; } else if (legs[A.li].hill) c.hb = true; }
          return;
        }
      }
      const err = vt - sp, up = c.slope * dir;
      A.I = clamp(A.I + err * dt, -1, 1.2);
      if (man) {
        let ct = 0.66 - 0.16 * err - 0.12 * A.I;
        c.thr = up > 0.03 ? 0.22 + clamp(err, 0, 0.5) * 0.3 : clamp(err - 0.3, 0, 0.15);
        const rpm = c.we * W2RPM;
        if (rpm < 800) c.thr = Math.max(c.thr, 0.18);
        ct = Math.max(ct, 0.8 - 0.4 * Math.sqrt(clamp((rpm - 620) / 600, 0.03, 1)));
        c.clu += clamp(clamp(ct, 0.36, 0.85) - c.clu, -0.6 * dt, 2.5 * dt);
        c.brk = sp > vt + 0.2 ? clamp((sp - vt) * 1.2, 0, 0.6) : 0;
        if (A.hillHold && engage(c.clu) > 0.12 && c.we < 1500 * RPM2W) { c.hb = false; A.hillHold = false; }
        else if (A.hillHold && engage(c.clu) > 0.25) { c.hb = false; A.hillHold = false; }
      } else {
        c.thr = up > 0.03 ? clamp(0.12 + err * 0.5 + A.I * 0.3, 0, 0.5) : 0;
        c.brk = clamp((sp - vt) * 1.6 + (up > 0.03 ? 0 : 0.18) - A.I * 0.3, 0, 1);
        if (A.hillHold) { c.thr = Math.max(c.thr, 0.2); if (A.t > 0.4) { c.hb = false; A.hillHold = false; } }
      }
    };
    return A;
  }

  /* ================= 评判引擎 ================= */
  const ITEMS = {
    daoku: { name: '倒车入库', short: '倒库', limit: 210, stopPts: 5, voice: '请开始倒车入库', start: { x: -14, y: 2.82, th: 0 } },
    podao: { name: '坡道定点停车和起步', short: '坡道', limit: 0, stopPts: 0, voice: '请开始坡道定点停车和起步', start: { x: 36, y: 4.3, th: 0 } },
    cefang: { name: '侧方停车', short: '侧方', limit: 90, stopPts: 5, voice: '请开始侧方停车', start: { x: 92, y: 3.65, th: 0 } },
    quxian: { name: '曲线行驶', short: '曲线', limit: 0, stopPts: 10, voice: '请开始曲线行驶', start: { x: 150, y: 1, th: -PI / 2 } },
    zhijiao: { name: '直角转弯', short: '直角', limit: 0, stopPts: 10, voice: '请开始直角转弯', start: { x: 127.1, y: -21, th: -PI / 2 } }
  };
  const EXAM_ORDER = ['daoku', 'podao', 'cefang', 'quxian', 'zhijiao'];
  const EXAM_START = { x: -26, y: 2.82, th: 0 };

  function insideRect(poly, x0, y0, x1, y1) { return poly.every(p => p[0] > x0 && p[0] < x1 && p[1] > y0 && p[1] < y1); }
  function bodyHits(c, lines) {
    const poly = bodyPoly(c), out = [];
    let bx0 = 1e9, by0 = 1e9, bx1 = -1e9, by1 = -1e9; poly.forEach(p => { bx0 = Math.min(bx0, p[0]); by0 = Math.min(by0, p[1]); bx1 = Math.max(bx1, p[0]); by1 = Math.max(by1, p[1]); });
    for (const l of lines) {
      if (l.bb[0] > bx1 || l.bb[2] < bx0 || l.bb[1] > by1 || l.bb[3] < by0) continue;
      let hit = false;
      for (let i = 0; i < l.pts.length - 1 && !hit; i++) {
        const a = l.pts[i], b = l.pts[i + 1];
        for (let j = 0; j < 4 && !hit; j++) { const p = poly[j], q = poly[(j + 1) % 4]; if (segX(a[0], a[1], b[0], b[1], p[0], p[1], q[0], q[1])) hit = true; }
        if (!hit && inPoly(a[0], a[1], poly)) hit = true;
      }
      if (hit) out.push(l);
    }
    return out;
  }
  function wheelHits(c, lines) {
    const ws = wheels(c), out = [];
    for (const l of lines) {
      const lim = l.w / 2 + 0.09;
      for (const w of ws) {
        if (w.p[0] < l.bb[0] || w.p[0] > l.bb[2] || w.p[1] < l.bb[1] || w.p[1] > l.bb[3]) continue;
        let hit = false;
        for (let i = 0; i < l.pts.length - 1; i++) if (segSegD(w.s, w.e, l.pts[i], l.pts[i + 1]) < lim) { hit = true; break; }
        if (hit) { out.push({ l, w: w.id }); break; }
      }
    }
    return out;
  }
  const fxLines = id => COURSE.lines.filter(l => l.fx === id);

  function createSession(o) {
    const S = {
      mode: o.mode || 'practice', item: o.item || 'daoku', trans: o.trans || 'manual', t: 0, score: 100, log: [], failed: false,
      over: false, events: [], cur: null, curIdx: -1, order: [], measure: null, auto: null, started: false
    };
    S.exam = S.item === 'exam';
    S.free = S.item === 'free';
    S.order = S.exam ? EXAM_ORDER.filter(id => !(S.trans === 'auto' && id === 'podao')) : S.free ? [] : [S.item];
    const sp = S.exam ? EXAM_START : S.free ? EXAM_START : ITEMS[S.item].start;
    S.car = newCar(S.trans, sp);
    if (S.mode !== 'exam' || S.free) { S.car.on = true; S.car.we = IDLE_W; S.car.belt = true; S.car.hb = true; }
    const emit = (type, d) => S.events.push(Object.assign({ type }, d));
    S.emit = emit;
    S.ded = function (pts, msg, item) {
      if (S.over) return;
      const fail = pts >= 100;
      if (fail && S.failed) return;
      S.log.push({ t: S.t, pts, msg, item: item || (S.cur ? S.cur.id : ''), fail });
      if (fail) S.failed = true; else S.score -= pts;
      emit('ded', { pts, msg, fail, item });
      if (S.mode === 'exam' && !S.free && (S.failed || S.score < 80)) S.finish();
    };
    S.finish = function (ok) {
      if (S.over) return; S.over = true;
      const pass = !S.failed && S.score >= 80 && !!ok !== false;
      S.result = { score: S.failed ? 0 : Math.max(0, S.score), pass: !S.failed && S.score >= 80 && ok !== false, time: S.t, log: S.log.slice(), item: S.item, complete: !!ok };
      if (!ok && !S.failed && S.score >= 80) S.result.pass = false;
      emit('end', S.result); return pass;
    };
    // 通用运动跟踪
    const mt = { stopT: null, lastDir: 0, startDist: 0, hbWarn: false, beltWarn: false, prevOdo: 0 };
    function startProj(id) {
      const P = makeProj(S, id); S.cur = P; S.curIdx = S.order.indexOf(id); P.t0 = null; P.armed = S.exam;
      if (S.exam) { P.t0 = S.t; emit('speak', { text: ITEMS[id].voice }); }
      emit('proj', { id });
    }
    S.startProj = startProj;
    if (!S.free) { if (S.exam) S.waitIdx = 0; else startProj(S.item); }
    if (o.demo && !S.exam && !S.free) S.auto = createAuto(S.item, S.car);

    S.step = function (dt) {
      if (S.over && !S.free) { if (S.auto) S.auto.step(dt); stepCar(S.car, dt); S.t += dt; S.car.events.length = 0; return; }
      const c = S.car;
      if (S.auto) S.auto.step(dt);
      stepCar(c, dt);
      S.t += dt;
      for (const e of c.events) {
        if (e === 'stall') { emit('stall'); if (!S.free && S.started) S.ded(10, '因操作不当造成发动机熄火'); }
        if (e === 'wall') emit('wall');
        if (e === 'sigoff') emit('sigoff');
      }
      c.events.length = 0;
      if (S.free) return;
      const moving = Math.abs(c.v) > 0.03, dir = c.v > 0.03 ? 1 : c.v < -0.03 ? -1 : 0;
      const dOdo = Math.abs(c.odo - mt.prevOdo); mt.prevOdo = c.odo;
      if (moving && !S.started) { S.started = true; emit('started'); }
      // 通用：安全带、驻车制动
      if (moving) {
        mt.startDist += dOdo;
        if (!c.belt && mt.startDist > 0.5 && !mt.beltWarn) { mt.beltWarn = true; if (S.mode === 'exam') S.ded(100, '不按规定使用安全带'); else emit('warn', { text: '请先系好安全带！' }); }
        if (c.hb && mt.startDist > 1.2 && !mt.hbWarn) { mt.hbWarn = true; S.ded(10, '起步时未松驻车制动器（手刹）'); }
      } else if (Math.abs(c.v) < 0.005) { mt.startDist = 0; if (!c.hb) mt.hbWarn = false; }
      // 考试：项目衔接
      if (S.exam && !S.cur && S.waitIdx < S.order.length) {
        const id = S.order[S.waitIdx];
        if (TRIG[id](c, S)) startProj(id);
      }
      const P = S.cur; if (!P) return;
      if (P.t0 == null && moving) P.t0 = S.t;
      if (P.t0 == null) return;
      P.time = S.t - P.t0;
      // 中途停车（同方向继续行驶才计）
      if (dir) {
        if (mt.stopT != null && P.stopPts && P.allowStopCheck !== false) {
          const dur = S.t - mt.stopT;
          if (dur > 2 && dir === mt.lastDir && !P.done) S.ded(P.stopPts, `中途停车超过2秒（${dur.toFixed(1)}秒）`);
        }
        mt.stopT = null; mt.lastDir = dir;
      } else if (mt.stopT == null) mt.stopT = S.t;
      if (P.limit && P.time > P.limit && !P.timeout) { P.timeout = true; S.ded(100, `项目完成时间超过${P.limit}秒`); }
      P.tick(c, dt, dir);
      if (P.done && !P.reported) {
        P.reported = true; emit('projDone', { id: P.id, time: P.time });
        if (S.exam) {
          S.cur = null; S.waitIdx++; mt.stopT = null;
          if (S.waitIdx >= S.order.length) S.finish(true);
        } else S.finish(true);
      }
    };
    return S;
  }
  const TRIG = {
    daoku: () => true,
    podao: c => { const f = toW(c, CAR.WB, 0); return f[0] > PD.x0 + 3 && f[0] < PD.r0 && f[1] > 0 && f[1] < 7; },
    cefang: c => { const f = toW(c, CAR.WB, 0); return f[0] > CF.start && f[0] < CF.gx0 && f[1] > 0 && f[1] < 6; },
    quxian: c => { const f = toW(c, CAR.WB, 0); return f[1] < -10 && f[1] > -14 && f[0] > 144; },
    zhijiao: c => { const f = toW(c, CAR.WB, 0); return f[1] < -26.5 && f[0] > ZJ.xc - 6 && f[0] < ZJ.xc + 6 && f[1] > -36; }
  };

  function makeProj(S, id) {
    const it = ITEMS[id], P = { id, name: it.name, limit: it.limit, stopPts: it.stopPts, step: 0, tip: '', done: false, contact: {}, rev: 0, fwd: 0, time: 0 };
    const lines = fxLines(id), bodyL = lines.filter(l => l.judge === 'body'), wheelL = lines.filter(l => l.judge === 'wheel');
    P.tip = { daoku: '直线前进，两前轮越过右侧控制线后停车', cefang: '沿车道直线前进，车尾越过库前线后停车', podao: '直线上坡，右侧车身靠近边缘线（30cm内），前保险杠对准桩杆线停车', quxian: '一挡低速驶入曲线，车头左角沿右边线走', zhijiao: '开启左转向灯，车身靠右行驶；左后视镜与内直角点对齐时向左打满' }[id];
    const fail = msg => { if (!P.failedOnce) { P.failedOnce = true; S.ded(100, msg, id); } };
    const fw = c => [toW(c, CAR.WB, -CAR.TR / 2), toW(c, CAR.WB, CAR.TR / 2)];
    const track = (dir, dt, c) => { if (dir > 0) { P.fwd += c.v * dt; P.rev = 0; } else if (dir < 0) { P.rev -= c.v * dt; P.fwd = 0; } };
    const edge = (key, on, pts, msg) => { const was = P.contact[key]; P.contact[key] = on; if (on && !was) S.ded(pts, msg, id); };
    if (id === 'daoku') {
      const tips = ['直线前进，两前轮越过右侧控制线后停车', '挂倒挡倒车：右后视镜下沿看到库角时向右打满', '倒车入库中：观察左右后视镜，车身摆正回正，完全入库后停车',
        '入库成功！挂一挡前进出库，向左转弯', '前进出库：两前轮越过左侧控制线后停车', '挂倒挡倒车：左后视镜下沿看到库角时向左打满',
        '倒车入库中：车身摆正回正，完全入库后停车', '入库成功！挂一挡前进出库，向右转弯', '前进出库：驶过右侧控制线完成项目'];
      P.tick = (c, dt, dir) => {
        track(dir, dt, c);
        if (bodyHits(c, bodyL).length) fail('车身出线');
        const f = fw(c), ins = insideRect(bodyPoly(c), DK.gx0 + 0.07, DK.gy0, DK.gx1 - 0.07, DK.gy1 - 0.07);
        P.inside = ins;
        switch (P.step) {
          case 0: if (f[0][0] > DK.cr && f[1][0] > DK.cr) P.step = 1; else if (P.rev > 0.3) fail('倒车前，未将两个前轮触地点均驶过控制线'); break;
          case 1: case 5: if (P.rev > 0.3) P.step++; break;
          case 2: case 6:
            if (ins && dir === 0) { P.inT = (P.inT || 0) + dt; if (P.inT > 0.3) { P.step++; P.inT = 0; S.emit('beep', { name: 'ding' }); S.emit('info', { text: P.step === 3 ? '右倒库入库成功' : '左倒库入库成功' }); } }
            else P.inT = 0;
            if (P.fwd > 0.3 && P.step % 4 === 2) { fail('倒库不入'); P.step++; }
            break;
          case 3: case 7: if (P.fwd > 0.3) P.step++; break;
          case 4: if (f[0][0] < DK.cl && f[1][0] < DK.cl) P.step = 5; else if (P.rev > 0.3) fail('倒车前，未将两个前轮触地点均驶过控制线'); break;
          case 8: if (f[0][0] > DK.cr && f[1][0] > DK.cr) P.done = true; else if (P.rev > 0.3) fail('不按规定路线、顺序行驶'); break;
        }
        P.tip = tips[Math.min(P.step, 8)];
      };
    } else if (id === 'cefang') {
      P.tick = (c, dt, dir) => {
        track(dir, dt, c);
        const wh = wheelHits(c, wheelL);
        edge('w', wh.length > 0, 10, '行驶中车轮触轧车道边线');
        const bh = bodyHits(c, bodyL).length > 0;
        edge('b', bh && dir !== 0, 10, '行驶中车身触碰库位边线');
        if (P.step === 0) { P.tip = '沿车道直线前进，车尾越过库前线后停车'; if (P.rev > 0.3) P.step = 1; }
        else if (P.step === 1) {
          P.tip = '倒车入库：右打满→约45°回正→右前轮过库口线后左打满→车身摆正停车';
          if (dir === 0) P.stopSeen = true;
          if (dir > 0 && P.fwd > 0.02) {
            const ins = insideRect(bodyPoly(c), CF.gx0 + 0.07, CF.y1 - 0.075, CF.gx1 - 0.07, CF.gy1 - 0.07);
            if (!ins && !P.inChecked) fail('车辆入库停止后，车身出线');
            P.inChecked = true;
            if (c.sig !== -1 || (P.sigOnT != null && S.t - P.sigOnT < 3)) S.ded(10, c.sig === 1 ? '出库前，错误使用转向灯' : c.sig === -1 ? '出库前，开启转向灯不足3秒即起步' : '出库前，不使用转向灯', id);
            P.step = 2;
          } else if (dir === 0 && P.rev > 0) {
            const ins = insideRect(bodyPoly(c), CF.gx0 + 0.07, CF.y1 - 0.075, CF.gx1 - 0.07, CF.gy1 - 0.07);
            if (ins) P.tip = '已入库！开启左转向灯3秒后，挂一挡前进出库';
          }
          if (c.sig === -1 && P.sigOnT == null) P.sigOnT = S.t; if (c.sig !== -1) P.sigOnT = null;
        } else {
          P.tip = '向左出库，驶回车道后回正，驶过终点线';
          const f = toW(c, CAR.WB + CAR.FO, 0); if (f[0] > CF.end) P.done = true;
          if (P.rev > 0.3) fail('不按规定路线、顺序行驶');
        }
      };
    } else if (id === 'podao') {
      P.tick = (c, dt, dir) => {
        track(dir, dt, c);
        if (wheelHits(c, wheelL).length) fail('车轮轧道路边缘线');
        const fb = Math.max(...bodyPoly(c).slice(0, 2).map(p => p[0]));
        const right = Math.max(toW(c, CAR.WB + CAR.FO, CAR.W / 2)[1], toW(c, -CAR.RO, CAR.W / 2)[1]);
        if (P.step === 0) {
          P.tip = '直线上坡，右侧车身靠近边缘线（30cm内），前保险杠对准桩杆线停车';
          if (dir === 0 && fb > PD.stop - 1.6 && fb < PD.stop + 0.5) {
            P.st = (P.st || 0) + dt;
            if (P.st > 0.4) {
              P.step = 1; P.stopT = S.t; P.stopOdo = c.odo; P.maxRoll = 0; P.hbUsed = c.hb;
              const df = fb - PD.stop, dr = (PD.y1 - 0.075) - right;
              S.measure = { df, dr, x: fb, y: right };
              S.emit('measure', { df, dr });
              if (Math.abs(df) > 0.5) fail(`前保险杠未定于桩杆线上，且前后超出50厘米（${(df * 100).toFixed(0)}cm）`);
              else if (Math.abs(df) > 0.3) S.ded(10, `前保险杠未定于桩杆线上（偏差${Math.abs(df * 100).toFixed(0)}cm）`, id);
              if (dr > 0.5) fail(`车身距离路边缘线超过50厘米（${(dr * 100).toFixed(0)}cm）`);
              else if (dr > 0.3) S.ded(10, `车身距离路边缘线超出30厘米（${(dr * 100).toFixed(0)}cm）`, id);
            }
          } else P.st = 0;
          if (fb > PD.stop + 0.5 && dir > 0) { fail('未在桩杆线处定点停车（超出50厘米）'); P.step = 1; P.stopT = S.t; P.stopOdo = c.odo; P.maxRoll = 0; P.hbUsed = true; P.skipped = true; }
        } else if (P.step === 1) {
          P.tip = '拉紧手刹 → 挂一挡 → 加油至约1500转 → 抬离合至半联动 → 松手刹起步（30秒内）';
          if (c.hb) P.hbUsed = true;
          const roll = P.stopOdo - c.odo; P.maxRoll = Math.max(P.maxRoll, roll);
          if (P.maxRoll > 0.3) fail('起步时车辆后溜距离大于30厘米');
          if (!P.skipped && S.t - P.stopT > 30) fail('起步时间超过30秒');
          if (c.odo - P.stopOdo > 0.3) {
            P.step = 2;
            if (!P.hbUsed) S.ded(10, '停车后，未拉紧驻车制动器', id);
            if (P.maxRoll > 0.1 && P.maxRoll <= 0.3) S.ded(10, `起步时车辆后溜（${(P.maxRoll * 100).toFixed(0)}cm）`, id);
          }
        } else {
          P.tip = '平稳起步上坡，过坡顶后控制车速下坡';
          if (fb > PD.x1 - 2) P.done = true;
        }
      };
    } else if (id === 'quxian') {
      P.tick = (c, dt, dir) => {
        track(dir, dt, c);
        if (wheelHits(c, wheelL).length) fail('车轮轧道路边缘线');
        if (P.rev > 0.3) fail('不按规定路线行驶（倒车）');
        const sAng = Math.atan2(c.y - QX.y, c.x - (QX.x - QX.R));
        P.tip = c.x > QX.x - 2 * QX.R ? '左转弯：车头左角（雨刮器左端）沿右边线走，看远处' : '右转弯：车头右角沿左边线走，及时回方向';
        if (c.y < -18 && c.x < QX.x - 3 * QX.R && c.x > QX.x - 5 * QX.R) P.done = true;
        P.ang = sAng;
      };
    } else if (id === 'zhijiao') {
      P.tick = (c, dt, dir) => {
        track(dir, dt, c);
        if (wheelHits(c, wheelL).length) fail('车轮轧道路边缘线');
        if (P.rev > 0.3) fail('不按规定路线行驶（倒车）');
        const turned = wrap(c.th + PI / 2);
        if (!P.turnStart && turned < -15 * D2R) {
          P.turnStart = true;
          if (c.sig !== -1) S.ded(10, c.sig === 1 ? '转弯时错误使用转向灯' : '转弯时不使用转向灯', id);
        }
        P.tip = !P.turnStart ? '开启左转向灯，车身靠右行驶；左后视镜与内直角点对齐时向左打满' : '车身摆正后回正方向，关闭转向灯';
        const f = toW(c, CAR.WB + CAR.FO, 0);
        if (f[0] < ZJ.xEnd + 2 && c.y < ZJ.yi + 1) {
          if (c.sig !== 0) S.ded(10, '转弯后不关闭转向灯', id);
          P.done = true;
        }
      };
    }
    return P;
  }

  const Core = { CAR, COURSE, ITEMS, EXAM_ORDER, DK, PD, CF, QX, ZJ, newCar, stepCar, shift, ignite, engage, createSession, createAuto, legsFor,
    bodyHits, wheelHits, bodyPoly, wheels, toW, toL, heightAt, fxLines, insideRect, pathFrom, CF_PLAN, RMIN, IDLE_W, W2RPM, RPM2W, swFromK };
  if (typeof window === 'undefined') { module.exports = Core; return; }
  /* ======================================================================
   * 界面层
   * ====================================================================== */
  const ST = { get: (k, d) => App.store.get('sim2_' + k, d), set: (k, v) => App.store.set('sim2_' + k, v) };
  const esc = s => App.esc(s);
  function rng(seed) { return function () { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

  /* ---------- 评判标准 & 技巧（与 GA 1026 / 公安部令第162号配套考试标准一致） ---------- */
  const RULES = {
    daoku: [['不按规定路线、顺序行驶', '不合格'], ['车身出线', '不合格'], ['倒库不入', '不合格'], ['在倒车前，未将两个前轮触地点均驶过控制线', '不合格'], ['项目完成时间超过210秒', '不合格'], ['中途停车（超过2秒）', '每次扣5分']],
    cefang: [['车辆入库停止后，车身出线', '不合格'], ['项目完成时间超过90秒', '不合格'], ['行驶中车轮触轧车道边线', '每次扣10分'], ['行驶中车身触碰库位边线', '每次扣10分'], ['出库前，不使用或错误使用转向灯（含开灯不足3秒）', '扣10分'], ['中途停车（超过2秒）', '每次扣5分']],
    podao: [['车辆停止后，前保险杠未定于桩杆线上，且前后超出50cm', '不合格'], ['车辆停止后，车身距离路边缘线超出50cm', '不合格'], ['起步时间超过30秒', '不合格'], ['起步时车辆后溜距离大于30cm', '不合格'], ['行驶中车轮轧道路边缘线', '不合格'], ['前保险杠未定于桩杆线上，前后偏差30–50cm', '扣10分'], ['车身距离路边缘线30–50cm', '扣10分'], ['停车后，未拉紧驻车制动器（手刹）', '扣10分'], ['起步时车辆后溜10–30cm', '扣10分']],
    zhijiao: [['车轮轧道路边缘线', '不合格'], ['转弯时不使用或错误使用转向灯，转弯后不关闭转向灯', '扣10分'], ['中途停车（超过2秒）', '扣10分']],
    quxian: [['车轮轧道路边缘线', '不合格'], ['中途停车（超过2秒）', '扣10分']],
    general: [['不按规定使用安全带', '不合格'], ['因操作不当造成发动机熄火', '每次扣10分'], ['起步时未松驻车制动器', '扣10分'], ['考试过程中倒车（直角/曲线）或不按考试员指令驾驶', '不合格'], ['C1/C2 满分100分，80分及格（大车90分）', '']]
  };
  const TIPS = {
    daoku: ['起步：系安全带→踩离合挂一挡→松手刹→缓抬离合半联动前进；车身距库前线约1.5米直线行驶。',
      '停车点：两前轮越过控制线（右后视镜下沿看到控制线后再走约半个车身）停车，挂倒挡。',
      '右倒库：半联动缓慢倒车，右后视镜下沿看到库角时向右打满（一圈半）。',
      '修正：看左后视镜，左后轮与库边线距离小于30cm时回正少许；两侧车身与库边线平行时方向回正。',
      '停车点：左后视镜下沿与库前线（库口线）重合 / 库前线在左后视镜中消失于车门下沿时停车，此时车尾距库底约30–40cm。',
      '出库：一挡前进，车头盖住对面车道边线约1/3或前轮过库口线约1米时，向左打满；车身摆正后回正，两前轮过左侧控制线后停车。',
      '左倒库：方法相同、方向相反——左后视镜看到库角时向左打满。',
      'C1 手动挡：全程离合半联动控速，不踩油门，停车先踩离合再踩刹车；C2 自动挡：松刹车靠怠速蠕行，用刹车控速，方向点位相同。'],
    cefang: ['入库前：沿车道直线行驶，右侧车身距车道边线30–50cm（引擎盖右1/3对准边线）。',
      '停车点：车尾在库前线内约1米（右后视镜中库前角移到车门把手/后门下沿）停车，挂倒挡。',
      '第一把：倒车时右后视镜下沿看到库前角，向右打满；左后视镜看到库后角（车身约30–45°）时回正。',
      '第二把：右后视镜中右后轮快压库边线（距约30cm）或右前轮过库口线时，向左打满；车身摆正（与库线平行）后停车、回正。',
      '出库：先开左转向灯（3秒以上）→ 挂一挡 → 向左打满驶出 → 车头回到车道（左前轮离车道边线约一个轮胎）时向右回正 → 关闭转向灯。',
      '注意：90秒内完成，全程不能压线；C1 手动挡半联动控速，C2 自动挡松刹车蠕行。'],
    podao: ['靠右：引擎盖右1/3（或雨刮器右下角凸点）对准右边缘线，保持车身距边线30cm以内上坡。',
      '定点：桩杆（停车线）与右后视镜下沿/车门把手对齐时，踩离合踩刹车停车，前保险杠应在桩杆线±30cm内。',
      '停车后：立即拉紧手刹（未拉扣10分），挂一挡。',
      '起步：右脚轻点油门至约1500转 → 左脚缓抬离合至半联动（车身抖动、转速下降）→ 稳住离合，松手刹 → 慢松离合加油上坡。30秒内必须起步，后溜大于30cm不合格。',
      'C1/C2：C2（自动挡）科目二不考坡道定点停车和起步（仅可练习）；C2 起步可先踩刹车，松手刹后迅速换踩油门。'],
    zhijiao: ['入弯前打开左转向灯（转弯时不开扣10分）。',
      '靠右行驶：车身距右边缘线约30cm（引擎盖右1/3压右边线）。',
      '点位：左后视镜（或车门把手/左肩）与内直角点对齐时，向左一把打满。',
      '车头摆正、与道路平行时回正方向，转向灯随方向回正自动关闭（未关闭扣10分）。',
      '全程一挡低速，不得中途停车超过2秒；C2 松刹车蠕行，转弯时可轻踩刹车。'],
    quxian: ['入口：一挡低速，车身居中驶入。',
      '左弯：车头左角（雨刮器左端点）沿右侧边线行驶，左后轮自然跟着弯走，眼睛看前方路线。',
      '换向：车头右角接近左边线时，向右转动方向盘进入右弯；右弯时车头右角沿左边线行驶。',
      '出口：车头摆正后回正，驶出曲线。全程不得停车（扣10分），车轮不得压线（不合格）；车速保持在1挡怠速即可，不需加挡。']
  };
  const ICON = {
    daoku: '#1677ff', cefang: '#10b981', podao: '#f97316', zhijiao: '#8b5cf6', quxian: '#ef4444'
  };

  /* ---------- CSS ---------- */
  const CSS = `
.s2-hub .s2-hero{position:relative;overflow:hidden;border-radius:20px;padding:20px;color:#fff;margin-bottom:14px;background:linear-gradient(135deg,#059669,#10b981 45%,#0ea5e9)}
.s2-hub .s2-hero h2{font-size:22px;margin:0 0 4px}.s2-hub .s2-hero p{margin:0;opacity:.92;font-size:14px}
.s2-hub .s2-hero .s2-hero-btns{display:flex;flex-wrap:wrap;gap:8px;margin-top:14px;position:relative}
.s2-hub .s2-hero .btn{border:0}.s2-hub .s2-hero .btn.w{background:#fff;color:#047857}.s2-hub .s2-hero .btn.t{background:rgba(255,255,255,.18);color:#fff}
.s2-hub .s2-hero svg.s2-deco{position:absolute;right:-18px;bottom:-26px;width:210px;opacity:.22}
.s2-items{display:grid;grid-template-columns:repeat(auto-fill,minmax(250px,1fr));gap:12px;margin-bottom:14px}
.s2-item{background:var(--card);border-radius:16px;box-shadow:var(--shadow);overflow:hidden;display:flex;flex-direction:column}
.s2-item .s2-prev{height:132px;background:#3b3f45;position:relative;cursor:pointer}
.s2-item .s2-prev svg{width:100%;height:100%;display:block}
.s2-item .s2-prev .s2-best{position:absolute;right:8px;top:8px;background:rgba(0,0,0,.55);color:#fff;font-size:12px;padding:2px 8px;border-radius:8px;backdrop-filter:blur(4px)}
.s2-item .s2-body{padding:12px 14px 14px;display:flex;flex-direction:column;gap:8px;flex:1}
.s2-item .s2-name{font-weight:800;font-size:16px;display:flex;align-items:center;gap:8px}
.s2-item .s2-name i{width:10px;height:10px;border-radius:3px;display:inline-block}
.s2-item .s2-meta{font-size:12px;color:var(--text3)}
.s2-item .s2-acts{display:flex;gap:6px;margin-top:auto}.s2-item .s2-acts .btn{flex:1;padding:0 8px}
.s2-tips ol{margin:6px 0 0;padding-left:20px}.s2-tips li{margin:4px 0;font-size:14px}
.s2-rules td:last-child{white-space:nowrap;font-weight:600}.s2-rules .f{color:var(--bad)}.s2-rules .d{color:var(--warn)}
.s2-keys{display:grid;grid-template-columns:auto 1fr;gap:6px 12px;font-size:14px;align-items:center}
.s2-hist .list-item{cursor:default}
.s2-sim{position:relative;width:100%;height:100%;overflow:hidden;background:#2a2e33;color:#fff;user-select:none;-webkit-user-select:none;touch-action:none;-webkit-touch-callout:none;--u:1px;font-size:calc(13*var(--u))}
.s2-sim *{box-sizing:border-box}
.s2-cv{position:absolute;inset:0;width:100%;height:100%;display:block}
.s2-g{background:rgba(16,20,28,.58);-webkit-backdrop-filter:blur(10px) saturate(1.5);backdrop-filter:blur(10px) saturate(1.5);border:1px solid rgba(255,255,255,.13);border-radius:calc(12*var(--u));box-shadow:0 6px 22px rgba(0,0,0,.28)}
.s2-mirs{position:absolute;top:calc(6*var(--u) + env(safe-area-inset-top,0px));left:50%;transform:translateX(-50%);display:flex;gap:calc(8*var(--u));pointer-events:none;align-items:flex-start}
.s2-mir{position:relative;border-radius:calc(14*var(--u));padding:calc(3*var(--u));background:linear-gradient(#2b2f36,#111418);box-shadow:0 4px 16px rgba(0,0,0,.45),inset 0 1px 0 rgba(255,255,255,.18)}
.s2-mir canvas{display:block;border-radius:calc(11*var(--u))}
.s2-mir.side canvas{border-radius:calc(16*var(--u)) calc(9*var(--u)) calc(9*var(--u)) calc(16*var(--u))}
.s2-mir.side.r canvas{border-radius:calc(9*var(--u)) calc(16*var(--u)) calc(16*var(--u)) calc(9*var(--u))}
.s2-mir b{position:absolute;bottom:calc(-15*var(--u));left:0;right:0;text-align:center;font-size:calc(10*var(--u));font-weight:500;opacity:.75;text-shadow:0 1px 2px #000}
.s2-info{position:absolute;left:calc(8*var(--u) + env(safe-area-inset-left,0px));top:calc(6*var(--u) + env(safe-area-inset-top,0px));padding:calc(7*var(--u)) calc(10*var(--u));min-width:calc(150*var(--u));max-width:calc(210*var(--u))}
.s2-info .s2-pn{font-weight:800;font-size:calc(14*var(--u));display:flex;align-items:center;gap:6px;white-space:nowrap}
.s2-info .s2-pn .tag{font-size:calc(10*var(--u));padding:0 6px;background:rgba(255,255,255,.16);color:#fff}
.s2-info .s2-sc{display:flex;gap:calc(12*var(--u));margin-top:2px;align-items:baseline}
.s2-info .s2-sc b{font-size:calc(22*var(--u));font-variant-numeric:tabular-nums;line-height:1.1}
.s2-info .s2-sc span{font-size:calc(11*var(--u));opacity:.7}
.s2-info .s2-sc .bad{color:#ff6b6e}
.s2-log{margin-top:4px;font-size:calc(11*var(--u));line-height:1.45;max-height:calc(58*var(--u));overflow:hidden}
.s2-log div{color:#ffb4b4;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.s2-log div.f{color:#ff6b6e;font-weight:700}
.s2-tip{position:absolute;left:50%;transform:translateX(-50%);padding:calc(6*var(--u)) calc(12*var(--u));font-size:calc(12.5*var(--u));line-height:1.4;max-width:min(92%,calc(560*var(--u)));text-align:center;pointer-events:none;transition:opacity .3s}
.s2-tip.demo{border-color:rgba(250,204,21,.6);background:rgba(40,32,6,.66)}
.s2-tip.demo::before{content:"教练 ";color:#facc15;font-weight:800}
.s2-tr{position:absolute;right:calc(8*var(--u) + env(safe-area-inset-right,0px));top:calc(6*var(--u) + env(safe-area-inset-top,0px));display:flex;flex-direction:column;gap:calc(6*var(--u))}
.s2-b{width:calc(44*var(--u));height:calc(44*var(--u));border-radius:calc(12*var(--u));display:flex;flex-direction:column;align-items:center;justify-content:center;font-size:calc(10*var(--u));font-weight:600;color:#fff;cursor:pointer;gap:1px;line-height:1.1;transition:background .15s,transform .08s;padding:0}
.s2-b svg{width:calc(20*var(--u));height:calc(20*var(--u))}
.s2-b:active{transform:scale(.94)}
.s2-b.on{background:rgba(22,119,255,.75);border-color:rgba(120,180,255,.7)}
.s2-b.red.on{background:rgba(229,56,59,.8)}.s2-b.amb.on{background:rgba(245,158,11,.85)}.s2-b.grn.on{background:rgba(22,163,74,.8)}
.s2-btns{position:absolute;display:grid;grid-template-columns:repeat(3,calc(44*var(--u)));gap:calc(6*var(--u))}
.s2-wheel{position:absolute;touch-action:none;cursor:grab;filter:drop-shadow(0 8px 18px rgba(0,0,0,.45))}
.s2-wheel svg{width:100%;height:100%;display:block;overflow:visible}
.s2-wheel .s2-wa{position:absolute;left:0;right:0;bottom:calc(-16*var(--u));text-align:center;font-size:calc(11*var(--u));font-weight:700;text-shadow:0 1px 3px #000;font-variant-numeric:tabular-nums}
.s2-peds{position:absolute;display:flex;gap:calc(8*var(--u));align-items:flex-end}
.s2-ped{position:relative;width:calc(56*var(--u));border-radius:calc(12*var(--u));overflow:hidden;touch-action:none;cursor:pointer;display:flex;align-items:flex-end;justify-content:center}
.s2-ped i{position:absolute;left:0;right:0;bottom:0;height:0;background:linear-gradient(0deg,rgba(255,255,255,.55),rgba(255,255,255,.18));pointer-events:none}
.s2-ped.brk i{background:linear-gradient(0deg,rgba(255,90,90,.85),rgba(255,90,90,.25))}
.s2-ped.thr i{background:linear-gradient(0deg,rgba(60,220,120,.85),rgba(60,220,120,.25))}
.s2-ped.clu i{background:linear-gradient(0deg,rgba(90,160,255,.85),rgba(90,160,255,.25))}
.s2-ped span{position:relative;font-weight:800;font-size:calc(14*var(--u));padding-bottom:calc(8*var(--u));pointer-events:none;text-shadow:0 1px 2px rgba(0,0,0,.6)}
.s2-ped em{position:absolute;left:0;right:0;border-top:1px dashed rgba(255,255,255,.55);border-bottom:1px dashed rgba(255,255,255,.55);background:rgba(250,204,21,.13);pointer-events:none;font-style:normal;font-size:calc(9*var(--u));text-align:center;color:#fde68a;display:flex;align-items:center;justify-content:center}
.s2-ped .s2-pr{position:absolute;inset:0;background:repeating-linear-gradient(0deg,rgba(255,255,255,.06) 0 3px,transparent 3px 9px);pointer-events:none}
.s2-gear{position:absolute;padding:calc(6*var(--u))}
.s2-gear svg{display:block;width:100%;height:100%;touch-action:none;cursor:pointer}
.s2-dash{position:absolute;left:50%;transform:translateX(-50%);padding:calc(4*var(--u)) calc(6*var(--u));pointer-events:none}
.s2-dash canvas{display:block}
.s2-banner{position:absolute;left:50%;top:38%;transform:translate(-50%,-50%) scale(.9);padding:calc(10*var(--u)) calc(20*var(--u));border-radius:calc(14*var(--u));font-weight:800;font-size:calc(18*var(--u));opacity:0;transition:opacity .25s,transform .25s;pointer-events:none;text-align:center;white-space:nowrap;box-shadow:0 10px 30px rgba(0,0,0,.35)}
.s2-banner.show{opacity:1;transform:translate(-50%,-50%) scale(1)}
.s2-banner.bad{background:rgba(220,38,38,.92)}.s2-banner.ok{background:rgba(22,163,74,.92)}.s2-banner.info{background:rgba(22,119,255,.92)}.s2-banner.warn{background:rgba(217,119,6,.94)}
.s2-banner small{display:block;font-size:calc(12*var(--u));font-weight:600;opacity:.9}
.s2-ov{position:absolute;inset:0;background:rgba(6,9,14,.55);display:flex;align-items:center;justify-content:center;z-index:5;-webkit-backdrop-filter:blur(3px);backdrop-filter:blur(3px);padding:12px}
.s2-card{background:var(--card);color:var(--text);border-radius:18px;padding:18px;width:min(420px,100%);max-height:calc(100% - 8px);overflow:auto;box-shadow:0 20px 60px rgba(0,0,0,.45);position:relative}
.s2-card h3{margin:0 0 10px;font-size:19px}
.s2-card .s2-mrow{display:flex;flex-wrap:wrap;gap:8px;margin:6px 0}
.s2-card .s2-mrow .btn{flex:1 1 30%}
.s2-card .s2-opt{display:flex;align-items:center;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--line);font-size:14px;gap:10px}
.s2-res-score{font-size:56px;font-weight:900;line-height:1;font-variant-numeric:tabular-nums}
.s2-stamp{position:absolute;right:18px;top:22px;border:4px solid;border-radius:12px;padding:4px 12px;font-size:26px;font-weight:900;transform:rotate(-12deg);letter-spacing:4px;opacity:.9}
.s2-stamp.p{color:#16a34a}.s2-stamp.f{color:#e5383b}
.s2-dl{font-size:13px;margin:10px 0;max-height:180px;overflow:auto}.s2-dl div{display:flex;gap:8px;padding:5px 0;border-bottom:1px dashed var(--line)}
.s2-dl div b{margin-left:auto;white-space:nowrap}.s2-dl .f b{color:var(--bad)}.s2-dl .d b{color:var(--warn)}
.s2-kh{position:absolute;right:calc(60*var(--u));top:calc(80*var(--u));padding:12px 14px;font-size:12.5px;line-height:1.7;z-index:4;max-width:330px}
.s2-kh .kbd{background:rgba(255,255,255,.12);border-color:rgba(255,255,255,.25);color:#fff;min-width:20px}
.s2-kh .x{position:absolute;right:6px;top:4px;cursor:pointer;opacity:.7;font-size:16px;padding:2px 6px}
.s2-sim.port .s2-sc b{font-size:calc(19*var(--u))}.s2-sim.port .s2-sc{gap:calc(8*var(--u))}
.s2-sim.hidec .s2-wheel,.s2-sim.hidec .s2-peds,.s2-sim.hidec .s2-gear{opacity:.35}
`;
  function injectCSS() { if (!document.getElementById('sim2-css')) { const s = document.createElement('style'); s.id = 'sim2-css'; s.textContent = CSS; document.head.appendChild(s); } }

  /* ---------- 预览图（直接由场地几何生成） ---------- */
  const FXBOX = { daoku: [-17, -2.2, 17, 13.6], podao: [39, -0.5, 89, 8], cefang: [94, -0.2, 136, 9], quxian: [123, -26, 154, -3], zhijiao: [107, -44, 133, -22] };
  function previewSVG(id, withPath = true) {
    const b = FXBOX[id], w = b[2] - b[0], h = b[3] - b[1];
    let s = `<svg viewBox="${b[0]} ${b[1]} ${w} ${h}" preserveAspectRatio="xMidYMid meet" xmlns="http://www.w3.org/2000/svg">`;
    s += `<rect x="${b[0] - 50}" y="${b[1] - 50}" width="${w + 100}" height="${h + 100}" fill="#4f7d35"/>`;
    for (const r of COURSE.roads) {
      if (r.type === 'rect') s += `<rect x="${r.r[0]}" y="${r.r[1]}" width="${r.r[2] - r.r[0]}" height="${r.r[3] - r.r[1]}" fill="${r.slope ? '#5a5e66' : '#474b52'}"/>`;
      else s += `<polyline points="${r.pts.map(p => p.join(',')).join(' ')}" fill="none" stroke="${r.conn ? '#3d4046' : '#474b52'}" stroke-width="${r.w}" stroke-linejoin="${r.join || 'round'}"/>`;
    }
    for (const l of COURSE.lines) s += `<polyline points="${l.pts.map(p => p.join(',')).join(' ')}" fill="none" stroke="${l.col}" stroke-width="${Math.max(l.w, 0.22)}"${l.dash ? ` stroke-dasharray="${l.dash.join(' ')}"` : ''}/>`;
    if (withPath) {
      const legs = legsFor(id);
      legs.forEach(L => { s += `<polyline points="${L.pts.filter((p, i) => i % 6 === 0).map(p => p.x.toFixed(2) + ',' + p.y.toFixed(2)).join(' ')}" fill="none" stroke="${L.dir > 0 ? '#facc15' : '#38bdf8'}" stroke-width="0.32" stroke-dasharray="${L.dir > 0 ? '0.9 0.5' : '0.4 0.4'}" opacity=".95"/>`; });
      const p0 = legs[0].pts[0], car = { x: p0.x, y: p0.y, th: p0.th };
      const bp = bodyPoly(car); s += `<polygon points="${bp.map(p => p.map(v => v.toFixed(2)).join(',')).join(' ')}" fill="#fff" stroke="#1677ff" stroke-width=".18"/>`;
    }
    return s + '</svg>';
  }
  /* ---------- 首页（项目中心） ---------- */
  const ORDER5 = ['daoku', 'cefang', 'podao', 'zhijiao', 'quxian'];
  function fmtT(s) { s = Math.max(0, s || 0); const m = Math.floor(s / 60), x = Math.floor(s % 60); return m + ':' + String(x).padStart(2, '0'); }
  function hub(el) {
    App.setTitle('科目二 · 场地驾驶');
    let trans = ST.get('trans', App.settings.trans || 'manual');
    const best = ST.get('best', {}), stats = ST.get('stats', {}), hist = App.history('k2');
    const q = id => `gear=${trans}`;
    const rulesTbl = id => `<table class="tbl s2-rules"><tbody>${RULES[id].map(([a, b]) => `<tr><td>${esc(a)}</td><td class="${/不合格/.test(b) ? 'f' : 'd'}">${esc(b)}</td></tr>`).join('')}</tbody></table>`;
    const render = () => {
      el.innerHTML = `<div class="s2-hub fade-in">
      <div class="s2-hero">
        <svg class="s2-deco" viewBox="0 0 100 60"><rect x="10" y="8" width="80" height="22" fill="none" stroke="#fff" stroke-width="2"/><rect x="40" y="30" width="20" height="26" fill="none" stroke="#fff" stroke-width="2"/><path d="M20 19h18" stroke="#fff" stroke-width="2" stroke-dasharray="4 3"/></svg>
        <h2>科目二 · 场地驾驶模拟</h2>
        <p>真实比例考场（按 GA 1026 场地尺寸），运动学车辆模型 + 发动机 / 离合半联动 / 熄火 / 坡道溜车，三面后视镜点位，电子评判与语音播报。</p>
        <div class="s2-hero-btns">
          <a class="btn w" href="#/k2/exam?mode=exam&${q()}">全真模拟考试</a>
          <a class="btn t" href="#/k2/free?mode=practice&${q()}">自由练习场</a>
          <button class="btn t" id="s2Help">操作说明</button>
        </div>
      </div>
      <div class="card"><div class="row between wrap">
        <div><b>考试车型</b><div class="muted small">${trans === 'manual' ? 'C1 手动挡：离合半联动、坡道起步是难点；考五项' : 'C2 自动挡：用刹车控制车速；考四项（不考坡道定点停车和起步）'}</div></div>
        <div class="seg" id="s2Trans"><button data-v="manual" class="${trans === 'manual' ? 'on' : ''}">手动挡 C1</button><button data-v="auto" class="${trans === 'auto' ? 'on' : ''}">自动挡 C2</button></div>
      </div></div>
      <div class="section-title">考试项目（单项练习 · 单项考试 · 教练演示）</div>
      <div class="s2-items">${ORDER5.map(id => {
        const b = best[id], st = stats[id] || { n: 0, p: 0 };
        return `<div class="s2-item"><div class="s2-prev" data-tips="${id}">${previewSVG(id)}${b ? `<span class="s2-best">最佳 ${b.score}分 · ${fmtT(b.time)}</span>` : ''}</div>
        <div class="s2-body"><div class="s2-name"><i style="background:${ICON[id]}"></i>${ITEMS[id].name}${id === 'podao' && trans === 'auto' ? '<span class="tag orange">C2不考</span>' : ''}</div>
        <div class="s2-meta">${ITEMS[id].limit ? '限时 ' + ITEMS[id].limit + ' 秒 · ' : ''}练习 ${st.n} 次${st.n ? ' · 合格 ' + st.p + ' 次' : ''}</div>
        <div class="s2-acts"><a class="btn sm primary" href="#/k2/${id}?mode=practice&${q()}">练习</a><a class="btn sm" href="#/k2/${id}?mode=exam&${q()}">考试</a><a class="btn sm" href="#/k2/${id}?mode=practice&demo=1&${q()}">演示</a><button class="btn sm ghost" data-tips="${id}">点位</button></div></div></div>`;
      }).join('')}</div>
      <div class="section-title">技巧点位 · 教练口诀</div>
      ${ORDER5.map(id => `<details class="card s2-tips"><summary class="card-title" style="margin:0;cursor:pointer">${ITEMS[id].name}<span class="tag" style="background:${ICON[id]};color:#fff">${ITEMS[id].short}</span></summary><ol>${TIPS[id].map(t => `<li>${esc(t)}</li>`).join('')}</ol></details>`).join('')}
      <div class="section-title">评判标准（GA 1026《机动车驾驶人考试内容和方法》，配套公安部令第162号）</div>
      <div class="card">${ORDER5.map(id => `<h4 style="margin:10px 0 6px">${ITEMS[id].name}</h4>${rulesTbl(id)}`).join('')}<h4 style="margin:14px 0 6px">通用评判</h4>${rulesTbl('general')}
        <p class="muted small" style="margin-top:10px">说明：中途停车指同一行驶方向上停车超过2秒后继续行驶（倒库/侧方扣5分，直角/曲线扣10分）；考试满分100分，C1/C2 80分及格；考试中出现不合格项即终止并判定不合格（真实考试当场可补考一次）。各地考场尺寸、点位会因车型略有差异。</p></div>
      <div class="section-title">操作说明</div>
      <div class="card" id="s2Keys">${keysHTML()}</div>
      <div class="section-title">考试记录</div>
      <div class="list s2-hist">${hist.length ? hist.slice(0, 12).map(h => `<div class="list-item"><div class="ico" style="background:${h.pass ? 'var(--ok)' : 'var(--bad)'}">${h.score}</div><div class="flex1"><b>${esc(h.name || '科目二模拟考试')}</b><div class="muted small">${new Date(h.t).toLocaleString('zh-CN', { hour12: false })} · ${h.trans === 'auto' ? '自动挡' : '手动挡'}${h.time ? ' · 用时 ' + fmtT(h.time) : ''}</div></div><span class="tag ${h.pass ? 'green' : 'red'}">${h.pass ? '合格' : '不合格'}</span></div>`).join('') : '<div class="list-item muted">暂无记录，完成一次全真模拟考试后显示</div>'}</div>
      </div>`;
      el.querySelectorAll('#s2Trans button').forEach(b => b.onclick = () => { trans = b.dataset.v; ST.set('trans', trans); render(); });
      el.querySelectorAll('[data-tips]').forEach(b => b.onclick = () => tipsModal(b.dataset.tips));
      el.querySelector('#s2Help').onclick = () => document.getElementById('s2Keys').scrollIntoView({ behavior: 'smooth' });
    };
    render();
    return () => {};
  }
  function keysHTML() {
    const k = s => s.split(' ').map(x => `<span class="kbd">${x}</span>`).join(' ');
    return `<div class="s2-keys">
      <b>方向盘</b><span>${k('← →')} 或 ${k('A D')} 按住转动（打死一圈半=540°）；${k('Z')} 按住回正；鼠标/手指拖动方向盘</span>
      <b>油门 / 刹车</b><span>${k('↑ W')} 油门（按住渐增），${k('↓ S')} 刹车</span>
      <b>离合</b><span>${k('Shift')} 或 ${k('C')} 按住踩下；松开后自动缓抬（经过半联动区会放慢）；${k('X')} 按住保持当前位置（稳住半联动）</span>
      <b>挡位</b><span>手动：${k('1 2 3')} ${k('R')} 倒挡 ${k('N')} 空挡（须踩离合）；自动：${k('P R N')}，${k('1')} = D挡</span>
      <b>其它</b><span>${k('Space')} 手刹 · ${k('Q')}/${k('E')} 左/右转向灯 · ${k('H')} 喇叭 · ${k('B')} 安全带 · ${k('F')} 点火/熄火 · ${k('V')} 切换视角 · ${k('G')} 辅助线 · ${k('M')} 静音 · ${k('Esc')} 暂停</span>
      <b>触屏</b><span>左下方向盘拖动旋转；右下踏板：按住即踩，手指上下滑动调节深浅（离合中段黄色区为半联动）；点击挡位图换挡；双指捏合或滚轮缩放视野。建议横屏。</span>
    </div>`;
  }
  function tipsModal(id) {
    App.modal({ title: ITEMS[id].name + ' · 点位与评判', html: `<div style="background:#3b3f45;border-radius:12px;overflow:hidden;height:150px;margin-bottom:10px">${previewSVG(id)}</div>
      <div class="muted small">黄色虚线 = 前进轨迹，蓝色虚线 = 倒车轨迹（教学演示路线）</div>
      <ol style="padding-left:20px;font-size:14px">${TIPS[id].map(t => `<li style="margin:5px 0">${esc(t)}</li>`).join('')}</ol>
      <table class="tbl s2-rules" style="font-size:13px"><tbody>${RULES[id].map(([a, b]) => `<tr><td>${esc(a)}</td><td class="${/不合格/.test(b) ? 'f' : 'd'}">${esc(b)}</td></tr>`).join('')}</tbody></table>`,
      buttons: [{ text: '关闭' }, { text: '去练习', primary: true, onClick: () => App.go(`#/k2/${id}?mode=practice&gear=${ST.get('trans', App.settings.trans || 'manual')}`) }] });
  }
  const FONT = '"PingFang SC","Microsoft YaHei","Noto Sans CJK SC",sans-serif';
  // 世界坐标文字：小字号（<1px）在 Chrome 中字距会被取整挤成一团，故放大字号再反向缩放
  function wtext(g, s, x, y, size, rot = 0, w = 'bold') { g.save(); g.translate(x, y); if (rot) g.rotate(rot); g.scale(size / 40, size / 40); g.font = `${w} 40px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(s, 0, 0); g.restore(); }
  /* ---------- 纹理（只生成一次） ---------- */
  let TEX = null;
  function textures() {
    if (TEX) return TEX;
    const R = rng(20240401);
    const mk = (n, f) => { const c = document.createElement('canvas'); c.width = c.height = n; f(c.getContext('2d'), n); return c; };
    const blob = (g, n, x, y, r, col) => { for (const ox of [-n, 0, n]) for (const oy of [-n, 0, n]) { const gr = g.createRadialGradient(x + ox, y + oy, 0, x + ox, y + oy, r); gr.addColorStop(0, col); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(x + ox - r, y + oy - r, 2 * r, 2 * r); } };
    const speck = (g, n, cnt, a0, a1, light) => { for (let i = 0; i < cnt; i++) { const l = R() < light; g.fillStyle = l ? `rgba(255,255,255,${a0 + R() * a1})` : `rgba(0,0,0,${a0 + R() * a1 * 1.3})`; const s = 0.8 + R() * 1.7; g.fillRect(R() * n, R() * n, s, s); } };
    const asph = mk(256, (g, n) => { g.fillStyle = '#4a4d53'; g.fillRect(0, 0, n, n); for (let i = 0; i < 16; i++) blob(g, n, R() * n, R() * n, 20 + R() * 50, R() < 0.5 ? 'rgba(0,0,0,.08)' : 'rgba(255,255,255,.05)'); speck(g, n, 7000, 0.04, 0.12, 0.45); });
    const conc = mk(256, (g, n) => { g.fillStyle = '#a7a49b'; g.fillRect(0, 0, n, n); for (let i = 0; i < 12; i++) blob(g, n, R() * n, R() * n, 25 + R() * 60, R() < 0.6 ? 'rgba(60,50,30,.07)' : 'rgba(255,255,255,.07)'); speck(g, n, 4000, 0.03, 0.09, 0.5); });
    const grass = mk(256, (g, n) => {
      g.fillStyle = '#5b8a3c'; g.fillRect(0, 0, n, n);
      for (let i = 0; i < 18; i++) blob(g, n, R() * n, R() * n, 20 + R() * 46, R() < 0.5 ? 'rgba(30,60,10,.18)' : 'rgba(170,200,90,.14)');
      for (let i = 0; i < 2600; i++) { const x = R() * n, y = R() * n, a = R() * PI; g.strokeStyle = `hsla(${85 + R() * 30},${35 + R() * 25}%,${R() < 0.5 ? 22 + R() * 10 : 40 + R() * 14}%,.55)`; g.lineWidth = 1; g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * 3, y + Math.sin(a) * 3); g.stroke(); }
    });
    const tree = mk(128, (g) => {
      const Rt = rng(5);
      for (let i = 0; i < 9; i++) {
        const a = i / 9 * 2 * PI, r = i ? 26 : 0, x = 64 + Math.cos(a) * r * 0.9, y = 64 + Math.sin(a) * r * 0.9, rr = i ? 26 + Rt() * 10 : 34;
        const gr = g.createRadialGradient(x - rr * 0.35, y - rr * 0.35, 2, x, y, rr); gr.addColorStop(0, '#7fb24a'); gr.addColorStop(0.6, '#3f7a2a'); gr.addColorStop(1, '#24521a');
        g.fillStyle = gr; g.beginPath(); g.arc(x, y, rr, 0, 2 * PI); g.fill();
      }
      for (let i = 0; i < 60; i++) { g.fillStyle = `rgba(${Rt() < 0.5 ? '200,230,140' : '20,50,10'},.25)`; g.beginPath(); g.arc(20 + Rt() * 88, 20 + Rt() * 88, 1 + Rt() * 3, 0, 2 * PI); g.fill(); }
    });
    TEX = { asph, conc, grass, tree };
    return TEX;
  }
  function pat(ctx, name, texPerM) {
    const cache = ctx.__s2p || (ctx.__s2p = {});
    if (!cache[name]) { const p = ctx.createPattern(textures()[name], 'repeat'); try { p.setTransform(new DOMMatrix().scale(1 / texPerM)); } catch (e) {} cache[name] = p; }
    return cache[name];
  }

  /* ---------- 静态场景（Path2D 缓存） ---------- */
  let SCN = null;
  function scene() {
    if (SCN) return SCN;
    const C = COURSE, pads = new Path2D(), rects = new Path2D(), bands = {};
    const rr = (p, x0, y0, x1, y1, r) => { p.moveTo(x0 + r, y0); p.arcTo(x1, y0, x1, y1, r); p.arcTo(x1, y1, x0, y1, r); p.arcTo(x0, y1, x0, y0, r); p.arcTo(x0, y0, x1, y0, r); p.closePath(); };
    [[-22, -4, 22, 16.5], [35, -2, 93, 10], [90, -1.5, 140, 12], [118, -30, 158, -2], [104, -46, 134, -21]].forEach(b => rr(pads, b[0], b[1], b[2], b[3], 2.5));
    for (const r of C.roads) {
      if (r.type === 'rect') rects.rect(r.r[0], r.r[1], r.r[2] - r.r[0], r.r[3] - r.r[1]);
      else { const k = r.w + '|' + (r.join || 'round') + '|' + (r.conn ? 1 : 0); const p = bands[k] || (bands[k] = { p: new Path2D(), w: r.w, join: r.join || 'round', conn: r.conn }); p.p.moveTo(r.pts[0][0], r.pts[0][1]); r.pts.slice(1).forEach(q => p.p.lineTo(q[0], q[1])); }
    }
    const lines = C.lines.map(l => { const p = new Path2D(); p.moveTo(l.pts[0][0], l.pts[0][1]); l.pts.slice(1).forEach(q => p.lineTo(q[0], q[1])); return { p, l }; });
    // 装饰：树木、建筑、灯杆、停放车辆
    const R = rng(99), trees = [], B = C.bounds;
    const clear = (x, y, r) => {
      for (const rd of C.roads) {
        if (rd.type === 'rect') { if (x > rd.r[0] - r - 2.5 && x < rd.r[2] + r + 2.5 && y > rd.r[1] - r - 2.5 && y < rd.r[3] + r + 2.5) return false; }
        else for (let i = 0; i < rd.pts.length - 1; i++) if (segPtD2(x, y, rd.pts[i][0], rd.pts[i][1], rd.pts[i + 1][0], rd.pts[i + 1][1]) < (rd.w / 2 + r + 2) ** 2) return false;
      }
      for (const b of BLD) if (x > b[0] - r - 1 && x < b[0] + b[2] + r + 1 && y > b[1] - r - 1 && y < b[1] + b[3] + r + 1) return false;
      for (const t of trees) if (hyp(t[0] - x, t[1] - y) < (t[2] + r) * 0.8) return false;
      return true;
    };
    for (let x = B[0] + 3; x < B[2] - 2; x += 5.5 + R() * 2) { trees.push([x, B[1] + 2.5 + R(), 2 + R()]); trees.push([x + 2, B[3] - 2 + R(), 1.8 + R()]); }
    for (let y = B[1] + 8; y < B[3] - 6; y += 6 + R() * 2) { trees.push([B[0] + 2.2, y, 2 + R()]); trees.push([B[2] - 2.2, y + 2, 2 + R()]); }
    for (let i = 0; i < 900 && trees.length < 230; i++) { const x = B[0] + 6 + R() * (B[2] - B[0] - 12), y = B[1] + 6 + R() * (B[3] - B[1] - 12), r = 1.4 + R() * 1.6; if (clear(x, y, r)) trees.push([x, y, r]); }
    const lamps = [[-18, -3.2], [18, -3.2], [52, 0.2], [74, 0.2], [100, -0.8], [128, -0.8], [146, -3], [124, -28], [104, -36]];
    SCN = { pads, rects, bands: Object.values(bands), lines, trees, lamps };
    return SCN;
  }
  const BLD = [[-14, 18.5, 30, 6, '考试中心', '#e9edf2', '#c9d3de'], [40, 13, 16, 6, '候考厅', '#f1ece2', '#d8cdb7'], [-36, -50, 14, 9, '驾校车库', '#e4e8ee', '#b9c4d1'], [60, -46, 20, 10, '监控中心', '#eef1f5', '#cbd5e1']];
  const PARKED = [[-33, 9, 0, '#fff'], [-33, 12, 0, '#f2f2f2'], [-33, 15, 0, '#fff'], [22, 19.5, -PI / 2, '#fff'], [25, 19.5, -PI / 2, '#e8f0ff'], [62, 15.5, PI / 2, '#fff']];

  function drawWorld(ctx, vb, lite, t) {
    const S = scene(), T = textures();
    ctx.fillStyle = pat(ctx, 'grass', 40); ctx.fillRect(vb[0], vb[1], vb[2] - vb[0], vb[3] - vb[1]);
    ctx.fillStyle = pat(ctx, 'conc', 36); ctx.fill(S.pads);
    if (!lite) { // 混凝土分缝
      ctx.save(); ctx.clip(S.pads); ctx.strokeStyle = 'rgba(70,60,40,.16)'; ctx.lineWidth = 0.05; ctx.beginPath();
      for (let x = Math.floor(vb[0] / 5) * 5; x < vb[2]; x += 5) { ctx.moveTo(x, vb[1]); ctx.lineTo(x, vb[3]); }
      for (let y = Math.floor(vb[1] / 5) * 5; y < vb[3]; y += 5) { ctx.moveTo(vb[0], y); ctx.lineTo(vb[2], y); }
      ctx.stroke(); ctx.restore();
    }
    const ap = pat(ctx, 'asph', 44);
    ctx.lineCap = 'butt';
    for (const b of S.bands) if (b.conn) {
      ctx.strokeStyle = 'rgba(0,0,0,.18)'; ctx.lineWidth = b.w + 0.5; ctx.lineJoin = b.join; ctx.stroke(b.p);
      ctx.strokeStyle = ap; ctx.lineWidth = b.w; ctx.stroke(b.p);
    }
    ctx.fillStyle = ap; ctx.fill(S.rects);
    for (const b of S.bands) if (!b.conn) { ctx.strokeStyle = ap; ctx.lineWidth = b.w + 0.8; ctx.lineJoin = b.join; ctx.stroke(b.p); }
    // 连接道路导向虚线
    ctx.setLineDash([2, 3]); ctx.strokeStyle = 'rgba(255,255,255,.35)'; ctx.lineWidth = 0.12;
    for (const b of S.bands) if (b.conn) ctx.stroke(b.p);
    ctx.setLineDash([]);
    // 坡道明暗
    if (vb[2] > PD.r0 && vb[0] < PD.d1) {
      const g = ctx.createLinearGradient(PD.r0, 0, PD.d1, 0);
      g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop((PD.r1 - PD.r0) / (PD.d1 - PD.r0), 'rgba(255,255,255,.16)');
      g.addColorStop((PD.t1 - PD.r0) / (PD.d1 - PD.r0), 'rgba(255,255,255,.16)'); g.addColorStop((PD.t1 + 0.4 - PD.r0) / (PD.d1 - PD.r0), 'rgba(0,0,0,.16)'); g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g; ctx.fillRect(PD.r0, PD.y0 - 0.6, PD.d1 - PD.r0, PD.y1 - PD.y0 + 1.2);
      // 护墙（高出地面部分）
      for (const [y, s] of [[PD.y0 - 0.6, -1], [PD.y1, 1]]) {
        ctx.fillStyle = '#c9c5bb'; ctx.fillRect(PD.r0 + 1, y, PD.d1 - PD.r0 - 2, 0.6);
        ctx.fillStyle = 'rgba(0,0,0,.25)'; if (s > 0) ctx.fillRect(PD.r0 + 1, y + 0.6, PD.d1 - PD.r0 - 2, 0.5);
      }
      ctx.fillStyle = 'rgba(255,255,255,.55)';
      for (const [x, s] of [[51, '上坡 10%'], [73, '下坡']]) wtext(ctx, s, x, (PD.y0 + PD.y1) / 2, 0.9, PI / 2);
      ctx.strokeStyle = 'rgba(255,255,255,.4)'; ctx.lineWidth = 0.18;
      for (let x = 48; x < 63; x += 3) { ctx.beginPath(); ctx.moveTo(x, PD.y0 + 0.6); ctx.lineTo(x + 0.8, PD.y0 + 1.0); ctx.lineTo(x, PD.y0 + 1.4); ctx.stroke(); }
    }
    // 标线
    for (const { p, l } of S.lines) {
      if (l.bb[0] > vb[2] || l.bb[2] < vb[0] || l.bb[1] > vb[3] || l.bb[3] < vb[1]) continue;
      ctx.strokeStyle = l.col; ctx.lineWidth = l.w; ctx.lineJoin = 'miter'; ctx.setLineDash(l.dash || []); ctx.globalAlpha = 0.93; ctx.stroke(p);
    }
    ctx.setLineDash([]); ctx.globalAlpha = 1;
    // 地面文字
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = 'rgba(255,255,255,.72)'; for (const L of COURSE.labels) wtext(ctx, L.t, L.x, L.y, L.s);
    // 杆
    for (const [x, y] of COURSE.poles) {
      ctx.fillStyle = 'rgba(0,0,0,.3)'; ctx.beginPath(); ctx.ellipse(x + 0.35, y + 0.35, 0.16, 0.5, -0.7, 0, 2 * PI); ctx.fill();
      ctx.fillStyle = '#f5c518'; ctx.beginPath(); ctx.arc(x, y, 0.14, 0, 2 * PI); ctx.fill(); ctx.fillStyle = '#111'; ctx.beginPath(); ctx.arc(x, y, 0.14, 0, PI); ctx.fill();
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 0.03; ctx.beginPath(); ctx.arc(x, y, 0.14, 0, 2 * PI); ctx.stroke();
    }
    // 建筑
    for (const b of BLD) {
      if (b[0] > vb[2] || b[0] + b[2] < vb[0] || b[1] > vb[3] || b[1] + b[3] < vb[1]) continue;
      ctx.fillStyle = 'rgba(0,0,0,.28)'; ctx.fillRect(b[0] + 1.2, b[1] + 1.2, b[2], b[3]);
      const g = ctx.createLinearGradient(b[0], b[1], b[0], b[1] + b[3]); g.addColorStop(0, b[5]); g.addColorStop(1, b[6]);
      ctx.fillStyle = g; ctx.fillRect(b[0], b[1], b[2], b[3]);
      ctx.strokeStyle = 'rgba(0,0,0,.18)'; ctx.lineWidth = 0.15; ctx.strokeRect(b[0] + 0.4, b[1] + 0.4, b[2] - 0.8, b[3] - 0.8);
      if (!lite) {
        ctx.fillStyle = 'rgba(120,140,160,.35)'; for (let x = b[0] + 1.5; x < b[0] + b[2] - 1.5; x += 3) ctx.fillRect(x, b[1] + 1.2, 1.6, 1.0);
        ctx.fillStyle = '#334155'; wtext(ctx, b[4], b[0] + b[2] / 2, b[1] + b[3] * 0.62, 1.5);
      }
    }
    for (const p of PARKED) if (p[0] > vb[0] - 3 && p[0] < vb[2] + 3 && p[1] > vb[1] - 3 && p[1] < vb[3] + 3) drawCar(ctx, { x: p[0], y: p[1], th: p[2], delta: 0, gear: 'N', brk: 0, sig: 0, on: false, h: 0, trans: 'manual' }, 0, { color: p[3], lite: true, parked: true });
    // 灯杆
    for (const [x, y] of S.lamps) {
      if (x < vb[0] - 3 || x > vb[2] + 3 || y < vb[1] - 3 || y > vb[3] + 3) continue;
      ctx.strokeStyle = 'rgba(0,0,0,.25)'; ctx.lineWidth = 0.18; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + 3.2, y + 3.2); ctx.stroke();
      ctx.fillStyle = '#6b7280'; ctx.beginPath(); ctx.arc(x, y, 0.2, 0, 2 * PI); ctx.fill();
      ctx.fillStyle = '#d1d5db'; ctx.fillRect(x - 0.15, y - 1.1, 0.3, 1.1); ctx.fillStyle = '#fef9c3'; ctx.fillRect(x - 0.25, y - 1.5, 0.5, 0.45);
    }
    // 树
    for (const [x, y, r] of S.trees) {
      if (x + r < vb[0] - 2 || x - r > vb[2] + 2 || y + r < vb[1] - 2 || y - r > vb[3] + 2) continue;
      ctx.globalAlpha = 0.28; ctx.fillStyle = '#000'; ctx.beginPath(); ctx.arc(x + r * 0.45, y + r * 0.45, r * 0.95, 0, 2 * PI); ctx.fill(); ctx.globalAlpha = 1;
      ctx.drawImage(T.tree, x - r, y - r, 2 * r, 2 * r);
    }
    // 围栏
    const B = COURSE.bounds; ctx.strokeStyle = 'rgba(40,40,40,.55)'; ctx.lineWidth = 0.12; ctx.setLineDash([0.5, 0.3]); ctx.strokeRect(B[0] + 1, B[1] + 1, B[2] - B[0] - 2, B[3] - B[1] - 2); ctx.setLineDash([]);
  }

  /* ---------- 车辆绘制（局部坐标，单位米） ---------- */
  function rrect(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
  function drawCar(ctx, c, t, o = {}) {
    const W = CAR.W, hw = W / 2, x0 = -CAR.RO, len = CAR.L, sc = 1 + (c.h || 0) * 0.035, so = 0.22 + (c.h || 0) * 0.35;
    ctx.save(); ctx.translate(c.x, c.y); ctx.rotate(c.th);
    // 阴影
    ctx.fillStyle = 'rgba(0,0,0,.32)'; rrect(ctx, x0 + so * 0.6, -hw + so, len, W, 0.5); ctx.fill();
    if (!o.lite) { ctx.fillStyle = 'rgba(0,0,0,.12)'; rrect(ctx, x0 + so * 0.6 - 0.15, -hw + so - 0.15, len + 0.3, W + 0.3, 0.6); ctx.fill(); }
    ctx.scale(sc, sc);
    const blink = c.sig && (t % 0.8) < 0.42;
    // 车轮（略露出）
    const wl = CAR.TL, ww = CAR.TW;
    const wheelsL = [[CAR.WB, -CAR.TR / 2, 1], [CAR.WB, CAR.TR / 2, 1], [0, -CAR.TR / 2, 0], [0, CAR.TR / 2, 0]];
    const dd = c.delta || 0, ti = CAR.TR / 2, aL = Math.abs(dd) < 1e-5 ? 0 : Math.atan(CAR.WB / (CAR.WB / Math.tan(dd) + ti)), aR = Math.abs(dd) < 1e-5 ? 0 : Math.atan(CAR.WB / (CAR.WB / Math.tan(dd) - ti));
    const drawWheel = (lx, ly, a) => { ctx.save(); ctx.translate(lx, ly); ctx.rotate(a); ctx.fillStyle = '#16181b'; rrect(ctx, -wl / 2, -ww / 2, wl, ww, 0.06); ctx.fill(); if (!o.lite) { ctx.fillStyle = '#3a3f46'; ctx.fillRect(-wl / 2 + 0.06, -ww / 2 + 0.03, wl - 0.12, 0.035); ctx.fillRect(-wl / 2 + 0.06, ww / 2 - 0.065, wl - 0.12, 0.035); } ctx.restore(); };
    const drawWheels = () => wheelsL.forEach(([lx, ly, f], i) => drawWheel(lx, ly * 1.04, f ? (i === 0 ? aL : aR) : 0));
    drawWheels();
    // 车身
    const col = o.color || '#fbfbfc';
    const g = ctx.createLinearGradient(0, -hw, 0, hw); g.addColorStop(0, '#cfd4da'); g.addColorStop(0.12, col); g.addColorStop(0.88, col); g.addColorStop(1, '#bfc5cc');
    ctx.fillStyle = g; rrect(ctx, x0, -hw, len, W, 0.42); ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,.35)'; ctx.lineWidth = 0.03; ctx.stroke();
    const xf = x0 + len;
    // 保险杠
    ctx.fillStyle = '#9aa1a9'; rrect(ctx, xf - 0.1, -hw + 0.2, 0.1, W - 0.4, 0.05); ctx.fill(); rrect(ctx, x0, -hw + 0.2, 0.1, W - 0.4, 0.05); ctx.fill();
    // 驾校蓝色腰线
    if (!o.parked || o.color === '#fff') { ctx.fillStyle = '#1d5fd6'; ctx.fillRect(x0 + 0.35, -hw + 0.02, len - 0.7, 0.07); ctx.fillRect(x0 + 0.35, hw - 0.09, len - 0.7, 0.07); }
    // 前挡、后挡、车窗
    ctx.fillStyle = '#1f2a37';
    ctx.beginPath(); ctx.moveTo(1.95, -0.72); ctx.lineTo(2.62, -0.8); ctx.quadraticCurveTo(2.72, 0, 2.62, 0.8); ctx.lineTo(1.95, 0.72); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(0.18, -0.7); ctx.lineTo(-0.38, -0.76); ctx.quadraticCurveTo(-0.46, 0, -0.38, 0.76); ctx.lineTo(0.18, 0.7); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#2b3a4b'; ctx.fillRect(0.25, -0.86, 1.65, 0.1); ctx.fillRect(0.25, 0.76, 1.65, 0.1);
    if (!o.lite) {
      const gl = ctx.createLinearGradient(1.95, 0, 2.7, 0); gl.addColorStop(0, 'rgba(255,255,255,.04)'); gl.addColorStop(1, 'rgba(255,255,255,.2)');
      ctx.fillStyle = gl; ctx.beginPath(); ctx.moveTo(2.05, -0.6); ctx.lineTo(2.55, -0.66); ctx.lineTo(2.5, -0.2); ctx.lineTo(2.05, -0.15); ctx.fill();
      // 车顶
      const gr = ctx.createLinearGradient(0, -0.7, 0, 0.7); gr.addColorStop(0, '#e9ecef'); gr.addColorStop(0.5, '#ffffff'); gr.addColorStop(1, '#e2e6ea');
      ctx.fillStyle = gr; rrect(ctx, 0.2, -0.72, 1.75, 1.44, 0.18); ctx.fill();
      // 引擎盖线
      ctx.strokeStyle = 'rgba(0,0,0,.12)'; ctx.lineWidth = 0.025; ctx.beginPath(); ctx.moveTo(2.75, -0.55); ctx.quadraticCurveTo(3.2, -0.5, xf - 0.15, -0.45); ctx.moveTo(2.75, 0.55); ctx.quadraticCurveTo(3.2, 0.5, xf - 0.15, 0.45); ctx.stroke();
      // 车牌
      ctx.fillStyle = o.parked ? '#1d4ed8' : '#facc15'; ctx.fillRect(xf - 0.05, -0.22, 0.04, 0.44); ctx.fillRect(x0 + 0.01, -0.22, 0.04, 0.44);
    }
    if (!o.parked) { ctx.globalAlpha = 0.5; drawWheels(); ctx.globalAlpha = 1; } // 透视显示车轮转角
    // 后视镜
    ctx.fillStyle = col; ctx.strokeStyle = 'rgba(0,0,0,.35)'; ctx.lineWidth = 0.02;
    for (const s of [-1, 1]) { ctx.beginPath(); ctx.ellipse(1.95, s * (hw + 0.1), 0.09, 0.15, 0, 0, 2 * PI); ctx.fill(); ctx.stroke(); }
    // 顶灯牌
    if (!o.parked) {
      ctx.fillStyle = '#1554c9'; rrect(ctx, 0.75, -0.42, 0.42, 0.84, 0.08); ctx.fill();
      ctx.fillStyle = '#fff'; wtext(ctx, o.coach ? '教练车' : '考试车', 0.96, 0, 0.22, PI / 2);
    }
    // 灯光
    const light = (x, y, w, h, col, glow, gr) => { ctx.fillStyle = col; rrect(ctx, x - w / 2, y - h / 2, w, h, Math.min(w, h) / 2.2); ctx.fill(); if (glow && !o.lite) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; const rg = ctx.createRadialGradient(x, y, 0, x, y, gr); rg.addColorStop(0, glow); rg.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = rg; ctx.fillRect(x - gr, y - gr, 2 * gr, 2 * gr); ctx.restore(); } };
    for (const s of [-1, 1]) {
      light(xf - 0.12, s * 0.64, 0.12, 0.36, c.on ? '#fffbe6' : '#e5e7eb', c.on && !o.parked ? 'rgba(255,250,210,.35)' : null, 0.5);
      const br = c.brk > 0.05 && c.on;
      light(x0 + 0.1, s * 0.66, 0.1, 0.34, br ? '#ff2a2a' : '#b91c1c', br ? 'rgba(255,40,40,.75)' : (c.on ? 'rgba(255,40,40,.15)' : null), br ? 0.75 : 0.35);
      if (c.gear === 'R' && c.on) light(x0 + 0.1, s * 0.4, 0.08, 0.14, '#ffffff', 'rgba(255,255,255,.6)', 0.6);
      const on = blink && c.sig === s;
      light(xf - 0.16, s * 0.84, 0.14, 0.1, on ? '#ffb020' : '#d6a35b', on ? 'rgba(255,170,20,.9)' : null, 0.6);
      light(x0 + 0.14, s * 0.84, 0.14, 0.1, on ? '#ffb020' : '#c2410c', on ? 'rgba(255,170,20,.9)' : null, 0.6);
      if (on) light(1.95, s * (hw + 0.12), 0.08, 0.06, '#ffb020', 'rgba(255,170,20,.7)', 0.35);
    }
    ctx.restore();
  }
  /* ---------- 后视镜（透视近似：俯视截图按深度分条重投影） ---------- */
  const MIRROR = {
    l: { mx: 1.95, my: -1.0, h: 1.05, umin: -0.72, umax: 0.045, vtop: 0.07, vbot: -1.05 / 4.6, dmax: 19, side: -1 },
    r: { mx: 1.95, my: 1.0, h: 1.05, umin: -0.045, umax: 0.72, vtop: 0.07, vbot: -1.05 / 4.6, dmax: 19, side: 1 },
    i: { mx: 1.4, my: 0, h: 1.25, umin: -0.32, umax: 0.32, vtop: 0.08, vbot: -0.2, dmax: 34, side: 0 }
  };
  function makeMirror(kind) {
    const cv = document.createElement('canvas'), off = document.createElement('canvas');
    off.width = 384; off.height = 192;
    return { kind, spec: MIRROR[kind], cv, ctx: cv.getContext('2d'), off, octx: off.getContext('2d') };
  }
  function renderMirror(m, car, t, extra) {
    const s = m.spec, MW = m.cv.width, MH = m.cv.height; if (!MW || !MH) return;
    const d0 = s.h / -s.vbot, lmin = s.umin * s.dmax, lmax = s.umax * s.dmax, OW = m.off.width, OH = m.off.height;
    const sx = OW / (lmax - lmin), sy = OH / (s.dmax - d0), co = Math.cos(car.th), si = Math.sin(car.th), o = m.octx;
    o.setTransform(1, 0, 0, 1, 0, 0); o.fillStyle = '#5b8a3c'; o.fillRect(0, 0, OW, OH);
    o.setTransform(-sx * si, -sy * co, sx * co, -sy * si, sx * (si * car.x - co * car.y - s.my - lmin), sy * (co * car.x + si * car.y + s.mx - d0));
    const cs = [[s.mx - d0, s.my + s.umin * d0], [s.mx - s.dmax, s.my + lmin], [s.mx - s.dmax, s.my + lmax], [s.mx - d0, s.my + s.umax * d0]].map(p => toW(car, p[0], p[1]));
    const vb = [Math.min(...cs.map(p => p[0])) - 2, Math.min(...cs.map(p => p[1])) - 2, Math.max(...cs.map(p => p[0])) + 2, Math.max(...cs.map(p => p[1])) + 2];
    drawWorld(o, vb, true, t);
    if (extra) extra(o);
    const g = m.ctx; g.setTransform(1, 0, 0, 1, 0, 0);
    const hr = s.vtop / (s.vtop - s.vbot) * MH;
    const sky = g.createLinearGradient(0, 0, 0, hr); sky.addColorStop(0, '#8fbfe8'); sky.addColorStop(1, '#dcebf5');
    g.fillStyle = sky; g.fillRect(0, 0, MW, hr + 1);
    // 远处树林剪影
    g.fillStyle = '#4b6b3c'; g.beginPath(); g.moveTo(0, hr + 1);
    const R = rng(m.kind.charCodeAt(0) + Math.round(car.th * 6));
    for (let x = 0; x <= MW; x += MW / 18) g.lineTo(x, hr - (0.15 + R() * 0.35) * hr * 0.6);
    g.lineTo(MW, hr + 1); g.closePath(); g.fill();
    const bh = Math.max(2, Math.round(MH / 48));
    for (let r = Math.floor(hr); r < MH; r += bh) {
      const va = s.vtop - r / MH * (s.vtop - s.vbot), vb2 = s.vtop - Math.min(MH, r + bh) / MH * (s.vtop - s.vbot);
      if (va >= -1e-4) continue;
      const da = s.h / -va, db = s.h / -vb2, dm = (da + db) / 2;
      if (db > s.dmax) { g.fillStyle = '#8aa77a'; g.fillRect(0, r, MW, bh); continue; }
      const sy0 = (db - d0) * sy, sh = Math.max(0.6, (Math.min(da, s.dmax) - db) * sy);
      g.drawImage(m.off, (s.umin * dm - lmin) * sx, sy0, (s.umax - s.umin) * dm * sx, sh, 0, r, MW, bh);
    }
    const fog = g.createLinearGradient(0, hr, 0, hr + MH * 0.35); fog.addColorStop(0, 'rgba(210,225,235,.75)'); fog.addColorStop(1, 'rgba(210,225,235,0)');
    g.fillStyle = fog; g.fillRect(0, hr, MW, MH * 0.35);
    if (s.side) { // 自车车身
      const inner = s.side > 0 ? 0 : MW, wB = MW * 0.11, wT = MW * 0.05, dir = s.side > 0 ? 1 : -1;
      const gr = g.createLinearGradient(inner, 0, inner + dir * wB, 0); gr.addColorStop(0, '#9aa3ad'); gr.addColorStop(0.7, '#e9edf1'); gr.addColorStop(1, '#c3cad2');
      g.fillStyle = gr; g.beginPath(); g.moveTo(inner, MH * 0.05); g.lineTo(inner + dir * wT, MH * 0.05); g.lineTo(inner + dir * wT * 1.1, hr + 2); g.lineTo(inner + dir * wB, MH); g.lineTo(inner, MH); g.closePath(); g.fill();
      g.fillStyle = '#1d5fd6'; g.beginPath(); g.moveTo(inner, MH * 0.7); g.lineTo(inner + dir * wB * 0.92, MH * 0.72); g.lineTo(inner + dir * wB * 0.94, MH * 0.78); g.lineTo(inner, MH * 0.77); g.fill();
      g.fillStyle = 'rgba(40,50,60,.6)'; g.fillRect(inner + dir * wB * 0.35 - (dir < 0 ? wB * 0.3 : 0), MH * 0.52, wB * 0.3, MH * 0.05);
    } else { // 车内：后挡风窗框 + 后备箱
      const tr = hr + (MH - hr) * 0.62;
      g.fillStyle = '#e8ebee'; g.beginPath(); g.moveTo(0, MH); g.lineTo(MW * 0.12, tr); g.quadraticCurveTo(MW / 2, tr - MH * 0.06, MW * 0.88, tr); g.lineTo(MW, MH); g.fill();
      g.fillStyle = '#1b1e22'; g.fillRect(0, MH * 0.86, MW, MH * 0.14);
      for (const x of [0.3, 0.7]) { g.fillStyle = '#2a2e33'; rrect(g, MW * x - MW * 0.07, MH * 0.62, MW * 0.14, MH * 0.32, MW * 0.03); g.fill(); }
      g.fillStyle = '#15181c'; g.beginPath(); g.moveTo(0, 0); g.lineTo(MW * 0.1, 0); g.lineTo(MW * 0.02, MH); g.lineTo(0, MH); g.fill();
      g.beginPath(); g.moveTo(MW, 0); g.lineTo(MW * 0.9, 0); g.lineTo(MW * 0.98, MH); g.lineTo(MW, MH); g.fill();
      g.fillRect(0, 0, MW, MH * 0.06);
    }
    const vg = g.createRadialGradient(MW / 2, MH / 2, MH * 0.3, MW / 2, MH / 2, MW * 0.65); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,.28)');
    g.fillStyle = vg; g.fillRect(0, 0, MW, MH);
    g.fillStyle = 'rgba(255,255,255,.08)'; g.beginPath(); g.moveTo(0, 0); g.lineTo(MW * 0.45, 0); g.lineTo(MW * 0.25, MH); g.lineTo(0, MH); g.fill();
  }

  /* ---------- 仪表盘 ---------- */
  function drawCluster(g, W, H, c, t, extra) {
    g.clearRect(0, 0, W, H);
    const r = H * 0.46, cy = H * 0.52;
    const gauge = (cx, val, max, step, label, unit, red) => {
      g.save(); g.translate(cx, cy);
      g.fillStyle = 'rgba(0,0,0,.35)'; g.beginPath(); g.arc(0, 0, r, 0, 2 * PI); g.fill();
      g.strokeStyle = 'rgba(255,255,255,.18)'; g.lineWidth = r * 0.04; g.beginPath(); g.arc(0, 0, r * 0.97, 0, 2 * PI); g.stroke();
      const a0 = PI * 0.75, a1 = PI * 2.25, A = v => a0 + (a1 - a0) * clamp(v / max, 0, 1);
      if (red) { g.strokeStyle = 'rgba(239,68,68,.9)'; g.lineWidth = r * 0.09; g.beginPath(); g.arc(0, 0, r * 0.82, A(red), a1); g.stroke(); }
      g.strokeStyle = 'rgba(56,189,248,.85)'; g.lineWidth = r * 0.09; g.beginPath(); g.arc(0, 0, r * 0.82, a0, A(val)); g.stroke();
      g.fillStyle = '#fff'; g.font = `600 ${r * 0.19}px sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
      for (let v = 0; v <= max + 1e-6; v += step) { const a = A(v); g.globalAlpha = 0.85; g.fillText(label(v), Math.cos(a) * r * 0.58, Math.sin(a) * r * 0.58); g.fillRect(Math.cos(a) * r * 0.74 - 1, Math.sin(a) * r * 0.74 - 1, 2, 2); }
      g.globalAlpha = 1;
      const a = A(val); g.strokeStyle = '#ff4d4f'; g.lineWidth = r * 0.06; g.lineCap = 'round'; g.beginPath(); g.moveTo(-Math.cos(a) * r * 0.12, -Math.sin(a) * r * 0.12); g.lineTo(Math.cos(a) * r * 0.84, Math.sin(a) * r * 0.84); g.stroke();
      g.fillStyle = '#222'; g.beginPath(); g.arc(0, 0, r * 0.1, 0, 2 * PI); g.fill();
      g.fillStyle = 'rgba(255,255,255,.65)'; g.font = `${r * 0.15}px sans-serif`; g.fillText(unit, 0, r * 0.5);
      g.restore();
    };
    const kmh = Math.abs(c.v) * 3.6, rpm = c.we * W2RPM;
    gauge(r + 2, kmh, 40, 10, v => v, 'km/h');
    gauge(W - r - 2, rpm / 1000, 7, 1, v => v, '×1000rpm', 6);
    const mx = W / 2, cw = W - 4 * r - 8;
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillStyle = '#fff'; g.font = `800 ${H * 0.3}px ui-monospace,monospace`; g.fillText(c.gear, mx, H * 0.36);
    g.font = `700 ${H * 0.15}px sans-serif`; g.fillStyle = 'rgba(255,255,255,.85)'; g.fillText(kmh.toFixed(1) + ' km/h', mx, H * 0.58);
    // 踏板条
    const bars = c.trans === 'manual' ? [['C', c.clu, '#5aa0ff'], ['B', c.brk, '#ff5a5a'], ['T', c.thr, '#3cdc78']] : [['B', c.brk, '#ff5a5a'], ['T', c.thr, '#3cdc78']];
    const bw = Math.min(cw / bars.length - 6, 18), bh = H * 0.2, by = H * 0.68;
    bars.forEach(([n, v, col], i) => {
      const x = mx + (i - (bars.length - 1) / 2) * (bw + 6) - bw / 2;
      g.fillStyle = 'rgba(255,255,255,.12)'; g.fillRect(x, by, bw, bh);
      if (n === 'C') { g.fillStyle = 'rgba(250,204,21,.25)'; g.fillRect(x, by + bh * (1 - 0.8), bw, bh * 0.4); }
      g.fillStyle = col; g.fillRect(x, by + bh * (1 - v), bw, bh * v);
      g.fillStyle = 'rgba(255,255,255,.7)'; g.font = `${H * 0.1}px sans-serif`; g.fillText(n, x + bw / 2, by + bh + H * 0.07);
    });
    // 指示灯
    const blink = (t % 0.8) < 0.42, ic = H * 0.12;
    const lamp = (x, y, on, col, draw) => { g.save(); g.translate(x, y); g.globalAlpha = on ? 1 : 0.16; g.fillStyle = g.strokeStyle = on ? col : '#aaa'; draw(); g.restore(); };
    const arr = d => () => { g.beginPath(); g.moveTo(-d * ic, 0); g.lineTo(0, -ic * 0.8); g.lineTo(0, -ic * 0.35); g.lineTo(d * ic, -ic * 0.35); g.lineTo(d * ic, ic * 0.35); g.lineTo(0, ic * 0.35); g.lineTo(0, ic * 0.8); g.closePath(); g.fill(); };
    lamp(mx - Math.max(cw * 0.4, ic * 2.4), H * 0.36, c.sig === -1 && blink, '#22c55e', arr(-1));
    lamp(mx + Math.max(cw * 0.4, ic * 2.4), H * 0.36, c.sig === 1 && blink, '#22c55e', arr(1));
    const txt = (s) => () => { g.font = `800 ${ic * 1.15}px sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(s, 0, 0); };
    lamp(mx - ic * 2.2, H * 0.1, c.hb, '#ef4444', () => { g.lineWidth = 1.5; g.beginPath(); g.arc(0, 0, ic * 0.8, 0, 2 * PI); g.stroke(); txt('P')(); });
    lamp(mx, H * 0.1, !c.belt, '#ef4444', txt('安'));
    lamp(mx + ic * 2.2, H * 0.1, !c.on, '#f59e0b', () => { g.lineWidth = 1.5; g.strokeRect(-ic * 0.8, -ic * 0.55, ic * 1.6, ic * 1.1); g.fillRect(-ic * 0.3, -ic * 0.8, ic * 0.6, ic * 0.25); });
    
    if (extra && extra.stalled) { g.fillStyle = '#f59e0b'; g.font = `800 ${H * 0.13}px sans-serif`; g.fillText('熄火', mx, H * 0.22); }
  }

  /* ---------- 引擎声（WebAudio 合成） ---------- */
  function makeAudio() {
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return null;
    let ac; try { ac = new AC(); } catch (e) { return null; }
    const master = ac.createGain(); master.gain.value = 0; master.connect(ac.destination);
    const eg = ac.createGain(); eg.gain.value = 0; eg.connect(master);
    const f = ac.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 400; f.Q.value = 3; f.connect(eg);
    const o1 = ac.createOscillator(), o2 = ac.createOscillator(), g1 = ac.createGain(), g2 = ac.createGain();
    o1.type = 'sawtooth'; o2.type = 'square'; g1.gain.value = 0.55; g2.gain.value = 0.18;
    o1.connect(g1); g1.connect(f); o2.connect(g2); g2.connect(f);
    const nb = ac.createBuffer(1, ac.sampleRate, ac.sampleRate), nd = nb.getChannelData(0); for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
    const ns = ac.createBufferSource(); ns.buffer = nb; ns.loop = true; const nf = ac.createBiquadFilter(); nf.type = 'bandpass'; nf.frequency.value = 140; nf.Q.value = 0.8; const ng = ac.createGain(); ng.gain.value = 0.35;
    ns.connect(nf); nf.connect(ng); ng.connect(f);
    const hg = ac.createGain(); hg.gain.value = 0; hg.connect(master); const h1 = ac.createOscillator(), h2 = ac.createOscillator(); h1.type = h2.type = 'square'; h1.frequency.value = 415; h2.frequency.value = 520; h1.connect(hg); h2.connect(hg);
    [o1, o2, ns, h1, h2].forEach(o => o.start());
    const A = {
      ac, vol: 0,
      setMute(m) { master.gain.setTargetAtTime(m ? 0 : 0.9, ac.currentTime, 0.05); },
      update(rpm, load, on) {
        const fr = Math.max(8, rpm / 60 * 2); const tt = ac.currentTime;
        o1.frequency.setTargetAtTime(fr, tt, 0.03); o2.frequency.setTargetAtTime(fr * 2, tt, 0.03); nf.frequency.setTargetAtTime(80 + fr * 3, tt, 0.05);
        f.frequency.setTargetAtTime(160 + rpm * 0.22 + load * 700, tt, 0.05);
        eg.gain.setTargetAtTime(on || rpm > 100 ? Math.min(0.32, 0.07 + load * 0.12 + rpm / 7000 * 0.14) * (on ? 1 : rpm / 900) : 0, tt, 0.06);
      },
      horn(on) { hg.gain.setTargetAtTime(on ? 0.07 : 0, ac.currentTime, 0.01); },
      blip(type) {
        const t0 = ac.currentTime, o = ac.createOscillator(), g = ac.createGain(); o.connect(g); g.connect(master);
        const P = { tick: [2400, 0.012, 'square', 0.05], tock: [1700, 0.012, 'square', 0.045], clunk: [90, 0.14, 'triangle', 0.35], grind: [180, 0.25, 'sawtooth', 0.12], click: [1200, 0.03, 'square', 0.06], chime: [880, 0.25, 'sine', 0.12], crank: [55, 0.7, 'sawtooth', 0.12], ratchet: [600, 0.08, 'square', 0.05] }[type] || [800, 0.05, 'sine', 0.05];
        o.type = P[2]; o.frequency.setValueAtTime(P[0], t0); if (type === 'clunk' || type === 'crank') o.frequency.exponentialRampToValueAtTime(P[0] * (type === 'crank' ? 1.6 : 0.5), t0 + P[1]);
        g.gain.setValueAtTime(P[3], t0); g.gain.exponentialRampToValueAtTime(0.0001, t0 + P[1]); o.start(t0); o.stop(t0 + P[1] + 0.05);
      },
      resume() { if (ac.state === 'suspended') ac.resume().catch(() => {}); },
      close() { try { [o1, o2, ns, h1, h2].forEach(o => o.stop()); ac.close(); } catch (e) {} }
    };
    return A;
  }
  /* ---------- SVG 部件 ---------- */
  function wheelSVG() {
    return `<svg viewBox="-100 -100 200 200"><defs>
      <radialGradient id="s2rim" cx="50%" cy="40%" r="60%"><stop offset="0" stop-color="#555b63"/><stop offset=".8" stop-color="#22262b"/><stop offset="1" stop-color="#121417"/></radialGradient>
      <linearGradient id="s2hub" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3b4048"/><stop offset="1" stop-color="#181b1f"/></linearGradient></defs>
      <g class="s2-wg">
      <circle r="92" fill="none" stroke="url(#s2rim)" stroke-width="15"/>
      <circle r="92" fill="none" stroke="rgba(255,255,255,.1)" stroke-width="1.5" stroke-dasharray="2 4"/>
      <path d="M-84 6 Q-50 18 -26 14 L26 14 Q50 18 84 6 L84 -2 Q50 6 26 -6 L-26 -6 Q-50 6 -84 -2Z" fill="url(#s2hub)" stroke="#0b0c0e" stroke-width="1"/>
      <path d="M-14 14 L-10 84 L10 84 L14 14Z" fill="url(#s2hub)" stroke="#0b0c0e" stroke-width="1"/>
      <circle r="30" fill="url(#s2hub)" stroke="#0b0c0e" stroke-width="1.5"/>
      <circle r="22" fill="none" stroke="rgba(255,255,255,.12)" stroke-width="1"/>
      <text y="7" text-anchor="middle" font-size="20" font-weight="800" fill="#d6dbe1">驾</text>
      <rect x="-5" y="-100" width="10" height="16" rx="2" fill="#f5c518"/>
      </g></svg><div class="s2-wa">0°</div>`;
  }
  const GPOS_M = { R: [18, 16], 1: [50, 16], 2: [50, 76], 3: [82, 16], N: [50, 46] };
  const GPOS_A = { P: [50, 12], R: [50, 33], N: [50, 54], D: [50, 75] };
  function gearSVG(manual) {
    if (manual) return `<svg viewBox="0 0 100 92"><rect x="2" y="2" width="96" height="88" rx="14" fill="rgba(0,0,0,.25)"/>
      <path d="M18 16V46H82V16M50 16V76M82 46V76" fill="none" stroke="rgba(255,255,255,.35)" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>
      ${['R', '1', '2', '3'].map(g => `<text x="${GPOS_M[g][0]}" y="${GPOS_M[g][1] + (g === '2' ? 13 : -4)}" text-anchor="middle" font-size="12" font-weight="800" fill="#fff" opacity=".9">${g}</text>`).join('')}
      <text x="82" y="89" text-anchor="middle" font-size="9" fill="#fff" opacity=".3">4</text><text x="64" y="58" text-anchor="middle" font-size="9" fill="#fff" opacity=".6">N</text>
      <circle class="s2-knob" r="9" fill="#f5f6f8" stroke="#1677ff" stroke-width="3"/></svg>`;
    return `<svg viewBox="0 0 100 92"><rect x="22" y="2" width="56" height="88" rx="14" fill="rgba(0,0,0,.25)"/>
      <path d="M50 12V75" stroke="rgba(255,255,255,.3)" stroke-width="5" stroke-linecap="round"/>
      ${Object.keys(GPOS_A).map(g => `<text x="${GPOS_A[g][0] + 18}" y="${GPOS_A[g][1] + 4}" text-anchor="middle" font-size="13" font-weight="800" fill="#fff" class="s2-gl" data-g="${g}">${g}</text>`).join('')}
      <circle class="s2-knob" r="9" fill="#f5f6f8" stroke="#1677ff" stroke-width="3"/></svg>`;
  }
  const SVGI = {
    pause: '<svg viewBox="0 0 24 24"><path d="M8 5v14M16 5v14" stroke="currentColor" stroke-width="3" stroke-linecap="round"/></svg>',
    view: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" stroke-width="2"/><path d="M12 4l3 6h-6z" fill="currentColor"/></svg>',
    assist: '<svg viewBox="0 0 24 24"><path d="M4 20C6 12 10 8 20 6" fill="none" stroke="currentColor" stroke-width="2" stroke-dasharray="3 2"/><circle cx="20" cy="6" r="2" fill="currentColor"/></svg>',
    l: '<svg viewBox="0 0 24 24"><path d="M3 12l8-7v4h10v6H11v4z" fill="currentColor"/></svg>',
    r: '<svg viewBox="0 0 24 24"><path d="M21 12l-8-7v4H3v6h10v4z" fill="currentColor"/></svg>',
    hb: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" stroke-width="2"/><text x="12" y="16.5" text-anchor="middle" font-size="12" font-weight="800" fill="currentColor">P</text></svg>',
    horn: '<svg viewBox="0 0 24 24"><path d="M3 10v4h4l6 5V5L7 10z" fill="currentColor"/><path d="M16 8c2 2 2 6 0 8M19 5c4 4 4 10 0 14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
    belt: '<svg viewBox="0 0 24 24"><circle cx="12" cy="5" r="2.5" fill="currentColor"/><path d="M8 21V11a4 4 0 0 1 8 0v10M7 9l10 10" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>',
    key: '<svg viewBox="0 0 24 24"><circle cx="8" cy="12" r="4" fill="none" stroke="currentColor" stroke-width="2.2"/><path d="M12 12h9M18 12v3M21 12v2" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>'
  };

  /* ---------- 模拟器 ---------- */
  function sim(el, item, query) {
    if (!(item in ITEMS) && item !== 'exam' && item !== 'free') { App.go('#/k2'); return () => {}; }
    const mode = item === 'free' ? 'practice' : (query.mode === 'exam' || item === 'exam') ? 'exam' : 'practice';
    const trans = query.gear === 'auto' || query.gear === 'manual' ? query.gear : (App.settings.trans === 'auto' ? 'auto' : 'manual');
    const demo = query.demo === '1' && item in ITEMS;
    const opts = Object.assign({ view: 'follow', assist: true, autoCenter: false, mute: false, easyClutch: true, mirrors: true, kh: false }, ST.get('opts', {}));
    const saveOpts = () => ST.set('opts', opts);
    const manual = trans === 'manual';
    App.setTitle(item === 'exam' ? '科目二 · 全真模拟考试' : item === 'free' ? '科目二 · 自由练习' : '科目二 · ' + ITEMS[item].name);
    App.immersive(true);
    let S = createSession({ mode, item, trans, demo });
    if (query.debug) window.__s2 = () => S;
    const assistOn = () => opts.assist && !(mode === 'exam' && !opts.assistInExam);

    el.innerHTML = `<div class="s2-sim">
      <canvas class="s2-cv"></canvas>
      <div class="s2-mirs"><div class="s2-mir side l"><b>左后视镜</b></div><div class="s2-mir in"><b>车内后视镜</b></div><div class="s2-mir side r"><b>右后视镜</b></div></div>
      <div class="s2-info s2-g"><div class="s2-pn"></div><div class="s2-sc"></div><div class="s2-log"></div></div>
      <div class="s2-tip s2-g"></div>
      <div class="s2-tr"><button class="s2-b s2-g" data-a="pause">${SVGI.pause}暂停</button><button class="s2-b s2-g" data-a="view">${SVGI.view}<span>视角</span></button><button class="s2-b s2-g" data-a="assist">${SVGI.assist}辅助</button></div>
      <div class="s2-dash s2-g"><canvas></canvas></div>
      <div class="s2-wheel">${wheelSVG()}</div>
      <div class="s2-btns">
        <button class="s2-b s2-g amb" data-a="sigL">${SVGI.l}左灯</button><button class="s2-b s2-g amb" data-a="sigR">${SVGI.r}右灯</button><button class="s2-b s2-g red" data-a="hb">${SVGI.hb}手刹</button>
        <button class="s2-b s2-g" data-a="horn">${SVGI.horn}喇叭</button><button class="s2-b s2-g grn" data-a="belt">${SVGI.belt}安全带</button><button class="s2-b s2-g grn" data-a="key">${SVGI.key}点火</button>
      </div>
      <div class="s2-gear s2-g">${gearSVG(manual)}</div>
      <div class="s2-peds">${manual ? '<div class="s2-ped s2-g clu" data-p="clu"><div class="s2-pr"></div><em>半联动</em><i></i><span>离合</span></div>' : ''}<div class="s2-ped s2-g brk" data-p="brk"><div class="s2-pr"></div><i></i><span>刹车</span></div><div class="s2-ped s2-g thr" data-p="thr"><div class="s2-pr"></div><i></i><span>油门</span></div></div>
      <div class="s2-banner"></div>
    </div>`;
    const root = el.firstElementChild, $ = s => root.querySelector(s), $$ = s => [...root.querySelectorAll(s)];
    const cv = $('.s2-cv'), ctx = cv.getContext('2d');
    const dashCv = $('.s2-dash canvas'), dctx = dashCv.getContext('2d');
    const mirrors = ['l', 'i', 'r'].map(k => { const m = makeMirror(k); root.querySelector('.s2-mir.' + (k === 'i' ? 'in' : k)).prepend(m.cv); return m; });
    const wheelEl = $('.s2-wheel'), wheelSvg = wheelEl.querySelector('svg'), wheelTxt = wheelEl.querySelector('.s2-wa');
    const knob = $('.s2-knob'), banner = $('.s2-banner'), tipEl = $('.s2-tip');
    const pedEls = {}; $$('.s2-ped').forEach(p => pedEls[p.dataset.p] = p);
    let maxDpr = 2, perf = { t: 0, n: 0 }, W = 0, H = 0, dpr = 1, U = 1, portrait = false, raf = 0, last = 0, acc = 0, frameN = 0, paused = false, overlay = null, started = mode !== 'exam' || item === 'free';
    let audio = null, crankT = 0, timers = [], hudT = 0, bannerT = 0, lastBlink = false, khEl = null, stalledT = -9;
    const cam = { x: S.car.x, y: S.car.y, rot: S.car.th + PI / 2, ppm: 30, zoom: 1, look: 0 };
    const keys = {}, touch = { clu: null, brk: null, thr: null }, inp = { swT: 0, hold: 0, wheelDrag: null, pinch: null, ptrs: new Map() };
    const tracks = [[], []]; let trackOdo = 0;
    const ui = { lastPn: '', lastSc: '', lastLog: -1, lastTip: null };

    const baseP = () => clamp(Math.min(W, H) / (portrait ? 15 : 16), 16, 40);
    /* 布局 */
    function layout() {
      const r = root.getBoundingClientRect(); W = Math.max(1, r.width); H = Math.max(1, r.height); dpr = Math.min(maxDpr, window.devicePixelRatio || 1);
      portrait = H > W * 1.05;
      U = portrait ? clamp(W / 390, 0.82, 1.4) : clamp(Math.min(H / 390, W / 760), 0.8, 1.45);
      root.style.setProperty('--u', U + 'px'); root.classList.toggle('port', portrait);
      cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
      const u = U, set = (e, o) => { e.style.cssText = ''; Object.assign(e.style, o); };
      const ws = portrait ? Math.min(W * 0.44, 180 * u) : Math.min(H * 0.42, 176 * u);
      const ph = portrait ? Math.min(H * 0.17, 140 * u) : Math.min(H * 0.33, 130 * u);
      const pw = 54 * u;
      // 后视镜
      const sideW = portrait ? Math.min((W - 40 * u) * 0.31, 128 * u) : 138 * u, sideH = sideW * 0.44, inW = portrait ? Math.min((W - 40 * u) * 0.36, 140 * u) : 158 * u, inH = inW * 0.3;
      mirrors.forEach(m => { const w = m.kind === 'i' ? inW : sideW, h = m.kind === 'i' ? inH : sideH; m.cv.style.width = w + 'px'; m.cv.style.height = h + 'px'; m.cv.width = Math.round(w * dpr); m.cv.height = Math.round(h * dpr); });
      $('.s2-mirs').style.display = opts.mirrors ? '' : 'none';
      set(wheelEl, { width: ws + 'px', height: ws + 'px', left: (12 * u) + 'px', bottom: (22 * u) + 'px' });
      Object.values(pedEls).forEach(p => p.style.height = (p.dataset.p === 'thr' ? ph * 1.05 : ph) + 'px');
      Object.values(pedEls).forEach(p => p.style.width = (p.dataset.p === 'thr' ? pw * 0.82 : pw) + 'px');
      const em = pedEls.clu && pedEls.clu.querySelector('em'); if (em) { em.style.top = (0.4 * 100) + '%'; em.style.height = '40%'; }
      const pedsW = (manual ? 2.82 : 1.82) * pw + (manual ? 16 : 8) * u;
      set($('.s2-peds'), { right: (12 * u) + 'px', bottom: (12 * u) + 'px' });
      const gw = 104 * u, gh = 96 * u;
      const btns = $('.s2-btns'), dash = $('.s2-dash'), tr = $('.s2-tr'), info = $('.s2-info');
      const dw = portrait ? Math.min(W * 0.5, 200 * u) : 226 * u, dh = dw * 0.4;
      dashCv.style.width = dw + 'px'; dashCv.style.height = dh + 'px'; dashCv.width = Math.round(dw * dpr); dashCv.height = Math.round(dh * dpr);
      const topH = opts.mirrors ? (portrait ? sideH + 28 * u : 0) : 0;
      if (portrait) {
        set($('.s2-gear'), { width: gw + 'px', height: gh + 'px', right: (12 * u) + 'px', bottom: (ph + 26 * u) + 'px' });
        set(btns, { left: (12 * u) + 'px', bottom: (ws + 40 * u) + 'px' });
        set(info, { top: `calc(${topH + 6 * u}px + env(safe-area-inset-top,0px))`, maxWidth: (W * 0.46) + 'px', minWidth: 0 });
        set(dash, { left: 'auto', right: (8 * u) + 'px', transform: 'none', top: `calc(${topH + 6 * u}px + env(safe-area-inset-top,0px))` });
        set(tr, { top: 'auto', bottom: (ph + gh + 40 * u) + 'px', right: (12 * u) + 'px' });
        set(tipEl, { top: `calc(${topH + dh + 18 * u}px + env(safe-area-inset-top,0px))`, transform: 'translateX(-50%)' });
      } else {
        set($('.s2-gear'), { width: gw + 'px', height: gh + 'px', right: (pedsW + 22 * u) + 'px', bottom: (12 * u) + 'px' });
        set(btns, { left: (12 * u) + 'px', bottom: (ws + 34 * u) + 'px' });
        if (H - (ws + 34 * u) - 100 * u < 120 * u) set(btns, { left: (ws + 24 * u) + 'px', bottom: (12 * u) + 'px' });
        set(info, {});
        set(dash, { bottom: (8 * u) + 'px' });
        const leftEnd = parseFloat(btns.style.left) > 20 * u ? ws + 24 * u + 150 * u : ws + 24 * u, rightStart = W - (pedsW + gw + 34 * u);
        if (rightStart - leftEnd < dw + 8 && rightStart - leftEnd > 168 * u) { const d2 = rightStart - leftEnd - 10 * u; dashCv.style.width = d2 + 'px'; dashCv.style.height = d2 * 0.4 + 'px'; dashCv.width = Math.round(d2 * dpr); dashCv.height = Math.round(d2 * 0.4 * dpr); dash.style.left = ((leftEnd + rightStart) / 2) + 'px'; }
        else if (rightStart - leftEnd < dw + 8) { dash.style.bottom = 'auto'; dash.style.top = `calc(${(opts.mirrors ? sideH + 30 * u : 8 * u)}px + env(safe-area-inset-top,0px))`; dash.style.left = 'auto'; dash.style.right = (60 * u) + 'px'; dash.style.transform = 'none'; }
        else dash.style.left = ((leftEnd + rightStart) / 2) + 'px';
        set(tr, {});
        set(tipEl, { top: `calc(${opts.mirrors ? sideH + 30 * u : 10 * u}px + env(safe-area-inset-top,0px))` });
        if (dash.style.top) tipEl.style.top = `calc(${(opts.mirrors ? sideH + 30 * u : 8 * u) + dh + 18 * u}px + env(safe-area-inset-top,0px))`;
      }
      cam.ppm = baseP();
    }

    /* 音频 */
    function ensureAudio() {
      if (!audio && App.settings.sound) { audio = makeAudio(); if (audio) audio.setMute(opts.mute); }
      if (audio) audio.resume();
    }
    const sfx = t => { if (audio && !opts.mute && App.settings.sound) audio.blip(t); };

    /* 横幅 */
    function showBanner(text, kind = 'info', sub = '', ms = 2200) {
      banner.className = 's2-banner show ' + kind; banner.innerHTML = esc(text) + (sub ? `<small>${esc(sub)}</small>` : '');
      clearTimeout(bannerT); bannerT = setTimeout(() => banner.classList.remove('show'), ms);
    }
    const say = (t, intr = false) => { if (App.settings.voice) App.speak(t, { interrupt: intr }); };

    /* 输入 */
    const takeover = () => { if (S.auto) { S.auto = null; showBanner('已退出教学演示', 'info', '由你接管车辆'); } };
    function act(a, down = true) {
      if (a !== 'pause') ensureAudio();
      const c = S.car;
      if (a !== 'pause' && a !== 'view' && a !== 'assist') takeover();
      if (a === 'pause') { if (down) openPause(); return; }
      switch (a) {
        case 'pause': if (down) openPause(); break;
        case 'view': if (down) { opts.view = { follow: 'north', north: 'god', god: 'follow' }[opts.view]; saveOpts(); showBanner({ follow: '跟随视角（车头朝上）', north: '跟随视角（正北朝上）', god: '上帝视角（全局）' }[opts.view], 'info', '', 1200); } break;
        case 'assist': if (down) { opts.assist = !assistOn(); if (mode === 'exam') opts.assistInExam = opts.assist; saveOpts(); showBanner(opts.assist ? '辅助线：开' : '辅助线：关', 'info', '', 1000); } break;
        case 'sigL': if (down) { c.sig = c.sig === -1 ? 0 : -1; c.sigArm = 0; sfx('click'); } break;
        case 'sigR': if (down) { c.sig = c.sig === 1 ? 0 : 1; c.sigArm = 0; sfx('click'); } break;
        case 'hb': if (down) { c.hb = !c.hb; sfx('ratchet'); } break;
        case 'belt': if (down) { c.belt = !c.belt; sfx('click'); showBanner(c.belt ? '安全带已系好' : '安全带已解开', c.belt ? 'ok' : 'warn', '', 1000); } break;
        case 'horn': if (audio) audio.horn(down && !opts.mute); break;
        case 'key': if (down) ignition(); break;
      }
      syncButtons();
    }
    function ignition() {
      const c = S.car;
      if (crankT > 0) return;
      if (c.on) { c.on = false; sfx('clunk'); showBanner('发动机已关闭', 'info', '', 1000); return; }
      if (manual && c.gear !== 'N' && c.clu < 0.75) { showBanner('请踩下离合器或挂空挡再点火', 'warn'); return; }
      if (!manual && c.gear !== 'P' && c.gear !== 'N') { showBanner('请将挡位置于 P 或 N 再点火', 'warn'); return; }
      sfx('crank'); crankT = 0.65;
    }
    function doShift(g) {
      ensureAudio(); takeover();
      const r = shift(S.car, g);
      if (r === 'ok') { sfx('click'); syncGear(); }
      else if (r === 'clutch') { sfx('grind'); showBanner('请先踩下离合器再换挡', 'warn', '', 1300); }
      else if (r === 'grind') { sfx('grind'); showBanner('车辆未停稳，不能挂入该挡', 'warn', '', 1300); }
      else if (r === 'moving') showBanner('请停车后再换挡', 'warn', '', 1200);
      else if (r === 'brake') showBanner('请踩住刹车再换挡', 'warn', '', 1200);
    }
    const KEYMAP = { ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right', ArrowUp: 'thr', KeyW: 'thr', ArrowDown: 'brk', KeyS: 'brk', ShiftLeft: 'clu', ShiftRight: 'clu', KeyC: 'clu', KeyX: 'hold', KeyZ: 'center' };
    function onKey(e) {
      if (e.repeat && !(e.code in KEYMAP)) { e.preventDefault(); return; }
      const down = e.type === 'keydown', k = e.code;
      if (overlay && down) { if (k === 'Escape' && overlay.esc) { overlay.esc(); e.preventDefault(); } return; }
      if (k in KEYMAP) { if (down && !keys[KEYMAP[k]] && KEYMAP[k] !== 'hold') takeover(); keys[KEYMAP[k]] = down; e.preventDefault(); ensureAudio(); return; }
      if (k === 'KeyH') { act('horn', down); e.preventDefault(); return; }
      if (!down) return;
      const g = manual ? { Digit1: '1', Digit2: '2', Digit3: '3', KeyR: 'R', KeyN: 'N', Digit0: 'N' }[k] : { KeyP: 'P', KeyR: 'R', KeyN: 'N', Digit1: 'D', Digit2: 'D', KeyT: 'D' }[k];
      if (g) { doShift(g); e.preventDefault(); return; }
      const m = { Space: 'hb', KeyQ: 'sigL', KeyE: 'sigR', KeyB: 'belt', KeyF: 'key', KeyV: 'view', KeyG: 'assist', Escape: 'pause' }[k];
      if (m) { act(m); e.preventDefault(); return; }
      if (k === 'KeyM') { opts.mute = !opts.mute; saveOpts(); if (audio) audio.setMute(opts.mute); showBanner(opts.mute ? '已静音' : '声音已开启', 'info', '', 900); }
      if (k === 'KeyK') toggleKH();
    }
    function clearKeys() { for (const k in keys) keys[k] = false; touch.clu = touch.brk = touch.thr = null; inp.wheelDrag = null; if (audio) audio.horn(false); }

    // 方向盘拖动
    const wAng = e => { const r = wheelEl.getBoundingClientRect(); return Math.atan2(e.clientY - (r.top + r.height / 2), e.clientX - (r.left + r.width / 2)) / D2R; };
    wheelEl.addEventListener('pointerdown', e => { e.preventDefault(); ensureAudio(); takeover(); wheelEl.setPointerCapture(e.pointerId); inp.wheelDrag = { id: e.pointerId, a: wAng(e) }; inp.swT = S.car.sw; wheelEl.style.cursor = 'grabbing'; });
    wheelEl.addEventListener('pointermove', e => { const d = inp.wheelDrag; if (!d || d.id !== e.pointerId) return; const a = wAng(e); let da = a - d.a; while (da > 180) da -= 360; while (da < -180) da += 360; d.a = a; inp.swT = clamp(inp.swT + da, -CAR.SWMAX, CAR.SWMAX); });
    const wUp = e => { if (inp.wheelDrag && inp.wheelDrag.id === e.pointerId) { inp.wheelDrag = null; wheelEl.style.cursor = ''; } };
    wheelEl.addEventListener('pointerup', wUp); wheelEl.addEventListener('pointercancel', wUp);
    // 踏板
    Object.entries(pedEls).forEach(([p, elp]) => {
      // 按下即踩到底（油门为轻踩）；按住后手指上移 = 松抬踏板（离合可停在半联动），下移 = 踩深
      const v0 = p === 'thr' ? 0.35 : 1; let y0 = 0;
      const val = e => { const r = elp.getBoundingClientRect(); return clamp(v0 + (e.clientY - y0) / (r.height * 0.7), p === 'brk' ? 0.3 : 0, 1); };
      let pid = null;
      elp.addEventListener('pointerdown', e => { e.preventDefault(); ensureAudio(); takeover(); pid = e.pointerId; elp.setPointerCapture(pid); y0 = e.clientY; touch[p] = val(e); });
      elp.addEventListener('pointermove', e => { if (e.pointerId === pid) touch[p] = val(e); });
      const up = e => { if (e.pointerId === pid) { pid = null; touch[p] = null; } };
      elp.addEventListener('pointerup', up); elp.addEventListener('pointercancel', up);
    });
    // 挡位
    $('.s2-gear svg').addEventListener('pointerdown', e => {
      e.preventDefault(); const r = e.currentTarget.getBoundingClientRect(), x = (e.clientX - r.left) / r.width * 100, y = (e.clientY - r.top) / r.height * 92;
      const P = manual ? GPOS_M : GPOS_A; let best = null, bd = 1e9;
      for (const g in P) { const d = hyp(P[g][0] - x, P[g][1] - y); if (d < bd) { bd = d; best = g; } }
      if (best) doShift(best);
    });
    // 按钮
    $$('.s2-b[data-a]').forEach(b => {
      const a = b.dataset.a;
      b.addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); if (a === 'horn') { b.setPointerCapture(e.pointerId); act('horn', true); } else act(a); });
      if (a === 'horn') { const up = () => act('horn', false); b.addEventListener('pointerup', up); b.addEventListener('pointercancel', up); }
    });
    // 画布：缩放（捏合 / 滚轮）
    cv.addEventListener('pointerdown', e => { inp.ptrs.set(e.pointerId, [e.clientX, e.clientY]); if (inp.ptrs.size === 2) { const [a, b] = [...inp.ptrs.values()]; inp.pinch = { d: hyp(a[0] - b[0], a[1] - b[1]), z: cam.zoom }; } ensureAudio(); });
    cv.addEventListener('pointermove', e => { if (!inp.ptrs.has(e.pointerId)) return; inp.ptrs.set(e.pointerId, [e.clientX, e.clientY]); if (inp.pinch && inp.ptrs.size === 2) { const [a, b] = [...inp.ptrs.values()]; cam.zoom = clamp(inp.pinch.z * hyp(a[0] - b[0], a[1] - b[1]) / inp.pinch.d, 0.35, 3); } });
    const cUp = e => { inp.ptrs.delete(e.pointerId); if (inp.ptrs.size < 2) inp.pinch = null; };
    cv.addEventListener('pointerup', cUp); cv.addEventListener('pointercancel', cUp);
    cv.addEventListener('wheel', e => { e.preventDefault(); cam.zoom = clamp(cam.zoom * Math.exp(-e.deltaY * 0.0015), 0.35, 3); }, { passive: false });
    root.addEventListener('contextmenu', e => e.preventDefault());

    function applyInput(dt) {
      const c = S.car;
      if (crankT > 0) { crankT -= dt; if (crankT <= 0) { const r = ignite(c); if (r === 'ok') showBanner('发动机已启动', 'ok', '', 900); } }
      if (S.auto) { inp.swT = c.sw; return; }
      let sr = (keys.right ? 1 : 0) - (keys.left ? 1 : 0);
      if (sr) { inp.hold += dt; inp.swT = clamp(inp.swT + sr * (inp.hold > 0.45 ? 560 : 330) * dt, -CAR.SWMAX, CAR.SWMAX); } else inp.hold = 0;
      if (keys.center) inp.swT -= clamp(inp.swT, -420 * dt, 420 * dt);
      if (opts.autoCenter && !sr && !inp.wheelDrag && Math.abs(c.v) > 0.05) inp.swT -= clamp(inp.swT, -1, 1) * Math.min(Math.abs(inp.swT), 160 * Math.min(1, Math.abs(c.v)) * dt);
      c.sw += clamp(inp.swT - c.sw, -1100 * dt, 1100 * dt);
      const ramp = (cur, tgt, up, dn) => cur + clamp(tgt - cur, -dn * dt, up * dt);
      if (keys.thr) c.thr = ramp(c.thr, 1, 0.75, 3); else if (touch.thr != null) c.thr = ramp(c.thr, touch.thr, 3, 3); else c.thr = ramp(c.thr, 0, 0, 3.5);
      if (keys.brk) c.brk = ramp(c.brk, 1, 2.6, 4); else if (touch.brk != null) c.brk = ramp(c.brk, touch.brk, 5, 5); else c.brk = ramp(c.brk, 0, 0, 4);
      if (manual) {
        if (keys.clu) c.clu = ramp(c.clu, 1, 4, 0);
        else if (touch.clu != null) c.clu = ramp(c.clu, touch.clu, 5, 5);
        else if (!keys.hold) { const r = c.clu > 0.8 ? 3 : c.clu > 0.4 ? (opts.easyClutch ? 0.3 : 1.6) : 2.5; c.clu = ramp(c.clu, 0, 0, r); }
      } else c.clu = 0;
    }

    /* 事件 */
    function handleEvents() {
      for (const e of S.events) {
        if (e.type === 'ded') {
          const fail = e.fail, txt = fail ? '不合格' : `扣${e.pts}分`;
          showBanner(e.msg, fail ? 'bad' : 'warn', txt, 2600);
          App.beep('bad'); App.vibrate(fail ? [60, 40, 60] : 50);
          say(fail ? `${e.msg}，${mode === 'exam' ? '考试不合格' : '不合格'}` : `${e.msg}，扣${e.pts}分`, true);
        } else if (e.type === 'speak') say(e.text);
        else if (e.type === 'info') { showBanner(e.text, 'ok', '', 1500); }
        else if (e.type === 'beep') App.beep(e.name);
        else if (e.type === 'proj') { if (mode !== 'exam') showBanner(ITEMS[e.id].name, 'info', S.auto ? '教学演示开始' : '练习开始', 1800); else showBanner(ITEMS[e.id].name, 'info', '项目开始', 1600); }
        else if (e.type === 'projDone') { App.beep('ok'); if (S.exam) showBanner(ITEMS[e.id].name + ' 完成', 'ok', '用时 ' + fmtT(e.time), 1600); }
        else if (e.type === 'stall') { sfx('clunk'); stalledT = S.t; if (!S.log.length || S.log[S.log.length - 1].t < S.t - 0.1) showBanner('发动机熄火！', 'warn', manual ? '踩离合、挂空挡或踩离合后按 F 重新点火' : '', 2000); }
        else if (e.type === 'measure') { showBanner(`前保险杠距桩杆线 ${Math.round(e.df * 100)}cm`, Math.abs(e.df) > 0.3 || e.dr > 0.3 ? 'warn' : 'ok', `车身距右边线 ${Math.round(e.dr * 100)}cm`, 2600); }
        else if (e.type === 'warn') { showBanner(e.text, 'warn'); sfx('chime'); }
        else if (e.type === 'wall') { if (S.t - (ui.wallT || -9) > 2) { ui.wallT = S.t; showBanner('前方是场地围栏', 'warn', '', 1200); } }
        else if (e.type === 'sigoff') sfx('click');
        else if (e.type === 'end') timers.push(setTimeout(() => showResult(e), 1300));
      }
      S.events.length = 0;
    }

    /* 结果 */
    function showResult(r) {
      if (overlay && overlay.kind === 'result') return;
      const isDemo = demo && !!S.auto;
      const name = item === 'exam' ? '全真模拟考试' : ITEMS[item].name;
      const pass = r.pass;
      if (!isDemo) {
        if (mode === 'exam') App.record('k2', { score: r.score, pass, item, name: (item === 'exam' ? '科目二模拟考试' : ITEMS[item].name + '（单项）'), trans, time: Math.round(r.time) });
        if (item !== 'exam' && r.complete) {
          const best = ST.get('best', {}), b = best[item];
          if (!b || r.score > b.score || (r.score === b.score && r.time < b.time)) { best[item] = { score: r.score, time: Math.round(r.time), t: Date.now(), pass }; ST.set('best', best); }
        }
        if (item !== 'exam') { const st = ST.get('stats', {}); const s = st[item] || { n: 0, p: 0 }; s.n++; if (pass) s.p++; st[item] = s; ST.set('stats', st); }
      }
      if (mode === 'exam') say(pass ? `考试结束，成绩合格，得分${r.score}分` : (r.log.some(l => l.fail) ? '考试不合格，请将车开回起点' : `考试不合格，得分${r.score}分`), true);
      else App.beep(pass ? 'pass' : 'bad');
      const idx = ORDER5.indexOf(item), next = idx >= 0 ? ORDER5[(idx + 1) % ORDER5.length] : null;
      const q = `mode=${mode}&gear=${trans}`;
      openOverlay('result', `<div class="s2-card">
        <div class="s2-stamp ${pass ? 'p' : 'f'}">${pass ? '合格' : '不合格'}</div>
        <div class="muted small">${esc(name)} · ${manual ? '手动挡 C1' : '自动挡 C2'} · ${mode === 'exam' ? '考试模式' : isDemo ? '教学演示' : '练习模式'}</div>
        <div class="row" style="align-items:flex-end;gap:16px;margin:10px 0 4px"><div class="s2-res-score" style="color:${pass ? 'var(--ok)' : 'var(--bad)'}">${r.score}</div><div class="muted">分<br>用时 ${fmtT(r.time)}</div></div>
        <div class="s2-dl">${r.log.length ? r.log.map(l => `<div class="${l.fail ? 'f' : 'd'}"><span class="muted">${fmtT(l.t)}</span><span>${l.item && ITEMS[l.item] && item === 'exam' ? '[' + ITEMS[l.item].short + '] ' : ''}${esc(l.msg)}</span><b>${l.fail ? '不合格' : '-' + l.pts}</b></div>`).join('') : '<div class="muted">无扣分，完美！</div>'}</div>
        ${!r.complete && !r.log.some(l => l.fail) ? '<div class="note warn small">项目未完成</div>' : ''}
        ${mode === 'exam' && !pass ? '<div class="note small" style="margin-top:6px">真实考试中，科目二不合格可当场补考一次。</div>' : ''}
        <div class="s2-mrow" style="margin-top:12px"><button class="btn primary" data-r="again">${mode === 'exam' && !pass ? '当场补考' : '再来一次'}</button>${next && item !== 'exam' ? `<button class="btn" data-r="next">下一项：${ITEMS[next].short}</button>` : ''}<button class="btn" data-r="back">返回</button></div>
        ${item in ITEMS && !isDemo ? '<button class="btn ghost block" data-r="demo">看教练演示</button>' : ''}
      </div>`, { again: () => App.go(location.hash), next: () => App.go(`#/k2/${next}?${q}`), back: () => App.go('#/k2'), demo: () => App.go(`#/k2/${item}?mode=practice&demo=1&gear=${trans}`) });
    }

    /* 覆盖层 */
    function openOverlay(kind, html, handlers, escFn) {
      closeOverlay(); clearKeys();
      const o = document.createElement('div'); o.className = 's2-ov'; o.innerHTML = html; root.appendChild(o);
      o.addEventListener('pointerdown', e => e.stopPropagation());
      o.querySelectorAll('[data-r]').forEach(b => b.onclick = () => { const h = handlers[b.dataset.r]; if (h) h(b); });
      overlay = { kind, el: o, esc: escFn }; paused = true; if (audio) audio.horn(false);
      return o;
    }
    function closeOverlay() { if (overlay) { overlay.el.remove(); overlay = null; } paused = !started; last = performance.now(); }
    function openPause() {
      const v = opts.view;
      const html = () => `<div class="s2-card"><h3>暂停</h3>
        <div class="s2-mrow"><button class="btn primary" data-r="resume">继续</button><button class="btn" data-r="restart">重来</button><button class="btn danger" data-r="exit">退出</button></div>
        <div class="s2-opt"><span>挡位</span><div class="seg"><button data-r="man" class="${manual ? 'on' : ''}">手动挡</button><button data-r="aut" class="${!manual ? 'on' : ''}">自动挡</button></div></div>
        <div class="s2-opt"><span>视角</span><div class="seg"><button data-r="vf" class="${v === 'follow' ? 'on' : ''}">车头朝上</button><button data-r="vn" class="${v === 'north' ? 'on' : ''}">正北</button><button data-r="vg" class="${v === 'god' ? 'on' : ''}">上帝</button></div></div>
        ${[['assist', '辅助线（轨迹预测 / 点位标记）', assistOn()], ['mirrors', '显示后视镜', opts.mirrors], ['sound', '引擎声音', !opts.mute], ['autoCenter', '方向盘自动回正（真实考试车无）', opts.autoCenter], ['easyClutch', '新手离合（松开时半联动区缓抬）', opts.easyClutch]].map(([k, t, on]) => `<label class="s2-opt"><span>${t}</span><span class="switch"><input type="checkbox" data-k="${k}" ${on ? 'checked' : ''}><span></span></span></label>`).join('')}
        ${item in ITEMS ? `<div class="s2-mrow" style="margin-top:10px"><button class="btn" data-r="demo">${demo ? '退出教学演示' : '教学演示（自动驾驶）'}</button><button class="btn" data-r="tips">技巧点位</button></div>` : ''}
        <div class="s2-mrow"><button class="btn ghost" data-r="keys">操作说明</button></div></div>`;
      const q = g => `#/k2/${item}?mode=${mode}&gear=${g}${demo ? '&demo=1' : ''}`;
      const o = openOverlay('pause', html(), {
        resume: closeOverlay, restart: () => App.go(location.hash), exit: () => App.go('#/k2'),
        man: () => { if (!manual) App.go(q('manual')); }, aut: () => { if (manual) App.go(q('auto')); },
        vf: b => setV('follow', b), vn: b => setV('north', b), vg: b => setV('god', b),
        demo: () => App.go(`#/k2/${item}?mode=practice&gear=${trans}${demo ? '' : '&demo=1'}`),
        tips: () => tipsModal(item),
        keys: () => { closeOverlay(); toggleKH(true); }
      }, closeOverlay);
      function setV(x, b) { opts.view = x; saveOpts(); b.parentNode.querySelectorAll('button').forEach(z => z.classList.toggle('on', z === b)); }
      o.querySelectorAll('input[data-k]').forEach(i => i.onchange = () => {
        const k = i.dataset.k;
        if (k === 'sound') { opts.mute = !i.checked; if (audio) audio.setMute(opts.mute); else ensureAudio(); }
        else if (k === 'assist') { opts.assist = i.checked; if (mode === 'exam') opts.assistInExam = i.checked; }
        else { opts[k] = i.checked; if (k === 'mirrors') layout(); }
        saveOpts();
      });
    }
    function toggleKH(force) {
      if (khEl && !force) { khEl.remove(); khEl = null; return; }
      if (khEl) return;
      const k = s => s.split(' ').map(x => `<span class="kbd">${x}</span>`).join(' ');
      khEl = document.createElement('div'); khEl.className = 's2-kh s2-g';
      khEl.innerHTML = `<span class="x">×</span><b>键盘操作</b><br>${k('← →')}/${k('A D')} 方向（按住转动）${k('Z')} 回正<br>${k('↑')}/${k('W')} 油门　${k('↓')}/${k('S')} 刹车<br>${manual ? `${k('Shift')}/${k('C')} 离合（松开自动缓抬）${k('X')} 保持半联动<br>${k('1 2 3')} 挡位 ${k('R')} 倒挡 ${k('N')} 空挡（先踩离合）<br>` : `${k('P R N')} 挡位　${k('1')} D 挡（踩刹车换挡）<br>`}${k('Space')} 手刹　${k('Q')}/${k('E')} 转向灯　${k('H')} 喇叭<br>${k('B')} 安全带　${k('F')} 点火　${k('V')} 视角　${k('G')} 辅助线<br>${k('M')} 静音　${k('K')} 本提示　${k('Esc')} 暂停<br><span style="opacity:.75">鼠标可拖动方向盘、点击踏板；滚轮缩放</span>`;
      root.appendChild(khEl); khEl.querySelector('.x').onclick = () => { khEl.remove(); khEl = null; opts.kh = true; saveOpts(); };
    }
    function syncButtons() {
      const c = S.car, blink = (S.t % 0.8) < 0.42;
      const b = a => root.querySelector(`.s2-b[data-a="${a}"]`);
      b('sigL').classList.toggle('on', c.sig === -1 && blink); b('sigR').classList.toggle('on', c.sig === 1 && blink);
      b('hb').classList.toggle('on', c.hb); b('belt').classList.toggle('on', c.belt); b('key').classList.toggle('on', c.on);
      b('assist').classList.toggle('on', assistOn());
      b('view').querySelector('span').textContent = { follow: '跟随', north: '正北', god: '全局' }[opts.view];
    }
    function syncGear() { const P = manual ? GPOS_M : GPOS_A, p = P[S.car.gear] || P.N; knob.setAttribute('cx', p[0]); knob.setAttribute('cy', p[1]); $$('.s2-gl').forEach(t => t.setAttribute('fill', t.dataset.g === S.car.gear ? '#60a5fa' : '#fff')); }

    /* HUD */
    // 起步引导：车停着且还没准备好走时，一步步提示（新手只踩油门车不会动）
    function startGuide(c) {
      const fresh = c.odo < 0.3;
      if (manual) {
        if (c.gear === 'N' && c.clu < 0.75) return '起步 ①：踩住「离合」不放（键盘按住 Shift）';
        if (c.gear === 'N') return '起步 ②：挂「1」挡（点挡位图上的 1 / 按 1 键；倒车挂 R）';
        if (c.hb) return '起步 ③：松开「手刹」（点手刹按钮 / 空格键）';
        if (fresh && c.clu > 0.4) return '起步 ④：慢慢松开离合，车会自己往前走（不用踩油门）';
      } else {
        if ((c.gear === 'P' || c.gear === 'N') && c.brk < 0.3) return '起步 ①：踩住「刹车」不放（键盘按住 ↓）';
        if (c.gear === 'P' || c.gear === 'N') return '起步 ②：挂「D」挡（点挡位图 / 按 1 键；倒车挂 R）';
        if (c.hb) return '起步 ③：松开「手刹」（点手刹按钮 / 空格键）';
        if (fresh && c.brk > 0.1) return '起步 ④：松开刹车，车会慢慢往前走';
      }
      return '';
    }
    let thrHintT = -9;
    function updateHUD() {
      { const c = S.car; if (!S.auto && c.on && c.thr > 0.3 && Math.abs(c.v) < 0.05 && S.t - thrHintT > 4) {
        const why = c.gear === 'P' ? '现在是 P 挡（驻车挡），踩油门车不会走' : c.gear === 'N' ? '现在是空挡，踩油门车不会走' : c.hb ? '手刹还没松开' : (manual && c.clu > 0.75) ? '离合踩到底了，动力传不到车轮' : '';
        if (why) { thrHintT = S.t; showBanner(why, 'warn', '按屏幕上方的起步提示一步步操作', 2200); } } }
      const c = S.car, P = S.cur;
      const pn = item === 'free' ? '自由练习场' : P ? P.name : (S.exam ? (S.over ? '考试结束' : '前往：' + (ITEMS[S.order[S.waitIdx]] || {}).name) : ITEMS[item].name);
      const tagT = item === 'free' ? '自由' : demo && S.auto ? '演示' : mode === 'exam' ? '考试' : '练习';
      const html = `${esc(pn)}<span class="tag">${tagT}</span><span class="tag">${manual ? 'C1' : 'C2'}</span>`;
      if (html !== ui.lastPn) { $('.s2-pn').innerHTML = html; ui.lastPn = html; }
      const tt = P && P.t0 != null ? P.time : 0, lim = P && P.limit;
      const sc = item === 'free' ? `<div><b>${(Math.abs(c.v) * 3.6).toFixed(1)}</b> <span>km/h</span></div>` : `<div><b class="${S.failed || S.score < 80 ? 'bad' : ''}">${S.failed ? '不合格' : S.score}</b> <span>分</span></div><div><b>${fmtT(S.exam ? S.t : tt)}</b> <span>${lim ? '/ ' + fmtT(lim) : S.exam ? '总用时' : '用时'}</span></div>`;
      if (sc !== ui.lastSc) { $('.s2-sc').innerHTML = sc; ui.lastSc = sc; }
      if (S.log.length !== ui.lastLog) { ui.lastLog = S.log.length; $('.s2-log').innerHTML = S.log.slice(-3).reverse().map(l => `<div class="${l.fail ? 'f' : ''}">${fmtT(l.t)} ${esc(l.msg)} ${l.fail ? '✕' : '-' + l.pts}</div>`).join(''); }
      let tip = S.auto ? S.auto.tip : P ? P.tip : (item === 'free' ? '自由驾驶：沿虚线道路前往各项目场地随意练习' : S.exam && !S.over ? '沿考试路线（白色虚线道路）行驶至下一项目' : '');
      if (!c.on && !S.auto && !S.over) tip = manual ? '发动机未启动：踩离合（或挂空挡）后按「点火」/ F 键启动' : '发动机未启动：挡位置于 P，按「点火」/ F 键启动';
      else if (mode === 'exam' && !c.belt && !S.started) tip = '请先系好安全带（B 键 / 安全带按钮），再点火起步';
      else if (!S.auto && !S.over && Math.abs(c.v) < 0.05) { const g = startGuide(c); if (g) tip = g; }
      if (tip !== ui.lastTip) { tipEl.textContent = tip; tipEl.style.opacity = tip ? 1 : 0; tipEl.classList.toggle('demo', !!S.auto); ui.lastTip = tip; }
    }

    /* 相机 */
    function fxBox() { const id = S.cur ? S.cur.id : S.exam ? S.order[S.waitIdx] : item in ITEMS ? item : null; return id ? FXBOX[id] : COURSE.bounds; }
    function updateCam(dt) {
      const c = S.car, k = 1 - Math.exp(-dt * 4);
      let tx, ty, tr, tp;
      const fwd = c.gear === 'R' ? -1 : 1;
      cam.look += (fwd * 1.6 - cam.look) * (1 - Math.exp(-dt * 1.5));
      const cx = c.x + Math.cos(c.th) * (1.25 + cam.look), cy = c.y + Math.sin(c.th) * (1.25 + cam.look);
      const base = baseP();
      if (opts.view === 'god') {
        const b = fxBox(), bw = b[2] - b[0], bh = b[3] - b[1];
        tx = (b[0] + b[2]) / 2; ty = (b[1] + b[3]) / 2; tr = 0; tp = Math.min(W / (bw + 4), H * 0.62 / (bh + 4)) * cam.zoom;
      } else { tx = cx; ty = cy; tr = opts.view === 'follow' ? c.th + PI / 2 : 0; tp = base * cam.zoom; }
      cam.x += (tx - cam.x) * (opts.view === 'god' ? k : Math.min(1, k * 2.5)); cam.y += (ty - cam.y) * (opts.view === 'god' ? k : Math.min(1, k * 2.5));
      cam.rot += wrap(tr - cam.rot) * k; cam.ppm += (tp - cam.ppm) * k;
    }
    function worldXform(g) {
      const ax = W / 2, ay = opts.view === 'god' ? H * 0.52 : H * (portrait ? 0.5 : 0.6);
      g.setTransform(dpr, 0, 0, dpr, 0, 0); g.translate(ax, ay); g.scale(cam.ppm, cam.ppm); g.rotate(-cam.rot); g.translate(-cam.x, -cam.y);
      const rr = hyp(W, H) / cam.ppm; return [cam.x - rr, cam.y - rr, cam.x + rr, cam.y + rr];
    }

    /* 辅助绘制 */
    function drawAssist(g, t) {
      const c = S.car, k = Math.tan(c.delta) / CAR.WB, dir = c.gear === 'R' ? -1 : 1;
      const pts = pathFrom({ x: c.x, y: c.y, th: c.th }, [[dir * 7, k]]);
      const W4 = [[], [], [], []], body = [];
      for (let i = 0; i < pts.length; i += 4) {
        const p = pts[i], q = { x: p.x, y: p.y, th: p.th, delta: c.delta };
        const ws = wheels(q); ws.forEach((w, j) => W4[j].push(w.p));
        body.push(dir > 0 ? toW(q, CAR.WB + CAR.FO, k > 0 ? -CAR.W / 2 : CAR.W / 2) : toW(q, -CAR.RO, k > 0 ? -CAR.W / 2 : CAR.W / 2));
      }
      g.lineWidth = 0.07; g.lineCap = 'round';
      W4.forEach((a, j) => { g.strokeStyle = j < 2 ? 'rgba(250,204,21,.9)' : 'rgba(56,189,248,.9)'; g.setLineDash(j < 2 ? [0.3, 0.2] : []); g.beginPath(); a.forEach((p, i) => i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1])); g.stroke(); });
      g.setLineDash([0.15, 0.15]); g.strokeStyle = 'rgba(255,255,255,.6)'; g.lineWidth = 0.05; g.beginPath(); body.forEach((p, i) => i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1])); g.stroke(); g.setLineDash([]);
      const e = pts[Math.min(pts.length - 1, 70)], ghost = bodyPoly({ x: e.x, y: e.y, th: e.th });
      g.strokeStyle = 'rgba(255,255,255,.35)'; g.lineWidth = 0.05; g.beginPath(); ghost.forEach((p, i) => i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1])); g.closePath(); g.stroke();
      // 点位标记
      const pulse = 0.25 + 0.12 * Math.sin(t * 6), ring = (x, y, col) => { g.strokeStyle = col; g.lineWidth = 0.08; g.beginPath(); g.arc(x, y, pulse + 0.15, 0, 2 * PI); g.stroke(); g.fillStyle = col; g.beginPath(); g.arc(x, y, 0.08, 0, 2 * PI); g.fill(); };
      const id = S.cur ? S.cur.id : item in ITEMS ? item : null;
      const lbl = (x, y, s, col = '#fff') => { g.save(); g.translate(x, y); g.rotate(cam.rot); g.font = `bold 42px ${FONT}`; const w = g.measureText(s).width / 100 + 0.3; g.fillStyle = 'rgba(0,0,0,.6)'; rrect(g, -w / 2, -0.3, w, 0.6, 0.15); g.fill(); g.fillStyle = col; wtext(g, s, 0, 0.02, 0.42); g.restore(); };
      if (id === 'daoku') {
        ring(DK.gx0, DK.gy0, 'rgba(250,204,21,.95)'); ring(DK.gx1, DK.gy0, 'rgba(250,204,21,.95)');
        const bp = bodyPoly(c);
        if (bp.some(p => p[1] > DK.gy0 - 0.2) && Math.abs(Math.cos(c.th)) < 0.5) {
          const xl = Math.min(...bp.map(p => p[0])), xr = Math.max(...bp.map(p => p[0])), yb = Math.max(...bp.map(p => p[1]));
          lbl(DK.gx0 - 0.9, (c.y + DK.gy1) / 2, `左 ${Math.round((xl - DK.gx0 - 0.075) * 100)}`, '#93c5fd'); lbl(DK.gx1 + 0.9, (c.y + DK.gy1) / 2, `右 ${Math.round((DK.gx1 - 0.075 - xr) * 100)}`, '#93c5fd');
          if (yb > DK.gy0 + 2) lbl(c.x, DK.gy1 + 0.6, `后 ${Math.round((DK.gy1 - 0.075 - yb) * 100)}cm`, '#93c5fd');
        }
      } else if (id === 'cefang') {
        ring(CF.gx1, CF.y1, 'rgba(250,204,21,.95)'); ring(CF.gx0, CF.y1, 'rgba(250,204,21,.95)'); ring(CF.gx0, CF.gy1, 'rgba(250,204,21,.6)');
      } else if (id === 'zhijiao') ring(ZJ.x0, ZJ.yi, 'rgba(250,204,21,.95)');
      else if (id === 'podao') {
        g.strokeStyle = 'rgba(250,204,21,.6)'; g.lineWidth = 0.05; g.setLineDash([0.2, 0.15]);
        for (const d of [-0.5, -0.3, 0.3, 0.5]) { g.beginPath(); g.moveTo(PD.stop + d, PD.y0 + 0.3); g.lineTo(PD.stop + d, PD.y1 - 0.3); g.stroke(); }
        g.setLineDash([]);
      }
    }
    function drawMeasure(g) {
      const m = S.measure; if (!m || (S.cur && S.cur.id !== 'podao')) return;
      g.strokeStyle = '#facc15'; g.fillStyle = '#facc15'; g.lineWidth = 0.06;
      const y = (PD.y0 + PD.y1) / 2;
      g.beginPath(); g.moveTo(m.x, y - 0.6); g.lineTo(PD.stop, y - 0.6); g.stroke();
      g.beginPath(); g.moveTo(m.x - 1.2, m.y); g.lineTo(m.x - 1.2, PD.y1 - 0.075); g.stroke();
      wtext(g, `${Math.round(m.df * 100)}cm`, m.x + 0.9, y - 0.6, 0.45, cam.rot);
      wtext(g, `右${Math.round(m.dr * 100)}cm`, m.x - 1.2, PD.y1 + 0.7, 0.45, cam.rot);
    }
    function drawTracks(g) {
      g.strokeStyle = 'rgba(20,20,20,.22)'; g.lineWidth = 0.17; g.lineJoin = 'round';
      for (const tr of tracks) { if (tr.length < 2) continue; g.beginPath(); tr.forEach((p, i) => i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1])); g.stroke(); }
    }
    function recordTracks() {
      const c = S.car;
      if (Math.abs(c.odo - trackOdo) > 0.12) {
        trackOdo = c.odo;
        [toW(c, 0, -CAR.TR / 2), toW(c, 0, CAR.TR / 2)].forEach((p, i) => { tracks[i].push(p); if (tracks[i].length > 900) tracks[i].shift(); });
      }
    }

    /* 渲染 */
    function render(t) {
      const g = ctx; g.setTransform(1, 0, 0, 1, 0, 0);
      const vb = worldXform(g);
      drawWorld(g, vb, false, t);
      drawTracks(g);
      if (assistOn() && !S.over) drawAssist(g, t);
      drawMeasure(g);
      drawCar(g, S.car, t, {});
      if (opts.view === 'god') { // 视野内标出车辆
        g.strokeStyle = 'rgba(56,189,248,.9)'; g.lineWidth = 3 / cam.ppm; g.beginPath(); g.arc(S.car.x + Math.cos(S.car.th) * 1.25, S.car.y + Math.sin(S.car.th) * 1.25, 3.4, 0, 2 * PI); g.stroke();
      }
      g.setTransform(1, 0, 0, 1, 0, 0);
    }
    function updateWheelUI() {
      const sw = S.car.sw;
      wheelSvg.style.transform = `rotate(${sw.toFixed(1)}deg)`;
      const turns = Math.abs(sw) / 360, s = Math.abs(sw) < 3 ? '回正' : `${sw < 0 ? '左' : '右'} ${Math.round(Math.abs(sw))}° (${turns.toFixed(2)}圈)${Math.abs(sw) > 535 ? ' 打死' : ''}`;
      if (wheelTxt.textContent !== s) wheelTxt.textContent = s;
      const c = S.car;
      for (const p in pedEls) { const v = c[p]; const i = pedEls[p].querySelector('i'); const hh = (v * 100).toFixed(0) + '%'; if (i.style.height !== hh) i.style.height = hh; }
    }

    function loop(now) {
      raf = requestAnimationFrame(loop);
      let dt = Math.min(0.1, (now - last) / 1000); last = now; if (!(dt > 0)) dt = 0.016;
      const PH = 1 / 120;
      if (!paused) {
        acc += dt; let n = 0;
        while (acc >= PH && n < 24) { applyInput(PH); S.step(PH); recordTracks(); acc -= PH; n++; }
        if (n >= 24) acc = 0;
        handleEvents();
      }
      updateCam(dt);
      const t = S.t;
      render(t);
      frameN++;
      perf.t += dt; perf.n++; // 自适应分辨率：低端机掉帧时降低渲染倍率
      if (perf.t > 1.5) { if (perf.t / perf.n > 0.03 && dpr > 1.01) { maxDpr = Math.max(1, dpr - 0.5); layout(); } perf.t = perf.n = 0; }
      if (opts.mirrors && (frameN % 2 === 0)) mirrors.forEach((m, i) => { if ((frameN / 2 + i) % (W > 900 ? 1 : 2) === 0 || frameN < 4) renderMirror(m, S.car, t); });
      drawCluster(dctx, dashCv.width, dashCv.height, S.car, t, { stalled: !S.car.on && S.t - stalledT < 4 && stalledT > 0 });
      updateWheelUI();
      const blink = S.car.sig && (t % 0.8) < 0.42;
      if (!!blink !== lastBlink) { lastBlink = !!blink; if (S.car.sig || !blink) sfx(blink ? 'tick' : 'tock'); }
      if (now - hudT > 120) { hudT = now; updateHUD(); syncButtons(); syncGear(); }
      if (audio) { const c = S.car; audio.update(c.we * W2RPM, Math.max(c.thr, manual ? (1 - engage(c.clu)) * 0.2 * (c.gear !== 'N' ? 1 : 0) : 0), c.on); }
    }

    /* 开始 */
    const onResize = () => { layout(); };
    const onVis = () => { if (document.hidden) { clearKeys(); if (!overlay && started) openPause(); } };
    window.addEventListener('keydown', onKey); window.addEventListener('keyup', onKey); window.addEventListener('resize', onResize); window.addEventListener('blur', clearKeys);
    document.addEventListener('visibilitychange', onVis);
    let ro = null; if (window.ResizeObserver) { ro = new ResizeObserver(onResize); ro.observe(root); }
    layout(); syncGear(); syncButtons(); updateHUD();
    if (!S.exam) { cam.x = S.car.x; cam.y = S.car.y; }
    if (mode === 'exam') {
      paused = true;
      const n = S.order.length, items = S.order.map(id => ITEMS[id].name).join(' → ');
      openOverlay('start', `<div class="s2-card"><h3>${item === 'exam' ? '科目二 · 全真模拟考试' : ITEMS[item].name + ' · 单项考试'}</h3>
        <div class="muted small" style="margin-bottom:8px">${manual ? '小型汽车 C1（手动挡）' : '小型自动挡汽车 C2'} · 满分100分，80分及格</div>
        ${item === 'exam' ? `<div class="note small">考试路线（共${n}项）：${items}。沿白色虚线道路依次驶入各项目，系统自动评判并语音播报。${!manual ? '<br>C2 不考坡道定点停车和起步。' : ''}</div>` : `<div class="note small">${ITEMS[item].limit ? '限时 ' + ITEMS[item].limit + ' 秒，' : ''}评判标准与正式考试一致，出现不合格项立即结束。</div>`}
        <ol style="padding-left:20px;font-size:14px;margin:10px 0"><li>上车先<b>系安全带</b>（未系即起步 = 不合格）</li><li>${manual ? '踩离合，' : '挡位 P，踩刹车，'}<b>点火</b>启动发动机</li><li>${manual ? '挂一挡，' : '挂 D 挡，'}<b>松手刹</b>起步（未松手刹扣10分）</li></ol>
        <div class="s2-mrow"><button class="btn primary lg" data-r="go">开始考试</button><button class="btn" data-r="back">返回</button></div></div>`,
      { go: () => { started = true; closeOverlay(); ensureAudio(); say(item === 'exam' ? '科目二考试开始，请系好安全带，按照考试路线行驶' : ITEMS[item].name + '考试开始', true); }, back: () => App.go('#/k2') });
    } else {
      say(item === 'free' ? '自由练习' : demo ? ITEMS[item].name + '，教学演示' : ITEMS[item].name + '，练习开始', true);
      if (!App.isTouch() && !opts.kh && W >= 900) toggleKH(true);
    }
    last = performance.now(); raf = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(raf); timers.forEach(clearTimeout); clearTimeout(bannerT);
      window.removeEventListener('keydown', onKey); window.removeEventListener('keyup', onKey); window.removeEventListener('resize', onResize); window.removeEventListener('blur', clearKeys);
      document.removeEventListener('visibilitychange', onVis); if (ro) ro.disconnect();
      if (audio) audio.close(); audio = null; App.stopSpeak(); App.immersive(false); S = null;
    };
  }

  let cleanup = null;
  App.define('sim2', {
    mount(el, { path, query }) {
      injectCSS();
      try { cleanup = path[1] ? sim(el, path[1], query || {}) : hub(el); } catch (e) { console.error(e); el.innerHTML = `<div class="card"><b>模拟器出错</b><pre class="small">${esc(e.stack || e)}</pre></div>`; }
    },
    unmount() { if (cleanup) { try { cleanup(); } catch (e) { console.error(e); } } cleanup = null; }
  });
})();
