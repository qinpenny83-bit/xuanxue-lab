// ============================================================
// 学徒能力引擎（V2）——「能力等级」而不是「XP 等级」。
// 从真实案例行为计算 8 个能力维度 + 学徒等级 L0–L6。
// deterministic：只用 caseAttempts / confidenceHistory，无随机。
// 核心原则：
//   1. 正确回答 ≠ 自动升级（过程权重 > 结果权重）
//   2. 高提示依赖 ≠ 高独立性
//   3. 高难度 / 陌生案例权重更高
//   4. 时间衰减：最近行为权重高于远期
//   5. 样本不足不乱判等级
// ============================================================

import { evidenceMasteryContribution, evidenceSampleCount } from './masteryEvidence'

export const MASTERY_DIMENSIONS = [
  { key: 'observation', label: '观察能力', desc: '从案例中识别并提取关键信息' },
  { key: 'structure', label: '结构理解', desc: '理解概念与框架之间的关系' },
  { key: 'evidence', label: '证据意识', desc: '判断证据是否足够支持结论' },
  { key: 'reasoning', label: '推理能力', desc: '从线索到结论的完整推理链' },
  { key: 'counterexample', label: '反例意识', desc: '主动寻找可能推翻自己的证据' },
  { key: 'uncertainty', label: '不确定性管理', desc: '知道何时该说「无法判断」' },
  { key: 'synthesis', label: '综合分析', desc: '整合多变量、比较不同解释' },
  { key: 'independence', label: '独立分析', desc: '无需提示独立完成分析' },
]

export const DIMENSION_KEYS = MASTERY_DIMENSIONS.map((d) => d.key)

export const MASTERY_LEVELS = {
  L0: { key: 'L0', name: '观察者', emoji: '🌱', desc: '能认识基本术语，需要大量提示，容易直接接受结论。' },
  L1: { key: 'L1', name: '入门者', emoji: '🔍', desc: '能识别基本结构，能完成单变量问题，仍需要选择题或提示。' },
  L2: { key: 'L2', name: '练习者', emoji: '🛠️', desc: '能完成基础案例，开始主动寻找证据，能识别部分反例。' },
  L3: { key: 'L3', name: '分析者', emoji: '🧭', desc: '能独立完成普通案例，能说明判断依据，开始控制过度解释。' },
  L4: { key: 'L4', name: '综合分析者', emoji: '⚖️', desc: '能处理多个变量与冲突信息，能比较不同解释，主动寻找反例。' },
  L5: { key: 'L5', name: '独立研究者', emoji: '🧪', desc: '面对陌生案例无需提示，能建立自己的分析路径并解释依据。' },
  L6: { key: 'L6', name: '出师', emoji: '🎓', desc: '能独立完成复杂陌生案例，识别自身认知偏差，清楚表达「不知道」。' },
}

// 等级顺序（用于「还差几级」判断）
export const LEVEL_ORDER = ['L0', 'L1', 'L2', 'L3', 'L4', 'L5', 'L6']

function decayWeights(n) {
  if (n <= 0) return []
  const base = Array.from({ length: n }, (_, i) => i + 1)
  const total = base.reduce((a, b) => a + b, 0)
  return base.map((v) => v / total)
}

function weightedAvg(values, weights) {
  const pairs = values.map((v, i) => [v, weights[i]]).filter(([v]) => typeof v === 'number' && Number.isFinite(v))
  if (!pairs.length) return null
  const wSum = pairs.reduce((a, [, w]) => a + w, 0)
  if (!wSum) return null
  return pairs.reduce((a, [v, w]) => a + v * w, 0) / wSum
}

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n))
}

function round(n) {
  return Math.round(n)
}

// 信心校准分（0–100）：误差越小越高
function calibrationScore(history) {
  const list = (history || []).filter(
    (h) => typeof h.confidence === 'number' && typeof h.actual === 'number',
  )
  if (!list.length) return null
  const avgErr = list.reduce((a, h) => a + Math.abs(h.confidence - h.actual), 0) / list.length
  return round(clamp(100 - avgErr, 0, 100))
}

