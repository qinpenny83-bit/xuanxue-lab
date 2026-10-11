// ============================================================
// 连续老师记忆：让 Agent 表现出「我记得你之前的问题」。
// 基于最近错误事件 + 累计错误模式，生成跨会话的开场白。
// ============================================================

import { ERROR_TYPES, topErrors } from './errors'

// 开场白与提示语模板池：内容全部来自真实记录（错误类型名、次数），
// 只换说法不换事实，避免每次都是同一句「老掉牙」。
const OPENERS = [
  (name, count) => `又见面了。我翻了下记录，上次你连续 ${count} 次都卡在「${name}」上。今天换个证据重新来，看看这次你能不能先停下来找证据。`,
  (name, count) => `老问题又来了：「${name}」，连着 ${count} 次了。这次我们不急着答题，先想想你会从哪一步开始。`,
  (name, count) => `上次我们在这栽过 ${count} 次跟头——「${name}」。今天我故意改了个案例，看看你这次会不会换一种推法。`,
  (name, count) => `你的历史记录里，「${name}」已经出现 ${count} 次了。这节课我会专门盯着它，换个场景考你。`,
]
const GENERICS = [
  (name) => `我记得你之前容易「${name}」。今天这一课，我会特别盯着这一点。`,
  (name) => `这节课我会重点留意，你有没有再犯「${name}」。`,
  (name) => `先打招呼：我这儿挂着你的老毛病「${name}」，这关会专门照着你来。`,
]
const PATTERN_OPENERS = [
  (name, count) => `上次我们聊过：你累计出现 ${count} 次「${name}」。今天我们换个方式，把它磨一磨。`,
  (name, count) => `你的记录里，「${name}」已经累积到 ${count} 次了。今天换个场景，看看你能不能避开它。`,
  (name, count) => `还记得「${name}」吗？累计 ${count} 次了。这节课我们从反方向练它。`,
]
const PATTERN_GENERICS = [
  (name) => `你之前最需要留意的是「${name}」，今天我不会轻易放过这一点。`,
  (name) => `这节课的重点：「${name}」，别让它再溜过去。`,
]

// 从最近错误事件里挑一个「连续出现」的模式
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
    const name = meta?.name || code
    return {
      hasMemory: true,
      code,
      title: name,
      count: repeated[1],
      opener: OPENERS[Math.floor(Math.random() * OPENERS.length)](name, repeated[1]),
      generic: GENERICS[Math.floor(Math.random() * GENERICS.length)](name),
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
      opener: PATTERN_OPENERS[Math.floor(Math.random() * PATTERN_OPENERS.length)](top.name, top.count),
      generic: PATTERN_GENERICS[Math.floor(Math.random() * PATTERN_GENERICS.length)](top.name),
    }
  }

  return { hasMemory: false, opener: '', generic: '' }
}