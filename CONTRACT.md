# 驾考通 — Module Contract (READ FIRST)

Static, zero-dependency website for Chinese driving-license exams (科目一/二/三/四). No build step, no npm, no external URLs, no images/fonts files — everything is drawn with Canvas / inline SVG / CSS. Must work on phones (touch, portrait AND landscape) and desktop (mouse + keyboard). All UI text in Simplified Chinese.

Files (do NOT edit files you don't own; read `index.html`, `css/style.css`, `js/core.js` to understand the shell):

| file | owner |
|---|---|
| index.html, css/style.css, js/core.js, sw.js | main (read-only for you) |
| js/quiz.js, js/qb1.js | quiz agent |
| js/qb4.js | qb4 agent |
| js/signs.js, js/ref.js | ref agent |
| js/sim2.js | sim2 agent |
| js/sim3.js | sim3 agent |

## Global API (`window.App`, from js/core.js)
- `App.define(name, { mount(el, {path, query}), unmount() })` — register module. `el` is the `#view` container (already emptied). `path` = hash segments, e.g. `#/k2/daoku?mode=exam` → `path=['k2','daoku'], query={mode:'exam'}`. Mount is called again on every hash change (unmount first). Remove all listeners / RAF loops / timers / speech in `unmount`.
- Routes → modules (core lazy-loads scripts listed, in order):
  - `#/k1...`, `#/k4...`, `#/quiz/...` → module `quiz` (loads js/signs.js, js/quiz.js)
  - `#/k2...` → `sim2` (js/sim2.js)
  - `#/k3...` → `sim3` (js/sim3.js)
  - `#/ref...` → `ref` (js/signs.js, js/ref.js)
- `App.load(src | [src])` → Promise, lazy load another script once (e.g. quiz loads `js/qb1.js`).
- `App.store.get(key, default)` / `App.store.set(key, value)` — namespaced localStorage JSON. Prefix your keys with your module (e.g. `quiz_`, `sim2_`), except the shared keys below.
- `App.settings` — `{theme, voice, sound, vibrate, trans:'manual'|'auto'}` (read; `trans` = default gearbox for sims).
- `App.toast(msg, ms)`, `App.modal({title, html, buttons:[{text, primary, danger, onClick}], closable})` returns close fn, `App.confirm(msg)` → Promise<bool>, `App.esc(str)`.
- `App.speak(text, {rate, interrupt})` → Promise resolved when finished (zh-CN TTS; respects voice setting). `App.stopSpeak()`.
- `App.beep(type)` types: click, ok, bad, tick, ding, blinker, warn, pass, horn. `App.vibrate(ms)`.
- `App.immersive(true|false)` — hide header/tabbar/sidebar, `#view` becomes full viewport (100dvh, no padding, overflow hidden). Core resets to false on route change.
- `App.record(key, {score, pass, ...})` — append exam history; keys `k1`,`k2`,`k3`,`k4` are shown on 我的 page and home (score = number 0-100, pass = bool).
- `App.go('#/k2')`, `App.setTitle(str)` (top bar title), `App.isTouch()`.
- Shared keys: `done_k1` / `done_k4` = object `{questionId: 1 (correct) | 0 (wrong)}`; `bank_totals` = `{k1: N, k4: N}` (quiz writes these; home shows progress).

## CSS available (css/style.css)
`.card .card-title .list .list-item .arrow .btn(.primary .ok .danger .ghost .sm .lg .block) .tag(.blue .green .red .orange) .grid(.g2 .g3 .g4) .row(.wrap .between) .col .flex1 .muted .small .center .note(.warn .bad .ok) .seg>button.on .switch .kbd .progress>i .section-title .tbl .ico .badge .fade-in`
CSS vars: `--pri --ok --bad --warn --k1..--k4 --bg --card --card2 --text --text2 --text3 --line --shadow --radius`. Dark mode via `html[data-theme=dark]` — use the vars so dark mode works.
Module-specific CSS: inject ONE `<style id="yourmodule-css">` once (check existence), all class names prefixed (`q-`, `s2-`, `s3-`, `r-`).

## Question bank format (qb1.js / qb4.js)
```js
window.QB = window.QB || {};
QB.k1 = {   // or QB.k4
  chapters: [ {id:'c1', name:'道路交通安全法律、法规和规章'}, ... ],
  list: [
    { id:'k1_0001', ch:'c1', type:'judge'|'single'|'multi',
      q:'题干', opts:['A text','B text','C text','D text'],   // judge: opts omitted (UI shows 正确/错误)
      ans:'A' | 'AB' | '对' | '错',                         // multi: letters in order, e.g. 'ACD'
      exp:'详细解析（为什么、法条依据、记忆技巧）',
      img:'sign:no_entry' | 'dash:abs' | 'svg:<svg ...>...</svg>' | undefined }  // optional illustration
  ]
};
```
`img` kinds: `sign:<key>` → `Signs.svg(key)`; `dash:<key>` → `Signs.dash(key)` (dashboard indicator); `svg:` inline SVG markup (scenario diagrams drawn by the question author — keep small).

## Signs library (js/signs.js) — `window.Signs`
- `Signs.svg(key, size=120)` → SVG markup string (or '' if unknown). `Signs.dash(key, size=80)` → dashboard indicator SVG. `Signs.list` → `[{key, name, cat, desc}]`, `Signs.dashList` → `[{key, name, color, desc}]`.
- MUST implement at least these sign keys (question authors rely on them):
  Warning (yellow triangle): `w_cross` 十字交叉, `w_t_left`/`w_t_right`/`w_t` T形交叉, `w_y` Y形交叉, `w_round` 环形交叉, `w_sharp_left`/`w_sharp_right` 急弯, `w_reverse_curve` 反向弯路, `w_winding` 连续弯路, `w_steep_up`/`w_steep_down` 上/下陡坡, `w_narrow_both`/`w_narrow_left`/`w_narrow_right` 窄路, `w_narrow_bridge` 窄桥, `w_two_way` 双向交通, `w_ped` 注意行人, `w_children` 注意儿童, `w_animals` 注意牲畜, `w_wild` 注意野生动物, `w_signal` 注意信号灯, `w_rock_left`/`w_rock_right` 注意落石, `w_crosswind` 注意横风, `w_slippery` 易滑, `w_mountain_left`/`w_mountain_right` 傍山险路, `w_dyke_left`/`w_dyke_right` 堤坝路, `w_village` 村庄, `w_tunnel` 隧道, `w_ferry` 渡口, `w_hump_bridge` 驼峰桥, `w_bumpy` 路面不平, `w_hump` 路面高凸, `w_dip` 路面低洼, `w_ford` 过水路面, `w_rail_guarded` 有人看守铁道路口, `w_rail_unguarded` 无人看守铁道路口, `w_bike` 注意非机动车, `w_accident` 事故易发路段, `w_slow` 慢行, `w_obstacle` 左右绕行, `w_danger` 注意危险, `w_work` 施工, `w_fog` 注意雾天, `w_rain` 注意雨雪天, `w_ice` 注意路面结冰, `w_disabled` 注意残疾人, `w_queue` 注意前方车辆排队, `w_merge_left`/`w_merge_right` 注意合流
  Prohibition (red ring): `p_no_entry` 禁止驶入, `p_no_vehicles` 禁止通行, `p_no_motor` 禁止机动车驶入, `p_no_truck` 禁止载货汽车驶入, `p_no_bus` 禁止大型客车驶入, `p_no_moto` 禁止摩托车驶入, `p_no_tractor` 禁止拖拉机驶入, `p_no_bike` 禁止非机动车进入, `p_no_ped` 禁止行人进入, `p_no_left` 禁止向左转弯, `p_no_right` 禁止向右转弯, `p_no_straight` 禁止直行, `p_no_left_right` 禁止向左向右转弯, `p_no_straight_left` 禁止直行和向左转弯, `p_no_straight_right` 禁止直行和向右转弯, `p_no_uturn` 禁止掉头, `p_no_overtake` 禁止超车, `p_end_no_overtake` 解除禁止超车, `p_no_parking` 禁止停车, `p_no_long_parking` 禁止长时停车, `p_no_horn` 禁止鸣喇叭, `p_width` 限制宽度(3m), `p_height` 限制高度(3.5m), `p_weight` 限制质量(10t), `p_axle` 限制轴重(7t), `p_speed_40` 限制速度40, `p_speed_60`, `p_speed_80`, `p_end_speed_40` 解除限制速度, `p_stop` 停车让行(red octagon 停), `p_yield` 减速让行(inverted triangle 让), `p_priority_oncoming` 会车让行, `p_check` 停车检查, `p_danger_goods` 禁止运输危险物品车辆驶入
  Mandatory (blue circle): `m_straight` 直行, `m_left` 向左转弯, `m_right` 向右转弯, `m_straight_left` 直行和向左转弯, `m_straight_right` 直行和向右转弯, `m_left_right` 向左和向右转弯, `m_keep_right` 靠右侧道路行驶, `m_keep_left` 靠左侧道路行驶, `m_round` 环岛行驶, `m_honk` 鸣喇叭, `m_min_speed_50` 最低限速50, `m_bike_lane` 非机动车行驶, `m_motor_lane` 机动车行驶, `m_ped` 步行, `m_uturn` 允许掉头, `m_overpass` 立交直行和左转弯行驶, `m_lane_bus` 公交线路专用车道, `m_lane_straight` 直行车道, `m_lane_left` 左转车道, `m_lane_right` 右转车道, `m_lane_straight_right` 直行和右转合用车道, `m_lane_uturn` 掉头车道, `m_lane_bike` 非机动车车道, `m_lane_hov` 多乘员车辆专用车道, `m_ped_crossing` 人行横道, `m_yield_ped` 注意行人(礼让行人)
  Guide/info: `g_parking` 停车场P, `g_hospital` 医院, `g_gas` 加油站, `g_service` 服务区, `g_crossing_ped` 人行横道(blue square), `g_ped_overpass` 人行天桥, `g_underpass` 人行地下通道, `g_bus_stop` 公交站, `g_emergency_stop` 紧急停车带, `g_tunnel_light` 隧道开车灯, `g_one_way` 单行路, `g_expwy_start` 高速公路起点, `g_expwy_end` 高速公路终点, `g_dist_exit` 出口预告, `g_toll` 收费站, `g_lane_change` 车道数变少, `g_detour` 绕行
  Markings (draw as road-surface diagrams): `mk_center_solid` 黄色单实线, `mk_center_double` 双黄实线, `mk_center_dashed` 黄虚线, `mk_solid_dashed` 黄色虚实线, `mk_white_dashed` 白虚线, `mk_white_solid` 白实线, `mk_stop_line` 停止线, `mk_yield_line` 减速让行线, `mk_crosswalk` 人行横道线, `mk_crosswalk_warn` 人行横道预告标示(菱形), `mk_guide_arrows` 导向箭头, `mk_no_parking_yellow` 禁止停车线(黄色网状线), `mk_bus_lane` 公交专用道, `mk_turn_wait` 左转弯待转区, `mk_diversion` 导流线, `mk_deceleration` 车行道横向减速标线, `mk_fish_bone` 纵向减速标线, `mk_netting` 网状线
- Dashboard keys `Signs.dash(key)`: `abs`, `airbag`, `seatbelt`, `oil` 机油压力, `battery`, `coolant` 水温, `fuel` 燃油, `brake` 制动系统/驻车, `engine` 发动机故障, `door` 车门未关, `trunk` 行李箱, `hood` 发动机舱盖, `high_beam` 远光, `low_beam` 近光, `fog_front` 前雾灯, `fog_rear` 后雾灯, `position` 示廓灯, `turn` 转向, `hazard` 危险报警闪光灯, `tpms` 胎压, `esp` 车身稳定, `esp_off`, `epb` 电子手刹, `washer` 洗涤液, `defrost_front` 前挡除霜, `defrost_rear` 后挡除霜, `cruise` 定速巡航, `glow` 预热(柴油), `steering` 转向助力, `child_lock`, `auto_hold`, `eco`, `inner_loop` 内循环, `outer_loop` 外循环, `wiper` 雨刮.

## Quality bar
- "极其细致": realistic detail, accurate Chinese traffic rules (2022–2026 现行规则, e.g. 2022.4.1 起施行的新记分办法), polished UI, smooth 60fps, devicePixelRatio-aware canvas, no console errors.
- Minimal loading: no external resources at all. Keep each file reasonably sized (sims ≲ 150 KB, banks can be larger).
- Test your file with `node --check file.js`. You can serve the site with `cd /home/car && python3 -m http.server 8080` for manual checks if useful (headless — you cannot see a screen; reason carefully).
