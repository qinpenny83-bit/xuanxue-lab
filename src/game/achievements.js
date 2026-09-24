// ============================================================
// 成就系统：奖励「学会 / 推理 / 纠错 / 验证」，不奖励「打开网站」。
// ============================================================

export const ACHIEVEMENTS = [
  { id: 'first-lesson', emoji: '🌱', title: '迈出第一步', desc: '完成你的第一节课' },
  { id: 'first-analysis', emoji: '🕵️', title: '第一次独立分析', desc: '完成第一个案例' },
  { id: 'first-experiment', emoji: '🧪', title: '第一个现实实验', desc: '开始并完成一个现实实验' },
  { id: 'mastery-apply', emoji: '🎯', title: '第一次「能应用」', desc: '任意知识点达到「能应用」级别' },
  { id: 'error-hunter', emoji: '🔍', title: '发现自己的错误模式', desc: '某类错误累计出现 3 次并被识别' },
  { id: 'first-counter', emoji: '⚖️', title: '第一次主动提出反例', desc: '在案例中主动考虑相反的可能' },
  { id: 'streak-7', emoji: '🔥', title: '连续 7 天学习', desc: '连续学习达到 7 天' },
  { id: 'streak-10-correct', emoji: '💯', title: '连续 10 次正确判断', desc: '连续答对 10 次' },
  { id: 'first-chart', emoji: '🔮', title: '完成第一个命盘', desc: '生成一次自己的基础命盘' },
  { id: 'core-master', emoji: '🏆', title: '五行入门者', desc: '五行、阴阳、生克三个节点都达到「能应用」' },
]

export function checkAchievements(state) {
  const unlocked = {}
  const have = state.achievements || {}

  const lessonCount = Object.keys(state.completedLessons || {}).length
  const caseCount = Object.keys(state.completedCases || {}).length
  const expDone = Object.values(state.experiments || {}).some((e) => e && e.completed)
  const mastery = state.mastery || {}
  const anyApply = Object.values(mastery).some((v) => v >= 4)
  const errors = state.errorPatterns || {}
  const anyErrorPeak = Object.values(errors).some((v) => v >= 3)

  const coreApply = ['five-elements', 'yin-yang', 'generating-restraining'].every((id) => (mastery[id] || 0) >= 4)

  const checks = {
    'first-lesson': lessonCount >= 1,
    'first-analysis': caseCount >= 1,
    'first-experiment': expDone,
    'mastery-apply': anyApply,
    'error-hunter': anyErrorPeak,
    'first-counter': (state.counterAwards || 0) >= 1,
    'streak-7': (state.streak || 0) >= 7,
    'streak-10-correct': (state.consecutiveCorrect || 0) >= 10,
    'first-chart': state.chartComputed,
    'core-master': coreApply,
  }

  for (const a of ACHIEVEMENTS) {
    if (!have[a.id] && checks[a.id]) unlocked[a.id] = { unlockedAt: new Date().toISOString() }
  }
  return unlocked
}