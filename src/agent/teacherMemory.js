// ============================================================
// 连续老师记忆：让 Agent 表现出「我记得你之前的问题」。
// 基于最近错误事件 + 累计错误模式，生成跨会话的开场白。
// ============================================================

import { ERROR_TYPES, topErrors } from './errors'

// 从最近的错误事件里挑一个「连续出现」的模式
export function composingTeacherMemory(state) {
  const events = state.errorEvents || []
  const recent = events.slice(-8)

  // 最近反复出现的同一错误
  const counts = {}
  recent.forEach((e) => {
    if (e && e.code) counts[e.code] = (counts[e.code] || 0) + 1
  })
  const repeated = Object.entries(counts)
    .filter(([, n]) => n >= 2)
    .sort((a, b) => b[1] - a[1])[0]

  if (repeated) {
    const code = repeated[0]
    const meta = ERROR_TYPES[code]
    return {
      hasMemory: true,
      code,
      title: meta?.name || code,
      count: repeated[1],
      opener: `又见面了。上次你连续 ${repeated[1]} 次看到单一信息就急着下结论。今天我故意给你安排一个坑，看看这次你能不能先停下来找证据。`,
      generic: `我记得你之前容易「${meta?.name || code}」。今天这一课，我会特别盯着这一点。`,
    }
  }

  // 有累计模式但最近没重复
  const top = topErrors(state.errorPatterns, 1)[0]
  if (top) {
    return {
      hasMemory: true,
      code: top.code,
      title: top.name,
      count: top.count,
      opener: `上次我们聊过：你累计出现 ${top.count} 次「${top.name}」。今天我们换个方式，把它磨一磨。`,
      generic: `你之前最需要留意的是「${top.name}」，今天我不会轻易放过这一点。`,
    }
  }

  return { hasMemory: false, opener: '', generic: '' }
}