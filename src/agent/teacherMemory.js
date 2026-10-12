// ============================================================
// 连续老师记忆：让 Agent 表现出「我记得你之前的问题」。
// 基于最近错误事件 + 累计错误模式，生成跨会话的开场白。
// ============================================================

import { ERROR_TYPES, topErrors } from './errors'

// 开场白与提示语模板池：内容全部来自真实记录（错误类型名、次数），
// 只换说法不换事实，避免每次都是同一句「老掉牙」。
// 选模板时排除上一次用过的，保证连续两次不撞句。
const OPENERS = [
  (name, count) => `老问题又来了：「${name}」，连着 ${count} 次了。这次我们不急着答题，先想想你会从哪一步开始。`,
  (name, count) => `上次我们在这栽过 ${count} 次跟头——「${name}」。今天我故意改了个案例，看看你这次会不会换一种推法。`,
  (name, count) => `你的历史记录里，「${name}」已经出现 ${count} 次了。这节课我会专门盯着它，换个场景考你。`,
  (name, count) => `翻到旧账：「${name}」你踩了 ${count} 回。今天换个盘面，我们把这一关彻底过了。`,
  (name, count) => `你最近几次断事，都绕在「${name}」上，一共 ${count} 次。今日专治这个，看你能不能绕开它走。`,
  (name, count) => `上回欠的功课还没清：「${name}」，${count} 次了。这一课，师父盯着你这处练。`,
  (name, count) => `你这阵子的毛病我记着呢：「${name}」已经 ${count} 次。换个案子，看看长进没有。`,
  (name, count) => `不是要翻旧账，是「${name}」这关你卡了 ${count} 次。今天咱们换条路，把它啃下来。`,
]
const GENERICS = [
  (name) => `我记得你之前容易「${name}」。今天这一课，我会特别盯着这一点。`,
  (name) => `这节课我会重点留意，你有没有再犯「${name}」。`,
  (name) => `先打招呼：我这儿挂着你的老毛病「${name}」，这关会专门照着你来。`,
  (name) => `你身上有个老习惯「${name}」，今天我们就冲它去。`,
  (name) => `这节课不绕弯子，专治「${name}」这毛病。`,
]
const PATTERN_OPENERS = [
  (name, count) => `上次我们聊过：你累计出现 ${count} 次「${name}」。今天我们换个方式，把它磨一磨。`,
  (name, count) => `你的记录里，「${name}」已经累积到 ${count} 次了。今天换个场景，看看你能不能避开它。`,
  (name, count) => `还记得「${name}」吗？累计 ${count} 次了。这节课我们从反方向练它。`,
  (name, count) => `账面上记着：「${name}」累计 ${count} 次。今日专练这处，把它捋顺。`,
  (name, count) => `你与「${name}」交手 ${count} 次了。这次我们换个靶子，看看你的手法变没变。`,
]
const PATTERN_GENERICS = [
  (name) => `你之前最需要留意的是「${name}」，今天我不会轻易放过这一点。`,
  (name) => `这节课的重点：「${name}」，别让它再溜过去。`,
  (name) => `老规矩：今天这课，就是冲着「${name}」来的。`,
]

// 随机取一个模板生成文案，且不与上一次输出的文案相同
function uniqueLine(templates, args) {
  let last = ''
  try { last = window.localStorage.getItem('xxl_last_opener') || '' } catch (e) { /* 非浏览器环境 */ }
  let text = ''
  for (let tries = 0; tries < templates.length + 2; tries++) {
    const t = templates[Math.floor(Math.random() * templates.length)]
    text = t(...args)
    if (text !== last) break
  }
  try { window.localStorage.setItem('xxl_last_opener', text) } catch (e) { /* 忽略存储失败 */ }
  return text
}

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
      opener: uniqueLine(OPENERS, [name, repeated[1]]),
      generic: uniqueLine(GENERICS, [name]),
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
      opener: uniqueLine(PATTERN_OPENERS, [top.name, top.count]),
      generic: uniqueLine(PATTERN_GENERICS, [top.name]),
    }
  }

  return { hasMemory: false, opener: '', generic: '' }
}