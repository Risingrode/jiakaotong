/* 驾考通 · 科目三 道路驾驶技能模拟器（sim3）
 * 伪3D城市道路 / 真实车辆物理（手动 C1·自动 C2）/ 交通流 / 电子路考评判 / 灯光模拟考试
 * 纯 Canvas 2D，无外部资源。 */
(function () {
'use strict';
const HAS_DOM = typeof window !== 'undefined' && typeof document !== 'undefined';
const PI = Math.PI, TAU = PI * 2;
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const lerp = (a, b, t) => a + (b - a) * t;
const angN = a => { a = (a + PI) % TAU; if (a < 0) a += TAU; return a - PI; };
const kmh = v => v * 3.6;
let rnd = Math.random;
function seedRand(seed) { let s = (seed >>> 0) || 1; rnd = () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; }
const rr = (a, b) => a + rnd() * (b - a);
const pick = a => a[(rnd() * a.length) | 0];

/* ======================= 评判规则（GA 1026 / 公安部令第162号 考试内容与评判标准） ======================= */
const RULES = {
  belt: ['不按规定使用安全带', 100], cmd: ['不按考试员指令驾驶', 100],
  red: ['不按交通信号灯通行（闯红灯）', 100], speed: ['驾驶过程中车速超过限速', 100],
  center: ['车辆行驶中骑轧车道中心实线', 100], edge: ['车辆行驶中骑轧车道边缘实线', 100],
  solid: ['越过或骑轧车道分界实线，违反交通标线', 100], wrongway: ['逆向行驶，违反交通安全法律法规影响交通安全', 100],
  crash: ['发生碰撞，因操作不当出现危险情况', 100], curb: ['车辆驶出路面、碰撞路缘', 100],
  ped: ['遇行人通过人行横道不停车让行', 100], nosig: ['不使用转向灯', 100], wrongsig: ['错误使用转向灯', 100],
  sig3: ['开启转向灯不足3秒即转向', 100], noobs: ['未按规定观察后方及侧方交通情况', 100],
  lanerule: ['不按导向车道行驶', 100], coast: ['行驶中空挡滑行', 100], unstable: ['方向控制不稳，不能保持车辆直线运动状态', 100],
  rollback: ['起步时车辆后溜距离大于30cm', 100], slowzone: ['不按规定减速慢行', 100],
  horn: ['在禁止鸣喇叭区域鸣喇叭，违反禁令标志', 100], overright: ['从右侧超车', 100],
  cutin: ['超车后急转向驶回原车道，妨碍被超越车辆正常行驶', 100], uturn2: ['掉头不能一次完成（倒车调整）', 100],
  uturnPlace: ['掉头地点选择不当', 100], overEdge: ['停车后车身超过道路右侧边缘线', 100],
  doorObs: ['打开车门前不侧头观察侧后方交通情况', 100], noCheck: ['不绕车一周检查车辆外观及安全状况', 100],
  startGear: ['启动发动机时挡位未置于空挡（驻车挡）', 100], lights: ['不能正确使用灯光', 100],
  meet: ['会车时不减速靠右行驶', 100], hb: ['不松驻车制动器起步，未能及时纠正', 100], gearop: ['未按指令平稳加、减挡', 100],
  stall: ['发动机熄火一次', 10], hb10: ['不松驻车制动器起步，能及时纠正', 10], roll10: ['起步时车辆后溜，后溜距离小于30cm', 10],
  rpm: ['挡位与车速长时间不匹配，造成发动机转速过高或过低', 10], straddle: ['长时间骑轧车道分界线行驶', 10],
  grind: ['换挡时未踩离合器，发生齿轮撞击', 10], clutchCoast: ['长时间踩离合器滑行', 10],
  park30: ['停车后车身距离道路右侧边缘线超出30cm', 10], noHB: ['停车后未拉紧驻车制动器', 10],
  hbOrder: ['拉紧驻车制动器前放松行车制动踏板', 10], jerk: ['起步时车辆发生闯动', 10],
  noObsStraight: ['直线行驶中不适时通过后视镜观察后方交通情况', 10],
  engineOff: ['下车前不将发动机熄火', 5], prepSeat: ['启动发动机前不调整驾驶座椅、后视镜、检查仪表', 5]
};

/* ======================= 灯光 ======================= */
function mkLights() { return { rot: 0, high: false, flash: false, turn: '', hazard: false, fogF: false, fogR: false }; }
function beam(L) { return (L.flash || (L.rot === 2 && L.high)) ? 'high' : L.rot === 2 ? 'low' : 'off'; }
const LT = [
  { id: 'on', q: '请开启前照灯', a: '开启近光灯（灯光旋钮旋至近光挡）', req: 'low', exp: '夜间行驶开启前照灯，即开启近光灯，示廓灯随之点亮。' },
  { id: 'dark', q: '夜间在没有路灯、照明不良的条件下行驶', a: '开启远光灯', req: 'high', exp: '无路灯、照明不良时使用远光灯看清远处路况（实施条例第58条）；遇对向来车或跟车时须改用近光。' },
  { id: 'lit', q: '夜间在有路灯、照明良好的道路上行驶', a: '开启近光灯', req: 'low', exp: '照明良好的道路使用远光会使他人眩目，应使用近光灯。' },
  { id: 'follow', q: '夜间同方向近距离跟车行驶', a: '开启近光灯', req: 'low', exp: '同方向行驶的后车与前车近距离行驶时，不得使用远光灯（实施条例第58条）。' },
  { id: 'meet', q: '夜间与机动车会车', a: '开启近光灯', req: 'low', exp: '夜间会车应当在距相对方向来车150米以外改用近光灯（实施条例第48条）。' },
  { id: 'curve', q: '夜间通过急弯、坡路、拱桥、人行横道或者没有交通信号灯控制的路口', a: '远、近光灯交替使用（至少两次），最后保持近光', req: 'alt', exp: '夜间通过急弯、坡路、拱桥、人行横道或者没有交通信号灯控制的路口时，应当交替使用远近光灯示意（实施条例第59条）。' },
  { id: 'over', q: '夜间超越前方车辆', a: '开启左转向灯，并交替使用远、近光灯', req: 'over', exp: '超车时应提前开启左转向灯、变换使用远近光灯或者鸣喇叭（实施条例第47条），夜间以灯光示意代替喇叭。' },
  { id: 'cross', q: '夜间直行通过有交通信号灯控制的路口', a: '开启近光灯', req: 'low', exp: '通过有信号灯控制的路口使用近光灯，不得使用远光灯。' },
  { id: 'bike', q: '夜间在窄路、窄桥与非机动车会车', a: '开启近光灯', req: 'low', exp: '在窄路、窄桥与非机动车会车时应当使用近光灯（实施条例第48条）。' },
  { id: 'park', q: '夜间在路边临时停车', a: '关闭前照灯，开启示廓灯和危险报警闪光灯', req: 'park', exp: '夜间路边临时停车应关闭前照灯，开启示廓灯（后位灯）和危险报警闪光灯，提示后方来车。' },
  { id: 'fault', q: '夜间在道路上发生故障，妨碍交通又难以移动', a: '开启示廓灯和危险报警闪光灯', req: 'park', exp: '应按规定开启危险报警闪光灯，夜间还应同时开启示廓灯和后位灯，并在来车方向50~100米处设置警告标志（实施条例第60条）。' },
  { id: 'tunnel', q: '夜间进入隧道行驶', a: '开启近光灯', req: 'low', practice: 1, exp: '隧道内应开启近光灯，不得使用远光，不得超车、掉头、停车。' },
  { id: 'fog', q: '在雾天行驶', a: '开启雾灯、示廓灯和危险报警闪光灯', req: 'fog', practice: 1, exp: '机动车雾天行驶应当开启雾灯和危险报警闪光灯（实施条例第58条），同时开启示廓灯、前照灯（近光）。' },
  { id: 'off', q: '模拟夜间考试完成，请关闭所有灯光', a: '关闭所有灯光（旋钮回 OFF，关闭转向灯、危险报警灯）', req: 'off', exp: '考试结束须关闭所有灯光。' }
];
const LTI = {}; LT.forEach(t => LTI[t.id] = t);
function gradeLight(task, L, ev) {
  const b = beam(L), e = [];
  const changes = ev.length - 1;
  switch (task.req) {
    case 'low': if (b !== 'low') e.push(b === 'high' ? '不应使用远光灯' : '近光灯未开启'); if (L.hazard) e.push('危险报警闪光灯未关闭'); break;
    case 'high': if (b !== 'high') e.push(b === 'low' ? '仍为近光，应开启远光灯' : '未开启前照灯'); if (L.hazard) e.push('危险报警闪光灯未关闭'); break;
    case 'alt': case 'over':
      if (changes < 3) e.push('远近光交替次数不足（应至少交替两次）');
      if (b !== 'low') e.push(b === 'high' ? '交替后应恢复近光' : '交替后应保持近光灯');
      if (task.req === 'over' && L.turn !== 'L') e.push('未开启左转向灯');
      if (L.hazard) e.push('危险报警闪光灯未关闭'); break;
    case 'park':
      if (L.rot !== 1) e.push(L.rot === 2 ? '前照灯应关闭，只保留示廓灯' : '示廓灯未开启');
      else if (b === 'high') e.push('不应开启远光灯');
      if (!L.hazard) e.push('未开启危险报警闪光灯'); break;
    case 'fog':
      if (!L.fogF && !L.fogR) e.push('未开启雾灯'); if (!L.rot) e.push('未开启示廓灯/前照灯'); if (!L.hazard) e.push('未开启危险报警闪光灯'); break;
    case 'off':
      if (L.rot || b !== 'off') e.push('前照灯/示廓灯未关闭'); if (L.hazard) e.push('危险报警闪光灯未关闭');
      if (L.fogF || L.fogR) e.push('雾灯未关闭'); if (L.turn) e.push('转向灯未关闭'); break;
  }
  if (task.req !== 'over' && task.req !== 'off' && L.turn) e.push('转向灯未关闭');
  return e;
}
function lightExamTasks() {
  const pool = LT.filter(t => !t.practice && t.id !== 'on' && t.id !== 'off').map(t => t.id);
  const out = ['on'];
  while (out.length < 5) { const id = pick(pool); if (out.includes(id)) continue; if ((id === 'park' && out.includes('fault')) || (id === 'fault' && out.includes('park'))) continue; out.push(id); }
  out.push('off'); return out.map(id => LTI[id]);
}
/* 灯光考试流程：speak → (语音结束) go() → 5 秒 → grade → next */
function LightTest(tasks, on, gap) { this.tasks = tasks; this.i = -1; this.ph = 'idle'; this.res = []; this.on = on; this.gap = gap || 0.6; this.left = 0; this.ev = []; }
LightTest.prototype.next = function () {
  this.i++;
  if (this.i >= this.tasks.length) { this.ph = 'done'; this.on('done', this.res); return; }
  this.ph = 'speak'; this.on('speak', this.tasks[this.i]);
};
LightTest.prototype.go = function (L) {
  if (this.ph !== 'speak') return;
  const t = this.tasks[this.i];
  if (t.intro) { this.ph = 'gap'; this.left = 0.8; return; }
  this.ph = 'wait'; this.left = 5; this.ev = [beam(L)]; this.on('wait', t);
};
LightTest.prototype.tick = function (dt, L) {
  if (this.ph === 'gap') { this.left -= dt; if (this.left <= 0) this.next(); return; }
  if (this.ph !== 'wait') return;
  const b = beam(L); if (b !== this.ev[this.ev.length - 1]) this.ev.push(b);
  this.left -= dt;
  if (this.left <= 0) {
    const t = this.tasks[this.i], errs = gradeLight(t, L, this.ev);
    const r = { t, errs, ok: !errs.length }; this.res.push(r); this.on('graded', r);
    this.ph = 'gap'; this.left = this.gap;
  }
};
const LT_INTRO = { intro: true, q: '下面将进行模拟夜间行驶场景灯光使用的考试，请在语音播报结束后5秒内做出相应的灯光操作' };

/* ======================= 世界（数据驱动的小城路网） ======================= */
const LW = 3.5, HALF = 7, CURB = 9.5, WALK = 4.5, SL = 16;
const GX = [0, 640, 1180], GY = [0, 520, 1040];
const LIMITS = { H00: 40, H01: 60, H02: 60, H10: 50, H11: 60, H20: 50, H21: 60, V00: 40, V01: 40, V10: 50, V11: 50, V20: 50, V21: 50 };
const PH = [{ ax: 'NS', mv: 'S', g: 16 }, { ax: 'NS', mv: 'L', g: 9 }, { ax: 'EW', mv: 'S', g: 16 }, { ax: 'EW', mv: 'L', g: 9 }];
const CYC = PH.reduce((a, p) => a + p.g + 4, 0);
const PHS = []; { let a = 0; PH.forEach(p => { PHS.push(a); a += p.g + 4; }); }
function sigState(node, ax, mv, t) {
  if (!node.sig) return { c: 'G', left: 99 };
  if (mv === 'R') mv = 'S'; if (mv === 'U') mv = 'L';
  const tt = ((t + node.off) % CYC + CYC) % CYC;
  let k = 0; for (let i = 0; i < 4; i++) if (PH[i].ax === ax && PH[i].mv === mv) k = i;
  const st = PHS[k], p = PH[k], inP = tt - st;
  if (inP >= 0 && inP < p.g) return { c: 'G', left: p.g - inP };
  if (inP >= p.g && inP < p.g + 3) return { c: 'Y', left: p.g + 3 - inP };
  return { c: 'R', left: ((st - tt) % CYC + CYC) % CYC };
}
function roadPt(r, s, u) { return { x: r.ax + r.dx * s + r.dy * u, y: r.ay + r.dy * s - r.dx * u }; }
function toRoad(r, x, y) { const X = x - r.ax, Y = y - r.ay; return { s: X * r.dx + Y * r.dy, u: X * r.dy - Y * r.dx }; }
function lineType(r, w, s) {
  if (s < SL || s > r.len - SL) return null;
  switch (w) {
    case 'c': return (r.uturn && s > r.uturn[0] && s < r.uturn[1]) ? 'dash' : 'solid';
    case 'd+': return s > r.len - SL - 30 ? 'solid' : 'dash';
    case 'd-': return s < SL + 30 ? 'solid' : 'dash';
    case 'e+': if (r.start0 && s < r.start0) return 'dash'; return (r.bay && s > r.bay[0] && s < r.bay[1]) ? 'dash' : 'solid';
    case 'e-': return (r.uturn && s > r.uturn[0] - 12 && s < r.uturn[1] + 12) ? 'dash' : 'solid';
  }
  return null;
}
function classify(hx, hy, ox, oy) {
  const d = hx * ox + hy * oy, c = hx * oy - hy * ox;
  if (d > 0.7) return 'S'; if (d < -0.7) return 'U'; return c > 0 ? 'L' : 'R';
}
function bez(p0, p1, p2, p3, n) {
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n, a = (1 - t) ** 3, b = 3 * (1 - t) ** 2 * t, c = 3 * (1 - t) * t * t, d = t ** 3;
    pts.push({ x: a * p0.x + b * p1.x + c * p2.x + d * p3.x, y: a * p0.y + b * p1.y + c * p2.y + d * p3.y });
  }
  return pts;
}
function mkPoly(pts) {
  const cum = [0]; for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y));
  return { pts, cum, len: cum[cum.length - 1] };
}
function pathAt(P, s) {
  if (P.kind === 'lane') return { x: P.x0 + P.hx * s, y: P.y0 + P.hy * s, h: P.h };
  const c = P.cum, pts = P.pts; s = clamp(s, 0, P.len);
  let i = 1; while (i < c.length - 1 && c[i] < s) i++;
  const a = pts[i - 1], b = pts[i], t = (s - c[i - 1]) / ((c[i] - c[i - 1]) || 1);
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, h: Math.atan2(b.y - a.y, b.x - a.x) };
}

