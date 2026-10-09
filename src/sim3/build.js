// 需要 terser：npm i terser（在任意目录），然后修改下面的 require 路径
const { minify } = require('terser'); const fs = require('fs'); const path = require('path');
const src = fs.readFileSync(path.join(__dirname, 'src.js'), 'utf8');
(async () => {
  const r = await minify(src, { ecma: 2020, compress: { passes: 2 }, mangle: true, format: { comments: false, max_line_len: 1000 } });
  const head = '/* 驾考通 · 科目三 道路驾驶技能模拟器 sim3：伪3D路网/车辆物理/AI交通/路考评判/灯光考试（压缩构建） */\n';
  fs.writeFileSync(path.join(__dirname, '../../js/sim3.js'), head + r.code + '\n');
  console.log(Buffer.byteLength(head + r.code));
})();
