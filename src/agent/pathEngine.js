// ============================================================
// 🛤️ 求学之路引擎（R7）：确定性计算，无随机、无 LLM。
// 职责：每段进度 / 当前段 / 阶段测验生成与判定 / 下一个核心节点。
// 数据源：state.mastery（节点掌握度 0-6）、state.lessonProgress（关卡完成）、
//         state.pathQuizzes（测验结果）、curriculum 节点题目。
// ============================================================

import { PATH_STAGES, getStage, stageOfNode } from '../data/pathStages'
import { getCurriculumNode, getChapter } from '../data/curriculum'

// 节点「完成」判定：掌握度 >= 4（能应用）或关卡标记完成
export function nodeDone(state, nodeId) {
  const m = (state.mastery || {})[nodeId] || 0
  if (m >= 4) return true
  const p = (state.lessonProgress || {})[nodeId]
  if (p && p.status === 'completed') return true
  return false
}

// 某段进度
export function stageProgress(state, stageKey) {
  const stage = getStage(stageKey)
  if (!stage) return { total: 0, done: 0, doneIds: [], quiz: null }
  const doneIds = stage.coreNodeIds.filter((id) => nodeDone(state, id))
  const quiz = (state.pathQuizzes || {})[stageKey] || null
  return { total: stage.coreNodeIds.length, done: doneIds.length, doneIds, quiz }
}

// 当前段：第一个未结业的段
export function currentStage(state) {
  for (const s of PATH_STAGES) {
    const p = stageProgress(state, s.key)
    if (!p.quiz || !p.quiz.passed) return { ...s, progress: p }
  }
  const last = PATH_STAGES[PATH_STAGES.length - 1]
  return { ...last, progress: stageProgress(state, last.key) }
}

// 六段总览
export function pathSummary(state) {
  const stages = PATH_STAGES.map((s) => ({ ...s, progress: stageProgress(state, s.key) }))
  const cur = currentStage(state)
  const totalCore = PATH_STAGES.reduce((a, s) => a + s.coreNodeIds.length, 0)
  const masteredCore = PATH_STAGES.reduce((a, s) => a + stageProgress(state, s.key).done, 0)
  return { stages, currentKey: cur.key, current: cur, totalCore, masteredCore }
}

// 当前段第一个未完成的核心节点
export function nextCoreNode(state) {
  const cur = currentStage(state)
  for (const id of cur.coreNodeIds) {
    if (!nodeDone(state, id)) {
      const n = getCurriculumNode(id)
      return { nodeId: id, stageKey: cur.key, stage: cur, title: n ? n.title : id, emoji: n ? n.emoji : '📘' }
    }
  }
  return null
}

// ── 阶段测验：确定性抽题 ───────────────────────────────────
// 题目来源：核心节点的 applyB → apply → counterB → counter → masteryCheck
// （变式题优先，同一节点最多贡献 1 题；不泄露正确答案）。
// 返回题不含 correct 字段（避免前端泄露答案）；判定时按 qId 反查节点数据。

const Q_KINDS = ['applyB', 'apply', 'counterB', 'counter', 'masteryCheck']

function pickQuestion(node) {
  if (!node) return null
  for (const kind of Q_KINDS) {
    const src = node[kind]
    if (!src || !Array.isArray(src.options) || !src.options.length) continue
    if (!src.options.some((o) => o.correct)) continue
    return {
      qId: `${node.id}:${kind}`,
      nodeId: node.id,
      kind,
      title: node.title,
      prompt: src.prompt,
      options: src.options.map((o, i) => ({ idx: i, text: o.text })),
      explain: src.explain || '',
    }
  }
  return null
}

// 生成某段测验：沿核心节点顺序取满 5 题（不足 5 题则取全部可用题）
export function stageQuiz(stageKey) {
  const stage = getStage(stageKey)
  if (!stage) return []
  const out = []
  for (const id of stage.coreNodeIds) {
    if (out.length >= 5) break
    const q = pickQuestion(getCurriculumNode(id))
    if (q) out.push(q)
  }
  return out
}

