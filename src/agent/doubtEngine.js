// ============================================================
// R3 Phase 3B/3C · DoubtTask Runner（怀疑任务执行引擎）
//
// 怀疑室不是答题模块：任务是「材料 → 初始判断 → 证据 → 反例 →
// 修正 → 反思」的认知纠偏流程。开放文本只做 deterministic
// TextSignals 分析（不判对错、不做语义幻觉判断、无 LLM）。
//
// 每步产生真实 Evidence（source='doubt'，targetType='doubt'，
// targetId=taskId），完成时产出 DoubtResult + BeliefRevision，
// 复用 masteryEngine 的 computeMasteryProfile 吸收能力变化。
// ============================================================

import { getDoubtTask } from '../data/doubtTasks'
import { analyzeSignals } from '../lib/textSignals'

// 执行流程：material 不产生 Evidence（只展示材料），其余五步记录行为。
export const DOUBT_STEP_KEYS = ['hypothesis', 'evidence', 'counterexample', 'revise', 'reflect']

export const DOUBT_FLOW = [
  { key: 'material', label: '材料', hint: '看一句「玄学判断」，先别急着认同。' },
  { key: 'hypothesis', label: '初始判断', hint: '写下你第一反应会怎么解释它（或选一个最接近的选项）。' },
  { key: 'evidence', label: '证据', hint: '写一条支持这个判断的依据——原文、结构、还是只有感觉？' },
  { key: 'counterexample', label: '反例', hint: '主动找一个可能推翻这个判断的反例，找不到也写「暂时没想到」。' },
  { key: 'revise', label: '修正', hint: '现在你会怎么修正初始判断？可以保持，但请说明理由。' },
  { key: 'reflect', label: '反思', hint: '这次训练里，你最容易卡在哪一步？' },
]

// 每步 → Evidence action
export const DOUBT_STEP_ACTIONS = {
  hypothesis: 'hypothesis',
  evidence: 'evidence',
  counterexample: 'counterexample',
  revise: 'revise',
  reflect: 'reflect',
}

// 启动一次怀疑任务（run 纯对象，可测试）
export function startDoubtTask(taskOrId, opts = {}) {
  const task = typeof taskOrId === 'string' ? getDoubtTask(taskOrId) : taskOrId
  if (!task) return null
  const timestamp = opts.timestamp ?? Date.now()
  return {
    runId: opts.runId ?? `doubt-${task.id}-${timestamp}`,
    taskId: task.id,
    category: task.category,
    title: task.title,
    emoji: task.emoji || '🪞',
    prompt: task.prompt || '',
    statement: task.statement || '',
    options: task.options || null,
    hint: task.hint || null,
    correctIndex: task.correctIndex ?? null,
    correctReasoning: task.correctReasoning || null,
    explanation: task.explanation || null,
    relatedTerms: task.relatedTerms || [],
    hexagrams: task.hexagrams || [],
    yaos: task.yaos || [],
    errorTypes: task.errorTypes || [],
    masteryKeys: task.masteryKeys || [],
    difficulty: task.difficulty ?? 2,
    steps: {},
    startedAt: timestamp,
  }
}

function textOf(v) {
  if (typeof v === 'string') return v
  if (v && typeof v === 'object') return v.text ?? v.value ?? ''
  return ''
}

// 记录一步；返回 { run, evidence }，evidence 为应写入的 Evidence partial
export function recordDoubtStep(run, stepKey, value, opts = {}) {
  if (!run || !DOUBT_STEP_KEYS.includes(stepKey)) return { run, evidence: [] }
  const action = DOUBT_STEP_ACTIONS[stepKey] || null
  const entry = {
    key: stepKey,
    value,
    text: textOf(value),
    at: opts.timestamp ?? Date.now(),
  }
  const next = { ...run, steps: { ...(run.steps || {}), [stepKey]: entry } }
  const evidence = []
  if (action) {
    evidence.push({
      source: 'doubt',
      action,
      targetType: 'doubt',
      targetId: run.taskId,
      context: entry.text,
      result: typeof value === 'object' && value !== null ? value : null,
      confidence: opts.confidence ?? null,
      metadata: { step: stepKey, runId: run.runId, taskTitle: run.title },
    })
  }
  return { run: next, evidence }
}

// 步骤开放文本的结构化信号（确定性，无 NLP）
export function doubtStepSignals(run) {
  if (!run) return {}
  const sig = {}
  for (const k of DOUBT_STEP_KEYS) {
    const e = run.steps?.[k]
    const text = e ? e.text || textOf(e.value) : ''
    sig[k] = text ? analyzeSignals(text) : null
  }
  return sig
}

// 汇总本次怀疑任务的信号摘要（供「这次改变了什么？」展示）
export function summarizeDoubtSignals(run) {
  const sig = doubtStepSignals(run)
  const summary = {
    mentionedEvidence: false,
    mentionedCounterexample: false,
    mentionedUncertainty: false,
    selfCorrection: false,
    absoluteClaims: 0,
    hasContent: {},
  }
  for (const k of DOUBT_STEP_KEYS) {
    const s = sig[k]
    summary.hasContent[k] = !!(run?.steps?.[k] && (run.steps[k].text || '').trim())
    if (!s) continue
    if (s.mentionsEvidence) summary.mentionedEvidence = true
    if (s.mentionsCounterexample) summary.mentionedCounterexample = true
    if (s.mentionsUncertainty) summary.mentionedUncertainty = true
    if (s.selfCorrection) summary.selfCorrection = true
    summary.absoluteClaims += s.absoluteClaims
  }
  return summary
}

