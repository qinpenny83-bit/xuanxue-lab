// ============================================================
// R3 Phase 2.5 · Mastery Evidence（Evidence → Mastery 的证据层）
//
// 这是「唯一能力事实源」的输入端：Evidence 只作为能力证据来源，
// 最终 8 维 L0–L6 等级仍由 masteryEngine 计算（caseAttempts + Evidence 合并）。
// 本模块不提升等级、不写任何维度值，只产出「带质量权重的维度贡献」。
//
// 原则：
//   · deterministic，禁止随机。
//   · 记录 Evidence ≠ 自动升级：有门槛 / 质量 / 封顶 / 递减 / 防刷。
//   · 会做 ≠ 做过：完整推理闭环（construct/evidence/counterexample/revise）
//     的证据质量高于孤立的 construct 文字。
// ============================================================

import { analyzeSignals } from '../lib/textSignals'

// ── 行为分级：禁止用停留时间，只用「明确行为」───────────────────
export const BEHAVIOR_LEVELS = {
  PASSIVE_VIEW: 'PASSIVE_VIEW',
  MEANINGFUL_VIEW: 'MEANINGFUL_VIEW',
  ACTIVE_ANALYSIS: 'ACTIVE_ANALYSIS',
}

const ACTIVE_ACTIONS = new Set([
  'analyze', 'interpret', 'construct', 'evidence', 'counterexample', 'revise', 'hypothesis', 'compare', 'challenge',
])

// 从单条 Evidence 取用户开放文本（约定存于 context / result.text / metadata.text）
export function evidenceText(ev) {
  if (!ev) return ''
  if (typeof ev.context === 'string') return ev.context
  if (typeof ev.result === 'string') return ev.result
  if (ev.result && typeof ev.result.text === 'string') return ev.result.text
  if (ev.metadata && typeof ev.metadata.text === 'string') return ev.metadata.text
  return ''
}

export function behaviorLevelOf(ev) {
  if (!ev) return BEHAVIOR_LEVELS.PASSIVE_VIEW
  if (ACTIVE_ACTIONS.has(ev.action)) return BEHAVIOR_LEVELS.ACTIVE_ANALYSIS
  if (ev.action === 'observe' || ev.action === 'identify' || ev.action === 'sample' || ev.action === 'inspect') {
    const text = evidenceText(ev)
    const complete = ev.metadata?.complete === true || text.trim().length >= 4
    return complete ? BEHAVIOR_LEVELS.MEANINGFUL_VIEW : BEHAVIOR_LEVELS.PASSIVE_VIEW
  }
  return BEHAVIOR_LEVELS.PASSIVE_VIEW
}

// 某对象（targetType+targetId）的行为等级：取最高
export function targetBehaviorLevel(evidenceList, targetType, targetId) {
  const list = (evidenceList || []).filter((e) => e.targetType === targetType && e.targetId === targetId)
  if (!list.length) return null
  let level = BEHAVIOR_LEVELS.PASSIVE_VIEW
  for (const e of list) {
    const l = behaviorLevelOf(e)
    if (l === BEHAVIOR_LEVELS.ACTIVE_ANALYSIS) return BEHAVIOR_LEVELS.ACTIVE_ANALYSIS
    if (l === BEHAVIOR_LEVELS.MEANINGFUL_VIEW) level = BEHAVIOR_LEVELS.MEANINGFUL_VIEW
  }
  return level
}

// ── 确定性 Evidence → Mastery 规则 ────────────────────────────
// mastery: true 才可能产生能力贡献；requiresStructure 需要结构信号；requiresContent 需要真实内容。
export const MASTERY_ACTION_RULES = {
  view: { dim: null, mastery: false },
  observe: { dim: 'observation', mastery: false }, // 用户明确：observe 不直接加 mastery
  identify: { dim: 'observation', mastery: false },
  sample: { dim: 'observation', mastery: false },
  inspect: { dim: 'observation', mastery: false },
  predict: { dim: 'reasoning', mastery: false },
  analyze: { dim: 'reasoning', mastery: true, requiresStructure: true },
  compare: { dim: 'reasoning', mastery: true, requiresContent: true },
  interpret: { dim: 'reasoning', mastery: true, requiresContent: true },
  hypothesis: { dim: 'reasoning', mastery: true, requiresContent: true },
  construct: { dim: 'synthesis', mastery: true, requiresContent: true },
  evidence: { dim: 'evidence', mastery: true, requiresContent: true },
  counterexample: { dim: 'counterexample', mastery: true, requiresContent: true },
  revise: { dim: 'reasoning', mastery: true, requiresContent: true },
  reflect: { dim: 'uncertainty', mastery: true, requiresContent: true },
  challenge: { dim: 'independence', mastery: true },
  complete: { dim: null, mastery: false },
  retry: { dim: null, mastery: false },
  save: { dim: null, mastery: false },
}

export const MASTERY_CAP = 60 // 单维度贡献封顶：Evidence 只「调节」能力，不「主导」

function hasStructureSignal(text) {
  const sig = analyzeSignals(text)
  return sig.mentionsPosition || sig.mentionsRelation || sig.mentionsText
}

