/* 驾考通 · 核心框架：路由 / 存储 / 工具 / 首页 / 指南 / 我的 */
(function () {
  'use strict';
  const $ = (s, r = document) => r.querySelector(s);
  const view = $('#view');

  /* ---------------- 存储 ---------------- */
  const NS = 'jkt_';
  const store = {
    get(k, d) { try { const v = localStorage.getItem(NS + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem(NS + k, JSON.stringify(v)); } catch (e) {} },
    del(k) { localStorage.removeItem(NS + k); },
    keys() { return Object.keys(localStorage).filter(k => k.startsWith(NS)).map(k => k.slice(NS.length)); },
    clear() { this.keys().forEach(k => this.del(k)); }
  };

  /* ---------------- 设置 ---------------- */
  const settings = Object.assign({ theme: 'auto', voice: true, sound: true, vibrate: true, trans: 'manual' }, store.get('settings', {}));
  function saveSettings() { store.set('settings', settings); applyTheme(); }
  function applyTheme() {
    const dark = settings.theme === 'dark' || (settings.theme === 'auto' && matchMedia('(prefers-color-scheme: dark)').matches);
    document.documentElement.dataset.theme = dark ? 'dark' : 'light';
    const m = document.querySelector('meta[name=theme-color]'); if (m) m.content = dark ? '#1a1d23' : '#1677ff';
  }
  matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change', applyTheme);
  applyTheme();

  /* ---------------- 脚本懒加载 ---------------- */
  const loaded = {};
  function load(src) {
    if (Array.isArray(src)) return Promise.all(src.map(load));
    if (loaded[src]) return loaded[src];
    return (loaded[src] = new Promise((res, rej) => {
      const s = document.createElement('script');
      s.src = src + '?v=' + VERSION; s.onload = res;
      s.onerror = () => { delete loaded[src]; rej(new Error('加载失败: ' + src)); };
      document.head.appendChild(s);
    }));
  }
  const VERSION = '1.0.0';

  /* ---------------- UI 工具 ---------------- */
  let toastTimer;
  function toast(msg, ms = 1800) {
    const t = $('#toast'); t.textContent = msg; t.classList.add('show');
    clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('show'), ms);
  }
  function modal({ title = '', html = '', buttons = [{ text: '确定', primary: true }], closable = true } = {}) {
    const mask = document.createElement('div'); mask.className = 'modal-mask';
    mask.innerHTML = `<div class="modal">${title ? `<h3>${title}</h3>` : ''}<div class="mbody">${html}</div><div class="mfoot"></div></div>`;
    const foot = mask.querySelector('.mfoot');
    const close = () => mask.remove();
    buttons.forEach(b => {
      const el = document.createElement('button');
      el.className = 'btn ' + (b.primary ? 'primary' : b.danger ? 'danger' : '');
      el.textContent = b.text;
      el.onclick = () => { if (b.onClick && b.onClick() === false) return; close(); };
      foot.appendChild(el);
    });
    if (closable) mask.addEventListener('click', e => { if (e.target === mask) close(); });
    $('#modalRoot').appendChild(mask);
    return close;
  }
  function confirm(msg, title = '提示') {
    return new Promise(r => modal({ title, html: msg, buttons: [{ text: '取消', onClick: () => r(false) }, { text: '确定', primary: true, onClick: () => r(true) }], closable: false }));
  }
  function esc(s) { return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }

  /* 语音播报（零资源：系统 TTS） */
  let zhVoice = null;
  function pickVoice() {
    if (!('speechSynthesis' in window)) return;
    const vs = speechSynthesis.getVoices();
    zhVoice = vs.find(v => /zh[-_]CN/i.test(v.lang)) || vs.find(v => /^zh/i.test(v.lang)) || null;
  }
  if ('speechSynthesis' in window) { pickVoice(); speechSynthesis.onvoiceschanged = pickVoice; }
  function speak(text, { rate = 1.05, interrupt = true } = {}) {
    return new Promise(res => {
      if (!settings.voice || !('speechSynthesis' in window)) return res();
      if (interrupt) speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.lang = 'zh-CN'; u.rate = rate; if (zhVoice) u.voice = zhVoice;
      let done = false; const fin = () => { if (!done) { done = true; res(); } };
      u.onend = fin; u.onerror = fin;
      setTimeout(fin, 600 + text.length * 320); // 兜底：部分浏览器不触发 onend
      speechSynthesis.speak(u);
    });
  }
  function stopSpeak() { if ('speechSynthesis' in window) speechSynthesis.cancel(); }

  /* 音效（WebAudio 合成） */
  let actx = null;
  function ac() { if (!actx) { try { actx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) {} } if (actx && actx.state === 'suspended') actx.resume(); return actx; }
  function beep(type = 'click') {
    if (!settings.sound) return; const a = ac(); if (!a) return;
    const presets = {
      click: [[880, .04, 'square', .05]],
      ok: [[660, .08, 'sine', .15], [990, .12, 'sine', .15, .08]],
      bad: [[220, .18, 'sawtooth', .12], [180, .22, 'sawtooth', .12, .12]],
      tick: [[1200, .02, 'square', .04]],
      ding: [[1320, .25, 'sine', .18]],
      blinker: [[1800, .015, 'square', .05]],
      warn: [[880, .12, 'square', .1], [880, .12, 'square', .1, .2], [880, .12, 'square', .1, .4]],
      pass: [[523, .12, 'sine', .15], [659, .12, 'sine', .15, .12], [784, .12, 'sine', .15, .24], [1046, .3, 'sine', .15, .36]],
      horn: [[420, .35, 'sawtooth', .1], [520, .35, 'sawtooth', .08]]
    };
    (presets[type] || presets.click).forEach(([f, d, w, v, delay = 0]) => {
      const o = a.createOscillator(), g = a.createGain(); const t = a.currentTime + delay;
      o.type = w; o.frequency.value = f; g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(.0001, t + d);
      o.connect(g).connect(a.destination); o.start(t); o.stop(t + d + .02);
    });
  }
  function vibrate(p = 30) { if (settings.vibrate && navigator.vibrate) navigator.vibrate(p); }

  /* 沉浸模式 */
  function immersive(on) {
    document.body.classList.toggle('immersive', !!on);
    if (on) { try { const el = document.documentElement; if (isTouch() && !document.fullscreenElement && el.requestFullscreen) el.requestFullscreen().catch(() => {}); } catch (e) {} }
    else if (document.fullscreenElement && document.exitFullscreen) document.exitFullscreen().catch(() => {});
  }
  const isTouch = () => matchMedia('(pointer:coarse)').matches || 'ontouchstart' in window;

  /* 记录（考试历史 / 进度） */
  function record(key, obj) {
    const list = store.get('hist_' + key, []); list.unshift(Object.assign({ t: Date.now() }, obj));
    store.set('hist_' + key, list.slice(0, 50)); return list;
  }
  function history(key) { return store.get('hist_' + key, []); }

  /* ---------------- 路由 ---------------- */
  const modules = {};
  const routes = {
    '': { title: '驾考通', page: home },
    k1: { title: '科目一 · 理论', mod: 'quiz', js: ['js/signs.js', 'js/quiz.js'] },
    k4: { title: '科目四 · 安全文明', mod: 'quiz', js: ['js/signs.js', 'js/quiz.js'] },
    quiz: { title: '练习', mod: 'quiz', js: ['js/signs.js', 'js/quiz.js'] },
    k2: { title: '科目二 · 场地驾驶', mod: 'sim2', js: ['js/sim2.js'] },
    k3: { title: '科目三 · 道路驾驶', mod: 'sim3', js: ['js/sim3.js'] },
    ref: { title: '图鉴 · 知识库', mod: 'ref', js: ['js/signs.js', 'js/ref.js'] },
    guide: { title: '学车全流程', page: guide },
    me: { title: '我的', page: me }
  };
  let current = null, navSeq = 0;

  function parseHash() {
    let h = decodeURIComponent(location.hash.replace(/^#\/?/, ''));
    let q = {}; const qi = h.indexOf('?');
    if (qi >= 0) { new URLSearchParams(h.slice(qi + 1)).forEach((v, k) => q[k] = v); h = h.slice(0, qi); }
    const path = h.split('/').filter(Boolean);
    return { path, query: q, key: path[0] || '' };
  }

  async function render() {
    const seq = ++navSeq;
    const { path, query, key } = parseHash();
    const r = routes[key] || routes[''];
    if (current && current.unmount) { try { current.unmount(); } catch (e) { console.error(e); } }
    current = null;
    immersive(false); stopSpeak();
    document.body.classList.toggle('can-back', path.length > 0);
    setTitle(r.title);
    highlightNav(key);
    view.innerHTML = '';
    view.className = '';
    window.scrollTo(0, 0);
    if (r.page) { r.page(view, { path, query }); return; }
    view.innerHTML = '<div class="center muted" style="padding:60px 0">加载中…</div>';
    try { await load(r.js); } catch (e) {
      if (seq !== navSeq) return;
      view.innerHTML = `<div class="card center"><p>模块加载失败，请检查网络后重试。</p><button class="btn primary" onclick="location.reload()">重新加载</button></div>`;
      return;
    }
    if (seq !== navSeq) return;
    const m = modules[r.mod];
    view.innerHTML = '';
    if (!m) { view.innerHTML = '<div class="card center muted">模块未就绪</div>'; return; }
    current = m;
    try { m.mount(view, { path, query }); } catch (e) { console.error(e); view.innerHTML = `<div class="card"><b>出错了</b><pre class="small">${esc(e.stack || e)}</pre></div>`; }
  }
  function setTitle(t) { $('#pageTitle').textContent = t; document.title = t === '驾考通' ? '驾考通 · 科一二三四一站通关' : t + ' - 驾考通'; }
  function go(h) { if (location.hash === h || location.hash === '#' + h.replace(/^#/, '')) render(); else location.hash = h.replace(/^#?/, '#'); }

  $('#backBtn').onclick = () => {
    if (history_len > 1) window.history.back(); else go('#/');
  };
  let history_len = 0;
  addEventListener('hashchange', () => { history_len++; render(); });

  /* ---------------- 导航 ---------------- */
  const svgHome = '<svg viewBox="0 0 24 24"><path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg>';
  const tabs = [
    ['', '首页', svgHome], ['k1', '科一', 1], ['k2', '科二', 2], ['k3', '科三', 3], ['k4', '科四', 4]
  ];
  $('#tabbar').innerHTML = tabs.map(([k, n, i]) => `<a href="#/${k}" data-k="${k}">${typeof i === 'number' ? `<i class="k"><span>${i}</span></i>` : i}<span>${n}</span></a>`).join('');
  const side = [
    ['', '首页', '#1677ff'], ['k1', '科目一 · 理论考试', 'var(--k1)'], ['k2', '科目二 · 场地模拟', 'var(--k2)'],
    ['k3', '科目三 · 路考模拟', 'var(--k3)'], ['k4', '科目四 · 安全文明', 'var(--k4)'], 'sep',
    ['ref', '图鉴 · 标志手势', '#ef4444'], ['guide', '学车全流程', '#0ea5e9'], ['me', '我的 · 设置', '#64748b']
  ];
  $('#sidenav').innerHTML = side.map(s => s === 'sep' ? '<div class="sep"></div>' : `<a href="#/${s[0]}" data-k="${s[0]}"><i class="dot" style="background:${s[2]}"></i>${s[1]}</a>`).join('');
  function highlightNav(key) {
    const k = key === 'quiz' ? (parseHash().path[1] || 'k1') : key;
    document.querySelectorAll('#tabbar a,#sidenav a').forEach(a => a.classList.toggle('on', a.dataset.k === k));
  }

  /* ---------------- 首页 ---------------- */
  const tips = [
    '科目一考试 100 题、45 分钟，90 分及格；科目四 50 题、30 分钟，每题 2 分，90 分及格。',
    '倒车入库口诀：后视镜下沿压住库角线，方向盘一把打死；车身与库边平行时回正。',
    '科目三起步前务必：开左转向灯 ≥3 秒 → 观察左后视镜 → 回头看 → 起步，少一步都可能被扣分。',
    '驾驶证记分周期为 12 个月，满分 12 分。一次记满 12 分需参加学习和考试。',
    '高速公路最高车速不得超过 120km/h，最低车速不得低于 60km/h。',
    '机动车在没有限速标志的城市道路上（同方向只有 1 条机动车道），最高时速 50 公里。',
    '实习期为 12 个月，实习期内驾车需粘贴或悬挂统一式样的"实习"标志。',
    '坡道定点停车：车身距边线 30cm 内，前保险杠距停车线 50cm 内，起步后溜不得超过 30cm。',
    '饮酒驾驶：血液酒精含量 ≥20mg/100ml；醉酒驾驶：≥80mg/100ml，构成危险驾驶罪。',
    '灯光考试：夜间通过急弯、坡路、拱桥、人行横道或没有交通信号灯控制的路口，交替使用远近光灯。'
  ];
  function progressOf(bank) {
    const done = store.get('done_' + bank, {}); // 由 quiz 模块写入 {id:1|0}
    return Object.keys(done).length;
  }
  function home(el) {
    const totals = store.get('bank_totals', { k1: 0, k4: 0 });
    const k1d = progressOf('k1'), k4d = progressOf('k4');
    const k2h = history('k2'), k3h = history('k3');
    const best = list => list.length ? Math.max(...list.map(x => x.score || 0)) : '--';
    const daysLeft = (() => { const d = store.get('examDate'); if (!d) return null; return Math.ceil((new Date(d) - Date.now()) / 864e5); })();
    const tip = tips[Math.floor(Date.now() / 864e5) % tips.length];
    const pct = (a, b) => b ? Math.min(100, Math.round(a / b * 100)) : 0;
    el.innerHTML = `
    <div class="hero fade-in">
      <svg class="road" viewBox="0 0 200 160"><path d="M80 160 L110 0 M150 160 L120 0" stroke="#fff" stroke-width="4" fill="none"/><path d="M115 150v-20M114 110v-16M113 78v-12M112 52v-9M111 32v-6" stroke="#fff" stroke-width="3"/></svg>
      <h2>你好，准司机 👋</h2>
      <p>${daysLeft != null ? (daysLeft >= 0 ? `距离考试还有 <b style="font-size:20px">${daysLeft}</b> 天，加油！` : '考试日期已过，记得更新哦') : '科目一到科目四，一个网站全搞定。'}</p>
      <div class="stats">
        <div><b>${k1d}</b><span>科一已练</span></div>
        <div><b>${best(k2h)}</b><span>科二最佳</span></div>
        <div><b>${best(k3h)}</b><span>科三最佳</span></div>
        <div><b>${k4d}</b><span>科四已练</span></div>
      </div>
    </div>
    <div class="grid g2" style="margin-bottom:14px">
      <div class="subj k1" data-go="#/k1"><div class="big">1</div><div class="n">科目一</div><div class="t">理论考试</div><div class="d">道路交通安全法规 · 全真题库 · 模拟考试</div><div class="p"><i style="width:${pct(k1d, totals.k1)}%"></i></div></div>
      <div class="subj k2" data-go="#/k2"><div class="big">2</div><div class="n">科目二</div><div class="t">场地驾驶</div><div class="d">倒库 · 侧方 · 坡道 · 直角 · 曲线 模拟开车</div><div class="p"><i style="width:${Math.min(100, k2h.length * 10)}%"></i></div></div>
      <div class="subj k3" data-go="#/k3"><div class="big">3</div><div class="n">科目三</div><div class="t">道路驾驶</div><div class="d">灯光模拟 · 路考全流程 · 真实交通模拟</div><div class="p"><i style="width:${Math.min(100, k3h.length * 10)}%"></i></div></div>
      <div class="subj k4" data-go="#/k4"><div class="big">4</div><div class="n">科目四</div><div class="t">安全文明</div><div class="d">安全文明驾驶常识 · 多选题 · 模拟考试</div><div class="p"><i style="width:${pct(k4d, totals.k4)}%"></i></div></div>
    </div>
    <div class="quick-grid">
      <div class="quick" data-go="#/quiz/k1/exam"><div class="ico" style="background:#1677ff">考</div>科一模考</div>
      <div class="quick" data-go="#/k3/lights"><div class="ico" style="background:#f97316">灯</div>灯光模拟</div>
      <div class="quick" data-go="#/ref/signs"><div class="ico" style="background:#ef4444">牌</div>交通标志</div>
      <div class="quick" data-go="#/ref/gestures"><div class="ico" style="background:#0ea5e9">警</div>交警手势</div>
      <div class="quick" data-go="#/ref/dash"><div class="ico" style="background:#f59e0b">表</div>指示灯</div>
      <div class="quick" data-go="#/quiz/k1/wrong"><div class="ico" style="background:#e5383b">错</div>错题本</div>
      <div class="quick" data-go="#/ref/points"><div class="ico" style="background:#64748b">分</div>记分规则</div>
      <div class="quick" data-go="#/guide"><div class="ico" style="background:#10b981">路</div>学车流程</div>
    </div>
    <div class="card">
      <div class="card-title">💡 每日一学</div>
      <p style="margin:0">${tip}</p>
    </div>
    <div class="card">
      <div class="card-title">📅 考试日期 <span class="muted small" style="font-weight:400">设置后首页倒计时</span></div>
      <div class="row"><input type="date" id="examDate" value="${store.get('examDate', '')}" style="flex:1;height:40px;border:1px solid var(--line);border-radius:10px;padding:0 10px;background:var(--card2);color:var(--text);font:inherit"><button class="btn primary" id="saveDate">保存</button></div>
    </div>
    <div class="card">
      <div class="card-title">🚗 学车路线图 <a href="#/guide" class="small">详细 ›</a></div>
      <div class="timeline">
        <div class="tl"><h4>报名 · 体检</h4><p>选驾校、体检（视力、辨色、听力、四肢）、提交资料</p></div>
        <div class="tl"><h4>科目一 · 理论</h4><p>交规理论，100题 90分及格，可网上预约</p></div>
        <div class="tl"><h4>科目二 · 场地</h4><p>倒车入库、侧方停车、坡道、直角转弯、曲线行驶</p></div>
        <div class="tl"><h4>科目三 · 路考</h4><p>灯光模拟 + 实际道路驾驶 16 个项目</p></div>
        <div class="tl" style="padding-bottom:0"><h4>科目四 · 拿证 🎉</h4><p>安全文明常识，通过当天领取驾驶证</p></div>
      </div>
    </div>`;
    el.querySelectorAll('[data-go]').forEach(n => n.onclick = () => go(n.dataset.go));
    $('#saveDate', el).onclick = () => { store.set('examDate', $('#examDate', el).value); toast('已保存'); home(el); };
  }

  /* ---------------- 学车全流程 ---------------- */
  function guide(el) {
    const sec = (t, h) => `<div class="card"><div class="card-title">${t}</div>${h}</div>`;
    el.innerHTML = `
    <div class="note" style="margin-bottom:14px">以下为一般流程，具体以当地车管所和驾校规定为准。可登录 <b>交管12123</b> App 预约考试、查询成绩。</div>
    ${sec('① 选择驾照类型', `<table class="tbl"><tr><th>准驾车型</th><th>代号</th><th>说明</th></tr>
      <tr><td>小型汽车</td><td><span class="tag blue">C1</span></td><td>手动挡+自动挡均可驾驶，最常见</td></tr>
      <tr><td>小型自动挡汽车</td><td><span class="tag green">C2</span></td><td>仅限自动挡，考试更简单（无离合）</td></tr>
      <tr><td>低速载货汽车</td><td><span class="tag">C3</span></td><td>低速载货汽车</td></tr>
      <tr><td>三轮汽车</td><td><span class="tag">C4</span></td><td>三轮汽车</td></tr>
      <tr><td>残疾人专用小型自动挡载客汽车</td><td><span class="tag">C5</span></td><td>上肢或下肢残疾人</td></tr>
      <tr><td>轻型牵引挂车</td><td><span class="tag">C6</span></td><td>总质量≤4500kg 的汽车列车（需持有C1/C2/C3一年以上增驾）</td></tr></table>
      <p class="muted small">年龄要求：C1/C2 年满 18 周岁，70 周岁以上需额外通过记忆力、判断力、反应力测试。</p>`)}
    ${sec('② 报名与体检', `<ul style="padding-left:20px;margin:0">
      <li><b>视力</b>：两眼裸视力或矫正视力达到对数视力表 4.9 以上（C1/C2）</li>
      <li><b>辨色力</b>：无红绿色盲</li><li><b>听力</b>：两耳分别距音叉 50 厘米能辨别声源方向（佩戴助听器亦可申请C1/C2）</li>
      <li><b>上肢 / 下肢 / 躯干颈部</b>：无运动功能障碍</li>
      <li>准备材料：身份证、体检证明、一寸白底照片（部分地区现场采集）</li></ul>`)}
    ${sec('③ 科目一 · 道路交通安全法律法规和相关知识', `<p>考试题型：判断题 + 单选题，共 <b>100</b> 题，<b>45</b> 分钟，每题 1 分，<b>90</b> 分及格。一次考试有 2 次机会（第一次不及格可当场补考 1 次）。</p>
      <p>内容：道路通行条件及通行规定、道路交通信号、驾驶证与机动车管理规定、违法行为及处罚、事故处理等。</p>
      <a class="btn primary sm" href="#/k1">去练科目一 ›</a>`)}
    ${sec('④ 科目二 · 场地驾驶技能', `<p>C1/C2 必考 5 项：<b>倒车入库、侧方停车、坡道定点停车和起步（C2 不考）、直角转弯、曲线行驶</b>。满分 100，80 分及格。部分地区增加模拟隧道、雨雾天、高速公路卡片、湿滑路面、紧急情况处置等。</p>
      <p>科目一合格后即可预约科目二，学习驾驶证明有效期 3 年内完成全部科目。</p>
      <a class="btn sm" style="background:var(--k2);color:#fff;border:0" href="#/k2">去练科目二 ›</a>`)}
    ${sec('⑤ 科目三 · 道路驾驶技能', `<p>包括 <b>上车准备、起步、直线行驶、加减挡位操作、变更车道、靠边停车、直行通过路口、路口左转弯、路口右转弯、通过人行横道线、通过学校区域、通过公共汽车站、会车、超车、掉头、夜间行驶</b> 16 项。满分 100，90 分及格。</p>
      <p>考前先进行 <b>灯光模拟考试</b>（语音指令操作灯光）。</p>
      <a class="btn sm" style="background:var(--k3);color:#fff;border:0" href="#/k3">去练科目三 ›</a>`)}
    ${sec('⑥ 科目四 · 安全文明驾驶常识', `<p>单选 + 多选 + 判断，共 <b>50</b> 题，<b>30</b> 分钟，每题 2 分，<b>90</b> 分及格。通常与科目三同日考试，通过后当天领证。</p>
      <a class="btn sm" style="background:var(--k4);color:#fff;border:0" href="#/k4">去练科目四 ›</a>`)}
    ${sec('⑦ 拿证之后', `<ul style="padding-left:20px;margin:0">
      <li><b>实习期 12 个月</b>：车身后部粘贴或悬挂"实习"标志；实习期内不得单独驾车上高速，需由持相应或更高准驾车型驾驶证 3 年以上的驾驶人陪同。</li>
      <li>实习期内记满 12 分，注销其实习的准驾车型驾驶资格。</li>
      <li>驾驶证有效期：首次申领 6 年，之后换证 10 年，再之后长期。</li>
      <li>记分周期 12 个月，满分 12 分，详见 <a href="#/ref/points">记分规则</a>。</li></ul>`)}
    ${sec('⑧ 常见问题', `
      <p><b>Q：考试没过怎么办？</b><br>每个科目每次预约有 2 次考试机会（科二、科三当场可补考 1 次）。预约考试科目不合格后，10 日后可再次预约；科目二、三每科预约次数不超过 5 次，第 5 次不合格则已考过的其他科目成绩作废。</p>
      <p><b>Q：学习驾驶证明有效期？</b><br>3 年，3 年内须完成全部科目考试。</p>
      <p><b>Q：可以异地考驾照吗？</b><br>可以，凭居民身份证即可在全国范围内申领小型汽车驾驶证（部分城市有特殊规定）。</p>`)}
    `;
  }

  /* ---------------- 我的 ---------------- */
  function me(el) {
    const sw = (k, label, desc) => `<div class="list-item" style="cursor:default"><div class="flex1"><div>${label}</div>${desc ? `<div class="small muted">${desc}</div>` : ''}</div><label class="switch"><input type="checkbox" data-set="${k}" ${settings[k] ? 'checked' : ''}><span></span></label></div>`;
    const h = ['k1', 'k2', 'k3', 'k4'].map(k => [k, history(k)]);
    const fmt = t => { const d = new Date(t); return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; };
    el.innerHTML = `
    <div class="section-title">外观与反馈</div>
    <div class="list">
      <div class="list-item" style="cursor:default"><div class="flex1">主题</div>
        <div class="seg" id="themeSeg">${[['auto', '跟随系统'], ['light', '浅色'], ['dark', '深色']].map(([v, n]) => `<button data-v="${v}" class="${settings.theme === v ? 'on' : ''}">${n}</button>`).join('')}</div></div>
      ${sw('voice', '语音播报', '模拟考试语音指令（使用系统语音，无需下载）')}
      ${sw('sound', '音效', '答题、转向灯、提示音')}
      ${sw('vibrate', '震动反馈', '仅支持的手机')}
      <div class="list-item" style="cursor:default"><div class="flex1"><div>模拟驾驶默认变速箱</div><div class="small muted">C1 手动挡 / C2 自动挡</div></div>
        <div class="seg" id="transSeg">${[['manual', 'C1 手动'], ['auto', 'C2 自动']].map(([v, n]) => `<button data-v="${v}" class="${settings.trans === v ? 'on' : ''}">${n}</button>`).join('')}</div></div>
    </div>
    <div class="section-title">考试记录</div>
    <div class="card">
      ${h.map(([k, l]) => `<div style="margin-bottom:10px"><b>${{ k1: '科目一', k2: '科目二', k3: '科目三', k4: '科目四' }[k]}</b> <span class="muted small">共 ${l.length} 次</span>
        <div class="row wrap" style="margin-top:4px;gap:6px">${l.slice(0, 10).map(x => `<span class="tag ${x.pass ? 'green' : 'red'}" title="${fmt(x.t)}">${x.score}分 · ${fmt(x.t)}</span>`).join('') || '<span class="muted small">暂无</span>'}</div></div>`).join('')}
    </div>
    <div class="section-title">数据</div>
    <div class="list">
      <div class="list-item" id="exportBtn"><div class="flex1">导出学习数据</div><span class="arrow"></span></div>
      <div class="list-item" id="importBtn"><div class="flex1">导入学习数据</div><span class="arrow"></span></div>
      <div class="list-item" id="clearBtn" style="color:var(--bad)"><div class="flex1">清除全部数据</div><span class="arrow"></span></div>
    </div>
    <p class="center muted small">驾考通 v${VERSION} · 所有数据仅保存在本机浏览器<br>题库内容依据《道路交通安全法》及其实施条例等编写，仅供学习参考</p>`;
    el.querySelectorAll('[data-set]').forEach(i => i.onchange = () => { settings[i.dataset.set] = i.checked; saveSettings(); if (i.dataset.set === 'voice' && i.checked) speak('语音播报已开启'); });
    const seg = (id, key) => el.querySelectorAll(`#${id} button`).forEach(b => b.onclick = () => { settings[key] = b.dataset.v; saveSettings(); me(el); });
    seg('themeSeg', 'theme'); seg('transSeg', 'trans');
    $('#exportBtn', el).onclick = () => {
      const data = {}; store.keys().forEach(k => data[k] = store.get(k));
      const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'jiakaotong-backup.json'; a.click();
    };
    $('#importBtn', el).onclick = () => {
      const inp = document.createElement('input'); inp.type = 'file'; inp.accept = '.json';
      inp.onchange = () => { const r = new FileReader(); r.onload = () => { try { const d = JSON.parse(r.result); Object.keys(d).forEach(k => store.set(k, d[k])); toast('导入成功'); setTimeout(() => location.reload(), 600); } catch (e) { toast('文件格式错误'); } }; r.readAsText(inp.files[0]); };
      inp.click();
    };
    $('#clearBtn', el).onclick = async () => { if (await confirm('将清除所有练习记录、错题、收藏和设置，确定吗？')) { store.clear(); toast('已清除'); setTimeout(() => location.reload(), 600); } };
  }

  /* ---------------- 导出 API ---------------- */
  window.App = {
    VERSION, store, settings, saveSettings, load, toast, modal, confirm, esc, speak, stopSpeak, beep, vibrate,
    immersive, isTouch, record, history, go, setTitle,
    define(name, mod) { modules[name] = mod; },
    get route() { return parseHash(); }
  };

  render();
  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
  }
})();
