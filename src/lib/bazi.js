// ============================================================
// 八字模块：出生时间 → 四柱（确定性的本地计算）。
// 规则：年柱以立春分界，月柱以十二「节」分界，日柱按公历自然日，
//       时柱按时辰（23 点为子时）。十神以日主为「我」。
// ============================================================

import {
  STEMS,
  BRANCHES,
  STEM_ELEMENTS,
  BRANCH_ELEMENTS,
  HIDDEN_STEMS,
  ELEMENTS,
  pillarText,
  isYangStem,
  WANG_SHUAI,
} from './constants'
import { gregorianToJDN, utcToJD, solarTermJD, JIE_TERMS } from './calendar'

const WUHU_DUN = [2, 4, 6, 8, 0] // 甲己→丙, 乙庚→戊, 丙辛→庚, 丁壬→壬, 戊癸→甲（正月寅的月干）
const WUSHU_DUN = [0, 2, 4, 6, 8] // 甲己→甲, 乙庚→丙, 丙辛→戊, 丁壬→庚, 戊癸→壬（子时的时干）

const hourBranchEnd = (h) => (h >= 23 ? 0 : Math.floor((h + 1) / 2))

/**
 * 十神：以 dayStemIdx 为「我」，判定 otherStemIdx 的十神名称。
 */
export function tenGod(dayStemIdx, otherStemIdx) {
  const me = STEM_ELEMENTS[dayStemIdx]
  const other = STEM_ELEMENTS[otherStemIdx]
  const samePolarity = isYangStem(dayStemIdx) === isYangStem(otherStemIdx)
  if (me === other) return samePolarity ? '比肩' : '劫财'
  // 生我
  if (STEM_ELEMENTS[otherStemIdx] && generates(other, me)) return samePolarity ? '偏印' : '正印'
  // 我生
  if (generates(me, other)) return samePolarity ? '食神' : '伤官'
  // 克我
  if (overcomes(other, me)) return samePolarity ? '七杀' : '正官'
  // 我克
  return samePolarity ? '偏财' : '正财'
}

function generates(a, b) {
  const map = { 木: '火', 火: '土', 土: '金', 金: '水', 水: '木' }
  return map[a] === b
}
function overcomes(a, b) {
  const map = { 木: '土', 土: '水', 水: '火', 火: '金', 金: '木' }
  return map[a] === b
}

function yearPillar(effYear) {
  const stemIdx = ((effYear - 4) % 10 + 10) % 10
  const branchIdx = ((effYear - 4) % 12 + 12) % 12
  return { stemIdx, branchIdx, text: pillarText(stemIdx, branchIdx) }
}

/**
 * 计算四柱。
 * @param {object} input
 *   { year, month, day, hour, minute, utcOffsetHours=8 }
 */
