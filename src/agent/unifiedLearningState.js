// ============================================================
// R3 Phase 2 · Unified Learning State（统一只读聚合层）
//
// Agent 只读 getLearningState()，不再同时读
// fingerprint / caseAttempts / evidence / errorPatterns 然后自己猜。
// 冲突优先级：Evidence > 旧 fingerprint（caseAttempts 派生）。
// 包含：
//   · 确定性 Evidence→Mastery 规则（门槛 / 封顶 / 防刷 / 递减收益）
//   · view 行为分级（PASSIVE_VIEW / MEANINGFUL_VIEW / ACTIVE_ANALYSIS）
//   · recommendationSignals（供 recommendation 引擎产出 reason code）
// ============================================================

import { summarizeEvidence, getRecentEvidence, filterEvidence } from './learningEvidence'
import { computeMasteryProfile, DIMENSION_KEYS } from './masteryEngine'
import { topErrors } from './errors'
import { analyzeSignals } from '../lib/textSignals'
import {
  BEHAVIOR_LEVELS,
  MASTERY_ACTION_RULES,
  evidenceText,
  behaviorLevelOf,
  targetBehaviorLevel,
  evidenceMasteryContribution,
} from './masteryEvidence'

// R3 Phase 2.5：行为分级 / Evidence→Mastery 规则 / 能力贡献统一收口到
// masteryEvidence.js（唯一能力证据派生层）。此处 re-export 保持既有 import
// 兼容，不再维护第二份拷贝，避免两套系统再分叉。
export {
  BEHAVIOR_LEVELS,
  MASTERY_ACTION_RULES,
  evidenceText,
  behaviorLevelOf,
  targetBehaviorLevel,
  evidenceMasteryContribution,
} from './masteryEvidence'

// 冲突裁决：Evidence 有值时以 Evidence 为准，否则回退旧派生值。
export function preferEvidence(evidenceDerived, fallback) {
  return evidenceDerived !== undefined && evidenceDerived !== null ? evidenceDerived : fallback
}

// ── recommendationSignals（deterministic，全部来自 Evidence + 少量真实状态）──
function computeRecommendationSignals(state, evidence, recentSum) {
  const recent = getRecentEvidence(evidence, { days: 7 })
  const actions = {}
  for (const e of recent) actions[e.action] = (actions[e.action] || 0) + 1
  const constructN = actions.construct || 0
  const analyzeN = (actions.analyze || 0) + (actions.interpret || 0)
  const evidenceN = actions.evidence || 0
  const counterN = actions.counterexample || 0
  const reflectN = actions.reflect || 0

  const signals = {}
  const idsOf = (acts) => recent.filter((e) => acts.includes(e.action)).map((e) => e.id)

  if (constructN >= 3 && evidenceN === 0) {
    signals.WEAK_EVIDENCE = {
      active: true,
      meta: { constructN, evidenceN, confidenceLabel: '高信心但无依据' },
      trace: { evidenceIds: idsOf(['construct']) },
    }
  }

  if ((constructN + analyzeN) >= 2 && counterN === 0) {
    signals.NO_COUNTEREXAMPLE = {
      active: true,
      meta: { constructN, analyzeN, counterN },
      trace: { evidenceIds: idsOf(['construct', 'analyze', 'interpret']) },
    }
  }

  const absClaims = recent.filter((e) => analyzeSignals(evidenceText(e)).absoluteClaims > 0).length
  if (reflectN === 0 && absClaims >= 1) {
    signals.LOW_UNCERTAINTY = {
      active: true,
      meta: { reflectN, absoluteSignalCount: absClaims },
      trace: { evidenceIds: idsOf(['construct', 'analyze', 'interpret', 'hypothesis']) },
    }
  }

  if ((recentSum.repeatedErrors || []).length) {
    // 携带该错误类型的最近 Evidence ID（供推荐理由可追溯）
    const errEvIds = recent
      .filter((e) => Array.isArray(e.errorTypes) && e.errorTypes.length > 0)
      .map((e) => e.id)
    signals.REPEATED_ERROR = {
      active: true,
      meta: { codes: recentSum.repeatedErrors.map((e) => e.code) },
      trace: {
        errorCodes: recentSum.repeatedErrors.map((e) => e.code),
        evidenceIds: errEvIds,
      },
    }
  }

  // 同一对象反复 construct/analyze 却从未 revise → REPEATED_BELIEF
  const targetCounts = {}
  for (const e of recent) {
    if (e.action === 'construct' || e.action === 'analyze' || e.action === 'interpret') {
      const k = `${e.targetType}:${e.targetId}`
      targetCounts[k] = (targetCounts[k] || 0) + 1
    }
  }
  const revised = new Set(recent.filter((e) => e.action === 'revise').map((e) => `${e.targetType}:${e.targetId}`))
  const repeatedBelief = Object.keys(targetCounts).filter((k) => targetCounts[k] >= 3 && !revised.has(k))
  if (repeatedBelief.length) {
    signals.REPEATED_BELIEF = {
      active: true,
      meta: { targets: repeatedBelief },
      trace: { evidenceIds: idsOf(['construct', 'analyze', 'interpret']) },
    }
  }

  const revisions = (state.beliefRevisions || []).slice(-10)
  if (revisions.length) {
    signals.BELIEF_REVISION = {
      active: true,
      meta: { recentRevisions: revisions.length },
      trace: { revisions },
    }
  }

  const targetTypes = {}
  for (const e of recent) targetTypes[e.targetType] = (targetTypes[e.targetType] || 0) + 1
  const structureTouches = (targetTypes.hexagram || 0) + (targetTypes.yao || 0)
  if (structureTouches >= 3 && !targetTypes.tradition) {
    signals.TRADITION_GAP = {
      active: true,
      meta: { structureTouches, traditionTouches: targetTypes.tradition || 0 },
      trace: { evidenceIds: idsOf(['analyze', 'observe', 'construct']) },
    }
  }
  if (structureTouches >= 3 && !targetTypes.classic) {
    signals.UNDERUSED_CLASSIC = {
      active: true,
      meta: { structureTouches, classicTouches: targetTypes.classic || 0 },
      trace: { evidenceIds: idsOf(['analyze', 'observe', 'construct']) },
    }
  }

  const mastery = state.masteryProfile || computeMasteryProfile(state)
  if ((mastery.independence ?? 0) >= 60 && (mastery.synthesis ?? 0) >= 54) {
    signals.READY_FOR_INDEPENDENCE = {
      active: true,
      meta: { independence: mastery.independence, synthesis: mastery.synthesis },
      trace: { masteryKeys: ['independence', 'synthesis'] },
    }
  }

  return signals
}

