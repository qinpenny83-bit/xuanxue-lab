// ============================================================
// 玄学实验室 · 基础常量（天干地支、五行生克、藏干、六十甲子）
// 纯数据，无副作用，可被测试。
// ============================================================

export const STEMS = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸']
export const BRANCHES = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥']

// 天干五行（甲乙木、丙丁火、戊己土、庚辛金、壬癸水）
export const STEM_ELEMENTS = ['木', '木', '火', '火', '土', '土', '金', '金', '水', '水']
// 地支五行
export const BRANCH_ELEMENTS = ['水', '土', '木', '木', '土', '火', '火', '土', '金', '金', '土', '水']

// 天干阴阳：偶数索引(0甲)为阳，奇数索引(1乙)为阴
export function isYangStem(idx) {
  return idx % 2 === 0
}

// 五行生：木→火→土→金→水→木
export const GENERATES = { 木: '火', 火: '土', 土: '金', 金: '水', 水: '木' }
// 五行克：木→土→水→火→金→木
export const OVERCOMES = { 木: '土', 土: '水', 水: '火', 火: '金', 金: '木' }

export const ELEMENTS = ['木', '火', '土', '金', '水']
export const ELEMENT_COLORS = {
  木: '#3A9D8C',
  火: '#D97745',
  土: '#C9A15B',
  金: '#9A8C6E',
  水: '#4A6FA5',
}

// 地支藏干（本气、中气、余气）
export const HIDDEN_STEMS = {
  子: ['癸'],
  丑: ['己', '癸', '辛'],
  寅: ['甲', '丙', '戊'],
  卯: ['乙'],
  辰: ['戊', '乙', '癸'],
  巳: ['丙', '戊', '庚'],
  午: ['丁', '己'],
  未: ['己', '丁', '乙'],
  申: ['庚', '壬', '戊'],
  酉: ['辛'],
  戌: ['戊', '辛', '丁'],
  亥: ['壬', '甲'],
}

// 六十甲子（0=甲子 ... 59=癸亥）
export function makeJiazi() {
  const list = []
  for (let i = 0; i < 60; i++) {
    list.push(STEMS[i % 10] + BRANCHES[i % 12])
  }
  return list
}
export const JIAZI = makeJiazi()

export function pillarText(stemIdx, branchIdx) {
  return STEMS[stemIdx] + BRANCHES[branchIdx]
}

// 五行旺相休囚死（按季节/月令），用于旺衰「基础参考」。
// season: '春' | '夏' | '秋' | '冬' | '四季'
export const WANG_SHUAI = {
  春: { 旺: '木', 相: '火', 休: '水', 囚: '金', 死: '土' },
  夏: { 旺: '火', 相: '土', 休: '木', 囚: '水', 死: '金' },
  秋: { 旺: '金', 相: '水', 休: '土', 囚: '火', 死: '木' },
  冬: { 旺: '水', 相: '木', 休: '金', 囚: '土', 死: '火' },
  四季: { 旺: '土', 相: '金', 休: '火', 囚: '木', 死: '水' },
}

// 月支 → 季节（寅卯辰=春，巳午未=夏，申酉戌=秋，亥子丑=冬；辰未戌丑为四季土）
export function branchSeason(branchIdx) {
  const b = BRANCHES[branchIdx]
  if (['寅', '卯', '辰'].includes(b)) return '春'
  if (['巳', '午', '未'].includes(b)) return '夏'
  if (['申', '酉', '戌'].includes(b)) return '秋'
  return '冬'
}

// 五行生克关系的纯函数包装（供 Agent / 课程复用）
export function relationOf(aElement, bElement) {
  if (GENERATES[aElement] === bElement) return '我生'
  if (GENERATES[bElement] === aElement) return '生我'
  if (OVERCOMES[aElement] === bElement) return '我克'
  if (OVERCOMES[bElement] === aElement) return '克我'
  return '同我'
}