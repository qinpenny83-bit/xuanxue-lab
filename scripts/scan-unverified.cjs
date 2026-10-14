// 扫描课程库中「科学判定腔」术语分布（只统计，不修改）
const fs = require('fs')
const path = require('path')

const dir = path.join(__dirname, '..', 'src', 'data', 'curriculum')
const files = fs.readdirSync(dir).filter((f) => f.endsWith('.js'))

const groups = {
  未证实类: ['未证实', '未被证实', '无法证实', '无从证实', '未经证实', '未经验证', '尚未证实', '尚无实据', '没有证据', '缺乏证据', '证据不足', '没有根据', '缺乏根据'],
  事实判定类: ['不能当作事实', '不能当成事实', '不能当作', '不能当成', '不是事实', '并非事实', '当作事实', '当成事实'],
  科学指代类: ['科学断言', '科学判断', '科学立场', '科学视角', '科学方法', '科学验证', '科学检验', '科学实证', '科学的', '科学',
  ],
  实证类: ['实证', '证伪', '可证', '证实'],
}

for (const f of files) {
  const s = fs.readFileSync(path.join(dir, f), 'utf8')
  const lineCount = s.split('\n').length
  const out = []
  for (const [g, pats] of Object.entries(groups)) {
    for (const p of pats) {
      const c = s.split(p).length - 1
      if (c > 0) out.push(`${g}:${p}=${c}`)
    }
  }
  if (out.length) {
    console.log(`\n== ${f} (${lineCount}行) ==`)
    console.log('  ' + out.join('\n  '))
  }
}
