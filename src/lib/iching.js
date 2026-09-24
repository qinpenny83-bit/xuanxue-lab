// ============================================================
// 易经模块：八卦、六十四卦、三种本地起卦 + 动爻与变卦。
// 起卦过程可重复、可解释（详情见各方法的说明）。
// ============================================================

// 八卦（先天卦数：乾1 兑2 离3 震4 巽5 坎6 艮7 坤8）
// lines 自下而上，1=阳爻，0=阴爻
export const TRIGRAMS = [
  { name: '乾', symbol: '☰', nature: '天', element: '金', number: 1, lines: [1, 1, 1] },
  { name: '兑', symbol: '☱', nature: '泽', element: '金', number: 2, lines: [1, 1, 0] },
  { name: '离', symbol: '☲', nature: '火', element: '火', number: 3, lines: [1, 0, 1] },
  { name: '震', symbol: '☳', nature: '雷', element: '木', number: 4, lines: [1, 0, 0] },
  { name: '巽', symbol: '☴', nature: '风', element: '木', number: 5, lines: [0, 1, 1] },
  { name: '坎', symbol: '☵', nature: '水', element: '水', number: 6, lines: [0, 1, 0] },
  { name: '艮', symbol: '☶', nature: '山', element: '土', number: 7, lines: [0, 0, 1] },
  { name: '坤', symbol: '☷', nature: '地', element: '土', number: 8, lines: [0, 0, 0] },
]

// 六十四卦名称：HEXAGRAM_NAMES[上卦][下卦]
export const HEXAGRAM_NAMES = [
  ['乾为天', '天泽履', '天火同人', '天雷无妄', '天风姤', '天水讼', '天山遁', '天地否'],
  ['泽天夬', '兑为泽', '泽火革', '泽雷随', '泽风大过', '泽水困', '泽山咸', '泽地萃'],
  ['火天大有', '火泽睽', '离为火', '火雷噬嗑', '火风鼎', '火水未济', '火山旅', '火地晋'],
  ['雷天大壮', '雷泽归妹', '雷火丰', '震为雷', '雷风恒', '雷水解', '雷山小过', '雷地豫'],
  ['风天小畜', '风泽中孚', '风火家人', '风雷益', '巽为风', '风水涣', '风山渐', '风地观'],
  ['水天需', '水泽节', '水火既济', '水雷屯', '水风井', '坎为水', '水山蹇', '水地比'],
  ['山天大畜', '山泽损', '山火贲', '山雷颐', '山风蛊', '山水蒙', '艮为山', '山地剥'],
  ['地天泰', '地泽临', '地火明夷', '地雷复', '地风升', '地水师', '地山谦', '坤为地'],
]

export function trigramByIndex(idx) {
  return TRIGRAMS[((idx % 8) + 8) % 8]
}

// 数字 → 卦（乾1…坤8，0 视为 8）
export function numberToTrigramIndex(n) {
  const m = ((n % 8) + 8) % 8
  return m === 0 ? 7 : m - 1
}

export function hexagramName(upperIdx, lowerIdx) {
  return HEXAGRAM_NAMES[((upperIdx % 8) + 8) % 8][((lowerIdx % 8) + 8) % 8]
}

// 由六行（自下而上，1阳0阴）构造卦
export function buildHexagram(lines) {
  const lowerIdx = linesToTrigramIndex(lines.slice(0, 3))
  const upperIdx = linesToTrigramIndex(lines.slice(3, 6))
  return {
    lower: TRIGRAMS[lowerIdx],
    upper: TRIGRAMS[upperIdx],
    lowerIdx,
    upperIdx,
    name: hexagramName(upperIdx, lowerIdx),
    lines,
  }
}

export function linesToTrigramIndex(lines) {
  // 用二进制把三行还原为卦序（按 lines 数组下标匹配 TRIGRAMS）
  const key = lines.join('')
  for (let i = 0; i < TRIGRAMS.length; i++) {
    if (TRIGRAMS[i].lines.join('') === key) return i
  }
  return 0
}

