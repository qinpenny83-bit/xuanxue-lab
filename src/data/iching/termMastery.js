// ============================================================
// ☯️ 术语掌握度 / 学习阶段 / 确定性推荐（R2-2）
// 复用现有 0-6 mastery（state.mastery），不另造等级体系：
//   术语 → key `term-{termId}`（与 TermProfile.masteryKey 一致）
// 学习阶段 L0~L5 由掌握度「推导」（deterministic），只做展示与导航。
// 学习证据七维：阅读 / 关联发现 / 定义题 / 辨析题 / 原典理解 / 案例应用 / 开放分析
//   全部从真实学习行为推导——「点开页面」不等于「学会」。
// 推荐：读「当前掌握度 + 学习证据 + 最近错误/辨析记录」，生成具体下一步。
// ============================================================

import { getTerm, ALL_TERMS, TERM_CATEGORY_BY_ID } from './termData'
import { DISCERNMENT_BY_ID, discernmentsForTerm } from './termDiscern'

export function termMasteryKey(id) {
  return `term-${id}`
}

export function termMastery(state, id) {
  return (state.mastery && state.mastery[termMasteryKey(id)]) || 0
}

// 学习阶段（L0-L5），由掌握度推导
export const TERM_STAGES = [
  { id: 'L0', label: '初识', tip: '先认识这个概念', min: 0 },
  { id: 'L1', label: '理解', tip: '理解它为什么重要', min: 1 },
  { id: 'L2', label: '应用', tip: '能判断它体现在哪里', min: 3 },
  { id: 'L3', label: '比较', tip: '能区分它与相近概念', min: 4 },
  { id: 'L4', label: '独立分析', tip: '能用原典与结构自己解释', min: 5 },
  { id: 'L5', label: '研究', tip: '结合不同传统形成判断', min: 6 },
]

export function termStage(state, id) {
  const level = termMastery(state, id)
  let stage = TERM_STAGES[0]
  for (const s of TERM_STAGES) if (level >= s.min) stage = s
  return { ...stage, level, next: TERM_STAGES.find((s) => s.min > level) || null }
}

// ── 学习证据（七维，从真实行为推导）────────────────────────────
export const TERM_EVIDENCE_DIMS = [
  { key: 'read', label: '阅读' },
  { key: 'link', label: '关联发现' },
  { key: 'define', label: '定义题' },
  { key: 'discern', label: '辨析题' },
  { key: 'original', label: '原典理解' },
  { key: 'case', label: '案例应用' },
  { key: 'analyze', label: '开放分析' },
]

export function termEvidence(state, id) {
  const key = termMasteryKey(id)
  const ev = (state.termEvidence && state.termEvidence[key]) || {}
  const m = termMastery(state, id)
  const note = (state.termNotes && state.termNotes[key] && state.termNotes[key].note) || ''
  const quiz = (state.quizHistory || []).filter((q) => q.nodeId === key)
  const define = quiz.some((q) => q.stepType === 'mastery' || q.stepType === 'definition') || m >= 1
  const discern = (state.contrastHistory || []).some((c) => c.termA === id || c.termB === id)
  return {
    read: !!ev.read,
    link: !!ev.link,
    define,
    discern,
    original: !!ev.original,
    case: !!ev.case,
    analyze: note.trim().length > 0,
  }
}

// ── 确定性推荐：读「掌握度 + 证据 + 辨析记录」→ 下一步 + 为什么 ──────
export function termRecommendation(state, id) {
  const term = getTerm(id)
  if (!term) return null
  const m = termMastery(state, id)
  const ev = termEvidence(state, id)
  const cat = TERM_CATEGORY_BY_ID[term.category]
  const groups = discernmentsForTerm(id)

  if (m === 0) {
    return {
      kind: 'start',
      title: `先弄懂「${term.term}」到底指什么`,
      body: `「${term.term}」属于「${cat ? cat.label : '术语'}」层。先读一句话解释和「容易误解」，再看它出现在哪些卦、哪些爻里，别急着背结论。`,
      why: `当前掌握度 ${m}（未接触）。`,
      contrast: groups.length ? groups[0] : null,
    }
  }

  if (m < 4) {
    return {
      kind: 'weak',
      title: `「${term.term}」还不稳，先从定义题练起`,
      body: `你已初步接触「${term.term}」，但掌握度还停留在 ${m}。先做一次定义判断，再回头看它和相近概念的区别。`,
      why: `掌握度 ${m}（< 4），未达到「能应用」。`,
      contrast: groups.length ? groups[0] : null,
    }
  }

  if (groups.length && !ev.discern) {
    return {
      kind: 'compare',
      title: `做一次「${groups[0].title}」辨析`,
      body: `你已经能说清「${term.term}」是什么，但还没和「${getTerm(groups[0].termA === id ? groups[0].termB : groups[0].termA).term}」分清边界。先判断，再看区分的原典与结构依据。`,
      why: `掌握度已达到 ${m}，但还没有做过相关辨析。`,
      contrast: groups[0],
    }
  }

  if (!ev.analyze) {
    return {
      kind: 'research',
      title: `用自己的话解释「${term.term}」`,
      body: `你已经掌握并辨析过「${term.term}」。下一步用自己的话写下一段解释，再对照它的原典关联与不同传统，看看有没有遗漏。`,
      why: `掌握度 ${m}，已区分相近概念，但还没有写下「开放分析」。`,
      contrast: null,
    }
  }

  return {
    kind: 'research',
    title: `把「${term.term}」放进知识网络里再看一遍`,
    body: `「${term.term}」你已经相当熟悉。试着从它出发，顺藤摸瓜：原典 → 卦 → 爻 → 传统 → 案例，看看还能连到哪些你没学过的对象。`,
    why: `掌握度 ${m}，且有辨析与开放分析记录。`,
    contrast: null,
  }
}