let WORLD = null;
function getWorld() { if (!WORLD) { const sv = rnd; seedRand(20240601); WORLD = buildWorld(); rnd = sv; } return WORLD; }
function buildWorld() {
  const W = { nodes: [], roads: [], lanes: [], cws: [], signs: [], zones: [], lamps: [], trees: [], blds: [], props: [], R: {}, N: {} };
  for (let j = 0; j < 3; j++) for (let i = 0; i < 3; i++) {
    const n = { id: 'N' + i + j, i, j, x: GX[i], y: GY[j], legs: [], off: (i * 23 + j * 37) % CYC };
    W.nodes.push(n); W.N[n.id] = n;
  }
  const addRoad = (id, a, b) => {
    const len = Math.hypot(b.x - a.x, b.y - a.y), dx = (b.x - a.x) / len, dy = (b.y - a.y) / len;
    const r = { id, a, b, ax: a.x, ay: a.y, dx, dy, len, hz: Math.abs(dx) > 0.5, limit: LIMITS[id] || 50, h: Math.atan2(dy, dx), lanes: [] };
    W.roads.push(r); W.R[id] = r;
    a.legs.push({ road: r, out: 1, ox: dx, oy: dy }); b.legs.push({ road: r, out: -1, ox: -dx, oy: -dy });
  };
  for (let j = 0; j < 3; j++) for (let i = 0; i < 2; i++) addRoad('H' + j + i, W.N['N' + i + j], W.N['N' + (i + 1) + j]);
  for (let i = 0; i < 3; i++) for (let j = 0; j < 2; j++) addRoad('V' + i + j, W.N['N' + i + j], W.N['N' + i + (j + 1)]);
  W.nodes.forEach(n => n.sig = n.legs.length >= 3);
  // 特殊路段
  const A = W.R.H00, B = W.R.V10, C = W.R.V11, D = W.R.H21;
  D.uturn = [380, 415]; C.bay = [110, 172]; A.start0 = 75;
  W.zones.push({ road: B, s0: 280, s1: 420, type: 'school', limit: 30, name: '学校区域' });
  W.zones.push({ road: C, s0: 100, s1: 172, type: 'bus', limit: 0, name: '公交车站' });
  // 车道
  W.roads.forEach(r => {
    [1, -1].forEach(d => [0, 1].forEach(k => {
      const u = d * (k + 0.5) * LW, s0 = d > 0 ? SL : r.len - SL, p = roadPt(r, s0, u);
      const L = { kind: 'lane', id: r.id + (d > 0 ? '+' : '-') + k, road: r, d, k, u, x0: p.x, y0: p.y, hx: r.dx * d, hy: r.dy * d, h: Math.atan2(r.dy * d, r.dx * d), len: r.len - 2 * SL, start: d > 0 ? r.a : r.b, end: d > 0 ? r.b : r.a, conns: [] };
      W.lanes.push(L); r.lanes.push(L);
    }));
  });
  const laneOf = (r, d, k) => r.lanes.find(l => l.d === d && l.k === k);
  W.laneOf = laneOf;
  // 路口连接线
  W.lanes.forEach(L => {
    const N = L.end;
    N.legs.forEach(g => {
      if (g.road === L.road) return;
      const m = classify(L.hx, L.hy, g.ox, g.oy);
      if (N.legs.length >= 3) { if (L.k === 0 && m === 'R') return; if (L.k === 1 && m === 'L') return; }
      const k2 = N.legs.length < 3 ? L.k : m === 'L' ? 0 : m === 'R' ? 1 : L.k;
      const E = laneOf(g.road, g.out, k2);
      const p0 = { x: L.x0 + L.hx * L.len, y: L.y0 + L.hy * L.len }, p3 = { x: E.x0, y: E.y0 };
      const dd = Math.hypot(p3.x - p0.x, p3.y - p0.y) * (m === 'S' ? 0.33 : 0.5);
      const pts = bez(p0, { x: p0.x + L.hx * dd, y: p0.y + L.hy * dd }, { x: p3.x - E.hx * dd, y: p3.y - E.hy * dd }, p3, m === 'S' ? 3 : 12);
      const P = mkPoly(pts); P.kind = 'conn'; P.m = m; P.from = L; P.to = E; P.node = N;
      L.conns.push(P);
    });
  });
  // 人行横道（路段中间）
  const addCw = (r, s, school) => { const c = roadPt(r, s, 0); W.cws.push({ road: r, s, x: c.x, y: c.y, ux: r.dy, uy: -r.dx, peds: [], timer: rr(2, 8), school }); };
  addCw(B, 150); addCw(B, 350, true); addCw(W.R.H01, 300); addCw(W.R.H11, 240);
  // 标志
  const sign = (r, s, side, kind, val, d) => { // side: +1 = 道路 dir 右侧
    const p = roadPt(r, s, side * (CURB + 0.9));
    W.signs.push({ x: p.x, y: p.y, fh: angN(r.h + (d > 0 ? PI : 0)), kind, val, road: r });
  };
  W.roads.forEach(r => {
    sign(r, 34, 1, 'speed', r.limit, 1); sign(r, r.len - 34, -1, 'speed', r.limit, -1);
  });
  sign(B, 245, 1, 'school', 0, 1); sign(B, 262, 1, 'speed', 30, 1); sign(B, 440, -1, 'school', 0, -1); sign(B, 430, -1, 'speed', 30, -1);
  sign(B, 300, 1, 'nohorn', 0, 1); sign(B, 400, -1, 'nohorn', 0, -1);
  sign(B, 115, 1, 'cw', 0, 1); sign(B, 185, -1, 'cw', 0, -1); sign(B, 330, 1, 'cw', 0, 1);
  sign(C, 104, 1, 'bus', 0, 1); sign(D, 360, 1, 'uturn', 0, 1);
  sign(B, 268, 1, 'schoolname', 0, 1);
  // 公交站：停靠公交车 + 候车亭
  { const p = roadPt(C, 140, 8.25); W.props.push({ kind: 'bus', x: p.x, y: p.y, h: C.h, l: 11, w: 2.5, ht: 3.1, col: [40, 150, 90] }); }
  { const p = roadPt(C, 126, CURB + 2.4); W.props.push({ kind: 'shelter', x: p.x, y: p.y, h: C.h }); }
  // 学校
  { const p = roadPt(B, 350, 42); W.blds.push({ x: p.x, y: p.y, h: B.h, l: 110, w: 26, z: 16, col: [235, 214, 176], roof: [186, 80, 60], school: 1 }); }
  { const p = roadPt(B, 350, CURB + WALK + 1.2); W.props.push({ kind: 'fence', x: p.x, y: p.y, h: B.h, l: 130 }); }
  { const p = roadPt(B, 300, CURB + WALK + 1.6); W.props.push({ kind: 'gate', x: p.x, y: p.y, h: B.h }); }
  // 建筑 / 树 / 路灯
  const PAL = [[214, 209, 200], [190, 200, 214], [222, 200, 184], [176, 188, 196], [235, 228, 214], [160, 176, 190], [204, 186, 170], [196, 214, 204], [220, 220, 226]];
  W.roads.forEach(r => {
    [1, -1].forEach(side => {
      const outer = (r.hz && ((r.ay === 0 && side === 1) || (r.ay === GY[2] && side === -1))) || (!r.hz && ((r.ax === 0 && side === -1) || (r.ax === GX[2] && side === 1)));
      let s = 38;
      while (s < r.len - 38) {
        const l = rr(16, 42); if (s + l > r.len - 36) break;
        const skip = (r === B && side === 1 && s + l > 250 && s < 440) || (r === C && side === 1 && s + l > 100 && s < 180);
        if (!skip && !outer) {
          const dep = rr(12, 20), set = CURB + WALK + rr(3, 7), p = roadPt(r, s + l / 2, side * (set + dep / 2));
          const tall = rnd() < 0.25;
          W.blds.push({ x: p.x, y: p.y, h: r.h, l, w: dep, z: tall ? rr(30, 58) : rr(8, 24), col: pick(PAL), roof: null, win: rnd() < 0.85 });
        } else if (outer && rnd() < 0.5) {
          for (let q = 0; q < 3; q++) { const p = roadPt(r, s + rr(0, l), side * rr(22, 70)); W.trees.push({ x: p.x, y: p.y, r: rr(2.2, 3.6), ht: rr(6, 10) }); }
        }
        s += l + rr(4, 14);
      }
      for (let ts = 26; ts < r.len - 24; ts += 15) {
        if (W.cws.some(c => c.road === r && Math.abs(c.s - ts) < 6)) continue;
        if (r === C && side === 1 && ts > 100 && ts < 175) continue;
        const p = roadPt(r, ts, side * (CURB + 1.3)); W.trees.push({ x: p.x, y: p.y, r: rr(1.8, 2.5), ht: rr(5, 7) });
      }
      for (let ls = 30 + (side > 0 ? 0 : 22); ls < r.len - 20; ls += 44) {
        const p = roadPt(r, ls, side * (CURB + 0.45)); W.lamps.push({ x: p.x, y: p.y, h: angN(r.h - side * PI / 2) });
      }
    });
  });
  return W;
}
function locate(W, x, y) {
  for (const n of W.nodes) if (Math.abs(x - n.x) <= CURB && Math.abs(y - n.y) <= CURB) return { node: n };
  for (const r of W.roads) {
    const X = x - r.ax, Y = y - r.ay, s = X * r.dx + Y * r.dy;
    if (s < 0 || s > r.len) continue;
    const u = X * r.dy - Y * r.dx;
    if (Math.abs(u) <= CURB + WALK) return { road: r, s, u };
  }
  return null;
}
function drivable(W, x, y) {
  for (const n of W.nodes) if (Math.abs(x - n.x) <= CURB + 0.05 && Math.abs(y - n.y) <= CURB + 0.05) return true;
  for (const r of W.roads) {
    const X = x - r.ax, Y = y - r.ay, s = X * r.dx + Y * r.dy;
    if (s < 0 || s > r.len) continue;
    if (Math.abs(X * r.dy - Y * r.dx) <= CURB) return true;
  }
  return false;
}
function zoneAt(W, r, s) { for (const z of W.zones) if (z.road === r && s >= z.s0 && s <= z.s1) return z; return null; }

