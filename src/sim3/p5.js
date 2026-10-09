
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
