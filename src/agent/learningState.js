// ============================================================
// 学习状态识别：探索 / 建立 / 应用 / 卡住 / 巩固 / 晋级
// 纯函数，基于可解释规则，输出「当前状态 + 为什么 + 建议」。
// ============================================================

export const LEARNING_STATES = {
  exploring: { phase: 'exploring', label: '探索', emoji: '🧭', color: 'amber', desc: '你刚起步，正在建立第一印象。' },
  building: { phase: 'building', label: '建立', emoji: '🧱', color: 'indigo', desc: '你开始理解概念，正在搭骨架。' },
  applying: { phase: 'applying', label: '应用', emoji: '🛠', color: 'teal', desc: '你能够把概念用进案例了。' },
  stuck: { phase: 'stuck', label: '卡住', emoji: '🟡', color: 'danger', desc: '最近连续出错，需要停下来补一补。' },
  consolidating: { phase: 'consolidating', label: '巩固', emoji: '🔁', color: 'teal', desc: '正在重复训练，把能力磨稳。' },
  leveling: { phase: 'leveling', label: '晋级', emoji: '🚀', color: 'amber', desc: '准备进入新知识，向上突破。' },
}

export function learningState(state) {
  const mastery = state.mastery || {}
  const touched = Object.values(mastery).filter((v) => v > 0).length
  const mastered = Object.values(mastery).filter((v) => v >= 4).length
  const totalNodes = 13 // 知识节点总数（知识库规模）

  const recentQuizzes = (state.quizHistory || []).slice(-8)
  const recentWrong = recentQuizzes.filter((q) => !q.correct).length
  const recentCaseScores = (state.caseHistory || []).slice(-3).map((c) => c.score)

  // 完全新手
  if (touched === 0) {
    return withWhy('exploring', '还没有任何学习记录，从一个好奇问题开始。')
  }

  // 卡住：最近 8 题错 3+，或最近案例整体偏低
  const lowCases = recentCaseScores.length >= 2 && recentCaseScores.every((s) => s < 55)
  if (recentWrong >= 3 || lowCases) {
    return withWhy('stuck', '最近的正确率明显下降，先放下新课，回到薄弱点巩固。')
  }

  // 晋级：掌握节点多，且最近案例表现好
  const goodCases = recentCaseScores.length >= 2 && recentCaseScores.every((s) => s >= 75)
  if (mastered >= 6 && (goodCases || recentQuizzes.length === 0)) {
    return withWhy('leveling', '核心概念已掌握，是时候进入更高难度的推理了。')
  }

  // 巩固：已掌握但最近有波动，或正在重复
  if (mastered >= 3 && recentQuizzes.length > 0) {
    if (recentWrong === 0 && recentQuizzes.length >= 3) return withWhy('consolidating', '最近在稳步巩固，继续保持这个节奏。')
    return withWhy('applying', '你已能应用，下一步是把它练到能分析、能发现错误。')
  }

  // 建立：接触了若干节点但掌握有限
  if (touched >= 1 && mastered < 3) {
    return withWhy('building', '概念正在建立中，先补足前置，不要跳步。')
  }

  return withWhy('building', '正在推进中，保持「先结构、后结论」。')
}

function withWhy(phase, why) {
  return { ...LEARNING_STATES[phase], why }
}

export function stateEmoji(state) {
  return learningState(state).emoji
}

export function stateLabel(state) {
  return learningState(state).label
}