// ---------- 起卦方式 ①：时间起卦（公历时间数，本地简法） ----------
export function castByTime(date) {
  const y = date.getFullYear()
  const m = date.getMonth() + 1
  const d = date.getDate()
  const h = date.getHours()
  const upper = numberToTrigramIndex(y + m + d)
  const lower = numberToTrigramIndex(y + m + d + h)
  const movingLine = ((y + m + d + h) % 6 + 6) % 6 // 0..5（初爻..上爻）
  return composeResult(lower, upper, movingLine, '时间起卦')
}

// ---------- 起卦方式 ②：数字起卦（三数，上卦/下卦/动爻） ----------
export function castByNumbers(n1, n2, n3) {
  const upper = numberToTrigramIndex(Number(n1))
  const lower = numberToTrigramIndex(Number(n2))
  const movingLine = ((Number(n3) % 6) + 6) % 6
  return composeResult(lower, upper, movingLine, '数字起卦')
}

// ---------- 起卦方式 ③：随机起卦（三钱法 × 六次，六爻） ----------
export function castByCoins(rng = Math.random) {
  const lines = []
  const lineDetails = []
  for (let i = 0; i < 6; i++) {
    const heads = headCount(3, rng)
    const value = heads === 3 ? 9 : heads === 2 ? 7 : heads === 1 ? 8 : 6
    lines.push(value % 2 === 1 ? 1 : 0) // 阳爻：7、9
    lineDetails.push({ index: i, value, label: lineLabel(value), moving: value === 6 || value === 9 })
  }
  const hex = buildHexagram(lines)
  const moving = lineDetails.filter((l) => l.moving).map((l) => l.index)
  const changed = changedHexagram(hex, moving)
  return {
    method: '三钱起卦',
    hexagram: hex,
    lineDetails,
    movingLines: moving,
    changed,
    explanation: coinExplanation(),
  }
}

function headCount(coins, rng) {
  let n = 0
  for (let i = 0; i < coins; i++) if (rng() < 0.5) n++
  return n
}

function lineLabel(value) {
  return { 9: '老阳（变）', 7: '少阳（静）', 8: '少阴（静）', 6: '老阴（变）' }[value]
}

function coinExplanation() {
  return [
    '每次投三枚硬币：3 个正面为老阳（动爻）、2 个正面为少阳、1 个正面为少阴、0 个正面为老阴（动爻）。',
    '六次结果自下而上排成六爻；老阳/老阴为动爻，动爻翻转即得变卦。',
  ]
}

function composeResult(lower, upper, movingLine, method) {
  const lines = [...TRIGRAMS[lower].lines, ...TRIGRAMS[upper].lines]
  const hex = buildHexagram(lines)
  const moving = [movingLine]
  const changed = changedHexagram(hex, moving)
  return {
    method,
    hexagram: hex,
    movingLines: moving,
    changed,
    lowerNumber: TRIGRAMS[lower].number,
    upperNumber: TRIGRAMS[upper].number,
    explanation: [explainMoving(movingLine)],
  }
}

// 动爻 → 变卦（翻转对应爻）
export function changedHexagram(hex, movingIdxList) {
  const newLines = [...hex.lines]
  for (const idx of movingIdxList) {
    const i = ((idx % 6) + 6) % 6
    newLines[i] = newLines[i] ? 0 : 1
  }
  return buildHexagram(newLines)
}

function explainMoving(idx) {
  const names = ['初爻', '二爻', '三爻', '四爻', '五爻', '上爻']
  return `第 ${names[idx]} 动，阴阳互变，生成变卦。`
}

// 用于渲染的爻符号
export function lineSymbol(value, moving) {
  if (moving) return value ? '⚊' : '⚋'
  return value ? '—' : '- -'
}