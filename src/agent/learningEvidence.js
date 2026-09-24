// ============================================================
// R3 Phase 0 · 统一学习证据层（LearningEvidence）
//
// 目标：让系统真正知道用户「做过什么、做得怎么样、哪里错、是否修正」。
// 原则：
//   · Evidence 是「事实记录」，行为次数 ≠ 能力水平。
//   · 能力水平继续由 masteryEngine 管理，本模块只做「打点 + 汇总 + 推荐因子」。
//   · 纯函数 + localStorage 上层（reducer 持有 state.evidence）。
//   · deterministic，禁止 Math.random()。
//   · 本模块零数据依赖：targetLabel / renderRecentSummary 拆到 evidenceLabel.js，
//     避免 reducer 静态引用本模块时把 hexagramProfile/termData/lessons 拉进首包。
// ============================================================

export const EVIDENCE_VERSION = 1

export const EVIDENCE_SOURCES = [
  'workshop', 'experiment', 'doubt', 'case', 'lesson', 'classic', 'review', 'agent', 'path', 'challenge',
]

export const EVIDENCE_ACTIONS = [
  'view', 'observe', 'identify', 'analyze', 'compare', 'interpret', 'construct',
  'hypothesis', 'predict', 'sample', 'inspect', 'evidence', 'counterexample',
  'revise', 'reflect', 'challenge', 'complete', 'retry', 'save', 'pass',
]

export const EVIDENCE_TARGET_TYPES = [
  'hexagram', 'yao', 'term', 'classic', 'tradition', 'case', 'experiment', 'doubt', 'workshop', 'stage', 'chapter',
]

// action → masteryEngine 8 维意图映射（只做意图标注，不直接改写维度值）
export const ACTION_TO_SKILL = {
  view: 'observation',
  observe: 'observation',
  identify: 'observation',
  sample: 'observation',
  inspect: 'observation',
  analyze: 'reasoning',
  compare: 'reasoning',
  interpret: 'reasoning',
  hypothesis: 'reasoning',
  construct: 'synthesis',
  evidence: 'evidence',
  counterexample: 'counterexample',
  revise: 'reasoning',
  reflect: 'uncertainty',
  challenge: 'independence',
}

// Agent 推荐 reason code 候选（后续 Agent 引用真实 Evidence 生成原因）
export const REASON_CODES = {
  WEAK_TERM: 'WEAK_TERM',
  REPEATED_ERROR: 'REPEATED_ERROR',
  NO_COUNTEREXAMPLE: 'NO_COUNTEREXAMPLE',
  LOW_EVIDENCE: 'LOW_EVIDENCE',
  WEAK_EVIDENCE: 'WEAK_EVIDENCE',
  LOW_UNCERTAINTY: 'LOW_UNCERTAINTY',
  RECENT_YAO: 'RECENT_YAO',
  RECENT_HEXAGRAM: 'RECENT_HEXAGRAM',
  UNUSED_CLASSIC: 'UNUSED_CLASSIC',
  UNDERUSED_CLASSIC: 'UNDERUSED_CLASSIC',
  TRADITION_GAP: 'TRADITION_GAP',
  REPEATED_BELIEF: 'REPEATED_BELIEF',
  BELIEF_REVISION: 'BELIEF_REVISION',
  READY_FOR_INDEPENDENCE: 'READY_FOR_INDEPENDENCE',
}

export const DAY_MS = 86400000

function dedupKey(e) {
  return [e.source, e.action, e.targetType, e.targetId].join('|')
}

// ── Evidence ID 唯一性保证 ─────────────────────────────────────
// 只用 Date.now() 会同毫秒撞 ID。这里用「进程内单调递增计数器」补齐，
// 确定性（无 Math.random），保证同一毫秒连续写入 100 条也不重复。
let idCounter = 0

function nextIdSeq(partial) {
  // 测试可注入 __seq 复现；否则用进程内单调递增序号保证唯一。
  if (partial != null && partial.__seq != null && partial.__seq !== '') {
    return String(partial.__seq).toString(36)
  }
  idCounter += 1
  return idCounter.toString(36)
}

// 规范化并生成一条 Evidence。timestamp 由外部可注入（便于可复现测试）。
export function createEvidence(partial = {}) {
  const timestamp = partial.timestamp ?? Date.now()
  const ev = {
    version: EVIDENCE_VERSION,
    id: `ev-${partial.source || 'unknown'}-${timestamp}-${nextIdSeq(partial)}`,
    timestamp,
    source: partial.source || 'agent',
    action: partial.action || 'view',
    targetType: partial.targetType || 'workshop',
    targetId: partial.targetId ?? null,
    context: partial.context || null,
    result: partial.result ?? null,
    evidence: partial.evidence ?? null,
    errorTypes: Array.isArray(partial.errorTypes) ? partial.errorTypes : [],
    confidence: partial.confidence ?? null,
    beforeMastery: partial.beforeMastery ?? null,
    afterMastery: partial.afterMastery ?? null,
    masteryKey: partial.masteryKey ?? null,
    skill: partial.skill ?? ACTION_TO_SKILL[partial.action] ?? null,
    metadata: partial.metadata ?? null,
  }
  // 去重键（不落盘，仅用于 recordEvidence 判重）
  ev.dedupKey = dedupKey(ev)
  return ev
}

