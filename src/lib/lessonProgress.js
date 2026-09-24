// ============================================================
// LessonProgress —— 学习进度定位层（不是第二套 Mastery）
//
// 职责划分：
//   「我做到哪里了？」  → LessonProgress（位置 / 状态 / attempt / 题目定位）
//   「我能力怎么样？」  → masteryEngine / computeMasteryProfile（能力，唯一事实源）
//   「我实际做了什么？」 → LearningEvidence（证据层）
//
// 核心约定：
//   1. 每个关卡绑定稳定 nodeId（主键）+ lessonId + chapterId，绝不依赖数组 index。
//      课程增删 / 排序变化不会污染历史进度。
//   2. 每道题绑定 questionId（含 attempt 派生 seed）：同一 attempt 内题目稳定，
//      刷新 / 退出 / 关闭浏览器后从 localStorage 恢复，不会从头开始。
//   3. 「再练一次」生成确定性变体（同知识目标、不同选项顺序），同一 attempt 内
//      选项顺序固定，禁止每次刷新随机变化。
// 全部 deterministic：无 Math.random，无 LLM。
// ============================================================

import { CURRICULUM_NODES, COLLEGES, getCurriculumNode } from '../data/curriculum'
import { getLesson } from '../data/lessons'
import { lessonIdForNode } from '../data/curriculum/lessonFactory'
import { isUnlocked } from '../agent/knowledgeMastery'
// 纯函数拆到独立模块（零数据依赖）：reducer 等壳层只 import 本模块不会带上 curriculum
import { hashSeed, mulberry32, attemptSeed, makeAttemptId, questionIdFor } from './attemptId'

export { hashSeed, mulberry32, attemptSeed, makeAttemptId, questionIdFor }

// Fisher–Yates 确定性洗牌（不修改原数组）
export function shuffleOptions(options, seed) {
  if (!Array.isArray(options) || options.length <= 1) return options
  const out = options.slice()
  const rnd = mulberry32(seed)
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1))
    const t = out[i]
    out[i] = out[j]
    out[j] = t
  }
  return out
}

// 参与变体的步骤类型（选择/判断类，信息类不洗牌）
export const VARIANT_STEP_TYPES = ['choice', 'counter', 'mastery', 'predict']

// 同知识目标、不同材料/选项顺序的确定性变体课程。
// 同一 attemptId → 完全相同的变体；不同 attemptId → 不同变体。
export function variantLesson(lesson, attemptId) {
  if (!lesson || !Array.isArray(lesson.steps)) return lesson
  const seed = attemptSeed(attemptId)
  const steps = lesson.steps.map((step, i) => {
    if (VARIANT_STEP_TYPES.includes(step.type) && Array.isArray(step.options) && step.options.length > 1) {
      return { ...step, options: shuffleOptions(step.options, seed + i * 7 + 13) }
    }
    return step
  })
  return { ...lesson, steps }
}

// ── 进度记录结构 ─────────────────────────────────────────────
// lessonProgress: { [nodeId]: LessonProgressRecord }
// LessonProgressRecord = {
//   nodeId, lessonId, chapterId, collegeId,
//   status,               // 'not_started' | 'in_progress' | 'completed'
//   startedAt, completedAt,
//   attemptCount,
//   currentAttemptId,
//   currentQuestionIndex, // 下一个要做的题号（0-based；恢复断点用）
//   completedQuestionIds, // 本 attempt 已完成题目 id（幂等依据）
//   questionLog,          // 本 attempt 每题记录（复盘数据）
//   lastQuestionId,
//   attempts,             // [{ attemptId, startedAt, completedAt, correct, total, score, startProfile, endProfile }]
//   result,               // { correct, total, score }
//   nextNodeId,           // 缓存的地图下一关 nodeId（可实时重算）
// }
export function emptyLessonProgress(nodeId, lessonId) {
  return {
    nodeId,
    lessonId,
    chapterId: null,
    collegeId: null,
    status: 'not_started',
    startedAt: null,
    completedAt: null,
    attemptCount: 0,
    currentAttemptId: null,
    currentQuestionIndex: 0,
    completedQuestionIds: [],
    questionLog: [],
    lastQuestionId: null,
    attempts: [],
    result: null,
    nextNodeId: null,
  }
}

// 读取某关卡进度（无则返回空记录）
export function progressOf(state, nodeId) {
  if (!nodeId) return null
  return (state && state.lessonProgress && state.lessonProgress[nodeId]) || null
}