// ── 辨析推荐：读「最近做错的辨析 + 低掌握度且可辨析的术语」──────────
// 对应「用户说『我总分不清中和正』→ 推荐做一次中 vs 正辨析」。
export function contrastRecommendation(state, termId = null) {
  if (termId) {
    const groups = discernmentsForTerm(termId)
    if (!groups.length) return null
    const g = groups[0]
    const other = getTerm(g.termA === termId ? g.termB : g.termA)
    return {
      kind: 'contrast',
      groupId: g.id,
      title: `做一次「${g.title}」辨析`,
      body: `先判断「${getTerm(g.termA).term}」和「${getTerm(g.termB).term}」的区别，再看定义的边界与原典依据。`,
      why: `「${termId}」存在容易混淆的相近概念「${other.term}」。`,
    }
  }

  // 全局：最近「做错」的辨析优先重做（确定性，非随机）
  const wrong = (state.contrastHistory || []).filter((c) => !c.correct).slice(-1)[0]
  if (wrong && DISCERNMENT_BY_ID[wrong.groupId]) {
    const g = DISCERNMENT_BY_ID[wrong.groupId]
    return {
      kind: 'contrast',
      groupId: g.id,
      title: `再辨一次「${g.title}」`,
      body: `你上次在这组辨析上判断错了，先回顾「一句话区别」，再重新作答。`,
      why: `最近一次「${g.title}」辨析回答错误。`,
    }
  }

  // 否则：找第一个「掌握度未到熟练、且有辨析组」的术语
  for (const t of ALL_TERMS) {
    const groups = discernmentsForTerm(t.id)
    if (groups.length && termMastery(state, t.id) < 4) {
      const g = groups[0]
      return {
        kind: 'contrast',
        groupId: g.id,
        title: `今天辨析：${g.title}`,
        body: `先判断「${getTerm(g.termA).term}」和「${getTerm(g.termB).term}」的区别，再看边界与原典。`,
        why: `「${t.term}」掌握度 ${termMastery(state, t.id)}，尚未稳定掌握其边界。`,
      }
    }
  }

  return null
}

// ── 确定性「定义判断」练习：从对比/相关术语中抽取干扰项，不随机、不注水 ──
// 问法：「下面哪一句是在解释『X』？」答案 = 本术语自己的 shortDefinition。
function stablePick(arr, salt, n) {
  // 确定性抽取：按 id 排序后取 hash 偏移，保证同一术语每次抽到同一批。
  const sorted = [...arr].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
  let h = 0
  for (const ch of salt) h = (h * 31 + ch.charCodeAt(0)) | 0
  const start = Math.abs(h) % Math.max(sorted.length, 1)
  return sorted.slice(start).concat(sorted.slice(0, start)).slice(0, n)
}

export function termDefinitionQuestion(id) {
  const term = getTerm(id)
  if (!term || !term.shortDefinition) return null
  const pool = [...(term.contrastTermIds || []), ...(term.relatedTermIds || [])]
    .map((rid) => getTerm(rid))
    .filter((t) => t && t.id !== id && t.shortDefinition)

  // 至少 2 个干扰项才有辨析价值；否则退回「认识 + 易错」自测
  const distractors = stablePick(pool, id, 2)
  if (distractors.length < 2) return null

  const options = [term, ...distractors].map((t) => ({
    text: t.shortDefinition,
    termId: t.id,
  }))
  // 正确答案固定放第 0 位（本术语），顺序由 stablePick 已定 → 确定性
  return {
    id: `term-def-${id}`,
    nodeId: termMasteryKey(id),
    prompt: `下面哪一句是在解释「${term.term}」？`,
    options: options.map((o) => o.text),
    answer: 0,
    explain: `「${term.term}」的正确解释是：${term.shortDefinition}。注意不要和「${distractors.map((d) => d.term).join('」「')}」混淆。`,
    termId: id,
  }
}