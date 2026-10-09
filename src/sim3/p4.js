
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
