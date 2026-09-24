// ============================================================
// 等级与 XP：成长不是为了「打开网站」，而是因为「真的学懂了」。
// ============================================================

export const LEVELS = [
  { level: 1, name: '好奇者', xp: 0 },
  { level: 2, name: '入门者', xp: 100 },
  { level: 3, name: '五行观察员', xp: 250 },
  { level: 4, name: '命理学徒', xp: 500 },
  { level: 5, name: '案例侦探', xp: 850 },
  { level: 6, name: '初级分析师', xp: 1350 },
  { level: 7, name: '实战分析师', xp: 2000 },
  { level: 8, name: '玄学研究者', xp: 3000 },
  { level: 9, name: '格物探索者', xp: 4500 },
  { level: 10, name: '明理践行者', xp: 6500 },
]

// 各类行为的 XP 基线
export const XP = {
  lessonComplete: 30,
  lessonPerfect: 45,
  caseComplete: 40,
  caseExcellent: 60,
  stepCorrect: 6,
  whyCorrect: 8,
  experimentStart: 10,
  experimentComplete: 60,
  selfExplain: 10,
  chartComputed: 15,
}

export function levelForXp(xp) {
  let current = LEVELS[0]
  let next = LEVELS[1] || null
  for (let i = 0; i < LEVELS.length; i++) {
    if (xp >= LEVELS[i].xp) {
      current = LEVELS[i]
      next = LEVELS[i + 1] || null
    }
  }
  const curXp = current.xp
  const span = next ? next.xp - curXp : 0
  const into = next ? xp - curXp : 0
  const progress = next ? Math.min(100, Math.round((into / span) * 100)) : 100
  return { level: current.level, name: current.name, progress, nextName: next ? next.name : '登顶' }
}

export const MASTERY_LEVELS = ['未接触', '看过', '能解释', '能识别', '能应用', '能分析', '能发现错误']

export function isMastered(v) {
  return v >= 4
}