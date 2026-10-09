/* 驾考通 · 题库练习 / 全真模拟考试引擎（module: quiz）
 * 路由：#/k1  #/k4  #/quiz/<bank>/<mode>[/<arg>]
 * mode: seq | random | chapter[/<chId>] | type[/<judge|single|multi|img|hard>] | exam | wrong | fav | tips | history
 */
(function () {
  'use strict';
  const A = window.App;
  const esc = A.esc;
  const LET = 'ABCDEFGH';
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));

  const BANKS = {
    k1: {
      key: 'k1', name: '科目一', label: '理论考试', full: '科目一 · 理论考试', file: 'js/qb1.js',
      grad: 'linear-gradient(135deg,#3b82f6 0%,#1d4ed8 100%)', color: '#1677ff',
      exam: { n: 100, min: 45, pass: 90, mix: { judge: 40, single: 60 } }
    },
    k4: {
      key: 'k4', name: '科目四', label: '安全文明常识考试', full: '科目四 · 安全文明驾驶常识', file: 'js/qb4.js',
      grad: 'linear-gradient(135deg,#a78bfa 0%,#6d28d9 100%)', color: '#8b5cf6',
      exam: { n: 50, min: 30, pass: 90, mix: { judge: 20, single: 20, multi: 10 } }
    }
  };
  const TYPE_NAME = { judge: '判断题', single: '单选题', multi: '多选题' };

  /* ---------------- 设置 / 存储 ---------------- */
  const DEF = { autoNext: true, removeAfter: 1, fs: 'm', examInstant: true, memo: false };
  const cfg = Object.assign({}, DEF, A.store.get('quiz_settings', {}));
  const saveCfg = () => A.store.set('quiz_settings', cfg);
  const get = (k, d) => A.store.get(k, d);
  const put = (k, v) => A.store.set(k, v);
  const K = {
    done: b => 'done_' + b, wrong: b => 'quiz_wrong_' + b, wok: b => 'quiz_wrongok_' + b,
    wall: b => 'quiz_wrongall_' + b, fav: b => 'quiz_fav_' + b, pos: b => 'quiz_pos_' + b, chpos: b => 'quiz_chpos_' + b
  };

  /* ---------------- 生命周期 ---------------- */
  let root = null, token = 0, offs = [], timers = new Set(), raf = 0, SES = null, sheetEl = null;
  function on(t, ev, fn, o) { t.addEventListener(ev, fn, o); offs.push(() => t.removeEventListener(ev, fn, o)); }
  function later(fn, ms) { const id = setTimeout(() => { timers.delete(id); fn(); }, ms); timers.add(id); return id; }
  function every(fn, ms) { const id = setInterval(fn, ms); timers.add(id); return id; }
  function clr(id) { if (id) { clearTimeout(id); clearInterval(id); timers.delete(id); } }
  function cleanup() {
    offs.forEach(f => f()); offs = [];
    timers.forEach(id => { clearTimeout(id); clearInterval(id); }); timers.clear();
    cancelAnimationFrame(raf); closeSheet(); SES = null;
  }

  /* ---------------- 工具 ---------------- */
  function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
  const optsOf = q => q.type === 'judge' ? ['正确', '错误'] : (q.opts || []);
  const keyOf = q => q.type === 'judge' ? (q.ans === '对' ? 'A' : 'B') : String(q.ans).toUpperCase().split('').sort().join('');
  const ansText = q => q.type === 'judge' ? (q.ans === '对' ? '正确' : '错误') : keyOf(q);
  const fmtT = s => { s = Math.max(0, Math.round(s)); return String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0'); };
  const fmtDate = t => { const d = new Date(t); return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; };
  const nl = s => esc(s || '').replace(/\n/g, '<br>');
  const chName = (B, id) => (B.chapters.find(c => c.id === id) || { name: '其他' }).name;
  const rxEsc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  function imgHtml(img, size) {
    if (!img || typeof img !== 'string') return '';
    let s = '';
    try {
      const S = window.Signs;
      if (img.startsWith('svg:')) s = img.slice(4);
      else if (img.startsWith('sign:')) s = S && S.svg ? S.svg(img.slice(5), size || 150) : '';
      else if (img.startsWith('dash:')) s = S && S.dash ? S.dash(img.slice(5), Math.round((size || 150) * 0.66)) : '';
    } catch (e) { s = ''; }
    return s ? `<div class="q-img">${s}</div>` : '';
  }

  const ICONS = {
    seq: '<path d="M8 6h12M8 12h12M8 18h8M4 6h.01M4 12h.01M4 18h.01"/>',
    random: '<path d="M3 7h3.5c2 0 3 1 4.5 3.5L13 14c1.5 2.5 2.5 3 4.5 3H21M3 17h3.5c1.2 0 2-.4 2.8-1.3M13.7 8.3C14.5 7.4 15.3 7 16.5 7H21M18 4l3 3-3 3M18 14l3 3-3 3"/>',
    chapter: '<path d="M4 19.5V5a2 2 0 0 1 2-2h14v15H6a2 2 0 0 0-2 2zm0 0A2 2 0 0 0 6 22h14M9 7h7M9 11h5"/>',
    type: '<path d="M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z"/>',
    wrong: '<circle cx="12" cy="12" r="9"/><path d="M9 9l6 6M15 9l-6 6"/>',
    fav: '<path d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z"/>',
    history: '<path d="M4 20h16M6 16l4-5 3 3 5-7"/>',
    tips: '<path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.6 10.8c.7.6 1.1 1.4 1.1 2.2h5c0-.8.4-1.6 1.1-2.2A6 6 0 0 0 12 3z"/>',
    exam: '<path d="M9 3h6l1 2h3v16H5V5h3zM9 12l2 2 4-4"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/>',
    gear: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
    grid: '<path d="M4 4h4v4H4zM10 4h4v4h-4zM16 4h4v4h-4zM4 10h4v4H4zM10 10h4v4h-4zM16 10h4v4h-4zM4 16h4v4H4zM10 16h4v4h-4zM16 16h4v4h-4z"/>',
    left: '<path d="M15 5l-7 7 7 7"/>', right: '<path d="M9 5l7 7-7 7"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>'
  };
  const ico = (k, s) => `<svg class="q-svg" viewBox="0 0 24 24" width="${s || 22}" height="${s || 22}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${ICONS[k] || ''}</svg>`;

  /* ---------------- 题库加载 ---------------- */
  function bankOf(b) { const Q = window.QB && window.QB[b]; return Q && Array.isArray(Q.list) && Q.list.length ? Q : null; }
  function prep(b, B) {
    if (!B._prep) {
      B.chapters = Array.isArray(B.chapters) ? B.chapters : [];
      B._map = {}; B.list.forEach((q, i) => { q._i = i; B._map[q.id] = q; });
      const used = new Set(B.list.map(q => q.ch));
      used.forEach(c => { if (!B.chapters.find(x => x.id === c)) B.chapters.push({ id: c, name: '其他' }); });
      B._prep = true;
    }
    const t = get('bank_totals', {}); if (t[b] !== B.list.length) { t[b] = B.list.length; put('bank_totals', t); }
    return B;
  }
  function loadBank(b) {
    if (bankOf(b)) return Promise.resolve(prep(b, bankOf(b)));
    return A.load(BANKS[b].file).then(() => bankOf(b) ? prep(b, bankOf(b)) : null, () => null);
  }

  /* ---------------- 进度记录 ---------------- */
  function recordAnswer(b, q, ok) {
    const done = get(K.done(b), {}); done[q.id] = ok ? 1 : 0; put(K.done(b), done);
    const w = get(K.wrong(b), {}), wo = get(K.wok(b), {});
    let removed = false;
    if (!ok) {
      w[q.id] = (w[q.id] || 0) + 1; delete wo[q.id];
      const wa = get(K.wall(b), {}); wa[q.id] = (wa[q.id] || 0) + 1; put(K.wall(b), wa);
    } else if (w[q.id]) {
      wo[q.id] = (wo[q.id] || 0) + 1;
      if (wo[q.id] >= cfg.removeAfter) { delete w[q.id]; delete wo[q.id]; removed = true; }
    }
    put(K.wrong(b), w); put(K.wok(b), wo);
    return removed;
  }
  function stats(b, B) {
    const done = get(K.done(b), {}), wrong = get(K.wrong(b), {}), fav = get(K.fav(b), {});
    let d = 0, c = 0, w = 0, f = 0;
    B.list.forEach(q => { if (q.id in done) { d++; if (done[q.id] === 1) c++; } if (wrong[q.id]) w++; if (fav[q.id]) f++; });
    const hist = A.history(b);
    return {
      total: B.list.length, done: d, correct: c, acc: d ? Math.round(c / d * 100) : 0, wrong: w, fav: f, hist,
      best: hist.length ? Math.max(...hist.map(h => h.score || 0)) : null,
      passN: hist.filter(h => h.pass).length,
      pos: Math.min(get(K.pos(b), 0), B.list.length - 1)
    };
  }

  /* ---------------- 样式 ---------------- */
  function injectCss() {
    if (document.getElementById('quiz-css')) return;
    const st = document.createElement('style'); st.id = 'quiz-css';
    st.textContent = `
.q-svg{display:block;flex:none}
.q-hub{max-width:900px;margin:0 auto}
.q-hero{position:relative;overflow:hidden;border-radius:20px;padding:18px;color:#fff;display:flex;gap:18px;align-items:center;margin-bottom:14px;box-shadow:0 8px 24px rgba(30,60,140,.18)}
.q-hero::after{content:"";position:absolute;right:-60px;top:-60px;width:200px;height:200px;border-radius:50%;background:rgba(255,255,255,.08)}
.q-hero h2{margin:0 0 4px;font-size:21px}
.q-hero .q-sub{opacity:.9;font-size:13px}
.q-hero .q-chips{display:flex;flex-wrap:wrap;gap:6px;margin-top:10px}
.q-hero .q-chips span{background:rgba(255,255,255,.18);padding:2px 9px;border-radius:20px;font-size:12px;white-space:nowrap}
.q-ring{flex:none;overflow:visible}
@media (max-width:520px){.q-hero{gap:14px;padding:16px}.q-hero h2{font-size:18px}.q-hero .q-ring{width:86px;height:86px}}
.q-ring-fg{transition:stroke-dashoffset 1.1s cubic-bezier(.2,.8,.2,1)}
.q-search{position:relative;margin-bottom:12px}
.q-search input{width:100%;height:44px;border-radius:12px;border:1px solid var(--line);background:var(--card);color:var(--text);padding:0 14px 0 40px;font:inherit;outline:none;box-shadow:var(--shadow)}
.q-search input:focus{border-color:var(--pri)}
.q-search .q-svg{position:absolute;left:12px;top:11px;color:var(--text3)}
.q-sres{margin-bottom:14px}
.q-sres .q-si{padding:12px 14px;border-bottom:1px solid var(--line);cursor:pointer}
.q-sres .q-si:last-child{border-bottom:0}
.q-sres mark{background:color-mix(in srgb,var(--warn) 35%,transparent);color:inherit;border-radius:3px;padding:0 1px}
.q-sres .q-sd{display:none;margin-top:8px;font-size:14px;color:var(--text2)}
.q-sres .q-si.open .q-sd{display:block}
.q-exam-btn{position:relative;overflow:hidden;display:flex;align-items:center;gap:14px;width:100%;border:0;border-radius:18px;padding:18px;color:#fff;cursor:pointer;text-align:left;margin-bottom:14px;box-shadow:0 8px 22px rgba(229,56,59,.25);background:linear-gradient(120deg,#ff7a45,#e5383b 60%,#c81e4a);transition:transform .12s}
.q-exam-btn:active{transform:scale(.985)}
.q-exam-btn b{font-size:20px;display:block}
.q-exam-btn small{opacity:.92;font-size:13px}
.q-exam-btn .q-eico{width:52px;height:52px;border-radius:16px;background:rgba(255,255,255,.2);display:flex;align-items:center;justify-content:center;flex:none}
.q-exam-btn .q-go{margin-left:auto;font-size:28px;opacity:.9}
.q-tiles{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:14px}
@media (max-width:640px){.q-tiles{grid-template-columns:repeat(2,1fr)}}
.q-tile{position:relative;display:flex;align-items:center;gap:10px;padding:14px 12px;border-radius:16px;background:var(--card);box-shadow:var(--shadow);cursor:pointer;border:1px solid transparent;transition:transform .1s,border-color .15s;min-width:0;color:var(--text)}
.q-tile:hover{border-color:var(--line)}
.q-tile:active{transform:scale(.97)}
.q-tile .q-ti{width:40px;height:40px;border-radius:12px;display:flex;align-items:center;justify-content:center;color:#fff;flex:none}
.q-tile b{display:block;font-size:15px;white-space:nowrap}
.q-tile small{display:block;color:var(--text3);font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.q-tile .badge{position:absolute;right:8px;top:8px}
.q-rules{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;text-align:center;margin-bottom:10px}
.q-rules div{background:var(--card2);border-radius:12px;padding:10px 4px}
.q-rules b{display:block;font-size:20px;color:var(--pri);line-height:1.2}
.q-rules span{font-size:12px;color:var(--text3)}
.q-trend{width:100%;height:auto;display:block}
.q-hrow{display:flex;align-items:center;gap:10px;padding:11px 2px;border-bottom:1px solid var(--line)}
.q-hrow:last-child{border-bottom:0}
.q-hrow .q-hs{font-size:22px;font-weight:800;width:56px}
.q-chl{display:flex;align-items:center;gap:12px}
.q-chn{width:34px;height:34px;border-radius:10px;background:var(--pri-bg);color:var(--pri);display:flex;align-items:center;justify-content:center;font-weight:800;flex:none}
.q-empty{text-align:center;padding:40px 16px}
.q-empty .q-svg{margin:0 auto 10px;color:var(--text3)}
/* 练习 */
.q-practice{max-width:860px;margin:0 auto;padding-bottom:84px}
.q-fs-s{--q-fs:15px}.q-fs-m{--q-fs:17px}.q-fs-l{--q-fs:20px}
.q-head{display:flex;align-items:center;gap:8px;margin-bottom:8px}
.q-head .q-tt{flex:1;min-width:0;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.q-cnt{display:flex;gap:10px;font-size:14px;font-weight:700}
.q-cnt .ok{color:var(--ok)}.q-cnt .bad{color:var(--bad)}
.q-chip{height:30px;padding:0 10px;border-radius:15px;border:1px solid var(--line);background:var(--card);font-size:13px;font-weight:600;cursor:pointer;color:var(--text2);white-space:nowrap}
.q-chip.on{background:var(--pri);border-color:var(--pri);color:#fff}
.q-ib{width:34px;height:34px;border-radius:10px;border:0;background:var(--card);display:flex;align-items:center;justify-content:center;cursor:pointer;color:var(--text2);box-shadow:var(--shadow)}
.q-prog{height:4px;border-radius:2px;background:var(--card2);overflow:hidden;margin-bottom:12px}
.q-prog i{display:block;height:100%;background:var(--pri);transition:width .3s}
.q-stage{position:relative;touch-action:pan-y}
.q-card{background:var(--card);border-radius:18px;box-shadow:var(--shadow);padding:18px 16px 16px;will-change:transform,opacity}
.q-in-r{animation:qInR .26s cubic-bezier(.2,.8,.2,1)}
.q-in-l{animation:qInL .26s cubic-bezier(.2,.8,.2,1)}
@keyframes qInR{from{opacity:0;transform:translate3d(36px,0,0)}}
@keyframes qInL{from{opacity:0;transform:translate3d(-36px,0,0)}}
.q-meta{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:10px;font-size:12px;color:var(--text3)}
.q-type{padding:2px 8px;border-radius:6px;font-weight:700;color:#fff;font-size:12px}
.q-type.t-judge{background:#0ea5e9}.q-type.t-single{background:var(--pri)}.q-type.t-multi{background:#f97316}
.q-meta .q-wtag{color:var(--bad);font-weight:600}
.q-meta .q-rm{margin-left:auto;color:var(--pri);cursor:pointer;font-weight:600}
.q-text{font-size:var(--q-fs);line-height:1.65;font-weight:600;margin-bottom:12px;word-break:break-word}
.q-text .q-no{color:var(--pri);margin-right:4px}
.q-img{display:flex;justify-content:center;margin:4px 0 14px}
.q-img svg{max-width:min(100%,320px);height:auto;max-height:200px}
.q-opts{display:flex;flex-direction:column;gap:10px}
.q-opt{display:flex;align-items:center;gap:12px;width:100%;min-height:52px;padding:10px 14px;border-radius:14px;border:1.5px solid var(--line);background:var(--card);color:var(--text);text-align:left;cursor:pointer;font-size:calc(var(--q-fs) - 1px);line-height:1.45;transition:background .15s,border-color .15s,transform .08s}
.q-opt:hover{border-color:color-mix(in srgb,var(--pri) 45%,var(--line))}
.q-opt:active{transform:scale(.99)}
.q-opt i{flex:none;width:30px;height:30px;border-radius:50%;border:1.5px solid var(--line);display:flex;align-items:center;justify-content:center;font-style:normal;font-weight:700;font-size:14px;color:var(--text2);background:var(--card2);transition:.15s}
.q-opt span{flex:1;min-width:0;word-break:break-word}
.q-multi .q-opt i{border-radius:8px}
.q-opt.sel{border-color:var(--pri);background:var(--pri-bg)}
.q-opt.sel i{background:var(--pri);border-color:var(--pri);color:#fff}
.q-opt.right{border-color:var(--ok);background:var(--ok-bg)}
.q-opt.right i{background:var(--ok);border-color:var(--ok);color:#fff}
.q-opt.wrong{border-color:var(--bad);background:var(--bad-bg);animation:qShake .32s}
.q-opt.wrong i{background:var(--bad);border-color:var(--bad);color:#fff}
.q-opt.miss{border-style:dashed}
.q-locked .q-opt{cursor:default}
.q-locked .q-opt:active{transform:none}
@keyframes qShake{20%{transform:translateX(-5px)}40%{transform:translateX(5px)}60%{transform:translateX(-3px)}80%{transform:translateX(3px)}}
.q-confirm{margin-top:14px}
.q-hint{font-size:12px;color:var(--text3);margin-top:10px;text-align:center}
.q-res{margin-top:14px;padding:10px 14px;border-radius:12px;font-weight:700;display:flex;align-items:center;gap:8px;animation:fadeIn .2s}
.q-res.ok{background:var(--ok-bg);color:var(--ok)}.q-res.bad{background:var(--bad-bg);color:var(--bad)}
.q-exp{margin-top:12px;padding:12px 14px;border-radius:12px;background:var(--card2);font-size:calc(var(--q-fs) - 2px);line-height:1.7;color:var(--text2);animation:fadeIn .25s}
.q-exp h5{margin:0 0 4px;font-size:14px;color:var(--text);display:flex;align-items:center;gap:6px}
.q-exp h5::before{content:"";width:4px;height:14px;border-radius:2px;background:var(--warn)}
.q-exp .q-ak{color:var(--ok);font-weight:700}
.q-bar{position:fixed;left:0;right:0;bottom:calc(var(--tab-h) + var(--safe-b));z-index:25;display:flex;gap:6px;padding:8px 10px;background:color-mix(in srgb,var(--card) 94%,transparent);backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px);border-top:1px solid var(--line)}
.q-bar button{flex:1;height:44px;border:0;border-radius:12px;background:var(--card2);color:var(--text);font-weight:600;display:flex;align-items:center;justify-content:center;gap:4px;cursor:pointer;font-size:14px;white-space:nowrap;min-width:0}
.q-bar button:active{filter:brightness(.95)}
.q-bar button.pri{background:var(--pri);color:#fff}
.q-bar button[disabled]{opacity:.4}
.q-bar .q-star.on{color:#f5a623}
.q-bar .q-star.on .q-svg{fill:#f5a623}
@media (min-width:900px){.q-bar{left:var(--side-w);bottom:0}.q-bar>div{display:flex;gap:8px;width:100%;max-width:860px;margin:0 auto}}
.q-bar>div{display:flex;gap:6px;width:100%}
/* 答题卡 / 底部面板 */
.q-mask{position:fixed;inset:0;z-index:800;background:rgba(0,0,0,.42);animation:fadeIn .18s;display:flex;align-items:flex-end;justify-content:center}
.q-sheet{background:var(--card);width:100%;max-width:720px;max-height:78vh;border-radius:20px 20px 0 0;display:flex;flex-direction:column;animation:qUp .24s cubic-bezier(.2,.8,.2,1);padding-bottom:var(--safe-b)}
@media (min-width:900px){.q-mask{align-items:center}.q-sheet{border-radius:20px;max-height:80vh}}
@keyframes qUp{from{transform:translateY(60px);opacity:.3}}
.q-sh-h{display:flex;align-items:center;justify-content:space-between;padding:14px 18px 8px;font-weight:700;font-size:16px}
.q-sh-b{overflow:auto;padding:4px 18px 18px}
.q-legend{display:flex;gap:12px;flex-wrap:wrap;font-size:12px;color:var(--text3);margin-bottom:10px}
.q-legend i{display:inline-block;width:10px;height:10px;border-radius:3px;margin-right:4px;vertical-align:-1px}
.q-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(42px,1fr));gap:7px}
.q-cell{height:40px;border-radius:10px;border:1px solid var(--line);background:var(--card);color:var(--text2);font-weight:600;font-size:13px;cursor:pointer;padding:0}
.q-cell.s-ok{background:var(--ok);border-color:var(--ok);color:#fff}
.q-cell.s-bad{background:var(--bad);border-color:var(--bad);color:#fff}
.q-cell.s-ans{background:var(--pri);border-color:var(--pri);color:#fff}
.q-cell.s-pok{background:var(--ok-bg);color:var(--ok);border-color:transparent}
.q-cell.s-pbad{background:var(--bad-bg);color:var(--bad);border-color:transparent}
.q-cell.cur{box-shadow:0 0 0 2px var(--card),0 0 0 4px var(--warn)}
.q-setrow{display:flex;align-items:center;gap:12px;padding:12px 0;border-bottom:1px solid var(--line)}
.q-setrow:last-child{border-bottom:0}
.q-setrow .flex1 small{display:block;color:var(--text3);font-size:12px}
/* 考试 */
.q-intro{max-width:760px;margin:0 auto}
.q-idcard{display:flex;gap:18px;align-items:stretch;flex-wrap:wrap}
.q-photo{width:110px;flex:none;border-radius:10px;overflow:hidden;border:2px solid var(--line)}
.q-photo svg{display:block;width:100%;height:auto}
.q-info{flex:1;min-width:220px}
.q-info table{width:100%;border-collapse:collapse;font-size:14px}
.q-info td{padding:7px 6px;border-bottom:1px dashed var(--line)}
.q-info td:first-child{color:var(--text3);width:84px;white-space:nowrap}
.q-info td b{color:var(--text)}
.q-exam{height:100%;display:flex;flex-direction:column;background:var(--bg)}
.q-ex-top{flex:none;display:flex;align-items:center;gap:10px;padding:calc(8px + var(--safe-t)) 12px 8px;background:linear-gradient(90deg,#0b4fb3,#1677ff);color:#fff}
.q-ex-top .q-exn{flex:1;min-width:0;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.q-ex-top .q-exn small{opacity:.8;font-weight:400;margin-left:6px}
.q-timer{display:flex;align-items:center;gap:5px;font:700 20px/1 ui-monospace,SFMono-Regular,Menlo,monospace;background:rgba(0,0,0,.2);padding:6px 10px;border-radius:10px;letter-spacing:1px}
.q-timer.low{background:#e5383b;animation:qPulse 1s infinite}
@keyframes qPulse{50%{opacity:.7}}
.q-ex-top .btn{height:34px;padding:0 14px;border-radius:10px}
.q-ex-top .q-quit{background:rgba(255,255,255,.16);border:0;color:#fff}
.q-ex-body{flex:1;min-height:0;display:flex}
.q-ex-main{flex:1;min-width:0;display:flex;flex-direction:column}
.q-ex-scroll{flex:1;overflow:auto;padding:14px;-webkit-overflow-scrolling:touch}
.q-ex-scroll .q-card{max-width:860px;margin:0 auto}
.q-ex-nav{flex:none;display:flex;gap:8px;padding:8px 12px calc(8px + var(--safe-b));background:var(--card);border-top:1px solid var(--line)}
.q-ex-nav button{flex:1;height:46px;border:0;border-radius:12px;background:var(--card2);color:var(--text);font-weight:700;cursor:pointer;font-size:15px;display:flex;align-items:center;justify-content:center;gap:4px}
.q-ex-nav button.pri{background:var(--pri);color:#fff}
.q-ex-side{display:none;width:330px;flex:none;border-left:1px solid var(--line);background:var(--card);flex-direction:column;min-height:0}
.q-ex-side .q-me{display:flex;gap:12px;padding:14px;border-bottom:1px solid var(--line);align-items:center}
.q-ex-side .q-me .q-photo{width:60px}
.q-ex-side .q-sidegrid{flex:1;overflow:auto;padding:12px 14px}
.q-ex-side .q-grid{grid-template-columns:repeat(10,1fr);gap:4px}
.q-ex-side .q-cell{height:28px;font-size:11px;border-radius:6px}
@media (min-width:900px){.q-ex-side{display:flex}.q-ex-nav .q-cardbtn{display:none}}
@media (orientation:landscape) and (max-height:500px){.q-ex-scroll{padding:8px}.q-ex-top{padding-top:6px;padding-bottom:6px}.q-ex-nav button{height:38px}}
/* 成绩 */
.q-result{max-width:760px;margin:0 auto}
.q-res-hero{position:relative;text-align:center;padding:26px 16px 18px;overflow:hidden}
.q-score{font-size:72px;font-weight:900;line-height:1;letter-spacing:-2px}
.q-score small{font-size:20px;font-weight:700;letter-spacing:0;margin-left:2px}
.q-stamp{position:absolute;right:14px;top:14px;animation:qStamp .5s .9s both cubic-bezier(.3,1.6,.5,1)}
@keyframes qStamp{from{opacity:0;transform:scale(2.4) rotate(12deg)}}
@media (max-width:520px){.q-stamp{top:62px;right:6px;width:86px;height:86px}}
.q-rstats{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-top:18px}
.q-rstats div{background:var(--card2);border-radius:12px;padding:10px 4px}
.q-rstats b{display:block;font-size:20px}
.q-rstats span{font-size:12px;color:var(--text3)}
.q-bars .q-br{margin-bottom:12px}
.q-bars .q-br .row{font-size:13px;margin-bottom:4px}
.q-tips h4{margin:14px 0 6px;color:var(--pri)}
.q-tips .q-kou{background:linear-gradient(135deg,var(--warn-bg),var(--card2));border-left:4px solid var(--warn);border-radius:10px;padding:10px 12px;margin:8px 0;font-weight:700;line-height:1.8}
.q-tips ul{padding-left:20px;margin:6px 0}
.q-tips li{margin:3px 0}
.q-tips .tbl td:first-child{white-space:nowrap;font-weight:600}
.q-num{color:var(--bad);font-weight:800}
`;
    document.head.appendChild(st);
  }

  /* ---------------- 通用：底部面板 ---------------- */
  function openSheet(title, html, onMount) {
    closeSheet();
    const m = document.createElement('div'); m.className = 'q-mask';
    m.innerHTML = `<div class="q-sheet" role="dialog"><div class="q-sh-h"><span>${title}</span><button class="btn sm ghost" data-x>关闭</button></div><div class="q-sh-b">${html}</div></div>`;
    m.addEventListener('click', e => { if (e.target === m || e.target.closest('[data-x]')) closeSheet(); });
    document.body.appendChild(m); sheetEl = m;
    if (onMount) onMount(m);
    return m;
  }
  function closeSheet() { if (sheetEl) { sheetEl.remove(); sheetEl = null; } }

  function ring(pct, size, big, small) {
    const r = size / 2 - 7, C = 2 * Math.PI * r, c = size / 2;
    return `<svg class="q-ring" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}">
      <circle cx="${c}" cy="${c}" r="${r}" fill="none" stroke="rgba(255,255,255,.22)" stroke-width="9"/>
      <circle class="q-ring-fg" cx="${c}" cy="${c}" r="${r}" fill="none" stroke="#fff" stroke-width="9" stroke-linecap="round"
        stroke-dasharray="${C.toFixed(1)}" stroke-dashoffset="${C.toFixed(1)}" data-off="${(C * (1 - Math.min(100, pct) / 100)).toFixed(1)}" transform="rotate(-90 ${c} ${c})"/>
      <text x="${c}" y="${c + 2}" text-anchor="middle" fill="#fff" font-size="${size * 0.22}" font-weight="800">${big}</text>
      <text x="${c}" y="${c + size * 0.19}" text-anchor="middle" fill="rgba(255,255,255,.85)" font-size="${size * 0.105}">${small}</text></svg>`;
  }
  function animateRings(el) { requestAnimationFrame(() => requestAnimationFrame(() => $$('.q-ring-fg', el).forEach(c => c.style.strokeDashoffset = c.dataset.off))); }

  function trend(hist, W, H) {
    const pts = hist.slice(0, 20).reverse();
    if (pts.length < 2) return `<div class="muted small" style="padding:6px 0">完成 2 次以上模拟考试后显示成绩趋势</div>`;
    const pl = 26, pr = 8, pt = 10, pb = 18, lo = Math.max(0, Math.min(60, ...pts.map(p => p.score || 0)) - 10);
    const x = i => pl + i * (W - pl - pr) / (pts.length - 1);
    const y = v => pt + (100 - v) * (H - pt - pb) / (100 - lo);
    const line = pts.map((p, i) => `${x(i).toFixed(1)},${y(p.score || 0).toFixed(1)}`).join(' ');
    const area = `M${x(0)},${H - pb} L` + line.split(' ').join(' L') + ` L${x(pts.length - 1)},${H - pb} Z`;
    return `<svg class="q-trend" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">
      <defs><linearGradient id="qtg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="var(--pri)" stop-opacity=".28"/><stop offset="1" stop-color="var(--pri)" stop-opacity="0"/></linearGradient></defs>
      ${[100, 90, lo].map(v => `<text x="${pl - 4}" y="${y(v) + 3}" text-anchor="end" font-size="9" fill="var(--text3)">${Math.round(v)}</text>`).join('')}
      <line x1="${pl}" x2="${W - pr}" y1="${y(90)}" y2="${y(90)}" stroke="var(--ok)" stroke-dasharray="4 3" stroke-width="1"/>
      <path d="${area}" fill="url(#qtg)"/>
      <polyline points="${line}" fill="none" stroke="var(--pri)" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>
      ${pts.map((p, i) => `<circle cx="${x(i)}" cy="${y(p.score || 0)}" r="3.2" fill="${p.pass ? 'var(--ok)' : 'var(--bad)'}" stroke="var(--card)" stroke-width="1.5"/>`).join('')}
      <text x="${W - pr}" y="${H - 4}" text-anchor="end" font-size="9" fill="var(--text3)">最近 ${pts.length} 次</text>
    </svg>`;
  }

  function fillTrends(hist) {
    $$('.q-trendbox', root).forEach(b => { b.innerHTML = trend(hist, Math.max(240, Math.floor(b.clientWidth || 300)), +b.dataset.h || 130); });
  }
  function emptyState(msg, b, extra) {
    return `<div class="card q-empty fade-in">${ico('tips', 44)}<p style="margin-bottom:14px">${msg}</p>
      <div class="row" style="justify-content:center;gap:8px">${extra || ''}<a class="btn primary" href="#/${b}">返回${BANKS[b].name}</a></div></div>`;
  }

  /* =========================================================
   * 科目主页
   * ======================================================= */
  function hub(b, B) {
    const info = BANKS[b], s = stats(b, B), ex = info.exam;
    A.setTitle(info.full);
    const pct = s.total ? Math.round(s.done / s.total * 100) : 0;
    const tile = (mode, icon, color, title, sub, badge) =>
      `<div class="q-tile" data-go="${mode}"><div class="q-ti" style="background:${color}">${ico(icon)}</div><div style="min-width:0"><b>${title}</b><small>${sub}</small></div>${badge ? `<span class="badge">${badge > 99 ? '99+' : badge}</span>` : ''}</div>`;
    const tc = { judge: 0, single: 0, multi: 0 }; B.list.forEach(q => tc[q.type] = (tc[q.type] || 0) + 1);
    const last = s.hist[0];
    root.innerHTML = `<div class="q-hub fade-in">
      <div class="q-hero" style="background:${info.grad}">
        ${ring(pct, 104, pct + '%', '已练')}
        <div style="position:relative;z-index:1;min-width:0">
          <h2>${info.full}</h2>
          <div class="q-sub">题库 ${s.total} 题 · 已练 ${s.done} 题 · 正确率 ${s.done ? s.acc + '%' : '--'}</div>
          <div class="q-chips"><span>错题 ${s.wrong}</span><span>收藏 ${s.fav}</span><span>模考 ${s.hist.length} 次</span><span>最高 ${s.best == null ? '--' : s.best + ' 分'}</span></div>
        </div>
      </div>
      <div class="q-search">${ico('search', 20)}<input id="qSearch" type="search" placeholder="搜索题目关键词，如：高速 最低车速" autocomplete="off"></div>
      <div id="qSres"></div>
      <button class="q-exam-btn" data-go="exam"><div class="q-eico">${ico('exam', 28)}</div><div><b>模拟考试</b><small>全真考场 · ${ex.n} 题 · ${ex.min} 分钟 · ${ex.pass} 分及格${last ? ` · 上次 ${last.score} 分` : ''}</small></div><span class="q-go">›</span></button>
      <div class="q-tiles">
        ${tile('seq', 'seq', '#1677ff', '顺序练习', s.pos > 0 ? `继续第 ${s.pos + 1} 题` : `共 ${s.total} 题`)}
        ${tile('random', 'random', '#10b981', '随机练习', '打乱顺序刷题')}
        ${tile('chapter', 'chapter', '#0ea5e9', '章节练习', `${B.chapters.length} 个章节`)}
        ${tile('type', 'type', '#f59e0b', '专项练习', `判断${tc.judge} · 单选${tc.single}${tc.multi ? ' · 多选' + tc.multi : ''}`)}
        ${tile('wrong', 'wrong', '#e5383b', '错题本', s.wrong ? `${s.wrong} 道待攻克` : '暂无错题', s.wrong)}
        ${tile('fav', 'fav', '#f5a623', '我的收藏', `${s.fav} 题`)}
        ${tile('history', 'history', '#6366f1', '考试记录', s.hist.length ? `合格 ${s.passN}/${s.hist.length}` : '暂无记录')}
        ${tile('tips', 'tips', '#ec4899', '考前秘籍', '速记口诀 · 易错点')}
      </div>
      <div class="card">
        <div class="card-title">全真考场规则 <span class="tag blue">C1 小型汽车</span></div>
        <div class="q-rules">
          <div><b>${ex.n}</b><span>题</span></div><div><b>${ex.min}</b><span>分钟</span></div>
          <div><b>${100 / ex.n}</b><span>分/题</span></div><div><b>${ex.pass}</b><span>分及格</span></div>
        </div>
        ${b === 'k1'
          ? `<p class="small" style="margin:0;color:var(--text2)">题型为<b>判断题 + 单选题</b>（约 40 判断 + 60 单选），按章节比例随机抽题。答题后点击确认即不可修改；答错超过 <b class="q-num">10</b> 题即不合格，系统会提示是否继续。每次预约有 2 次考试机会，首次不合格可当场补考 1 次。</p>`
          : `<p class="small" style="margin:0;color:var(--text2)">题型为<b>判断题 20 + 单选题 20 + 多选题 10</b>，每题 2 分，多选题须全部选对才得分。答错超过 <b class="q-num">5</b> 题即不合格。科目四通常与科目三同日考试，合格后即可领取驾驶证。</p>`}
      </div>
      <div class="card">
        <div class="card-title">成绩趋势 <a class="small" href="#/quiz/${b}/history" style="font-weight:500">全部记录 ›</a></div>
        <div class="q-trendbox" data-h="130"></div>
      </div>
    </div>`;
    $$('[data-go]', root).forEach(n => n.onclick = () => A.go(`#/quiz/${b}/${n.dataset.go}`));
    animateRings(root); fillTrends(s.hist);
    // 搜索
    const inp = $('#qSearch', root), out = $('#qSres', root);
    let st = 0;
    inp.addEventListener('input', () => { clr(st); st = later(() => doSearch(B, inp.value, out), 180); });
  }

  function doSearch(B, val, out) {
    const kws = val.trim().split(/\s+/).filter(Boolean);
    if (!kws.length) { out.innerHTML = ''; return; }
    const hl = t => { let h = esc(t); kws.forEach(k => { h = h.replace(new RegExp(rxEsc(esc(k)), 'gi'), m => `<mark>${m}</mark>`); }); return h; };
    const res = B.list.filter(q => { const t = (q.q + ' ' + optsOf(q).join(' ')).toLowerCase(); return kws.every(k => t.includes(k.toLowerCase())); });
    out.innerHTML = `<div class="list q-sres">${res.length ? res.slice(0, 40).map(q => `
      <div class="q-si"><div class="row" style="align-items:flex-start;gap:8px"><span class="q-type t-${q.type}" style="flex:none">${TYPE_NAME[q.type][0]}</span><div class="flex1">${hl(q.q)}</div></div>
        <div class="q-sd">${imgHtml(q.img, 110)}${q.type !== 'judge' ? optsOf(q).map((o, i) => `<div>${LET[i]}. ${hl(o)}</div>`).join('') : ''}
          <div style="margin-top:6px"><b style="color:var(--ok)">答案：${ansText(q)}</b></div><div style="margin-top:4px">${nl(q.exp)}</div></div></div>`).join('')
      + (res.length > 40 ? `<div class="q-si muted small center">共 ${res.length} 条，仅显示前 40 条，请补充关键词</div>` : '')
      : `<div class="q-si muted center">没有找到包含"${esc(val)}"的题目</div>`}</div>`;
    $$('.q-si', out).forEach(n => n.onclick = () => n.classList.toggle('open'));
  }

  /* ---------------- 章节 / 专项 列表页 ---------------- */
  function chapterPage(b, B) {
    A.setTitle(BANKS[b].name + ' · 章节练习');
    const done = get(K.done(b), {});
    root.innerHTML = `<div class="q-hub fade-in"><div class="section-title">共 ${B.chapters.length} 个章节，点击进入练习（自动记住进度）</div><div class="list">
      ${B.chapters.map((c, i) => {
        const qs = B.list.filter(q => q.ch === c.id); if (!qs.length) return '';
        const d = qs.filter(q => q.id in done).length, ok = qs.filter(q => done[q.id] === 1).length;
        const p = Math.round(d / qs.length * 100);
        return `<div class="list-item" data-ch="${c.id}"><div class="q-chn">${i + 1}</div><div class="flex1"><div style="font-weight:600">${esc(c.name)}</div>
          <div class="small muted">共 ${qs.length} 题 · 已练 ${d} · 正确率 ${d ? Math.round(ok / d * 100) + '%' : '--'}</div>
          <div class="progress" style="margin-top:6px;height:6px"><i style="width:${p}%"></i></div></div><span class="arrow"></span></div>`;
      }).join('')}</div></div>`;
    $$('[data-ch]', root).forEach(n => n.onclick = () => A.go(`#/quiz/${b}/chapter/${n.dataset.ch}`));
  }

  function typePage(b, B) {
    A.setTitle(BANKS[b].name + ' · 专项练习');
    const c = t => B.list.filter(q => q.type === t).length;
    const wa = get(K.wall(b), {}); const hardN = B.list.filter(q => wa[q.id]).length;
    const items = [
      ['judge', '判断题', '#0ea5e9', `${c('judge')} 题 · 对错二选一`, c('judge')],
      ['single', '单选题', '#1677ff', `${c('single')} 题 · 四选一`, c('single')],
      ['multi', '多选题', '#f97316', `${c('multi')} 题 · 全对才得分`, c('multi')],
      ['img', '图片题', '#10b981', `${B.list.filter(q => q.img).length} 题 · 标志标线指示灯`, B.list.filter(q => q.img).length],
      ['hard', '易错题', '#e5383b', hardN ? `${hardN} 题 · 按答错次数排序` : '数字类易混题', 1]
    ].filter(x => x[4] > 0);
    root.innerHTML = `<div class="q-hub fade-in"><div class="section-title">按题型集中突破</div><div class="list">
      ${items.map(([k, n, col, d]) => `<div class="list-item" data-t="${k}"><div class="ico" style="background:${col}">${n[0]}</div><div class="flex1"><div style="font-weight:600">${n}</div><div class="small muted">${d}</div></div><span class="arrow"></span></div>`).join('')}
    </div></div>`;
    $$('[data-t]', root).forEach(n => n.onclick = () => A.go(`#/quiz/${b}/type/${n.dataset.t}`));
  }

  function historyPage(b, B) {
    A.setTitle(BANKS[b].name + ' · 考试记录');
    const h = A.history(b);
    const avg = h.length ? Math.round(h.reduce((a, x) => a + (x.score || 0), 0) / h.length) : 0;
    root.innerHTML = `<div class="q-hub fade-in">
      <div class="card"><div class="q-rules" style="margin:0">
        <div><b>${h.length}</b><span>考试次数</span></div><div><b>${h.length ? Math.max(...h.map(x => x.score || 0)) : '--'}</b><span>最高分</span></div>
        <div><b>${h.length ? avg : '--'}</b><span>平均分</span></div><div><b>${h.length ? Math.round(h.filter(x => x.pass).length / h.length * 100) + '%' : '--'}</b><span>合格率</span></div></div></div>
      <div class="card"><div class="card-title">成绩趋势</div><div class="q-trendbox" data-h="150"></div></div>
      ${h.length ? `<div class="card"><div class="card-title">历史成绩</div>${h.map(x => `<div class="q-hrow"><div class="q-hs" style="color:${x.pass ? 'var(--ok)' : 'var(--bad)'}">${x.score}</div>
        <div class="flex1"><div><span class="tag ${x.pass ? 'green' : 'red'}">${x.pass ? '合格' : '不合格'}</span> <span class="small muted">${fmtDate(x.t)}</span></div>
        <div class="small muted">${x.used != null ? '用时 ' + fmtT(x.used) : ''}${x.wrong != null ? ' · 答错 ' + x.wrong + ' 题' : ''}${x.total ? ' · 共 ' + x.total + ' 题' : ''}</div></div></div>`).join('')}</div>`
        : emptyState('还没有考试记录，去参加一次模拟考试吧！', b, `<a class="btn" href="#/quiz/${b}/exam">模拟考试</a>`)}
    </div>`;
    fillTrends(h);
  }

  /* =========================================================
   * 练习会话
   * ======================================================= */
  function buildPractice(b, B, mode, arg) {
    const L = B.list;
    let qs = [], title = '', start = 0, posKey = null, empty = '';
    if (mode === 'seq') { qs = L.slice(); title = '顺序练习'; start = Math.min(get(K.pos(b), 0), qs.length - 1); posKey = 'seq'; }
    else if (mode === 'random') { qs = shuffle(L.slice()); title = '随机练习'; }
    else if (mode === 'chapter') {
      const ch = B.chapters.find(c => c.id === arg); if (!ch) return null;
      qs = L.filter(q => q.ch === arg); title = ch.name; posKey = 'ch:' + arg;
      start = Math.min(get(K.chpos(b), {})[arg] || 0, Math.max(0, qs.length - 1));
    } else if (mode === 'type') {
      if (arg === 'judge' || arg === 'single' || arg === 'multi') { qs = L.filter(q => q.type === arg); title = TYPE_NAME[arg] + '专项'; }
      else if (arg === 'img') { qs = L.filter(q => q.img); title = '图片题专项'; }
      else if (arg === 'hard') {
        const wa = get(K.wall(b), {});
        qs = L.filter(q => wa[q.id]).sort((x, y) => wa[y.id] - wa[x.id]).slice(0, 150); title = '易错题';
        if (!qs.length) { qs = L.filter(q => /\d/.test(q.q + optsOf(q).join(''))); title = '数字类易混题'; }
      } else return null;
      empty = '该题型暂无题目';
    } else if (mode === 'wrong') {
      const w = get(K.wrong(b), {}); qs = L.filter(q => w[q.id]).sort((x, y) => w[y.id] - w[x.id]); title = '错题本';
      empty = '太棒了，错题本是空的！练习中答错的题会自动收录到这里。';
    } else if (mode === 'fav') {
      const f = get(K.fav(b), {}); qs = L.filter(q => f[q.id]).sort((x, y) => f[y.id] - f[x.id]); title = '我的收藏';
      empty = '还没有收藏题目。练习时点击底部的"收藏"即可加入。';
    } else return null;
    return { qs, title, start, posKey, empty };
  }

  function startPractice(b, B, mode, arg) {
    const P = buildPractice(b, B, mode, arg);
    if (!P) { if (mode === 'chapter') return chapterPage(b, B); if (mode === 'type') return typePage(b, B); return hub(b, B); }
    A.setTitle(BANKS[b].name + ' · ' + P.title);
    if (!P.qs.length) { root.innerHTML = emptyState(P.empty || '暂无题目', b); return; }
    SES = { kind: 'practice', b, B, mode, arg, title: P.title, qs: P.qs, idx: Math.max(0, P.start), ans: {}, pend: '', okN: 0, badN: 0, posKey: P.posKey, advT: 0 };
    if (P.start > 0) A.toast(`已从第 ${P.start + 1} 题继续`);
    practiceShell();
    renderCard(0);
  }

  function practiceShell() {
    const S = SES, review = S.kind === 'review';
    root.innerHTML = `<div class="q-practice q-fs-${cfg.fs}">
      <div class="q-head">
        <div class="q-tt">${esc(S.title)}</div>
        ${review ? `<button class="q-chip" data-a="back">返回成绩</button>` : `<div class="q-cnt"><span class="ok">✓ <b id="qOk">0</b></span><span class="bad">✗ <b id="qBad">0</b></span></div>
        <button class="q-chip ${cfg.memo ? 'on' : ''}" data-a="memo" title="直接显示答案和解析">背题</button>`}
        <button class="q-ib" data-a="set" aria-label="设置">${ico('gear', 18)}</button>
      </div>
      <div class="q-prog"><i id="qProg"></i></div>
      <div class="q-stage" id="qStage"></div>
      <div class="q-bar"><div>
        <button data-a="prev">${ico('left', 18)}上一题</button>
        ${review ? '' : `<button data-a="fav" class="q-star">${ico('fav', 18)}<span>收藏</span></button>`}
        <button data-a="card">${ico('grid', 16)}<span id="qPos">1/1</span></button>
        <button data-a="next" class="pri">下一题${ico('right', 18)}</button>
      </div></div>
    </div>`;
    bindCommon();
  }

  function bindCommon() {
    root.addEventListener('click', onRootClick);
    const stage = $('#qStage', root);
    let sx = 0, sy = 0, st = 0, track = false;
    stage.addEventListener('touchstart', e => { if (e.touches.length !== 1) return; sx = e.touches[0].clientX; sy = e.touches[0].clientY; st = Date.now(); track = true; }, { passive: true });
    stage.addEventListener('touchend', e => {
      if (!track) return; track = false;
      const t = e.changedTouches[0], dx = t.clientX - sx, dy = t.clientY - sy;
      if (Math.abs(dx) > 60 && Math.abs(dy) < Math.abs(dx) * 0.6 && Date.now() - st < 700) { dx < 0 ? next() : prev(); }
    }, { passive: true });
  }

  function onRootClick(e) {
    const S = SES; if (!S) return;
    const opt = e.target.closest('.q-opt');
    if (opt && root.contains(opt)) { choose(+opt.dataset.i); return; }
    const a = e.target.closest('[data-a]'); if (!a) return;
    const act = a.dataset.a;
    if (act === 'prev') prev();
    else if (act === 'next') next();
    else if (act === 'confirm') confirmMulti();
    else if (act === 'card') openCard();
    else if (act === 'fav') toggleFav();
    else if (act === 'set') openSettings();
    else if (act === 'memo') { cfg.memo = !cfg.memo; saveCfg(); a.classList.toggle('on', cfg.memo); A.toast(cfg.memo ? '背题模式：直接显示答案' : '已切换为答题模式'); renderCard(0); }
    else if (act === 'rmwrong') {
      const q = S.qs[S.idx], w = get(K.wrong(S.b), {}); delete w[q.id]; put(K.wrong(S.b), w); A.toast('已移出错题本'); renderCard(0);
    }
    else if (act === 'back' && S.result) showResult(S.result);
    else if (act === 'submit') submitExam(false);
    else if (act === 'quit') quitExam();
  }

  function isLocked(S, q) {
    const a = S.ans[q.id];
    if (S.kind === 'review') return true;
    if (S.kind === 'practice') return cfg.memo || !!a;
    return !!a && cfg.examInstant; // exam
  }

  function renderCard(dir) {
    const S = SES; if (!S) return;
    const q = S.qs[S.idx], key = keyOf(q), a = S.ans[q.id], opts = optsOf(q);
    const exam = S.kind === 'exam', locked = isLocked(S, q);
    const reveal = S.kind === 'review' || (S.kind === 'practice' && (cfg.memo || a)) || (exam && a && cfg.examInstant);
    const chosen = a ? a.sel : (q.type === 'multi' ? S.pend : '');
    const cls = i => {
      const L = LET[i], isKey = key.includes(L), isSel = chosen.includes(L);
      if (reveal) {
        if (a) { if (isKey) return 'right' + (isSel || q.type !== 'multi' ? '' : ' miss'); if (isSel) return 'wrong'; return ''; }
        return isKey ? 'right' : '';
      }
      return isSel ? 'sel' : '';
    };
    const w = S.kind === 'practice' && S.mode === 'wrong' ? get(K.wrong(S.b), {})[q.id] : 0;
    const per = exam ? Math.round(100 / S.qs.length * 10) / 10 : 0;
    let tail = '';
    if (q.type === 'multi' && !locked && !(exam && !cfg.examInstant)) tail += `<button class="btn primary block lg q-confirm" data-a="confirm" ${S.pend ? '' : 'disabled'}>确认答案${A.isTouch() ? '' : ' <span class="kbd" style="color:var(--text)">Enter</span>'}</button>`;
    if (q.type === 'multi' && !locked && exam && !cfg.examInstant) tail += `<div class="q-hint">多选题：选出全部正确答案，交卷前可随时修改</div>`;
    if (a && (S.kind === 'practice' || S.kind === 'review' || (exam && cfg.examInstant))) {
      tail += a.ok ? `<div class="q-res ok">✓ 回答正确</div>` : `<div class="q-res bad">✗ 回答错误${a.sel ? `，你的答案：${q.type === 'judge' ? (a.sel === 'A' ? '正确' : '错误') : a.sel}` : '（未作答）'}，正确答案：${ansText(q)}</div>`;
    } else if (S.kind === 'review' && !a) tail += `<div class="q-res bad">未作答 · 正确答案：${ansText(q)}</div>`;
    if (reveal && !exam && q.exp) tail += `<div class="q-exp"><h5>试题解析</h5><div><span class="q-ak">答案：${ansText(q)}</span>　${nl(q.exp)}</div></div>`;
    const stage = exam ? $('#qStage', root) : $('#qStage', root);
    stage.innerHTML = `<div class="q-card ${dir > 0 ? 'q-in-r' : dir < 0 ? 'q-in-l' : ''} ${locked ? 'q-locked' : ''} ${q.type === 'multi' ? 'q-multi' : ''}">
      <div class="q-meta"><span class="q-type t-${q.type}">${TYPE_NAME[q.type]}</span>
        <span>${exam ? `第 ${S.idx + 1} 题 / 共 ${S.qs.length} 题 · 本题 ${per} 分` : esc(chName(S.B, q.ch))}</span>
        ${w ? `<span class="q-wtag">已错 ${w} 次</span><span class="q-rm" data-a="rmwrong">移出错题本</span>` : ''}</div>
      <div class="q-text"><span class="q-no">${S.idx + 1}.</span>${esc(q.q)}</div>
      ${imgHtml(q.img, 160)}
      <div class="q-opts">${opts.map((o, i) => `<button class="q-opt ${cls(i)}" data-i="${i}"><i>${LET[i]}</i><span>${esc(o)}</span></button>`).join('')}</div>
      ${tail}
    </div>`;
    updateChrome();
    if (exam) { const sc = $('.q-ex-scroll', root); if (sc && dir) sc.scrollTop = 0; }
    else if (dir) { const top = stage.getBoundingClientRect().top; if (top < 60 || top > innerHeight * 0.5) window.scrollTo({ top: Math.max(0, window.scrollY + top - 70), behavior: 'auto' }); }
    // 保存顺序 / 章节位置
    if (S.kind === 'practice' && S.posKey) {
      if (S.posKey === 'seq') put(K.pos(S.b), S.idx);
      else { const m = get(K.chpos(S.b), {}); m[S.arg] = S.idx; put(K.chpos(S.b), m); }
    }
  }

  function updateChrome() {
    const S = SES; if (!S) return;
    const q = S.qs[S.idx];
    const pos = $('#qPos', root); if (pos) pos.textContent = `${S.idx + 1}/${S.qs.length}`;
    const pg = $('#qProg', root); if (pg) pg.style.width = ((S.idx + 1) / S.qs.length * 100) + '%';
    const okE = $('#qOk', root), badE = $('#qBad', root); if (okE) okE.textContent = S.okN; if (badE) badE.textContent = S.badN;
    const pv = $('[data-a=prev]', root), nx = $('[data-a=next]', root);
    if (pv) pv.disabled = S.idx === 0;
    if (nx && S.kind !== 'exam') nx.disabled = S.idx >= S.qs.length - 1 && S.kind === 'review';
    const fav = $('[data-a=fav]', root);
    if (fav) { const on = !!get(K.fav(S.b), {})[q.id]; fav.classList.toggle('on', on); fav.querySelector('span').textContent = on ? '已收藏' : '收藏'; }
    if (S.kind === 'exam') updateExamChrome();
  }

  function choose(i) {
    const S = SES; if (!S) return;
    const q = S.qs[S.idx]; if (i < 0 || i >= optsOf(q).length) return;
    if (isLocked(S, q)) return;
    const L = LET[i];
    if (q.type === 'multi') {
      if (S.kind === 'exam' && !cfg.examInstant) {
        const cur = S.ans[q.id] ? S.ans[q.id].sel : '';
        const nv = (cur.includes(L) ? cur.replace(L, '') : cur + L).split('').sort().join('');
        if (nv) S.ans[q.id] = { sel: nv }; else delete S.ans[q.id];
      } else S.pend = (S.pend.includes(L) ? S.pend.replace(L, '') : S.pend + L).split('').sort().join('');
      A.beep('click'); renderCard(0); return;
    }
    commit(L);
  }
  function confirmMulti() {
    const S = SES; if (!S) return;
    const q = S.qs[S.idx];
    if (q.type !== 'multi' || isLocked(S, q) || !S.pend) return;
    if (S.kind === 'exam' && !cfg.examInstant) return;
    commit(S.pend);
  }
  function commit(sel) {
    const S = SES, q = S.qs[S.idx], ok = sel === keyOf(q);
    clr(S.advT); S.pend = '';
    if (S.kind === 'practice') {
      S.ans[q.id] = { sel, ok }; ok ? S.okN++ : S.badN++;
      const removed = recordAnswer(S.b, q, ok);
      if (ok) A.beep('ok'); else { A.beep('bad'); A.vibrate(60); }
      renderCard(0);
      if (removed && S.mode === 'wrong') A.toast('答对 ' + cfg.removeAfter + ' 次，已移出错题本');
      if (ok && cfg.autoNext) {
        if (S.idx < S.qs.length - 1) S.advT = later(() => { if (SES === S) next(); }, 650);
        else S.advT = later(() => { if (SES === S) finishRound(); }, 650);
      } else if (S.idx === S.qs.length - 1 && Object.keys(S.ans).length >= S.qs.length) S.advT = later(() => { if (SES === S) finishRound(); }, 1200);
      return;
    }
    if (S.kind === 'exam') {
      if (cfg.examInstant) {
        S.ans[q.id] = { sel, ok };
        if (ok) { A.beep('click'); renderCard(0); S.advT = later(() => { if (SES === S) examAdvance(); }, 380); }
        else {
          A.beep('bad'); A.vibrate(80); renderCard(0);
          const wn = Object.values(S.ans).filter(x => !x.ok).length;
          if (wn > S.maxWrong && !S.warned) {
            S.warned = true;
            A.modal({
              title: '成绩不合格', closable: false,
              html: `<p style="font-size:16px;color:var(--text)">您已答错 <b class="q-num">${wn}</b> 题，本次考试成绩<b class="q-num">不合格</b>！</p><p>是否继续答题？（继续答题仅用于练习，不影响结果）</p>`,
              buttons: [{ text: '立即交卷', danger: true, onClick: () => { finishExam(); } }, { text: '继续答题', primary: true }]
            });
          }
        }
      } else {
        S.ans[q.id] = { sel }; A.beep('click'); renderCard(0);
        S.advT = later(() => { if (SES === S) examAdvance(); }, 300);
      }
    }
  }

  function next() {
    const S = SES; if (!S) return; clr(S.advT);
    if (S.idx < S.qs.length - 1) { S.idx++; S.pend = ''; renderCard(1); }
    else if (S.kind === 'practice') finishRound();
    else if (S.kind === 'exam') { const u = S.qs.filter(q => !S.ans[q.id]).length; if (u) { A.toast(`已是最后一题，还有 ${u} 题未答`); openCard(); } else submitExam(false); }
    else A.toast('已经是最后一题了');
  }
  function prev() { const S = SES; if (!S) return; clr(S.advT); if (S.idx > 0) { S.idx--; S.pend = ''; renderCard(-1); } else A.toast('已经是第一题了'); }
  function jump(i) { const S = SES; if (!S) return; clr(S.advT); const d = i > S.idx ? 1 : i < S.idx ? -1 : 0; S.idx = i; S.pend = ''; renderCard(d); }

  function finishRound() {
    const S = SES; if (!S || S.kind !== 'practice') return;
    const answered = Object.keys(S.ans).length;
    const left = S.qs.length - answered;
    A.modal({
      title: left ? '已到最后一题' : '本轮练习完成',
      html: `<div class="q-rules" style="margin:6px 0 0;grid-template-columns:repeat(3,1fr)"><div><b>${answered}</b><span>本次作答</span></div><div><b style="color:var(--ok)">${S.okN}</b><span>答对</span></div><div><b style="color:var(--bad)">${S.badN}</b><span>答错</span></div></div>
        ${left ? `<p class="small">还有 ${left} 题本次未作答。</p>` : `<p class="small">正确率 ${answered ? Math.round(S.okN / answered * 100) : 0}%，${S.badN ? '答错的题已自动加入错题本。' : '全部答对，太厉害了！'}</p>`}`,
      buttons: [
        { text: '从头再来', onClick: () => { if (S.posKey === 'seq') put(K.pos(S.b), 0); S.ans = {}; S.okN = S.badN = 0; S.idx = 0; renderCard(-1); } },
        S.badN ? { text: '练错题', primary: true, onClick: () => A.go(`#/quiz/${S.b}/wrong`) } : { text: '返回', primary: true, onClick: () => A.go('#/' + S.b) }
      ]
    });
  }

  function toggleFav() {
    const S = SES; const q = S.qs[S.idx]; const f = get(K.fav(S.b), {});
    if (f[q.id]) { delete f[q.id]; A.toast('已取消收藏'); } else { f[q.id] = Date.now(); A.toast('已收藏'); A.beep('ding'); }
    put(K.fav(S.b), f); updateChrome();
  }

  function cellState(S, q) {
    const a = S.ans[q.id];
    if (S.kind === 'exam') {
      if (!a) return '';
      if (cfg.examInstant) return a.ok ? 's-ok' : 's-bad';
      return 's-ans';
    }
    if (a) return a.ok ? 's-ok' : 's-bad';
    if (S.kind === 'review') return 's-bad';
    const d = get(K.done(S.b), {})[q.id];
    return d === 1 ? 's-pok' : d === 0 ? 's-pbad' : '';
  }
  function gridHtml(S) {
    const done = S.kind === 'practice' ? get(K.done(S.b), {}) : null;
    return `<div class="q-grid">${S.qs.map((q, i) => {
      let c = '';
      const a = S.ans[q.id];
      if (S.kind === 'practice' && !a) { const d = done[q.id]; c = d === 1 ? 's-pok' : d === 0 ? 's-pbad' : ''; }
      else c = cellState(S, q);
      return `<button class="q-cell ${c} ${i === S.idx ? 'cur' : ''}" data-j="${i}">${i + 1}</button>`;
    }).join('')}</div>`;
  }
  function openCard() {
    const S = SES; if (!S) return;
    const ans = Object.values(S.ans);
    const legend = S.kind === 'exam'
      ? (cfg.examInstant ? `<span><i style="background:var(--ok)"></i>答对</span><span><i style="background:var(--bad)"></i>答错</span>` : `<span><i style="background:var(--pri)"></i>已答</span>`) + `<span><i style="border:1px solid var(--line)"></i>未答 ${S.qs.length - ans.length}</span>`
      : `<span><i style="background:var(--ok)"></i>本次答对 ${ans.filter(x => x.ok).length}</span><span><i style="background:var(--bad)"></i>本次答错 ${ans.filter(x => !x.ok).length}</span>${S.kind === 'practice' ? `<span><i style="background:var(--ok-bg)"></i><i style="background:var(--bad-bg)"></i>历史记录</span>` : ''}`;
    openSheet(`答题卡 <span class="muted small" style="font-weight:400">${S.idx + 1}/${S.qs.length}</span>`,
      `<div class="q-legend">${legend}</div>${gridHtml(S)}${S.kind === 'exam' ? `<button class="btn danger block" style="margin-top:14px" data-sub>交卷</button>` : ''}`,
      m => {
        m.addEventListener('click', e => {
          const c = e.target.closest('[data-j]'); if (c) { closeSheet(); jump(+c.dataset.j); }
          if (e.target.closest('[data-sub]')) { closeSheet(); submitExam(false); }
        });
        const cur = m.querySelector('.q-cell.cur'); if (cur) cur.scrollIntoView({ block: 'center' });
      });
  }

  function openSettings() {
    const sw = (k, on) => `<label class="switch"><input type="checkbox" data-k="${k}" ${on ? 'checked' : ''}><span></span></label>`;
    const seg = (k, opts) => `<div class="seg" data-seg="${k}">${opts.map(([v, n]) => `<button data-v="${v}" class="${String(cfg[k]) === String(v) ? 'on' : ''}">${n}</button>`).join('')}</div>`;
    openSheet('练习设置', `
      <div class="q-setrow"><div class="flex1">答对自动跳转下一题<small>答对后约 0.6 秒进入下一题</small></div>${sw('autoNext', cfg.autoNext)}</div>
      <div class="q-setrow"><div class="flex1">错题移出规则<small>错题答对几次后自动移出错题本</small></div>${seg('removeAfter', [[1, '1次'], [2, '2次'], [3, '3次']])}</div>
      <div class="q-setrow"><div class="flex1">题目字号</div>${seg('fs', [['s', '小'], ['m', '中'], ['l', '大']])}</div>
      <div class="q-setrow"><div class="flex1">答错立即提示（真实考场模式）<small>模拟考试中确认答案后，答错立即显示正确答案</small></div>${sw('examInstant', cfg.examInstant)}</div>
      <div class="q-setrow"><div class="flex1">答题音效</div>${sw('sound', A.settings.sound)}</div>
      ${A.isTouch() ? '<p class="small muted" style="margin-top:10px">小技巧：在题目区域左右滑动可切换上一题 / 下一题。</p>'
        : '<p class="small muted" style="margin-top:10px">键盘快捷键：<span class="kbd">1</span>-<span class="kbd">4</span> 或 <span class="kbd">A</span>-<span class="kbd">D</span> 选择，<span class="kbd">←</span><span class="kbd">→</span> 切换题目，<span class="kbd">Enter</span> 确认多选 / 下一题，<span class="kbd">S</span> 收藏。</p>'}`,
      m => {
        $$('input[data-k]', m).forEach(i => i.onchange = () => {
          const k = i.dataset.k;
          if (k === 'sound') { A.settings.sound = i.checked; A.saveSettings && A.saveSettings(); }
          else { cfg[k] = i.checked; saveCfg(); if (k === 'examInstant' && SES && SES.kind === 'exam') A.toast('将在下次考试生效'); }
        });
        $$('[data-seg]', m).forEach(g => $$('button', g).forEach(bt => bt.onclick = () => {
          const k = g.dataset.seg; cfg[k] = k === 'removeAfter' ? +bt.dataset.v : bt.dataset.v; saveCfg();
          $$('button', g).forEach(x => x.classList.toggle('on', x === bt));
          if (k === 'fs') { const p = $('.q-practice', root); if (p) { p.classList.remove('q-fs-s', 'q-fs-m', 'q-fs-l'); p.classList.add('q-fs-' + cfg.fs); } const e = $('.q-exam', root); if (e) { e.classList.remove('q-fs-s', 'q-fs-m', 'q-fs-l'); e.classList.add('q-fs-' + cfg.fs); } }
        }));
      });
  }

  function onKey(e) {
    const S = SES; if (!S) return;
    if (e.target && /INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) return;
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (document.querySelector('.modal-mask')) return;
    const k = e.key;
    if (sheetEl) { if (k === 'Escape') closeSheet(); return; }
    let i = -1;
    if (/^[1-8]$/.test(k)) i = +k - 1;
    else if (/^[a-hA-H]$/.test(k) && !(k === 's' || k === 'S')) i = LET.indexOf(k.toUpperCase());
    if (i >= 0) { e.preventDefault(); choose(i); return; }
    if (k === 'ArrowRight' || k === 'PageDown') { e.preventDefault(); next(); }
    else if (k === 'ArrowLeft' || k === 'PageUp') { e.preventDefault(); prev(); }
    else if (k === 'Enter' || k === ' ') {
      e.preventDefault();
      const q = S.qs[S.idx];
      if (q.type === 'multi' && S.pend && !isLocked(S, q)) confirmMulti(); else next();
    } else if ((k === 's' || k === 'S') && S.kind === 'practice') toggleFav();
  }

  /* =========================================================
   * 模拟考试
   * ======================================================= */
  const PHOTO = `<svg viewBox="0 0 120 150"><rect width="120" height="150" fill="#dfe6ee"/><circle cx="60" cy="58" r="25" fill="#9aa6b5"/><path d="M12 150c3-33 23-50 48-50s45 17 48 50z" fill="#9aa6b5"/><path d="M48 100l12 18 12-18" fill="#dfe6ee"/></svg>`;

  function alloc(n, sizes) {
    const total = sizes.reduce((a, x) => a + x, 0); if (!total) return sizes.map(() => 0);
    n = Math.min(n, total);
    const raw = sizes.map(s => n * s / total), cnt = raw.map(Math.floor);
    let rem = n - cnt.reduce((a, x) => a + x, 0);
    raw.map((r, i) => [r - Math.floor(r), i]).sort((x, y) => y[0] - x[0]).forEach(([, i]) => { if (rem > 0 && cnt[i] < sizes[i]) { cnt[i]++; rem--; } });
    for (let i = 0; rem > 0 && i < sizes.length; i++) while (rem > 0 && cnt[i] < sizes[i]) { cnt[i]++; rem--; }
    return cnt;
  }
  function composeExam(B, ex) {
    const n = Math.min(ex.n, B.list.length);
    const types = Object.keys(ex.mix);
    const pool = t => B.list.filter(q => q.type === t);
    const pools = {}; types.forEach(t => pools[t] = pool(t));
    const want = {}; types.forEach(t => want[t] = Math.min(ex.mix[t], pools[t].length));
    let need = n - types.reduce((a, t) => a + want[t], 0);
    let prog = true;
    while (need > 0 && prog) { prog = false; for (const t of types) if (need > 0 && want[t] < pools[t].length) { want[t]++; need--; prog = true; } }
    const extra = B.list.filter(q => !types.includes(q.type));
    const out = [];
    types.forEach(t => {
      const chs = [...new Set(pools[t].map(q => q.ch))];
      const groups = chs.map(c => shuffle(pools[t].filter(q => q.ch === c)));
      const cnt = alloc(want[t], groups.map(g => g.length));
      out.push(...shuffle(groups.flatMap((g, i) => g.slice(0, cnt[i]))));
    });
    if (need > 0) out.push(...shuffle(extra).slice(0, need));
    return out;
  }

  function examIntro(b, B) {
    const info = BANKS[b], ex = info.exam;
    A.setTitle(info.name + ' · 模拟考试');
    const name = get('quiz_name', '') || '学员';
    const room = '第 ' + (1 + Math.floor(Math.random() * 6)) + ' 考场', seat = String(1 + Math.floor(Math.random() * 60)).padStart(2, '0');
    root.innerHTML = `<div class="q-intro fade-in">
      <div class="card">
        <div class="card-title">考生信息确认 <span class="tag blue">全真模拟</span></div>
        <div class="q-idcard">
          <div class="q-photo">${PHOTO}</div>
          <div class="q-info"><table>
            <tr><td>考生姓名</td><td><input id="qName" value="${esc(name)}" maxlength="10" style="width:120px;border:1px solid var(--line);border-radius:8px;padding:3px 8px;background:var(--card2);color:var(--text);font:inherit"></td></tr>
            <tr><td>考场 / 座位</td><td><b>${room} · ${seat} 号机</b></td></tr>
            <tr><td>考试科目</td><td><b>${info.full}</b></td></tr>
            <tr><td>考试车型</td><td><b>C1 小型汽车</b></td></tr>
            <tr><td>考试题量</td><td><b>${Math.min(ex.n, B.list.length)} 题</b>（${b === 'k1' ? '判断题 + 单选题' : '判断题 + 单选题 + 多选题'}）</td></tr>
            <tr><td>考试时间</td><td><b>${ex.min} 分钟</b></td></tr>
            <tr><td>合格标准</td><td><b>满分 100 分，${ex.pass} 分合格</b></td></tr>
          </table></div>
        </div>
      </div>
      <div class="card">
        <div class="card-title">考试须知</div>
        <ul class="small" style="padding-left:18px;margin:0;color:var(--text2);line-height:1.9">
          <li>单选 / 判断题点击选项即确认作答${b === 'k4' ? '；多选题选择全部正确选项后点"确认答案"' : ''}。</li>
          <li>考试时间到系统将自动交卷；剩余 5 分钟时计时器变红提醒。</li>
          <li>答错超过 ${Math.floor(Math.min(ex.n, B.list.length) * (100 - ex.pass) / 100)} 题即判定不合格，系统将提示是否继续。</li>
          <li>考试中请勿刷新或离开页面，否则本次成绩作废。</li>
        </ul>
        <div class="q-setrow" style="margin-top:6px"><div class="flex1">答错立即提示（真实考场模式）<small>确认答案后若答错，立即显示正确答案，答案不可修改</small></div><label class="switch"><input type="checkbox" id="qInstant" ${cfg.examInstant ? 'checked' : ''}><span></span></label></div>
      </div>
      <button class="btn primary lg block" id="qStart">开始考试</button>
      <p class="center small muted">按真实考场规则随机组卷 · 成绩将记录到"考试记录"</p>
    </div>`;
    $('#qInstant', root).onchange = e => { cfg.examInstant = e.target.checked; saveCfg(); };
    $('#qStart', root).onclick = () => { put('quiz_name', ($('#qName', root).value || '').trim()); startExam(b, B); };
  }

  function startExam(b, B) {
    const info = BANKS[b], ex = info.exam;
    const qs = composeExam(B, ex);
    if (!qs.length) { root.innerHTML = emptyState('题库为空，无法组卷', b); return; }
    const dur = ex.min * 60;
    SES = { kind: 'exam', b, B, title: info.name + info.label, qs, idx: 0, ans: {}, pend: '', okN: 0, badN: 0, t0: Date.now(), dur, end: Date.now() + dur * 1000, maxWrong: Math.floor(qs.length * (100 - ex.pass) / 100), warned: false, advT: 0 };
    A.immersive(true);
    const name = get('quiz_name', '') || '学员';
    root.innerHTML = `<div class="q-exam q-fs-${cfg.fs}">
      <div class="q-ex-top">
        <button class="btn sm q-quit" data-a="quit">退出</button>
        <div class="q-exn">${info.name} · ${info.label}<small>C1 · ${qs.length} 题</small></div>
        <div class="q-timer" id="qTimer">${ico('clock', 18)}<span>${fmtT(dur)}</span></div>
        <button class="btn sm danger" data-a="submit">交卷</button>
      </div>
      <div class="q-ex-body">
        <div class="q-ex-main">
          <div class="q-ex-scroll"><div class="q-stage" id="qStage"></div></div>
          <div class="q-ex-nav">
            <button data-a="prev">${ico('left', 18)}上一题</button>
            <button data-a="card" class="q-cardbtn">${ico('grid', 16)}<span id="qPos">1/${qs.length}</span></button>
            <button data-a="next" class="pri">下一题${ico('right', 18)}</button>
          </div>
        </div>
        <aside class="q-ex-side">
          <div class="q-me"><div class="q-photo">${PHOTO}</div><div class="small" style="line-height:1.8"><div>考生：<b>${esc(name)}</b></div><div>车型：<b>C1</b></div><div>已答：<b id="qDone">0</b> / ${qs.length}</div><div id="qWrongL" ${cfg.examInstant ? '' : 'style="display:none"'}>答错：<b id="qWrongN" style="color:var(--bad)">0</b> 题</div></div></div>
          <div class="q-sidegrid" id="qSideGrid"></div>
        </aside>
      </div>
    </div>`;
    bindCommon();
    $('#qSideGrid', root).addEventListener('click', e => { const c = e.target.closest('[data-j]'); if (c) jump(+c.dataset.j); });
    on(window, 'beforeunload', beforeUnload);
    renderCard(0);
    tick(); SES.timer = every(tick, 500);
  }
  function beforeUnload(e) { if (SES && SES.kind === 'exam') { e.preventDefault(); e.returnValue = ''; } }

  function tick() {
    const S = SES; if (!S || S.kind !== 'exam') return;
    const left = (S.end - Date.now()) / 1000;
    const t = $('#qTimer', root); if (!t) return;
    t.querySelector('span').textContent = fmtT(Math.ceil(left));
    t.classList.toggle('low', left <= 300);
    if (left <= 300 && !S.warn5) { S.warn5 = true; A.toast('距离考试结束还剩 5 分钟', 2200); A.beep('warn'); }
    if (left <= 0) { A.toast('考试时间到，系统已自动交卷', 2500); finishExam(); }
  }

  function updateExamChrome() {
    const S = SES; if (!S || S.kind !== 'exam') return;
    const n = Object.keys(S.ans).length;
    const d = $('#qDone', root); if (d) d.textContent = n;
    const w = $('#qWrongN', root); if (w) w.textContent = Object.values(S.ans).filter(x => x.ok === false).length;
    const g = $('#qSideGrid', root); if (g && getComputedStyle($('.q-ex-side', root)).display !== 'none') g.innerHTML = gridHtml(S);
    const nx = $('[data-a=next]', root); if (nx) nx.innerHTML = S.idx >= S.qs.length - 1 ? '交卷' : `下一题${ico('right', 18)}`;
  }

  function examAdvance() {
    const S = SES; if (!S) return;
    for (let k = 1; k <= S.qs.length; k++) { const i = (S.idx + k) % S.qs.length; if (!S.ans[S.qs[i].id]) { if (i !== S.idx) jump(i); return; } }
    // 全部作答完毕
    A.confirm('所有题目已作答完毕，是否现在交卷？', '交卷确认').then(ok => { if (ok && SES === S) finishExam(); });
  }

  async function submitExam() {
    const S = SES; if (!S || S.kind !== 'exam') return;
    const u = S.qs.filter(q => !S.ans[q.id]).length;
    const ok = await A.confirm(u ? `还有 <b class="q-num">${u}</b> 题未作答，未答题按答错计算。<br>交卷后不能再修改答案，确定交卷吗？` : '交卷后不能再修改答案，确定交卷吗？', '交卷确认');
    if (ok && SES === S) finishExam();
  }
  async function quitExam() {
    const S = SES; if (!S) return;
    const ok = await A.confirm('退出后本次考试成绩作废，确定退出吗？', '退出考试');
    if (ok && SES === S) { SES = null; A.go('#/' + S.b); }
  }

  function finishExam() {
    const S = SES; if (!S || S.kind !== 'exam' || S.finished) return;
    S.finished = true; clr(S.timer); clr(S.advT);
    $$('.modal-mask').forEach(m => m.remove()); closeSheet();
    const used = Math.min(S.dur, Math.round((Date.now() - S.t0) / 1000));
    let correct = 0, wrong = 0, un = 0; const byCh = {};
    S.qs.forEach(q => {
      const a = S.ans[q.id];
      const c = byCh[q.ch] || (byCh[q.ch] = { n: 0, ok: 0 }); c.n++;
      if (!a) { un++; return; }
      a.ok = a.sel === keyOf(q);
      recordAnswer(S.b, q, a.ok);
      if (a.ok) { correct++; c.ok++; } else wrong++;
    });
    const score = Math.round(correct * 100 / S.qs.length);
    const pass = score >= BANKS[S.b].exam.pass;
    A.record(S.b, { score, pass, used, total: S.qs.length, correct, wrong: wrong + un, mode: 'exam' });
    const R = { b: S.b, B: S.B, qs: S.qs, ans: S.ans, score, pass, used, correct, wrong, un, byCh };
    SES = null;
    A.immersive(false);
    showResult(R);
  }

  function showResult(R) {
    cancelAnimationFrame(raf); closeSheet();
    SES = null;
    const info = BANKS[R.b];
    A.setTitle(info.name + ' · 考试成绩');
    window.scrollTo(0, 0);
    const msg = R.pass ? (R.score === 100 ? '满分！完美通关，考场见！' : '恭喜通过！保持状态，稳稳拿下。') : (R.score >= 80 ? '差一点就合格了，再巩固一下错题吧！' : '别灰心，先把错题和秘籍过一遍再来。');
    root.innerHTML = `<div class="q-result fade-in">
      <div class="card q-res-hero">
        ${stamp(R.pass, R.b === 'k4' ? '科目四成绩' : '理论考试成绩')}
        <div class="muted small" style="margin-bottom:8px">${info.full} · 模拟考试成绩</div>
        <div class="q-score" style="color:${R.pass ? 'var(--ok)' : 'var(--bad)'}"><span id="qScore">0</span><small>分</small></div>
        <p style="margin:10px 0 0;font-weight:600">${msg}</p>
        <div class="q-rstats">
          <div><b>${fmtT(R.used)}</b><span>用时</span></div>
          <div><b style="color:var(--ok)">${R.correct}</b><span>答对</span></div>
          <div><b style="color:var(--bad)">${R.wrong}</b><span>答错</span></div>
          <div><b style="color:var(--warn)">${R.un}</b><span>未答</span></div>
        </div>
      </div>
      <div class="card q-bars"><div class="card-title">分章节得分</div>
        ${Object.keys(R.byCh).map(c => { const x = R.byCh[c], p = Math.round(x.ok / x.n * 100); return `<div class="q-br"><div class="row between"><span>${esc(chName(R.B, c))}</span><b>${x.ok}/${x.n}</b></div><div class="progress"><i data-w="${p}" style="width:0;background:${p >= 90 ? 'var(--ok)' : p >= 70 ? 'var(--warn)' : 'var(--bad)'}"></i></div></div>`; }).join('')}
      </div>
      <div class="grid g3" style="margin-bottom:14px">
        <button class="btn lg" id="qReview" ${R.wrong + R.un ? '' : 'disabled'}>查看错题 (${R.wrong + R.un})</button>
        <button class="btn primary lg" id="qAgain">再考一次</button>
        <button class="btn lg" id="qHome">返回</button>
      </div>
    </div>`;
    if (R.pass) A.beep('pass'); else A.beep('bad');
    const el = $('#qScore', root), t0 = performance.now(), to = R.score;
    const step = t => { const p = Math.min(1, (t - t0) / 1000), e = 1 - Math.pow(1 - p, 3); if (el.isConnected) el.textContent = Math.round(to * e); if (p < 1) raf = requestAnimationFrame(step); };
    raf = requestAnimationFrame(step);
    requestAnimationFrame(() => requestAnimationFrame(() => $$('[data-w]', root).forEach(i => i.style.width = i.dataset.w + '%')));
    $('#qReview', root).onclick = () => reviewExam(R);
    $('#qAgain', root).onclick = () => examIntro(R.b, R.B);
    $('#qHome', root).onclick = () => A.go('#/' + R.b);
  }

  function stamp(pass, arc) {
    const c = pass ? '#16a34a' : '#e5383b', t = pass ? '合格' : '不合格';
    return `<svg class="q-stamp" viewBox="0 0 140 140" width="104" height="104" aria-label="${t}"><g transform="rotate(-18 70 70)" opacity=".9">
      <circle cx="70" cy="70" r="63" fill="none" stroke="${c}" stroke-width="5"/><circle cx="70" cy="70" r="54" fill="none" stroke="${c}" stroke-width="1.6"/>
      <path id="qsArc" d="M24 70a46 46 0 0 1 92 0" fill="none"/>
      <text font-size="11" fill="${c}" font-weight="700" letter-spacing="3"><textPath href="#qsArc" startOffset="50%" text-anchor="middle">${arc || '考试成绩'}</textPath></text>
      <text x="70" y="${pass ? 84 : 81}" text-anchor="middle" font-size="${pass ? 36 : 28}" font-weight="900" fill="${c}">${t}</text>
      <text x="70" y="108" text-anchor="middle" font-size="10" fill="${c}">★ 驾考通 ★</text></g></svg>`;
  }

  function reviewExam(R) {
    const qs = R.qs.filter(q => !R.ans[q.id] || !R.ans[q.id].ok);
    if (!qs.length) return;
    A.setTitle(BANKS[R.b].name + ' · 错题回顾');
    SES = { kind: 'review', b: R.b, B: R.B, title: `错题回顾（${qs.length} 题）`, qs, idx: 0, ans: R.ans, pend: '', okN: 0, badN: 0, result: R, advT: 0 };
    practiceShell(); renderCard(0); window.scrollTo(0, 0);
  }

  /* =========================================================
   * 考前秘籍
   * ======================================================= */
  const TIPS = {
    k1: `
<div class="card"><div class="card-title">科目一 · 考试规则</div>
<table class="tbl"><tr><td>题量 / 时间</td><td><b class="q-num">100</b> 题，<b class="q-num">45</b> 分钟，每题 1 分</td></tr>
<tr><td>合格标准</td><td><b class="q-num">90</b> 分及格（最多错 10 题）</td></tr>
<tr><td>题型</td><td>判断题 + 单选题（真实考场约 40 判断 + 60 单选）</td></tr>
<tr><td>补考</td><td>每次预约有 2 次机会，首次不合格可当场补考 1 次；不合格需 10 日后重新预约</td></tr>
<tr><td>学习驾驶证明</td><td>有效期 <b class="q-num">3</b> 年，须在有效期内考完全部科目</td></tr></table></div>

<div class="card q-tips"><div class="card-title">一、速度口诀</div>
<div class="q-kou">高速"一二零、六十整"；<br>没中线：城三十、公四十；<br>单车道：城五十、公七十；<br>特殊路段一律"三十"封顶。</div>
<table class="tbl">
<tr><td>高速公路</td><td>小型载客汽车最高 <b class="q-num">120</b>，其他机动车最高 100，摩托车 80；最低 <b class="q-num">60</b> km/h</td></tr>
<tr><td>高速分车道</td><td>同向 2 车道：左侧车道最低 <b class="q-num">100</b>；同向 3 车道以上：最左侧最低 <b class="q-num">110</b>，中间车道最低 <b class="q-num">90</b></td></tr>
<tr><td>无限速标志</td><td>无道路中心线：城市道路 <b class="q-num">30</b>、公路 <b class="q-num">40</b>；同方向只有 1 条机动车道：城市道路 <b class="q-num">50</b>、公路 <b class="q-num">70</b></td></tr>
<tr><td>最高 30 km/h</td><td>进出非机动车道；通过铁路道口、急弯路、窄路、窄桥；掉头、转弯、下陡坡；能见度 50 米以内的雾雨雪沙尘冰雹天；冰雪、泥泞道路；牵引故障机动车</td></tr>
<tr><td>高速低能见度</td><td>&lt;200 米：≤<b class="q-num">60</b>，车距 ≥100 米；&lt;100 米：≤<b class="q-num">40</b>，车距 ≥50 米；&lt;50 米：≤<b class="q-num">20</b>，并从最近出口尽快驶离</td></tr>
</table>
<div class="q-kou">能见度口诀：二百六十一百米，一百四十五十米，五十二十快下高速。</div></div>

<div class="card q-tips"><div class="card-title">二、距离口诀</div>
<div class="q-kou">"口铁弯窄桥坡隧"五十米不停车；<br>"公交急救加油消防"三十米不停车；<br>故障警示：普路五十到一百，高速一百五十外；<br>夜间会车一百五，远光提前换近光。</div>
<table class="tbl">
<tr><td>50 米内禁停</td><td>交叉路口、铁路道口、急弯路、宽度不足 4 米的窄路、桥梁、陡坡、隧道以及距离上述地点 50 米以内的路段</td></tr>
<tr><td>30 米内禁停</td><td>公共汽车站、急救站、加油站、消防栓或者消防队（站）门前及距离 30 米以内（使用上述设施的除外）</td></tr>
<tr><td>警告标志</td><td>普通道路：来车方向 <b class="q-num">50～100</b> 米；高速公路：来车方向 <b class="q-num">150</b> 米以外</td></tr>
<tr><td>高速跟车</td><td>车速 &gt;100 km/h：车距 <b class="q-num">100</b> 米以上；车速 ≤100 km/h：可适当缩短，但最小不少于 <b class="q-num">50</b> 米</td></tr>
<tr><td>夜间会车</td><td>距对向来车 <b class="q-num">150</b> 米以外改用近光灯</td></tr>
<tr><td>软连接牵引</td><td>牵引车与被牵引车距离大于 <b class="q-num">4</b> 米、小于 <b class="q-num">10</b> 米；制动失效的必须硬连接</td></tr>
<tr><td>行李架载物</td><td>从车顶起高度不超过 <b class="q-num">0.5</b> 米，从地面起不超过 <b class="q-num">4</b> 米</td></tr>
</table></div>

<div class="card q-tips"><div class="card-title">三、记分口诀（2022 年 4 月 1 日起施行）</div>
<div class="q-kou">记分五档：12 · 9 · 6 · 3 · 1；<br>酒驾逃逸假牌证、高速倒逆穿分隔 —— 12 分；<br>无牌遮牌开错车、高速违停 —— 9 分；<br>闯红灯、占应急、扣证期间开车 —— 6 分；<br>手持电话、不让行人、乱超车 —— 3 分；<br>不系安全带、灯光禁令、会车掉头 —— 1 分。</div>
<table class="tbl">
<tr><td><span class="tag red">12 分</span></td><td>饮酒后驾驶；致人轻伤以上事故后逃逸尚不构成犯罪；使用伪造、变造或他车号牌、行驶证、驾驶证；在高速公路、城市快速路上倒车、逆行、穿越中央分隔带掉头；其他机动车在高速/快速路超速 50% 以上；代替他人接受记分牟利</td></tr>
<tr><td><span class="tag red">9 分</span></td><td>驾驶与准驾车型不符的机动车；未悬挂号牌或故意遮挡、污损号牌；在高速公路或城市快速路上违法停车；7 座以上载客汽车超员 50%～100%</td></tr>
<tr><td><span class="tag orange">6 分</span></td><td>违反交通信号灯通行（闯红灯）；驾驶证被暂扣或扣留期间驾驶；高速/快速路违法占用应急车道行驶；致人轻微伤或财产损失事故后逃逸尚不构成犯罪；高速/快速路超速 20%～50%；普通道路超速 50% 以上；故障/事故停车后不按规定使用灯光或设置警告标志</td></tr>
<tr><td><span class="tag orange">3 分</span></td><td>拨打、接听手持电话等妨碍安全驾驶行为；行经人行横道不按规定减速、停车、避让行人；不按规定超车、让行；高速/快速路不按规定车道行驶；遇排队借道超车、穿插等候车辆；普通道路超速 20%～50%；不按规定避让校车</td></tr>
<tr><td><span class="tag blue">1 分</span></td><td>未按规定系安全带；不按规定使用灯光；违反禁令标志、禁止标线指示；不按规定会车；普通道路不按规定倒车、掉头；驾驶摩托车不戴安全头盔；载物长宽高超过规定</td></tr>
</table>
<ul class="small"><li>记分周期 <b class="q-num">12</b> 个月，满分 12 分，从初次领证之日起计算。</li>
<li>一个周期内记满 12 分：扣留驾驶证，参加为期 <b class="q-num">7</b> 天的道路交通安全法律法规学习，再参加科目一考试，合格后清除记分、发还驾驶证。</li>
<li>大型客车、牵引车、城市公交车、中型客车、大型货车驾驶人记满 12 分：学习 <b class="q-num">30</b> 天。</li>
<li>一个周期内两次以上满分或累积达到 24 分以上：除科目一外，还需加考道路驾驶技能（科目三）。</li>
<li>学法减分：周期内未满分且符合条件的，可通过网上学法或现场学习减免记分，一个周期内累计最多减免 <b class="q-num">6</b> 分。</li></ul></div>

<div class="card q-tips"><div class="card-title">四、酒驾与处罚数字</div>
<div class="q-kou">"二十饮酒、八十醉"：二十毫克算酒驾，八十毫克是醉驾。</div>
<table class="tbl">
<tr><td>饮酒驾驶</td><td>血液酒精 ≥<b class="q-num">20</b> mg/100ml 且 &lt;80：暂扣 <b class="q-num">6</b> 个月驾驶证，罚款 1000～2000 元，记 12 分</td></tr>
<tr><td>再次饮酒驾驶</td><td>因饮酒驾驶被处罚后再次饮酒驾驶：10 日以下拘留，罚款 1000～2000 元，吊销驾驶证</td></tr>
<tr><td>醉酒驾驶</td><td>≥<b class="q-num">80</b> mg/100ml：约束至酒醒，吊销驾驶证，追究刑事责任（危险驾驶罪），<b class="q-num">5</b> 年内不得重新取得</td></tr>
<tr><td>饮酒驾驶营运车</td><td>15 日拘留，罚款 5000 元，吊销驾驶证，5 年内不得重新取得</td></tr>
<tr><td>醉驾营运车</td><td>吊销，追究刑责，<b class="q-num">10</b> 年内不得重新取得，重新取得后不得驾驶营运机动车</td></tr>
<tr><td>终生禁驾</td><td>饮酒/醉酒驾驶发生重大交通事故构成犯罪；造成交通事故后逃逸</td></tr>
<tr><td>一般违法</td><td>警告或 <b class="q-num">20～200</b> 元罚款</td></tr>
<tr><td>200～2000 元</td><td>无证驾驶（可并处 15 日以下拘留）；超速 50% 以上（可吊销）；把车交给无证人员驾驶（可吊销）</td></tr>
<tr><td>2000～5000 元</td><td>伪造、变造或者使用伪造、变造的号牌、行驶证、驾驶证（并处 15 日以下拘留）；使用其他车辆号牌、行驶证</td></tr>
<tr><td>未投保交强险</td><td>扣留车辆至投保，并处最低责任限额应缴保费 <b class="q-num">2</b> 倍罚款</td></tr>
<tr><td>吊销后重考</td><td>一般 <b class="q-num">2</b> 年内不得重新申领</td></tr>
</table></div>

<div class="card q-tips"><div class="card-title">五、驾驶证与登记</div>
<div class="q-kou">驾驶证"六、十、长期"；实习期一十二个月；到期前九十日换证。</div>
<table class="tbl">
<tr><td>有效期</td><td>首次 <b class="q-num">6</b> 年；6 年内每个记分周期均未记满 12 分换发 <b class="q-num">10</b> 年；10 年内每个周期均未满分换发<b>长期</b></td></tr>
<tr><td>换证</td><td>有效期满前 <b class="q-num">90</b> 日内申请换证</td></tr>
<tr><td>申领年龄</td><td>小型汽车 <b class="q-num">18</b> 周岁以上，不设上限；70 周岁以上需通过记忆力、判断力、反应力等能力测试</td></tr>
<tr><td>实习期</td><td>初次领证后 <b class="q-num">12</b> 个月；需粘贴或悬挂统一式样的"实习"标志</td></tr>
<tr><td>实习期上高速</td><td>须由持相应或更高准驾车型驾驶证 <b class="q-num">3</b> 年以上的驾驶人陪同</td></tr>
<tr><td>实习期禁止</td><td>不得驾驶公共汽车、营运客车、执行任务的警车/消防车/救护车/工程救险车、载危险物品的机动车；不得牵引挂车</td></tr>
<tr><td>实习期满分</td><td>实习期内记满 12 分的，注销其实习的准驾车型驾驶资格</td></tr>
<tr><td>隐瞒/欺骗</td><td>申请时隐瞒或提供虚假材料：<b class="q-num">1</b> 年内不得再次申领；以欺骗、贿赂手段取得：撤销，<b class="q-num">3</b> 年内不得再次申领</td></tr>
<tr><td>疲劳驾驶</td><td>连续驾驶不得超过 <b class="q-num">4</b> 小时，停车休息不少于 <b class="q-num">20</b> 分钟</td></tr>
</table></div>

<div class="card q-tips"><div class="card-title">六、标志 · 标线 · 手势速记</div>
<div class="q-kou">黄三角是警告，红圈红杠是禁令，蓝底圆形是指示，蓝绿方牌是指路；<br>八角"停"必须停，倒三角"让"要减速。</div>
<ul><li><b>标线颜色</b>：白色——同向分隔；黄色——对向分隔。<b>虚线可越、实线禁越</b>；虚实线"虚线一侧可越，实线一侧禁越"。</li>
<li><b>黄色网状线</b>：禁止以任何原因停车；<b>导流线</b>：按规定路线行驶，不得压线或越线。</li>
<li><b>左转待转区</b>：直行绿灯亮时进入待转区，左转灯亮时驶出。</li>
<li><b>交警手势</b>：左臂向前上方直伸掌心向前＝停止；双臂平伸右臂向左摆＝直行；右臂平伸、左臂向右前摆＝左转；左臂向前平伸、右臂向左前摆＝右转；右臂向右前方平伸向下摆＝减速慢行。</li>
<li><b>路口让行</b>：无信号无交警，"停车瞭望让右方"；转弯让直行；右转让左转；入环让环内。</li></ul></div>

<div class="card q-tips"><div class="card-title">七、做题技巧</div>
<ul><li>"在保证安全的前提下""应当减速""确认安全后"等表述的判断题，多数为"正确"。</li>
<li>"一律""可以随意""任何情况都"等绝对化表述，多数为"错误"——但仍以法规为准，不要死套。</li>
<li>数字题优先记忆：<b>120/60、30/50、40/70、50/30 米、150 米、20/80 毫克、6/10/长期、12 个月、90 日</b>。</li>
<li>先做有把握的题；不确定时用排除法，排除明显违法、危险的选项。</li>
<li>考前一天至少完成 3 次模拟考试，连续 3 次 95 分以上再去考场更稳。</li></ul></div>`,

    k4: `
<div class="card"><div class="card-title">科目四 · 考试规则</div>
<table class="tbl"><tr><td>题量 / 时间</td><td><b class="q-num">50</b> 题，<b class="q-num">30</b> 分钟，每题 <b class="q-num">2</b> 分</td></tr>
<tr><td>合格标准</td><td><b class="q-num">90</b> 分及格（最多错 5 题）</td></tr>
<tr><td>题型</td><td>判断题 20 + 单选题 20 + 多选题 10（以当地考场为准）</td></tr>
<tr><td>多选题</td><td>须选出<b>全部</b>正确答案才得分，多选、少选、错选均不得分</td></tr>
<tr><td>考试安排</td><td>通常与科目三同日考试，科目三、科目四合格后当场或当天领取驾驶证</td></tr></table></div>

<div class="card q-tips"><div class="card-title">一、恶劣天气驾驶</div>
<div class="q-kou">雨天降速加距离，雾天雾灯加双闪；<br>冰雪路面轻缓慢，涉水低速不换挡。</div>
<table class="tbl">
<tr><td>雨天</td><td>开启雨刮和近光灯，降低车速、加大跟车距离；防"水滑"——高速通过积水路面时轮胎可能脱离地面，应降低车速，不能急转向、急制动</td></tr>
<tr><td>雾天</td><td>开启雾灯、近光灯、示廓灯和危险报警闪光灯，严格控制车速，适时鸣喇叭提示；不要使用远光灯（会形成光幕）</td></tr>
<tr><td>冰雪</td><td>安装防滑链，低速行驶，加大车距，缓加速、轻踏制动、少转向；可以利用发动机制动减速</td></tr>
<tr><td>大风 / 横风</td><td>双手握稳方向盘，适当降低车速；感到车辆横向偏移时，要轻轻修正方向，不能猛打方向</td></tr>
<tr><td>涉水</td><td>停车察看水深，低速挡平稳一次通过，中途不停车、不换挡；驶出后轻踩几次制动踏板，使制动器尽快恢复</td></tr>
<tr><td>高温</td><td>注意水温表和胎压，防止发动机过热、爆胎；冷却液温度过高时不能立即打开散热器盖</td></tr>
</table></div>

<div class="card q-tips"><div class="card-title">二、紧急情况处置口诀</div>
<div class="q-kou">爆胎：握紧方向缓收油，切忌急刹慢慢停；<br>刹车失灵：抢挡减速拉手刹，必要撞擦保平安；<br>侧滑：松油不急刹，方向朝着侧滑那边回；<br>落水：解带开窗等水满，憋气开门快上岸；<br>着火：熄火断电先撤人，灭火器要对火根。</div>
<ul>
<li><b>爆胎</b>：双手紧握方向盘，尽力控制方向，松抬加速踏板，<b>不可紧急制动</b>，车速降下来后再轻踩制动停车；开启危险报警闪光灯。</li>
<li><b>制动失效</b>：握稳方向盘，迅速减挡利用发动机制动，逐渐拉紧驻车制动；必要时利用道路边的天然障碍物（土坡、护栏）擦撞减速。下长坡避免长时间连续制动，以防制动器过热失效。</li>
<li><b>转向失控</b>：立即松抬加速踏板，平稳减速停车；若车辆已偏离直线行驶，应果断连续踩踏、放松制动踏板，尽快减速停车，开启危险报警闪光灯。</li>
<li><b>侧滑</b>：立即松抬加速踏板，不可紧急制动；后轮侧滑时，向侧滑的一侧适量转动方向盘修正。</li>
<li><b>碰撞不可避免</b>：撞击方位不在驾驶人一侧时，紧握方向盘、两腿向前蹬直、身体后倾；撞击部位临近驾驶座时，迅速躲离方向盘，两脚抬起。</li>
<li><b>车辆侧翻</b>：紧握方向盘，双脚勾住踏板，背部紧靠座椅靠背，随车翻转，不要跳车。</li>
<li><b>车辆落水</b>：保持冷静，解开安全带，尽快打开车窗或用安全锤击碎侧窗玻璃（四角最易碎）；车门难以打开时，待车内外水压基本平衡后再推门逃生。</li>
<li><b>高速故障</b>：开启危险报警闪光灯，车辆移至应急车道，在来车方向 <b class="q-num">150</b> 米以外设置警告标志，人员迅速转移到护栏外，并报警。</li>
</ul></div>

<div class="card q-tips"><div class="card-title">三、事故处理与急救</div>
<div class="q-kou">先救人、后救物；先止血、后包扎；骨折先固定再搬运；<br>报警 122、急救 120、火警 119。</div>
<ul>
<li>仅造成轻微财产损失、车辆可以移动的事故：应当<b>先撤离现场</b>，再协商处理或快处快赔（拍照取证后撤离）。</li>
<li>造成人员伤亡：立即停车、保护现场、抢救伤员并迅速报警；因抢救伤员变动现场的，应当标明位置。</li>
<li><b>止血</b>：动脉出血（鲜红、喷射状）用指压法压迫伤口近心端动脉，再加压包扎；使用止血带须注明时间并定时放松。</li>
<li><b>骨折</b>：就地取材固定后再搬运，不要随意拉扯、复位；脊柱损伤者用硬板担架平抬，严禁一人抬头一人抬脚。</li>
<li><b>烧伤</b>：迅速脱离火源，用冷水冲洗降温，不要涂抹油膏、酱油、牙膏，不要挑破水泡。</li>
<li><b>昏迷</b>：保持呼吸道畅通，将伤员置于侧卧位，清除口鼻异物，不可喂水。</li>
<li><b>心肺复苏</b>：胸外按压与人工呼吸比例 30:2，按压深度 5～6 厘米，频率 100～120 次/分钟。</li>
</ul></div>

<div class="card q-tips"><div class="card-title">四、文明驾驶与防御性驾驶</div>
<ul>
<li><b>礼让</b>：行经人行横道减速，遇行人正在通过应当停车让行；遇盲人（持盲杖）、老人、儿童主动减速避让；遇校车停车上下学生时，同方向只有一条车道的后方车辆应当停车等待。</li>
<li><b>不鸣喇叭</b>：禁鸣区域、医院、学校附近不鸣喇叭；夜间、市区内尽量不用喇叭催促。</li>
<li><b>灯光礼仪</b>：夜间会车 150 米外改近光，跟车不用远光；超车前开左转向灯，变换远近光提示。</li>
<li><b>防"鬼探头"</b>：经过停放车辆、公交站、视线受阻的路段，提前减速，脚放在制动踏板上方。</li>
<li><b>大车盲区与内轮差</b>：不要在大型车辆右侧并行或长时间停留；大车右转时远离其右侧。</li>
<li><b>开车门</b>：先观察后方来车（荷式开门法：用远离车门的手开门），避免"开门杀"。</li>
<li><b>情绪</b>：不开斗气车，被别车时保持车距，不报复性别车、急刹。</li>
<li><b>儿童乘车</b>：儿童应使用安全座椅并坐在后排，不要抱着儿童坐在副驾驶座。</li>
</ul></div>

<div class="card q-tips"><div class="card-title">五、多选题技巧</div>
<ul><li>多选题至少有 2 个正确选项，常见为 3～4 个全选——"安全措施类"题目往往全部正确。</li>
<li>出现"紧急制动""猛打方向""加速冲过""跟随前车"等危险操作的选项，基本是错误选项。</li>
<li>看清题干问"正确的是"还是"错误的是 / 不正确的是"。</li>
<li>拿不准时宁可回顾题干关键词：雨、雾、冰雪、夜间、高速、山区——分别对应"降速、灯光、车距、观察"。</li></ul></div>`
  };

  function tipsPage(b) {
    A.setTitle(BANKS[b].name + ' · 考前秘籍');
    root.innerHTML = `<div class="q-hub q-tips fade-in">
      <div class="q-hero" style="background:${BANKS[b].grad}"><div class="q-eico" style="width:56px;height:56px;border-radius:16px;background:rgba(255,255,255,.2);display:flex;align-items:center;justify-content:center;flex:none">${ico('tips', 30)}</div>
        <div style="position:relative;z-index:1"><h2>${BANKS[b].name}考前秘籍</h2><div class="q-sub">考点数字速记 · 口诀 · 易错点，考前过一遍更稳</div></div></div>
      ${TIPS[b]}
      <div class="row" style="gap:10px;margin-bottom:14px"><a class="btn primary flex1" href="#/quiz/${b}/exam">去模拟考试</a><a class="btn flex1" href="#/quiz/${b}/type/hard">练易错题</a></div>
      <p class="center small muted">内容依据《道路交通安全法》《道路交通安全法实施条例》《机动车驾驶证申领和使用规定》《道路交通安全违法行为记分管理办法》（2022）整理，仅供学习参考，以官方最新规定为准。</p>
    </div>`;
  }

  /* =========================================================
   * 路由
   * ======================================================= */
  function route(b, B, mode, arg) {
    if (mode === 'hub') return hub(b, B);
    if (mode === 'exam') return examIntro(b, B);
    if (mode === 'history') return historyPage(b, B);
    if (mode === 'tips') return tipsPage(b);
    if (mode === 'chapter' && !arg) return chapterPage(b, B);
    if (mode === 'type' && !arg) return typePage(b, B);
    return startPractice(b, B, mode, arg);
  }

  A.define('quiz', {
    mount(el, { path }) {
      root = el; const my = ++token;
      injectCss();
      let b, mode, arg;
      if (path[0] === 'quiz') { b = path[1]; mode = path[2]; arg = path[3]; }
      else { b = path[0]; mode = path[1]; arg = path[2]; }
      if (!BANKS[b]) b = 'k1';
      mode = mode || 'hub';
      on(document, 'keydown', onKey);
      if (mode === 'tips') { tipsPage(b); return; }
      A.setTitle(BANKS[b].full);
      el.innerHTML = '<div class="center muted" style="padding:60px 0">题库加载中…</div>';
      loadBank(b).then(B => {
        if (my !== token) return;
        if (!B) {
          el.innerHTML = `<div class="card q-empty fade-in">${ico('chapter', 44)}<h3>${BANKS[b].name}题库暂未就绪</h3>
            <p class="muted">题库文件加载失败或尚在更新中，请稍后重试。你可以先看看考前秘籍。</p>
            <div class="row" style="justify-content:center;gap:8px;flex-wrap:wrap"><button class="btn primary" onclick="location.reload()">重新加载</button><a class="btn" href="#/quiz/${b}/tips">考前秘籍</a>${b === 'k4' ? '<a class="btn" href="#/k1">去练科目一</a>' : ''}</div></div>`;
          return;
        }
        try { route(b, B, mode, arg); } catch (e) { console.error(e); el.innerHTML = `<div class="card"><b>出错了</b><pre class="small">${esc(e.stack || e)}</pre></div>`; }
      });
    },
    unmount() { token++; cleanup(); if (root) root.removeEventListener('click', onRootClick); root = null; }
  });
})();
