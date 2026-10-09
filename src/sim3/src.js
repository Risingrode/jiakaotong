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

/* ======================= AI 交通 ======================= */
const CAR_COLS = [[200, 30, 40], [240, 240, 238], [30, 34, 40], [150, 156, 166], [32, 80, 170], [210, 200, 190], [90, 30, 30], [40, 110, 90], [235, 160, 40], [120, 140, 170]];
function chooseNext(a) { a.next = a.path.kind === 'lane' && a.path.conns.length ? pick(a.path.conns) : null; }
function futurePts(a, n, step) {
  const out = []; let P = a.path, s = a.s, nx = a.next;
  for (let i = 1; i <= n; i++) {
    s += step;
    while (s > P.len) { s -= P.len; if (P.kind === 'lane') { if (!nx) return out; P = nx; nx = null; } else P = P.to; }
    out.push(pathAt(P, s));
  }
  return out;
}
function aiStep(sim, a, dt) {
  const W = sim.W, P = a.path, t = sim.t;
  let v0 = a.v0, gap = 1e9, lv = 0;
  if (P.kind === 'lane') {
    const rem = P.len - a.s, rs = P.d > 0 ? a.s + SL : P.road.len - SL - a.s;
    v0 = Math.min(v0, P.road.limit / 3.6 * a.vf);
    const z = zoneAt(W, P.road, rs); if (z && z.limit) v0 = Math.min(v0, z.limit / 3.6 * 0.9);
    if (a.next && a.next.m !== 'S') v0 = Math.min(v0, (a.next.m === 'L' ? 7.5 : 5.5) + Math.max(0, rem - 8) * 0.25);
    if (a.next && P.end.sig) {
      const st = sigState(P.end, P.road.hz ? 'EW' : 'NS', a.next.m, t).c;
      if (st === 'G') a.commit = false;
      else if (!a.commit) {
        const ds = rem - a.l / 2 - 0.8;
        if (st === 'Y' && ds < a.v * a.v / 5 + 0.5) a.commit = true;
        else if (ds > -1.5) { gap = Math.max(0.1, ds); lv = 0; }
      }
    }
    for (const c of sim.cw) {
      if (c.cw.road !== P.road || !c.busy) continue;
      const cs = P.d > 0 ? c.cw.s - SL : P.road.len - SL - c.cw.s;
      const d = cs - 3.2 - a.s - a.l / 2;
      if (d > -1.5 && d < 70) gap = Math.min(gap, Math.max(0.1, d));
    }
  } else if (P.m !== 'S') v0 = Math.min(v0, P.m === 'L' ? 7.5 : 5.5);
  const fp = futurePts(a, 24, 3);
  const test = o => {
    if (o === a || Math.abs(o.x - a.x) + Math.abs(o.y - a.y) > 95) return;
    const ch = Math.cos(o.h), sh = Math.sin(o.h);
    for (let i = 0; i < fp.length; i++) {
      const dx = fp[i].x - o.x, dy = fp[i].y - o.y;
      const la = Math.abs(dx * ch + dy * sh) - o.l / 2, lb = Math.abs(-dx * sh + dy * ch) - o.w / 2;
      if (la < 1.0 && lb < 1.0) {
        const g = (i + 1) * 3 - a.l / 2 - 1.2;
        if (g < gap) { gap = Math.max(0.1, g); lv = Math.max(0, (o.v || 0) * Math.cos(o.h - fp[i].h)); }
        return;
      }
    }
  };
  for (const o of sim.ai) test(o);
  test(sim.plo); for (const o of sim.statics) test(o);
  const A0 = 1.6, B = 2.6, S0 = 2.2, T = 1.3;
  let acc = A0 * (1 - Math.pow(a.v / Math.max(v0, 0.5), 4));
  if (gap < 1e8) { const ss = S0 + a.v * T + a.v * (a.v - lv) / (2 * Math.sqrt(A0 * B)); acc -= A0 * Math.pow(Math.max(ss, 0) / Math.max(gap, 0.1), 2); }
  acc = clamp(acc, -8, A0);
  a.v = Math.max(0, a.v + acc * dt); a.brk = acc < -0.5 || a.v < 0.3; a.stuck = a.v < 0.2 ? (a.stuck || 0) + dt : 0;
  a.s += a.v * dt;
  while (a.s > a.path.len) {
    a.s -= a.path.len;
    if (a.path.kind === 'lane') a.path = a.next || a.path.conns[0];
    else { a.path = a.path.to; chooseNext(a); a.commit = false; }
  }
  const p = pathAt(a.path, a.s); a.x = p.x; a.y = p.y; a.h = p.h;
  const Q = a.path;
  a.sig = Q.kind === 'lane' ? (a.next && a.next.m !== 'S' && Q.len - a.s < 45 ? a.next.m : '') : (Q.m === 'L' || Q.m === 'R' ? Q.m : '');
}

/* ======================= 评判器 ======================= */
function Judge() { this.score = 100; this.fail = null; this.log = []; this.t = 0; this.last = {}; this.itemFail = {}; this.itemDed = {}; }
Judge.prototype.hit = function (code, item, note) {
  const r = RULES[code]; if (!r) return null;
  if (this.last[code] != null && this.t - this.last[code] < (r[1] >= 100 ? 4 : 8)) return null;
  this.last[code] = this.t;
  const e = { t: this.t, code, text: r[0], note: note || '', pts: r[1], item: item || '通用评判' };
  this.log.push(e); this.score = Math.max(0, this.score - r[1]);
  if (r[1] >= 100) { if (!this.fail) this.fail = e; this.itemFail[e.item] = 1; } else this.itemDed[e.item] = (this.itemDed[e.item] || 0) + r[1];
  return e;
};

/* ======================= 考试项目 ======================= */
const ITEMS = {};
const ITEM_ORDER = ['shangche', 'qibu', 'zhixian', 'jiajian', 'biandao', 'kaobian', 'zhixing', 'zuozhuan', 'youzhuan', 'renxing', 'xuexiao', 'gongjiao', 'huiche', 'chaoche', 'diaotou', 'yejian'];
const EXAM_SEQ = ['shangche', 'yejian', 'qibu', 'zhixian', 'jiajian', 'biandao', 'zuozhuan', 'renxing', 'xuexiao', 'zhixing', 'gongjiao', 'huiche', 'youzhuan', 'chaoche', 'diaotou', 'kaobian'];
const ROUTE_ROADS = { H00: 1, V10: 1, V11: 1, H21: 1 };
function IT(key, o) { o.key = key; ITEMS[key] = o; }
const onR = (sim, id, sMin) => sim.loc && sim.loc.road && sim.loc.road.id === id && sim.rr && sim.rr.sg > 0 && sim.loc.s >= sMin;
const laneIdx = sim => !sim.rr ? -9 : sim.rr.ur < 0 ? -1 : sim.rr.ur < 3.5 ? 0 : sim.rr.ur < 7 ? 1 : 2;
const sinceStart = (sim, S, k) => sim.obs[k] > S.t0 - 2;

IT('shangche', {
  name: '上车准备', ico: '检',
  steps: ['逆时针绕车一周，检查车辆外观、轮胎、车底及周围安全', '打开车门前向左回头观察后方交通情况', '上车后关好车门，调整座椅、后视镜，检查仪表', '系好安全带', '确认空挡（手动 N）或 P 挡（自动），点火启动发动机'],
  kj: '绕车一周看仔细，开门之前回头看；上车调座调镜子，安全带后再点火。',
  judge: ['不绕车一周检查车辆外观及安全状况，不合格', '打开车门前不观察后方交通情况，不合格', '启动发动机时挡位未置于空挡（驻车挡），不合格', '启动发动机前不调整座椅、后视镜、检查仪表，扣5分'],
  spawn(sim) { sim.place('H00', 40, 1, 8.2); sim.inCar = false; },
  start(sim) { sim.say('考试开始，请上车准备'); },
  tip(sim) {
    if (!sim.walked) return sim.walkT > 0 ? '正在绕车检查：车身外观、轮胎气压、车底有无漏油、车前后有无障碍…' : '点击「绕车检查」，逆时针绕车一周检查车辆';
    if (!sim.inCar) return sim.head('L', 8) ? '已观察后方，点击「开门上车」' : '开门前先「向左回头」观察后方来车（G 键）';
    if (!sim.seatAdj) return '上车后先「调整座椅/后视镜」';
    if (!sim.pl.belt) return '系好安全带（B 键）';
    if (!sim.pl.on) return '确认挡位在' + (sim.pl.manual ? '空挡 N' : 'P 挡') + '，点火启动（F 键）';
    return '上车准备完成';
  },
  upd(sim) { if (sim.inCar && sim.pl.belt && sim.pl.on) return 'done'; }
});
IT('yejian', {
  name: '夜间行驶', ico: '夜',
  steps: ['语音播报结束后 5 秒内完成灯光操作', '开启前照灯 → 近光灯', '照明不良 → 远光灯；照明良好、会车、跟车、通过有信号灯路口 → 近光灯', '急弯、坡路、拱桥、人行横道、无信号灯路口 → 远近光交替', '超车 → 左转向灯 + 远近光交替；路边临时停车/故障 → 示廓灯 + 危险报警闪光灯', '结束 → 关闭所有灯光'],
  kj: '照明不良用远光，会车跟车用近光；弯坡桥口斑马线，远近交替要两遍；超车左灯加交替，临停示廓加双闪。',
  judge: ['不能正确开启灯光，不合格', '同方向近距离跟车行驶时使用远光灯，不合格', '通过急弯、坡路、拱桥、人行横道或者没有交通信号灯控制的路口时，不交替使用远近光灯示意，不合格', '会车时不按规定使用灯光，不合格', '通过路口时使用远光灯，不合格', '超车时未交替使用远近光灯提醒被超越车辆，不合格', '在有路灯、照明良好的道路上行驶时使用远光灯，不合格', '在路边临时停车不关闭前照灯或不开启示廓灯，不合格'],
  spawn(sim) { sim.night = true; sim.place('V10', 30, 1, 5.25); sim.pl.on = true; sim.pl.w = IDLE; sim.pl.belt = true; },
  start(sim, S) {
    const exam = sim.o.mode === 'exam';
    S.x = sim.pl.x; S.y = sim.pl.y;
    sim.lt = new LightTest([LT_INTRO].concat(lightExamTasks()), (type, x) => {
      if (type === 'speak') sim.emit('ltsay', x);
      else if (type === 'wait') sim.emit('ltwait', x);
      else if (type === 'graded') { if (!x.ok) sim.hit('lights', x.t.q + '：' + x.errs.join('，')); sim.emit('ltres', x); }
      else if (type === 'done') S.done = 1;
    }, exam ? 0.8 : 5);
    sim.lt.next();
  },
  tip(sim) { const lt = sim.lt; if (!lt) return ''; if (lt.ph === 'wait') return '请操作灯光：' + lt.tasks[lt.i].q + '（剩余 ' + Math.max(0, lt.left).toFixed(1) + ' 秒）'; return sim.o.mode === 'exam' ? '灯光模拟考试进行中，请听语音指令' : '夜间行驶中，注意听语音指令操作灯光（灯光按钮 / L K J Z 键）'; },
  upd(sim, S) {
    if (sim.o.mode === 'exam' && Math.hypot(sim.pl.x - S.x, sim.pl.y - S.y) > 1.5 && !S.mv) { S.mv = 1; sim.hit('cmd', '灯光考试期间不得起步'); }
    if (S.done) { sim.lt = null; return 'done'; }
  }
});
IT('qibu', {
  name: '起步', ico: '起',
  steps: ['踩下离合器（自动挡踩住刹车），挂入一挡（D 挡）', '开启左转向灯，持续 3 秒以上', '观察左后视镜（V）并向左回头观察（G）', '松开驻车制动器（手刹）', '缓抬离合至半联动，轻加油门平稳起步，不后溜、不熄火、不闯动', '起步后关闭转向灯，汇入车道'],
  kj: '一踩二挂三打灯，四看五松六起步：离合到底挂一挡，左灯三秒看镜窗，回头确认松手刹，半联动里稳起步。',
  judge: ['起步前不使用或错误使用转向灯，不合格', '开启转向灯不足3秒即起步，不合格', '起步前未观察内、外后视镜并向左侧头观察后方交通情况，不合格', '起步时车辆后溜距离大于30cm，不合格；小于30cm，扣10分', '不松驻车制动器起步，未及时纠正，不合格；能及时纠正，扣10分', '起步时车辆发生闯动，扣10分', '发动机熄火一次，扣10分'],
  spawn(sim) { sim.place('H00', 40, 1, 8.2); sim.pl.on = true; sim.pl.w = IDLE; sim.pl.belt = true; },
  start(sim, S) { sim.say(sim.o.mode === 'exam' ? '请起步，继续完成考试' : '请起步'); S.x0 = sim.pl.x; S.y0 = sim.pl.y; S.h0 = sim.pl.h; S.minD = 0; },
  tip(sim, S) {
    const c = sim.pl;
    if (!c.on) return '先点火启动发动机（F）';
    if (S.moved) return '平稳起步，向左汇入车道，起步后关闭转向灯';
    if (c.manual && c.gear !== '1') return c.clutch < 0.8 ? '踩下离合器（按住 C 键 / 离合踏板）' : '挂入一挡（按 1）';
    if (!c.manual && c.gear !== 'D') return '踩住刹车，挂入 D 挡';
    if (c.L.turn !== 'L') return '开启左转向灯（Q）';
    if (sim.t - sim.sigT0 < 3) return '转向灯已开启，保持 3 秒以上…';
    if (!sim.mirror('L', 15)) return '观察左后视镜（V）';
    if (!sim.head('L', 15)) return '向左回头观察后方（G）';
    if (c.hb) return '松开手刹（空格）';
    return c.manual ? '缓抬离合至半联动（车身轻微抖动），轻踩油门起步' : '松开刹车，轻踩油门起步';
  },
  upd(sim, S) {
    const c = sim.pl, d = (c.x - S.x0) * Math.cos(S.h0) + (c.y - S.y0) * Math.sin(S.h0);
    if (d < S.minD) S.minD = d;
    if (S.minD < -0.3 && !S.rb) { S.rb = 1; sim.hit('rollback', Math.round(-S.minD * 100) + 'cm'); }
    if (!S.moved && d > 0.3) {
      S.moved = 1; sim.checkSig('L', '起步');
      if (!sim.mirror('L', 15)) sim.hit('noobs', '起步前未观察左后视镜'); else if (!sim.head('L', 15)) sim.hit('noobs', '起步前未向左侧头观察后方');
      if (!S.rb && S.minD < -0.05) sim.hit('roll10', Math.round(-S.minD * 100) + 'cm');
    }
    if (S.moved && d < 5 && c.acc > 3.4) sim.hit('jerk');
    if (S.moved && d > 16) return 'done';
  }
});
IT('zhixian', {
  name: '直线行驶', ico: '直',
  steps: ['目视前方远处，双手平稳握方向盘', '保持车辆在本车道中间直线行驶，不左右摆动', '车速平稳（一般 30~40km/h），不超速', '行驶中适时观察后视镜（V / X），注意后方交通'],
  kj: '眼看远方别盯头，两手平握微调方向；车走车道正中间，适时瞄镜看后方。',
  judge: ['方向控制不稳，不能保持车辆直线运动状态，不合格', '遇前方障碍物未及时采取减速、停车等措施，扣10分', '不适时通过内、外后视镜观察后方交通情况，扣10分'],
  spawn(sim) { sim.place('H00', 60, 1, 5.25); sim.setMoving(30); },
  trig(sim) { return !sim.lastDone || (sim.rr && sim.rr.al < 0.06 && sim.rr.ur < 7) || sim.pl.odo - sim.lastDone.odo > 30; },
  start(sim, S) { sim.say('请保持直线行驶'); S.ur0 = sim.rr ? sim.rr.ur : 5.25; },
  tip(sim, S) { return '保持方向稳定（偏航 ' + (sim.rr ? (sim.rr.al * 180 / PI).toFixed(1) : 0) + '°），适时观察后视镜' + (sinceStart(sim, S, 'L') || sinceStart(sim, S, 'R') ? ' ✓' : '（V/X）') + '，已行驶 ' + Math.round(sim.pl.odo - S.odo0) + '/140m'; },
  upd(sim, S) {
    const R = sim.rr;
    if (R && sim.t - S.t0 > 1.5 && !S.bad) {
      if (R.al > 0.105) { S.bad = 1; sim.hit('unstable', '车身偏斜超过6°'); }
      else if (Math.abs(R.ur - S.ur0) > 1.3) { S.bad = 1; sim.hit('unstable', '横向偏移超过1.3m'); }
    }
    if (sim.pl.odo - S.odo0 > 140) { if (!sinceStart(sim, S, 'L') && !sinceStart(sim, S, 'R') && !sinceStart(sim, S, 'I')) sim.hit('noObsStraight'); return 'done'; }
  },
  ev(sim, S, type) { if (type === 'lc') sim.hit('cmd', '直线行驶中变更车道'); }
});
IT('jiajian', {
  name: '加减挡位操作', ico: '挡',
  steps: ['手动挡：起步后依次加挡 1→2→3（加挡前先加速），再减至 2 挡（减挡前先减速）', '换挡时离合踩到底，换挡后平稳抬起，不看挡杆', '自动挡：加速至 35km/h 以上，再减速至 20km/h 以下', '挡位与车速匹配：一挡 0~15、二挡 10~25、三挡 20~40、四挡 30~55km/h'],
  kj: '加挡先加速，减挡先减速；离合踩到底，挡位推到位；眼看前方不低头，车速挡位要匹配。',
  judge: ['未按指令平稳加、减挡，不合格', '车辆运行速度和挡位不匹配，扣10分', '换挡时发生齿轮撞击，扣10分'],
  spawn(sim) { sim.place('H00', 80, 1, 5.25); sim.setMoving(14, '2'); },
  start(sim, S) { sim.say('请进行加减挡位操作'); S.st = 0; S.lg = sim.pl.gear; },
  tip(sim, S) { const c = sim.pl; if (!c.manual) return S.st === 0 ? '加速至 35km/h 以上（当前 ' + Math.round(kmh(c.v)) + '）' : '减速至 20km/h 以下'; return S.st === 0 ? '逐级加挡至 3 挡（当前 ' + c.gear + ' 挡，加挡前先提速）' : '减速后减至 2 挡'; },
  upd(sim, S) {
    const c = sim.pl;
    if (c.manual) {
      if (c.gear !== 'N' && c.gear !== S.lg) {
        const a = +S.lg || 0, b = +c.gear || 0;
        if (S.st === 0 && a > 0 && b - a > 1) sim.hit('gearop', '加挡未逐级进行（' + a + '→' + b + '）');
        S.lg = c.gear;
      }
      const n = +c.gear || 0;
      if (S.st === 0 && n >= 3) { S.st = 1; sim.say('请减挡'); }
      if (S.st === 1 && n === 2) return 'done';
    } else {
      const v = kmh(c.v);
      if (S.st === 0 && v >= 35) { S.st = 1; sim.say('请减速'); }
      if (S.st === 1 && v <= 20) return 'done';
    }
    if (c.odo - S.odo0 > 340 || (sim.o.mode === 'exam' && sim.loc && sim.loc.road && sim.loc.road.id === 'H00' && sim.loc.s > 545)) { sim.hit('gearop', '未在规定距离内完成加减挡'); return 'done'; }
  }
});
IT('biandao', {
  name: '变更车道', ico: '变',
  steps: ['开启转向灯（向哪边变就开哪边）并持续 3 秒以上', '通过后视镜观察（V/X），并向变更方向侧头观察（G/T）', '确认安全后平稳转向并入相邻车道，不得骑轧实线', '不得连续变更两条及以上车道', '变道完成后回正方向，关闭转向灯'],
  kj: '一灯二看三变道：开灯三秒，看镜回头，平稳并线，回正关灯。',
  judge: ['变更车道前不通过内、外后视镜观察并向变更车道方向侧头观察后方交通情况，不合格', '变更车道时判断车辆安全距离不合理，妨碍其他车辆正常行驶，不合格', '连续变更两条或两条以上车道，不合格', '变更车道前不使用或错误使用转向灯 / 开灯不足3秒即变道，不合格', '变更车道时控制行驶速度不合理，扣10分'],
  spawn(sim) { sim.place('H00', 300, 1, 5.25); sim.setMoving(30); },
  start(sim, S) { sim.say('请变更车道'); S.l0 = laneIdx(sim); },
  tip(sim, S) {
    const want = S.l0 === 1 ? 'L' : 'R', c = sim.pl;
    if (S.lc) return '平稳并入新车道，完成后关闭转向灯';
    if (c.L.turn !== want) return '开启' + (want === 'L' ? '左' : '右') + '转向灯（' + (want === 'L' ? 'Q' : 'E') + '）';
    if (sim.t - sim.sigT0 < 3) return '保持转向灯 3 秒…';
    if (!sim.mirror(want, 10)) return '观察' + (want === 'L' ? '左后视镜（V）' : '右后视镜（X）');
    if (!sim.head(want, 10)) return '向' + (want === 'L' ? '左（G）' : '右（T）') + '侧头观察';
    return '确认安全，平稳转向变道';
  },
  ev(sim, S, type, d) { if (type === 'lc' && !S.lc) S.lc = { dir: d, t: sim.t }; },
  upd(sim, S) {
    const ln = laneIdx(sim);
    if (S.lc && ln >= 0 && ln !== S.l0 && sim.t - S.lc.t > 1 && !sim.m.onDiv) return 'done';
    if (sim.pl.odo - S.odo0 > 160 || (sim.o.mode === 'exam' && sim.loc && sim.loc.road && sim.loc.road.id === 'H00' && sim.loc.s > 600)) { sim.hit('cmd', '未在规定距离内完成变更车道'); return 'done'; }
  }
});
function parkChk(sim) {
  sim.checkSig('R', '靠边停车');
  if (!sim.mirror('R', 12)) sim.hit('noobs', '靠边停车前未观察右后视镜'); else if (!sim.head('R', 12)) sim.hit('noobs', '靠边停车前未向右侧头确认安全');
}
function edgeGap(sim) {
  const c = sim.pl, R = sim.rr; if (!R) return 9;
  let mx = -1e9; for (const p of corners(c.x, c.y, c.h, CAR_L, CAR_W)) { const q = toRoad(R.r, p[0], p[1]); mx = Math.max(mx, q.u * R.sg); }
  return (HALF - 0.075) - mx;
}
IT('kaobian', {
  name: '靠边停车', ico: '停',
  steps: ['听到指令后开启右转向灯 3 秒以上', '观察右后视镜（X）并向右侧头观察（T）', '减速，平稳向右靠边，车身与右侧边缘线平行', '停车：车身右侧距道路边缘线 30cm 以内，不压线', '拉紧手刹 → 空挡（P挡）→ 熄火 → 解安全带', '开车门前向左回头观察后方（G），再开门下车'],
  kj: '右灯三秒看右镜，回头确认缓靠边；距线三十别压线，停稳先拉手刹再松刹车；空挡熄火解安全带，回头观察再开门。',
  judge: ['停车前不使用或错误使用转向灯，不合格', '停车前不通过内、外后视镜观察后方和右侧交通情况，回头确认安全，不合格', '考试员发出靠边停车指令后，未能在规定的距离内停车，不合格', '停车后，车身超过道路右侧边缘线，不合格', '停车后，车身距离道路右侧边缘线超出30cm，扣10分', '停车后，未拉紧驻车制动器，扣10分', '拉紧驻车制动器前放松行车制动踏板，扣10分', '下车前不将发动机熄火，扣5分', '开车门前不侧头观察侧后方交通情况，不合格'],
  spawn(sim) { sim.place('H21', 380, -1, 5.25); sim.setMoving(30); },
  trig(sim) { return !sim.lastDone || sim.pl.odo - sim.lastDone.odo > 40; },
  start(sim, S) { sim.say('请靠边停车'); S.ph = 0; S.ur0 = sim.rr ? sim.rr.ur : 5.25; S.st = 0; },
  tip(sim, S) {
    const c = sim.pl;
    if (S.ph === 0) {
      if (!S.chk) { if (c.L.turn !== 'R') return '开启右转向灯（E）'; if (sim.t - sim.sigT0 < 3) return '保持转向灯 3 秒…'; if (!sim.mirror('R', 12)) return '观察右后视镜（X）'; if (!sim.head('R', 12)) return '向右侧头观察（T）'; return '减速向右靠边'; }
      const g = edgeGap(sim); return '距右侧边缘线 ' + (g * 100).toFixed(0) + 'cm（≤30cm 且不压线），减速停车';
    }
    if (!c.hb) return '停稳后先拉手刹（空格），再松刹车';
    if (c.manual ? c.gear !== 'N' : c.gear !== 'P') return c.manual ? '挂空挡 N' : '挂 P 挡';
    if (c.on) return '熄火（F）';
    if (c.belt) return '解开安全带（B）';
    return sim.head('L', 6) ? '点击「开门下车」（O）' : '开门前向左回头观察后方（G）';
  },
  upd(sim, S, dt) {
    const c = sim.pl;
    if (S.ph === 0) {
      if (sim.rr && !S.chk && sim.rr.ur - S.ur0 > 0.45) { S.chk = 1; parkChk(sim); }
      if (Math.abs(c.v) < 0.05) {
        S.st += dt;
        if (S.st > 0.8) {
          if (!S.chk) { S.chk = 1; parkChk(sim); }
          S.ph = 1; S.sx = c.x; S.sy = c.y; S.gap = edgeGap(sim);
          if (S.gap < 0) sim.hit('overEdge'); else if (S.gap > 0.3) sim.hit('park30', '距离' + Math.round(S.gap * 100) + 'cm');
          sim.emit('park', S.gap);
        }
      } else S.st = 0;
      if (c.odo - S.odo0 > 170) { sim.hit('cmd', '未在规定距离内靠边停车'); return 'done'; }
    } else {
      if (c.hb) S.hbDone = 1;
      if (!S.hbDone && !S.hbo && c.brk < 0.08 && c.gear !== 'P') { S.hbo = 1; sim.hit('hbOrder'); }
      if (Math.hypot(c.x - S.sx, c.y - S.sy) > 1.5) { S.ph = 0; S.st = 0; }
      if (S.exit) return 'done';
    }
  },
  ev(sim, S, type) {
    if (type !== 'exit' || S.ph !== 1) return;
    const c = sim.pl;
    if (!c.hb) sim.hit('noHB');
    if (c.on) sim.hit('engineOff');
    if (!sim.head('L', 6)) sim.hit('doorObs');
    S.exit = 1;
  }
});
function nodeItem(key, name, ico, roadId, sTrig, sSpawn, nodeId, want, voice, extra) {
  IT(key, Object.assign({
    name, ico,
    spawn(sim) { sim.place(roadId, sSpawn, 1, want === 'L' ? 1.75 : 5.25); sim.setMoving(30); },
    trig(sim) { return onR(sim, roadId, sTrig); },
    start(sim) { sim.say(voice); },
    tip(sim, S) {
      const c = sim.pl, sd = want === 'L' ? '左' : '右';
      const n = sim.W.N[nodeId], st = sigState(n, sim.W.R[roadId].hz ? 'EW' : 'NS', want, sim.t);
      const lt = { G: '绿灯', Y: '黄灯', R: '红灯' }[st.c] + Math.ceil(st.left) + 's';
      if (S.sl) return want === 'S' ? '保持直行通过路口' : (want === 'L' ? '靠路口中心点左侧大转弯，进入对应车道' : '小转弯，注意右侧非机动车和行人');
      if (want !== 'S' && c.L.turn !== want) return '开启' + sd + '转向灯（' + (want === 'L' ? 'Q' : 'E') + '）· 信号' + lt;
      if (want === 'S' && !(sim.looked('L', 12) && sim.looked('R', 12))) return '减速至 30km/h 以下，观察左右（V、X）· 信号' + lt;
      if (want !== 'S' && !sim.looked(want, 12)) return '观察' + sd + '侧交通（' + (want === 'L' ? 'V' : 'X') + '）· 信号' + lt;
      return '减速慢行，' + (st.c === 'G' ? '绿灯可通行' : '在停止线前停车等待') + '（' + lt + '）';
    },
    ev(sim, S, type, d) {
      if (type === 'stopline' && d.node.id === nodeId) {
        S.sl = 1;
        if (d.sp > 30.5) sim.hit('slowzone', '通过路口未减速慢行（' + Math.round(d.sp) + 'km/h）');
        if (want === 'S' && !(sim.looked('L', 12) && sim.looked('R', 12))) sim.hit('noobs', '通过路口前未观察左右两方交通情况');
      }
      if (type === 'cross' && d.node.id === nodeId) { if (d.mv !== want) sim.hit('cmd', '未按指令' + { S: '直行', L: '左转', R: '右转' }[want]); S.done = 1; }
    },
    upd(sim, S) { if (S.done) return 'done'; if (sim.pl.odo - S.odo0 > 400) { sim.hit('cmd', '未按指令通过路口'); return 'done'; } }
  }, extra));
}
nodeItem('zhixing', '直行通过路口', '口', 'V10', 420, 425, 'N11', 'S', '前方路口直行', {
  steps: ['提前观察信号灯，减速至 30km/h 以下', '向左、右观察路口交通情况（V、X）', '红灯/黄灯在停止线前停车，绿灯通行', '直行通过时不变道，主动避让行人和优先通行车辆'],
  kj: '路口之前要减速，左右观察看信号；红灯停在线后面，绿灯直行不变道。',
  judge: ['不按规定减速或停车瞭望，不合格', '不根据路口交通情况合理观察左右两方交通情况，不合格', '不主动避让优先通行的车辆、行人、非机动车，不合格', '不按交通信号灯通行，不合格'] });
