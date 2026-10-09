/* 驾考通 · 图鉴 / 知识库模块（ref） */
(function () {
  'use strict';
  const A = window.App, esc = A.esc, SG = () => window.Signs;
  const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const rnd = n => Math.floor(Math.random() * n);
  const shuffle = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = rnd(i + 1);[a[i], a[j]] = [a[j], a[i]]; } return a; };
  const bag = () => { const fns = []; return { add(f) { fns.push(f); return f; }, on(el, ev, fn, o) { el.addEventListener(ev, fn, o); fns.push(() => el.removeEventListener(ev, fn, o)); }, timeout(f, ms) { const t = setTimeout(f, ms); fns.push(() => clearTimeout(t)); return t; }, interval(f, ms) { const t = setInterval(f, ms); fns.push(() => clearInterval(t)); return t; }, clear() { fns.splice(0).reverse().forEach(f => { try { f(); } catch (e) { } }); } }; };
  let life = bag();

  /* ================= 样式 ================= */
  function css() {
    if ($('#ref-css')) return;
    const st = document.createElement('style'); st.id = 'ref-css';
    st.textContent = `
.r-wrap{max-width:1000px;margin:0 auto}
.r-hub{display:grid;grid-template-columns:repeat(2,1fr);gap:12px}
@media(min-width:640px){.r-hub{grid-template-columns:repeat(3,1fr)}}
@media(min-width:980px){.r-hub{grid-template-columns:repeat(4,1fr)}}
.r-tile{position:relative;display:flex;flex-direction:column;gap:6px;padding:14px;border-radius:16px;background:var(--card);box-shadow:var(--shadow);color:var(--text);cursor:pointer;overflow:hidden;min-height:128px;transition:transform .12s}
.r-tile:active{transform:scale(.97)}
.r-tile .r-ti{width:52px;height:52px;display:flex;align-items:center;justify-content:center}
.r-tile .r-ti svg{width:52px;height:52px}
.r-tile b{font-size:15px}
.r-tile span{font-size:12px;color:var(--text3);line-height:1.4}
.r-tile::after{content:"";position:absolute;right:-24px;top:-24px;width:84px;height:84px;border-radius:50%;background:var(--tc,var(--pri));opacity:.09}
.r-bar{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin-bottom:12px}
.r-tabs{display:flex;gap:6px;overflow-x:auto;padding-bottom:2px;scrollbar-width:none;-webkit-overflow-scrolling:touch}
.r-tabs::-webkit-scrollbar{display:none}
.r-tab{flex:none;border:1px solid var(--line);background:var(--card);color:var(--text2);border-radius:20px;padding:5px 13px;font-size:13px;font-weight:600;cursor:pointer;white-space:nowrap}
.r-tab.on{background:var(--pri);border-color:var(--pri);color:#fff}
.r-tab i{font-style:normal;opacity:.7;font-size:11px;margin-left:3px}
.r-search{flex:1;min-width:160px;height:38px;border-radius:12px;border:1px solid var(--line);background:var(--card);color:var(--text);padding:0 12px 0 34px;font-size:14px;outline:none;
  background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Ccircle cx='11' cy='11' r='7' fill='none' stroke='%23999' stroke-width='2'/%3E%3Cpath d='M16 16l5 5' stroke='%23999' stroke-width='2' stroke-linecap='round'/%3E%3C/svg%3E");background-repeat:no-repeat;background-size:16px;background-position:11px center}
.r-search:focus{border-color:var(--pri)}
.r-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(104px,1fr));gap:10px}
@media(min-width:700px){.r-grid{grid-template-columns:repeat(auto-fill,minmax(124px,1fr))}}
.r-card{background:var(--card);border-radius:14px;padding:10px 6px 8px;display:flex;flex-direction:column;align-items:center;gap:6px;cursor:pointer;box-shadow:var(--shadow);text-align:center;transition:transform .1s}
.r-card:active{transform:scale(.96)}
.r-card svg{width:76px;height:76px}
.r-card .r-nm{font-size:12px;line-height:1.3;color:var(--text);font-weight:500;min-height:31px;display:flex;align-items:center}
html[data-theme=dark] .r-card .r-sg{background:#e9ebee;border-radius:10px;padding:3px}
.r-sg{display:inline-flex}
.r-big{display:flex;justify-content:center;margin:4px 0 12px}
.r-big svg{width:180px;height:180px;max-width:60vw;max-height:60vw}
html[data-theme=dark] .r-big .r-sg{background:#e9ebee;border-radius:16px;padding:6px}
.r-desc{color:var(--text);font-size:15px;line-height:1.7}
.r-empty{padding:40px 0;text-align:center;color:var(--text3)}
.r-dark{background:linear-gradient(160deg,#1a1e25,#0c0e12);border-radius:18px;padding:14px;box-shadow:inset 0 0 0 1px #2a2f38,var(--shadow)}
.r-dgrid{display:grid;grid-template-columns:repeat(auto-fill,minmax(92px,1fr));gap:10px}
.r-dcell{display:flex;flex-direction:column;align-items:center;gap:6px;padding:8px 4px;border-radius:12px;cursor:pointer;color:#c9ced6;font-size:12px;text-align:center;line-height:1.3;transition:background .15s}
.r-dcell:hover,.r-dcell:active{background:#ffffff10}
.r-dcell svg{width:64px;height:64px}
.r-chip{display:inline-flex;align-items:center;gap:4px}
.r-dot{width:9px;height:9px;border-radius:50%;display:inline-block}
/* quiz */
.r-quiz{max-width:560px;margin:0 auto}
.r-qhead{display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;gap:8px;flex-wrap:wrap}
.r-qstat{display:flex;gap:14px;font-size:13px;color:var(--text2)}
.r-qstat b{color:var(--text);font-size:17px;margin-left:2px}
.r-qart{display:flex;justify-content:center;align-items:center;min-height:200px;background:var(--card);border-radius:18px;box-shadow:var(--shadow);padding:16px;margin-bottom:12px}
.r-qart svg{width:190px;height:190px;max-width:62vw}
.r-qart.dk{background:linear-gradient(160deg,#1a1e25,#0c0e12)}
.r-qopts{display:grid;grid-template-columns:1fr 1fr;gap:10px}
.r-qopt{min-height:52px;border-radius:14px;border:2px solid var(--line);background:var(--card);color:var(--text);font-weight:600;font-size:15px;padding:8px 10px;cursor:pointer;line-height:1.3;transition:transform .08s}
.r-qopt:active{transform:scale(.97)}
.r-qopt.ok{border-color:var(--ok);background:var(--ok-bg);color:var(--ok)}
.r-qopt.bad{border-color:var(--bad);background:var(--bad-bg);color:var(--bad);animation:r-shake .35s}
.r-qopt[disabled]{pointer-events:none}
.r-qfb{margin-top:12px;min-height:20px}
.r-streak{display:inline-flex;align-items:center;gap:4px;padding:2px 10px;border-radius:12px;background:var(--warn-bg);color:var(--warn);font-weight:700;font-size:13px}
@keyframes r-shake{20%,60%{transform:translateX(-5px)}40%,80%{transform:translateX(5px)}}
@keyframes r-pop{0%{transform:scale(.6);opacity:0}100%{transform:scale(1);opacity:1}}
.r-pop{animation:r-pop .25s ease-out}
/* marks list */
.r-mlist{display:grid;grid-template-columns:1fr;gap:10px}
@media(min-width:760px){.r-mlist{grid-template-columns:1fr 1fr}}
.r-mitem{display:flex;gap:12px;background:var(--card);border-radius:14px;padding:12px;box-shadow:var(--shadow);cursor:pointer}
.r-mitem svg{width:96px;height:96px;flex:none;border-radius:8px}
.r-mitem h4{margin:2px 0 4px;font-size:15px}
.r-mitem p{margin:0;font-size:13px;color:var(--text2);line-height:1.6}
/* gestures */
.r-gwrap{display:grid;grid-template-columns:1fr;gap:14px}
@media(min-width:860px){.r-gwrap{grid-template-columns:minmax(300px,420px) 1fr}}
.r-stage{position:relative;display:flex;flex-direction:column;background:linear-gradient(180deg,#cfe3f7 0%,#e9f2fb 62%,#9aa3ad 62%,#7d868f 100%);border-radius:18px;overflow:hidden;box-shadow:var(--shadow);aspect-ratio:4/5;max-height:62vh;margin:0 auto;width:100%}
html[data-theme=dark] .r-stage{background:linear-gradient(180deg,#24364d 0%,#2f4560 62%,#3a4048 62%,#2a2f35 100%)}
.r-stage svg{width:100%;flex:1;min-height:0;display:block}
.r-stage .r-cap{flex:none;margin:0 8px 8px;min-height:40px;background:rgba(10,14,20,.72);color:#fff;font-size:13px;line-height:1.45;padding:7px 10px;border-radius:10px;backdrop-filter:blur(4px)}
.r-stage .r-dir{position:absolute;top:8px;font-size:11px;font-weight:700;color:#334;background:#fff9;padding:2px 8px;border-radius:8px}
html[data-theme=dark] .r-stage .r-dir{color:#dde;background:#0006}
.r-ctrl{display:flex;flex-wrap:wrap;gap:8px;align-items:center;justify-content:center;margin-top:10px}
.r-glist{display:grid;grid-template-columns:repeat(4,1fr);gap:6px;margin-bottom:12px}
@media(max-width:480px){.r-gbtn{font-size:12px;padding:7px 2px}}
.r-gbtn{border:1px solid var(--line);background:var(--card);color:var(--text);border-radius:10px;padding:8px 4px;font-size:13px;font-weight:600;cursor:pointer}
.r-gbtn.on{background:var(--pri);color:#fff;border-color:var(--pri)}
.r-steps{margin:0;padding-left:0;list-style:none;counter-reset:s}
.r-steps li{position:relative;padding:7px 8px 7px 34px;border-radius:10px;font-size:14px;line-height:1.55;color:var(--text2);transition:background .2s,color .2s}
.r-steps li::before{counter-increment:s;content:counter(s);position:absolute;left:6px;top:8px;width:20px;height:20px;border-radius:50%;background:var(--card2);color:var(--text2);font-size:12px;font-weight:700;display:flex;align-items:center;justify-content:center}
.r-steps li.on{background:var(--pri-bg);color:var(--text)}
.r-steps li.on::before{background:var(--pri);color:#fff}
.r-kou{font-size:16px;font-weight:700;color:var(--pri);padding:10px 12px;border-radius:12px;background:var(--pri-bg);margin:8px 0}
/* lights */
.r-lgrid{display:grid;grid-template-columns:1fr;gap:14px}
.r-lgrid>.card{margin:0}
@media(min-width:760px){.r-lgrid{grid-template-columns:1fr 1fr}}
.r-lbox{display:flex;gap:14px;align-items:center}
.r-house{flex:none;background:#16181c;border-radius:14px;padding:8px;display:flex;gap:6px;box-shadow:inset 0 0 0 2px #2b2f36}
.r-house.v{flex-direction:column}
.r-lamp{width:44px;height:44px;border-radius:50%;background:#2a2d33;position:relative;display:flex;align-items:center;justify-content:center;box-shadow:inset 0 3px 6px #0008;transition:background .15s,box-shadow .15s}
.r-lamp svg{width:30px;height:30px}
.r-lamp.red.on{background:#ff3b30;box-shadow:0 0 18px #ff3b30,inset 0 0 8px #fff6}
.r-lamp.yel.on{background:#ffb300;box-shadow:0 0 18px #ffb300,inset 0 0 8px #fff6}
.r-lamp.grn.on{background:#22d36b;box-shadow:0 0 18px #22d36b,inset 0 0 8px #fff6}
.r-lamp.blink.on{animation:r-blink 1s steps(1) infinite}
.r-lamp.ic{background:#1d1f24}
.r-lamp.ic svg *{fill:#33363c}
.r-lamp.ic.on.red{background:#1d1f24;box-shadow:none}.r-lamp.ic.on.red svg *{fill:#ff3b30}
.r-lamp.ic.on.grn{background:#1d1f24;box-shadow:none}.r-lamp.ic.on.grn svg *{fill:#22d36b}
.r-lamp.ic.on.yel{background:#1d1f24;box-shadow:none}.r-lamp.ic.on.yel svg *{fill:#ffb300}
.r-lamp.ic.on svg{filter:drop-shadow(0 0 5px currentColor)}
@keyframes r-blink{50%{opacity:.12;box-shadow:none}}
.r-cd{font:700 22px ui-monospace,monospace;color:#ff3b30;min-width:40px;text-align:center;background:#111;border-radius:8px;padding:2px 6px}
.r-cd.g{color:#22d36b}.r-cd.y{color:#ffb300}
.r-state{font-weight:700;font-size:15px;margin-bottom:4px}
.r-rules{margin:8px 0 0;padding-left:18px;font-size:14px;color:var(--text2);line-height:1.7}
.r-rules b{color:var(--text)}
/* tables */
.r-pts h3{display:flex;align-items:center;gap:8px}
.r-pv{display:inline-flex;align-items:center;justify-content:center;min-width:46px;height:28px;border-radius:8px;color:#fff;font-weight:800;font-size:14px;padding:0 8px}
.r-pli{list-style:none;margin:0;padding:0}
.r-pli li{padding:9px 2px 9px 46px;border-bottom:1px solid var(--line);font-size:14px;line-height:1.65;position:relative}
.r-pli li:last-child{border-bottom:0}
.r-pli li i{position:absolute;left:0;top:10px;font-style:normal;font-size:12px;color:var(--text3);width:44px;white-space:nowrap}
.r-pli mark,.r-hl{background:#ffe58a;color:inherit;border-radius:3px;padding:0 1px}
html[data-theme=dark] .r-pli mark,html[data-theme=dark] .r-hl{background:#6b5714}
.r-rule{padding:8px 0;border-bottom:1px solid var(--line);font-size:14px;line-height:1.6;display:flex;gap:8px;align-items:flex-start}
.r-rule:last-child{border-bottom:0}
.r-rule .tag{flex:none;margin-top:2px}
.r-acc{margin-bottom:10px}
.r-acc>summary{list-style:none;cursor:pointer;display:flex;align-items:center;justify-content:space-between;font-weight:700;font-size:16px}
.r-acc>summary::-webkit-details-marker{display:none}
.r-acc>summary::after{content:"›";transform:rotate(90deg);transition:.2s;color:var(--text3);font-size:22px}
.r-acc[open]>summary::after{transform:rotate(-90deg)}
.r-acc .r-req{font-size:13px;color:var(--text2);margin:8px 0;padding:8px 10px;background:var(--card2);border-radius:10px}
.r-pen{display:grid;grid-template-columns:1fr;gap:10px}
.r-pen .r-pi{padding:10px 0;border-bottom:1px solid var(--line)}
.r-pen .r-pi:last-child{border-bottom:0}
.r-pi h4{margin:0 0 4px;font-size:15px}
.r-pi .r-pm{display:flex;flex-wrap:wrap;gap:6px;margin-top:4px}
.r-pi p{margin:4px 0 0;font-size:13px;color:var(--text2)}
/* car */
.r-carwrap{display:grid;grid-template-columns:1fr;gap:14px;grid-template-areas:"ck" "info" "sim"}
.r-carwrap>.r-cockpit{grid-area:ck}.r-carwrap>.r-info{grid-area:info}.r-carwrap>.r-simc{grid-area:sim}
@media(min-width:900px){.r-carwrap{grid-template-columns:1.25fr 1fr;grid-template-areas:"ck info" "sim info"}.r-carwrap>.r-info{position:sticky;top:70px}}
.r-cockpit{background:linear-gradient(180deg,#2b3038,#16191e);border-radius:18px;padding:6px;box-shadow:var(--shadow)}
.r-cockpit svg{width:100%;height:auto;display:block}
.r-hot{cursor:pointer}
.r-hot:hover .r-hl2,.r-hot.on .r-hl2{stroke:#4c8dff;stroke-width:3;opacity:1}
.r-hl2{fill:none;stroke:transparent;opacity:0;transition:.15s}
.r-hot.on .r-hl2{animation:r-pulse 1.2s infinite}
@keyframes r-pulse{50%{opacity:.35}}
.r-info h3{margin-bottom:6px}
.r-info p,.r-info li{font-size:14px;color:var(--text2);line-height:1.7}
.r-info ul{padding-left:18px;margin:6px 0}
.r-sw{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}
.r-sw .btn{height:40px;font-size:13px;padding:0 6px}
.r-sw .btn.on{background:var(--pri);border-color:var(--pri);color:#fff}
.r-dashrow{display:flex;gap:6px;flex-wrap:wrap;justify-content:center;background:#0e1014;border-radius:12px;padding:8px;min-height:60px}
.r-dashrow svg{width:44px;height:44px;opacity:.15;transition:opacity .15s}
.r-dashrow svg.on{opacity:1}
.r-dashrow svg.blink{animation:r-blink .8s steps(1) infinite;opacity:1}
.r-mini{font-size:12px;color:var(--text3)}
`;
    document.head.appendChild(st);
  }

  /* ================= 通用 ================= */
  const sgWrap = s => `<span class="r-sg">${s}</span>`;
  function hl(text, q) {
    const t = esc(text); if (!q) return t;
    const qq = esc(q).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return t.replace(new RegExp(qq, 'g'), m => `<mark>${m}</mark>`);
  }
  function seg(opts, cur, onPick) {
    const d = document.createElement('div'); d.className = 'seg';
    d.innerHTML = opts.map(([k, n]) => `<button data-k="${k}" class="${k === cur ? 'on' : ''}">${n}</button>`).join('');
    d.onclick = e => { const b = e.target.closest('button'); if (!b) return; $$('button', d).forEach(x => x.classList.toggle('on', x === b)); onPick(b.dataset.k); };
    return d;
  }
  function detailModal(list, i, art) {
    let idx = i, close;
    const body = () => { const it = list[idx]; return `<div class="r-big">${art(it)}</div>${it.cat ? `<div class="center" style="margin-bottom:8px"><span class="tag blue">${esc(it.cat)}</span> <span class="tag">${idx + 1}/${list.length}</span></div>` : ''}${it.color ? `<div class="center" style="margin-bottom:8px">${colorTag(it.color)}</div>` : ''}<div class="r-desc">${esc(it.desc)}</div>`; };
    const upd = () => { const m = $('#modalRoot .modal-mask:last-child'); if (!m) return; $('h3', m).textContent = list[idx].name; $('.mbody', m).innerHTML = body(); };
    close = A.modal({
      title: esc(list[idx].name), html: body(), buttons: [
        { text: '‹ 上一个', onClick: () => { idx = (idx - 1 + list.length) % list.length; upd(); return false; } },
        { text: '下一个 ›', onClick: () => { idx = (idx + 1) % list.length; upd(); return false; } },
        { text: '关闭', primary: true }]
    });
    const key = e => { if (e.key === 'ArrowLeft') { idx = (idx - 1 + list.length) % list.length; upd(); } else if (e.key === 'ArrowRight') { idx = (idx + 1) % list.length; upd(); } else if (e.key === 'Escape') { close(); } };
    document.addEventListener('keydown', key);
    const mo = new MutationObserver(() => { if (!document.contains(m0)) { document.removeEventListener('keydown', key); mo.disconnect(); } });
    const m0 = $('#modalRoot .modal-mask:last-child'); if (m0) mo.observe($('#modalRoot'), { childList: true });
    life.add(() => { document.removeEventListener('keydown', key); mo.disconnect(); try { close(); } catch (e) { } });
  }
  const colorName = { red: '红色 · 危险/故障', yellow: '黄色 · 警示/注意', green: '绿色 · 工作状态', blue: '蓝色 · 远光提示' };
  const colorTag = c => `<span class="tag ${c === 'red' ? 'red' : c === 'yellow' ? 'orange' : c === 'green' ? 'green' : 'blue'}">${colorName[c]}</span>`;

  /* ---------- 通用闯关测验 ---------- */
  function quiz(box, pool, o) {
    const qb = bag(); life.add(() => qb.clear());
    const bestKey = 'ref_best_' + o.id;
    let score = 0, total = 0, streak = 0, best = A.store.get(bestKey, 0), recent = [], cur = null, artClean = null;
    box.innerHTML = `<div class="r-quiz">
      <div class="r-qhead"><div class="r-qstat"><span>答对<b class="qs">0</b>/<b class="qt">0</b></span><span>连对<b class="qk">0</b></span><span>最佳<b class="qb">${best}</b></span></div>
      <button class="btn sm ghost qr">重新开始</button></div>
      <div class="r-qart ${o.dark ? 'dk' : ''}"></div>
      <div class="muted small center" style="margin:-4px 0 10px">${o.prompt || '这是什么？'}</div>
      <div class="r-qopts"></div><div class="r-qfb"></div></div>`;
    const art = $('.r-qart', box), opts = $('.r-qopts', box), fb = $('.r-qfb', box);
    const stat = () => { $('.qs', box).textContent = score; $('.qt', box).textContent = total; $('.qk', box).textContent = streak; $('.qb', box).textContent = best; };
    function next() {
      qb.clear(); if (artClean) { artClean(); artClean = null; }
      let cand = pool.filter(p => !recent.includes(p.key)); if (!cand.length) cand = pool;
      cur = cand[rnd(cand.length)]; recent.push(cur.key); if (recent.length > Math.min(12, pool.length - 2)) recent.shift();
      const grp = o.group ? pool.filter(p => o.group(p) === o.group(cur)) : pool;
      const names = new Set([cur.name]), dis = [];
      for (const src of [shuffle(grp), shuffle(pool)]) for (const p of src) { if (dis.length >= 3) break; if (!names.has(p.name)) { names.add(p.name); dis.push(p); } }
      const choices = shuffle([cur, ...dis]);
      if (o.mountArt) { art.innerHTML = ''; artClean = o.mountArt(art, cur); } else art.innerHTML = `<div class="r-pop">${o.art(cur)}</div>`;
      opts.innerHTML = choices.map((c, i) => `<button class="r-qopt" data-i="${i}">${esc(c.name)}</button>`).join('');
      fb.innerHTML = '';
      $$('.r-qopt', opts).forEach((b, i) => b.onclick = () => pick(b, choices[i]));
    }
    function pick(b, c) {
      total++;
      const right = c.key === cur.key || c.name === cur.name;
      $$('.r-qopt', opts).forEach((x, i) => { x.disabled = true; if (x.textContent === cur.name) x.classList.add('ok'); });
      if (right) { score++; streak++; if (streak > best) { best = streak; A.store.set(bestKey, best); } A.beep('ok'); }
      else { b.classList.add('bad'); streak = 0; A.beep('bad'); A.vibrate(60); }
      stat();
      fb.innerHTML = `<div class="note ${right ? 'ok' : 'bad'}"><b>${right ? '✓ 回答正确' : '✗ 正确答案：' + esc(cur.name)}</b>${streak >= 3 ? ` <span class="r-streak">连对 ${streak}</span>` : ''}<div class="small" style="margin-top:4px;color:var(--text2)">${esc(cur.desc)}</div></div>
        <div class="center" style="margin-top:10px"><button class="btn primary qn">下一题 ›</button></div>`;
      $('.qn', fb).onclick = next;
      if (right) qb.timeout(next, o.autoMs || 1600);
    }
    $('.qr', box).onclick = () => { score = total = streak = 0; stat(); next(); };
    const kh = e => { if (!box.isConnected) return; const n = +e.key; if (n >= 1 && n <= 4) { const b = $$('.r-qopt', opts)[n - 1]; if (b && !b.disabled) b.click(); } else if (e.key === 'Enter') { const b = $('.qn', fb); if (b) b.click(); } };
    document.addEventListener('keydown', kh); life.add(() => document.removeEventListener('keydown', kh)); qb.add(() => { });
    next();
    return () => { qb.clear(); if (artClean) artClean(); document.removeEventListener('keydown', kh); };
  }

  /* ================= 首页（Hub） ================= */
  const TILES = [
    ['signs', '交通标志图鉴', '警告·禁令·指示·指路 近200种，含闯关测验', () => SG().svg('w_children', 52), '#ef4444'],
    ['marks', '道路标线', '黄线白线、虚实线、导流线、待转区', () => SG().svg('mk_solid_dashed', 52), '#64748b'],
    ['dash', '仪表盘指示灯', '红黄绿蓝 40 种指示灯含义与处理', () => SG().dash('engine', 52), '#f59e0b'],
    ['gestures', '交警手势', '8 种指挥手势动画演示 + 口诀 + 测验', () => `<svg viewBox="0 0 52 52"><rect width="52" height="52" rx="14" fill="#0ea5e9"/><circle cx="26" cy="14" r="6" fill="#fff"/><path d="M20 22h12l3 16h-18z" fill="#fff"/><path d="M32 23l12-10M20 23l-6 12" stroke="#fff" stroke-width="4" stroke-linecap="round"/><path d="M21 38l-1 9M31 38l1 9" stroke="#fff" stroke-width="4" stroke-linecap="round"/></svg>`, '#0ea5e9'],
    ['lights', '交通信号灯', '机动车/方向/车道/人行/闪光警告灯规则', () => `<svg viewBox="0 0 52 52"><rect x="15" y="2" width="22" height="48" rx="8" fill="#1f2328"/><circle cx="26" cy="13" r="6" fill="#ff3b30"/><circle cx="26" cy="26" r="6" fill="#ffb300"/><circle cx="26" cy="39" r="6" fill="#22d36b"/></svg>`, '#22c55e'],
    ['points', '记分规则', '2022 新记分办法 12/9/6/3/1 分全表', () => `<svg viewBox="0 0 52 52"><rect width="52" height="52" rx="14" fill="#6366f1"/><text x="26" y="34" font-size="22" font-weight="800" text-anchor="middle" fill="#fff" font-family="Arial">12</text></svg>`, '#6366f1'],
    ['k2rules', '科目二评判标准', '倒库、侧方、坡起、直角、曲线扣分点', () => `<svg viewBox="0 0 52 52"><rect width="52" height="52" rx="14" fill="#10b981"/><path d="M14 40V14h24v26" fill="none" stroke="#fff" stroke-width="3"/><rect x="19" y="22" width="14" height="16" rx="3" fill="#fff"/></svg>`, '#10b981'],
    ['k3rules', '科目三评判标准', '16 个项目 + 灯光 + 通用评判', () => `<svg viewBox="0 0 52 52"><rect width="52" height="52" rx="14" fill="#f97316"/><path d="M20 50L24 2M32 50L28 2" stroke="#fff" stroke-width="3"/><path d="M26 6v6M26 18v6M26 30v6M26 42v6" stroke="#fff" stroke-width="2"/></svg>`, '#f97316'],
    ['penalty', '常见违法处罚', '酒驾醉驾、超速、闯红灯、无证驾驶…', () => `<svg viewBox="0 0 52 52"><rect width="52" height="52" rx="14" fill="#e11d48"/><text x="26" y="35" font-size="24" font-weight="800" text-anchor="middle" fill="#fff" font-family="Arial">¥</text></svg>`, '#e11d48'],
    ['car', '汽车构造与操作', '驾驶舱交互图：灯光、雨刮、挡位、踏板', () => `<svg viewBox="0 0 52 52"><rect width="52" height="52" rx="14" fill="#334155"/><circle cx="26" cy="26" r="15" fill="none" stroke="#fff" stroke-width="4"/><circle cx="26" cy="26" r="4" fill="#fff"/><path d="M11 26h11M30 26h11M26 30v11" stroke="#fff" stroke-width="4"/></svg>`, '#334155']
  ];
  function pageHub(el) {
    A.setTitle('图鉴 · 知识库');
    el.innerHTML = `<div class="r-wrap fade-in"><div class="r-hub">${TILES.map(t => `<div class="r-tile" data-go="#/ref/${t[0]}" style="--tc:${t[4]}"><div class="r-ti">${t[3]()}</div><b>${t[1]}</b><span>${t[2]}</span></div>`).join('')}</div>
    <div class="note" style="margin-top:14px">小技巧：在标志、指示灯、手势页面切换到「闯关测验」模式，可快速检验记忆效果，键盘 1–4 选择答案、Enter 下一题。</div></div>`;
    $$('.r-tile', el).forEach(t => t.onclick = () => A.go(t.dataset.go));
  }

  /* ================= 交通标志 ================= */
  function pageSigns(el, query) {
    A.setTitle('交通标志图鉴');
    const S = SG(), all = S.list.filter(s => s.cat !== '道路标线');
    const cats = ['全部', '警告标志', '禁令标志', '指示标志', '指路标志', '其他'];
    let cat = query.cat && cats.includes(query.cat) ? query.cat : '全部', q = '', mode = query.mode === 'quiz' ? 'quiz' : 'list', qclean = null;
    el.innerHTML = `<div class="r-wrap fade-in"><div class="r-bar r-top"></div><div class="r-tabs" style="margin-bottom:12px"></div><div class="r-body"></div></div>`;
    const top = $('.r-top', el), tabs = $('.r-tabs', el), body = $('.r-body', el);
    top.appendChild(seg([['list', '图鉴'], ['quiz', '闯关测验']], mode, m => { mode = m; draw(); }));
    const inp = document.createElement('input'); inp.className = 'r-search'; inp.placeholder = '搜索标志名称或含义…'; inp.type = 'search'; top.appendChild(inp);
    inp.oninput = () => { q = inp.value.trim(); if (mode === 'list') grid(); };
    const cnt = c => c === '全部' ? all.length : all.filter(s => s.cat === c).length;
    function drawTabs() { tabs.innerHTML = cats.map(c => `<button class="r-tab ${c === cat ? 'on' : ''}" data-c="${c}">${c === '全部' ? '全部' : c.replace('标志', '')}<i>${cnt(c)}</i></button>`).join(''); }
    tabs.onclick = e => { const b = e.target.closest('.r-tab'); if (!b) return; cat = b.dataset.c; drawTabs(); draw(); };
    function items() { return all.filter(s => (cat === '全部' || s.cat === cat) && (!q || s.name.includes(q) || s.desc.includes(q) || s.key.includes(q))); }
    function grid() {
      const L = items();
      body.innerHTML = L.length ? `<div class="r-grid">${L.map((s, i) => `<div class="r-card" data-i="${i}">${sgWrap(S.svg(s.key, 76))}<div class="r-nm">${hl(s.name, q)}</div></div>`).join('')}</div>` : `<div class="r-empty">没有找到「${esc(q)}」相关标志</div>`;
      $$('.r-card', body).forEach(c => c.onclick = () => detailModal(L, +c.dataset.i, s => sgWrap(S.svg(s.key, 180))));
    }
    function draw() {
      if (qclean) { qclean(); qclean = null; }
      inp.style.display = mode === 'list' ? '' : 'none';
      if (mode === 'list') grid();
      else { const pool = cat === '全部' ? all : all.filter(s => s.cat === cat); qclean = quiz(body, pool, { id: 'signs', art: s => sgWrap(S.svg(s.key, 190)), group: s => s.cat, prompt: '这个标志表示什么？' }); }
    }
    drawTabs(); draw();
  }

  /* ================= 道路标线 ================= */
  const MARK_GROUPS = [
    ['纵向标线', ['mk_center_solid', 'mk_center_double', 'mk_center_dashed', 'mk_solid_dashed', 'mk_white_dashed', 'mk_white_solid', 'mk_edge', 'mk_bus_lane', 'mk_tidal', 'mk_variable_lane', 'mk_no_parking_yellow']],
    ['横向标线', ['mk_stop_line', 'mk_stop_yield_line', 'mk_yield_line', 'mk_crosswalk', 'mk_deceleration']],
    ['其他标线', ['mk_crosswalk_warn', 'mk_guide_arrows', 'mk_turn_wait', 'mk_guide_line', 'mk_diversion', 'mk_netting', 'mk_fish_bone', 'mk_parking']]
  ];
  function pageMarks(el) {
    A.setTitle('道路标线');
    const S = SG(), all = S.list.filter(s => s.cat === '道路标线');
    let mode = 'list', q = '', qclean = null;
    el.innerHTML = `<div class="r-wrap fade-in"><div class="r-bar r-top"></div><div class="r-body"></div></div>`;
    const top = $('.r-top', el), body = $('.r-body', el);
    top.appendChild(seg([['list', '标线详解'], ['quiz', '闯关测验']], mode, m => { mode = m; draw(); }));
    const inp = document.createElement('input'); inp.className = 'r-search'; inp.placeholder = '搜索标线…'; inp.type = 'search'; top.appendChild(inp);
    inp.oninput = () => { q = inp.value.trim(); draw(); };
    function draw() {
      if (qclean) { qclean(); qclean = null; }
      inp.style.display = mode === 'list' ? '' : 'none';
      if (mode === 'quiz') { qclean = quiz(body, all, { id: 'marks', art: s => S.svg(s.key, 190), prompt: '这是什么标线？' }); return; }
      const used = new Set(); let html = `<div class="note" style="margin-bottom:12px"><b>颜色口诀：</b>白线分同向，黄线分对向；虚线可越、实线禁越；黄色路缘线禁止停车。<br><b>标线分类：</b>指示标线（可以怎么走）、禁止标线（不能怎么走）、警告标线（注意什么）。</div>`;
      MARK_GROUPS.forEach(([g, keys]) => {
        const L = keys.map(k => all.find(s => s.key === k)).filter(Boolean).filter(s => { used.add(s.key); return !q || s.name.includes(q) || s.desc.includes(q); });
        if (!L.length) return;
        html += `<div class="section-title">${g}</div><div class="r-mlist">${L.map(s => `<div class="r-mitem" data-k="${s.key}">${S.svg(s.key, 96)}<div><h4>${hl(s.name, q)}</h4><p>${hl(s.desc, q)}</p></div></div>`).join('')}</div>`;
      });
      const rest = all.filter(s => !used.has(s.key) && (!q || s.name.includes(q) || s.desc.includes(q)));
      if (rest.length) html += `<div class="section-title">更多</div><div class="r-mlist">${rest.map(s => `<div class="r-mitem" data-k="${s.key}">${S.svg(s.key, 96)}<div><h4>${hl(s.name, q)}</h4><p>${hl(s.desc, q)}</p></div></div>`).join('')}</div>`;
      body.innerHTML = html;
      const flat = $$('.r-mitem', body).map(x => all.find(s => s.key === x.dataset.k));
      $$('.r-mitem', body).forEach((x, i) => x.onclick = () => detailModal(flat, i, s => S.svg(s.key, 220)));
    }
    draw();
  }

  /* ================= 仪表盘指示灯 ================= */
  function pageDash(el) {
    A.setTitle('仪表盘指示灯');
    const S = SG(), all = S.dashList;
    let mode = 'list', col = 'all', qclean = null;
    el.innerHTML = `<div class="r-wrap fade-in"><div class="r-bar r-top"></div><div class="r-body"></div></div>`;
    const top = $('.r-top', el), body = $('.r-body', el);
    top.appendChild(seg([['list', '指示灯大全'], ['quiz', '闯关测验']], mode, m => { mode = m; draw(); }));
    function draw() {
      if (qclean) { qclean(); qclean = null; }
      if (mode === 'quiz') { qclean = quiz(body, all, { id: 'dash', dark: true, art: d => S.dash(d.key, 170), group: d => d.color, prompt: '这个指示灯表示什么？' }); return; }
      const L = col === 'all' ? all : all.filter(d => d.color === col);
      body.innerHTML = `<div class="r-tabs" style="margin-bottom:12px">${[['all', '全部', ''], ['red', '红色', '#ff3b30'], ['yellow', '黄色', '#ffb020'], ['green', '绿色', '#2fd46b'], ['blue', '蓝色', '#3d8bff']].map(([k, n, c]) => `<button class="r-tab ${k === col ? 'on' : ''}" data-c="${k}">${c ? `<span class="r-dot" style="background:${c}"></span> ` : ''}${n}<i>${k === 'all' ? all.length : all.filter(d => d.color === k).length}</i></button>`).join('')}</div>
      <div class="r-dark"><div class="r-dgrid">${L.map((d, i) => `<div class="r-dcell" data-i="${i}">${S.dash(d.key, 64)}<span>${esc(d.name)}</span></div>`).join('')}</div></div>
      <div class="card" style="margin-top:14px"><div class="card-title">颜色含义</div>
      <div class="r-rule"><span class="tag red">红色</span><span>危险或严重故障（机油压力、水温、制动、充电、安全气囊等），应尽快<b>安全停车</b>检查，不宜继续行驶。</span></div>
      <div class="r-rule"><span class="tag orange">黄色</span><span>警示或一般故障（发动机故障、ABS、胎压、燃油不足等），可谨慎行驶并尽快检修。</span></div>
      <div class="r-rule"><span class="tag green">绿色</span><span>功能正在工作（近光、示廓灯、转向、巡航等），属于状态提示。</span></div>
      <div class="r-rule"><span class="tag blue">蓝色</span><span>远光灯开启。会车、跟车及照明良好路段要及时切换近光。</span></div>
      <p class="small muted" style="margin:8px 0 0">点火开关置于 ON 时多数指示灯会自检点亮数秒后熄灭，属正常现象；发动机启动后仍常亮才表示异常。</p></div>`;
      $$('.r-tab', body).forEach(b => b.onclick = () => { col = b.dataset.c; draw(); });
      $$('.r-dcell', body).forEach(c => c.onclick = () => detailModal(L, +c.dataset.i, d => S.dash(d.key, 180)));
    }
    draw();
  }

  /* ================= 交警手势 ================= */
  const RS = [7, 0];
  const GES = [
    { k: 'stop', yaw: 25, name: '停止信号', mean: '不准前方车辆通行。', kou: '左手高举掌向前，前方车辆都停下。',
      steps: ['左臂由前向上直伸与身体成135度，掌心向前与身体平行，五指并拢，面部及目光平视前方', '左臂放下，恢复立正姿势'],
      kf: [[0, RS, RS, 0, 0], [0.9, [135, 62], RS, 0, 0], [3.0, [135, 62], RS, 0, 0], [3.8, RS, RS, 0, 1], [4.5, RS, RS, 0, 1]] },
    { k: 'straight', yaw: -25, name: '直行信号', mean: '准许右方直行的车辆通行。', kou: '双臂平伸成一字，右手摆动放右方直行。',
      steps: ['左臂向左平伸与身体成90度，五指并拢，掌心向前，面部及目光同时向左方45度', '右臂向右平伸与身体成90度，五指并拢，掌心向前，面部及目光同时向右方45度', '右臂水平向左摆动与身体成90度（摆至正前方），完成第一次摆动', '右臂回到向右平伸位置，再向左摆动一次，完成第二次摆动', '双臂同时放下，恢复立正姿势，面部及目光平视前方'],
      kf: [[0, RS, RS, 0, 0], [0.9, [90, 0], RS, 45, 0], [1.8, [90, 0], [90, 0], -45, 1], [2.7, [90, 0], [90, 88], -45, 2], [3.5, [90, 0], [90, 0], -45, 3], [4.4, [90, 0], [90, 88], -45, 3], [5.3, RS, RS, 0, 4], [6.0, RS, RS, 0, 4]] },
    { k: 'left', yaw: -32, name: '左转弯信号', mean: '准许车辆左转弯，在不妨碍被放行车辆通行的情况下可以掉头。', kou: '右手前推挡直行，左手往右前方摆，左转车辆可以走。',
      steps: ['右臂向前平伸与身体成90度，掌心向前，五指并拢，面部及目光同时向左方45度', '左臂与手掌平直向右前方摆动，手臂与身体成45度，掌心向右，完成第一次摆动', '左臂收回后，再向右前方摆动一次，完成第二次摆动', '双臂同时放下，恢复立正姿势，面部及目光平视前方'],
      kf: [[0, RS, RS, 0, 0], [0.9, RS, [90, 90], 45, 0], [1.8, [45, 150], [90, 90], 45, 1], [2.5, RS, [90, 90], 45, 2], [3.3, [45, 150], [90, 90], 45, 2], [4.2, RS, RS, 0, 3], [4.9, RS, RS, 0, 3]] },
    { k: 'leftwait', yaw: 22, name: '左转弯待转信号', mean: '准许车辆进入路口，沿左转弯行驶方向靠近路口中心，等候左转弯信号。', kou: '左手斜下往下压，左转车辆进路口等一等。',
      steps: ['左臂向左下方平伸与身体成45度，掌心向下，五指并拢，面部及目光同时向左方45度', '左臂与手掌平直向下方摆动，手臂与身体成15度，完成第一次摆动', '左臂回到45度位置，再向下摆动一次，完成第二次摆动', '左臂放下，恢复立正姿势，面部及目光平视前方'],
      kf: [[0, RS, RS, 0, 0], [0.9, [45, 8], RS, 45, 0], [1.7, [15, 8], RS, 45, 1], [2.4, [45, 8], RS, 45, 2], [3.2, [15, 8], RS, 45, 2], [4.0, RS, RS, 0, 3], [4.7, RS, RS, 0, 3]] },
    { k: 'right', yaw: 32, name: '右转弯信号', mean: '准许右方的车辆右转弯。', kou: '左手前推挡来车，右手往左前方摆，右转车辆可以走。',
      steps: ['左臂向前平伸与身体成90度，掌心向前，五指并拢，面部及目光同时向右方45度', '右臂与手掌平直向左前方摆动，手臂与身体成45度，掌心向左，完成第一次摆动', '右臂收回后，再向左前方摆动一次，完成第二次摆动', '双臂同时放下，恢复立正姿势，面部及目光平视前方'],
      kf: [[0, RS, RS, 0, 0], [0.9, [90, 90], RS, -45, 0], [1.8, [90, 90], [45, 150], -45, 1], [2.5, [90, 90], RS, -45, 2], [3.3, [90, 90], [45, 150], -45, 2], [4.2, RS, RS, 0, 3], [4.9, RS, RS, 0, 3]] },
    { k: 'lane', yaw: -32, name: '变道信号', mean: '车辆应当腾空指定的车道，减速慢行。', kou: '右手平伸向左摆，腾空车道减速开。',
      steps: ['面向来车方向，右臂向前平伸与身体成90度，掌心向左，五指并拢，面部及目光平视前方', '右臂向左水平摆动与身体成45度，完成第一次摆动', '右臂回到前平伸位置，再向左水平摆动一次，完成第二次摆动', '右臂放下，恢复立正姿势'],
      kf: [[0, RS, RS, 0, 0], [0.9, RS, [90, 90], 0, 0], [1.7, RS, [90, 135], 0, 1], [2.4, RS, [90, 90], 0, 2], [3.2, RS, [90, 135], 0, 2], [4.0, RS, RS, 0, 3], [4.7, RS, RS, 0, 3]] },
    { k: 'slow', yaw: -32, name: '减速慢行信号', mean: '车辆应当减速慢行。', kou: '右手斜伸往下压，前方车辆减速慢行。',
      steps: ['右臂向右前方平伸，与肩平行，与身体成135度，掌心向下，五指并拢，面部及目光同时向右方45度', '右臂与手掌平直向下方摆动，手臂与身体成45度，完成第一次摆动', '右臂回到平伸位置，再向下摆动一次，完成第二次摆动', '右臂放下，恢复立正姿势，面部及目光平视前方'],
      kf: [[0, RS, RS, 0, 0], [0.9, RS, [90, 45], -45, 0], [1.7, RS, [45, 45], -45, 1], [2.4, RS, [90, 45], -45, 2], [3.2, RS, [45, 45], -45, 2], [4.0, RS, RS, 0, 3], [4.7, RS, RS, 0, 3]] },
    { k: 'pull', yaw: -32, name: '示意车辆靠边停车信号', mean: '车辆应当靠边停车。', kou: '左手高举叫你停，右手横摆赶你靠边停。',
      steps: ['面向来车方向，左臂由前向上直伸与身体成135度，掌心向前与身体平行，五指并拢，面部及目光平视前方', '右臂前伸与身体成45度，掌心向左', '右臂向左水平摆动，完成第一次摆动', '右臂收回后再向左水平摆动一次，完成第二次摆动', '双臂同时放下，恢复立正姿势'],
      kf: [[0, RS, RS, 0, 0], [0.9, [135, 62], RS, 0, 0], [1.7, [135, 62], [90, 45], 0, 1], [2.5, [135, 62], [90, 115], 0, 2], [3.2, [135, 62], [90, 45], 0, 3], [4.0, [135, 62], [90, 115], 0, 3], [4.9, RS, RS, 0, 4], [5.6, RS, RS, 0, 4]] }
  ];
  const ease = t => t < .5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
  function poseAt(g, t) {
    const kf = g.kf; if (t <= 0) return kf[0];
    for (let i = 1; i < kf.length; i++) if (t <= kf[i][0]) {
      const a = kf[i - 1], b = kf[i], u = ease((t - a[0]) / (b[0] - a[0] || 1)), l = (x, y) => x + (y - x) * u;
      return [t, [l(a[1][0], b[1][0]), l(a[1][1], b[1][1])], [l(a[2][0], b[2][0]), l(a[2][1], b[2][1])], l(a[3], b[3]), b[4]];
    }
    return kf[kf.length - 1];
  }
  const NS = 'http://www.w3.org/2000/svg';
  function Police(svg) {
    let yaw = 28 * Math.PI / 180;
    const pitch = 9 * Math.PI / 180, F = 560;
    svg.setAttribute('viewBox', '-110 -150 220 290');
    const mk = (tag, at, par) => { const e = document.createElementNS(NS, tag); for (const k in at) e.setAttribute(k, at[k]); (par || svg).appendChild(e); return e; };
    const back = mk('g', {}), bodyG = mk('g', {}), front = mk('g', {});
    const proj = (x, y, z) => {
      const X = x * Math.cos(yaw) + z * Math.sin(yaw), Dz = -x * Math.sin(yaw) + z * Math.cos(yaw);
      const Y = y * Math.cos(pitch) + Dz * Math.sin(pitch), k = F / (F - Dz);
      return [X * k, (Y + 30) * k - 30, Dz];
    };
    const pts = arr => arr.map(p => { const q = proj(...p); return q[0].toFixed(1) + ' ' + q[1].toFixed(1); });
    const pathOf = arr => 'M' + pts(arr).join('L') + 'Z';
    const mkArm = () => { const g = mk('g', {}); return { g, sl: mk('path', { fill: 'none', stroke: '#1c2b45', 'stroke-width': 14, 'stroke-linecap': 'round' }, g), st: mk('path', { fill: 'none', stroke: '#d8e04a', 'stroke-width': 3, 'stroke-linecap': 'round', opacity: .9 }, g), cf: mk('path', { fill: 'none', stroke: '#e6e9ee', 'stroke-width': 13, 'stroke-linecap': 'round' }, g), gl: mk('path', { fill: 'none', stroke: '#9aa3ad', 'stroke-width': 13.5, 'stroke-linecap': 'round' }, g), gw: mk('path', { fill: 'none', stroke: '#ffffff', 'stroke-width': 11, 'stroke-linecap': 'round' }, g) }; };
    const arms = { L: mkArm(), R: mkArm() };
    let head = null;
    function drawBody() {
      bodyG.innerHTML = '';
      const sh = (e, at) => mk(e, at, bodyG);
      const sx = Math.abs(Math.cos(yaw));
      // 影子
      sh('ellipse', { cx: 0, cy: 124, rx: 46, ry: 9, fill: '#0003' });
      // 腿与鞋
      for (const s of [-1, 1]) {
        const a = proj(s * 11, 10, 0), b = proj(s * 12, 116, 0);
        sh('path', { d: `M${a[0]} ${a[1]}L${b[0]} ${b[1]}`, stroke: '#1a2740', 'stroke-width': 17, 'stroke-linecap': 'round' });
        sh('path', { d: `M${a[0]} ${a[1] + 30}L${b[0]} ${b[1] - 8}`, stroke: '#24344f', 'stroke-width': 1.2, opacity: .6 });
        sh('path', { d: pathOf([[s * 12 - 7, 114, -6], [s * 12 + 7, 114, -6], [s * 12 + 7, 122, 14], [s * 12 - 7, 122, 14]]), fill: '#0d0f12', 'stroke-linejoin': 'round', stroke: '#0d0f12', 'stroke-width': 4 });
      }
      // 躯干
      sh('path', { d: pathOf([[-26, -74, 0], [26, -74, 0], [21, 14, 0], [-21, 14, 0]]), fill: '#1c2b45', stroke: '#1c2b45', 'stroke-width': 6, 'stroke-linejoin': 'round' });
      // 反光背心
      sh('path', { d: pathOf([[-24, -70, 1], [-9, -70, 1], [0, -44, 1], [9, -70, 1], [24, -70, 1], [20, 8, 1], [-20, 8, 1]]), fill: '#c9ec2c', stroke: '#b7d61f', 'stroke-width': 1.5, 'stroke-linejoin': 'round' });
      for (const y of [-22, -8]) sh('path', { d: pathOf([[-22, y, 1.5], [22, y, 1.5], [22, y + 5, 1.5], [-22, y + 5, 1.5]]), fill: '#e3e7ec', opacity: .95 });
      sh('path', { d: pathOf([[-22, -2, 1.6], [22, -2, 1.6], [22, 4, 1.6], [-22, 4, 1.6]]), fill: '#f2f2f2' });
      const bk = proj(0, 1, 2); sh('rect', { x: bk[0] - 4, y: bk[1] - 3.5, width: 8, height: 7, rx: 1.5, fill: '#c9a227' });
      // 领口、领带
      sh('path', { d: pathOf([[-7, -74, 1.5], [7, -74, 1.5], [0, -62, 1.5]]), fill: '#cfe0f2' });
      sh('path', { d: pathOf([[-2, -70, 2], [2, -70, 2], [3, -50, 2], [0, -46, 2], [-3, -50, 2]]), fill: '#1b2333' });
      const bd = proj(-15, -40, 2); sh('text', { x: bd[0], y: bd[1], 'font-size': 6, fill: '#1c2b45', 'font-weight': 700, 'text-anchor': 'middle', 'font-family': 'sans-serif' }).textContent = '交警';
      // 颈部、头
      const nk = proj(0, -80, 0); sh('rect', { x: nk[0] - 6 * sx - 1, y: nk[1] - 8, width: 12 * sx + 2, height: 12, fill: '#e9b991' });
      head = { g: mk('g', {}, bodyG) };
      const hc = proj(0, -100, 0);
      head.c = hc;
      mk('ellipse', { cx: hc[0], cy: hc[1], rx: 14, ry: 16, fill: '#f0c49e' }, head.g);
      head.eL = mk('circle', { r: 1.8, fill: '#222' }, head.g); head.eR = mk('circle', { r: 1.8, fill: '#222' }, head.g);
      head.nose = mk('path', { fill: 'none', stroke: '#c98d66', 'stroke-width': 1.5, 'stroke-linecap': 'round' }, head.g);
      head.mouth = mk('path', { fill: 'none', stroke: '#a5564a', 'stroke-width': 1.6, 'stroke-linecap': 'round' }, head.g);
      // 警帽
      head.cap = mk('path', { fill: '#1c2b45' }, head.g);
      head.band = mk('path', { fill: '#111826' }, head.g);
      head.visor = mk('path', { fill: '#0b0d10' }, head.g);
      head.badge = mk('circle', { r: 3.2, fill: '#d8b23a', stroke: '#8a6d12', 'stroke-width': .6 }, head.g);
    }
    function setHead(hd) {
      const c = head.c, a = hd * Math.PI / 180 + yaw, s = Math.sin(a), co = Math.cos(a);
      const f = (dx, dy) => [c[0] + dx * co + s * 12, c[1] + dy];
      const eL = f(5, -2), eR = f(-5, -2);
      head.eL.setAttribute('cx', eL[0]); head.eL.setAttribute('cy', eL[1]); head.eR.setAttribute('cx', eR[0]); head.eR.setAttribute('cy', eR[1]);
      const vis = co > -.1; head.eL.style.opacity = head.eR.style.opacity = vis ? 1 : 0;
      head.eL.setAttribute('r', 1.2 + .6 * Math.max(0, co)); head.eR.setAttribute('r', 1.2 + .6 * Math.max(0, co));
      const n = f(0, 4); head.nose.setAttribute('d', `M${n[0]} ${n[1] - 4}L${n[0] + s * 3} ${n[1]}L${n[0]} ${n[1] + .5}`);
      const m = f(0, 9); head.mouth.setAttribute('d', `M${m[0] - 3 * co} ${m[1]}Q${m[0]} ${m[1] + 1.6} ${m[0] + 3 * co} ${m[1]}`);
      head.cap.setAttribute('d', `M${c[0] - 15} ${c[1] - 9}Q${c[0] - 18} ${c[1] - 24} ${c[0]} ${c[1] - 27}Q${c[0] + 18} ${c[1] - 24} ${c[0] + 15} ${c[1] - 9}Z`);
      head.band.setAttribute('d', `M${c[0] - 15} ${c[1] - 13}H${c[0] + 15}V${c[1] - 7}H${c[0] - 15}Z`);
      const vx = c[0] + s * 13, vw = 11 + 4 * Math.abs(co);
      head.visor.setAttribute('d', `M${vx - vw} ${c[1] - 8}Q${vx} ${c[1] - 2 + 2 * Math.abs(co)} ${vx + vw} ${c[1] - 8}Z`);
      head.badge.setAttribute('cx', c[0] + s * 13); head.badge.setAttribute('cy', c[1] - 18); head.badge.style.opacity = co > 0 ? 1 : 0;
    }
    function arm(side, a, h) {
      const sg = side === 'L' ? 1 : -1, ar = a * Math.PI / 180, hr = h * Math.PI / 180;
      const d = [sg * Math.sin(ar) * Math.cos(hr), Math.cos(ar), Math.sin(ar) * Math.sin(hr)];
      const S0 = [sg * 24, -70, 0], at = l => [S0[0] + d[0] * l, S0[1] + d[1] * l, S0[2] + d[2] * l];
      const p0 = proj(...S0), p1 = proj(...at(58)), p2 = proj(...at(62)), p3 = proj(...at(64)), p4 = proj(...at(76)), pv = proj(...at(48));
      const A_ = arms[side], line = (p, q) => `M${p[0].toFixed(1)} ${p[1].toFixed(1)}L${q[0].toFixed(1)} ${q[1].toFixed(1)}`;
      A_.sl.setAttribute('d', line(p0, p1));
      A_.st.setAttribute('d', line(pv, proj(...at(52))));
      A_.cf.setAttribute('d', line(p1, p2));
      A_.gl.setAttribute('d', line(p3, p4)); A_.gw.setAttribute('d', line(p3, p4));
      const k = F / (F - p4[2]); A_.gw.setAttribute('stroke-width', (11 * k).toFixed(1)); A_.gl.setAttribute('stroke-width', (13.5 * k).toFixed(1));
      const depth = (p0[2] + p4[2]) / 2 + (side === 'L' ? -Math.sin(yaw) * 6 : Math.sin(yaw) * 6);
      const want = depth > -2 ? front : back;
      if (A_.g.parentNode !== want) want.appendChild(A_.g);
    }
    function set(p) { arm('L', p[1][0], p[1][1]); arm('R', p[2][0], p[2][1]); setHead(p[3]); }
    drawBody();
    return { set, setYaw(deg) { yaw = deg * Math.PI / 180; drawBody(); } };
  }
  function gesturePlayer(stage, opts = {}) {
    stage.innerHTML = `<svg></svg><span class="r-dir" style="left:8px">交警右手</span><span class="r-dir" style="right:8px">交警左手</span>${opts.caption === false ? '' : '<div class="r-cap"></div>'}`;
    const pol = Police($('svg', stage)), cap = $('.r-cap', stage);
    let g = null, t = 0, last = 0, playing = true, loop = true, speed = 1, raf = 0, stepIdx = -1, view = opts.view || 'auto';
    const applyView = () => { if (!g) return; const y = view === 'front' ? 0 : view === 'side' ? Math.sign(g.yaw) * 72 : g.yaw; pol.setYaw(y); stepIdx = -1; };
    const total = () => g.kf[g.kf.length - 1][0];
    function frame(ts) {
      raf = requestAnimationFrame(frame);
      const dt = last ? Math.min(.05, (ts - last) / 1000) : 0; last = ts;
      if (!g) return;
      if (playing) { t += dt * speed; if (t > total()) { if (loop) t = 0; else { t = total(); playing = false; opts.onEnd && opts.onEnd(); } } }
      const p = poseAt(g, t); pol.set(p);
      if (p[4] !== stepIdx) { stepIdx = p[4]; if (cap) cap.textContent = `${stepIdx + 1}. ${g.steps[stepIdx]}`; opts.onStep && opts.onStep(stepIdx); }
    }
    raf = requestAnimationFrame(frame);
    const api = {
      load(ng) { g = ng; t = 0; stepIdx = -1; playing = true; applyView(); },
      play() { if (t >= total()) t = 0; playing = true; }, pause() { playing = false; }, toggle() { playing ? api.pause() : api.play(); return playing; },
      get playing() { return playing; }, setLoop(v) { loop = v; }, setSpeed(v) { speed = v; }, restart() { t = 0; playing = true; },
      setView(v) { view = v; applyView(); },
      seekStep(i) { const f = g.kf.find(k => k[4] === i && k[0] > 0) || g.kf[0]; t = f[0] - .01; },
      destroy() { cancelAnimationFrame(raf); }
    };
    return api;
  }
  function pageGestures(el, query) {
    A.setTitle('交警手势');
    let cur = GES.find(g => g.k === query.g) || GES[0], mode = 'learn', player = null, qclean = null;
    el.innerHTML = `<div class="r-wrap fade-in"><div class="r-bar r-top"></div><div class="r-body"></div></div>`;
    const top = $('.r-top', el), body = $('.r-body', el);
    top.appendChild(seg([['learn', '动画学习'], ['quiz', '手势测验']], mode, m => { mode = m; draw(); }));
    const kill = () => { if (player) { player.destroy(); player = null; } if (qclean) { qclean(); qclean = null; } };
    life.add(kill);
    function draw() {
      kill();
      if (mode === 'quiz') {
        qclean = quiz(body, GES.map(g => ({ key: g.k, name: g.name, desc: g.mean + ' 口诀：' + g.kou, g })), {
          id: 'gest', prompt: '交警正在做什么手势？（可循环观看）', autoMs: 2200,
          mountArt: (box, it) => { box.innerHTML = '<div class="r-stage" style="max-width:300px"></div>'; const p = gesturePlayer($('.r-stage', box), { caption: false }); p.load(it.g); return () => p.destroy(); }
        });
        return;
      }
      body.innerHTML = `<div class="r-glist">${GES.map(g => `<button class="r-gbtn ${g === cur ? 'on' : ''}" data-k="${g.k}">${g.name.replace('信号', '').replace('示意车辆', '')}</button>`).join('')}</div>
      <div class="r-gwrap"><div><div class="r-stage"></div>
        <div class="r-ctrl"><button class="btn sm primary gp">⏸ 暂停</button><button class="btn sm gr">↺ 重播</button>
        <div class="seg gs"><button data-s=".5">0.5×</button><button data-s="1" class="on">1×</button><button data-s="1.5">1.5×</button></div>
        <div class="seg gv"><button data-v="auto" class="on">侧前</button><button data-v="front">正面</button><button data-v="side">侧面</button></div>
        <label class="row small" style="gap:6px">循环<span class="switch"><input type="checkbox" class="gl" checked><span></span></span></label></div></div>
      <div class="card r-ginfo" style="margin:0"></div></div>
      <div class="note warn" style="margin-top:14px"><b>识图要领：</b>考试图片中你与交警面对面——交警的<b>左手在你的右侧</b>。先看哪只手在动、手臂是平伸还是斜伸、是否高举，再判断信号。速记：<b>一斜减（右手斜下压）、一直变（右手平伸左摆）、一斜一直是转弯、单手高举是停止、高举加横摆是靠边、左手斜下压是待转、双臂平伸是直行。</b></div>`;
      const stage = $('.r-stage', body), info = $('.r-ginfo', body);
      player = gesturePlayer(stage, { onStep: i => $$('.r-steps li', info).forEach((li, j) => li.classList.toggle('on', j === i)) });
      const showInfo = () => {
        info.innerHTML = `<h3>${cur.name}</h3><div class="r-desc"><b>含义：</b>${esc(cur.mean)}</div><div class="r-kou">口诀：${esc(cur.kou)}</div><div class="section-title" style="margin-top:10px">动作要领（公安部《交通警察手势信号》）</div><ol class="r-steps">${cur.steps.map((s, i) => `<li data-i="${i}">${esc(s)}</li>`).join('')}</ol><p class="small muted">点击步骤可跳转到对应动作。</p>`;
        $$('.r-steps li', info).forEach(li => li.onclick = () => player.seekStep(+li.dataset.i));
      };
      player.load(cur); showInfo();
      $$('.r-gbtn', body).forEach(b => b.onclick = () => { cur = GES.find(g => g.k === b.dataset.k); $$('.r-gbtn', body).forEach(x => x.classList.toggle('on', x === b)); player.load(cur); showInfo(); $('.gp', body).textContent = '⏸ 暂停'; });
      $('.gp', body).onclick = e => { e.target.textContent = player.toggle() ? '⏸ 暂停' : '▶ 播放'; };
      $('.gr', body).onclick = () => { player.restart(); $('.gp', body).textContent = '⏸ 暂停'; };
      $('.gs', body).onclick = e => { const b = e.target.closest('button'); if (!b) return; $$('.gs button', body).forEach(x => x.classList.toggle('on', x === b)); player.setSpeed(+b.dataset.s); };
      $('.gv', body).onclick = e => { const b = e.target.closest('button'); if (!b) return; $$('.gv button', body).forEach(x => x.classList.toggle('on', x === b)); player.setView(b.dataset.v); };
      $('.gl', body).onchange = e => player.setLoop(e.target.checked);
    }
    draw();
  }

  /* ================= 交通信号灯 ================= */
  const ARW = {
    l: '<path d="M4 15L13 6V11H26V19H13V24Z"/>', s: '<path d="M15 3L24 13H19V27H11V13H6Z"/>', r: '<path d="M26 15L17 6V11H4V19H17V24Z"/>',
    x: '<path d="M6 9L9 6L15 12L21 6L24 9L18 15L24 21L21 24L15 18L9 24L6 21L12 15Z"/>', d: '<path d="M15 27L6 17H11V3H19V17H24Z"/>',
    man: '<circle cx="15" cy="5" r="3.2"/><path d="M11 10H19V19H17V28H13V19H11Z"/>', walk: '<circle cx="16" cy="4.5" r="3.2"/><path d="M13 9L19 10L22 16L19.5 17L18 13.5L17 19L21 28L17.5 28.5L14.5 21L11 28.5L7.5 27L12 18.5L12.5 14L10 17L7.5 15.5Z"/>',
    bike: '<circle cx="8" cy="20" r="5" fill="none" stroke-width="2"/><circle cx="22" cy="20" r="5" fill="none" stroke-width="2"/><path d="M8 20L13 11H20L22 20M13 11L15 20H8M11 8H15M19 7L20 11"/>'
  };
  const ic = (k, cls) => `<div class="r-lamp ic ${cls}"><svg viewBox="0 0 30 30">${ARW[k]}</svg></div>`;
  function pageLights(el) {
    A.setTitle('交通信号灯');
    el.innerHTML = `<div class="r-wrap fade-in"><div class="note" style="margin-bottom:12px">依据《道路交通安全法实施条例》第三十八条至第四十四条。灯光为实时动画演示，观察每种灯色变化及对应规则。</div><div class="r-lgrid">
    <div class="card"><div class="card-title">① 机动车信号灯 <span class="tag">圆形满屏灯</span></div>
      <div class="r-lbox"><div class="r-house v" id="r-l1"><div class="r-lamp red"></div><div class="r-lamp yel"></div><div class="r-lamp grn"></div></div>
      <div class="flex1"><div class="row"><span class="r-cd" id="r-l1cd">--</span><span class="r-state" id="r-l1s"></span></div><div class="small muted" id="r-l1t"></div></div></div>
      <ul class="r-rules"><li><b>绿灯</b>：准许车辆通行，但转弯的车辆不得妨碍被放行的直行车辆、行人通行。</li><li><b>黄灯</b>：已越过停止线的车辆可以继续通行；未越过停止线的应停车等待。</li><li><b>红灯</b>：禁止车辆通行。<b>红灯时右转弯</b>的车辆在不妨碍被放行的车辆、行人通行的情况下可以通行（有右转箭头灯为红色时除外）。</li><li>未设非机动车灯和人行横道灯的路口，非机动车和行人按机动车信号灯通行。</li></ul></div>
    <div class="card"><div class="card-title">② 方向指示信号灯 <span class="tag">箭头灯</span></div>
      <div class="r-lbox"><div class="r-house" id="r-l2" style="flex-direction:column;gap:6px"></div><div class="flex1"><div class="r-state" id="r-l2s"></div><div class="small muted" id="r-l2t"></div></div></div>
      <ul class="r-rules"><li>箭头方向<b>向左、向上、向右</b>分别表示左转、直行、右转。</li><li>绿色箭头亮：准许该方向通行；红色箭头亮：禁止该方向通行（<b>右转箭头为红色时不得右转</b>）。</li><li>方向灯与满屏灯同时设置时，相应方向以箭头灯为准。</li></ul></div>
    <div class="card"><div class="card-title">③ 闪光警告信号灯</div>
      <div class="r-lbox"><div class="r-house v"><div class="r-lamp yel on blink"></div></div><div class="flex1"><div class="r-state">黄灯持续闪烁</div><div class="small muted">常见于夜间、无人值守的路口或施工路段。</div></div></div>
      <ul class="r-rules"><li>闪光警告信号灯为<b>持续闪烁的黄灯</b>，提示车辆、行人通行时注意瞭望，<b>确认安全后通过</b>。</li><li>它不是“可以随意通行”，经过时应减速观察，按让行规则通过（如右方来车先行、转弯让直行）。</li></ul></div>
    <div class="card"><div class="card-title">④ 车道信号灯 <span class="tag">潮汐/收费车道</span></div>
      <div class="r-lbox"><div class="r-house" id="r-l4"></div><div class="flex1"><div class="r-state" id="r-l4s"></div><div class="small muted">安装在车道正上方，常用于潮汐车道、收费站、隧道。</div></div></div>
      <ul class="r-rules"><li><b>绿色箭头灯亮</b>：准许本车道车辆按指示方向通行。</li><li><b>红色叉形灯或箭头灯亮</b>：禁止本车道车辆通行。</li></ul></div>
    <div class="card"><div class="card-title">⑤ 人行横道信号灯</div>
      <div class="r-lbox"><div class="r-house v" id="r-l5"><div class="r-lamp ic red"><svg viewBox="0 0 30 30">${ARW.man}</svg></div><div class="r-lamp ic grn"><svg viewBox="0 0 30 30">${ARW.walk}</svg></div></div><div class="flex1"><div class="row"><span class="r-cd" id="r-l5cd">--</span><span class="r-state" id="r-l5s"></span></div></div></div>
      <ul class="r-rules"><li><b>绿灯亮</b>：准许行人通过人行横道。</li><li><b>红灯亮</b>：禁止行人进入人行横道，但已进入的可以继续通过或在道路中心线处停留等候。</li><li>驾驶人转弯时须让正在通过人行横道的行人先行。</li></ul></div>
    <div class="card"><div class="card-title">⑥ 铁路道口信号灯</div>
      <div class="r-lbox"><div class="r-house" id="r-l6"><div class="r-lamp red"></div><div class="r-lamp red"></div></div><div class="flex1"><div class="r-state">两个红灯交替闪烁</div><div class="small muted">道口信号灯与栏杆、警铃配合使用。</div></div></div>
      <ul class="r-rules"><li>两个红灯<b>交替闪烁</b>或一个红灯亮时，表示<b>禁止</b>车辆、行人通行。</li><li>红灯熄灭时，表示允许车辆、行人通行。通过道口不得超车、掉头、倒车，不得在道口内停车。</li></ul></div>
    <div class="card"><div class="card-title">⑦ 非机动车信号灯</div>
      <div class="r-lbox"><div class="r-house v" id="r-l7"><div class="r-lamp ic red"><svg viewBox="0 0 30 30">${ARW.bike}</svg></div><div class="r-lamp ic yel"><svg viewBox="0 0 30 30">${ARW.bike}</svg></div><div class="r-lamp ic grn"><svg viewBox="0 0 30 30">${ARW.bike}</svg></div></div><div class="flex1"><div class="r-state" id="r-l7s"></div></div></div>
      <ul class="r-rules"><li>非机动车按非机动车信号灯通行，灯色含义与机动车信号灯相同。</li></ul></div>
    </div>
    <div class="card" style="margin-top:14px"><div class="card-title">易错点</div>
      <div class="r-rule"><span class="tag red">闯红灯</span><span>不按交通信号灯指示通行，<b>记6分</b>，并处罚款（以当地标准为准）。黄灯亮时继续越过停止线同样属于违法。</span></div>
      <div class="r-rule"><span class="tag orange">绿灯</span><span>绿灯亮时前方路口拥堵，不得进入路口，应在停止线外等候，避免“锁死”路口。</span></div>
      <div class="r-rule"><span class="tag green">待转区</span><span>直行绿灯亮、左转为红灯时，左转车辆可进入左弯待转区等候；左转绿灯亮后通过。</span></div>
      <div class="r-rule"><span class="tag blue">指挥优先</span><span>交通警察的指挥 &gt; 交通信号 &gt; 交通标志标线。有交警现场指挥时，按交警指挥通行。</span></div></div></div>`;
    // 1. 机动车灯循环
    const L1 = $$('#r-l1 .r-lamp', el), cd = $('#r-l1cd', el), st = $('#r-l1s', el), tx = $('#r-l1t', el);
    const P1 = [['grn', 10, '绿灯', '准许通行，转弯让直行和行人'], ['grnb', 3, '绿灯闪烁', '即将变为黄灯，未到路口应准备减速'], ['yel', 3, '黄灯', '已越线可继续通行，未越线须停车'], ['red', 10, '红灯', '禁止通行（右转在不妨碍时可通行）']];
    let p1 = 0, left = P1[0][1];
    const r1 = () => {
      const [k, , n, d] = P1[p1];
      L1.forEach(l => l.classList.remove('on', 'blink'));
      const lamp = k === 'grnb' ? L1[2] : k === 'grn' ? L1[2] : k === 'yel' ? L1[1] : L1[0];
      lamp.classList.add('on'); if (k === 'grnb') lamp.classList.add('blink');
      cd.textContent = left; cd.className = 'r-cd ' + (k.startsWith('grn') ? 'g' : k === 'yel' ? 'y' : '');
      st.textContent = n; st.style.color = k.startsWith('grn') ? 'var(--ok)' : k === 'yel' ? 'var(--warn)' : 'var(--bad)'; tx.textContent = d;
    };
    r1(); life.interval(() => { left--; if (left <= 0) { p1 = (p1 + 1) % P1.length; left = P1[p1][1]; } r1(); }, 1000);
    // 2. 方向指示灯（左/直/右 三组，每组红黄绿）
    const L2 = $('#r-l2', el);
    L2.innerHTML = ['red', 'yel', 'grn'].map(c => `<div style="display:flex;gap:6px">${['l', 's', 'r'].map(a => ic(a, c)).join('')}</div>`).join('');
    const P2 = [[['grn', 'red', 'grn'], '左转绿灯、直行红灯、右转绿灯', '左转车辆可通行，直行车辆停车等待'], [['yel', 'red', 'grn'], '左转黄灯', '左转方向即将变红'], [['red', 'grn', 'grn'], '直行绿灯、左转红灯', '直行、右转可通行；左转车可进入待转区'], [['red', 'yel', 'grn'], '直行黄灯', '直行方向即将变红'], [['red', 'red', 'red'], '全部红灯（含右转红箭头）', '右转箭头为红色时禁止右转']];
    let p2 = 0;
    const r2 = () => { const [cols, s, t] = P2[p2]; const rows = $$('#r-l2>div', el); ['red', 'yel', 'grn'].forEach((c, ri) => $$('.r-lamp', rows[ri]).forEach((l, ai) => l.classList.toggle('on', cols[ai] === c))); $('#r-l2s', el).textContent = s; $('#r-l2t', el).textContent = t; };
    r2(); life.interval(() => { p2 = (p2 + 1) % P2.length; r2(); }, 3000);
    // 4. 车道灯
    const L4 = $('#r-l4', el);
    L4.innerHTML = [0, 1, 2].map(() => `<div style="display:flex;flex-direction:column;gap:4px">${ic('d', 'grn')}${ic('x', 'red')}</div>`).join('');
    let p4 = 0;
    const r4 = () => { const st4 = [[1, 1, 0], [1, 0, 0], [1, 1, 1]][p4]; $$('#r-l4>div', el).forEach((c, i) => { const ls = $$('.r-lamp', c); ls[0].classList.toggle('on', !!st4[i]); ls[1].classList.toggle('on', !st4[i]); }); $('#r-l4s', el).textContent = ['左两车道可通行，最右车道禁止驶入', '仅最左车道可通行（潮汐车道变向中）', '三条车道均可通行'][p4]; };
    r4(); life.interval(() => { p4 = (p4 + 1) % 3; r4(); }, 3500);
    // 5. 人行横道
    const L5 = $$('#r-l5 .r-lamp', el); let p5 = 0, l5 = 8;
    const P5 = [['grn', 8, '绿灯：行人可以通过'], ['grnb', 4, '绿灯闪烁：未进入的不要再进入'], ['red', 10, '红灯：禁止进入人行横道']];
    const r5 = () => { const [k, , s] = P5[p5]; L5[0].classList.toggle('on', k === 'red'); L5[1].classList.toggle('on', k !== 'red'); L5[1].classList.toggle('blink', k === 'grnb'); $('#r-l5cd', el).textContent = l5; $('#r-l5cd', el).className = 'r-cd ' + (k === 'red' ? '' : 'g'); $('#r-l5s', el).textContent = s; };
    r5(); life.interval(() => { l5--; if (l5 <= 0) { p5 = (p5 + 1) % 3; l5 = P5[p5][1]; } r5(); }, 1000);
    // 6. 道口交替闪烁
    const L6 = $$('#r-l6 .r-lamp', el); let f6 = 0;
    life.interval(() => { f6 ^= 1; L6[0].classList.toggle('on', !!f6); L6[1].classList.toggle('on', !f6); }, 600);
    // 7. 非机动车
    const L7 = $$('#r-l7 .r-lamp', el); let p7 = 0;
    const r7 = () => { L7.forEach((l, i) => l.classList.toggle('on', i === [2, 1, 0][p7])); $('#r-l7s', el).textContent = ['绿灯：非机动车可通行', '黄灯：未越线的停车等待', '红灯：禁止通行'][p7]; };
    r7(); life.interval(() => { p7 = (p7 + 1) % 3; r7(); }, [4000][0]);
  }

  /* ================= 记分规则 ================= */
  const PTS = {"12": ["饮酒后驾驶机动车的", "造成致人轻伤以上或者死亡的交通事故后逃逸，尚不构成犯罪的", "使用伪造、变造的机动车号牌、行驶证、驾驶证、校车标牌或者使用其他机动车号牌、行驶证的", "驾驶校车、公路客运汽车、旅游客运汽车载人超过核定人数百分之二十以上，或者驾驶其他载客汽车载人超过核定人数百分之百以上的", "驾驶校车、中型以上载客载货汽车、危险物品运输车辆在高速公路、城市快速路上行驶超过规定时速百分之二十以上，或者驾驶其他机动车在高速公路、城市快速路上行驶超过规定时速百分之五十以上的", "驾驶机动车在高速公路、城市快速路上倒车、逆行、穿越中央分隔带掉头的", "代替实际机动车驾驶人接受交通违法行为处罚和记分牟取经济利益的"], "9": ["驾驶7座以上载客汽车载人超过核定人数百分之五十以上未达到百分之百的", "驾驶校车、中型以上载客载货汽车、危险物品运输车辆在高速公路、城市快速路以外的道路上行驶超过规定时速百分之五十以上的", "驾驶机动车在高速公路或者城市快速路上违法停车的", "驾驶未悬挂机动车号牌或者故意遮挡、污损机动车号牌的机动车上道路行驶的", "驾驶与准驾车型不符的机动车的", "未取得校车驾驶资格驾驶校车的", "连续驾驶中型以上载客汽车、危险物品运输车辆超过4小时未停车休息或者停车休息时间少于20分钟的"], "6": ["驾驶校车、公路客运汽车、旅游客运汽车载人超过核定人数未达到百分之二十，或者驾驶7座以上载客汽车载人超过核定人数百分之二十以上未达到百分之五十，或者驾驶其他载客汽车载人超过核定人数百分之五十以上未达到百分之百的", "驾驶校车、中型以上载客载货汽车、危险物品运输车辆在高速公路、城市快速路上行驶超过规定时速未达到百分之二十，或者在高速公路、城市快速路以外的道路上行驶超过规定时速百分之二十以上未达到百分之五十的", "驾驶校车、中型以上载客载货汽车、危险物品运输车辆以外的机动车在高速公路、城市快速路上行驶超过规定时速百分之二十以上未达到百分之五十，或者在高速公路、城市快速路以外的道路上行驶超过规定时速百分之五十以上的", "驾驶载货汽车载物超过最大允许总质量百分之五十以上的", "驾驶机动车载运爆炸物品、易燃易爆化学物品以及剧毒、放射性等危险物品，未按指定的时间、路线、速度行驶或者未悬挂警示标志并采取必要的安全措施的", "驾驶机动车运载超限的不可解体的物品，未按指定的时间、路线、速度行驶或者未悬挂警示标志的", "驾驶机动车运输危险化学品，未经批准进入危险化学品运输车辆限制通行的区域的", "驾驶机动车不按交通信号灯指示通行的", "机动车驾驶证被暂扣或者扣留期间驾驶机动车的", "造成致人轻微伤或者财产损失的交通事故后逃逸，尚不构成犯罪的", "驾驶机动车在高速公路或者城市快速路上违法占用应急车道行驶的"], "3": ["驾驶校车、公路客运汽车、旅游客运汽车、7座以上载客汽车以外的其他载客汽车载人超过核定人数百分之二十以上未达到百分之五十的", "驾驶校车、中型以上载客载货汽车、危险物品运输车辆以外的机动车在高速公路、城市快速路以外的道路上行驶超过规定时速百分之二十以上未达到百分之五十的", "驾驶机动车在高速公路或者城市快速路上不按规定车道行驶的", "驾驶机动车不按规定超车、让行，或者在高速公路、城市快速路以外的道路上逆行的", "驾驶机动车遇前方机动车停车排队或者缓慢行驶时，借道超车或者占用对面车道、穿插等候车辆的", "驾驶机动车有拨打、接听手持电话等妨碍安全驾驶的行为的", "驾驶机动车行经人行横道不按规定减速、停车、避让行人的", "驾驶机动车不按规定避让校车的", "驾驶载货汽车载物超过最大允许总质量百分之三十以上未达到百分之五十的，或者违反规定载客的", "驾驶不按规定安装机动车号牌的机动车上道路行驶的", "在道路上车辆发生故障、事故停车后，不按规定使用灯光或者设置警告标志的", "驾驶未按规定定期进行安全技术检验的公路客运汽车、旅游客运汽车、危险物品运输车辆上道路行驶的", "驾驶校车上道路行驶前，未对校车车况是否符合安全技术要求进行检查，或者驾驶存在安全隐患的校车上道路行驶的", "连续驾驶载货汽车超过4小时未停车休息或者停车休息时间少于20分钟的", "驾驶机动车在高速公路上行驶低于规定最低时速的"], "1": ["驾驶校车、中型以上载客载货汽车、危险物品运输车辆在高速公路、城市快速路以外的道路上行驶超过规定时速百分之十以上未达到百分之二十的", "驾驶机动车不按规定会车，或者在高速公路、城市快速路以外的道路上不按规定倒车、掉头的", "驾驶机动车不按规定使用灯光的", "驾驶机动车违反禁令标志、禁止标线指示的", "驾驶机动车载货长度、宽度、高度超过规定的", "驾驶载货汽车载物超过最大允许总质量未达到百分之三十的", "驾驶未按规定定期进行安全技术检验的公路客运汽车、旅游客运汽车、危险物品运输车辆以外的机动车上道路行驶的", "驾驶擅自改变已登记的结构、构造或者特征的载货汽车上道路行驶的", "驾驶机动车在道路上行驶时，机动车驾驶人未按规定系安全带的", "驾驶摩托车，不戴安全头盔的"]};
  const PCOL = { 12: '#dc2626', 9: '#ea580c', 6: '#d97706', 3: '#2563eb', 1: '#16a34a' };
  const CN = '一二三四五六七八九十';
  const cnNum = n => n <= 10 ? CN[n - 1] : '十' + CN[n - 11];
  function pagePoints(el) {
    A.setTitle('记分规则（2022版）');
    el.innerHTML = `<div class="r-wrap fade-in r-pts">
      <div class="note" style="margin-bottom:12px">依据《道路交通安全违法行为记分管理办法》（公安部令第163号），<b>2022年4月1日起施行</b>。记分周期为 <b>12个月</b>，满分 <b>12分</b>，从机动车驾驶证初次领取之日起计算。一次记分分值为 12、9、6、3、1 分五档，共 50 项。</div>
      <div class="r-bar"><input class="r-search" type="search" placeholder="搜索违法行为，如：安全带、超速、应急车道…"><div class="seg pf"><button data-v="all" class="on">全部</button>${[12, 9, 6, 3, 1].map(v => `<button data-v="${v}">${v}分</button>`).join('')}</div></div>
      <div class="r-plist"></div>
      <div class="card"><div class="card-title">满分处理（第十七条至第二十四条）</div>
        <div class="r-rule"><span class="tag red">扣证</span><span>一个记分周期内累积记分满12分的，公安机关交通管理部门<b>扣留机动车驾驶证</b>，并送达满分教育通知书。</span></div>
        <table class="tbl" style="margin:8px 0"><tr><th>情形</th><th>一般驾驶人</th><th>大客、重型牵引挂车、城市公交、中客、大货</th></tr>
        <tr><td>第一次满12分</td><td>学习 <b>7天</b></td><td>学习 <b>30天</b></td></tr>
        <tr><td>次数每增加一次或累积记分每增加12分</td><td>增加 <b>7天</b>，每次最多 <b>60天</b></td><td>增加 <b>30天</b>，每次最多 <b>120天</b></td></tr>
        <tr><td>现场+网络学习最少天数</td><td>累计≥5天，其中现场≥2天</td><td>累计≥10天，其中现场≥5天</td></tr></table>
        <div class="r-rule"><span class="tag blue">学习</span><span>包括现场学习、网络学习和自主学习；单日连续现场学习或网络学习累计超过3小时计为一天，同日两种学习不累积计算。</span></div>
        <div class="r-rule"><span class="tag orange">考试</span><span>完成学习后预约<b>科目一（道路交通安全法律、法规和相关知识）考试</b>，不合格的10日后预约重新考试。</span></div>
        <div class="r-rule"><span class="tag orange">加考</span><span>一个周期内<b>二次</b>满12分或累积记分满24分未满36分：还需加考<b>科目三道路驾驶技能</b>；<b>三次以上</b>满12分或累积满36分：还需加考<b>科目二场地驾驶技能和科目三道路驾驶技能</b>。</span></div>
        <div class="r-rule"><span class="tag green">发还</span><span>满分学习、考试合格且罚款已缴纳的，记分予以清除，发还驾驶证。</span></div>
        <div class="r-rule"><span class="tag red">停止使用</span><span>满分后驾驶证未被扣留或收到通知书后30日内拒不参加学习、考试的，公告其驾驶证停止使用。</span></div></div>
      <div class="card"><div class="card-title">减免记分 · 学法减分（第二十五条至第二十八条）</div>
        <div class="r-rule"><span class="tag green">条件</span><span>处理完交通违法记录后累积记分<b>未满12分</b>，参加交通安全教育达到规定要求的，可申请扣减记分；<b>一个记分周期内累计最高扣减6分</b>。</span></div>
        <table class="tbl" style="margin:8px 0"><tr><th>方式</th><th>要求</th><th>扣减</th></tr>
        <tr><td>网上学习</td><td>3日内累计满30分钟且考试合格</td><td>1分/次</td></tr>
        <tr><td>现场学习</td><td>满1小时且考试合格</td><td>2分/次</td></tr>
        <tr><td>交通安全公益活动</td><td>满1小时为一次</td><td>1分/次</td></tr></table>
        <div class="small" style="color:var(--text2);line-height:1.7"><b>不予受理的情形：</b>①本周期或上一周期内有二次以上满分教育记录；②最近三个记分周期内因肇事逃逸、饮酒后驾驶、使用伪造变造号牌证件或他车号牌证件、买分卖分受过处罚；③驾驶证在实习期内、逾期未审验或被扣留、暂扣期间；④名下有逾期未检验或未按规定注销登记的机动车；⑤最近三个周期内在减分/满分/审验教育中有弄虚作假、冒名顶替记录。</div>
        <div class="r-rule" style="margin-top:6px"><span class="tag blue">免予记分</span><span>交通违法行为情节轻微，给予警告处罚的，免予记分。</span></div></div>
      <div class="card"><div class="card-title">其他要点</div>
        <div class="r-rule"><span class="tag">周期清零</span><span>周期届满累积记分未满12分的，该周期记分清除；但有罚款逾期未缴纳的，相应记分转入下一周期。</span></div>
        <div class="r-rule"><span class="tag">累积计算</span><span>二起以上违法行为记分累积计算；可一次性处理同一辆车的多起违法记录，累积满12分后不得再处理其他车辆的违法记录。</span></div>
        <div class="r-rule"><span class="tag red">买分卖分</span><span>代替他人接受处罚和记分牟利的，记12分，处违法所得三倍以下罚款（最高5万元）；请他人代记分并支付利益的，处所付利益三倍以下罚款（最高5万元）。</span></div>
        <div class="r-rule"><span class="tag">实习期</span><span>实习期（初次领证12个月）内记满12分的，注销实习的准驾车型驾驶资格。</span></div></div>
    </div>`;
    const list = $('.r-plist', el), inp = $('.r-search', el); let lv = 'all';
    function draw() {
      const q = inp.value.trim(); let html = '', n = 0;
      [12, 9, 6, 3, 1].forEach(v => {
        if (lv !== 'all' && +lv !== v) return;
        const items = PTS[v].map((t, i) => [i, t]).filter(([, t]) => !q || t.includes(q)); n += items.length;
        if (!items.length) return;
        html += `<div class="card"><h3><span class="r-pv" style="background:${PCOL[v]}">${v}分</span>一次记${v}分 <span class="muted small">（${PTS[v].length}项）</span></h3><ul class="r-pli">${items.map(([i, t]) => `<li><i>（${cnNum(i + 1)}）</i>${hl(t, q)}</li>`).join('')}</ul></div>`;
      });
      list.innerHTML = html || `<div class="r-empty">没有找到「${esc(q)}」相关条目</div>`;
    }
    inp.oninput = draw;
    $('.pf', el).onclick = e => { const b = e.target.closest('button'); if (!b) return; lv = b.dataset.v; $$('.pf button', el).forEach(x => x.classList.toggle('on', x === b)); draw(); };
    draw();
  }

  /* ================= 科目二评判标准 ================= */
  const F_ = '不合格', D10 = '扣10分', D5 = '扣5分';
  const K2 = {
    intro: '依据《机动车驾驶人考试内容和方法》（GA 1026）及《机动车驾驶证申领和使用规定》（公安部令第162号）。小型汽车（C1/C2）场地驾驶技能考试满分100分，<b>80分及以上合格</b>（大型客车、牵引车、城市公交车、中型客车、大型货车90分合格）。C1考倒车入库、坡道定点停车和起步、侧方停车、曲线行驶、直角转弯5项；C2/C5不考坡道定点停车和起步。每次预约考试可当场补考一次，学习驾驶证明有效期内科目二预约考试次数不得超过5次。具体扣分以当地考场执行细则为准。',
    items: [
      { n: '通用评判', r: '适用于场地考试全过程。', l: [[F_, '不按规定使用安全带或者戴安全头盔的'], [F_, '遮挡、关闭车内音视频监控设备的'], [F_, '不按考试员指令驾驶的'], [F_, '不能正确使用灯光、雨刮器等车辆常用操纵件的'], [F_, '起步时车辆发生闯动的'], [F_, '起步时车辆后溜距离大于30cm的'], [F_, '驾驶汽车单手控制方向盘的'], [F_, '使用挡位与车速长时间不匹配，造成车辆发动机转速过高或过低的'], [F_, '车辆在行驶中低头看挡或者连续2次挂挡不进的'], [F_, '行驶中空挡滑行的'], [F_, '视线离开行驶方向超过2s的'], [F_, '违反交通安全法律、法规，影响交通安全的'], [F_, '因观察、判断或者操作不当出现危险情况的'], [F_, '考试中车辆碰擦桩杆，或车轮轧压车道边线、道路边缘线的（各项目另有规定的按其规定）'], [D10, '起步时车辆后溜，但后溜距离不大于30cm的'], [D10, '操纵方向盘手法不合理的'], [D10, '起步或行驶中挂错挡，不能及时纠正的'], [D10, '因操作不当造成发动机熄火一次的'], [D10, '起步时未开启转向灯或开启转向灯后少于3s即起步的'], [D10, '制动、加速踏板使用不当，或驾驶姿势不正确的']] },
      { n: '倒车入库', r: '考试要求：车辆从道路一端控制线驶入，倒入车库停车，再前进驶出车库向另一端驶出控制线；然后倒车入库，再驶出车库回到起点。全程不得中途停车，车身不得出线。', l: [[F_, '不按规定路线、顺序行驶的'], [F_, '车身出线的'], [F_, '倒库不入的'], [F_, '在倒车前，未将两个前轮触地点均驶过控制线的'], [F_, '项目完成时间超过210s的'], [D5, '中途停车超过2s的（每次）']] },
      { n: '坡道定点停车和起步', r: '考试要求：车辆在上坡道路上按规定位置（桩杆线）停车，前保险杠对齐桩杆线，车身距右侧边缘线30cm以内；停稳后平稳起步，不后溜。', l: [[F_, '车辆停止后，汽车前保险杠未定于桩杆线上，且前后超出50cm的'], [F_, '行驶中车轮轧道路边缘线的'], [F_, '起步时间超过30s的'], [F_, '起步时车辆后溜距离大于30cm的'], [D10, '车辆停止后，汽车前保险杠未定于桩杆线上，且前后超出不大于50cm的'], [D10, '停车后，车身距离路边缘线超过30cm的'], [D10, '停车后，未拉紧驻车制动器的'], [D10, '起步时车辆后溜，但后溜距离不大于30cm的']] },
      { n: '侧方停车', r: '考试要求：车辆在库前方一侧道路上停稳后，一次倒车入库（车位在右侧），不得中途停车，车轮不得轧碰车道边线，车身不得碰擦库位边线；入库后开左转向灯驶出。', l: [[F_, '车辆入库停止后，车身出线的'], [F_, '项目完成时间超过90s的'], [F_, '行驶中车轮触轧车道边线的'], [D10, '行驶中车身触碰库位边线的'], [D10, '出库时不使用或错误使用转向灯的'], [D5, '中途停车超过2s的（每次）']] },
      { n: '曲线行驶（S弯）', r: '考试要求：以低速、匀速通过S形曲线道路，车轮不得碰轧道路边缘线，中途不得停车。', l: [[F_, '车轮轧道路边缘线的'], [D5, '中途停车超过2s的（每次）']] },
      { n: '直角转弯', r: '考试要求：车辆按规定路线由左向右或由右向左直角转弯，一次通过，车轮不得碰轧道路边缘线，转弯前开转向灯，转弯后关闭。', l: [[F_, '车轮轧道路边缘线的'], [D10, '转弯时不使用或错误使用转向灯，转弯后不关闭转向灯的'], [D5, '中途停车超过2s的（每次）']] }
    ]
  };
  const K3 = {
    intro: '依据《机动车驾驶人考试内容和方法》（GA 1026）。道路驾驶技能考试满分100分，<b>90分及以上合格</b>；小型汽车考试里程不少于3公里，并抽取不少于20%进行夜间考试（未进行夜间考试的进行模拟夜间灯光考试）。考试内容包括上车准备、起步、直线行驶、加减挡位操作、变更车道、靠边停车、直行通过路口、路口左转弯、路口右转弯、通过人行横道线、通过学校区域、通过公共汽车站、会车、超车、掉头、夜间行驶等16项。具体以当地考场执行细则为准。',
    items: [
      { n: '通用评判', r: '适用于道路考试全过程，出现即判定（不合格项一票否决）。', l: [[F_, '不按规定使用安全带的'], [F_, '遮挡、关闭车内音视频监控设备的'], [F_, '不按考试员指令驾驶的'], [F_, '不能正确使用灯光、雨刮器等车辆常用操纵件的'], [F_, '起步时车辆后溜距离大于30cm的'], [F_, '单手控制方向盘的'], [F_, '使用挡位与车速长时间不匹配，造成车辆发动机转速过高或过低的'], [F_, '车辆在行驶中低头看挡或者连续2次挂挡不进的'], [F_, '行驶中空挡滑行的'], [F_, '视线离开行驶方向超过2s的'], [F_, '违反交通安全法律、法规，影响交通安全的'], [F_, '因观察、判断或者操作不当出现危险情况的'], [F_, '不按交通信号灯、标志、标线或者民警指挥信号行驶的'], [F_, '不按规定速度行驶的'], [F_, '车辆行驶中骑轧车道中心实线或者车道边缘实线的'], [F_, '对可能出现危险的情形未采取减速、鸣喇叭等安全措施的'], [F_, '不能根据交通情况合理选择行驶车道、速度的'], [F_, '不按规定避让行人、非机动车、校车或其他车辆的'], [F_, '起步、转向、变更车道、超车、停车前不使用或错误使用转向灯的'], [F_, '考试员（安全员）采取紧急制动的'], [D10, '起步、转向、变更车道、超车、停车前，开启转向灯少于3s即转向的'], [D10, '起步时车辆后溜，但后溜距离不大于30cm的'], [D10, '操纵方向盘手法不合理的'], [D10, '起步或行驶中挂错挡，不能及时纠正的'], [D10, '因操作不当造成发动机熄火一次的'], [D10, '制动、加速踏板使用错误的'], [D10, '行驶中车辆的车门未完全关闭的（另有规定除外）']] },
      { n: '上车准备', r: '逆时针绕车一周，检查车辆外观及周围安全状况；打开车门前观察后方交通情况。', l: [[F_, '未逆时针绕车一周检查车辆外观及周围环境的'], [F_, '打开车门前不观察后方交通情况的']] },
      { n: '起步', r: '调整座椅、后视镜，系好安全带，检查仪表；启动发动机，开左转向灯，观察内外后视镜并向左侧头观察后方，鸣喇叭（复杂路况），平稳起步。', l: [[F_, '车门未完全关闭起步的'], [F_, '起步前，未观察内、外后视镜，并向左方侧头观察后方交通情况的'], [F_, '启动发动机时，挡位未置于空挡（驻车挡）的'], [F_, '不松驻车制动器起步，未及时纠正的'], [F_, '制动气压不足起步的（大型车）'], [D10, '不松驻车制动器起步，但能及时纠正的'], [D10, '发动机启动后，不及时松开启动开关的'], [D10, '起步时车辆发生闯动的'], [D5, '道路交通情况复杂时起步不能合理使用喇叭的'], [D5, '起步时，加速踏板控制不当，致使发动机转速过高的'], [D5, '启动发动机前，不调整驾驶座椅、后视镜、检查仪表的']] },
      { n: '直线行驶', r: '保持车辆直线行驶，适时观察后视镜，跟车距离适当，及时发现路面障碍。', l: [[F_, '方向控制不稳，不能保持车辆直线运动状态的'], [F_, '遇前车制动时不及时采取减速措施的'], [D10, '不适时通过内、外后视镜观察后方交通情况的'], [D10, '未及时发现路面障碍物或发现路面障碍物未及时采取减速措施的']] },
      { n: '加减挡位操作', r: '根据考试员指令及路况，平稳加挡（一般加至四挡或车速达规定值），再平稳减挡；挡位与车速匹配。', l: [[F_, '未按指令平稳加、减挡的'], [F_, '车辆运行速度和挡位不匹配的']] },
      { n: '变更车道', r: '开转向灯3秒以上，通过内外后视镜观察，并向变更车道方向侧头观察后方，确认安全后平稳变道，一次只变一条车道。', l: [[F_, '变更车道前，不通过内、外后视镜观察，并向变更车道方向侧头观察后方道路交通情况的'], [F_, '变更车道时，判断车辆安全距离不合理，妨碍其他车辆正常行驶的'], [F_, '连续变更两条或两条以上车道的'], [D10, '变更车道时，控制行驶速度不合理，影响其他车辆正常行驶的']] },
      { n: '靠边停车', r: '开右转向灯，观察内外后视镜并向右后侧头观察，减速靠右平稳停车，车身距右侧边缘线30cm以内；拉紧驻车制动，挡位回空挡，关闭转向灯；下车前侧头观察左后方，开门下车后关好车门。', l: [[F_, '停车前，不通过内、外后视镜观察，回头观察后方和右侧交通情况的'], [F_, '考试员发出靠边停车指令后，未能在规定的距离内停车的'], [F_, '停车后，车身超过道路右侧边缘线或者人行道边缘的'], [F_, '停车后，车身距离道路右侧边缘线或者人行道边缘超过50cm的'], [F_, '下车前不侧头观察侧后方交通情况，开车门前不观察后方交通情况的'], [D10, '停车后，车身距离道路右侧边缘线或者人行道边缘超过30cm，未超过50cm的'], [D10, '停车后，未拉紧驻车制动器的'], [D10, '拉紧驻车制动器前放松行车制动踏板的'], [D10, '下车后不关闭车门的'], [D5, '停车后，未关闭转向灯、挡位未回空挡（驻车挡）或未熄火的']] },
      { n: '直行通过路口', r: '提前减速，观察左右交通情况（转头不少于45°），按信号灯或让行规则直行通过。', l: [[F_, '不按规定减速或停车瞭望的'], [F_, '不观察左、右方交通情况，转头角度小于45°的'], [F_, '遇有路口交通阻塞时进入路口的'], [F_, '未按规定让行的']] },
      { n: '路口左转弯', r: '提前开左转向灯，进入左转车道，减速观察；靠路口中心点左侧小转弯，让直行车辆和行人先行。', l: [[F_, '不按规定减速或停车瞭望的'], [F_, '不观察左、右方交通情况，转头角度小于45°的'], [F_, '未靠路口中心点左侧转弯的'], [F_, '遇有路口交通阻塞时进入路口的'], [F_, '左转弯未让直行车辆、行人先行的']] },
      { n: '路口右转弯', r: '提前开右转向灯，进入右转车道，减速观察右侧非机动车和行人，大转弯平稳通过。', l: [[F_, '不按规定减速或停车瞭望的'], [F_, '不观察左、右方交通情况，转头角度小于45°的'], [F_, '遇有路口交通阻塞时进入路口的'], [F_, '右转弯未让行人、非机动车先行的']] },
      { n: '通过人行横道线', r: '提前减速（踩刹车），观察左右两侧，有行人通过时停车让行。', l: [[F_, '不按规定减速慢行的'], [F_, '不观察左、右方交通情况的'], [F_, '未停车礼让行人的']] },
      { n: '通过学校区域', r: '提前减速至30km/h以下，观察两侧，注意儿童突然横穿，礼让行人，不鸣喇叭。', l: [[F_, '不按规定减速慢行的'], [F_, '不观察左、右方交通情况的'], [F_, '未停车礼让行人的']] },
      { n: '通过公共汽车站', r: '提前减速，观察公交车进出站动态及上下车乘客，注意从车前车后突然出现的行人。', l: [[F_, '不按规定减速慢行的'], [F_, '不观察左、右方交通情况的'], [F_, '未停车礼让行人的']] },
      { n: '会车', r: '减速靠右行驶，与对向车辆、行人、非机动车保持安全横向距离；会车困难时主动让行。', l: [[F_, '在没有中心隔离设施或者中心线的道路上会车时，不减速靠右行驶，或未与其他车辆、行人、非机动车保持安全距离的'], [F_, '会车困难时不让行的'], [F_, '横向安全间距判断差，紧急转向避让对方来车的']] },
      { n: '超车', r: '观察前方及左侧情况，开左转向灯，观察后视镜并侧头，从左侧超越；超越后开右转向灯，确认与被超车辆保持安全距离后驶回原车道。', l: [[F_, '超车前不通过内、外后视镜观察后方和左侧交通情况的'], [F_, '超车时机选择不合理，影响其他车辆正常行驶的'], [F_, '超车时，未侧头观察被超越车辆动态的'], [F_, '超车时，未与被超越车辆保持安全距离的'], [F_, '超车后，急转向驶回原车道，妨碍被超越车辆正常行驶的'], [F_, '从右侧超车的'], [F_, '当后车发出超车信号后，具备让车条件不减速靠右让行的']] },
      { n: '掉头', r: '选择允许掉头的地点，开左转向灯，减速观察，确认安全后掉头，不得妨碍正常行驶的车辆和行人。', l: [[F_, '不能正确观察交通情况选择掉头时机的'], [F_, '掉头地点选择不当的'], [F_, '掉头前未发出掉头信号的'], [F_, '掉头时，妨碍正常行驶的其他车辆和行人通行的']] },
      { n: '夜间行驶 / 模拟夜间灯光', r: '夜间或模拟夜间考试中根据语音指令正确使用灯光。考前先开启近光灯（模拟考试开始时）。', l: [[F_, '不能正确开启灯光的'], [F_, '同方向近距离跟车行驶时，使用远光灯的'], [F_, '通过急弯、坡路、拱桥、人行横道或者没有交通信号灯控制的路口时，不交替使用远近光灯示意的'], [F_, '会车时不按规定使用灯光的'], [F_, '通过路口时使用远光灯的'], [F_, '超车时未变换使用远、近光灯提醒被超越车辆的'], [F_, '在路边临时停车不关闭前照灯或不开启示廓灯的'], [D5, '进入无照明、照明不良的道路行驶时不使用远光灯的']] }
    ],
    lights: [['夜间在没有路灯、照明不良的道路上行驶', '远光灯'], ['夜间在照明良好的道路上行驶', '近光灯'], ['夜间同方向近距离跟车行驶', '近光灯'], ['夜间与机动车会车', '近光灯'], ['夜间通过有信号灯控制的路口', '近光灯'], ['夜间超越前方车辆', '远近光交替（左转向灯）'], ['夜间通过急弯、坡路', '远近光交替'], ['夜间通过拱桥、人行横道', '远近光交替'], ['夜间通过没有交通信号灯控制的路口', '远近光交替'], ['路边临时停车', '示廓灯 + 危险报警闪光灯'], ['雾天行驶 / 能见度低', '雾灯 + 示廓灯 + 危险报警闪光灯（近光）'], ['模拟灯光考试结束', '关闭所有灯光']]
  };
  function rulesPage(el, D, title) {
    A.setTitle(title);
    const tagC = l => l === F_ ? 'red' : l === D10 ? 'orange' : 'blue';
    el.innerHTML = `<div class="r-wrap fade-in"><div class="note" style="margin-bottom:12px">${D.intro}</div>
      <div class="r-bar"><input class="r-search" type="search" placeholder="搜索扣分点，如：熄火、转向灯、后溜…"><div class="seg rf"><button data-v="all" class="on">全部</button><button data-v="${F_}">不合格</button><button data-v="${D10}">扣10分</button><button data-v="${D5}">扣5分</button></div></div>
      <div class="r-rl"></div>${D.lights ? `<div class="card"><div class="card-title">灯光使用速查（夜间 / 模拟灯光考试）</div><table class="tbl"><tr><th>情形</th><th>灯光</th></tr>${D.lights.map(([a, b]) => `<tr><td>${a}</td><td><b>${b}</b></td></tr>`).join('')}</table>
      <p class="small muted" style="margin:8px 0 0">远近光交替：灯光拨杆连续向方向盘方向拉两次（或近→远→近切换两次）。</p></div>` : ''}</div>`;
    const box = $('.r-rl', el), inp = $('.r-search', el); let f = 'all';
    function draw() {
      const q = inp.value.trim();
      box.innerHTML = D.items.map((it, i) => {
        const L = it.l.filter(([l, t]) => (f === 'all' || l === f) && (!q || t.includes(q) || it.n.includes(q)));
        if (!L.length) return '';
        return `<details class="card r-acc" ${i < 2 || q || f !== 'all' ? 'open' : ''}><summary><span>${esc(it.n)} <span class="muted small">${it.l.filter(x => x[0] === F_).length}项不合格 · ${it.l.filter(x => x[0] !== F_).length}项扣分</span></span></summary><div class="r-req">${esc(it.r)}</div>${L.map(([l, t]) => `<div class="r-rule"><span class="tag ${tagC(l)}">${l}</span><span>${hl(t, q)}</span></div>`).join('')}</details>`;
      }).join('') || `<div class="r-empty">没有匹配的条目</div>`;
    }
    inp.oninput = draw;
    $('.rf', el).onclick = e => { const b = e.target.closest('button'); if (!b) return; f = b.dataset.v; $$('.rf button', el).forEach(x => x.classList.toggle('on', x === b)); draw(); };
    draw();
  }

  /* ================= 违法处罚 ================= */
  const PEN = [
    ['酒驾 · 醉驾', '#dc2626', [
      ['饮酒后驾驶机动车', '血液酒精含量 ≥20mg/100mL 且 <80mg/100mL', '暂扣驾驶证6个月，罚款1000–2000元', 12, '第91条'],
      ['饮酒驾驶被处罚后再次饮酒驾驶', '', '处10日以下拘留，罚款1000–2000元，吊销驾驶证', 12, '第91条'],
      ['醉酒驾驶机动车', '血液酒精含量 ≥80mg/100mL', '约束至酒醒，吊销驾驶证，依法追究刑事责任（危险驾驶罪：拘役并处罚金）；5年内不得重新取得驾驶证', 12, '第91条 / 刑法第133条之一'],
      ['饮酒后驾驶营运机动车', '', '处15日拘留，罚款5000元，吊销驾驶证，5年内不得重新取得驾驶证', 12, '第91条'],
      ['醉酒驾驶营运机动车', '', '约束至酒醒，吊销驾驶证，追究刑事责任；10年内不得重新取得驾驶证，重新取得后不得驾驶营运机动车', 12, '第91条'],
      ['饮酒、醉酒驾驶发生重大交通事故构成犯罪', '', '依法追究刑事责任，吊销驾驶证，终生不得重新取得驾驶证', 12, '第91条']]],
    ['超速行驶（小型汽车）', '#ea580c', [
      ['超过规定时速未达10%', '', '一般给予警告（各地标准不同）', 0, '第90条'],
      ['超过规定时速10%以上未达20%', '', '罚款（20–200元幅度内，按各地标准），小型车不记分', 0, '第90条'],
      ['普通道路超速20%以上未达50%', '高速、快速路以外道路', '罚款200元左右（各地标准），记3分', 3, '第90条 / 记分办法第11条'],
      ['高速/快速路超速20%以上未达50%', '', '罚款（各地标准），记6分', 6, '记分办法第10条'],
      ['普通道路超速50%以上', '', '罚款200–2000元，可以并处吊销驾驶证，记6分', 6, '第99条'],
      ['高速/快速路超速50%以上', '', '罚款200–2000元，可以并处吊销驾驶证，记12分', 12, '第99条 / 记分办法第8条'],
      ['校车、中型以上客货车、危险品车超速', '', '处罚和记分更重：高速/快速路超速20%以上记12分，普通道路超速50%以上记9分', 12, '记分办法']]],
    ['驾驶资格', '#7c3aed', [
      ['未取得驾驶证驾驶机动车（无证驾驶）', '', '罚款200–2000元，可以并处15日以下拘留', '—', '第99条'],
      ['驾驶证被吊销或暂扣期间驾驶', '', '罚款200–2000元，可以并处15日以下拘留；暂扣期间驾驶记6分', 6, '第99条'],
      ['驾驶与准驾车型不符的机动车', '', '罚款（各地标准），记9分', 9, '记分办法第9条'],
      ['将机动车交由无证或被吊销/暂扣驾驶证的人驾驶', '', '罚款200–2000元，可以并处吊销驾驶证', '—', '第99条'],
      ['造成交通事故后逃逸', '构成犯罪的追究刑事责任', '吊销驾驶证，且终生不得重新取得驾驶证；尚不构成犯罪的记12分（致人轻伤以上）或6分（轻微伤、财产损失）', 12, '第101条'],
      ['吸食毒品后驾驶 / 正在服用国家管制精神药品', '', '注销驾驶证，依法处理；3年内不得申请驾驶证（戒毒期间不得申领）', '—', '驾驶证申领规定']]],
    ['信号与通行', '#2563eb', [
      ['不按交通信号灯指示通行（闯红灯）', '', '罚款（20–200元幅度，各地标准），记6分', 6, '第90条'],
      ['普通道路逆向行驶', '', '罚款（各地标准），记3分', 3, '第90条'],
      ['高速/快速路倒车、逆行、穿越中央分隔带掉头', '', '罚款200元左右（各地标准），记12分', 12, '记分办法第8条'],
      ['高速/快速路违法占用应急车道行驶', '', '罚款（各地标准，多为200元），记6分', 6, '记分办法第10条'],
      ['高速/快速路违法停车', '', '罚款（各地标准），记9分', 9, '记分办法第9条'],
      ['高速公路低于规定最低时速行驶', '', '罚款（各地标准），记3分', 3, '记分办法第11条'],
      ['不按规定车道行驶（高速/快速路）', '', '罚款（各地标准），记3分', 3, '记分办法第11条'],
      ['违反禁令标志、禁止标线指示', '如压实线、违法掉头', '罚款（20–200元幅度），记1分', 1, '第90条'],
      ['机动车行经人行横道不礼让行人', '', '罚款（各地标准），记3分', 3, '第90条'],
      ['遇前方车辆排队时借道超车、穿插等候车辆（加塞）', '', '罚款（各地标准），记3分', 3, '记分办法第11条']]],
    ['安全驾驶行为', '#0891b2', [
      ['驾驶人未按规定系安全带', '', '罚款（20–200元幅度，各地标准），记1分', 1, '第90条'],
      ['驾驶摩托车不戴安全头盔', '', '罚款（各地标准），记1分', 1, '第90条'],
      ['拨打、接听手持电话等妨碍安全驾驶', '', '罚款（各地标准），记3分', 3, '记分办法第11条'],
      ['不按规定使用灯光', '如夜间会车不换近光', '罚款（20–200元幅度），记1分', 1, '第90条'],
      ['故障、事故停车后不按规定使用灯光或设置警告标志', '', '罚款（各地标准），记3分', 3, '记分办法第11条'],
      ['连续驾驶中型以上客车、危险品车超过4小时未休息', '或停车休息少于20分钟', '罚款（各地标准），记9分（货车记3分）', 9, '记分办法第9条']]],
    ['车辆与号牌', '#475569', [
      ['使用伪造、变造或他车的号牌、行驶证、驾驶证', '套牌、假牌', '扣留机动车，罚款2000–5000元，记12分；构成犯罪的追究刑事责任', 12, '第96条'],
      ['未悬挂号牌或故意遮挡、污损号牌', '', '罚款（各地标准），记9分，扣留机动车', 9, '第95条 / 记分办法第9条'],
      ['不按规定安装号牌', '', '罚款（各地标准），记3分', 3, '记分办法第11条'],
      ['未放置检验合格标志、保险标志，未随车携带行驶证、驾驶证', '', '扣留机动车，警告或罚款20–200元', '—', '第95条'],
      ['未按规定投保机动车交通事故责任强制保险', '', '扣留车辆至依法投保，处应缴纳保险费2倍罚款', '—', '第98条'],
      ['驾驶已达报废标准的机动车', '', '收缴并强制报废，罚款200–2000元，吊销驾驶证', '—', '第100条'],
      ['驾驶未按规定定期检验的机动车（非营运小车）', '', '罚款（各地标准），记1分', 1, '记分办法第12条']]],
    ['超员 · 超载', '#b45309', [
      ['小型客车载人超过核定人数20%以上未达50%', '', '罚款200–500元，记3分', 3, '第92条'],
      ['其他载客汽车载人超过核定人数50%以上未达100%', '', '罚款500–2000元，记6分', 6, '第92条'],
      ['载客汽车载人超过核定人数100%以上', '', '罚款500–2000元，记12分', 12, '第92条'],
      ['货车载物超过最大允许总质量未达30%', '', '罚款200–500元，记1分', 1, '第92条'],
      ['货车载物超过最大允许总质量30%以上未达50%', '', '罚款500–2000元，记3分', 3, '第92条'],
      ['货车载物超过最大允许总质量50%以上', '', '罚款500–2000元，记6分', 6, '第92条']]]
  ];
  function pagePenalty(el) {
    A.setTitle('常见违法处罚');
    el.innerHTML = `<div class="r-wrap fade-in"><div class="note warn" style="margin-bottom:12px">依据《中华人民共和国道路交通安全法》（条号指该法）、《道路交通安全违法行为记分管理办法》（2022）。法律规定的罚款为幅度，<b>各省、自治区、直辖市在幅度范围内制定具体执行标准，实际金额以当地为准</b>。记分为2022年4月1日起施行的新标准。</div>
      <div class="r-bar"><input class="r-search" type="search" placeholder="搜索违法行为…"></div><div class="r-pl"></div>
      <div class="card"><div class="card-title">酒驾认定标准（GB 19522）</div><table class="tbl"><tr><th>类型</th><th>血液酒精含量（BAC）</th><th>呼气酒精含量</th></tr><tr><td>饮酒驾车</td><td>≥20 且 &lt;80 mg/100mL</td><td>≥0.09 且 &lt;0.36 mg/L</td></tr><tr><td>醉酒驾车</td><td>≥80 mg/100mL</td><td>≥0.36 mg/L</td></tr></table><p class="small muted" style="margin:8px 0 0">喝一瓶啤酒通常就可能达到饮酒驾驶标准。“喝酒不开车，开车不喝酒”，隔夜酒同样可能超标。</p></div></div>`;
    const box = $('.r-pl', el), inp = $('.r-search', el);
    const draw = () => {
      const q = inp.value.trim();
      box.innerHTML = PEN.map(([c, col, L]) => {
        const F = L.filter(x => !q || x.join('').includes(q)); if (!F.length) return '';
        return `<div class="card"><div class="card-title"><span class="row" style="gap:8px"><i class="r-dot" style="background:${col};width:12px;height:12px"></i>${c}</span></div><div class="r-pen">${F.map(([t, s, p, pt, law]) => `<div class="r-pi"><h4>${hl(t, q)}</h4>${s ? `<div class="small muted">${esc(s)}</div>` : ''}<div class="r-pm">${pt !== '—' && pt !== 0 ? `<span class="tag red">记${pt}分</span>` : pt === 0 ? '<span class="tag green">不记分</span>' : ''}<span class="tag">${esc(law)}</span></div><p>${hl(p, q)}</p></div>`).join('')}</div></div>`;
      }).join('') || '<div class="r-empty">没有匹配的条目</div>';
    };
    inp.oninput = draw; draw();
  }

  /* ================= 汽车构造与操作 ================= */
  const CAR = {
    wheel: ['方向盘', '<p>控制车辆行驶方向。标准握法：<b>左手9点、右手3点</b>（或10点10分），双手握稳；转弯可用交叉手或推拉手法。</p><ul><li>考试中<b>单手控制方向盘</b>（除换挡、操作开关外）判不合格。</li><li>中间为<b>喇叭</b>按钮，按下鸣笛；禁鸣区域不得使用。</li><li>不要在方向盘打死状态停留过久，以免损伤助力泵。</li></ul>'],
    horn: ['喇叭', '<p>按压方向盘中部发出声响。用于提醒行人、车辆，在急弯、坡顶、视线不良处鸣喇叭示意。</p><ul><li>设有“禁止鸣喇叭”标志的路段及夜间城区内禁止鸣喇叭。</li><li>鸣喇叭不得超过0.5秒，连续按鸣不超过3次。</li></ul>'],
    light: ['灯光组合开关（左侧拨杆）', '<p>大多数车型灯光开关位于方向盘<b>左侧</b>：</p><ul><li><b>旋转端头</b>：OFF（关）→ <b>示廓灯（小灯）</b> → <b>近光灯</b>（部分车型有AUTO自动大灯）。</li><li><b>向前推</b>（远离驾驶人）：开启<b>远光灯</b>，仪表亮蓝色远光指示灯；拉回恢复近光。</li><li><b>向后拉</b>（朝驾驶人方向）：<b>远光闪光（超车灯）</b>，松手自动回位；连拉两次即“远近光交替”。</li><li><b>向上拨：右转向灯</b>；<b>向下拨：左转向灯</b>（口诀：上右下左，与方向盘转动方向一致）。</li><li>雾灯：拨杆中段旋钮或灯光旋钮拉出 —— 第一挡前雾灯，第二挡后雾灯。</li></ul><p class="r-mini">下方可交互体验灯光开关与仪表指示灯联动。</p>'],
    wiper: ['雨刮器开关（右侧拨杆）', '<ul><li><b>向上点按（MIST）</b>：单次刮刷，松手回位。</li><li><b>OFF</b>：关闭。</li><li><b>INT / AUTO</b>：间歇刮刷（可调间隔）或自动感应雨量。</li><li><b>LO</b>：低速连续；<b>HI</b>：高速连续，用于大雨。</li><li><b>向驾驶人方向拉</b>：喷洗涤液并刮刷。</li></ul><p>无雨时不要干刮挡风玻璃，以免划伤玻璃和损坏雨刮片。</p>'],
    cluster: ['组合仪表', '<p>位于方向盘正前方，主要包括：</p><ul><li><b>车速表</b>（km/h）与<b>里程表</b>；</li><li><b>发动机转速表</b>（×1000 r/min），手动挡一般在2000–2500转左右换挡较平顺；</li><li><b>燃油表</b>、<b>水温表</b>；</li><li>各类<b>指示灯/报警灯</b>：红色为危险、黄色为警示、绿色/蓝色为工作提示。</li></ul><p>点火至ON挡时指示灯自检点亮，启动后应自动熄灭。</p>'],
    hazard: ['危险报警闪光灯（双闪）', '<p>中控台红色三角按钮，按下后左右转向灯同时闪烁。</p><ul><li>车辆故障、发生事故临时停车时开启，并在来车方向设置警告标志（普通道路50–100米，高速公路<b>150米以外</b>）。</li><li>雾天能见度低于200米时开启；牵引故障车时牵引车和被牵引车均开启。</li><li>路边临时停车应开启。</li></ul>'],
    gear_m: ['手动变速器（H形挡位）', '<p>典型5挡布局：<b>1-2</b>挡在左列，<b>3-4</b>挡中列，<b>5</b>挡与<b>R倒挡</b>在右列（部分车型R挡需下压或上提挡杆）。空挡在中间横线位置。</p><ul><li>换挡时须<b>踩下离合器踏板</b>到底，换挡后平稳松开。</li><li>起步用1挡；加挡要求“车速到、换高挡”，减挡要“先减速、后减挡”。</li><li>倒挡必须在车辆<b>完全停止</b>后挂入。</li><li>考试中低头看挡、连续2次挂挡不进、空挡滑行均不合格。</li></ul>'],
    gear_a: ['自动变速器（P R N D）', '<ul><li><b>P 驻车挡</b>：停车后使用，机械锁止变速器；只能在车辆完全停止后挂入。</li><li><b>R 倒车挡</b>：车辆停稳后踩住制动踏板挂入。</li><li><b>N 空挡</b>：短暂停车或被拖车时使用，<b>行驶中严禁挂N挡滑行</b>。</li><li><b>D 前进挡</b>：正常行驶。部分车型有S运动挡、L/M手动模式。</li><li>启动发动机须在P或N挡并踩住制动踏板；挂挡时必须踩制动。</li></ul>'],
    clutch: ['离合器踏板（最左）', '<p>手动挡车型独有，<b>左脚</b>操作。踩下时切断发动机与变速器的动力，用于起步、换挡和停车。</p><ul><li>起步：踩到底挂1挡 → 慢抬至<b>半联动</b>（车身抖动、转速下降）→ 稍停 → 再缓慢抬起。</li><li>行驶中不要把脚放在离合踏板上（半离合行驶会加速磨损）。</li><li>紧急制动时先踩制动，再踩离合，防止熄火。</li></ul>'],
    brake: ['制动踏板（中间）', '<p><b>右脚</b>操作，用于减速和停车。</p><ul><li>平时制动采用“预见性制动”，提前轻踩、逐渐加力。</li><li>紧急制动时用力踩到底（ABS车型保持踩住，听到“咯咯”声属正常）。</li><li>长下坡应提前减挡，利用发动机制动，避免长时间连续踩制动导致制动器过热失效。</li></ul>'],
    gas: ['加速踏板（油门，最右）', '<p><b>右脚</b>操作，控制发动机转速和车速。踩下越深，动力越大。</p><ul><li>起步、加速时缓踩缓抬，避免猛踩（考试中起步转速过高扣分）。</li><li>右脚在制动和油门之间移动，以脚后跟为支点。</li><li>切勿把加速踏板误当作制动踏板（新手常见事故原因）。</li></ul>'],
    hand: ['驻车制动（手刹）', '<p>停车后防止车辆溜动。</p><ul><li><b>拉起</b>：向上拉紧；<b>放下</b>：先向上微拉，按下端头按钮，再放到底。</li><li>电子手刹（EPB）：上提开关为拉起，踩住制动按下开关为释放，仪表显示红色(P)。</li><li>起步前确认手刹已完全放下，否则仪表制动指示灯常亮。</li><li>坡道停车、靠边停车后必须拉紧驻车制动（未拉紧扣10分）。</li></ul>'],
    mirror: ['后视镜', '<p>包括车内后视镜和左右外后视镜，用于观察后方及侧后方交通情况。</p><ul><li>起步、变道、转弯、靠边停车前都必须观察后视镜，并<b>侧头观察盲区</b>。</li><li>调整：车内镜能看到整个后窗；外后视镜车身约占镜面1/4，水平线位于中间。</li></ul>'],
    belt: ['安全带', '<p>上车后、起步前必须系好安全带，前后排乘员均应使用。</p><ul><li>肩带应经过肩部中间、横跨胸部，腰带应低置于胯部。</li><li>未系安全带记1分；考试中未系安全带直接不合格。</li></ul>'],
    key: ['点火开关 / 一键启动', '<ul><li>传统钥匙：<b>LOCK</b>（锁止）→ <b>ACC</b>（附件通电）→ <b>ON</b>（全车通电，仪表自检）→ <b>START</b>（启动，发动机着车后立即松手）。</li><li>一键启动：踩住制动（手动挡踩离合）按下按钮即可启动。</li><li>发动机启动后不及时松开启动开关扣10分。</li></ul>']
  };
  function pageCar(el) {
    A.setTitle('汽车构造与操作');
    let trans = A.settings.trans === 'auto' ? 'auto' : 'manual', sel = 'light';
    el.innerHTML = `<div class="r-wrap fade-in"><div class="r-bar"><div class="seg ct"><button data-v="manual">手动挡</button><button data-v="auto">自动挡</button></div><span class="muted small">点击驾驶舱部件查看说明</span></div>
      <div class="r-carwrap"><div class="r-cockpit"><svg viewBox="0 0 400 300" class="r-ck"></svg></div>
      <div class="card r-simc" style="margin:0"><div class="card-title">灯光开关模拟 <span class="muted small">左侧组合拨杆</span></div>
        <div class="small muted" style="margin-bottom:6px">旋钮位置</div><div class="r-sw lr"><button class="btn" data-r="0">OFF 关闭</button><button class="btn" data-r="1">示廓灯</button><button class="btn" data-r="2">近光灯</button></div>
        <div class="small muted" style="margin:10px 0 6px">拨杆动作</div><div class="r-sw la"><button class="btn" data-a="push">向前推：远光</button><button class="btn" data-a="flash">向后拉：闪光</button><button class="btn" data-a="alt">远近光交替</button><button class="btn" data-a="up">向上：右转</button><button class="btn" data-a="down">向下：左转</button><button class="btn" data-a="hz">危险报警</button><button class="btn" data-a="ff">前雾灯</button><button class="btn" data-a="rf">后雾灯</button><button class="btn" data-a="reset">全部复位</button></div>
        <div class="small muted" style="margin:10px 0 6px">仪表指示灯</div><div class="r-dashrow"></div><div class="small" id="r-lmsg" style="margin-top:8px;color:var(--text2)"></div></div>
      <div class="card r-info" style="margin:0;align-self:start"></div></div></div>`;
    const svg = $('.r-ck', el), info = $('.r-info', el);
    const hot = (k, inner, box) => `<g class="r-hot" data-k="${k}">${inner}<rect class="r-hl2" x="${box[0]}" y="${box[1]}" width="${box[2]}" height="${box[3]}" rx="10"/></g>`;
    function drawCk() {
      const S = SG();
      const manual = trans === 'manual';
      svg.innerHTML = `
      <path d="M0 0H400V300H0Z" fill="#20242b"/>
      <path d="M0 40Q200 0 400 40V112H0Z" fill="#2c313a"/><path d="M0 112H400V124H0Z" fill="#171a1f"/>
      <path d="M8 6Q200 -26 392 6L380 34Q200 8 20 34Z" fill="#7fa7c9" opacity=".35"/>
      ${hot('mirror', `<rect x="168" y="2" width="64" height="16" rx="6" fill="#111" stroke="#555"/><rect x="172" y="5" width="56" height="10" rx="4" fill="#6a8aa6"/>`, [164, 0, 72, 20])}
      ${hot('cluster', `<path d="M70 52Q140 30 210 52V104H70Z" fill="#0d0f13" stroke="#3a3f48"/><circle cx="110" cy="80" r="21" fill="#15181d" stroke="#4a5059"/><circle cx="170" cy="80" r="21" fill="#15181d" stroke="#4a5059"/><path d="M110 80L96 70M170 80L182 66" stroke="#ff5a3c" stroke-width="2.5" stroke-linecap="round"/><text x="110" y="96" font-size="6" fill="#aaa" text-anchor="middle">r/min</text><text x="170" y="96" font-size="6" fill="#aaa" text-anchor="middle">km/h</text><g transform="translate(131 58) scale(.18)">${S.dash('fuel', 100).replace(/^<svg[^>]*>|<\/svg>$/g, '')}</g>`, [66, 34, 148, 74])}
      ${hot('hazard', `<rect x="262" y="58" width="28" height="22" rx="5" fill="#16191e" stroke="#555"/><path d="M276 62L285 76H267Z" fill="none" stroke="#ff3b30" stroke-width="2.5" stroke-linejoin="round"/>`, [258, 54, 36, 30])}
      <rect x="244" y="88" width="80" height="18" rx="4" fill="#15181d" stroke="#3a3f48"/><text x="284" y="100" font-size="8" fill="#5b9cff" text-anchor="middle">A/C  AUTO  21.5°</text>
      ${hot('light', `<path d="M58 152L10 140" stroke="#3a3f48" stroke-width="12" stroke-linecap="round"/><path d="M58 152L10 140" stroke="#575e69" stroke-width="8" stroke-linecap="round"/><circle cx="12" cy="140" r="8" fill="#6b727e"/><text x="24" y="132" font-size="8" fill="#ddd">灯光</text>`, [0, 122, 66, 40])}
      ${hot('wiper', `<path d="M222 152L270 140" stroke="#3a3f48" stroke-width="12" stroke-linecap="round"/><path d="M222 152L270 140" stroke="#575e69" stroke-width="8" stroke-linecap="round"/><circle cx="268" cy="140" r="8" fill="#6b727e"/><text x="236" y="132" font-size="8" fill="#ddd">雨刮</text>`, [216, 122, 66, 40])}
      ${hot('wheel', `<circle cx="140" cy="160" r="74" fill="none" stroke="#0e1013" stroke-width="16"/><circle cx="140" cy="160" r="74" fill="none" stroke="#2a2e35" stroke-width="10"/><path d="M70 160H112M168 160H210M140 186V232" stroke="#24282e" stroke-width="16" stroke-linecap="round"/>`, [62, 82, 156, 156])}
      ${hot('horn', `<circle cx="140" cy="164" r="26" fill="#1a1d22" stroke="#3b4048" stroke-width="2"/><text x="140" y="168" font-size="9" fill="#999" text-anchor="middle">喇叭</text>`, [112, 136, 56, 56])}
      ${hot('key', `<circle cx="232" cy="186" r="11" fill="#14161a" stroke="#666" stroke-width="2"/><text x="232" y="189" font-size="6" fill="#ccc" text-anchor="middle">START</text>`, [218, 172, 28, 28])}
      <path d="M300 112H372L384 300H292Z" fill="#191c21"/>
      ${manual ? hot('gear_m', `<rect x="306" y="130" width="64" height="70" rx="10" fill="#14161a" stroke="#3c4149"/><path d="M318 144V186M338 144V186M358 144V186M318 165H358" stroke="#555" stroke-width="2"/><text x="318" y="141" font-size="9" fill="#ddd" text-anchor="middle">1</text><text x="318" y="196" font-size="9" fill="#ddd" text-anchor="middle">2</text><text x="338" y="141" font-size="9" fill="#ddd" text-anchor="middle">3</text><text x="338" y="196" font-size="9" fill="#ddd" text-anchor="middle">4</text><text x="358" y="141" font-size="9" fill="#ddd" text-anchor="middle">5</text><text x="358" y="196" font-size="9" fill="#ff7a5c" text-anchor="middle">R</text><circle cx="338" cy="165" r="9" fill="#2d3138" stroke="#777" stroke-width="1.5"/>`, [302, 126, 72, 78])
        : hot('gear_a', `<rect x="306" y="130" width="64" height="70" rx="10" fill="#14161a" stroke="#3c4149"/><path d="M332 140V190" stroke="#555" stroke-width="5" stroke-linecap="round"/>${['P', 'R', 'N', 'D'].map((g, i) => `<text x="352" y="${146 + i * 14}" font-size="10" font-weight="700" fill="${g === 'D' ? '#2fd46b' : g === 'R' ? '#ff7a5c' : '#ddd'}" text-anchor="middle">${g}</text>`).join('')}<rect x="324" y="178" width="16" height="12" rx="4" fill="#2d3138" stroke="#888"/>`, [302, 126, 72, 78])}
      ${hot('hand', `<path d="M320 214L344 268" stroke="#0f1114" stroke-width="16" stroke-linecap="round"/><path d="M320 214L344 268" stroke="#3a3f48" stroke-width="11" stroke-linecap="round"/><circle cx="320" cy="214" r="5" fill="#888"/><text x="356" y="232" font-size="8" fill="#ddd">手刹</text>`, [304, 204, 70, 72])}
      ${hot('belt', `<path d="M6 186L34 300" stroke="#3a3f48" stroke-width="10"/><rect x="2" y="182" width="14" height="10" rx="2" fill="#777"/><text x="22" y="232" font-size="8" fill="#ddd">安全带</text>`, [0, 178, 52, 122])}
      ${manual ? hot('clutch', `<rect x="78" y="250" width="34" height="40" rx="6" fill="#111" stroke="#4a4f57" stroke-width="2"/><path d="M84 260h22M84 268h22M84 276h22" stroke="#333" stroke-width="2"/><text x="95" y="246" font-size="8" fill="#ddd" text-anchor="middle">离合</text>`, [74, 236, 42, 58]) : ''}
      ${hot('brake', `<rect x="${manual ? 128 : 112}" y="250" width="${manual ? 40 : 60}" height="40" rx="6" fill="#111" stroke="#4a4f57" stroke-width="2"/><text x="${manual ? 148 : 142}" y="246" font-size="8" fill="#ddd" text-anchor="middle">制动</text>`, [manual ? 124 : 108, 236, manual ? 48 : 68, 58])}
      ${hot('gas', `<rect x="190" y="240" width="22" height="52" rx="5" fill="#111" stroke="#4a4f57" stroke-width="2"/><path d="M195 250v34M201 250v34M207 250v34" stroke="#333" stroke-width="2"/><text x="201" y="236" font-size="8" fill="#ddd" text-anchor="middle">油门</text>`, [184, 226, 34, 68])}`;
      $$('.r-hot', svg).forEach(h => { h.classList.toggle('on', h.dataset.k === sel); h.onclick = () => { sel = h.dataset.k; showInfo(); $$('.r-hot', svg).forEach(x => x.classList.toggle('on', x === h)); }; });
    }
    function showInfo() { const [t, h] = CAR[sel] || CAR.light; info.innerHTML = `<h3>${t}</h3>${h}`; }
    const ct = $('.ct', el);
    $$('button', ct).forEach(b => b.classList.toggle('on', b.dataset.v === trans));
    ct.onclick = e => { const b = e.target.closest('button'); if (!b) return; trans = b.dataset.v; $$('button', ct).forEach(x => x.classList.toggle('on', x === b)); if (sel === 'gear_m' || sel === 'gear_a') sel = trans === 'manual' ? 'gear_m' : 'gear_a'; if (sel === 'clutch' && trans === 'auto') sel = 'brake'; drawCk(); showInfo(); };
    drawCk(); showInfo();
    // 灯光模拟
    const S = SG(), keys = ['position', 'low_beam', 'high_beam', 'turn', 'hazard', 'fog_front', 'fog_rear'];
    const row = $('.r-dashrow', el); row.innerHTML = keys.map(k => S.dash(k, 44).replace('<svg ', `<svg data-k="${k}" `)).join('');
    const st = { rot: 0, high: false, flash: false, turn: '', hz: false, ff: false, rf: false };
    const msg = $('#r-lmsg', el), lt = bag(); life.add(() => lt.clear());
    function ren(m) {
      const on = k => row.querySelector(`[data-k="${k}"]`);
      on('position').classList.toggle('on', st.rot >= 1);
      on('low_beam').classList.toggle('on', st.rot >= 2 && !st.high);
      on('high_beam').classList.toggle('on', (st.rot >= 2 && st.high) || st.flash);
      on('turn').classList.toggle('blink', !!st.turn && !st.hz); on('turn').classList.remove('on');
      on('hazard').classList.toggle('blink', st.hz);
      on('fog_front').classList.toggle('on', st.ff); on('fog_rear').classList.toggle('on', st.rf);
      $$('.lr .btn', el).forEach(b => b.classList.toggle('on', +b.dataset.r === st.rot));
      $$('.la .btn', el).forEach(b => b.classList.toggle('on', (b.dataset.a === 'push' && st.high) || (b.dataset.a === 'up' && st.turn === 'r') || (b.dataset.a === 'down' && st.turn === 'l') || (b.dataset.a === 'hz' && st.hz) || (b.dataset.a === 'ff' && st.ff) || (b.dataset.a === 'rf' && st.rf)));
      if (m) msg.textContent = m;
    }
    $('.lr', el).onclick = e => { const b = e.target.closest('.btn'); if (!b) return; st.rot = +b.dataset.r; if (st.rot < 2) st.high = false; if (st.rot < 1) { st.ff = st.rf = false; } A.beep('click'); ren(['旋钮置于OFF：灯光全部关闭。', '示廓灯（小灯）开启：仪表绿色示廓灯亮，用于傍晚、临时停车。', '近光灯开启：夜间、隧道、会车、跟车使用。'][st.rot]); };
    $('.la', el).onclick = e => {
      const b = e.target.closest('.btn'); if (!b) return; const a = b.dataset.a; A.beep('click'); lt.clear();
      if (a === 'push') { if (st.rot < 2) { ren('须先将旋钮转到近光灯位置，才能向前推开启远光（闪光不受此限制）。'); return; } st.high = !st.high; ren(st.high ? '远光灯开启（蓝色指示灯）。会车、跟车、照明良好时必须切回近光。' : '拉回拨杆：恢复近光。'); }
      else if (a === 'flash' || a === 'alt') {
        const n = a === 'alt' ? 2 : 1; let i = 0;
        const step = () => { st.flash = true; ren(a === 'alt' ? '远近光交替：连续拉动拨杆两次。用于超车、通过急弯坡路拱桥人行横道及无信号灯路口。' : '向后拉拨杆：远光闪烁一次（超车灯），松手自动回位。'); lt.timeout(() => { st.flash = false; ren(); if (++i < n) lt.timeout(step, 280); }, 320); };
        step();
      }
      else if (a === 'up' || a === 'down') { const t = a === 'up' ? 'r' : 'l'; st.turn = st.turn === t ? '' : t; if (st.turn) A.beep('blinker'); ren(st.turn ? (t === 'r' ? '向上拨：右转向灯闪烁。' : '向下拨：左转向灯闪烁。') + '转向、变道、靠边停车前至少提前3秒开启。' : '转向灯关闭（转弯后方向盘回正会自动回位）。'); }
      else if (a === 'hz') { st.hz = !st.hz; ren(st.hz ? '危险报警闪光灯开启：所有转向灯同时闪烁。' : '危险报警闪光灯关闭。'); }
      else if (a === 'ff') { if (st.rot < 1) { ren('雾灯需在示廓灯或近光灯开启后才能打开。'); return; } st.ff = !st.ff; ren(st.ff ? '前雾灯开启。' : '前雾灯关闭。'); }
      else if (a === 'rf') { if (st.rot < 1) { ren('雾灯需在示廓灯或近光灯开启后才能打开。'); return; } st.rf = !st.rf; ren(st.rf ? '后雾灯开启（黄色指示灯）：能见度低时使用，好转后及时关闭。' : '后雾灯关闭。'); }
      else if (a === 'reset') { Object.assign(st, { rot: 0, high: false, flash: false, turn: '', hz: false, ff: false, rf: false }); ren('已全部复位。'); }
    };
    ren('点击上方按钮体验灯光组合开关。');
  }

  /* ================= 路由 ================= */
  const PAGES = { '': pageHub, signs: pageSigns, marks: pageMarks, dash: pageDash, gestures: pageGestures, lights: pageLights, points: pagePoints, k2rules: (el) => rulesPage(el, K2, '科目二评判标准'), k3rules: (el) => rulesPage(el, K3, '科目三评判标准'), penalty: pagePenalty, car: pageCar };
  A.define('ref', {
    mount(el, { path, query }) {
      css(); life.clear(); life = bag();
      const p = PAGES[path[1] || ''] || pageHub;
      p(el, query || {});
    },
    unmount() { life.clear(); }
  });
})();