// 是否存在观点修正：初始判断与修正后的观点有实质差异
export function hasRevision(run) {
  if (!run) return false
  const h = run.steps?.hypothesis?.text || ''
  const r = run.steps?.revise?.text || ''
  if (!h.trim() || !r.trim()) return false
  if (h.trim() === r.trim()) return false
  // 「保持不变」类表达不算修正
  if (/保持不变|维持原|不修正|坚持原/.test(r)) return false
  return true
}

// BeliefRevision（复用 Phase 2 的结构约定）
export function buildDoubtBeliefRevision(run, opts = {}) {
  if (!run) return null
  const h = run.steps?.hypothesis
  const r = run.steps?.revise
  const c = run.steps?.counterexample
  const ev = run.steps?.evidence
  const refl = run.steps?.reflect
  const originalClaim = h?.text || textOf(h?.value)
  const revisedClaim = r?.text || textOf(r?.value)
  if (!originalClaim.trim() && !revisedClaim.trim()) return null
  const counteritems = []
  if (c?.text && String(c.text).trim()) counteritems.push(c.text)
  if (ev?.text && String(ev.text).trim()) counteritems.push(ev.text)
  const reason = (refl?.text && String(refl.text).trim()) ? refl.text : (r?.text || null)
  return {
    originalClaim: originalClaim.trim() || null,
    originalConfidence: h?.confidence ?? null,
    counterEvidence: counteritems.filter((x) => x && String(x).trim()),
    revisedClaim: revisedClaim.trim() || null,
    revisedConfidence: r?.confidence ?? null,
    reason: reason || null,
    source: 'doubt',
    taskId: run.taskId,
    timestamp: opts.timestamp ?? Date.now(),
  }
}

// 完成：产出 DoubtResult（含 beliefRevision / signals / 选项对照）
export function buildDoubtResult(run, opts = {}) {
  if (!run) return null
  const completedAt = opts.timestamp ?? Date.now()
  const beliefRevision = buildDoubtBeliefRevision(run, { timestamp: completedAt })
  const signals = summarizeDoubtSignals(run)
  const val = (k) => {
    const e = run.steps?.[k]
    if (!e) return { value: null, text: null, confidence: null }
    return { value: e.value ?? null, text: e.text || null, confidence: e.confidence ?? null }
  }
  return {
    runId: run.runId,
    taskId: run.taskId,
    category: run.category,
    title: run.title,
    emoji: run.emoji,
    prompt: run.prompt,
    statement: run.statement,
    hypothesis: val('hypothesis').text,
    hypothesisConfidence: val('hypothesis').confidence,
    evidence: val('evidence').text,
    counterexample: val('counterexample').text,
    revise: val('revise').text,
    reflect: val('reflect').text,
    selectedOption: val('hypothesis').value && typeof val('hypothesis').value === 'object'
      ? val('hypothesis').value.optionIndex ?? null
      : (typeof val('hypothesis').value === 'number' ? val('hypothesis').value : null),
    correctIndex: run.correctIndex ?? null,
    correctReasoning: run.correctReasoning,
    explanation: run.explanation,
    errorTypes: run.errorTypes || [],
    masteryKeys: run.masteryKeys || [],
    signals,
    beliefRevision,
    hasRevision: hasRevision(run),
    completedAt,
  }
}

// 把 run 的每一步译为 Evidence partial（供写入 store / 测试共用）
export function runDoubtEvidencePartials(run) {
  if (!run) return []
  const out = []
  for (const k of DOUBT_STEP_KEYS) {
    const e = run.steps?.[k]
    if (!e) continue
    const action = DOUBT_STEP_ACTIONS[k]
    if (!action) continue
    out.push({
      source: 'doubt',
      action,
      targetType: 'doubt',
      targetId: run.taskId,
      context: e.text || '',
      result: typeof e.value === 'object' && e.value !== null ? e.value : null,
      confidence: e.confidence ?? null,
      metadata: { step: k, runId: run.runId, taskTitle: run.title },
    })
  }
  // 完成标记（不贡献能力，只记录完成事实）
  out.push({
    source: 'doubt',
    action: 'complete',
    targetType: 'doubt',
    targetId: run.taskId,
    context: `完成怀疑任务「${run.title}」`,
    metadata: { runId: run.runId, taskTitle: run.title },
  })
  return out
}

// Doubt Archive：把若干 run 组织成「怀疑档案」（原行为模式 → 本次行为 → 变化）
export function buildDoubtArchive(runs) {
  const arr = Array.isArray(runs) ? runs : []
  const byTask = {}
  for (const r of arr) {
    byTask[r.taskId] ||= { taskId: r.taskId, title: r.title, category: r.category, emoji: r.emoji, runs: [] }
    byTask[r.taskId].runs.push({
      runId: r.runId,
      hypothesis: r.hypothesis ?? null,
      evidence: r.evidence ?? null,
      counterexample: r.counterexample ?? null,
      revise: r.revise ?? null,
      reflect: r.reflect ?? null,
      hasRevision: !!r.hasRevision,
      signals: r.signals || null,
      completedAt: r.completedAt ?? null,
    })
  }
  return {
    runCount: arr.length,
    taskCount: Object.keys(byTask).length,
    revisionCount: arr.filter((r) => r.hasRevision).length,
    byTask: Object.values(byTask),
  }
}
