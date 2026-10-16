// ============================================================
// 🔍 全局搜索索引（P2-5）
// 覆盖六类内容：卦档 / 术语 / 课程 / 案例 / 词典 / 必背。
// 纯函数、确定性、无网络依赖：buildIndex 构建一次，searchAll 查询。
// 匹配策略：多关键词全部命中 + 标题优先 + 相关度排序，结果按类型分组。
// ============================================================

import { HEXAGRAMS } from './iching/hexagrams-data'
import { ALL_TERMS } from './iching/termData'
import { CURRICULUM_NODES } from './curriculum/index'
import { LESSONS, V3_LESSONS } from './lessons'
import { CASES } from './cases'
import { DICTIONARY } from './dictionary'
import { MEMORIZE_ALL_ITEMS } from './mustMemorize'

export const SEARCH_TYPES = [
  { key: 'hex', label: '卦档', emoji: '☯️' },
  { key: 'term', label: '术语', emoji: '📚' },
  { key: 'course', label: '课程', emoji: '📖' },
  { key: 'case', label: '案例', emoji: '🕵️' },
  { key: 'dict', label: '词典', emoji: '🌙' },
  { key: 'memorize', label: '必背', emoji: '🗂️' },
]

// 全角/半角归一 + 去空白（多关键词时逐词匹配）
export function normalize(s) {
  return String(s || '')
    .replace(/[\uFF01-\uFF5E]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0xfee0))
    .replace(/[（]/g, '(')
    .replace(/[）]/g, ')')
    .replace(/[，、。；：！？]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
}

// 从知识节点提取可检索文本（含教学交互内容，关键词藏在题目里也能搜到）
function nodeText(n) {
  const parts = [n.title, n.concept, n.source, n.structure]
  if (n.examples) parts.push(...n.examples)
  if (n.counterexamples) parts.push(...n.counterexamples)
  if (n.commonMistakes) parts.push(...n.commonMistakes)
  if (n.exercises) parts.push(...n.exercises)
  if (n.masteryStandard) parts.push(n.masteryStandard)
  if (n.hook) parts.push(n.hook.question, n.hook.tease)
  if (n.apply) parts.push(n.apply.prompt)
  if (n.counter) parts.push(n.counter.prompt)
  if (n.predict) parts.push(n.predict.prompt)
  return parts.filter(Boolean).join(' ')
}

function buildIndex() {
  const index = []

  // ☯️ 卦档：64 卦
  for (const h of HEXAGRAMS) {
    index.push({
      type: 'hex',
      id: String(h.seq),
      title: `${h.name}（${h.full}）`,
      desc: h.plain,
      text: `${h.name} ${h.full} ${h.guaci} ${h.plain} ${h.imagery} ${h.myth} 第${h.seq}卦`,
    })
  }

  // 📚 术语百科
  for (const t of ALL_TERMS) {
    index.push({
      type: 'term',
      id: t.id,
      title: `${t.term}${t.traditionalTerm && t.traditionalTerm !== t.term ? `（${t.traditionalTerm}）` : ''}`,
      desc: t.shortDefinition || t.beginnerExplanation,
      text: `${t.term} ${t.traditionalTerm || ''} ${t.aliases?.join(' ') || ''} ${t.shortDefinition || ''} ${t.beginnerExplanation || ''} ${t.coreMeaning || ''} ${t.commonMistakes?.join(' ') || ''}`,
    })
  }

  // 📖 课程（V1/V2 + V3 课程工厂）
  const lessonMeta = {}
  for (const l of LESSONS) lessonMeta[l.id] = l
  for (const l of V3_LESSONS) if (!lessonMeta[l.id]) lessonMeta[l.id] = l
  for (const l of Object.values(lessonMeta)) {
    index.push({
      type: 'course',
      id: l.id,
      title: l.title,
      desc: l.subtitle || '',
      text: `${l.title} ${l.subtitle || ''} ${l.hook?.question || ''} ${l.hook?.tease || ''} ${l.nodeId || ''}`,
    })
  }

  // 📖 课程：知识节点（学院章节）
  for (const n of CURRICULUM_NODES) {
    index.push({
      type: 'course',
      id: `node-${n.id}`,
      title: n.title,
      desc: (n.concept || '').slice(0, 60),
      text: nodeText(n),
      nodeId: n.id,
    })
  }

  // 🕵️ 案例库
  for (const c of CASES) {
    index.push({
      type: 'case',
      id: c.id,
      title: c.title,
      desc: `${c.subject || ''}${c.chartLabel || ''}`.trim(),
      text: `${c.title} ${c.subject || ''} ${c.situation?.join(' ') || ''} ${c.chart?.map((x) => `${x.key} ${x.value}`).join(' ') || ''} ${c.category || ''}`,
    })
  }

  // 🌙 词典
  for (const d of DICTIONARY) {
    index.push({
      type: 'dict',
      id: d.term,
      title: d.term,
      desc: d.oneLine || '',
      text: `${d.term} ${d.oneLine || ''} ${d.detail || ''}`,
    })
  }

  // 🗂️ 必背速记
  for (const m of MEMORIZE_ALL_ITEMS) {
    index.push({
      type: 'memorize',
      id: m.id,
      title: m.front,
      desc: (m.back || '').slice(0, 40),
      text: `${m.front} ${m.back} ${m.tip || ''}`,
    })
  }

  return index
}

const INDEX = buildIndex()

// 查询词列表：多词按空格拆；单个 CJK 词过长时逐字兜底
// （如「承乘比应」在术语正文里分散出现，逐字全部命中即可算中）
function queryWords(q) {
  const parts = q.split(' ').filter(Boolean)
  if (parts.length > 1) return parts
  if (parts[0].length <= 2) return parts
  return [...parts[0]]
}

// 搜索：多关键词全部命中；标题命中优先；同类内按相关度排序，每类上限 limit
export function searchAll(query, limit = 30) {
  const q = normalize(query)
  if (!q) return []
  const words = queryWords(q)
  const hits = []
  for (const entry of INDEX) {
    const text = normalize(entry.text)
    if (!words.every((w) => text.includes(w))) continue
    const title = normalize(entry.title)
    const titleHits = words.filter((w) => title.includes(w)).length
    const rank = titleHits * 100 + (text.includes(q) ? 50 : 0) + Math.min(text.length, 200)
    hits.push({ ...entry, score: rank })
  }
  hits.sort((a, b) => b.score - a.score)
  const byType = {}
  for (const h of hits) {
    if (!byType[h.type]) byType[h.type] = []
    if (byType[h.type].length < limit) byType[h.type].push(h)
  }
  return byType
}

// 各类型总命中数（供搜索页展示「全部 X 条」）
export function countMatches(query) {
  const q = normalize(query)
  if (!q) return {}
  const words = queryWords(q)
  const counts = {}
  for (const entry of INDEX) {
    const text = normalize(entry.text)
    if (words.every((w) => text.includes(w))) counts[entry.type] = (counts[entry.type] || 0) + 1
  }
  return counts
}

// 供测试断言：索引覆盖了六类内容且条目数正确
export function searchIndexStats() {
  const stats = {}
  for (const entry of INDEX) stats[entry.type] = (stats[entry.type] || 0) + 1
  return stats
}