// 信念修正倾向：从每个案例的 revision 选择聚合
function beliefRevisionOf(attempts) {
  const revs = attempts.filter((a) => a.beliefRevision)
  if (revs.length < 2) return null
  const flex = revs.filter((a) => a.beliefRevision === 'revise').length
  const rigid = revs.filter((a) => a.beliefRevision === 'keep').length
  const unsure = revs.filter((a) => a.beliefRevision === 'unsure').length
  if (flex / revs.length >= 0.6) return { key: 'flexible', label: '灵活修正', desc: '出现新信息时，你愿意调整原来的判断。', count: revs.length }
  if (rigid / revs.length >= 0.6) return { key: 'rigid', label: '坚持己见', desc: '出现新信息时，你倾向于维持原判断。', count: revs.length }
  if (unsure / revs.length >= 0.6) return { key: 'hesitant', label: '条件性修正', desc: '新信息出现时你大多不确定，需要看具体内容。', count: revs.length }
  return { key: 'balanced', label: '条件性修正', desc: '你会根据信息的具体内容决定是否调整判断。', count: revs.length }
}

// 8 维中最低的一维 = 当前瓶颈（independence 不参与瓶颈判定，它更像「阶段」而非「短板」）
function bottleneckOf(v) {
  const entries = DIMENSION_KEYS.filter((k) => k !== 'independence').map((k) => ({ key: k, value: v[k] }))
  entries.sort((a, b) => a.value - b.value)
  const top = entries[0]
  const d = MASTERY_DIMENSIONS.find((x) => x.key === top.key)
  return { key: top.key, label: d.label, value: top.value, desc: d.desc }
}

// 等级判定：能力值 + 样本量双重门控（不靠做题数量升级，但样本不足也不乱判）
export function levelFromValues(v, sampleCount) {
  const avg8 =
    (v.observation + v.structure + v.evidence + v.reasoning + v.counterexample + v.uncertainty + v.synthesis + v.independence) / 8
  if (sampleCount >= 10 && v.independence >= 70 && v.uncertainty >= 70 && v.synthesis >= 72 && v.counterexample >= 64 && v.evidence >= 64 && avg8 >= 72) {
    return MASTERY_LEVELS.L6
  }
  if (sampleCount >= 8 && v.independence >= 60 && v.synthesis >= 62 && v.counterexample >= 56 && v.uncertainty >= 62 && avg8 >= 64) {
    return MASTERY_LEVELS.L5
  }
  if (sampleCount >= 6 && v.synthesis >= 54 && v.uncertainty >= 54 && v.counterexample >= 50 && v.evidence >= 52 && avg8 >= 56) {
    return MASTERY_LEVELS.L4
  }
  if (sampleCount >= 4 && v.evidence >= 48 && v.uncertainty >= 46 && v.reasoning >= 48 && avg8 >= 48) {
    return MASTERY_LEVELS.L3
  }
  if (sampleCount >= 3 && v.observation >= 42 && v.structure >= 40 && avg8 >= 40) {
    return MASTERY_LEVELS.L2
  }
  if (sampleCount >= 1 && avg8 >= 20) return MASTERY_LEVELS.L1
  return MASTERY_LEVELS.L0
}

