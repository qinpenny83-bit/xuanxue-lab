// 扫描用户点名的学科指代词：民俗学/心理学/文化研究/心理来源等
const fs = require('fs')
const path = require('path')

const dir = path.join(__dirname, '..', 'src', 'data', 'curriculum')
const files = fs.readdirSync(dir).filter((f) => f.endsWith('.js'))

const pats = ['民俗学', '心理学', '文化研究', '心理来源', '心理功能', '心理层面', '文化机制', '文化解释', '文化符号', '文化体系', '文化现象', '文化传统', '文化意义', '社会功能', '社会整合', '民俗与信仰', '民俗范畴', '信仰范畴', '象征体系', '象征性', '象征表达', '象征意义', '文化价值', '观念史', '叙事学', '人类学', '社会学', '统计学']
const used = new Set()
for (const f of files) {
  const s = fs.readFileSync(path.join(dir, f), 'utf8')
  const lines = s.split('\n')
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    for (const p of pats) {
      if (line.includes(p) && !used.has(`${f}:${i + 1}`)) {
        used.add(`${f}:${i + 1}`)
        console.log(`${f}:${i + 1} [${p}]: ${line.trim().slice(0, 190)}`)
      }
    }
  }
}