/* ======================= 车辆物理 ======================= */
const GR = { R: -3.4, N: 0, 1: 3.55, 2: 2.05, 3: 1.38, 4: 1.03, 5: 0.82 }, FD = 4.1, RW = 0.31, MASS = 1250, WB = 2.6, MAXD = 0.6, SR = 14.5;
const SWMAX = MAXD * SR, IDLE = 84, CAR_L = 4.6, CAR_W = 1.8;
function mkCar(manual) {
  return { x: 0, y: 0, h: 0, v: 0, sw: 0, manual: !!manual, gear: manual ? 'N' : 'P', w: 0, on: false, clutch: 0, thr: 0, brk: 0, hb: true,
    belt: false, L: mkLights(), odo: 0, acc: 0, stallEvt: false, Tc: 0 };
}
function engT(w, thr) { const rpm = w * 9.549; return thr * Math.max(60, 158 * (1 - ((rpm - 3800) / 4800) ** 2)); }
function physStep(c, dt) {
  let Fd = 0, hold = 0;
  if (c.manual) {
    const G = (GR[c.gear] || 0) * FD, e = clamp((0.72 - c.clutch) / 0.45, 0, 1);
    let Te;
    if (c.on) { const thr = c.w > 640 ? 0 : c.thr; Te = engT(c.w, thr) + clamp((IDLE + 4 - c.w) * 4, 0, 60) - (12 + 0.03 * c.w) * (1 - 0.6 * thr); }
    else Te = c.w > 0 ? -(25 + 0.05 * c.w) : 0;
    let Tc = 0;
    if (G !== 0 && e > 0) { const wi = c.v / RW * G; Tc = e * 330 * Math.tanh((c.w - wi) / 15); }
    c.Tc = Tc;
    c.w += (Te - Tc) / 0.2 * dt;
    if (!c.on && c.w < 0 && !(G !== 0 && e > 0.5)) c.w = 0;
    if (c.on && c.w < 32) { c.on = false; c.stallEvt = true; }
    Fd = Tc * G / RW;
  } else {
    const sp = Math.abs(c.v);
    if (c.on && (c.gear === 'D' || c.gear === 'R')) {
      const creep = 520 * clamp(1 - sp / 2.2, 0, 1), Fm = Math.min(4300, 42000 / Math.max(sp, 4));
      Fd = (creep + c.thr * Fm) * (c.gear === 'R' ? -0.75 : 1);
    }
    if (c.gear === 'P') hold = 1e6;
    const vg = sp < 4.2 ? 1 : sp < 8.3 ? 2 : sp < 12.5 ? 3 : sp < 16.7 ? 4 : 5;
    c.ag = vg;
    const tw = c.on ? Math.max(IDLE + c.thr * (c.gear === 'D' || c.gear === 'R' ? 190 : 400), (c.gear === 'D' || c.gear === 'R') ? sp / RW * GR[vg] * FD * 1.04 : 0) : 0;
    c.w += (tw - c.w) * Math.min(1, dt * 6);
  }
  const Fb = c.brk * 9500 + (c.hb ? 4200 : 0) + hold, Fr = 150 + 0.42 * c.v * c.v;
  if (Math.abs(c.v) < 0.03 && Math.abs(Fd) <= Fb + Fr) { c.acc = -c.v / dt; c.v = 0; }
  else {
    const dir = c.v !== 0 ? Math.sign(c.v) : Math.sign(Fd);
    const nv = c.v + (Fd - dir * (Fb + Fr)) / MASS * dt;
    const v2 = (c.v !== 0 && Math.sign(nv) !== Math.sign(c.v)) ? 0 : nv;
    c.acc = (v2 - c.v) / dt; c.v = v2;
  }
  const d = clamp(c.sw / SR, -MAXD, MAXD), hd = c.v * Math.tan(d) / WB;
  c.h = angN(c.h + hd * dt);
  c.x += (c.v * Math.cos(c.h) - hd * 1.3 * Math.sin(c.h)) * dt;
  c.y += (c.v * Math.sin(c.h) + hd * 1.3 * Math.cos(c.h)) * dt;
  c.odo += Math.abs(c.v) * dt;
}
function rpmOf(c) { return c.w * 9.549; }
function corners(x, y, h, l, w) {
  const c = Math.cos(h), s = Math.sin(h), a = l / 2, b = w / 2;
  return [[x + c * a - s * b, y + s * a + c * b], [x + c * a + s * b, y + s * a - c * b], [x - c * a + s * b, y - s * a - c * b], [x - c * a - s * b, y - s * a + c * b]];
}
function obbHit(A, B) { // A,B: {x,y,h,l,w}
  if (Math.abs(A.x - B.x) + Math.abs(A.y - B.y) > (A.l + B.l) * 0.75 + 2) return false;
  const ca = corners(A.x, A.y, A.h, A.l, A.w), cb = corners(B.x, B.y, B.h, B.l, B.w);
  for (const h of [A.h, A.h + PI / 2, B.h, B.h + PI / 2]) {
    const ax = Math.cos(h), ay = Math.sin(h);
    let a0 = 1e9, a1 = -1e9, b0 = 1e9, b1 = -1e9;
    for (const p of ca) { const d = p[0] * ax + p[1] * ay; a0 = Math.min(a0, d); a1 = Math.max(a1, d); }
    for (const p of cb) { const d = p[0] * ax + p[1] * ay; b0 = Math.min(b0, d); b1 = Math.max(b1, d); }
    if (a1 < b0 || b1 < a0) return false;
  }
  return true;
}
