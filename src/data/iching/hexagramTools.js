// ============================================================
// 🧮 卦象工具（Phase 4）
// 全部 deterministic：结构推导（错/综/互/变）与种子化起卦模拟。
// 起卦模拟：以种子（如日期 + 问题）驱动确定性伪随机，结果可复现；
//   本质是「传统文化起卦方法的流程学习」，不把随机结果包装成预测工具。
// ============================================================

import { HEXAGRAMS, BAGUA } from './hexagrams-data'

export const HEX_BY_LINES = HEXAGRAMS.reduce((acc, h) => {
  acc[h.lines] = h
  return acc
}, {})

export const HEX_BY_SEQ = HEXAGRAMS.reduce((acc, h) => {
  acc[h.seq] = h
  return acc
}, {})

export const HEX_BY_NAME = HEXAGRAMS.reduce((acc, h) => {
  acc[h.name] = h
  return acc
}, {})

export function getHexagram(seqOrNameOrLines) {
  if (typeof seqOrNameOrLines === 'number') return HEX_BY_SEQ[seqOrNameOrLines] || null
  const s = String(seqOrNameOrLines)
  if (/^[01]{6}$/.test(s)) return HEX_BY_LINES[s] || null
  return HEX_BY_NAME[s] || null
}

// 六爻 → 显示串（自下而上）
export function linesToSymbol(lines) {
  return lines
    .split('')
    .map((c) => (c === '1' ? '⚊' : '⚋'))
    .join('')
}

// 爻位名称（自下而上）：初/二/三/四/五/上
export const LINE_POSITIONS = ['初', '二', '三', '四', '五', '上']

export function lineLabel(index, yang) {
  // index 0 = 初爻；传统命名：初九/初六、上九/上六（位置在前），
  // 二~五爻则为「九/六 + 位名」（九二、六三…九五、六五）。
  const pos = LINE_POSITIONS[index] || `${index + 1}`
  const yao = yang ? '九' : '六'
  if (index === 0) return `初${yao}`
  if (index === 5) return `上${yao}`
  return `${yao}${pos}`
}

// ── 结构推导 ──────────────────────────────────────────────

// 错卦（旁通）：六爻全部阴阳互变
export function oppositeHex(lines) {
  return lines
    .split('')
    .map((c) => (c === '1' ? '0' : '1'))
    .join('')
}

// 综卦（覆卦/反对）：六爻上下颠倒
export function reverseHex(lines) {
  return lines.split('').reverse().join('')
}

// 互卦：取原卦 2-4 爻为下卦，3-5 爻为上卦
// lines 自下而上（初爻在左）：互下＝2/3/4 爻，互上＝3/4/5 爻
export function mutualHex(lines) {
  const arr = lines.split('')
  const mutualLower = arr.slice(1, 4).join('') // 2,3,4 爻（互卦之下卦）
  const mutualUpper = arr.slice(2, 5).join('') // 3,4,5 爻（互卦之上卦）
  return mutualLower + mutualUpper // 自下而上：下卦在前
}

// 三爻串 → 八卦名
export function trigramName(tri) {
  for (const [name, info] of Object.entries(BAGUA)) {
    if (info.trigram === tri) return name
  }
  return null
}

// 卦 → 关系图（错/综/互，均返回卦对象或 null）
export function hexagramRelations(h) {
  if (!h) return { opposite: null, reverse: null, mutual: null }
  return {
    opposite: getHexagram(oppositeHex(h.lines)),
    reverse: getHexagram(reverseHex(h.lines)),
    mutual: getHexagram(mutualHex(h.lines)),
  }
}

// 某爻变化后得到的新卦（本卦 → 变卦）
export function changeLine(lines, index) {
  // index 0-5，自下而上
  const arr = lines.split('')
  arr[index] = arr[index] === '1' ? '0' : '1'
  return arr.join('')
}

// ── 种子化起卦模拟（deterministic）───────────────────────