// ── 主入口：统一只读聚合 ──────────────────────────────────────
export function getLearningState(state, opts = {}) {
  const now = opts.now ?? Date.now()
  const days = opts.days ?? 7
  const evidence = state.evidence || []
  const recent = getRecentEvidence(evidence, { days, now })
  const fullSum = summarizeEvidence(evidence)
  const recentSum = summarizeEvidence(recent)

  const mastery = state.masteryProfile || computeMasteryProfile(state)
  const contribution = evidenceMasteryContribution(evidence, { now })

  const byAction = {}
  const bySource = {}
  for (const e of evidence) {
    byAction[e.action] = (byAction[e.action] || 0) + 1
    bySource[e.source] = (bySource[e.source] || 0) + 1
  }

  const errors = {
    top: topErrors(state.errorPatterns, 5),
    repeated: recentSum.repeatedErrors || [],
    fromEvidence: recentSum.recentErrors || [],
  }

  const runs = state.experimentRuns || []
  const experiments = {
    runs: runs.length,
    completed: runs.filter((r) => r.completedAt != null).length,
    hypotheses: recentSum.hypothesisCount,
    counterexamples: recentSum.counterexampleCount,
    revisions: recentSum.revisionCount,
    beliefRevisions: (state.beliefRevisions || []).slice(-10),
  }

  const doubts = {
    actions: (filterEvidence(evidence, { source: 'doubt' })).length,
    errorCount: evidence.reduce((a, e) => a + ((e.source === 'doubt' ? e.errorTypes : []) || []).length, 0),
  }

  const recentTargets = recentSum.recentTargets || []
  const recentEvidence = [...evidence].sort((a, b) => a.timestamp - b.timestamp).slice(-(opts.recentEvidenceCount ?? 10))

  const criticalDims = ['evidence', 'counterexample', 'uncertainty']
  const strongSkills = []
  const weakSkills = []
  for (const k of DIMENSION_KEYS) {
    const level = mastery[k] ?? 0
    const evScore = contribution[k]?.score ?? 0
    if (level >= 60 || evScore >= 24) {
      strongSkills.push({ key: k, level, evidence: evScore })
    } else if ((level > 0 && level < 48 && evScore < 24) || (level === 0 && criticalDims.includes(k))) {
      weakSkills.push({ key: k, level, evidence: evScore })
    }
  }
  for (const k of criticalDims) {
    if (!contribution[k] && (mastery[k] ?? 0) < 48 && !weakSkills.find((w) => w.key === k)) {
      weakSkills.push({ key: k, level: mastery[k] ?? 0, evidence: 0 })
    }
  }

  const uncertainty = {
    reflectCount: byAction.reflect || 0,
    unknownCount: state.judgmentUnknownUsed ?? 0,
    confidenceCalibration: mastery.confidenceCalibration ?? null,
    absoluteSignalCount: evidence.filter((e) => analyzeSignals(evidenceText(e)).absoluteClaims > 0).length,
  }

  return {
    behavior: { totalActions: evidence.length, byAction, bySource, recentActionCount: recent.length },
    mastery: { profile: mastery, contribution },
    errors,
    experiments,
    doubts,
    recentTargets,
    recentEvidence,
    weakSkills,
    strongSkills,
    uncertainty,
    recommendationSignals: computeRecommendationSignals(state, evidence, recentSum),
  }
}