// 进度状态（'not_started' | 'in_progress' | 'completed' | 'locked'）
export function statusOf(state, nodeId) {
  const p = progressOf(state, nodeId)
  if (p) return p.status
  const n = getCurriculumNode(nodeId)
  if (n && !isUnlocked(state, nodeId)) return 'locked'
  return 'not_started'
}

// 某 attempt 内某题是否已完成（幂等判断）
export function isQuestionCompleted(state, nodeId, attemptId, questionId) {
  const p = progressOf(state, nodeId)
  if (!p || p.currentAttemptId !== attemptId) return false
  return p.completedQuestionIds.includes(questionId)
}

// 组件/测试共用的幂等门：本题是否应记录（同一 attempt 同题只记一次）
export function shouldRecordQuestion(progress, attemptId, questionId) {
  if (!progress || progress.currentAttemptId !== attemptId) return false
  return !(progress.completedQuestionIds || []).includes(questionId)
}

// ── 地图真实顺序 → 下一关 ────────────────────────────────────
function chapterTitleOf(chapterId) {
  for (const c of COLLEGES) {
    for (const ch of c.chapters) {
      if (ch.id === chapterId) return ch.title
    }
  }
  return null
}

// 下一关必须由「地图真实顺序」决定（nodeId → 顺序定位），不是 currentIndex + 1 猜。
// 规则：
//   1) 当前节点之后、有课程的下一个节点（CURRICULUM_NODES 顺序 = 学院/章节展开顺序）；
//   2) 返回该节点是否解锁；章节/学院边界标记；路径末尾标记。
// 返回 null 表示当前节点不在地图中。
export function getNextLessonNode(state, currentNodeId) {
  const cur = getCurriculumNode(currentNodeId)
  if (!cur) return null
  const start = CURRICULUM_NODES.findIndex((n) => n.id === currentNodeId)
  if (start === -1) return null
  for (let i = start + 1; i < CURRICULUM_NODES.length; i++) {
    const n = CURRICULUM_NODES[i]
    const l = getLesson(lessonIdForNode(n.id))
    if (!l || !Array.isArray(l.steps) || l.steps.length === 0) continue
    const unlocked = isUnlocked(state, n.id)
    const chapterEnd = n.chapter !== cur.chapter
    const collegeEnd = n.college !== cur.college
    return {
      node: n,
      lessonId: l.id,
      unlocked,
      lockReason: unlocked
        ? null
        : `需先完成：${(n.prerequisite || [])
            .filter((p) => ((state.mastery && state.mastery[p]) || 0) < 1)
            .map((p) => getCurriculumNode(p)?.title || p)
            .join('、')}`,
      chapterEnd,
      collegeEnd,
      nextChapterTitle: chapterEnd ? chapterTitleOf(n.chapter) : null,
      nextCollegeTitle: collegeEnd ? n.collegeTitle || null : null,
      pathEnd: false,
    }
  }
  return { node: null, lessonId: null, unlocked: false, lockReason: null, chapterEnd: false, collegeEnd: false, nextChapterTitle: null, pathEnd: true }
}

// UI 用包装：返回 { current, next, ... } 给完成页/完成状态页
export function nextLessonInfo(state, currentNodeId) {
  const cur = getCurriculumNode(currentNodeId)
  const next = getNextLessonNode(state, currentNodeId)
  return {
    currentNode: cur,
    next,
    hasNext: !!next && !next.pathEnd && !!next.node,
    canEnterNext: !!next && !next.pathEnd && !!next.node && next.unlocked,
  }
}

// 复盘：返回本 attempt 每题记录（供「查看复盘」）
export function replayOf(progress) {
  if (!progress) return []
  return (progress.questionLog || []).map((q, i) => ({ ...q, index: i }))
}

// 最近一次完成表现
export function lastResultOf(progress) {
  return (progress && progress.result) || null
}

// 能力变化摘要：比较 attempt 首尾 masteryProfile 快照
// 返回 [{ key, label, from, to }]（仅提升的维度，deterministic）
export function profileDelta(startProfile, endProfile) {
  const DIM_LABELS = {
    observation: '观察',
    structure: '结构',
    evidence: '证据',
    reasoning: '推理',
    counterexample: '反例',
    uncertainty: '不确定性',
    synthesis: '综合',
    independence: '独立性',
  }
  if (!startProfile || !endProfile) return []
  const out = []
  for (const key of Object.keys(DIM_LABELS)) {
    const from = startProfile[key]
    const to = endProfile[key]
    if (typeof from === 'number' && typeof to === 'number' && to > from) {
      out.push({ key, label: DIM_LABELS[key], from, to })
    }
  }
  return out
}
