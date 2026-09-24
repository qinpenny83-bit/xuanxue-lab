// 一次性脚本：将 hexagrams-data.js 的 lines 统一为「自下而上」编码
// 数据现状：前三位=上卦（top-down）；应改为：前三位=下卦（bottom-up）
// 规则：bottomUp = lines.slice(3) + lines.slice(0,3)，并用 BAGUA 校验上下卦字段
import { readFileSync, writeFileSync } from 'node:fs'

const dataPath = 'C:/Users/qinpei/AppData/Roaming/TRAE SOLO CN/ModularData/ai-agent/work-mode-projects/6aa7e5ab08455455bde7af59/src/data/iching/hexagrams-data.js'

const text = readFileSync(dataPath, 'utf8')
const hexSection = text.slice(text.indexOf('export const HEXAGRAMS'), text.indexOf('export const BAGUA'))
const entries = [...hexSection.matchAll(/\{ seq: (\d+), name: '([^']+)', full: '([^']+)', upper: '([^']+)', lower: '([^']+)', lines: '([01]{6})'/g)]
console.log('解析到卦数：', entries.length)

const BAGUA = { 乾: '111', 兑: '110', 离: '101', 震: '100', 巽: '011', 坎: '010', 艮: '001', 坤: '000' }
const triName = (tri) => Object.keys(BAGUA).find((k) => BAGUA[k] === tri) || null

let errors = 0
const mapping = new Map()
for (const [, seq, name, , upper, lower, lines] of entries) {
  const bu = lines.slice(3) + lines.slice(0, 3)
  const loName = triName(bu.slice(0, 3))
  const upName = triName(bu.slice(3, 6))
  const ok = loName === lower && upName === upper
  if (!ok) { errors++; console.log(`X seq=${seq} ${name}: ${lines} -> ${bu} 下=${loName} 上=${upName} 与字段 ${lower}/${upper} 不符`) }
  else console.log(`OK seq=${seq} ${name}: ${lines} -> ${bu}`)
  mapping.set(Number(seq), bu)
}
console.log('校验错误数：', errors)
if (errors > 0) process.exit(1)

const lines = text.split('\n')
let curSeq = null
for (let i = 0; i < lines.length; i++) {
  const seqM = lines[i].match(/seq: (\d+),/)
  if (seqM) curSeq = Number(seqM[1])
  if (curSeq !== null && mapping.has(curSeq)) {
    const re = new RegExp("(lines: ')[01]{6}(')")
    if (re.test(lines[i])) {
      lines[i] = lines[i].replace(re, `$1${mapping.get(curSeq)}$2`)
      curSeq = null
    }
  }
}
writeFileSync(dataPath, lines.join('\n'), 'utf8')
console.log('DONE 已重写 lines 为自下而上编码')
