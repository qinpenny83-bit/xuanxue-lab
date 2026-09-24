// ============================================================
// 🔬 知识 Mastery 引擎（V3 Phase 1）
// 解决的问题：「学过什么、会什么、忘了什么、下一步学什么」
//
// 输入：state（真实学习行为：quizHistory / completedLessons / caseAttempts）
// 输出：每个课程节点的派生画像（不修改 state.mastery，只读计算）：
//   level          原始掌握度 0-6（来自既有 mastery 机制）
//   effectiveLevel 考虑遗忘后的有效等级（复习提醒专用，不污染原始值）
//   status         学习地图状态（fresh/practicing/unstable/stable/mastered/review）
//   daysSince      距最近一次学习的天数
//
// 遗忘曲线原则：
//   刚掌握 → 稳定 → 长期未使用 → 开始下降 → Agent 自动安排复习
//   复习优先「一个高价值复习案例」，不强制重复大量题目。
// 全部 deterministic：无随机、无 LLM。
// ============================================================

import { COLLEGES, CURRICULUM_NODES, getCurriculumNode, resolvePrereqs, transferCandidates } from '../data/curriculum'
import { getLesson } from '../data/lessons'
import { getCase } from '../data/cases'

// 遗忘参数（天数）
export const REVIEW_DAYS = 21 // 超过 21 天未复习 → 触发衰减与复习队列
export const WARNING_DAYS = 14 // 超过 14 天 → 状态降级提示（学习中/不稳定）
export const PER_DAYS_PER_LEVEL = 14 // 进入复习后，每再拖 14 天降 1 级

// 学习地图状态标签（与 curriculum/index.js 的 NODE_STATUS 保持一致）
export const NODE_STATUS = {
  fresh: { key: 'fresh', label: '🌱 未接触' },
  practicing: { key: 'practicing', label: '📖 练习中' },
  unstable: { key: 'unstable', label: '🌊 不稳定' },
  stable: { key: 'stable', label: '✅ 已理解' },
  mastered: { key: 'mastered', label: '🏆 掌握' },
  review: { key: 'review', label: '🔁 长期未复习' },
}

// 某节点的最近一次学习时间（真实行为，deterministic）
export function lastStudyAt(state, nodeId) {
  const times = []
  for (const q of state.quizHistory || []) {
    if (q.nodeId === nodeId && q.at) times.push(new Date(q.at).getTime())
  }
  for (const lessonId in state.completedLessons || {}) {
    const l = getLesson(lessonId)
    const rec = state.completedLessons[lessonId]
    if (l && l.nodeId === nodeId && rec?.lastAt) times.push(new Date(rec.lastAt).getTime())
  }
  for (const c of state.caseAttempts || []) {
    const cs = getCase(c.caseId)
    if (cs && (cs.relatedNodes || []).includes(nodeId) && c.at) times.push(new Date(c.at).getTime())
  }
  return times.length ? Math.max(...times) : null
}

export function daysSince(ms) {
  if (!ms) return null
  return Math.max(0, Math.floor((Date.now() - ms) / 86400000))
}

// 状态推导：level(0-6) + daysSince
export function knowledgeStatus(level, d) {
  if (level <= 0) return 'fresh'
  if (level < 3) return d !== null && d >= WARNING_DAYS ? 'unstable' : 'practicing'
  if (level === 3) return 'unstable' // 学过但未到「能应用」，天然不稳定
  if (d !== null && d >= REVIEW_DAYS) return 'review'
  if (level >= 5) return 'mastered'
  return 'stable'
}

// 有效等级：已掌握但长期未复习 → 逐步衰减。
// 超过复习阈值立即降一档（遗忘已经开始），之后每 PER_DAYS_PER_LEVEL 天再降一档，最低降到 3（不稳定）。
export function effectiveLevel(level, d) {
  if (level < 4) return level
  if (d === null || d < REVIEW_DAYS) return level
  const drop = Math.floor((d - REVIEW_DAYS) / PER_DAYS_PER_LEVEL) + 1
  return Math.max(3, level - drop)
}

// 计算全课程知识画像：{ [nodeId]: { level, effectiveLevel, status, daysSince, lastAt } }
export function computeKnowledgeMastery(state) {
  const out = {}
  for (const n of CURRICULUM_NODES) {
    const level = (state.mastery && state.mastery[n.id]) || 0
    const last = lastStudyAt(state, n.id)
    const d = daysSince(last)
    out[n.id] = {
      nodeId: n.id,
      level,
      effectiveLevel: effectiveLevel(level, d),
      status: knowledgeStatus(level, d),
      daysSince: d,
      lastAt: last,
      unlocked: isUnlocked(state, n.id),
    }
  }
  return out
}