// 判定测验：answers = [{ qId, idx }]；>= 4/5 通过（不足 5 题则 >= 80%）
export function checkStageQuiz(stageKey, answers = []) {
  const stage = getStage(stageKey)
  if (!stage) return { score: 0, total: 0, passed: false, detail: [] }
  const quiz = stageQuiz(stageKey)
  const byQ = new Map(quiz.map((q) => [q.qId, q]))
  let correct = 0
  const detail = []
  for (const a of answers) {
    const q = byQ.get(a.qId)
    if (!q) continue
    const node = getCurriculumNode(q.nodeId)
    const src = node && node[q.kind]
    const rightIdx = src && src.options ? src.options.findIndex((o) => o.correct) : -1
    const ok = rightIdx === a.idx
    if (ok) correct += 1
    detail.push({ qId: q.qId, nodeId: q.nodeId, correct: ok })
  }
  const total = quiz.length
  const score = total ? Math.round((correct / total) * 100) : 0
  return { score, total, correct, passed: total >= 4 ? correct >= 4 : (total > 0 && score >= 80), detail }
}

// ── 章节闯关（R9）────────────────────────────────────────
// 默认每章抽 10 题（可自定义 targetCount）：第一轮每节点取 1 题
// （变式优先），不足时第二轮对同一节点补其他 kind 的题凑满。
// 同一节点最多贡献 5 题（applyB/apply/counterB/counter/masteryCheck 各 1）。
// 确定性抽题，不泄露正确答案。
function makeQuestion(n, kind) {
  const src = n[kind]
  if (!src || !Array.isArray(src.options) || !src.options.length) return null
  if (!src.options.some((o) => o.correct)) return null
  return {
    qId: `${n.id}:${kind}`,
    nodeId: n.id,
    kind,
    title: n.title,
    prompt: src.prompt,
    options: src.options.map((o, i) => ({ idx: i, text: o.text })),
    explain: src.explain || '',
  }
}

export function chapterQuiz(chapterId, targetCount = 10) {
  const ch = getChapter(chapterId)
  if (!ch) return []
  const nodes = (ch.nodes || []).filter(Boolean)
  const out = []
  // 第一轮：每节点 1 题（Q_KINDS 变式优先）
  for (const n of nodes) {
    if (out.length >= targetCount) break
    for (const kind of Q_KINDS) {
      const q = makeQuestion(n, kind)
      if (q) {
        out.push(q)
        break
      }
    }
  }
  // 第二轮：同一节点补其他 kind，凑满目标题量
  if (out.length < targetCount) {
    outer: for (const n of nodes) {
      if (out.length >= targetCount) break
      for (const kind of Q_KINDS) {
        if (out.length >= targetCount) break outer
        if (out.some((x) => x.nodeId === n.id && x.kind === kind)) continue
        const q = makeQuestion(n, kind)
        if (q) out.push(q)
      }
    }
  }
  return out.slice(0, targetCount)
}

export function checkChapterQuiz(chapterId, answers = [], targetCount = 10) {
  const quiz = chapterQuiz(chapterId, targetCount)
  const byQ = new Map(quiz.map((q) => [q.qId, q]))
  let correct = 0
  const detail = []
  for (const a of answers) {
    const q = byQ.get(a.qId)
    if (!q) continue
    const node = getCurriculumNode(q.nodeId)
    const src = node && node[q.kind]
    const rightIdx = src && src.options ? src.options.findIndex((o) => o.correct) : -1
    const ok = rightIdx === a.idx
    if (ok) correct += 1
    detail.push({ qId: q.qId, nodeId: q.nodeId, correct: ok })
  }
  const total = quiz.length
  const score = total ? Math.round((correct / total) * 100) : 0
  // 10 题：≥8 通关（80%）；题量不足 targetCount 的章节（极少见）：≥80% 通关
  const passed = total >= targetCount ? correct >= Math.ceil(targetCount * 0.8) : total > 0 && score >= 80
  return { score, total, correct, passed, detail }
}