nodeItem('zuozhuan', '路口左转弯', '左', 'H00', 470, 470, 'N10', 'L', '前方路口左转', {
  steps: ['提前驶入左转车道（最左侧车道）', '开启左转向灯 3 秒以上，观察左后方', '减速至 30km/h 以下，看清左转信号灯（箭头灯）', '绿灯时靠路口中心点左侧转弯，避让直行车辆和行人', '转弯后进入对应车道，回正方向'],
  kj: '提前进入左转道，左灯三秒看左镜；减速等待绿箭头，中心左侧大转弯。',
  judge: ['转弯前不使用或错误使用转向灯，不合格', '转弯前未观察，不合格', '不按交通信号灯通行，不合格', '不按导向车道行驶，不合格', '转弯时转、回方向过早、过晚，扣10分'] });
nodeItem('youzhuan', '路口右转弯', '右', 'V11', 370, 360, 'N12', 'R', '前方路口右转', {
  steps: ['提前驶入右侧车道', '开启右转向灯 3 秒以上，观察右后视镜和右侧非机动车', '减速慢行，注意右侧行人', '靠右小转弯，进入右侧车道'],
  kj: '右灯三秒看右镜，减速慢行防盲区；小转弯进右车道，非机动车要礼让。',
  judge: ['转弯前不使用或错误使用转向灯，不合格', '转弯前不观察右侧交通情况，不合格', '不按导向车道行驶，不合格', '不主动避让行人、非机动车，不合格'] });
function zoneItem(key, name, ico, roadId, s0, s1, sTrig, sSpawn, voice, extra) {
  IT(key, Object.assign({
    name, ico,
    spawn(sim) { sim.place(roadId, sSpawn, 1, 5.25); sim.setMoving(35); },
    trig(sim) { return onR(sim, roadId, sTrig); },
    start(sim, S) { sim.say(voice); if (this.onStart) this.onStart(sim, S); },
    tip(sim, S) {
      const L = sinceStart(sim, S, 'L') || sinceStart(sim, S, 'BL'), R = sinceStart(sim, S, 'R') || sinceStart(sim, S, 'BR');
      const sp = Math.round(kmh(sim.pl.v));
      if (!S.in) return '减速至 30km/h 以下（当前 ' + sp + '）' + (L && R ? '，已观察左右 ✓' : '，观察左侧（V）和右侧（X）');
      return '保持 30km/h 以下慢行通过（当前 ' + sp + '）' + (key === 'xuexiao' ? '，禁止鸣喇叭' : '') + '，有行人时停车让行';
    },
    upd(sim, S) {
      if (!sim.loc || !sim.loc.road || sim.loc.road.id !== roadId) return S.in ? 'done' : null;
      const f = sim.loc.s + 2.3, sp = kmh(sim.pl.v);
      if (!S.in && f >= s0) {
        S.in = 1;
        if (sp > 30.5) sim.hit('slowzone', '进入' + name.replace('通过', '') + '车速' + Math.round(sp) + 'km/h');
        const L = sinceStart(sim, S, 'L') || sinceStart(sim, S, 'BL'), R = sinceStart(sim, S, 'R') || sinceStart(sim, S, 'BR');
        if (!L || !R) sim.hit('noobs', '未观察左、右方交通情况');
      }
      if (S.in && sp > 30.5) sim.hit('slowzone', '车速' + Math.round(sp) + 'km/h');
      if (sim.loc.s > s1) return 'done';
    }
  }, extra));
}
zoneItem('renxing', '通过人行横道线', '斑', 'V10', 120, 156, 60, 50, '前方通过人行横道，请注意观察，减速慢行', {
  onStart(sim) { if (rnd() < 0.7) sim.forcePed(0, -1); },
  steps: ['看到人行横道预告标线（菱形）即减速', '车速降至 30km/h 以下，观察左右两侧', '有行人通过时在停止线前停车让行，待行人通过后再起步', '不得在人行横道上停车'],
  kj: '见到菱形就减速，左右观察看行人；有人通过要停车，不能抢行鸣喇叭。',
  judge: ['不按规定减速慢行，不合格', '不观察左、右方交通情况，不合格', '遇行人通过人行横道不停车让行，不合格'] });
zoneItem('xuexiao', '通过学校区域', '校', 'V10', 280, 420, 215, 205, '前方进入学校区域，请注意观察，减速慢行', {
  onStart(sim) { if (rnd() < 0.6) sim.forcePed(1, 1); },
  steps: ['看到"注意儿童"标志即减速，车速 30km/h 以下', '观察左右，注意突然横穿的学生', '学校区域禁止鸣喇叭', '遇学生横过道路时停车让行'],
  kj: '学校区域三十限，左右观察防孩童；禁止鸣笛慢慢过，遇人横穿要停车。',
  judge: ['不按规定减速慢行，不合格', '不观察左、右方交通情况，不合格', '未停车礼让行人，不合格', '鸣喇叭（违反禁令标志），不合格'] });
zoneItem('gongjiao', '通过公共汽车站', '公', 'V11', 100, 172, 40, 35, '前方通过公共汽车站，请注意观察，减速慢行', {
  steps: ['提前减速至 30km/h 以下', '观察公交车动态及车前车后，防止行人突然窜出', '必要时准备停车', '不得在公交站停车'],
  kj: '公交站前要减速，车前车后看行人；准备停车不鸣笛，安全通过再加速。',
  judge: ['不按规定减速慢行，不合格', '不观察左、右方交通情况，不合格', '遇行人通过不停车让行，不合格'] });
IT('huiche', {
  name: '会车', ico: '会',
  steps: ['发现对向来车，提前减速', '靠右侧行驶，与对向车辆保持足够横向间距', '会车困难时主动停车让行', '夜间会车在 150 米外改用近光灯'],
  kj: '会车之前先减速，靠右行驶留间距；有障碍方先让行，夜间会车用近光。',
  judge: ['在没有中心隔离设施或者中心线的道路上会车时，不减速靠右行驶，不合格', '会车时未与其他车辆、行人、非机动车保持安全距离，不合格', '会车困难时不让行，不合格'],
  spawn(sim) { sim.place('V11', 180, 1, 5.25); sim.setMoving(36); },
  trig(sim) { return onR(sim, 'V11', 200); },
  start(sim, S) { S.car = sim.spawnOncoming('V11', sim.loc.s + 150); S.v0 = kmh(sim.pl.v); sim.say('前方会车，请减速靠右行驶'); },
  tip(sim, S) { return '对向来车，减速（当前 ' + Math.round(kmh(sim.pl.v)) + 'km/h）并靠右侧车道行驶'; },
  upd(sim, S) {
    const a = S.car;
    if (!a || !sim.ai.includes(a) || sim.pl.odo - S.odo0 > 280) { if (a) a.fixed = false; return 'done'; }
    if (!sim.loc || !sim.loc.road || sim.loc.road.id !== 'V11') return;
    const q = toRoad(sim.W.R.V11, a.x, a.y);
    if (q.s - sim.loc.s < 4 && !S.ev) {
      S.ev = 1; a.fixed = false;
      const sp = kmh(sim.pl.v);
      if (sp > 40 || (sp > S.v0 - 3 && sp > 25)) sim.hit('meet', '会车时未减速（' + Math.round(sp) + 'km/h）');
      else if (sim.rr && sim.rr.ur < 2.6) sim.hit('meet', '会车时未靠右行驶');
      return 'done';
    }
  }
});
IT('chaoche', {
  name: '超车', ico: '超',
  steps: ['与前车保持安全距离，观察超车条件（对向、后方无来车，非禁止超车路段）', '开启左转向灯 3 秒，观察左后视镜并向左侧头', '从被超车辆左侧超越（夜间交替远近光灯示意）', '超越后开启右转向灯，观察右后视镜确认与被超车辆拉开足够距离', '平稳驶回原车道，关闭转向灯'],
  kj: '左灯三秒看左镜，回头确认左侧超；超过以后开右灯，镜中看到车头再回道。',
  judge: ['超车前不通过内、外后视镜观察后方和左侧交通情况，不合格', '超车时机选择不合理，影响其他车辆正常行驶，不合格', '超车时未侧头观察被超越车辆动态，不合格', '超车时未与被超越车辆保持安全距离，不合格', '超车后急转向驶回原车道，妨碍被超越车辆正常行驶，不合格', '从右侧超车，不合格'],
  spawn(sim) { sim.place('H21', 30, 1, 5.25); sim.setMoving(28); },
  trig(sim) { return onR(sim, 'H21', 20); },
  start(sim, S) { S.car = sim.spawnSlow('H21', sim.loc.s + 50); S.ph = 0; },
  tip(sim, S) {
    if (S.ph === 0) { const c = sim.pl; if (laneIdx(sim) === 1) { if (c.L.turn !== 'L') return '开启左转向灯（Q）准备超车'; if (sim.t - sim.sigT0 < 3) return '保持转向灯 3 秒…'; if (!sim.mirror('L', 10)) return '观察左后视镜（V）'; if (!sim.head('L', 10)) return '向左侧头观察（G）'; return '变入左侧车道'; } return '加速从左侧超越（不得超速）'; }
    return '开启右转向灯（E），观察右后视镜（X）、侧头（T），拉开距离后驶回右侧车道';
  },
  upd(sim, S) {
    const a = S.car;
    if (!a || !sim.ai.includes(a)) return 'done';
    if (!sim.loc || !sim.loc.road || sim.loc.road.id !== 'H21') return;
    const q = toRoad(sim.W.R.H21, a.x, a.y), ps = sim.loc.s;
    if (!S.said && q.s - ps < 62) { S.said = 1; sim.say('请超越前方车辆'); }
    const ur = sim.rr ? sim.rr.ur : 5;
    if (S.ph === 0 && ps - 2.3 > q.s + 2.25) { if (ur > 3.5 && q.u < 3.5) sim.hit('overright'); S.ph = 1; }
    if (S.ph === 1 && S.lcR && ur > 3.5 && !sim.m.onDiv) { a.fixed = false; return 'done'; }
    if (S.ph < 1 && ps > 365) { sim.hit('cmd', '未按指令完成超车'); a.fixed = false; return 'done'; }
    if (S.ph === 1 && !S.lcR && ps > 375) { sim.hit('cmd', '超车后未驶回原车道'); a.fixed = false; return 'done'; }
  },
  ev(sim, S, type, d) {
    if (type !== 'lc' || !S.car) return;
    if (d === 'R' && S.ph === 1 && !S.lcR) {
      S.lcR = 1;
      const q = toRoad(sim.W.R.H21, S.car.x, S.car.y), g = sim.loc.s - 2.3 - (q.s + 2.25);
      if (g < 6) sim.hit('cutin', '与被超车辆距离仅 ' + g.toFixed(1) + 'm');
    }
  }
});
IT('diaotou', {
  name: '掉头', ico: '掉',
  steps: ['在允许掉头的地点（掉头标志、中心线虚线开口处）掉头', '提前驶入最左侧车道，开启左转向灯 3 秒以上', '观察左后方及对向交通情况，减速或停车瞭望', '确认安全后一次完成掉头，不得倒车调整', '掉头后进入对向右侧车道，关闭转向灯'],
  kj: '选好地点靠左边，左灯三秒看左镜；对向无车再掉头，一把完成不倒车。',
  judge: ['不能正确观察交通情况选择掉头时机，不合格', '掉头地点选择不当，不合格', '掉头前未发出掉头信号，不合格', '掉头时妨碍正常行驶的其他车辆和行人通行，不合格', '掉头不能一次完成（倒车调整），不合格'],
  spawn(sim) { sim.place('H21', 300, 1, 1.75); sim.setMoving(25); },
  trig(sim) { return onR(sim, 'H21', 200); },
  start(sim, S) { sim.say('请在前方允许掉头的地点掉头'); S.ph = 0; },
  tip(sim, S) {
    const c = sim.pl, D = sim.W.R.H21, q = toRoad(D, c.x, c.y);
    if (S.ph === 0) {
      if (laneIdx(sim) !== 0) return '变入最左侧车道（开灯、观察后再变道）';
      if (c.L.turn !== 'L') return '开启左转向灯（Q）';
      if (!sim.looked('L', 12)) return '观察左后方交通情况（V、G）';
      return q.s < D.uturn[0] ? '前方 ' + Math.round(D.uturn[0] - q.s) + 'm 中心线虚线开口处掉头，减速至 15km/h 以下' : '向左打满方向，一次完成掉头';
    }
    return '一次完成掉头，进入对向右侧车道';
  },
  upd(sim, S) {
    const c = sim.pl, D = sim.W.R.H21, q = toRoad(D, c.x, c.y), dh = angN(c.h - D.h);
    if (S.ph === 0) {
      if (dh > 0.3 && Math.abs(c.v) > 0.1) {
        S.ph = 1;
        if (q.s < D.uturn[0] - 6 || q.s > D.uturn[1] + 6) sim.hit('uturnPlace');
        sim.checkSig('L', '掉头');
        if (!sim.looked('L', 12)) sim.hit('noobs', '掉头前未观察左后方交通情况');
      }
      if (q.s > D.uturn[1] + 40 && dh < 0.3) { sim.hit('cmd', '未按指令掉头'); return 'done'; }
    } else {
      if ((c.v < -0.05 || c.gear === 'R') && !S.rv) { S.rv = 1; sim.hit('uturn2'); }
      if (Math.abs(angN(dh - PI)) < 0.3 && q.u < -1) { sim.m.lcGrace = 3; return 'done'; }
    }
  }
});

