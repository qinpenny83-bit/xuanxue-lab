// 一次性术语改写：把课程库中的科学术语替换为玄学断事术语（保留结构字段名）
// 保护：实验记录（功能名）、微实验（功能名）、实验室（功能名，如「变化实验室」）、推理实验（导航功能名）
// 注意：量化、实验两词不做全库替换，残留个案由人工逐句处理（避免「单变量化」被拆坏）
const fs = require('fs')
const path = require('path')

const dir = path.join(__dirname, '..', 'src', 'data', 'curriculum')
const pairs = [
  ['实验记录', '\u0001EXPREC\u0001'],
  ['微实验', '\u0001MEXP\u0001'],
  ['实验室', '\u0001LAB\u0001'],
  ['推理实验', '\u0001REXP\u0001'],
  ['证据', '凭据'],
  ['检验', '查验'],
  ['验证', '对账'],
  ['假设', '断语'],
  ['测量', '量度'],
  ['精度', '准头'],
  ['样本', '个例'],
  ['数据', '读数'],
  ['指标', '标尺'],
  ['\u0001EXPREC\u0001', '实验记录'],
  ['\u0001MEXP\u0001', '微实验'],
  ['\u0001LAB\u0001', '实验室'],
  ['\u0001REXP\u0001', '推理实验'],
]

const files = fs.readdirSync(dir).filter((f) => f.endsWith('.js'))
let total = 0
for (const f of files) {
  const p = path.join(dir, f)
  let s = fs.readFileSync(p, 'utf8')
  const before = s
  for (const [a, b] of pairs) s = s.split(a).join(b)
  if (s !== before) {
    fs.writeFileSync(p, s, 'utf8')
    total++
    console.log('rewritten:', f)
  }
}
console.log('files rewritten:', total)
