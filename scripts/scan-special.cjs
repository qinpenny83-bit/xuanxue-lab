// 打印需要人工判断的「科学判定腔」上下文行（排除可直接替换的「未证实」家族）
const fs = require('fs')
const path = require('path')

const dir = path.join(__dirname, '..', 'src', 'data', 'curriculum')
const files = fs.readdirSync(dir).filter((f) => f.endsWith('.js'))

const direct = /未证实|未被证实|未经证实|无法证实|无从证实|尚未证实|未经验证|没有证据|缺乏证据|证据不足/
const special = [
  { label: '不能当作事实', re: /不能当作事实/ },
  { label: '不能当成事实', re: /不能当成事实/ },
  { label: '不是事实', re: /不是事实/ },
  { label: '科学断言', re: /科学断言/ },
  { label: '科学判断', re: /科学判断/ },
  { label: '实证', re: /实证/ },
  { label: '证伪', re: /证伪/ },
  { label: '可证', re: /可证/ },
  { label: '独立证实', re: /证实/ },
]

for (const f of files) {
  const s = fs.readFileSync(path.join(dir, f), 'utf8')
  const lines = s.split('\n')
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    for (const { label, re } of special) {
      if (re.test(line) && !(label === '独立证实' && direct.test(line))) {
        console.log(`${f}:${i + 1} [${label}]: ${line.trim().slice(0, 220)}`)
      }
    }
  }
}