/* ======================= 模拟器 ======================= */
function Sim(o) {
  this.o = o = Object.assign({ mode: 'free', item: null, manual: true, night: false }, o);
  this.W = getWorld(); this.t = 0; this.out = []; this.ai = []; this.cyc = []; this.walkers = []; this.statics = this.W.props.filter(p => p.kind === 'bus');
  this.pl = mkCar(o.manual); this.J = new Judge();
  this.m = { spd: 0, hbD: 0, nT: 0, clT: 0, rpmT: 0, prevF: null, inter: null, onDiv: false, divT: 0, lcGrace: 0, ww: 0, off: 0 };
  this.obs = { L: -99, R: -99, BL: -99, BR: -99, I: -99 };
  this.sigT0 = -99; this.lastTurn = ''; this.hornT = -99; this.flashT = 0; this.sigArm = false;
  this.inCar = true; this.walked = false; this.seatAdj = false; this.walkT = 0;
  this.inp = { steer: 0, wheel: null, kThr: 0, kBrk: 0, kClutch: 0, tThr: null, tBrk: null, tClutch: null };
  this.night = !!o.night; this.res = {}; this.seq = []; this.idx = 0; this.cur = null; this.over = false; this.lt = null;
  this.cw = this.W.cws.map(cw => ({ cw, peds: [], timer: rr(1, 6), busy: false }));
  this.plo = { x: 0, y: 0, h: 0, l: CAR_L, w: CAR_W, v: 0 };
  this.loc = null; this.rr = null; this.lim = 40; this.respT = 0;
  this.setupMode();
  this.spawnTraffic();
}
const SP = Sim.prototype;
SP.emit = function (type, d) { this.out.push({ type, d }); };
SP.say = function (text) { this.emit('say', text); };
SP.hit = function (code, note) {
  const e = this.J.hit(code, this.cur ? this.cur.it.name : (this.o.mode === 'free' ? '自由驾驶' : '通用评判'), note);
  if (!e) return null;
  this.emit('hit', e);
  if (e.pts >= 100 && this.o.mode !== 'free' && !this.over) { this.over = true; this.emit('fail', this.result()); }
  return e;
};
SP.place = function (id, s, d, ur) {
  const r = this.W.R[id], p = roadPt(r, s, ur * d), c = this.pl;
  c.x = p.x; c.y = p.y; c.h = angN(r.h + (d < 0 ? PI : 0)); c.v = 0;
};
SP.setMoving = function (v, g) {
  const c = this.pl; c.on = true; c.belt = true; c.hb = false; c.v = v / 3.6;
  if (c.manual) { c.gear = g || (v >= 24 ? '3' : v >= 12 ? '2' : '1'); c.w = Math.max(IDLE, c.v / RW * GR[c.gear] * FD); }
  else { c.gear = 'D'; c.w = 150; }
};
SP.setupMode = function () {
  const o = this.o;
  if (o.mode === 'exam') { this.seq = EXAM_SEQ.slice(); ITEMS.shangche.spawn(this); }
  else if (o.mode === 'item' && ITEMS[o.item]) { this.seq = [o.item]; ITEMS[o.item].spawn(this); }
  else { this.place('H00', 40, 1, 8.2); }
  this.seq.forEach(k => this.res[k] = 'pend');
};
SP.newAI = function (L, s, opt) {
  opt = opt || {};
  const bus = !!opt.bus, a = { path: L, s, v: opt.v != null ? opt.v : rr(5, 10), v0: opt.v0 || rr(11, 15), vf: rr(0.85, 1.0),
    l: bus ? 11 : rr(4.3, 4.9), w: bus ? 2.5 : 1.8, ht: bus ? 3.1 : rr(1.4, 1.55), col: opt.col || (bus ? [30, 140, 200] : pick(CAR_COLS)), kind: bus ? 'bus' : 'car',
    x: 0, y: 0, h: 0, next: null, commit: false, fixed: !!opt.fixed, sig: '', brk: false, tall: rnd() < 0.25 };
  const p = pathAt(L, s); a.x = p.x; a.y = p.y; a.h = p.h; chooseNext(a);
  this.ai.push(a); return a;
};
SP.placeAI = function (a, dmin, dmax) {
  const c = this.pl;
  for (let k = 0; k < 30; k++) {
    const L = pick(this.W.lanes), s = rr(4, L.len - 4), p = pathAt(L, s), d = Math.hypot(p.x - c.x, p.y - c.y);
    if (d < dmin || d > dmax) continue;
    if (this.ai.some(o => o !== a && Math.hypot(o.x - p.x, o.y - p.y) < 16)) continue;
    a.path = L; a.s = s; a.x = p.x; a.y = p.y; a.h = p.h; a.v = rr(4, 9); a.commit = false; a.stuck = 0; chooseNext(a);
    return true;
  }
  return false;
};
SP.spawnTraffic = function () {
  for (let i = 0; i < 28; i++) { const a = this.newAI(this.W.lanes[0], 0, { bus: i < 2 }); if (!this.placeAI(a, 45, 650)) this.ai.pop(); }
  const W = this.W;
  for (let i = 0; i < 7; i++) { const b = { road: pick(W.roads.filter(r => r.id !== 'H00')), d: rnd() < 0.5 ? 1 : -1, s: 0, v: rr(3.5, 5.5), x: 0, y: 0, h: 0, col: pick(CAR_COLS), ph: rnd() * 6 }; b.s = rr(30, b.road.len - 30); this.cyc.push(b); }
  const B = W.R.V10;
  for (let i = 0; i < 8; i++) this.walkers.push({ road: i < 5 ? B : pick(W.roads), side: rnd() < 0.5 ? 1 : -1, s: i < 5 ? rr(270, 430) : rr(40, 400), dir: rnd() < 0.5 ? 1 : -1, v: rr(0.9, 1.4), kid: i < 4, col: pick(CAR_COLS), ph: rnd() * 6, x: 0, y: 0 });
};
SP.clearLane = function (L, s0, s1) { for (const o of this.ai) if (o.path === L && o.s > s0 && o.s < s1 && !o.fixed) this.placeAI(o, 200, 500); };
SP.spawnSlow = function (id, rs) {
  const r = this.W.R[id], L = this.W.laneOf(r, 1, 1), s = rs - SL;
  this.clearLane(L, s - 40, s + 60); this.clearLane(this.W.laneOf(r, 1, 0), s - 60, s + 60);
  const a = this.newAI(L, s, { v: 5, v0: 5, col: [250, 250, 246], fixed: true }); a.slow = true; a.vf = 1; return a;
};
SP.spawnOncoming = function (id, rs) {
  const r = this.W.R[id], L = this.W.laneOf(r, -1, 0), s = clamp(r.len - SL - rs, 2, L.len - 2);
  this.clearLane(L, s - 30, s + 30);
  return this.newAI(L, s, { v: 9, v0: 10, fixed: true });
};
SP.forcePed = function (i, dir) {
  const c = this.cw[i]; if (!c) return;
  c.peds.push({ p: -dir * (CURB + 2), dir, v: rr(1.25, 1.45), st: 'walk', wt: 0, o: rr(-1.5, 1.5), col: pick(CAR_COLS), kid: !!c.cw.school, ph: 0, x: 0, y: 0 });
};
SP.mirror = function (s, w) { return this.t - this.obs[s === 'L' ? 'L' : 'R'] < w; };
SP.head = function (s, w) { return this.t - this.obs[s === 'L' ? 'BL' : 'BR'] < w; };
SP.looked = function (s, w) { return this.mirror(s, w) || this.head(s, w); };
SP.checkSig = function (side, what) {
  const L = this.pl.L;
  if (L.turn !== side) { this.hit(L.turn ? 'wrongsig' : 'nosig', what); return false; }
  if (this.t - this.sigT0 < 3) { this.hit('sig3', what + '（' + (this.t - this.sigT0).toFixed(1) + '秒）'); return false; }
  return true;
};
SP.look = function (k) { this.obs[k] = this.t; this.emit('look', k); };
SP.ev = function (type, d) { if (this.cur && this.cur.it.ev) this.cur.it.ev(this, this.cur.S, type, d); this.emit(type, d); };
SP.shift = function (g) {
  const c = this.pl; if (!this.inCar || g === c.gear) return false;
  if (c.manual) {
    if (g !== 'N' && c.clutch < 0.75 && (c.on || Math.abs(c.v) > 0.5)) { this.hit('grind'); this.emit('grind'); return false; }
    if ((g === 'R' && c.v > 0.8) || (g !== 'R' && g !== 'N' && c.v < -0.8)) { this.hit('grind'); this.emit('grind'); return false; }
  } else {
    if ((g === 'P' || g === 'R' || c.gear === 'P' || c.gear === 'R') && Math.abs(c.v) > 0.6 && g !== 'N') { this.emit('toast', '车辆未停稳，不能换入该挡'); return false; }
    if (c.gear === 'P' && c.brk < 0.2 && c.on) { this.emit('toast', '请先踩住刹车再换挡'); return false; }
  }
  c.gear = g; this.emit('gear', g); return true;
};
SP.act = function (a) {
  const c = this.pl;
  switch (a) {
    case 'walk': if (!this.inCar && !this.walkT && !this.walked) { this.walkT = 7; this.emit('walk'); } break;
    case 'enter':
      if (this.inCar || this.walkT > 0) break;
      if (!this.walked) this.hit('noCheck');
      if (!this.head('L', 8)) this.hit('doorObs');
      this.inCar = true; this.emit('enter'); break;
    case 'seat': if (this.inCar) { this.seatAdj = true; this.emit('toast', '已调整座椅、后视镜，仪表检查正常'); } break;
    case 'belt': if (!this.inCar) break; c.belt = !c.belt; this.emit('belt', c.belt); break;
    case 'hb': if (!this.inCar) break; c.hb = !c.hb; this.emit('hbk', c.hb); break;
    case 'ign': {
      if (!this.inCar) break;
      if (c.on) { c.on = false; this.emit('engine', false); break; }
      if (this.cur && this.cur.key === 'shangche' && !this.seatAdj && this.o.mode === 'exam') this.hit('prepSeat');
      const inGear = c.manual ? c.gear !== 'N' : (c.gear !== 'P' && c.gear !== 'N');
      if (inGear) { if (!c.manual) { this.emit('toast', '请将挡位置于 P 挡后启动'); break; } this.hit('startGear'); }
      c.on = true; c.w = 95; this.emit('engine', true); break;
    }
    case 'horn': {
      this.hornT = this.t; this.emit('horn');
      const R = this.rr; if (R) { const z = zoneAt(this.W, R.r, R.s); if (z && z.type === 'school') this.hit('horn'); }
      this.ev('hornev'); break;
    }
    case 'exit': if (!this.inCar) break; if (Math.abs(c.v) > 0.05) { this.emit('toast', '请先停车'); break; } this.ev('exit'); break;
  }
};
SP.light = function (k, v) {
  const L = this.pl.L;
  if (k === 'rot') L.rot = v != null ? v : (L.rot + 1) % 3;
  else if (k === 'high') L.high = v != null ? v : !L.high;
  else if (k === 'flash') { L.flash = v; if (v === 'pulse') { L.flash = true; this.flashT = 0.3; } }
  else if (k === 'turn') L.turn = L.turn === v ? '' : v;
  else if (k === 'hazard') L.hazard = !L.hazard;
  else if (k === 'fogF') L.fogF = !L.fogF;
  else if (k === 'fogR') L.fogR = !L.fogR;
};
SP.controls = function (dt) {
  const c = this.pl, I = this.inp;
  if (!this.inCar) { c.thr = 0; c.brk = 0; return; }
  if (I.tThr != null) c.thr = I.tThr; else c.thr = I.kThr ? Math.min(1, c.thr + dt * (c.thr < 0.35 ? 0.9 : 0.8)) : Math.max(0, c.thr - dt * 4);
  if (I.tBrk != null) c.brk = I.tBrk; else c.brk = I.kBrk ? Math.min(1, c.brk + dt * 2.2) : Math.max(0, c.brk - dt * 5);
  if (c.manual) {
    if (I.tClutch != null) c.clutch = I.tClutch;
    else if (I.kClutch) c.clutch = Math.min(1, c.clutch + dt * 6);
    else if (c.clutch > 0) {
      // 键盘离合：快速抬到结合点，半联动区缓慢释放；发动机转速过低时自动保持（模拟脚感）
      const bite = c.clutch <= 0.74, low = c.on && c.w < 72 && c.gear !== 'N';
      c.clutch = Math.max(0, c.clutch - dt * (!bite ? 2.5 : low ? 0 : 0.42));
    }
  } else c.clutch = 0;
  if (I.wheel != null) c.sw = clamp(I.wheel, -SWMAX, SWMAX);
  else if (I.steer) c.sw = clamp(c.sw + I.steer * dt * (I.steer * c.sw < 0 ? 6 : 4.2), -SWMAX, SWMAX);
  else c.sw -= c.sw * Math.min(1, Math.abs(c.v) * 0.2 * dt);
  const L = c.L;
  if (L.turn !== this.lastTurn) { this.lastTurn = L.turn; this.sigT0 = this.t; this.sigArm = false; }
  if (L.turn) { const ds = L.turn === 'L' ? c.sw : -c.sw; if (ds > 1.6) this.sigArm = true; else if (this.sigArm && ds < 0.4) { L.turn = ''; this.lastTurn = ''; this.sigArm = false; this.emit('sigoff'); } }
  if (this.flashT > 0) { this.flashT -= dt; if (this.flashT <= 0) L.flash = false; }
};
SP.pedsStep = function (dt) {
  const all = this.ai.concat([this.plo]);
  for (const st of this.cw) {
    const cw = st.cw, r = cw.road;
    st.timer -= dt;
    if (st.timer <= 0) {
      st.timer = rr(cw.school ? 6 : 10, cw.school ? 15 : 24);
      if (st.peds.length < 3) { const dir = rnd() < 0.5 ? 1 : -1; st.peds.push({ p: -dir * (CURB + 2.2), dir, v: rr(1.1, 1.5), st: 'wait', wt: rr(0.5, 2.5), o: rr(-1.6, 1.6), col: pick(CAR_COLS), kid: cw.school && rnd() < 0.7, ph: rnd() * 6, x: 0, y: 0 }); }
    }
    st.since = st.busy ? 0 : (st.since || 0) + dt; st.busy = false;
    for (let i = st.peds.length - 1; i >= 0; i--) {
      const p = st.peds[i];
      if (p.st === 'wait') {
        p.wt -= dt;
        if (p.wt <= 0) {
          let safe = true;
          for (const v of all) {
            const q = toRoad(r, v.x, v.y); if (Math.abs(q.u) > CURB || q.s < -5 || q.s > r.len + 5) continue;
            const ds = cw.s - q.s, sp = Math.abs(v.v || 0), hd = Math.cos(v.h) * r.dx + Math.sin(v.h) * r.dy;
            if (Math.abs(ds) < 4 || (ds * hd > 0 && ((Math.abs(ds) < 5 + sp * 2.6 && sp > 1.5) || (st.since < 9 && Math.abs(ds) < 18)))) { safe = false; break; }
          }
          if (safe) p.st = 'walk'; else p.wt = 0.5;
        }
      } else {
        p.p += p.dir * p.v * dt; p.ph += dt * p.v * 3.2;
        if (p.p * p.dir > CURB + 2.5) { st.peds.splice(i, 1); continue; }
        if (Math.abs(p.p) < CURB + 1.2) st.busy = true;
      }
      const q = roadPt(r, cw.s + p.o, p.p); p.x = q.x; p.y = q.y;
    }
  }
  const pc = this.pl;
  for (const b of this.cyc) {
    const dx = pc.x - b.x, dy = pc.y - b.y, fw = dx * Math.cos(b.h) + dy * Math.sin(b.h), la = Math.abs(-dx * Math.sin(b.h) + dy * Math.cos(b.h));
    const blocked = fw > -1.5 && fw < 8 && la < 2.6 && Math.abs(pc.v) > 0.05 || (fw > 0 && fw < 6.5 && la < 1.9);
    b.cv = blocked ? 0 : b.v;
    b.s += b.cv * b.d * dt; if (!blocked) b.ph += dt * 5;
    if (b.s < SL + 4 || b.s > b.road.len - SL - 4) { do { b.road = pick(this.W.roads); b.d = rnd() < 0.5 ? 1 : -1; } while (b.road.id === 'H00' && b.d > 0); b.s = b.d > 0 ? SL + 6 : b.road.len - SL - 6; }
    const p = roadPt(b.road, b.s, b.d * (HALF + 1.2)); b.x = p.x; b.y = p.y; b.h = angN(b.road.h + (b.d < 0 ? PI : 0));
  }
  for (const w of this.walkers) {
    w.s += w.v * w.dir * dt; w.ph += dt * w.v * 3.2;
    if (w.s < 22 || w.s > w.road.len - 22) w.dir = -w.dir;
    const p = roadPt(w.road, w.s, w.side * (CURB + 2.8)); w.x = p.x; w.y = p.y; w.h = angN(w.road.h + (w.dir < 0 ? PI : 0));
  }
};
SP.collide = function () {
  const c = this.pl, P = { x: c.x, y: c.y, h: c.h, l: CAR_L, w: CAR_W };
  let hit = false;
  for (const o of this.ai) if (obbHit(P, o)) { hit = true; o.v = 0; }
  for (const o of this.statics) if (obbHit(P, o)) hit = true;
  const ch = Math.cos(c.h), sh = Math.sin(c.h);
  const near = (x, y, r) => { const dx = x - c.x, dy = y - c.y; return Math.abs(dx * ch + dy * sh) < CAR_L / 2 + r && Math.abs(-dx * sh + dy * ch) < CAR_W / 2 + r; };
  const mv = Math.abs(c.v) > 0.2;
  for (const st of this.cw) for (const p of st.peds) if (near(p.x, p.y, 0.3) && mv) { hit = true; p.v = 0; }
  for (const b of this.cyc) if (near(b.x, b.y, 0.5) && mv) { hit = true; b.v = 0; }
  if (hit) { if (Math.abs(c.v) > 0.2 || !this.m.crashed) { this.hit('crash'); this.emit('crash'); } c.v = 0; this.m.crashed = true; } else this.m.crashed = false;
};
SP.step = function (dt) {
  if (this.over && this.o.mode !== 'free') return;
  this.t += dt; this.J.t = this.t;
  const c = this.pl;
  if (this.walkT > 0) { this.walkT -= dt; if (this.walkT <= 0) { this.walkT = 0; this.walked = true; this.emit('walked'); } }
  this.controls(dt);
  this.plo.x = c.x; this.plo.y = c.y; this.plo.h = c.h; this.plo.v = c.v;
  this.pedsStep(dt);
  for (const a of this.ai) aiStep(this, a, dt);
  const px = c.x, py = c.y, ph = c.h;
  for (let i = 0; i < 8; i++) physStep(c, dt / 8);
  if (Math.abs(c.v) > 0.01 || c.x !== px) {
    const cs = corners(c.x, c.y, c.h, CAR_L, CAR_W);
    if (!cs.every(p => drivable(this.W, p[0], p[1]))) { c.x = px; c.y = py; c.h = ph; c.v = 0; this.hit('curb'); this.emit('bump'); }
  }
  this.collide();
  if (this.lt) this.lt.tick(dt, c.L);
  this.monitor(dt);
  this.items(dt);
  this.respT -= dt;
  if (this.respT <= 0) { this.respT = 1; for (const a of this.ai) if (!a.fixed && (Math.hypot(a.x - c.x, a.y - c.y) > 560 || a.stuck > 70)) this.placeAI(a, 180, 480); }
};
const WHEELS = [[1.3, 0.88], [1.3, -0.88], [-1.3, 0.88], [-1.3, -0.88]];
SP.monitor = function (dt) {
  const c = this.pl, m = this.m, t = this.t, W = this.W, sp = kmh(Math.abs(c.v)), moving = Math.abs(c.v) > 0.3;
  if (!this.inCar) return;
  if (c.stallEvt) { c.stallEvt = false; this.hit('stall'); this.emit('stall'); }
  const loc = locate(W, c.x, c.y); this.loc = loc;
  if (moving && !c.belt) this.hit('belt');
  let lim = this.lim;
  if (loc && loc.road) { lim = loc.road.limit; const z = zoneAt(W, loc.road, loc.s); if (z && z.limit) lim = z.limit; }
  this.lim = lim;
  if (sp > lim + 0.5) { m.spd += dt; if (m.spd > 0.6) this.hit('speed', '限速' + lim + 'km/h，实际' + Math.round(sp) + 'km/h'); } else m.spd = 0;
  if (c.hb && moving && c.v > 0) { m.hbD += Math.abs(c.v) * dt; if (m.hbD > 2) this.hit('hb10'); if (m.hbD > 25) this.hit('hb'); } else if (!c.hb) m.hbD = 0;
  if (c.gear === 'N' && sp > 10) { m.nT += dt; if (m.nT > 2.5) this.hit('coast'); } else m.nT = 0;
  if (c.manual && c.clutch > 0.6 && sp > 12 && c.brk < 0.1) { m.clT += dt; if (m.clT > 4) this.hit('clutchCoast'); } else m.clT = 0;
  if (c.manual && c.on && c.gear !== 'N' && c.clutch < 0.3) {
    const rpm = rpmOf(c);
    if (rpm > 4600 || (rpm < 950 && c.gear !== '1' && c.gear !== 'R' && sp > 3)) { m.rpmT += dt; if (m.rpmT > 3) this.hit('rpm', Math.round(rpm) + '转/分'); } else m.rpmT = 0;
  }
  if (m.lcGrace > 0) m.lcGrace -= dt;
  if (this.o.mode === 'exam' && loc && loc.road && !ROUTE_ROADS[loc.road.id] && this.idx > 2) { m.off += dt; if (m.off > 3) this.hit('cmd', '未按考试路线行驶'); } else m.off = 0;
  if (!loc) { this.rr = null; return; }
  if (loc.node) { this.rr = null; m.prevF = null; m.onDiv = false; if (m.inter) { m.inter.entered = 1; this.interStep(); } return; }
  const r = loc.road, s = loc.s, hx = Math.cos(c.h), hy = Math.sin(c.h), sg = (hx * r.dx + hy * r.dy) >= 0 ? 1 : -1, ur = loc.u * sg;
  const al = Math.abs(angN(c.h - r.h - (sg < 0 ? PI : 0)));
  this.rr = { r, s, u: loc.u, sg, ur, al };
  let mn = 1e9, mx = -1e9; const ca = Math.cos(c.h), sa = Math.sin(c.h);
  for (const [a, b] of WHEELS) { const q = toRoad(r, c.x + ca * a - sa * b, c.y + sa * a + ca * b); if (q.u < mn) mn = q.u; if (q.u > mx) mx = q.u; }
  const touch = U => mn < U + 0.08 && mx > U - 0.08;
  const inUturn = r.uturn && s > r.uturn[0] - 12 && s < r.uturn[1] + 12;
  if (mn < 0.25 && mx > -0.25 && lineType(r, 'c', s) === 'solid') this.hit('center');
  if ((touch(HALF) && lineType(r, 'e+', s) === 'solid' ) || (touch(-HALF) && lineType(r, 'e-', s) === 'solid')) this.hit('edge');
  if ((touch(LW) && lineType(r, 'd+', s) === 'solid') || (touch(-LW) && lineType(r, 'd-', s) === 'solid')) this.hit('solid');
  const dOwn = LW * sg;
  if (touch(dOwn) && lineType(r, sg > 0 ? 'd+' : 'd-', s)) {
    if (!m.onDiv) { m.onDiv = true; m.divT = 0; if (m.lcGrace <= 0 && al < 0.45 && moving) this.laneChange(ur > LW ? 'L' : 'R'); }
    m.divT += dt; if (m.divT > 10) this.hit('straddle');
  } else m.onDiv = false;
  if (ur < -0.4 && moving && !inUturn && al < 1.2) { m.ww += dt; if (m.ww > 0.8) this.hit('wrongway'); } else m.ww = 0;
  const fS = s + sg * 2.3 * Math.cos(al);
  if (m.prevF && m.prevF.r === r && ur > 0 && al < 0.7) {
    const sl = sg > 0 ? r.len - SL : SL;
    if ((m.prevF.f - sl) * sg < 0 && (fS - sl) * sg >= 0) {
      const node = sg > 0 ? r.b : r.a, ax = r.hz ? 'EW' : 'NS';
      m.inter = { node, ax, h0: angN(r.h + (sg < 0 ? PI : 0)), lane: ur < LW ? 0 : 1, sS: sigState(node, ax, 'S', t).c, sL: sigState(node, ax, 'L', t).c, t, turned: '', r, sp, entered: 0 };
      this.ev('stopline', m.inter);
    }
    for (const st of this.cw) {
      if (st.cw.road !== r) continue;
      const e = st.cw.s - 2.6 * sg;
      if ((m.prevF.f - e) * sg < 0 && (fS - e) * sg >= 0) {
        const block = st.peds.some(p => p.st === 'walk' && Math.abs(p.p) < CURB + 0.4 && (p.p * sg > -1.5 || (p.dir * sg > 0 && p.p * sg > -4.5)));
        if (block) this.hit('ped');
        this.ev('cwcross', st);
      }
    }
  }
  m.prevF = { r, f: fS };
  if (m.inter) {
    const I = m.inter, dn = I.node === r.a ? s : r.len - s;
    if (dn < SL + 3) this.interStep();
    if (I.entered && dn >= SL - 1) this.interExit();
    else if (!I.entered && dn > SL + 8) m.inter = null;
  }
};
SP.laneChange = function (dir) {
  this.checkSig(dir, '变更车道');
  if (!this.mirror(dir, 10)) this.hit('noobs', dir === 'L' ? '变道前未观察左后视镜' : '变道前未观察右后视镜');
  else if (!this.head(dir, 10)) this.hit('noobs', '变道前未向' + (dir === 'L' ? '左' : '右') + '侧头观察');
  this.ev('lc', dir);
};
SP.interStep = function () {
  const I = this.m.inter; if (!I) return;
  const dh = angN(this.pl.h - I.h0);
  if (!I.turned && Math.abs(dh) > 0.26) {
    I.turned = dh > 0 ? 'L' : 'R';
    const nm = I.turned === 'L' ? '路口左转' : '路口右转';
    this.checkSig(I.turned, nm);
    if (!this.looked(I.turned, 12)) this.hit('noobs', I.turned === 'L' ? '转弯前未观察左侧交通情况' : '转弯前未观察右侧交通情况');
    this.ev('turn', I);
  }
};
SP.interExit = function () {
  const I = this.m.inter, dh = angN(this.pl.h - I.h0);
  const mv = Math.abs(dh) < 0.6 ? 'S' : Math.abs(dh) > 2.4 ? 'U' : dh > 0 ? 'L' : 'R';
  if (mv === 'S' && this.pl.L.turn) this.hit('wrongsig', '直行通过路口时开启了转向灯');
  if ((mv === 'S' && I.sS === 'R') || ((mv === 'L' || mv === 'U') && I.sL === 'R')) this.hit('red');
  if (I.node.sig) {
    if (I.lane === 1 && (mv === 'L' || mv === 'U')) this.hit('lanerule', '从右侧车道左转或掉头');
    if (I.lane === 0 && mv === 'R') this.hit('lanerule', '从左侧车道右转');
  }
  this.m.lcGrace = 2.5; this.m.inter = null;
  this.ev('cross', { node: I.node, mv });
};
SP.items = function (dt) {
  if (!this.seq.length || (this.over && this.o.mode !== 'free')) return;
  if (!this.cur) {
    const key = this.seq[this.idx]; if (!key) return;
    const it = ITEMS[key];
    if (!it.trig || it.trig(this)) {
      this.cur = { key, it, S: { t0: this.t, odo0: this.pl.odo } }; this.res[key] = 'act';
      this.emit('item', { key, name: it.name });
      if (it.start) it.start(this, this.cur.S);
    }
    return;
  }
  if (this.cur.it.upd && this.cur.it.upd(this, this.cur.S, dt) === 'done') this.finishItem();
};
SP.finishItem = function () {
  const k = this.cur.key, nm = ITEMS[k].name, J = this.J;
  this.res[k] = J.itemFail[nm] ? 'fail' : J.itemDed[nm] ? 'ded' : 'ok';
  this.emit('itemdone', { key: k, name: nm, res: this.res[k] });
  this.cur = null; this.idx++; this.lastDone = { key: k, t: this.t, odo: this.pl.odo };
  if (this.idx >= this.seq.length && !this.over) { this.over = true; this.emit('end', this.result()); }
};
SP.result = function () { const J = this.J; return { score: J.score, pass: !J.fail && J.score >= 90, log: J.log.slice(), res: Object.assign({}, this.res), seq: this.seq.slice(), fail: J.fail, mode: this.o.mode, item: this.o.item }; };
SP.tip = function () { if (!this.cur) return ''; const it = this.cur.it; return it.tip ? it.tip(this, this.cur.S) : ''; };

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

