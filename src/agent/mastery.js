// ============================================================
// 掌握度：每个知识点 0–6（未接触→能发现错误）。
// 真正的「掌握」至少达到 4（能应用）。
// ============================================================

export function getMastery(mastery, nodeId) {
  return (mastery && mastery[nodeId]) || 0
}

// 提升到「至少」某级（只增不减）
export function bumpMastery(mastery, nodeId, toLevel) {
  const next = { ...mastery }
  next[nodeId] = Math.max(next[nodeId] || 0, toLevel)
  return next
}

export function masterySummary(mastery, nodeIds) {
  const items = nodeIds.map((id) => ({ id, level: getMastery(mastery, id) }))
  const avg = items.length ? items.reduce((a, b) => a + b.level, 0) / items.length : 0
  return { items, avg: Math.round(avg * 10) / 10, mastered: items.filter((i) => i.level >= 4).length }
}

// 学习事件 → 该知识点应达到的最低等级
export function eventTargetLevel(kind, quality) {
  switch (kind) {
    case 'lesson_step_view':
      return 1
    case 'lesson_done':
      return quality === 'perfect' ? 4 : 2
    case 'quiz_correct':
      return 3
    case 'case_done':
      return quality === 'good' ? 4 : 3
    case 'experiment_done':
      return quality === 'reviewed' ? 5 : 4
    default:
      return 1
  }
}