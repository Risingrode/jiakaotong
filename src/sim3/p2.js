
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