/* ======================= 仪表 / 图标 ======================= */
const IC = {
  turnL: { f: 'M2 12l8-7v4h11v6H10v4z' }, turnR: { f: 'M22 12l-8-7v4H3v6h11v4z' },
  low: { f: 'M10 5C5 5 3 8.5 3 12s2 7 7 7z', s: 'M13 7.5l8 2.5M13 12l8 2.5M13 16.5l8 2.5' },
  high: { f: 'M10 5C5 5 3 8.5 3 12s2 7 7 7z', s: 'M13 7h8M13 12h8M13 17h8' },
  pos: { f: 'M8 7a5 5 0 0 0 0 10zM16 7a5 5 0 0 1 0 10z', s: 'M1.5 8l3 1.2M1.5 12h3M1.5 16l3-1.2M22.5 8l-3 1.2M22.5 12h-3M22.5 16l-3-1.2' },
  fogF: { f: 'M9 5C5 5 3 8.5 3 12s2 7 6 7z', s: 'M12 7.5l8 2M12 12l8 2M12 16.5l8 2M16 4c-1.6 3 1.6 5 0 8s1.6 5 0 8' },
  fogR: { f: 'M15 5c4 0 6 3.5 6 7s-2 7-6 7z', s: 'M12 7H4M12 12H4M12 17H4M8 4c-1.6 3 1.6 5 0 8s1.6 5 0 8' },
  haz: { f: 'M12 2L23 21H1zM12 7.6L18.1 18H5.9z', eo: 1 },
  belt: { f: 'M12 2.5a2.6 2.6 0 1 1 0 5.2 2.6 2.6 0 0 1 0-5.2z', s: 'M7.5 22v-7.5c0-3 2-5 4.5-5s4.5 2 4.5 5V22M8.5 10.5l7 10' },
  hb: { s: 'M12 4.5a7.5 7.5 0 1 0 .01 0zM10 8.5v7M10 8.5h2.6a2 2 0 0 1 0 4H10M3.6 6.5a10 10 0 0 0 0 11M20.4 6.5a10 10 0 0 1 0 11' },
  bat: { s: 'M3 7.5h18v11H3zM6.5 7.5V5.5M17.5 7.5V5.5M6 13h3.5M14.5 13h3.5M16.25 11.25v3.5' },
  oil: { s: 'M2.5 11h9l3 3.5 7-2.5-3 6.5H5zM8 11V8.5M5.5 8.5h5M21.5 9.5v1' },
  horn: { f: 'M3 9.5v5h4l5.5 4.5v-14L7 9.5z', s: 'M15.5 9a4.5 4.5 0 0 1 0 6M18 6.5a8 8 0 0 1 0 11' },
  pwr: { s: 'M12 3v8M6.5 6.5a7.8 7.8 0 1 0 11 0' },
  eye: { s: 'M1.5 12S5.5 5 12 5s10.5 7 10.5 7-4 7-10.5 7S1.5 12 1.5 12zM12 9a3 3 0 1 0 .01 0z' }
};
const ICOL = { turnL: '#2bd96b', turnR: '#2bd96b', low: '#2bd96b', high: '#3b8bff', pos: '#2bd96b', fogF: '#2bd96b', fogR: '#ffb020', haz: '#ff4d4f', belt: '#ff4d4f', hb: '#ff4d4f', bat: '#ff4d4f', oil: '#ff4d4f' };
function icoSvg(k, col, sz) {
  const i = IC[k]; sz = sz || 22;
  return '<svg viewBox="0 0 24 24" width="' + sz + '" height="' + sz + '">' + (i.f ? '<path d="' + i.f + '" fill="' + col + '"' + (i.eo ? ' fill-rule="evenodd"' : '') + '/>' : '') + (i.s ? '<path d="' + i.s + '" fill="none" stroke="' + col + '" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>' : '') + '</svg>';
}
const P2D = {};
function icoCv(ctx, k, x, y, sz, col) {
  const i = IC[k]; if (!P2D[k]) P2D[k] = { f: i.f && new Path2D(i.f), s: i.s && new Path2D(i.s) };
  ctx.save(); ctx.translate(x, y); ctx.scale(sz / 24, sz / 24);
  if (P2D[k].f) { ctx.fillStyle = col; ctx.fill(P2D[k].f, i.eo ? 'evenodd' : 'nonzero'); }
  if (P2D[k].s) { ctx.strokeStyle = col; ctx.lineWidth = 2; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.stroke(P2D[k].s); }
  ctx.restore();
}
function lightInd(L, inCar, on, blink) {
  const b = beam(L);
  return [['turnL', (L.turn === 'L' || L.hazard) && blink], ['pos', L.rot >= 1], ['low', b === 'low' || (b === 'high' && L.rot === 2)], ['high', b === 'high'], ['fogF', L.fogF], ['fogR', L.fogR], ['haz', L.hazard && blink], ['turnR', (L.turn === 'R' || L.hazard) && blink]];
}
function gauge(ctx, cx, cy, r, val, max, step, lab, red, unit) {
  const a0 = PI * 0.75, a1 = PI * 2.25, A = v => a0 + (a1 - a0) * clamp(v / max, 0, 1);
  ctx.lineCap = 'butt';
  ctx.strokeStyle = 'rgba(255,255,255,.1)'; ctx.lineWidth = r * 0.09; ctx.beginPath(); ctx.arc(cx, cy, r * 0.93, a0, a1); ctx.stroke();
  if (red) { ctx.strokeStyle = '#ff4d4f'; ctx.beginPath(); ctx.arc(cx, cy, r * 0.93, A(red), a1); ctx.stroke(); }
  const g = ctx.createLinearGradient(cx - r, cy, cx + r, cy); g.addColorStop(0, '#36c2ff'); g.addColorStop(1, '#7c5cff');
  ctx.strokeStyle = g; ctx.beginPath(); ctx.arc(cx, cy, r * 0.93, a0, A(val)); ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,.75)'; ctx.font = '600 ' + Math.max(8, r * 0.17) + 'px system-ui,sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  for (let v = 0; v <= max + 1e-6; v += step) {
    const a = A(v), ca = Math.cos(a), sa = Math.sin(a);
    ctx.strokeStyle = 'rgba(255,255,255,.55)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(cx + ca * r * 0.8, cy + sa * r * 0.8); ctx.lineTo(cx + ca * r * 0.7, cy + sa * r * 0.7); ctx.stroke();
    if (r > 30) ctx.fillText(String(Math.round(v)), cx + ca * r * 0.55, cy + sa * r * 0.55);
  }
  const a = A(val);
  ctx.strokeStyle = '#ff5a36'; ctx.lineWidth = Math.max(2, r * 0.05); ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(cx - Math.cos(a) * r * 0.12, cy - Math.sin(a) * r * 0.12); ctx.lineTo(cx + Math.cos(a) * r * 0.78, cy + Math.sin(a) * r * 0.78); ctx.stroke();
  ctx.fillStyle = '#222833'; ctx.beginPath(); ctx.arc(cx, cy, r * 0.1, 0, TAU); ctx.fill();
  ctx.fillStyle = '#fff'; ctx.font = '700 ' + r * 0.32 + 'px system-ui,sans-serif'; ctx.fillText(lab, cx, cy + r * 0.42);
  ctx.fillStyle = 'rgba(255,255,255,.55)'; ctx.font = '500 ' + Math.max(7, r * 0.13) + 'px system-ui,sans-serif'; ctx.fillText(unit, cx, cy + r * 0.7);
}
function rrect(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
function drawDash(ctx, sim, x, y, w, h) {
  const c = sim.pl, L = c.L, blink = (sim.t % 0.8) < 0.42;
  ctx.save();
  rrect(ctx, x, y, w, h, 16); const bg = ctx.createLinearGradient(0, y, 0, y + h); bg.addColorStop(0, 'rgba(18,22,32,.86)'); bg.addColorStop(1, 'rgba(6,8,14,.92)');
  ctx.fillStyle = bg; ctx.fill(); ctx.strokeStyle = 'rgba(255,255,255,.14)'; ctx.lineWidth = 1; ctx.stroke();
  const r = Math.min(h * 0.47, w * 0.2), sp = kmh(Math.abs(c.v));
  gauge(ctx, x + r + 10, y + h * 0.53, r, sp, 160, 20, String(Math.round(sp)), 0, 'km/h');
  gauge(ctx, x + w - r - 10, y + h * 0.53, r, rpmOf(c) / 1000, 8, 1, (rpmOf(c) / 1000).toFixed(1), 6, '×1000rpm');
  const mx = x + w / 2, cwid = w - 4 * r - 30;
  if (cwid > 60) {
    const inds = lightInd(L, sim.inCar, c.on, blink), isz = Math.min(18, cwid / 8.6);
    inds.forEach(([k, onn], i) => icoCv(ctx, k, mx - inds.length * isz * 0.56 + i * isz * 1.12, y + 8, isz, onn ? ICOL[k] : 'rgba(255,255,255,.12)'));
    const warn = []; if (sim.inCar && !c.belt) warn.push('belt'); if (c.hb) warn.push('hb'); if (sim.inCar && !c.on) warn.push('bat', 'oil');
    warn.forEach((k, i) => icoCv(ctx, k, mx - warn.length * isz * 0.6 + i * isz * 1.2, y + h - isz - 6, isz, k === 'belt' && !blink ? 'rgba(255,77,79,.4)' : ICOL[k]));
    const gs = c.manual ? c.gear : c.gear;
    ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = '800 ' + Math.min(h * 0.36, cwid * 0.4) + 'px system-ui,sans-serif'; ctx.fillText(gs, mx - (c.manual ? 0 : 0), y + h * 0.48);
    if (!c.manual) { ctx.font = '600 ' + h * 0.11 + 'px system-ui,sans-serif'; ['P', 'R', 'N', 'D'].forEach((g, i) => { ctx.fillStyle = g === c.gear ? '#ffb020' : 'rgba(255,255,255,.35)'; ctx.fillText(g, mx - h * 0.27 + i * h * 0.18, y + h * 0.74); }); }
    else { ctx.font = '600 ' + h * 0.1 + 'px system-ui,sans-serif'; ctx.fillStyle = 'rgba(255,255,255,.5)'; ctx.fillText('挡位 · 离合 ' + Math.round(c.clutch * 100) + '%', mx, y + h * 0.74); }
    if (sim.lim && cwid > 110) { const lx = mx + cwid / 2 - h * 0.15 - 4, ly = y + h * 0.48; signFace(ctx, 'speed', sim.lim, lx, ly, h * 0.15, 1); }
  }
  ctx.restore();
}

/* ======================= CSS ======================= */
const CSS = `
.s3-hero{position:relative;overflow:hidden;border-radius:20px;padding:20px;color:#fff;margin-bottom:14px;background:linear-gradient(135deg,#fb923c,#ea580c 55%,#c2410c)}
.s3-hero h2{margin:0 0 4px;font-size:22px}.s3-hero p{margin:0;opacity:.92;font-size:14px}
.s3-hero .st{display:flex;gap:18px;margin-top:14px}.s3-hero .st b{display:block;font-size:22px;line-height:1.1}.s3-hero .st span{font-size:12px;opacity:.85}
.s3-trans{display:flex;align-items:center;justify-content:space-between;gap:10px;margin:-2px 0 14px}
.s3-cards{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:6px}
@media(max-width:640px){.s3-cards{grid-template-columns:1fr}}
.s3-card{position:relative;overflow:hidden;border-radius:16px;padding:16px;cursor:pointer;color:#fff;min-height:118px;box-shadow:var(--shadow);transition:transform .12s}
.s3-card:active{transform:scale(.985)}.s3-card h3{margin:0 0 4px;font-size:18px}.s3-card p{margin:0;font-size:13px;opacity:.92}
.s3-card .ic{position:absolute;right:12px;bottom:10px;opacity:.28}
.s3-c1{background:linear-gradient(135deg,#1e293b,#0f172a)}.s3-c2{background:linear-gradient(135deg,#f97316,#dc2626)}.s3-c3{background:linear-gradient(135deg,#0ea5e9,#2563eb)}
.s3-items{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:10px;margin-bottom:6px}
.s3-tile{display:flex;align-items:center;gap:10px;padding:11px 12px;border-radius:14px;background:var(--card);box-shadow:var(--shadow);cursor:pointer;color:var(--text);position:relative}
.s3-tile:active{transform:scale(.98)}.s3-tile .n{width:34px;height:34px;border-radius:10px;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:800;flex:none;background:linear-gradient(135deg,#fb923c,#ea580c)}
.s3-tile b{font-size:14px;font-weight:600}.s3-tile small{display:block;color:var(--text3);font-size:11px}
.s3-tile .ok{position:absolute;right:8px;top:6px;font-size:11px;color:var(--ok)}
.s3-acc details{border-bottom:1px solid var(--line);padding:2px 0}.s3-acc details:last-child{border-bottom:0}
.s3-acc summary{cursor:pointer;padding:10px 2px;font-weight:600;list-style:none;display:flex;justify-content:space-between}
.s3-acc summary::after{content:"›";color:var(--text3);transform:rotate(90deg);transition:.2s}.s3-acc details[open] summary::after{transform:rotate(-90deg)}
.s3-acc ul{margin:0 0 10px;padding-left:20px;font-size:14px;color:var(--text2)}.s3-acc li{margin:3px 0}
.s3-kj{margin:6px 0 10px;padding:9px 12px;border-radius:10px;background:var(--warn-bg);border-left:4px solid var(--warn);font-size:14px}
.s3-tag{display:inline-block;font-size:11px;padding:0 6px;border-radius:5px;margin-right:4px;font-weight:700;color:#fff;background:var(--bad)}.s3-tag.t10{background:var(--warn)}.s3-tag.t5{background:#64748b}
.s3-hist{display:flex;flex-wrap:wrap;gap:6px}
/* 灯光考试页 */
.s3-lp-wrap{max-width:860px;margin:0 auto}
.s3-cock{border-radius:22px;padding:16px;background:radial-gradient(120% 90% at 50% 0,#252c3a,#0b0e14 70%);color:#e8edf5;box-shadow:0 10px 30px rgba(0,0,0,.35);margin-bottom:14px;position:relative;overflow:hidden}
.s3-clu{display:flex;align-items:center;justify-content:center;gap:12px;padding:12px 10px;border-radius:16px;background:rgba(0,0,0,.45);border:1px solid rgba(255,255,255,.08);flex-wrap:wrap}
.s3-clu .i{display:flex;flex-direction:column;align-items:center;font-size:10px;color:rgba(255,255,255,.4);gap:2px;min-width:38px}
.s3-clu .i.on{color:#fff}
.s3-q{min-height:86px;display:flex;align-items:center;gap:14px;margin:14px 0;padding:12px 14px;border-radius:14px;background:rgba(255,255,255,.06)}
.s3-q .t{flex:1;font-size:17px;font-weight:600;line-height:1.45}
.s3-ring{width:58px;height:58px;flex:none;position:relative}.s3-ring svg{transform:rotate(-90deg)}.s3-ring b{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-size:20px}
.s3-ctl{display:grid;grid-template-columns:1fr auto;gap:14px;align-items:center}
@media(max-width:560px){.s3-ctl{grid-template-columns:1fr}}
.s3-stalk{position:relative;border-radius:16px;background:rgba(255,255,255,.04);padding:10px;border:1px solid rgba(255,255,255,.07)}
.s3-stalk svg{width:100%;height:auto;display:block;touch-action:none}
.s3-rot{display:flex;gap:6px;margin-top:8px}.s3-rot button,.s3-lev button,.s3-side button{flex:1;border:1px solid rgba(255,255,255,.14);background:rgba(255,255,255,.06);color:#e8edf5;border-radius:10px;padding:8px 4px;font-size:13px;font-weight:600;cursor:pointer;user-select:none;-webkit-user-select:none;touch-action:none}
.s3-rot button.on,.s3-lev button.on,.s3-side button.on{background:#ffb020;color:#111;border-color:#ffb020}
.s3-lev{display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-top:6px}
.s3-side{display:flex;flex-direction:column;gap:8px;min-width:150px}
.s3-hz{width:86px;height:86px;border-radius:18px;margin:0 auto;border:0;cursor:pointer;background:linear-gradient(#3a1d1f,#1d0f10);box-shadow:inset 0 0 0 2px rgba(255,77,79,.5);display:flex;align-items:center;justify-content:center;flex-direction:column;color:#ff8a8a;font-size:11px;gap:2px}
.s3-hz.on{background:linear-gradient(#ff5a5f,#c81e24);color:#fff;box-shadow:0 0 22px rgba(255,77,79,.7)}
.s3-res-i{display:flex;gap:10px;padding:10px 0;border-bottom:1px solid var(--line)}.s3-res-i:last-child{border-bottom:0}
.s3-res-i .m{width:24px;height:24px;border-radius:50%;flex:none;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:800;font-size:13px}
.s3-res-i .m.ok{background:var(--ok)}.s3-res-i .m.bad{background:var(--bad)}.s3-res-i .m.pend{background:var(--text3)}.s3-res-i .m.ded{background:var(--warn)}
.s3-score{font-size:46px;font-weight:900;text-align:center;line-height:1}.s3-score small{font-size:16px;font-weight:600;margin-left:2px}
.s3-score.ok{color:var(--ok)}.s3-score.bad{color:var(--bad)}
/* 驾驶 */
.s3-drive{position:relative;width:100%;height:100%;overflow:hidden;background:#000;user-select:none;-webkit-user-select:none;touch-action:none;font-family:-apple-system,BlinkMacSystemFont,"PingFang SC","Microsoft YaHei",sans-serif;color:#fff}
.s3-drive canvas.s3-cv{position:absolute;inset:0;width:100%;height:100%;display:block}
.s3-g{background:rgba(14,18,28,.55);backdrop-filter:blur(10px) saturate(1.4);-webkit-backdrop-filter:blur(10px) saturate(1.4);border:1px solid rgba(255,255,255,.14);box-shadow:0 4px 18px rgba(0,0,0,.25)}
.s3-top{position:absolute;left:8px;right:8px;top:calc(6px + env(safe-area-inset-top,0px));display:flex;gap:6px;align-items:flex-start;pointer-events:none;z-index:5}
.s3-top>*{pointer-events:auto}
.s3-rb{width:38px;height:38px;border-radius:12px;display:flex;align-items:center;justify-content:center;cursor:pointer;color:#fff;font-size:15px;font-weight:700;flex:none}
.s3-pill{height:38px;border-radius:12px;padding:0 12px;display:flex;align-items:center;gap:8px;font-size:13px;white-space:nowrap}
.s3-pill b{font-size:17px}
.s3-instr{position:absolute;left:50%;transform:translateX(-50%);top:calc(50px + env(safe-area-inset-top,0px));width:max-content;max-width:min(560px,82vw);padding:8px 16px;border-radius:14px;font-size:15px;font-weight:700;text-align:center;z-index:4;pointer-events:none;transition:opacity .3s}
.s3-instr small{display:block;font-weight:500;font-size:12px;opacity:.85;margin-top:2px}
.s3-instr.hl{background:rgba(249,115,22,.82)}
.s3-tip{position:absolute;left:50%;transform:translateX(-50%);width:max-content;max-width:min(600px,92vw);padding:6px 12px;border-radius:12px;font-size:13px;text-align:center;z-index:6;pointer-events:none;color:#fde68a}
.s3-toasts{position:absolute;left:50%;transform:translateX(-50%);top:96px;display:flex;flex-direction:column;gap:6px;align-items:center;z-index:6;pointer-events:none;width:min(520px,70vw)}
.s3-toast{padding:7px 12px;border-radius:11px;font-size:13px;font-weight:600;animation:s3in .25s;max-width:100%}
.s3-toast.bad{background:rgba(220,38,38,.88)}.s3-toast.ded{background:rgba(217,119,6,.9)}.s3-toast.ok{background:rgba(22,163,74,.88)}.s3-toast.info{background:rgba(15,23,42,.8)}
@keyframes s3in{from{opacity:0;transform:translateY(-8px)}}
.s3-eye{position:absolute;left:50%;top:42%;transform:translate(-50%,-50%);padding:10px 16px;border-radius:16px;display:flex;align-items:center;gap:8px;font-weight:700;opacity:0;transition:opacity .2s;pointer-events:none;z-index:6}
.s3-eye.on{opacity:1}
.s3-sig{position:absolute;right:10px;top:50px;border-radius:12px;padding:5px 8px;display:none;align-items:center;gap:6px;font-size:12px;z-index:4}
.s3-sig i{width:18px;height:18px;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;font-style:normal;font-size:11px;font-weight:900;color:#111}
.s3-fn{position:absolute;display:grid;grid-template-columns:repeat(3,auto);gap:6px;z-index:5}
.s3-fb{width:52px;height:44px;border-radius:12px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:1px;font-size:10px;cursor:pointer;color:#fff;line-height:1.1;touch-action:none}
.s3-fb svg{width:18px;height:18px}
.s3-fb.on{background:rgba(255,176,32,.9);color:#111;border-color:#ffb020}.s3-fb.on svg *{stroke:#111;fill-opacity:1}
.s3-fb.red.on{background:rgba(239,68,68,.92);color:#fff}
.s3-fb.flash{animation:s3fl .8s infinite}@keyframes s3fl{50%{background:rgba(255,176,32,.35)}}
.s3-wheel{position:absolute;left:12px;bottom:calc(10px + env(safe-area-inset-bottom,0px));width:150px;height:150px;z-index:5;touch-action:none;cursor:grab}
.s3-wheel svg{width:100%;height:100%;filter:drop-shadow(0 6px 14px rgba(0,0,0,.45))}
.s3-ped{position:absolute;right:12px;bottom:calc(10px + env(safe-area-inset-bottom,0px));display:flex;gap:8px;align-items:flex-end;z-index:5}
.s3-pd{width:58px;border-radius:12px;display:flex;flex-direction:column;align-items:center;justify-content:flex-end;padding-bottom:8px;font-size:12px;font-weight:700;position:relative;overflow:hidden;touch-action:none;cursor:pointer}
.s3-pd i{position:absolute;left:0;right:0;bottom:0;background:linear-gradient(0deg,rgba(255,176,32,.75),rgba(255,176,32,.25));height:0}
.s3-pd span{position:relative}.s3-pd.thr{height:128px}.s3-pd.brk{height:104px;width:70px}.s3-pd.clu{height:104px}
.s3-pd.clu .bite{position:absolute;left:0;right:0;border-top:1px dashed rgba(255,255,255,.5);border-bottom:1px dashed rgba(255,255,255,.5);background:rgba(59,139,255,.18)}
.s3-gear{position:absolute;z-index:5;border-radius:14px;padding:6px;display:grid;gap:4px}
.s3-gear button{border:0;border-radius:8px;background:rgba(255,255,255,.1);color:#fff;font-weight:800;font-size:14px;width:34px;height:30px;cursor:pointer;padding:0;touch-action:none}
.s3-gear button.on{background:#ffb020;color:#111}
.s3-prep{position:absolute;left:50%;bottom:calc(18px + env(safe-area-inset-bottom,0px));transform:translateX(-50%);border-radius:18px;padding:14px 16px;z-index:7;text-align:center;min-width:260px;max-width:92vw}
.s3-prep h4{margin:0 0 4px;font-size:16px}.s3-prep p{margin:0 0 10px;font-size:13px;opacity:.85}
.s3-prep .row{justify-content:center;flex-wrap:wrap;gap:8px}
.s3-ab{border:1px solid rgba(255,255,255,.2);background:rgba(255,255,255,.12);color:#fff;border-radius:12px;padding:9px 14px;font-weight:700;font-size:14px;cursor:pointer}
.s3-ab.pri{background:#f97316;border-color:#f97316}.s3-ab.done{background:rgba(22,163,74,.85);border-color:transparent}.s3-ab[disabled]{opacity:.4;pointer-events:none}
.s3-lt{position:absolute;left:50%;top:50%;transform:translate(-50%,-62%);border-radius:18px;padding:14px 18px;z-index:6;display:none;align-items:center;gap:14px;max-width:min(560px,90vw);pointer-events:none}
.s3-lt .t{font-size:16px;font-weight:700;line-height:1.45}
.s3-lpop{position:absolute;z-index:8;border-radius:18px;padding:12px;width:min(360px,92vw);display:none;color:#e8edf5}
.s3-lpop.on{display:block}
.s3-pause{position:absolute;inset:0;z-index:20;background:rgba(5,8,14,.6);display:none;align-items:center;justify-content:center;padding:14px}
.s3-pause.on{display:flex}
.s3-menu{border-radius:20px;padding:18px;width:min(440px,96vw);max-height:92%;overflow:auto;color:#fff}
.s3-menu h3{margin:0 0 12px;font-size:18px}.s3-menu .row{margin:8px 0;justify-content:space-between}
.s3-menu .seg{background:rgba(255,255,255,.08)}.s3-menu .seg button{color:rgba(255,255,255,.75)}.s3-menu .seg button.on{background:#f97316;color:#fff}
.s3-keys{display:grid;grid-template-columns:auto 1fr auto 1fr;gap:4px 8px;font-size:12px;margin-top:10px;opacity:.9}
.s3-keys kbd{background:rgba(255,255,255,.14);border-radius:5px;padding:0 5px;font-family:ui-monospace,monospace;font-size:11px;text-align:center}
.s3-rot-hint{position:absolute;inset:0;z-index:30;background:rgba(0,0,0,.82);display:none;align-items:center;justify-content:center;flex-direction:column;gap:12px;text-align:center;padding:20px}
@media (orientation:portrait) and (max-width:700px){.s3-rot-hint.show{display:flex}}
.s3-hide{display:none!important}
`;

/* ======================= UI 公共 ======================= */
let A = null;
const ui = { cleanup: [] };
function on(t, ev, fn, opt) { t.addEventListener(ev, fn, opt); ui.cleanup.push(() => t.removeEventListener(ev, fn, opt)); }
function injectCss() { if (document.getElementById('sim3-css')) return; const s = document.createElement('style'); s.id = 'sim3-css'; s.textContent = CSS; document.head.appendChild(s); }
function transOf(q) { const g = String(q.gear || '').toLowerCase(); if (/^(auto|at|c2)$/.test(g)) return 'auto'; if (/^(manual|mt|c1)$/.test(g)) return 'manual'; return A.store.get('sim3_trans', A.settings.trans || 'manual'); }
const fmtT = t => { const d = new Date(t); return (d.getMonth() + 1) + '/' + d.getDate() + ' ' + String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'); };

/* ======================= 科目三首页 ======================= */
const GEN_FAIL = ['不按规定使用安全带', '不按考试员指令驾驶', '不能正确使用灯光、雨刮器等车辆常用操纵件', '起步时车辆后溜距离大于30cm', '驾驶车辆时视线离开行驶方向超过2秒，或低头看挡', '不能根据交通信号、标志、标线或者道路条件合理控制车速', '驾驶过程中车速超过限速', '行驶中空挡滑行', '连续变更两条或两条以上车道', '车辆行驶中骑轧车道中心实线或者车道边缘实线', '对可能出现危险的情形未采取减速、鸣喇叭等安全措施', '不按交通信号灯、标志、标线或者民警指挥信号行驶', '争道抢行，违反交通安全法律法规影响交通安全', '因观察、判断或者操作不当出现危险情况（含碰撞）', '制动、加速踏板使用错误', '起步、转向、变更车道、超车、靠边停车前不使用或者错误使用转向灯', '起步、转向、变更车道、超车、靠边停车前，开转向灯少于3秒即转向', '遇行人通过人行横道不停车让行'];
const GEN_10 = ['起步时车辆后溜，但后溜距离小于30cm', '驾驶过程中发动机熄火一次', '换挡时发生齿轮撞击', '使用挡位与车速长时间不匹配，造成发动机转速过高或过低', '车辆行驶中骑轧车道分界线（长时间）', '转弯时转、回方向过早、过晚，或者转向角度过大、过小', '遇情况时不会合理使用离合器半联动控制车速', '方向盘握法不正确或单手长时间控制方向盘', '起步时车辆发生闯动', '长时间踩离合器滑行'];
const GEN_5 = ['启动发动机前不调整驾驶座椅、后视镜、检查仪表', '下车前不将发动机熄火', '驾驶姿势不正确'];
const KEYS = [['← →', '方向盘'], ['↑ ↓', '油门 / 刹车'], ['C Shift', '离合（按住踩下，松开缓抬）'], ['1-5 R N', '挡位（自动挡 P R N D）'], ['Q E', '左 / 右转向灯'], ['空格', '手刹'], ['L', '灯光旋钮 OFF→示廓→近光'], ['K J', '远光 / 闪光（超车灯）'], ['Z', '危险报警闪光灯'], ['H', '喇叭'], ['B F', '安全带 / 点火'], ['O', '开门下车'], ['V X', '观察左 / 右后视镜'], ['G T', '向左 / 向右回头'], ['Tab', '切换视角'], ['Esc', '暂停']];
const kb = s => s.split(' ').map(x => '<span class="kbd">' + x + '</span>').join(' ');
function hub(el) {
  A.setTitle('科目三 · 道路驾驶');
  const hist = A.history('k3'), best = hist.length ? Math.max(...hist.map(h => h.score || 0)) : '--';
  const passN = hist.filter(h => h.pass).length, tr = A.store.get('sim3_trans', A.settings.trans || 'manual');
  const ires = A.store.get('sim3_items', {}), lres = A.store.get('sim3_lights', []);
  const g = '?gear=' + tr;
  const item = k => { const it = ITEMS[k]; return `<div class="s3-tile" data-go="#/k3/item/${k}${g}"><div class="n">${it.ico}</div><div><b>${it.name}</b><small>${k === 'yejian' ? '夜间灯光驾驶' : k === 'shangche' ? '绕车·调座·安全带' : '分项练习 · 实时指导'}</small></div>${ires[k] ? `<span class="ok" style="color:${ires[k] === 'ok' ? 'var(--ok)' : 'var(--bad)'}">${ires[k] === 'ok' ? '✓ 已通过' : '✗ 未通过'}</span>` : ''}</div>`; };
  const lightRows = LT.map(t => `<tr><td>${t.q}</td><td><b>${t.a}</b></td></tr>`).join('');
  el.innerHTML = `
  <div class="s3-hero fade-in">
    <h2>科目三 · 道路驾驶技能</h2>
    <p>16 个考试项目 · 电子路考全流程 · 真实交通流 · 伪3D 驾驶视角。满分 100 分，90 分及格。</p>
    <div class="st"><div><b>${best}</b><span>最佳成绩</span></div><div><b>${hist.length}</b><span>模拟次数</span></div><div><b>${hist.length ? Math.round(passN / hist.length * 100) + '%' : '--'}</b><span>通过率</span></div></div>
  </div>
  <div class="s3-trans"><span class="muted small">变速箱：C1 手动挡需操作离合，C2 自动挡 PRND</span><div class="seg" id="s3tr"><button data-v="manual" class="${tr === 'manual' ? 'on' : ''}">C1 手动</button><button data-v="auto" class="${tr === 'auto' ? 'on' : ''}">C2 自动</button></div></div>
  <div class="s3-cards">
    <div class="s3-card s3-c1" data-go="#/k3/lights"><h3>灯光模拟考试</h3><p>真实灯光组合开关 · 语音指令 · 5 秒内操作 · 标准答案解析</p><div class="ic">${icoSvg('high', '#fff', 54)}</div></div>
    <div class="s3-card s3-c2" data-go="#/k3/exam${g}"><h3>路考全真模拟</h3><p>上车准备 → 灯光 → 起步 → 14 项路考 → 靠边停车，语音播报 · 自动评判</p><div class="ic">${icoSvg('turnL', '#fff', 54)}</div></div>
    <div class="s3-card s3-c3" data-go="#/k3/free${g}"><h3>自由驾驶</h3><p>小城路网自由开，红绿灯、行人、公交、学校区域，违规实时提醒</p><div class="ic">${icoSvg('eye', '#fff', 54)}</div></div>
  </div>
  <div class="section-title">分项练习 · 16 项（带实时教练提示）</div>
  <div class="s3-items">${ITEM_ORDER.map(item).join('')}</div>
  <div class="section-title">评判标准 & 考试技巧</div>
  <div class="card s3-acc">
    <details open><summary>考试概况</summary><ul>
      <li>科目三道路驾驶技能考试满分 <b>100</b> 分，成绩达到 <b>90</b> 分合格；出现任一"不合格"情形即判定考试不合格。</li>
      <li>考试内容：上车准备、起步、直线行驶、加减挡位操作、变更车道、靠边停车、直行通过路口、路口左转弯、路口右转弯、通过人行横道线、通过学校区域、通过公共汽车站、会车、超车、掉头、夜间行驶（灯光模拟）。</li>
      <li>依据：《机动车驾驶人考试内容和方法》（GA 1026）及《机动车驾驶证申领和使用规定》（公安部令第162号）。各地考场可在此基础上制定细则（如限速、挡位要求），以当地考场为准。</li>
      <li>每次预约有 2 次考试机会，第一次不合格可当场补考一次。</li></ul></details>
    <details><summary>通用评判 · 不合格项</summary><ul>${GEN_FAIL.map(s => `<li><span class="s3-tag">不合格</span>${s}</li>`).join('')}</ul></details>
    <details><summary>通用评判 · 扣分项</summary><ul>${GEN_10.map(s => `<li><span class="s3-tag t10">扣10</span>${s}</li>`).join('')}${GEN_5.map(s => `<li><span class="s3-tag t5">扣5</span>${s}</li>`).join('')}</ul></details>
    <details><summary>灯光模拟考试 · 标准答案</summary><div style="overflow:auto"><table class="tbl" style="margin-bottom:10px"><tr><th>语音指令</th><th>正确操作</th></tr>${lightRows}</table></div>
      <div class="s3-kj">口诀：${ITEMS.yejian.kj}</div></details>
    ${ITEM_ORDER.map(k => { const it = ITEMS[k]; return `<details><summary>${it.name}</summary><div class="small muted" style="margin:-4px 0 4px">操作要领</div><ul>${it.steps.map(s => `<li>${s}</li>`).join('')}</ul><div class="s3-kj">口诀：${it.kj}</div><div class="small muted">评判要点</div><ul>${it.judge.map(s => `<li>${s.replace(/，?(不合格|扣10分|扣5分)$/, (m, a) => '') }<span class="s3-tag ${/扣10/.test(s) ? 't10' : /扣5/.test(s) ? 't5' : ''}" style="margin-left:6px">${/扣10/.test(s) ? '扣10' : /扣5/.test(s) ? '扣5' : '不合格'}</span></li>`).join('')}</ul></details>`; }).join('')}
  </div>
  <div class="section-title">模拟器操作</div>
  <div class="card small">
    <table class="tbl">${KEYS.map((k, i) => i % 2 ? '' : `<tr><td>${kb(k[0])}</td><td>${k[1]}</td><td>${KEYS[i + 1] ? kb(KEYS[i + 1][0]) : ''}</td><td>${KEYS[i + 1] ? KEYS[i + 1][1] : ''}</td></tr>`).join('')}</table>
    <p class="muted" style="margin-top:8px">手机：左下方向盘拖动转向，右下踏板按压深度即踏板行程；离合踏板中间蓝色区域为半联动。建议横屏。</p>
  </div>
  <div class="section-title">考试记录</div>
  <div class="card"><div class="s3-hist">${hist.slice(0, 20).map(h => `<span class="tag ${h.pass ? 'green' : 'red'}">${h.score}分 · ${h.trans === 'auto' ? 'C2' : 'C1'} · ${fmtT(h.t)}</span>`).join('') || '<span class="muted small">暂无路考记录</span>'}</div>
  ${lres.length ? `<div class="small muted" style="margin-top:10px">灯光模拟：${lres.slice(0, 10).map(h => `<span class="tag ${h.pass ? 'green' : 'red'}" style="margin:2px">${h.pass ? '合格' : '不合格'} · ${fmtT(h.t)}</span>`).join('')}</div>` : ''}</div>`;
  el.querySelectorAll('[data-go]').forEach(n => n.onclick = () => A.go(n.dataset.go));
  el.querySelectorAll('#s3tr button').forEach(b => b.onclick = () => { A.store.set('sim3_trans', b.dataset.v); hub(el); });
}

/* ======================= 灯光组合开关控件 ======================= */
function stalkSvg(L) {
  const b = beam(L), ang = L.turn === 'R' ? -9 : L.turn === 'L' ? 9 : 0, push = L.high ? -14 : L.flash ? 12 : 0;
  const seg = (i, lab) => `<text x="${222 + i * 26}" y="70" font-size="11" text-anchor="middle" fill="${L.rot === i ? '#ffb020' : 'rgba(255,255,255,.55)'}" font-weight="700">${lab}</text>`;
  return `<svg viewBox="0 0 320 120">
    <rect x="0" y="22" width="34" height="76" rx="10" fill="#1a1f29" stroke="rgba(255,255,255,.12)"/>
    <g transform="translate(${push} 0) rotate(${ang} 30 60)">
      <path d="M30 52 L205 46 Q212 46 212 53 L212 67 Q212 74 205 74 L30 68 Z" fill="url(#s3g1)" stroke="rgba(255,255,255,.18)"/>
      <rect x="208" y="40" width="96" height="40" rx="12" fill="#2a303c" stroke="${L.rot ? '#ffb020' : 'rgba(255,255,255,.2)'}"/>
      <line x1="${218 + L.rot * 26}" y1="44" x2="${226 + L.rot * 26}" y2="44" stroke="#ffb020" stroke-width="3" stroke-linecap="round"/>
      ${seg(0, 'OFF')}${seg(1, '示廓')}${seg(2, '近光')}
    </g>
    <defs><linearGradient id="s3g1" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#4a5262"/><stop offset="1" stop-color="#20252f"/></linearGradient></defs>
    <text x="120" y="18" font-size="11" fill="${L.turn === 'R' ? '#2bd96b' : 'rgba(255,255,255,.35)'}" text-anchor="middle">▲ 上拨：右转向</text>
    <text x="120" y="114" font-size="11" fill="${L.turn === 'L' ? '#2bd96b' : 'rgba(255,255,255,.35)'}" text-anchor="middle">▼ 下拨：左转向</text>
    <text x="58" y="40" font-size="10" fill="${b === 'high' ? '#3b8bff' : 'rgba(255,255,255,.35)'}">${L.flash ? '闪光(后拉)' : L.high ? '远光(前推)' : ''}</text>
  </svg>`;
}
function lightCtl(box, getL, act) {
  box.innerHTML = `<div class="s3-ctl"><div class="s3-stalk"><div class="sv"></div>
      <div class="s3-rot"><button data-r="0">OFF</button><button data-r="1">示廓灯</button><button data-r="2">近光灯</button></div>
      <div class="s3-lev"><button data-a="turnL">▼ 左转向</button><button data-a="turnR">▲ 右转向</button><button data-a="high">⇧ 前推 远光</button><button data-a="flash">⇩ 后拉 闪光</button></div></div>
    <div class="s3-side"><button class="s3-hz" data-a="haz">${icoSvg('haz', 'currentColor', 34)}危险报警</button><div style="display:flex;gap:6px"><button data-a="fogF">前雾灯</button><button data-a="fogR">后雾灯</button></div></div></div>`;
  box.querySelectorAll('[data-r]').forEach(b => b.onclick = () => { act('rot', +b.dataset.r); upd(); });
  box.querySelectorAll('[data-a]').forEach(b => {
    const a = b.dataset.a;
    if (a === 'flash') {
      b.onpointerdown = e => { e.preventDefault(); act('flash', true); upd(); };
      b.onpointerup = b.onpointercancel = b.onpointerleave = () => { if (getL().flash) { act('flash', false); upd(); } };
    } else b.onclick = () => { act(a === 'turnL' ? 'turn' : a === 'turnR' ? 'turn' : a === 'haz' ? 'hazard' : a, a === 'turnL' ? 'L' : a === 'turnR' ? 'R' : undefined); upd(); };
  });
  // 拨杆拖动手势：上=右转 下=左转 左推=远光 右拉=闪光
  const sv = box.querySelector('.sv'); let p0 = null;
  sv.onpointerdown = e => { p0 = [e.clientX, e.clientY]; sv.setPointerCapture(e.pointerId); };
  sv.onpointermove = e => { if (!p0) return; const dx = e.clientX - p0[0], dy = e.clientY - p0[1];
    if (Math.abs(dx) > 28 && dx > 0 && !getL().flash && Math.abs(dx) > Math.abs(dy)) { act('flash', true); upd(); } };
  sv.onpointerup = e => { if (!p0) return; const dx = e.clientX - p0[0], dy = e.clientY - p0[1]; p0 = null;
    if (getL().flash) { act('flash', false); upd(); return; }
    if (Math.abs(dy) > 22 && Math.abs(dy) > Math.abs(dx)) act('turn', dy < 0 ? 'R' : 'L');
    else if (dx < -22) act('high');
    upd(); };
  function upd() {
    const L = getL(); sv.innerHTML = stalkSvg(L);
    box.querySelectorAll('[data-r]').forEach(b => b.classList.toggle('on', +b.dataset.r === L.rot));
    const st = { turnL: L.turn === 'L', turnR: L.turn === 'R', high: L.high, flash: L.flash, haz: L.hazard, fogF: L.fogF, fogR: L.fogR };
    box.querySelectorAll('[data-a]').forEach(b => b.classList.toggle('on', !!st[b.dataset.a]));
  }
  upd(); return upd;
}
function lightActPure(L, k, v) {
  if (k === 'rot') L.rot = v != null ? v : (L.rot + 1) % 3;
  else if (k === 'high') L.high = v != null ? v : !L.high;
  else if (k === 'flash') L.flash = !!v;
  else if (k === 'turn') L.turn = L.turn === v ? '' : v;
  else if (k === 'hazard') L.hazard = !L.hazard;
  else if (k === 'fogF') L.fogF = !L.fogF;
  else if (k === 'fogR') L.fogR = !L.fogR;
}

/* ======================= 灯光模拟考试页 ======================= */
function lightsPage(el) {
  A.setTitle('灯光模拟考试');
  const L = mkLights(); let mode = 'exam', lt = null, raf = 0, last = 0, flashT = 0, busy = false, pTask = null;
  el.innerHTML = `<div class="s3-lp-wrap">
    <div class="row between" style="margin-bottom:12px"><div class="seg" id="lm"><button data-m="exam" class="on">模拟考试</button><button data-m="prac">练习模式</button></div><a class="small" href="#/k3">科目三首页 ›</a></div>
    <div class="s3-cock"><div class="s3-clu" id="clu"></div>
      <div class="s3-q"><div class="t" id="lq">点击「开始考试」，系统将随机播报 5 条夜间灯光使用指令（第一条固定为"请开启前照灯"），请在语音播报结束后 5 秒内完成操作。</div><div class="s3-ring" id="ring"></div></div>
      <div id="lctl"></div>
      <div class="row" style="margin-top:12px;justify-content:center"><button class="btn primary" id="lgo">开始考试</button></div>
      <div class="small" style="opacity:.55;margin-top:10px;text-align:center">键盘：L 旋钮 · K 远光 · J 闪光 · Q/E 左右转向 · Z 危险报警 · 拨杆区可上下/左右滑动</div></div>
    <div id="lres"></div></div>`;
  const $ = s => el.querySelector(s);
  const act = (k, v) => { lightActPure(L, k, v); if (k === 'flash' && v === 'pulse') { L.flash = true; flashT = 0.3; } A.beep('click'); };
  const upd = lightCtl($('#lctl'), () => L, act);
  const ring = (left, tot) => { const p = clamp(left / tot, 0, 1), C = 2 * PI * 25; $('#ring').innerHTML = left > 0 ? `<svg width="58" height="58"><circle cx="29" cy="29" r="25" stroke="rgba(255,255,255,.15)" stroke-width="5" fill="none"/><circle cx="29" cy="29" r="25" stroke="#ffb020" stroke-width="5" fill="none" stroke-dasharray="${C}" stroke-dashoffset="${C * (1 - p)}" stroke-linecap="round"/></svg><b>${Math.ceil(left)}</b>` : ''; };
  const speak = text => { $('#lq').textContent = text; return A.settings.voice ? A.speak(text) : new Promise(r => setTimeout(r, 900 + text.length * 40)); };
  function runTest(tasks, gap, onDone, onGraded) {
    busy = true;
    lt = new LightTest(tasks, (type, x) => {
      if (type === 'speak') speak(x.q).then(() => { if (lt && lt.ph === 'speak') lt.go(L); });
      else if (type === 'graded') { A.beep(x.ok ? 'tick' : 'tick'); onGraded && onGraded(x); }
      else if (type === 'done') { busy = false; const r = lt.res; lt = null; ring(0, 5); onDone(r); }
    }, gap);
    lt.next();
  }
  function examDone(res) {
    const pass = res.every(r => r.ok);
    A.store.set('sim3_lights', [{ t: Date.now(), pass }].concat(A.store.get('sim3_lights', [])).slice(0, 30));
    A.speak(pass ? '模拟夜间考试合格' : '模拟夜间考试不合格');
    A.beep(pass ? 'pass' : 'bad');
    $('#lq').textContent = pass ? '✅ 灯光模拟考试合格！' : '❌ 灯光模拟考试不合格，请查看下方解析。';
    $('#lgo').disabled = false; $('#lgo').textContent = '再考一次';
    $('#lres').innerHTML = `<div class="card"><div class="card-title">考试结果 <span class="tag ${pass ? 'green' : 'red'}">${pass ? '合格' : '不合格'}</span></div>
      ${res.map((r, i) => `<div class="s3-res-i"><div class="m ${r.ok ? 'ok' : 'bad'}">${r.ok ? '✓' : '✗'}</div><div class="flex1"><b>${i + 1}. ${r.t.q}</b><div class="small">正确操作：<b style="color:var(--ok)">${r.t.a}</b></div>${r.ok ? '' : `<div class="small" style="color:var(--bad)">你的问题：${r.errs.join('；')}</div>`}<div class="small muted">${r.t.exp}</div></div></div>`).join('')}</div>`;
  }
  function startExam() {
    if (busy) return;
    Object.assign(L, mkLights()); upd(); $('#lres').innerHTML = '';
    $('#lgo').disabled = true; $('#lgo').textContent = '考试进行中…';
    runTest([LT_INTRO].concat(lightExamTasks()), 0.8, examDone);
  }
  function practiceList() {
    $('#lgo').classList.add('s3-hide');
    $('#lq').textContent = '练习模式：选择下方任一场景，听指令后 5 秒内完成灯光操作，系统即时评判并给出标准答案。';
    $('#lres').innerHTML = `<div class="list">${LT.map((t, i) => `<div class="list-item" data-i="${i}"><div class="flex1"><div>${t.q}</div><div class="small muted ans" style="display:none">答案：<b style="color:var(--ok)">${t.a}</b> · ${t.exp}</div><div class="small fb"></div></div><button class="btn sm" data-show="${i}">答案</button><button class="btn sm primary" data-p="${i}">练习</button></div>`).join('')}</div>`;
    $('#lres').querySelectorAll('[data-show]').forEach(b => b.onclick = e => { e.stopPropagation(); const a = b.closest('.list-item').querySelector('.ans'); a.style.display = a.style.display === 'none' ? '' : 'none'; });
    $('#lres').querySelectorAll('[data-p]').forEach(b => b.onclick = e => {
      e.stopPropagation(); if (busy) return;
      const t = LT[+b.dataset.p], row = b.closest('.list-item'); pTask = row;
      row.querySelector('.fb').innerHTML = '<span style="color:var(--warn)">请听指令操作…</span>';
      runTest([t], 0.1, res => { const r = res[0]; row.querySelector('.fb').innerHTML = r.ok ? '<b style="color:var(--ok)">✓ 操作正确</b>' : '<b style="color:var(--bad)">✗ ' + r.errs.join('；') + '</b>'; row.querySelector('.ans').style.display = ''; A.beep(r.ok ? 'ok' : 'bad'); $('#lq').textContent = r.ok ? '✓ 正确：' + t.a : '✗ 正确操作：' + t.a; });
    });
  }
  $('#lgo').onclick = startExam;
  el.querySelectorAll('#lm button').forEach(b => b.onclick = () => {
    if (busy) { A.toast('请等待当前考试结束'); return; }
    mode = b.dataset.m; el.querySelectorAll('#lm button').forEach(x => x.classList.toggle('on', x === b));
    if (mode === 'prac') practiceList(); else { $('#lgo').classList.remove('s3-hide'); $('#lres').innerHTML = ''; $('#lgo').disabled = false; $('#lgo').textContent = '开始考试'; }
  });
  const keys = e => {
    if (e.repeat) return; const k = e.key.toLowerCase();
    const m = { l: ['rot'], k: ['high'], j: ['flash', 'pulse'], q: ['turn', 'L'], e: ['turn', 'R'], z: ['hazard'] }[k];
    if (m) { e.preventDefault(); act(m[0], m[1]); upd(); }
  };
  on(window, 'keydown', keys);
  const loop = ts => {
    raf = requestAnimationFrame(loop); const dt = Math.min(0.1, (ts - last) / 1000 || 0); last = ts;
    if (flashT > 0) { flashT -= dt; if (flashT <= 0) { L.flash = false; upd(); } }
    if (lt) { lt.tick(dt, L); if (lt && lt.ph === 'wait') ring(lt.left, 5); else ring(0, 5); }
    const blink = (ts / 1000 % 0.8) < 0.42, ii = lightInd(L, true, true, blink);
    const names = { turnL: '左转', pos: '示廓', low: '近光', high: '远光', fogF: '前雾', fogR: '后雾', haz: '危险', turnR: '右转' };
    const html = ii.map(([k, o]) => `<div class="i ${o ? 'on' : ''}">${icoSvg(k, o ? ICOL[k] : 'rgba(255,255,255,.14)', 26)}${names[k]}</div>`).join('');
    const clu = $('#clu'); if (clu && clu._h !== html) { clu.innerHTML = html; clu._h = html; }
  };
  raf = requestAnimationFrame(loop);
  ui.cleanup.push(() => { cancelAnimationFrame(raf); lt = null; });
}

/* ======================= 驾驶模拟页 ======================= */
const WHEEL_SVG = `<svg viewBox="0 0 200 200"><defs><radialGradient id="s3wr" cx="50%" cy="40%" r="60%"><stop offset="0" stop-color="#4b5363"/><stop offset="1" stop-color="#14171d"/></radialGradient></defs>
<circle cx="100" cy="100" r="88" fill="none" stroke="url(#s3wr)" stroke-width="20"/><circle cx="100" cy="100" r="88" fill="none" stroke="rgba(255,255,255,.12)" stroke-width="1"/>
<path d="M22 112 Q100 128 178 112 L178 100 Q100 84 22 100Z" fill="#232831"/><path d="M88 120 L80 182 L120 182 L112 120Z" fill="#232831"/>
<circle cx="100" cy="108" r="26" fill="#1b1f27" stroke="rgba(255,255,255,.15)"/><text x="100" y="114" text-anchor="middle" font-size="15" font-weight="800" fill="#f97316">驾考</text>
<rect x="95" y="6" width="10" height="16" rx="3" fill="#f97316"/></svg>`;
function drivePage(el, opt, query) {
  A.immersive(true);
  const manual = transOf(query) === 'manual';
  const sim = new Sim(Object.assign({ manual }, opt));
  const isT = A.isTouch();
  const st = { cam: A.store.get('sim3_cam', 'drv'), mir: A.store.get('sim3_mir', true), tui: A.store.get('sim3_tui', isT), map: A.store.get('sim3_map', true),
    paused: false, look: null, lookT: 0, yaw: 0, instr: '', instrT: 0, chaseH: sim.pl.h, mi: 0, ended: false, coach: opt.mode !== 'exam', domT: 0, blinkPrev: false, lastHit: 0 };
  if (opt.mode === 'exam') st.coach = A.store.get('sim3_examtip', false);
  const title = opt.mode === 'exam' ? '路考全真模拟' : opt.mode === 'item' ? ITEMS[opt.item].name : '自由驾驶';
  el.innerHTML = `<div class="s3-drive">
    <canvas class="s3-cv"></canvas>
    <div class="s3-top"><div class="s3-rb s3-g" data-k="pause">❚❚</div><div class="s3-pill s3-g" id="sc"></div><div style="flex:1"></div>
      <div class="s3-rb s3-g" data-k="cam" title="视角">视</div><div class="s3-rb s3-g" data-k="lights" title="灯光">${icoSvg('low', '#fff', 20)}</div></div>
    <div class="s3-instr s3-g" id="ins"></div><div class="s3-tip s3-g s3-hide" id="tip"></div>
    <div class="s3-sig s3-g" id="sig"></div><div class="s3-toasts" id="tst"></div>
    <div class="s3-eye s3-g" id="eye"></div>
    <div class="s3-lt s3-g" id="lt"><div class="s3-ring" id="ltr"></div><div class="t" id="ltt"></div></div>
    <div class="s3-fn" id="fnL"></div><div class="s3-fn" id="fnR"></div>
    <div class="s3-wheel" id="whl">${WHEEL_SVG}</div>
    <div class="s3-gear s3-g" id="gear"></div>
    <div class="s3-ped" id="ped">${manual ? '<div class="s3-pd clu s3-g" data-p="clu"><div class="bite"></div><i></i><span>离合</span></div>' : ''}<div class="s3-pd brk s3-g" data-p="brk"><i></i><span>刹车</span></div><div class="s3-pd thr s3-g" data-p="thr"><i></i><span>油门</span></div></div>
    <div class="s3-prep s3-g s3-hide" id="prep"></div>
    <div class="s3-lpop s3-g" id="lpop"></div>
    <div class="s3-pause" id="pause"><div class="s3-menu s3-g" id="menu"></div></div>
    <div class="s3-rot-hint ${isT ? 'show' : ''}" id="roth"><div style="font-size:42px">⟲</div><b>请将手机横屏以获得最佳驾驶体验</b><button class="s3-ab pri" id="rotok">竖屏继续</button></div>
  </div>`;
  const root = el.querySelector('.s3-drive'), $ = s => root.querySelector(s);
  const cv = $('canvas'), ctx = cv.getContext('2d');
  let Wd = 0, Ht = 0, dpr = 1, raf = 0, last = 0, acc = 0;
  const K = mkCam(), R = { lite: false }, plCar = { x: 0, y: 0, h: 0, l: CAR_L, w: CAR_W, ht: 1.47, col: [238, 240, 242], kind: 'car', coach: 1 };
  R.plCar = plCar;
  const mirs = ['L', 'I', 'R'].map(k => ({ k, cv: document.createElement('canvas'), K: mkCam(), R: { lite: true }, x: 0, y: 0, w: 0, h: 0, hl: 0 }));
  $('#rotok').onclick = () => { $('#roth').classList.remove('show'); };
  /* ---------- 布局 ---------- */
  function layout() {
    const r = root.getBoundingClientRect(); Wd = Math.max(200, r.width); Ht = Math.max(200, r.height);
    dpr = Math.min(2, window.devicePixelRatio || 1);
    cv.width = Math.round(Wd * dpr); cv.height = Math.round(Ht * dpr);
    const port = Ht > Wd, show = st.tui;
    ['#whl', '#ped', '#gear'].forEach(s => $(s).classList.toggle('s3-hide', !show));
    const ws = Math.min(150, Math.max(104, Math.min(Wd, Ht) * 0.34));
    $('#whl').style.width = $('#whl').style.height = ws + 'px';
    const gear = $('#gear'), pedW = manual ? 210 : 144, fnL = $('#fnL'), fnR = $('#fnR');
    const S = (e, o) => { e.style.left = e.style.right = e.style.top = e.style.bottom = 'auto'; e.style.transform = ''; Object.assign(e.style, o); };
    const sb = v => 'calc(' + v + 'px + env(safe-area-inset-bottom,0px))';
    fnL.style.gridTemplateColumns = fnR.style.gridTemplateColumns = 'repeat(' + (show && port ? 2 : 3) + ',auto)';
    gear.style.gridTemplateColumns = '';
    let dl, dr, dy;
    if (show && !port) {
      S(gear, { right: (pedW + 18) + 'px', bottom: sb(10) });
      S(fnL, { left: '10px', bottom: sb(ws + 22) }); S(fnR, { right: '10px', bottom: sb(146) });
      dl = ws + 22; dr = Wd - (pedW + 18) - gearW() - 22;
    } else if (show && port) {
      const rowB = 160;
      S(gear, { left: '50%', transform: 'translateX(-50%)', bottom: sb(rowB) }); if (!manual) gear.style.gridTemplateColumns = 'repeat(2,auto)';
      S(fnL, { left: '10px', bottom: sb(rowB) }); S(fnR, { right: '10px', bottom: sb(rowB) });
      dl = 10; dr = Wd - 10; dy = rowB + 150;
    } else {
      S(fnL, { left: '10px', bottom: sb(12) }); S(fnR, { right: '10px', bottom: sb(12) });
      dl = 180; dr = Wd - 180; if (dr - dl < 260) { dl = 10; dr = Wd - 10; dy = 120; }
    }
    let dw = Math.min(480, dr - dl), dh = Math.max(74, Math.min(118, dw * 0.27));
    st.dash = { x: dl + (dr - dl - dw) / 2, y: Ht - dh - (dy || 10), w: dw, h: dh };
    if (dw < 230) { st.dash.w = dw = Math.min(Wd * 0.42, 320); dh = st.dash.h = 76; st.dash.x = (Wd - dw) / 2; st.dash.y = Ht - (show ? 236 : 90); }
    $('#tip').style.top = 'auto'; $('#tip').style.bottom = (Ht - st.dash.y + 8) + 'px';
    $('#tip').style.bottom = (Ht - st.dash.y + 8) + 'px';
    const mw = Math.min(170, Wd * (port ? 0.3 : 0.2)), mh = mw * 0.4;
    mirs.forEach((m, i) => {
      m.w = i === 1 ? mw * 1.15 : mw * 0.82; m.h = i === 1 ? mh * 0.85 : mh;
      m.x = i === 0 ? 8 : i === 2 ? Wd - m.w - 8 : (Wd - m.w) / 2; m.y = i === 1 ? 6 : 50;
      const d2 = Math.min(1.5, dpr); m.cv.width = Math.round(m.w * d2); m.cv.height = Math.round(m.h * d2); m.d2 = d2;
    });
    $('#ins').style.top = ((port ? 50 + mirs[0].h : 6 + mirs[1].h) + 8) + 'px';
    $('#sig').style.top = (50 + mirs[2].h + 8) + 'px';
    $('#tst').style.top = (6 + mirs[1].h + 64) + 'px';
  }
  const gearW = () => manual ? 128 : 52;
  /* ---------- 功能按钮 ---------- */
  const FN_L = [['tl', '左转', 'turnL'], ['tr', '右转', 'turnR'], ['ml', '左镜', 'eye'], ['mr', '右镜', 'eye'], ['bl', '左回头', 'eye'], ['br', '右回头', 'eye']];
  const FN_R = [['lt', '灯光', 'low'], ['hz', '双闪', 'haz'], ['hn', '喇叭', 'horn'], ['bt', '安全带', 'belt'], ['hb', '手刹', 'hb'], ['ig', '点火', 'pwr']];
  const fbHtml = list => list.map(([k, n, ic]) => `<div class="s3-fb s3-g ${k === 'hb' ? 'red' : ''}" data-f="${k}">${ic ? icoSvg(ic, '#fff', 18) : `<b style="font-size:15px">${k === 'hn' ? '📯' : '⏻'}</b>`}<span>${n}</span></div>`).join('');
  $('#fnL').innerHTML = fbHtml(FN_L); $('#fnR').innerHTML = fbHtml(FN_R);
  const fnAct = k => {
    ensureAudio();
    switch (k) {
      case 'tl': sim.light('turn', 'L'); A.beep('click'); break; case 'tr': sim.light('turn', 'R'); A.beep('click'); break;
      case 'ml': sim.look('L'); break; case 'mr': sim.look('R'); break; case 'bl': sim.look('BL'); break; case 'br': sim.look('BR'); break;
      case 'lt': toggleLpop(); break; case 'hz': sim.light('hazard'); A.beep('click'); break; case 'hn': sim.act('horn'); break;
      case 'bt': sim.act('belt'); break; case 'hb': sim.act('hb'); A.beep('click'); break; case 'ig': sim.act('ign'); break;
    }
  };
  root.querySelectorAll('[data-f]').forEach(b => b.onpointerdown = e => { e.preventDefault(); e.stopPropagation(); fnAct(b.dataset.f); });
  /* 挡位 */
  const gearHtml = () => manual
    ? `<div style="display:grid;grid-template-columns:repeat(3,34px);gap:4px">${['1', '3', '5', 'N', '', '', '2', '4', 'R'].map((g, i) => i === 4 || i === 5 ? '<span></span>' : `<button data-g="${g}">${g}</button>`).join('')}</div>`
    : ['P', 'R', 'N', 'D'].map(g => `<button data-g="${g}">${g}</button>`).join('');
  $('#gear').innerHTML = gearHtml();
  $('#gear').querySelectorAll('[data-g]').forEach(b => b.onpointerdown = e => { e.preventDefault(); ensureAudio(); if (sim.shift(b.dataset.g)) A.beep('tick'); });
  /* 方向盘 */
  const whl = $('#whl'); let wDrag = null;
  whl.onpointerdown = e => { e.preventDefault(); ensureAudio(); whl.setPointerCapture(e.pointerId); const r = whl.getBoundingClientRect(); wDrag = { cx: r.left + r.width / 2, cy: r.top + r.height / 2, a: Math.atan2(e.clientY - (r.top + r.height / 2), e.clientX - (r.left + r.width / 2)), sw: sim.pl.sw }; sim.inp.wheel = sim.pl.sw; };
  whl.onpointermove = e => { if (!wDrag) return; const a = Math.atan2(e.clientY - wDrag.cy, e.clientX - wDrag.cx); let d = a - wDrag.a; d = angN(d); wDrag.a = a; wDrag.sw = clamp(wDrag.sw - d, -SWMAX, SWMAX); sim.inp.wheel = wDrag.sw; };
  whl.onpointerup = whl.onpointercancel = () => { wDrag = null; sim.inp.wheel = null; };
  /* 踏板 */
  root.querySelectorAll('[data-p]').forEach(p => {
    const k = p.dataset.p, key = k === 'thr' ? 'tThr' : k === 'brk' ? 'tBrk' : 'tClutch';
    const set = e => { const r = p.getBoundingClientRect(); const v = clamp((e.clientY - r.top) / r.height * 1.25 - 0.05, 0.08, 1); sim.inp[key] = v; };
    p.onpointerdown = e => { e.preventDefault(); ensureAudio(); p.setPointerCapture(e.pointerId); set(e); };
    p.onpointermove = e => { if (e.buttons || e.pointerType === 'touch') { if (sim.inp[key] != null) set(e); } };
    p.onpointerup = p.onpointercancel = () => { sim.inp[key] = null; };
  });
  if (manual) { const b = root.querySelector('.s3-pd.clu .bite'); b.style.top = (0.27 + 0.05) / 1.25 * 100 + '%'; b.style.height = (0.72 - 0.27) / 1.25 * 100 + '%'; }
  /* 灯光面板 */
  const lpop = $('#lpop'); let lupd = null;
  function toggleLpop(force) {
    const onn = force != null ? force : !lpop.classList.contains('on'); lpop.classList.toggle('on', onn);
    if (onn) { lpop.style.left = '50%'; lpop.style.transform = 'translateX(-50%)'; lpop.style.top = (mirs[1].h + 16) + 'px';
      lpop.innerHTML = '<div class="row between" style="margin-bottom:6px"><b>灯光组合开关</b><button class="s3-ab" id="lpx" style="padding:4px 10px">关闭</button></div><div id="lpb"></div>';
      lupd = lightCtl(lpop.querySelector('#lpb'), () => sim.pl.L, (k, v) => { sim.light(k, v); A.beep('click'); });
      lpop.querySelector('#lpx').onclick = () => toggleLpop(false); }
    else lupd = null;
  }
  /* 暂停菜单 */
  function pause(onn) {
    st.paused = onn; $('#pause').classList.toggle('on', onn);
    if (onn) { A.stopSpeak(); renderMenu(); }
  }
  function renderMenu() {
    const seg = (id, val, opts) => `<div class="seg" data-seg="${id}">${opts.map(([v, n]) => `<button data-v="${v}" class="${String(val) === String(v) ? 'on' : ''}">${n}</button>`).join('')}</div>`;
    $('#menu').innerHTML = `<h3>${title} · 已暂停</h3>
      <div class="row"><span>视角</span>${seg('cam', st.cam, [['drv', '驾驶位'], ['chase', '车后'], ['top', '俯视']])}</div>
      <div class="row"><span>后视镜</span>${seg('mir', st.mir, [[true, '显示'], [false, '隐藏']])}</div>
      <div class="row"><span>小地图</span>${seg('map', st.map, [[true, '显示'], [false, '隐藏']])}</div>
      <div class="row"><span>触屏控件</span>${seg('tui', st.tui, [[true, '显示'], [false, '隐藏']])}</div>
      <div class="row"><span>教练提示</span>${seg('coach', st.coach, [[true, '开'], [false, '关']])}</div>
      ${opt.mode === 'free' ? `<div class="row"><span>时间</span>${seg('night', sim.night, [[false, '白天'], [true, '夜间']])}</div>` : ''}
      <div class="row" style="gap:8px;margin-top:14px"><button class="s3-ab pri" style="flex:1" data-m="go">继续</button><button class="s3-ab" style="flex:1" data-m="re">重新开始</button><button class="s3-ab" style="flex:1" data-m="quit">退出</button></div>
      <div class="s3-keys">${KEYS.map(k => `<kbd>${k[0]}</kbd><span>${k[1]}</span>`).join('')}</div>`;
    $('#menu').querySelectorAll('[data-seg]').forEach(sg => sg.querySelectorAll('button').forEach(b => b.onclick = () => {
      const id = sg.dataset.seg, v = b.dataset.v === 'true' ? true : b.dataset.v === 'false' ? false : b.dataset.v;
      if (id === 'night') sim.night = v; else if (id === 'coach') { st.coach = v; if (opt.mode === 'exam') A.store.set('sim3_examtip', v); }
      else { st[id] = v; A.store.set('sim3_' + id, v); }
      if (id === 'tui') layout();
      renderMenu();
    }));
    $('#menu').querySelectorAll('[data-m]').forEach(b => b.onclick = () => { const m = b.dataset.m; if (m === 'go') pause(false); else if (m === 're') A.go(location.hash); else A.go('#/k3'); });
  }
  root.querySelectorAll('[data-k]').forEach(b => b.onclick = () => { const k = b.dataset.k; if (k === 'pause') pause(true); else if (k === 'cam') cycleCam(); else if (k === 'lights') toggleLpop(); });
  const cycleCam = () => { st.cam = { drv: 'chase', chase: 'top', top: 'drv' }[st.cam]; A.store.set('sim3_cam', st.cam); toast('视角：' + { drv: '驾驶位', chase: '车后追尾', top: '俯视' }[st.cam], 'info'); };
  /* 键盘 */
  const keyDown = e => {
    if (e.target && /INPUT|TEXTAREA/.test(e.target.tagName)) return;
    const k = e.key, kl = k.length === 1 ? k.toLowerCase() : k, I = sim.inp;
    if (st.resShown) return;
    if (k === 'Escape') { pause(!st.paused); e.preventDefault(); return; }
    if (st.paused) return;
    ensureAudio();
    const hold = { ArrowLeft: () => I.steer = 1, ArrowRight: () => I.steer = -1, ArrowUp: () => I.kThr = 1, ArrowDown: () => I.kBrk = 1, Shift: () => I.kClutch = 1, c: () => I.kClutch = 1 };
    if (hold[kl]) { hold[kl](); e.preventDefault(); return; }
    if (e.repeat) return;
    const g = manual ? { 1: '1', 2: '2', 3: '3', 4: '4', 5: '5', r: 'R', n: 'N' }[kl] : { p: 'P', r: 'R', n: 'N', d: 'D' }[kl];
    if (g) { if (sim.shift(g)) A.beep('tick'); e.preventDefault(); return; }
    const m = { q: () => fnAct('tl'), e: () => fnAct('tr'), ' ': () => fnAct('hb'), l: () => { sim.light('rot'); A.beep('click'); }, k: () => { sim.light('high'); A.beep('click'); }, j: () => sim.light('flash', 'pulse'), z: () => fnAct('hz'), h: () => fnAct('hn'), b: () => fnAct('bt'), f: () => fnAct('ig'),
      v: () => sim.look('L'), x: () => sim.look('R'), g: () => sim.look(sim.pl.L.turn === 'R' ? 'BR' : 'BL'), t: () => sim.look('BR'), i: () => sim.look('I'), o: () => doExit(), Tab: cycleCam };
    if (m[kl]) { m[kl](); e.preventDefault(); }
  };
  const keyUp = e => {
    const kl = e.key.length === 1 ? e.key.toLowerCase() : e.key, I = sim.inp;
    if (kl === 'ArrowLeft' && I.steer > 0) I.steer = 0; if (kl === 'ArrowRight' && I.steer < 0) I.steer = 0;
    if (kl === 'ArrowUp') I.kThr = 0; if (kl === 'ArrowDown') I.kBrk = 0; if (kl === 'Shift' || kl === 'c') I.kClutch = 0;
  };
  on(window, 'keydown', keyDown); on(window, 'keyup', keyUp);
  on(window, 'blur', () => { Object.assign(sim.inp, { steer: 0, kThr: 0, kBrk: 0, kClutch: 0 }); if (!st.ended) pause(true); });
  on(window, 'resize', () => setTimeout(layout, 60));
  on(document, 'visibilitychange', () => { if (document.hidden && !st.ended) pause(true); });
  const doExit = () => sim.act('exit');
  /* ---------- 音频（发动机声） ---------- */
  let au = null;
  function ensureAudio() {
    if (au || !A.settings.sound) return;
    try {
      const ac = new (window.AudioContext || window.webkitAudioContext)();
      const o1 = ac.createOscillator(), o2 = ac.createOscillator(), lp = ac.createBiquadFilter(), g = ac.createGain();
      o1.type = 'sawtooth'; o2.type = 'square'; lp.type = 'lowpass'; lp.frequency.value = 380; g.gain.value = 0;
      const g2 = ac.createGain(); g2.gain.value = 0.35; o2.connect(g2).connect(lp); o1.connect(lp); lp.connect(g).connect(ac.destination);
      o1.start(); o2.start(); au = { ac, o1, o2, lp, g };
    } catch (e) { au = null; }
  }
  function audioTick() {
    if (!au) return; const c = sim.pl, rpm = rpmOf(c), t = au.ac.currentTime;
    const f = Math.max(18, rpm / 30), on2 = c.on && !st.paused && !st.ended;
    au.o1.frequency.setTargetAtTime(f, t, 0.03); au.o2.frequency.setTargetAtTime(f * 0.5, t, 0.03);
    au.lp.frequency.setTargetAtTime(260 + c.thr * 900 + rpm * 0.08, t, 0.05);
    au.g.gain.setTargetAtTime(on2 ? 0.035 + c.thr * 0.05 + Math.min(0.03, rpm / 200000) : 0, t, 0.08);
  }
  ui.cleanup.push(() => { if (au) { try { au.ac.close(); } catch (e) {} au = null; } });
  /* ---------- 提示 / 语音 ---------- */
  function toast(msg, cls, ms) {
    const box = $('#tst'); if (!box) return; const d = document.createElement('div'); d.className = 's3-toast ' + (cls || 'info'); d.textContent = msg; box.appendChild(d);
    while (box.children.length > 4) box.firstChild.remove();
    setTimeout(() => d.remove(), ms || 3200);
  }
  const say = (text, intr) => { st.instr = text; st.instrT = 0; return A.speak(text, { interrupt: intr !== false }); };
  const eyeTxt = { L: '观察左后视镜', R: '观察右后视镜', BL: '向左回头观察', BR: '向右回头观察', I: '观察内后视镜' };
  function handle(e) {
    const d = e.d;
    switch (e.type) {
      case 'say': say(d); break;
      case 'ltsay': {
        $('#ltt').textContent = d.q; st.instr = d.intro ? '灯光模拟考试' : d.q; st.instrT = 0; if (opt.mode === 'exam') $('#lt').style.display = 'flex'; $('#ltr').innerHTML = '';
        const p = A.settings.voice ? A.speak(d.q) : new Promise(r => setTimeout(r, 900 + d.q.length * 40));
        p.then(() => { if (sim.lt && sim.lt.ph === 'speak' && sim.lt.tasks[sim.lt.i] === d) sim.lt.go(sim.pl.L); }); break;
      }
      case 'ltres': if (opt.mode !== 'exam') toast((d.ok ? '✓ ' : '✗ ') + d.t.q.replace(/^夜间/, '') + (d.ok ? '' : '：应' + d.t.a), d.ok ? 'ok' : 'bad', 5000); break;
      case 'hit': {
        const big = d.pts >= 100; toast((big ? '不合格 · ' : '扣' + d.pts + '分 · ') + d.text + (d.note ? '（' + d.note + '）' : ''), big ? 'bad' : 'ded', 5200);
        A.beep('bad'); A.vibrate(big ? [60, 40, 60] : 40);
        if (opt.mode !== 'free') A.speak((big ? '' : '扣' + d.pts + '分，') + d.text, { interrupt: false });
        break;
      }
      case 'fail': st.ended = true; setTimeout(() => { A.speak('考试不合格', { interrupt: false }); showResult(d); }, 1400); break;
      case 'end': st.ended = true; setTimeout(() => { A.speak(d.pass ? (opt.mode === 'exam' ? '考试结束，成绩合格' : '项目完成') : '考试结束，成绩不合格', { interrupt: false }); showResult(d); }, 1000); break;
      case 'item': if (opt.mode === 'exam') toast('项目：' + d.name, 'info', 2200); break;
      case 'itemdone': if (opt.mode === 'exam') toast(d.name + (d.res === 'ok' ? ' ✓ 通过' : d.res === 'ded' ? ' · 有扣分' : ' ✗'), d.res === 'ok' ? 'ok' : d.res === 'ded' ? 'ded' : 'bad', 2600); break;
      case 'look': st.look = d; st.lookT = 0.9; { const ey = $('#eye'); ey.innerHTML = icoSvg('eye', '#ffb020', 24) + eyeTxt[d]; ey.classList.add('on'); } mirs.forEach(m => { if (m.k === d || (d === 'BL' && m.k === 'L') || (d === 'BR' && m.k === 'R')) m.hl = 1; }); A.beep('tick'); break;
      case 'stall': toast('发动机熄火！', 'ded'); A.beep('warn'); break;
      case 'grind': toast('齿轮撞击！换挡前请踩下离合', 'ded'); break;
      case 'toast': toast(d, 'info'); break;
      case 'walk': toast('开始绕车检查…', 'info'); break;
      case 'walked': toast('绕车检查完毕', 'ok'); break;
      case 'enter': toast('已上车，关好车门', 'info'); A.beep('click'); break;
      case 'engine': if (d) { A.beep('ding'); toast('发动机已启动', 'ok', 1500); } else toast('发动机已熄火', 'info', 1500); break;
      case 'belt': toast(d ? '已系安全带' : '已解开安全带', 'info', 1400); A.beep('click'); break;
      case 'hbk': toast(d ? '已拉起手刹' : '已松开手刹', 'info', 1200); break;
      case 'horn': A.beep('horn'); break;
      case 'crash': A.vibrate([100, 50, 100]); break;
      case 'bump': A.vibrate(60); break;
      case 'park': toast('车身距右侧边缘线约 ' + Math.max(0, Math.round(d * 100)) + 'cm', d >= 0 && d <= 0.3 ? 'ok' : 'ded', 4000); break;
    }
  }
  /* ---------- 结果 ---------- */
  function showResult(r) {
    if (st.resShown) return; st.resShown = true;
    pause(false); st.paused = true; $('#pause').classList.remove('on');
    const tr = manual ? 'manual' : 'auto';
    if (opt.mode === 'exam') A.record('k3', { score: r.score, pass: r.pass, trans: tr });
    if (opt.mode === 'item') { const m = A.store.get('sim3_items', {}); m[opt.item] = r.pass ? 'ok' : 'fail'; A.store.set('sim3_items', m); }
    A.beep(r.pass ? 'pass' : 'bad');
    const resI = k => { const s = r.res[k]; const cls = s === 'ok' ? 'ok' : s === 'ded' ? 'ded' : s === 'fail' || (s === 'act' && r.fail) ? 'bad' : 'pend'; return `<div class="s3-res-i" style="padding:6px 0"><div class="m ${cls}">${cls === 'ok' ? '✓' : cls === 'bad' ? '✗' : cls === 'ded' ? '!' : '–'}</div><div class="flex1">${ITEMS[k].name}</div><span class="small muted">${cls === 'pend' ? '未进行' : cls === 'ok' ? '合格' : cls === 'ded' ? '扣分' : '不合格'}</span></div>`; };
    const log = r.log.length ? `<table class="tbl" style="font-size:13px"><tr><th>项目</th><th>评判</th><th>扣分</th></tr>${r.log.map(e => `<tr><td>${e.item}</td><td>${e.text}${e.note ? `<div class="small muted">${A.esc(e.note)}</div>` : ''}</td><td style="color:${e.pts >= 100 ? 'var(--bad)' : 'var(--warn)'};white-space:nowrap">${e.pts >= 100 ? '不合格' : '-' + e.pts}</td></tr>`).join('')}</table>` : '<div class="note ok">全程无扣分，表现完美！</div>';
    const it = opt.mode === 'item' ? ITEMS[opt.item] : null;
    A.modal({
      title: opt.mode === 'exam' ? '路考成绩单' : opt.mode === 'item' ? it.name + ' · 练习结果' : '驾驶记录',
      html: `<div class="s3-score ${r.pass ? 'ok' : 'bad'}">${r.score}<small>分</small></div><div class="center" style="margin:6px 0 12px;font-weight:700;color:${r.pass ? 'var(--ok)' : 'var(--bad)'}">${r.pass ? (opt.mode === 'exam' ? '考试合格 🎉' : '通过 ✓') : '不合格'}</div>
        ${opt.mode === 'exam' ? `<div style="margin-bottom:10px">${r.seq.map(resI).join('')}</div>` : ''}
        <div class="small muted" style="margin-bottom:4px">评判记录</div>${log}
        ${it ? `<div class="s3-kj" style="margin-top:10px">口诀：${it.kj}</div>` : ''}`,
      buttons: [{ text: '返回', onClick: () => A.go('#/k3') }, { text: opt.mode === 'free' ? '继续' : '再来一次', primary: true, onClick: () => { if (opt.mode === 'free') { st.paused = false; st.resShown = false; st.ended = false; } else A.go(location.hash); } }],
      closable: false
    });
  }
  /* ---------- 准备阶段面板 ---------- */
  function prepUI() {
    const P = $('#prep');
    const cur = sim.cur, c = sim.pl;
    let html = '';
    if (!sim.inCar) {
      html = `<h4>上车准备</h4><p>${sim.walkT > 0 ? '正在逆时针绕车一周，检查车辆外观、轮胎和周围环境…' : '下车状态。请绕车检查 → 回头观察后方 → 开门上车'}</p><div class="row">
        <button class="s3-ab ${sim.walked ? 'done' : 'pri'}" data-a="walk" ${sim.walkT > 0 || sim.walked ? 'disabled' : ''}>${sim.walked ? '✓ 已绕车' : sim.walkT > 0 ? '检查中 ' + Math.ceil(sim.walkT) + 's' : '绕车检查'}</button>
        <button class="s3-ab ${sim.head('L', 8) ? 'done' : ''}" data-a="lookBL">向左回头观察</button>
        <button class="s3-ab pri" data-a="enter" ${sim.walkT > 0 ? 'disabled' : ''}>开门上车</button></div>`;
    } else if (cur && cur.key === 'shangche') {
      html = `<h4>上车准备</h4><p>调整座椅/后视镜 → 系安全带 → 确认${manual ? '空挡' : 'P挡'} → 点火</p><div class="row">
        <button class="s3-ab ${sim.seatAdj ? 'done' : ''}" data-a="seat">${sim.seatAdj ? '✓ ' : ''}调整座椅/后视镜</button>
        <button class="s3-ab ${c.belt ? 'done' : ''}" data-a="belt">${c.belt ? '✓ ' : ''}系安全带</button>
        <button class="s3-ab ${c.on ? 'done' : 'pri'}" data-a="ign">${c.on ? '✓ 已启动' : '点火启动'}</button></div>`;
    } else if (cur && cur.key === 'kaobian' && cur.S.ph === 1) {
      html = `<h4>停车完毕</h4><p>拉手刹 → ${manual ? '空挡' : 'P挡'} → 熄火 → 解安全带 → 回头观察 → 开门</p><div class="row">
        <button class="s3-ab ${c.hb ? 'done' : ''}" data-a="hb">${c.hb ? '✓ ' : ''}拉手刹</button><button class="s3-ab ${(manual ? c.gear === 'N' : c.gear === 'P') ? 'done' : ''}" data-a="neu">${manual ? '空挡 N' : 'P 挡'}</button>
        <button class="s3-ab ${!c.on ? 'done' : ''}" data-a="ign">${c.on ? '熄火' : '✓ 已熄火'}</button><button class="s3-ab ${!c.belt ? 'done' : ''}" data-a="belt">${c.belt ? '解安全带' : '✓ 已解开'}</button>
        <button class="s3-ab ${sim.head('L', 6) ? 'done' : ''}" data-a="lookBL">向左回头</button><button class="s3-ab pri" data-a="exit">开门下车</button></div>`;
    }
    P.classList.toggle('s3-hide', !html || st.ended);
    if (P._h !== html) {
      P._h = html; P.innerHTML = html;
      P.querySelectorAll('[data-a]').forEach(b => b.onclick = () => {
        ensureAudio(); const a = b.dataset.a;
        if (a === 'lookBL') sim.look('BL'); else if (a === 'neu') { if (manual && sim.pl.clutch < 0.75) sim.pl.gear = 'N'; else sim.shift(manual ? 'N' : 'P'); sim.emit('gear'); } else sim.act(a);
      });
    }
  }
  /* ---------- 渲染 ---------- */
  function signalBox() {
    const R2 = sim.rr, box = $('#sig');
    if (!R2 || R2.ur < 0 || st.cam === 'top') { box.style.display = 'none'; return; }
    const r = R2.r, node = R2.sg > 0 ? r.b : r.a, rem = R2.sg > 0 ? r.len - SL - R2.s : R2.s - SL;
    if (!node.sig || rem > 140 || rem < -3) { box.style.display = 'none'; return; }
    const ax = r.hz ? 'EW' : 'NS', sL = sigState(node, ax, 'L', sim.t), sS = sigState(node, ax, 'S', sim.t);
    const h = `<span style="opacity:.8">信号灯 ${Math.max(0, Math.round(rem))}m</span><i style="background:${SIGC[sL.c]}">←</i><b>${Math.ceil(sL.left)}</b><i style="background:${SIGC[sS.c]}">↑</i><b>${Math.ceil(sS.left)}</b>`;
    if (box._h !== h) { box.innerHTML = h; box._h = h; } box.style.display = 'flex';
  }
  function domTick(dt) {
    const c = sim.pl, L = c.L, blink = (sim.t % 0.8) < 0.42;
    $('#whl').firstElementChild.style.transform = 'rotate(' + (-c.sw * 180 / PI) + 'deg)';
    root.querySelectorAll('[data-p]').forEach(p => { const v = p.dataset.p === 'thr' ? c.thr : p.dataset.p === 'brk' ? c.brk : c.clutch; p.querySelector('i').style.height = v * 100 + '%'; });
    st.domT -= dt; if (st.domT > 0) return; st.domT = 0.1;
    const fs = { tl: L.turn === 'L', tr: L.turn === 'R', hz: L.hazard, bt: c.belt, hb: c.hb, ig: c.on, lt: L.rot > 0, ml: sim.t - sim.obs.L < 1, mr: sim.t - sim.obs.R < 1, bl: sim.t - sim.obs.BL < 1, br: sim.t - sim.obs.BR < 1 };
    root.querySelectorAll('[data-f]').forEach(b => { const k = b.dataset.f; b.classList.toggle('on', !!fs[k]); b.classList.toggle('flash', (k === 'tl' && L.turn === 'L') || (k === 'tr' && L.turn === 'R') || (k === 'hz' && L.hazard)); });
    $('#gear').querySelectorAll('[data-g]').forEach(b => b.classList.toggle('on', b.dataset.g === c.gear));
    const J = sim.J;
    const sc = opt.mode === 'free' ? `<span>违规</span><b>${J.log.length}</b><span style="opacity:.7">· ${manual ? 'C1' : 'C2'}</span>` : `<b style="color:${J.fail ? '#ff6b6e' : J.score >= 90 ? '#4ade80' : '#fbbf24'}">${J.score}</b><span>分</span><span style="opacity:.7">${opt.mode === 'exam' ? (sim.idx + (sim.cur ? 1 : 0)) + '/16' : title}</span>`;
    if ($('#sc')._h !== sc) { $('#sc').innerHTML = sc; $('#sc')._h = sc; }
    const it = sim.cur ? sim.cur.it : null;
    const ins = st.instr ? (it && opt.mode !== 'free' ? `<small>${it.name}</small>` : '') + A.esc(st.instr) : opt.mode === 'free' ? '自由驾驶 · 遵守交通规则' : '';
    const insEl = $('#ins'); if (insEl._h !== ins) { insEl.innerHTML = ins; insEl._h = ins; }
    insEl.classList.toggle('s3-hide', !ins || st.cam === 'none'); insEl.classList.toggle('hl', st.instrT < 3 && !!st.instr);
    const tp = st.coach && !st.ended ? sim.tip() : '';
    const tipEl = $('#tip'); if (tipEl._h !== tp) { tipEl.textContent = tp ? '教练提示：' + tp : ''; tipEl._h = tp; } tipEl.classList.toggle('s3-hide', !tp);
    if (sim.lt && sim.lt.ph === 'wait') { const p = clamp(sim.lt.left / 5, 0, 1), C = 2 * PI * 25; $('#ltr').innerHTML = `<svg width="58" height="58"><circle cx="29" cy="29" r="25" stroke="rgba(255,255,255,.15)" stroke-width="5" fill="none"/><circle cx="29" cy="29" r="25" stroke="#ffb020" stroke-width="5" fill="none" stroke-dasharray="${C}" stroke-dashoffset="${C * (1 - p)}" stroke-linecap="round"/></svg><b>${Math.ceil(sim.lt.left)}</b>`; }
    if (!sim.lt || sim.lt.ph === 'done' || (sim.lt.ph === 'gap' && sim.lt.i >= sim.lt.tasks.length - 1)) $('#lt').style.display = 'none';
    if (st.lookT <= 0) $('#eye').classList.remove('on');
    if (lupd) lupd();
    ['#whl', '#ped', '#gear', '#fnL', '#fnR'].forEach(s => $(s).style.visibility = sim.inCar ? '' : 'hidden');
    signalBox(); prepUI();
  }
  function camera(dt) {
    const c = sim.pl;
    K.W = Wd; K.H = Ht; K.F = Math.max(Wd * 0.62, Ht * 0.55); K.far = 420;
    const port = Ht > Wd;
    st.lookT -= dt;
    const ty = st.lookT > 0 ? ({ L: 0.5, R: -0.55, BL: 1.75, BR: -1.75, I: 0 }[st.look] || 0) : 0;
    st.yaw += (ty - st.yaw) * Math.min(1, dt * 9);
    if (!sim.inCar) {
      const ang = sim.walkT > 0 ? (1 - sim.walkT / 7) * TAU : 0, a0 = c.h + PI * 0.8 + ang, rad = 7.5;
      K.x = c.x + Math.cos(a0) * rad; K.y = c.y + Math.sin(a0) * rad; K.z = 2.2;
      K.h = Math.atan2(c.y - K.y, c.x - K.x); K.p = 0.16; K.cx = Wd / 2; K.cy = Ht * 0.45; R.showPlayer = true; return;
    }
    if (st.cam === 'drv') {
      const ch = Math.cos(c.h), sh = Math.sin(c.h);
      K.x = c.x - 0.15 * ch - 0.37 * sh; K.y = c.y - 0.15 * sh + 0.37 * ch; K.z = 1.25; K.h = c.h + st.yaw; K.p = 0.07;
      K.cx = Wd / 2; K.cy = port ? Ht * 0.4 : Ht * 0.47; R.showPlayer = false;
    } else {
      st.chaseH += angN(c.h - st.chaseH) * Math.min(1, dt * 3.2);
      const h = st.chaseH + st.yaw * 0.6;
      K.x = c.x - Math.cos(h) * 8; K.y = c.y - Math.sin(h) * 8; K.z = 3.2; K.h = h; K.p = 0.2;
      K.cx = Wd / 2; K.cy = port ? Ht * 0.3 : Ht * 0.34; R.showPlayer = true;
    }
  }
  function hood() {
    const c = sim.pl, ch = Math.cos(c.h), sh = Math.sin(c.h);
    const p = (a, b, z) => [c.x + ch * a - sh * b, c.y + sh * a + ch * b, z];
    const k = sim.night ? 0.32 : 1;
    const pts = [p(0.7, 0.84, 0.93), p(2.1, 0.78, 0.8), p(2.28, 0, 0.78), p(2.1, -0.78, 0.8), p(0.7, -0.84, 0.93)];
    const P = new Float64Array(pts.length * 3); pts.forEach((q, i) => P.set(q, i * 3));
    FOGC = [0, 0, 0];
    polyW(ctx, K, P, pts.length, shade([206, 210, 216], k, 0));
    if (proj(K, c.x + ch * 0.72, c.y + sh * 0.72, 0.95, PP)) {
      const y0 = Math.max(0, PP.y - 2), g0 = ctx.createLinearGradient(0, y0, 0, Ht);
      g0.addColorStop(0, sim.night ? '#0a0c11' : '#20242c'); g0.addColorStop(0.15, sim.night ? '#05070a' : '#14171c'); g0.addColorStop(1, '#08090c');
      ctx.fillStyle = g0; ctx.beginPath(); ctx.moveTo(0, y0 + 14); ctx.quadraticCurveTo(Wd / 2, y0 - 10, Wd, y0 + 14); ctx.lineTo(Wd, Ht); ctx.lineTo(0, Ht); ctx.fill();
    }
    // A 柱
    ctx.fillStyle = sim.night ? '#05070a' : '#111419';
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Wd * 0.06, 0); ctx.lineTo(Wd * 0.012, Ht * 0.62); ctx.lineTo(0, Ht * 0.66); ctx.fill();
    ctx.beginPath(); ctx.moveTo(Wd, 0); ctx.lineTo(Wd * 0.94, 0); ctx.lineTo(Wd * 0.988, Ht * 0.62); ctx.lineTo(Wd, Ht * 0.66); ctx.fill();
    const g = ctx.createLinearGradient(0, 0, 0, 34); g.addColorStop(0, sim.night ? '#05070a' : '#111419'); g.addColorStop(1, 'rgba(17,20,25,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, Wd, 34);
  }
  function mirrorsDraw() {
    if (!st.mir || !sim.inCar || st.cam === 'top') return;
    const c = sim.pl, ch = Math.cos(c.h), sh = Math.sin(c.h);
    const m = mirs[st.mi % 3]; st.mi++;
    const mk = (mm) => {
      const K2 = mm.K, b = mm.k === 'L' ? 1.0 : mm.k === 'R' ? -1.0 : 0, a = mm.k === 'I' ? -2.6 : 0.85;
      K2.x = c.x + ch * a - sh * b; K2.y = c.y + sh * a + ch * b; K2.z = mm.k === 'I' ? 1.3 : 1.05;
      K2.h = c.h + PI + (mm.k === 'L' ? -0.2 : mm.k === 'R' ? 0.2 : 0) + (st.look === mm.k && st.lookT > 0 ? 0 : 0);
      K2.p = 0.02; K2.W = mm.w; K2.H = mm.h; K2.F = mm.w * (mm.k === 'I' ? 0.9 : 1.05); K2.cx = mm.w / 2; K2.cy = mm.h * 0.48; K2.far = 170;
      const g = mm.cv.getContext('2d'); g.setTransform(mm.d2, 0, 0, mm.d2, 0, 0);
      drawScene(g, K2, sim, mm.R);
      if (mm.k !== 'I') { // 车身边缘
        g.fillStyle = sim.night ? '#151820' : '#d9dcdf'; g.beginPath();
        if (mm.k === 'L') { g.moveTo(mm.w, mm.h * 0.3); g.lineTo(mm.w * 0.86, mm.h * 0.55); g.lineTo(mm.w * 0.84, mm.h); g.lineTo(mm.w, mm.h); }
        else { g.moveTo(0, mm.h * 0.3); g.lineTo(mm.w * 0.14, mm.h * 0.55); g.lineTo(mm.w * 0.16, mm.h); g.lineTo(0, mm.h); }
        g.fill();
      }
    };
    mk(m);
    mirs.forEach(mm => {
      if (!mm.drawn && mm !== m) mk(mm); mm.drawn = 1;
      ctx.save(); rrect(ctx, mm.x, mm.y, mm.w, mm.h, mm.k === 'I' ? 8 : 12); ctx.clip();
      ctx.translate(mm.x + mm.w, mm.y); ctx.scale(-1, 1); ctx.drawImage(mm.cv, 0, 0, mm.w, mm.h); ctx.restore();
      rrect(ctx, mm.x, mm.y, mm.w, mm.h, mm.k === 'I' ? 8 : 12);
      ctx.lineWidth = mm.hl > 0 ? 3 : 2.5; ctx.strokeStyle = mm.hl > 0 ? '#ffb020' : '#0d0f13'; ctx.stroke();
      if (mm.hl > 0) mm.hl -= 0.016;
    });
  }
  function minimap() {
    if (!st.map) return;
    const sz = Math.min(130, Wd * 0.16), M = miniMap(Math.round(sz)), c = sim.pl;
    const x = Wd - sz - 8, yy = (st.mir && sim.inCar && st.cam !== 'top' ? 50 + mirs[2].h + 8 : 50) - 40;
    const fr = $('#fnR').getBoundingClientRect(), rr0 = root.getBoundingClientRect();
    if (yy + 40 + M.cv.height > fr.top - rr0.top - 6 && sim.inCar) return;
    ctx.save(); ctx.globalAlpha = 0.95; rrect(ctx, x, yy + 40, sz, M.cv.height, 10); ctx.clip(); ctx.drawImage(M.cv, x, yy + 40);
    for (const a of sim.ai) { ctx.fillStyle = 'rgba(255,255,255,.55)'; ctx.fillRect(x + M.X(a.x) - 1, yy + 40 + M.Y(a.y) - 1, 2, 2); }
    const px = x + M.X(c.x), py = yy + 40 + M.Y(c.y);
    ctx.translate(px, py); ctx.rotate(-c.h); ctx.fillStyle = '#ffb020'; ctx.beginPath(); ctx.moveTo(6, 0); ctx.lineTo(-4, 4); ctx.lineTo(-2, 0); ctx.lineTo(-4, -4); ctx.closePath(); ctx.fill();
    ctx.restore();
  }
  function render(dt) {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const c = sim.pl, L = c.L, blink = (sim.t % 0.8) < 0.42;
    plCar.brk = c.brk > 0.08; plCar.sig = blink ? (L.turn || '') : ''; plCar.haz = L.hazard && blink;
    if (plCar.sig && !blink) plCar.sig = '';
    camera(dt);
    if (st.cam === 'top' && sim.inCar) { R.night = sim.night; drawTop(ctx, sim, Wd, Ht, R); }
    else { drawScene(ctx, K, sim, R); if (st.cam === 'drv' && sim.inCar) hood(); }
    if (sim.inCar) mirrorsDraw();
    minimap();
    if (sim.inCar) drawDash(ctx, sim, st.dash.x, st.dash.y, st.dash.w, st.dash.h);
    if (st.paused && !st.resShown) { ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.fillRect(0, 0, Wd, Ht); }
    // 转向灯声
    const bOn = (L.turn || L.hazard) && blink;
    if (bOn !== st.blinkPrev) { st.blinkPrev = bOn; if ((L.turn || L.hazard) && !st.paused) A.beep('blinker'); }
  }
  function loop(ts) {
    raf = requestAnimationFrame(loop);
    const dt = Math.min(0.1, (ts - last) / 1000 || 0.016); last = ts;
    if (!st.paused) {
      acc += dt; let n = 0;
      while (acc >= 1 / 60 && n < 6) { sim.step(1 / 60); acc -= 1 / 60; n++; }
      if (n >= 6) acc = 0;
      st.instrT += dt;
    }
    if (sim.out.length) { const evs = sim.out.splice(0); evs.forEach(handle); }
    try { render(dt); } catch (e) { console.error(e); }
    domTick(dt); audioTick();
  }
  if (query.debug) window.__s3 = sim;
  layout();
  if (opt.mode === 'free') say(sim.night ? '夜间自由驾驶，请开启前照灯' : '自由驾驶模式，请系好安全带，点火起步', true);
  if (opt.mode === 'item') { const it = ITEMS[opt.item]; toast('分项练习：' + it.name, 'info', 2500); if (opt.item !== 'shangche' && opt.item !== 'yejian' && opt.item !== 'qibu') toast('车辆已在行驶中，请保持控制', 'info', 3000); }
  raf = requestAnimationFrame(loop);
  ui.cleanup.push(() => { cancelAnimationFrame(raf); A.stopSpeak(); A.immersive(false); });
}

/* ======================= 注册模块 ======================= */
if (HAS_DOM && window.App) {
  window.App.define('sim3', {
    mount(el, { path, query }) {
      A = window.App; injectCss(); ui.cleanup = [];
      const sub = path[1] || '';
      if (sub === 'lights') return lightsPage(el, query);
      if (sub === 'exam') return drivePage(el, { mode: 'exam' }, query);
      if (sub === 'free') return drivePage(el, { mode: 'free', night: query.night === '1' }, query);
      if (sub === 'item' && ITEMS[path[2]]) return drivePage(el, { mode: 'item', item: path[2] }, query);
      hub(el);
    },
    unmount() { ui.cleanup.forEach(f => { try { f(); } catch (e) { } }); ui.cleanup = []; if (A) A.stopSpeak(); }
  });
}
if (typeof module !== 'undefined' && module.exports) module.exports = { Sim, ITEMS, RULES, LT, LTI, gradeLight, LightTest, lightExamTasks, beam, mkLights, sigState, getWorld, physStep, mkCar, rpmOf, locate, toRoad, roadPt, seedRand, EXAM_SEQ, ITEM_ORDER, CYC };
})();
