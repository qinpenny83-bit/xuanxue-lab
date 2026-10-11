// Temporary validation for qimen question-block conversion (run once, then delete)
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const curDir = join(__dirname, '..', 'src', 'data', 'curriculum')

const files = ['qimen-basic.js', 'qimen-structure.js', 'qimen-layout.js', 'qimen-judge.js', 'qimen-apply.js', 'qimen-advanced.js']
const chapters = files.map((f) => import(join(curDir, f)))

const FORBIDDEN = ['命中注定', '算命', '大师预测', '精准预测', '科学验证', '必吉', '转运', '开运', '包你', '一定灵', '保证', '绝对', '必定', '百分之百']
const BLOCK_KEYS = ['apply', 'applyB', 'counter', 'counterB', 'masteryCheck']
const EXPECTED = { apply: 3, counter: 3, masteryCheck: 3, applyB: 4, counterB: 4 }

let errors = []
let nodeCount = 0
let blockCount = 0

const deepStrings = (obj, out = []) => {
  if (typeof obj === 'string') { out.push(obj); return out }
  if (obj && typeof obj === 'object') for (const v of Object.values(obj)) deepStrings(v, out)
  return out
}

for (const ch of await Promise.all(chapters)) {
  const chapter = Object.values(ch)[0]
  for (const n of chapter.nodes) {
    nodeCount++
    for (const key of BLOCK_KEYS) {
      const b = n[key]
      if (!b) continue
      blockCount++
      // prompt non-empty
      if (!b.prompt || !b.prompt.length) errors.push(`${n.id} ${key} prompt 为空`)
      // option count
      if (b.options.length !== EXPECTED[key]) errors.push(`${n.id} ${key} 选项数 ${b.options.length} != ${EXPECTED[key]}`)
      // exactly 1 correct
      const corrects = b.options.filter((o) => o.correct === true)
      if (corrects.length !== 1) errors.push(`${n.id} ${key} 正确项数 ${corrects.length} != 1`)
      for (const o of b.options) {
        if (!o.text || !o.text.length) errors.push(`${n.id} ${key} 选项 text 为空`)
        if (!o.feedback || !o.feedback.length) errors.push(`${n.id} ${key} 选项 feedback 为空`)
        if (o.correct !== true) {
          if (!o.errorType || !o.errorType.length) errors.push(`${n.id} ${key} 错误项缺 errorType`)
          else if (!n.errorTypes || !n.errorTypes.includes(o.errorType)) errors.push(`${n.id} ${key} errorType ${o.errorType} 不在节点列表 [${n.errorTypes}]`)
        }
      }
      // forbidden words in prompt/options/feedback/explain
      const text = JSON.stringify({ p: b.prompt, o: b.options, e: b.explain })
      for (const w of FORBIDDEN) if (text.includes(w)) errors.push(`${n.id} ${key} 含禁词「${w}」`)
      if (text.includes('科学') || text.includes('迷信')) errors.push(`${n.id} ${key} 含「科学/迷信」`)
      // old-style markers
      if (b.prompt.includes('哪个反例') || b.prompt.includes('最说明问题')) errors.push(`${n.id} ${key} prompt 仍是反例风格`)
      // scenario style: apply/applyB should be rule-based; counter/counterB should be 师兄弟争论/师父考校 style
      if ((key === 'counter' || key === 'counterB') && !/师兄弟|师父考校|研讨|争论/.test(b.prompt)) errors.push(`${n.id} ${key} prompt 缺少研习情境`)
    }
  }
}

console.log(`节点数: ${nodeCount}, 题目块数: ${blockCount}`)
if (errors.length) {
  console.log(`发现 ${errors.length} 个问题:`)
  errors.forEach((e) => console.log(' - ' + e))
  process.exit(1)
} else {
  console.log('全部校验通过 ✔')
}