// 追加一条 Evidence；同一动作 2 秒内重复写入会被去重（不影响既有数据）。
export function recordEvidence(list, partial = {}, opts = {}) {
  const arr = Array.isArray(list) ? list : []
  const dedupMs = opts.dedupMs ?? 2000
  const ev = createEvidence(partial)
  const prev = arr[arr.length - 1]
  if (prev && prev.dedupKey === ev.dedupKey && ev.timestamp - prev.timestamp < dedupMs) {
    return arr
  }
  return [...arr, ev]
}

// 筛选条件：source / action / targetType / targetId / since（时间戳）/ days（最近 N 天）
export function filterEvidence(list, filter = {}, opts = {}) {
  const arr = Array.isArray(list) ? list : []
  const now = opts.now ?? Date.now()
  let out = arr
  if (filter.source) out = out.filter((e) => e.source === filter.source)
  if (filter.action) out = out.filter((e) => e.action === filter.action)
  if (filter.targetType) out = out.filter((e) => e.targetType === filter.targetType)
  if (filter.targetId != null) out = out.filter((e) => e.targetId === filter.targetId)
  if (filter.since != null) out = out.filter((e) => e.timestamp >= filter.since)
  if (filter.days != null) out = out.filter((e) => e.timestamp >= now - filter.days * DAY_MS)
  // 时间升序
  return [...out].sort((a, b) => a.timestamp - b.timestamp)
}

export function getRecentEvidence(list, opts = {}) {
  const days = opts.days ?? 7
  return filterEvidence(list, { days }, opts)
}

export function clearEvidence() {
  return []
}

// ── 汇总（全量 / 近 N 天）────────────────────────────────────
export function summarizeEvidence(list) {
  const arr = Array.isArray(list) ? list : []
  const bySource = {}
  const byAction = {}
  const bySkill = {}
  const errMap = {}
  const tgtMap = {}

  for (const e of arr) {
    bySource[e.source] = (bySource[e.source] || 0) + 1
    byAction[e.action] = (byAction[e.action] || 0) + 1
    if (e.skill) bySkill[e.skill] = (bySkill[e.skill] || 0) + 1
    for (const c of e.errorTypes || []) errMap[c] = (errMap[c] || 0) + 1
    if (e.targetId != null) {
      const k = `${e.targetType}:${e.targetId}`
      tgtMap[k] = tgtMap[k] || { targetType: e.targetType, targetId: e.targetId, count: 0 }
      tgtMap[k].count += 1
    }
  }

  const recentErrors = Object.entries(errMap)
    .map(([code, count]) => ({ code, count }))
    .sort((a, b) => b.count - a.count)
  const repeatedErrors = recentErrors.filter((e) => e.count >= 2)

  const recentTargets = Object.values(tgtMap)
    .sort((a, b) => b.count - a.count)
    .slice(0, 10)

  const skillEntries = Object.entries(bySkill).sort((a, b) => b[1] - a[1])
  const strongestBehaviors = skillEntries.slice(0, 5).map(([skill, count]) => ({ skill, count }))
  // 「薄弱行为」= 关键意识维度里，最近几乎没有被触碰的（证据 / 反例 / 不确定性管理）
  const critical = ['evidence', 'counterexample', 'uncertainty']
  const weakBehaviors = critical
    .filter((s) => !bySkill[s])
    .map((skill) => ({ skill, count: 0 }))

  return {
    totalActions: arr.length,
    workshopActions: bySource.workshop || 0,
    experimentActions: bySource.experiment || 0,
    doubtActions: bySource.doubt || 0,
    hypothesisCount: byAction.hypothesis || 0,
    counterexampleCount: byAction.counterexample || 0,
    evidenceCheckCount: byAction.evidence || 0,
    revisionCount: byAction.revise || 0,
    recentErrors,
    repeatedErrors,
    recentTargets,
    confidencePattern: null,
    uncertaintyPattern: null,
    strongestBehaviors,
    weakBehaviors,
    skillCounts: bySkill,
  }
}

// 近 N 天汇总（默认 7 天）
export function summarizeRecent(list, days = 7, opts = {}) {
  return summarizeEvidence(getRecentEvidence(list, { days, now: opts.now }))
}