// 主入口：state → masteryProfile（唯一能力事实源）。
// R3 Phase 2.5：caseAttempts（权威来源）+ LearningEvidence（托底调节）合并输出 8 维 L0–L6。
// Evidence 通过 deriveMasteryEvidence → evidenceMasteryContribution 折算为维度贡献（封顶 60），
// 与案例派生值取 max——Evidence 只「调节」，不「主导」。
export function computeMasteryProfile(state) {
  const attempts = (state.caseAttempts || []).slice(-12)
  const evidence = state.evidence || []
  const contribution = evidenceMasteryContribution(evidence)
  const evSample = evidenceSampleCount(evidence)
  const n = attempts.length
  const totalSample = n + evSample

  const empty = {
    observation: 0, structure: 0, evidence: 0, reasoning: 0,
    counterexample: 0, uncertainty: 0, synthesis: 0, independence: 0,
    level: 'L0', levelName: MASTERY_LEVELS.L0.name, levelEmoji: MASTERY_LEVELS.L0.emoji, levelDesc: MASTERY_LEVELS.L0.desc,
    sampleCount: 0, ready: false,
    hintDependency: 0, consultedKnowledgeRate: 0,
    beliefRevision: null, confidenceCalibration: null,
    unfamiliarCasePerformance: null,
    bottleneck: null, overall: 0,
    lastUpdated: null,
  }
  if (totalSample === 0) return empty

  // 1) caseAttempts 派生 8 维（无案例时保持 0，交由 Evidence 托底）
  let caseValues = { observation: 0, structure: 0, evidence: 0, reasoning: 0, counterexample: 0, uncertainty: 0, synthesis: 0, independence: 0 }
  let depAvg = 0
  let consultedRate = 0
  let indepScore = null

  if (n > 0) {
    const w = decayWeights(n)
    const dim = (key) => attempts.map((a) => a.dimensions?.[key])

    const info = weightedAvg(dim('info'), w) ?? 0
    const rule = weightedAvg(dim('rule'), w) ?? 0
    const reasoningRaw = weightedAvg(dim('reasoning'), w) ?? 0
    const counterRaw = weightedAvg(dim('counter'), w) ?? 0
    const over = weightedAvg(dim('over'), w) ?? 0
    const boundary = weightedAvg(dim('boundary'), w) ?? 0

    // 8 维映射（全部来自真实维度分）
    const observation = round(info)
    const structure = round(rule)
    const evidenceScore = round((over + info) / 2)
    const reasoning = round(reasoningRaw)
    const counterexample = round(counterRaw)
    const unknownRate = attempts.filter((a) => a.usedUnknown).length / n
    const uncertainty = round(boundary * 0.85 + unknownRate * 100 * 0.15)

    // 综合分析：复杂案例（level>=3）表现为主 + 双解释案例加分
    const complex = attempts.filter((a) => (a.level || 0) >= 3)
    const complexScore = complex.length ? complex.reduce((x, a) => x + a.score, 0) / complex.length : (reasoning + evidenceScore) / 2
    const dualGood = attempts.filter((a) => a.dualQuality === 'good').length
    const synthesis = round(complexScore * 0.85 + Math.min(100, dualGood * 12) * 0.15)

    // 独立分析：提示依赖逆向 + 独立模式案例表现
    depAvg = weightedAvg(attempts.map((a) => (typeof a.hintDependency === 'number' ? a.hintDependency : 0)), w) ?? 0
    consultedRate = attempts.filter((a) => a.consultedKnowledge).length / n
    const indepMode = attempts.filter((a) => a.mode === 'independent' || a.mode === 'master')
    indepScore = indepMode.length ? indepMode.reduce((x, a) => x + a.score, 0) / indepMode.length : null
    const independence = round(clamp(100 - depAvg * 1.25 - consultedRate * 25 + ((indepScore ?? 50) - 50) * 0.3, 0, 100))

    caseValues = { observation, structure, evidence: evidenceScore, reasoning, counterexample, uncertainty, synthesis, independence }
  }

  // 2) Evidence 合并：Evidence 值封顶 60，只托底调节，不与案例权威争主导。
  const values = {}
  for (const k of DIMENSION_KEYS) {
    values[k] = Math.max(caseValues[k] ?? 0, contribution[k]?.score ?? 0)
  }

  const level = levelFromValues(values, totalSample)
  const overall = round(DIMENSION_KEYS.reduce((a, k) => a + values[k], 0) / 8)

  return {
    ...values,
    level: level.key,
    levelName: level.name,
    levelEmoji: level.emoji,
    levelDesc: level.desc,
    sampleCount: totalSample,
    ready: totalSample >= 3,
    hintDependency: round(depAvg),
    consultedKnowledgeRate: Math.round(consultedRate * 100),
    beliefRevision: n > 0 ? beliefRevisionOf(attempts) : null,
    confidenceCalibration: calibrationScore(state.confidenceHistory),
    unfamiliarCasePerformance: indepScore != null ? round(indepScore) : null,
    bottleneck: bottleneckOf(values),
    overall,
    lastUpdated: n > 0 ? attempts[n - 1]?.at : null,
  }
}