// mulberry32 确定性伪随机
function mulberry32(seed) {
  let a = seed >>> 0
  return function () {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// 字符串种子 → 32 位整数
export function seedFromString(str) {
  let h = 2166136261
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

// 金钱法（三枚铜钱，六次）：返回六爻（自下而上），含变爻标记
// 三枚铜钱：字面=2，花面=3；和=6/7/8/9
export function coinCast(seedStr) {
  const rand = mulberry32(seedFromString(seedStr))
  const lines = []
  const moving = []
  for (let i = 0; i < 6; i++) {
    const sum = Math.floor(rand() * 4) + 6 // 6~9
    const yang = sum === 7 || sum === 9 // 7 少阳 / 9 老阳为阳
    lines.push(yang ? '1' : '0')
    if (sum === 6 || sum === 9) moving.push(i) // 老阴老阳为动爻
  }
  const linesStr = lines.join('')
  const base = getHexagram(linesStr)
  const changed = moving.length
    ? moving.reduce((acc, idx) => changeLine(acc, idx), linesStr)
    : linesStr
  const changedHex = getHexagram(changed)
  return {
    method: '金钱法',
    seed: seedStr,
    lines: linesStr,
    moving,
    base,
    changed: changedHex,
    // 六爻数值：6老阴/7少阳/8少阴/9老阳（自下而上）
    values: lines.map((l, i) => {
      // 重算 value 需要知道原 sum；简化：由 lines+moving 推导
      return l === '1' ? (moving.includes(i) ? 9 : 7) : moving.includes(i) ? 6 : 8
    }),
  }
}

// 蓍草法（大衍之数）模拟：同样六爻六变，流程在课程中讲解
export function yarrowCast(seedStr) {
  const rand = mulberry32(seedFromString('yarrow:' + seedStr))
  const lines = []
  const moving = []
  for (let i = 0; i < 6; i++) {
    // 简化模拟：三变后得 6/7/8/9，概率分布与传统蓍草法近似（7/9 为阳）
    const sum = Math.floor(rand() * 4) + 6
    const yang = sum === 7 || sum === 9
    lines.push(yang ? '1' : '0')
    if (sum === 6 || sum === 9) moving.push(i)
  }
  const linesStr = lines.join('')
  const base = getHexagram(linesStr)
  const changed = moving.length
    ? moving.reduce((acc, idx) => changeLine(acc, idx), linesStr)
    : linesStr
  return {
    method: '蓍草法（模拟）',
    seed: seedStr,
    lines: linesStr,
    moving,
    base,
    changed: getHexagram(changed),
  }
}

// 传统起卦方法简介（供课程引用）
export const DIVINATION_METHODS = [
  {
    id: 'yarrow',
    name: '蓍草法',
    desc: '用五十根蓍草，经「分二、挂一、揲四、归奇」三变成一爻，十八变成一卦。是《系辞》记载的最古老起卦方法，流程繁琐但每一步都有象征意义。',
    source: '《周易·系辞上》：大衍之数五十，其用四十有九。',
  },
  {
    id: 'coin',
    name: '金钱法',
    desc: '用三枚铜钱，掷一次得三面（字=2、花=3），和为 6/7/8/9：老阴、少阳、少阴、老阳。六次成一卦，老阴老阳为动爻。',
    source: '后世简化起卦法，常见于历代易学著作。',
  },
  {
    id: 'time',
    name: '时间起卦',
    desc: '以年月日时等时间信息按固定规则换算成卦（如梅花易数的时间起卦法）。规则明确、可复现，是「以数起卦」的代表。',
    source: '宋代以来「以数起卦」传统，规则见相关易学著作。',
  },
  {
    id: 'note',
    name: '关于起卦的提醒',
    desc: '起卦是传统文化中的「取象」流程，其随机性来自自然过程。本产品用它学习「流程与解释体系」，不把随机结果包装成科学预测或人生判决。',
    source: '产品立场：传统文化学习 + 推理训练。',
  },
]

// 卦象学习卡片（供闪卡/记忆游戏）：卦名 ↔ 卦符 ↔ 意象
export const HEX_FLASHCARDS = HEXAGRAMS.map((h) => ({
  id: h.seq,
  name: h.name,
  full: h.full,
  lines: h.lines,
  symbol: linesToSymbol(h.lines),
  imagery: h.imagery,
  seq: h.seq,
}))