// ── Evidence Quality（确定性规则，无 NLP）──────────────────────
// 依据同一对象的同伴动作（evidence / counterexample / revise）判断「推理闭环完整性」，
// 犯错打折，孤立 construct/analyze 维持基准 1.0。
function targetActionSet(evidenceList) {
  const map = {}
  for (const ev of evidenceList || []) {
    if (ev.targetId == null) continue
    const k = `${ev.targetType}:${ev.targetId}`
    ;(map[k] ||= new Set()).add(ev.action)
  }
  return map
}

// 单条证据的质量权重（0.5 – 1.5 区间，确定性）
export function evidenceQuality(ev, peerActions = new Set()) {
  let q = 1.0
  const has = (a) => peerActions.has(a)
  if (has('evidence') && has('counterexample') && has('revise')) q = 1.5 // 完整推理闭环
  else if (has('evidence') && (has('counterexample') || has('revise'))) q = 1.3 // 部分闭环
  const errs = Array.isArray(ev.errorTypes) ? ev.errorTypes : []
  if (errs.length) q *= 0.5 // 错误惩罚：携带错误的证据，能力贡献减半
  return Math.round(q * 100) / 100
}

export function qualityLabel(q) {
  if (q >= 1.5) return 'high'
  if (q >= 1.3) return 'medium'
  if (q < 1.0) return 'error'
  return 'low'
}

// 为每条「可贡献」Evidence 生成 MasteryEvidence（dimension + weight + quality + reason）
export function deriveMasteryEvidence(evidenceList, opts = {}) {
  const arr = Array.isArray(evidenceList) ? evidenceList : []
  const peers = targetActionSet(arr)
  const out = []
  for (const ev of arr) {
    const rule = MASTERY_ACTION_RULES[ev.action]
    if (!rule || !rule.mastery) continue
    const text = evidenceText(ev).trim()
    if (rule.requiresContent && !text) continue // 最低证据门槛：无内容不加分
    if (rule.requiresStructure && !hasStructureSignal(text)) continue // 结构条件
    const targetKey = ev.targetId != null ? `${ev.targetType}:${ev.targetId}` : `${ev.targetType}:global`
    const q = evidenceQuality(ev, peers[targetKey] || new Set())
    const errCount = (ev.errorTypes || []).length
    const reasons = []
    if (q >= 1.5) reasons.push('完整推理闭环：证据+反例+修正')
    else if (q >= 1.3) reasons.push('含证据与反例/修正')
    if (errCount) reasons.push(`携带 ${errCount} 个错误类型，权重减半`)
    out.push({
      evidenceId: ev.id,
      dimension: rule.dim,
      weight: q,
      quality: qualityLabel(q),
      reason: reasons.length ? reasons.join('；') : null,
      timestamp: ev.timestamp ?? null,
    })
  }
  return out
}

// Evidence → 各维度能力贡献（去重 / 递减 / 封顶）。
// score 由「质量加权后的有效唯一目标数」计算：0.8^weight 递减，封顶 MASTERY_CAP=60。
export function evidenceMasteryContribution(evidenceList, opts = {}) {
  const arr = Array.isArray(evidenceList) ? evidenceList : []
  const peers = targetActionSet(arr)
  const perDim = {}
  const seen = new Set()
  for (const ev of arr) {
    const rule = MASTERY_ACTION_RULES[ev.action]
    if (!rule || !rule.mastery) continue
    const text = evidenceText(ev).trim()
    if (rule.requiresContent && !text) continue
    if (rule.requiresStructure && !hasStructureSignal(text)) continue
    const targetKey = ev.targetId != null ? `${ev.targetType}:${ev.targetId}` : `${ev.targetType}:global`
    const dedupKey = `${rule.dim}|${targetKey}`
    if (seen.has(dedupKey)) continue // 同一对象重复操作不重复计（防刷）
    seen.add(dedupKey)
    const q = evidenceQuality(ev, peers[targetKey] || new Set())
    const d = (perDim[rule.dim] ||= { count: 0, uniqueTargets: 0, weight: 0 })
    d.count += 1
    d.uniqueTargets += 1
    d.weight += q
  }
  const out = {}
  for (const [dim, d] of Object.entries(perDim)) {
    const score = Math.round(MASTERY_CAP * (1 - Math.pow(0.8, d.weight)))
    out[dim] = {
      count: d.count,
      uniqueTargets: d.uniqueTargets,
      weight: Math.round(d.weight * 100) / 100,
      score,
      capped: score >= MASTERY_CAP,
    }
  }
  return out
}

// 有效「能力样本数」：被去重后仍算数的 mastery 目标数（供等级样本门槛使用）。
export function evidenceSampleCount(evidenceList) {
  const arr = Array.isArray(evidenceList) ? evidenceList : []
  const seen = new Set()
  for (const ev of arr) {
    const rule = MASTERY_ACTION_RULES[ev.action]
    if (!rule || !rule.mastery) continue
    const text = evidenceText(ev).trim()
    if (rule.requiresContent && !text) continue
    if (rule.requiresStructure && !hasStructureSignal(text)) continue
    const targetKey = ev.targetId != null ? `${ev.targetType}:${ev.targetId}` : `${ev.targetType}:global`
    seen.add(targetKey)
  }
  return seen.size
}