// 下一个等级与差距说明（用于「我为什么还不能升级」）
export function nextLevelGap(profile) {
  if (!profile || profile.sampleCount === 0) {
    return { next: 'L1', gaps: [], sampleNote: '先完成至少 1 次案例，才能开始评估。' }
  }
  const cur = LEVEL_ORDER.indexOf(profile.level)
  if (cur >= LEVEL_ORDER.length - 1) return { next: null, gaps: [], sampleNote: '你已经达到当前体系最高阶段。' }
  const nextKey = LEVEL_ORDER[cur + 1]
  const next = MASTERY_LEVELS[nextKey]

  // 模拟「升到下一级」需要的能力门槛（与 levelFromValues 对齐的近似门槛）
  const NEED = {
    L1: { observation: 20, overall: 20 },
    L2: { observation: 42, structure: 40, overall: 40 },
    L3: { evidence: 48, uncertainty: 46, reasoning: 48, overall: 48 },
    L4: { synthesis: 54, uncertainty: 54, counterexample: 50, evidence: 52, overall: 56 },
    L5: { independence: 60, synthesis: 62, counterexample: 56, uncertainty: 62, overall: 64 },
    L6: { independence: 70, uncertainty: 70, synthesis: 72, counterexample: 64, evidence: 64, overall: 72 },
  }[nextKey] || {}
  const minSample = { L1: 1, L2: 3, L3: 4, L4: 6, L5: 8, L6: 10 }[nextKey] || 1

  const gaps = Object.entries(NEED)
    .map(([key, need]) => ({ key, need, value: profile[key] ?? 0 }))
    .filter((g) => g.value < g.need)

  const sampleShort = profile.sampleCount < minSample
  return {
    next: nextKey,
    nextName: `${next.emoji} ${next.name}`,
    gaps,
    minSample,
    sampleShort,
    sampleNote: sampleShort
      ? `进入 ${next.name} 至少需要 ${minSample} 次真实案例样本（当前 ${profile.sampleCount} 次）。`
      : null,
  }
}

// ============================================================
// V2：「Agent 对你的判断」—— 用真实行为变化描述成长。
// 比较「更早一段」与「最近一段」的真实维度分，只报告显著变化。
// deterministic：全部来自 caseAttempts，无随机、无伪造。
// ============================================================
export function agentJudgment(attempts) {
  const list = (attempts || []).filter((a) => a && typeof a === 'object')
  const n = list.length
  if (n < 4) return null

  // 前后两段切分：至少 4 样本就能对比（前一半 vs 后一半，最近段最多取 6 个）
  const half = Math.max(1, Math.floor(n / 2))
  const recentLen = Math.min(6, half)
  const recent = list.slice(-recentLen)
  const older = list.slice(0, n - recentLen)
  const avg = (arr, key) => {
    const vals = arr.map((a) => a.dimensions?.[key]).filter((v) => typeof v === 'number')
    return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null
  }
  const avgRaw = (arr, key) => {
    const vals = arr.map((a) => a[key]).filter((v) => typeof v === 'number')
    return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null
  }
  const r = (v) => (v == null ? null : Math.round(v))

  const items = []
  const push = (icon, text) => items.push({ icon, text })

  const counterOld = avg(older, 'counter')
  const counterNew = avg(recent, 'counter')
  if (counterOld != null && counterNew != null) {
    if (counterNew - counterOld >= 12) push('⚖️', `以前你常常直接下结论，最近 ${recent.length} 次案例里你开始主动寻找反例（反例意识 ${r(counterOld)} → ${r(counterNew)}）。`)
    else if (counterOld - counterNew >= 12) push('⚠️', `最近你的反例意识在下降（${r(counterOld)} → ${r(counterNew)}）——小心又回到「只找支持自己的证据」。`)
  }

  const boundaryOld = avg(older, 'boundary')
  const boundaryNew = avg(recent, 'boundary')
  if (boundaryOld != null && boundaryNew != null && boundaryNew - boundaryOld >= 12) {
    push('🚦', `你开始主动表达「不确定」——判断边界意识在提升（${r(boundaryOld)} → ${r(boundaryNew)}）。`)
  }

  const overOld = avg(older, 'over')
  const overNew = avg(recent, 'over')
  if (overOld != null && overNew != null) {
    if (overNew - overOld >= 12) push('🔎', `过去你容易在证据不足时下结论，现在开始先找证据（证据克制 ${r(overOld)} → ${r(overNew)}）。`)
    else if (overOld - overNew >= 12) push('⚠️', `最近你的结论越来越冒险——证据克制在下降（${r(overOld)} → ${r(overNew)}），先回到「证据足够再下结论」。`)
  }

  const depOld = avgRaw(older, 'hintDependency')
  const depNew = avgRaw(recent, 'hintDependency')
  if (depOld != null && depNew != null && depOld - depNew >= 10) {
    push('🧗', `你请求提示的次数在减少（提示依赖 ${r(depOld)} → ${r(depNew)}）——你在变得更独立。`)
  }

  const unknownOld = older.filter((a) => a.usedUnknown).length / older.length
  const unknownNew = recent.filter((a) => a.usedUnknown).length / recent.length
  if (unknownNew - unknownOld >= 0.4) push('🚦', `最近你更敢说「我目前无法判断」了——这是判断边界意识，不是不会。`)

  if (!items.length) return null
  return { items, total: n, recent: recent.length }
}