// 前置解锁：所有前置节点均达到 level>=1（接触过）
export function isUnlocked(state, nodeId) {
  const prereqs = resolvePrereqs(nodeId)
  return prereqs.every((p) => ((state.mastery && state.mastery[p]) || 0) >= 1)
}

// 下一课推荐：课程完成后「直接去下一关」。
// 规则：
//   1) 三者在同学院同章节、且排在本节点之后的节点里，找第一个「已解锁且还没掌握(level<4)」的节点；
//   2) 若本章节后续没有可学的，再跨章节/学院，找第一个「已解锁且未掌握」的节点。
// 只推荐「前置已满足、不会用到没学过知识」的节点，返回 null 表示已全部掌握。
export function nextLessonCandidate(state, nodeId) {
  const cur = getCurriculumNode(nodeId)
  if (!cur) return null
  const ready = (x) => isUnlocked(state, x.id) && ((state.mastery && state.mastery[x.id]) || 0) < 4
  const curIndex = CURRICULUM_NODES.findIndex((x) => x.id === nodeId)

  // 1) 同章节中、当前节点之后
  for (let i = curIndex + 1; i < CURRICULUM_NODES.length; i++) {
    const x = CURRICULUM_NODES[i]
    if (x.college === cur.college && x.chapter === cur.chapter && ready(x)) return x
  }
  // 2) 跨章节 / 跨学院兜底
  for (const x of CURRICULUM_NODES) {
    if (x.id === nodeId) continue
    if (x.college === cur.college && x.chapter === cur.chapter) continue
    if (ready(x)) return x
  }
  return null
}

// 复习队列：需要复习的节点，按「遗忘紧迫度」排序（有效等级升序，天数降序）
export function reviewQueue(state) {
  const k = computeKnowledgeMastery(state)
  return Object.values(k)
    .filter((x) => x.status === 'review')
    .sort((a, b) => a.effectiveLevel - b.effectiveLevel || (b.daysSince || 0) - (a.daysSince || 0))
}

// 知识瓶颈：找出「当前最该补」的节点。
// 优先级：已掌握但遗忘（review）> 学了但长期不稳定（unstable 且久）> 练习中卡住很久（practicing 且久）
export function knowledgeBottleneck(state) {
  const k = computeKnowledgeMastery(state)
  const items = Object.values(k).filter((x) => x.level > 0 && x.unlocked)
  if (!items.length) return null
  const sortScore = (x) => {
    if (x.status === 'review') return 0
    if (x.status === 'unstable') return 1
    if (x.status === 'practicing') return 2
    return 3
  }
  const sorted = [...items].sort((a, b) => sortScore(a) - sortScore(b) || (b.daysSince || 0) - (a.daysSince || 0))
  const top = sorted[0]
  if (top.status === 'stable' || top.status === 'mastered') return null // 没有需要补的
  return top
}

// 学习地图数据：分学院 → 章节 → 节点（含状态），供 Map 页与 Agent 使用
export function learningMap(state) {
  const k = computeKnowledgeMastery(state)
  return COLLEGES.map((college) => ({
    ...college,
    chapters: college.chapters.map((ch) => ({
      ...ch,
      nodes: ch.nodes.map((n) => ({ ...n, mastery: k[n.id] || { status: 'fresh', level: 0, effectiveLevel: 0, daysSince: null, unlocked: true } })),
    })),
  }))
}

// 汇总统计
export function knowledgeSummary(state) {
  const k = computeKnowledgeMastery(state)
  const values = Object.values(k)
  const mastered = values.filter((x) => x.status === 'mastered' || x.status === 'stable').length
  const review = values.filter((x) => x.status === 'review').length
  const learning = values.filter((x) => x.status === 'practicing' || x.status === 'unstable').length
  const fresh = values.filter((x) => x.status === 'fresh').length
  return { total: values.length, mastered, review, learning, fresh }
}

// 迁移挑战可用性：给定已掌握的节点，列出可迁移到其他学院的候选
export function migrationChallenges(state) {
  const k = computeKnowledgeMastery(state)
  return Object.values(k)
    .filter((x) => x.level >= 4)
    .map((x) => ({ from: getCurriculumNode(x.nodeId), to: transferCandidates(x.nodeId) }))
    .filter((x) => x.from && x.to.length)
}