export function computeFourPillars(input) {
  let { year, month, day, hour = 0, minute = 0, utcOffsetHours = 8 } = input
  year = Number(year)
  month = Number(month)
  day = Number(day)
  hour = Number(hour)
  minute = Number(minute)
  utcOffsetHours = Number(utcOffsetHours)

  // 出生本地时刻 → UTC 儒略日（用于与节气时刻比较）
  const birthUTC = utcToJD(year, month, day, hour, minute, 0) - utcOffsetHours / 24

  // 1) 年柱：以立春分界
  const lichunThis = solarTermJD(year, 315)
  const effYear = birthUTC < lichunThis ? year - 1 : year
  const yr = yearPillar(effYear)

  // 2) 月柱：以十二「节」分界
  const terms = JIE_TERMS.map((t, i) => {
    const y = i === 11 ? effYear + 1 : effYear
    return { ...t, jd: solarTermJD(y, t.angle) }
  })
  let monthTerm = terms[0]
  let nearBoundary = false
  for (let i = 0; i < terms.length; i++) {
    if (birthUTC >= terms[i].jd) monthTerm = terms[i]
    // 距节气交接 1 小时内视为「临近边界」
    if (Math.abs(birthUTC - terms[i].jd) * 24 < 1) nearBoundary = true
  }

  const monthBranchIdx = monthTerm.branchIndex
  const monthOrder = (monthBranchIdx - 2 + 12) % 12 // 寅月=0 … 丑月=11
  const monthStemIdx = (WUHU_DUN[yr.stemIdx % 5] + monthOrder) % 10

  // 3) 日柱：公历自然日（按儒略日取模 60）
  const jdn = gregorianToJDN(year, month, day)
  const dayIdx = ((jdn + 49) % 60 + 60) % 60
  const dayStemIdx = dayIdx % 10
  const dayBranchIdx = dayIdx % 12

  // 4) 时柱
  const hourBranchIdx = hourBranchEnd(hour)
  const hourStemIdx = (WUSHU_DUN[dayStemIdx % 5] + hourBranchIdx) % 10

  const pillars = {
    year: { ...yr },
    month: { stemIdx: monthStemIdx, branchIdx: monthBranchIdx, text: pillarText(monthStemIdx, monthBranchIdx) },
    day: { stemIdx: dayStemIdx, branchIdx: dayBranchIdx, text: pillarText(dayStemIdx, dayBranchIdx) },
    hour: { stemIdx: hourStemIdx, branchIdx: hourBranchIdx, text: pillarText(hourStemIdx, hourBranchIdx) },
  }

  // 十神（显性干支）
  const tenGods = {
    year: tenGod(dayStemIdx, pillars.year.stemIdx),
    month: tenGod(dayStemIdx, pillars.month.stemIdx),
    day: '日主',
    hour: tenGod(dayStemIdx, pillars.hour.stemIdx),
  }

  // 地支藏干 + 其十神
  const hiddenStems = {}
  for (const key of ['year', 'month', 'day', 'hour']) {
    const branch = BRANCHES[pillars[key].branchIdx]
    hiddenStems[key] = (HIDDEN_STEMS[branch] || []).map((st) => {
      const idx = STEMS.indexOf(st)
      return { stem: st, element: STEM_ELEMENTS[idx], god: tenGod(dayStemIdx, idx) }
    })
  }

  // 五行统计（八个显性干支）
  const counts = { 木: 0, 火: 0, 土: 0, 金: 0, 水: 0 }
  for (const key of ['year', 'month', 'day', 'hour']) {
    counts[STEM_ELEMENTS[pillars[key].stemIdx]] += 1
    counts[BRANCH_ELEMENTS[pillars[key].branchIdx]] += 1
  }

  // 旺衰「基础参考」：由月令定季节，给出日主五行的旺衰地位
  const seasonBranch = BRANCHES[monthBranchIdx]
  const season = ['寅', '卯', '辰'].includes(seasonBranch)
    ? '春'
    : ['巳', '午', '未'].includes(seasonBranch)
      ? '夏'
      : ['申', '酉', '戌'].includes(seasonBranch)
        ? '秋'
        : ['辰', '未', '戌', '丑'].includes(seasonBranch)
          ? '四季'
          : '冬'
  const wangshuaiMap = WANG_SHUAI[season]
  const dayElement = STEM_ELEMENTS[dayStemIdx]
  let dayStatus = ''
  for (const status in wangshuaiMap) {
    if (wangshuaiMap[status] === dayElement) dayStatus = status
  }

  return {
    input: { year, month, day, hour, minute, utcOffsetHours },
    effYear,
    pillars,
    dayStem: STEMS[dayStemIdx],
    dayStemIdx,
    dayElement,
    tenGods,
    hiddenStems,
    monthTerm: monthTerm.name,
    monthBranchIdx,
    counts,
    wangshuai: {
      season,
      seasonBranch,
      map: wangshuaiMap,
      dayStatus,
      note:
        '五行旺衰仅依据月令得出「旺相休囚死」的基础定位，属于最简化的参考，不能替代完整的旺衰判断。',
    },
    nearBoundary,
    disclaimer:
      '四柱为传统知识体系的一种记录方式，不代表经过现代科学验证的因果规律。',
  }
}

export function elementCountsOfChart(chart) {
  return chart.counts
}

export function listElementsSorted(chart) {
  return ELEMENTS.map((e) => ({ element: e, count: chart.counts[e] })).sort(
    (a, b) => b.count - a.count,
  )
}