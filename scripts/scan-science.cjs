// 打印「当作事实/当成事实」（无「不能」前缀）与所有「科学」上下文行
const fs = require('fs')
const path = require('path')

const dir = path.join(__dirname, '..', 'src', 'data', 'curriculum')
const files = fs.readdirSync(dir).filter((f) => f.endsWith('.js'))

console.log('===== 当作事实/当成事实（非不能前缀） =====')
for (const f of files) {
  const s = fs.readFileSync(path.join(dir, f), 'utf8')
  const lines = s.split('\n')
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    if (!/不能当作事实|不能当成事实/.test(line) && /当作事实|当成事实/.test(line)) {
      console.log(`${f}:${i + 1}: ${line.trim().slice(0, 200)}`)
    }
  }
}

console.log('\n===== 科学 所有行 =====')
for (const f of files) {
  const s = fs.readFileSync(path.join(dir, f), 'utf8')
  const lines = s.split('\n')
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    if (line.includes('科学')) {
      console.log(`${f}:${i + 1}: ${line.trim().slice(0, 200)}`)
    }
  }
}
