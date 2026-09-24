// ============================================================
// 出师挑战引擎（V2）——真正的「能力证明」，不是普通考试。
//   1. 进入条件：8 维能力阈值 + 样本量 + 最近表现不持续下降
//   2. 挑战案例：从本地案例池选用户未做过的复杂陌生案例（level 4）
//   3. 评分：能力综合 + 提示依赖 + 信念修正 + 无法判断（不出示「正确答案」）
//   4. 输出：出师能力报告（优势 / 仍存在的问题 / 值得训练的习惯）
// deterministic：所有结论来自真实作答，无随机。
// ============================================================

import { CASES } from '../data/cases'
import { scoreCase } from '../lib/caseScoring'
import { MASTERY_DIMENSIONS, DIMENSION_KEYS, MASTERY_LEVELS, LEVEL_ORDER } from './masteryEngine'

// 出师门槛（能力值，0–100）
export const MASTER_THRESHOLDS = {
  observation: 66,
  structure: 62,
  evidence: 64,
  reasoning: 66,
  counterexample: 60,
  uncertainty: 66,
  synthesis: 66,
  independence: 60,
}

export const MIN_MASTER_SAMPLE = 12

// 是否达到出师条件：返回 { ok, gaps, reason, recentDecline }
export function masterChallengeEligibility(profile, attempts) {
  if (!profile || !profile.sampleCount) {
    return { ok: false, gaps: [], recentDecline: false, reason: '你还没有完成任何案例。先积累一些真实行为记录，再来接受出师挑战。' }
  }
  const gaps = []
  for (const k of DIMENSION_KEYS) {
    const v = profile[k] ?? 0
    if (v < MASTER_THRESHOLDS[k]) {
      const d = MASTERY_DIMENSIONS.find((x) => x.key === k)
      gaps.push({ key: k, label: d.label, value: v, need: MASTER_THRESHOLDS[k] })
    }
  }
  const recentDecline = hasRecentDecline(attempts)
  if (gaps.length === 0 && profile.sampleCount >= MIN_MASTER_SAMPLE && !recentDecline) {
    return {
      ok: true,
      gaps: [],
      recentDecline: false,
      reason: '你的 8 维能力均已达标，样本充足，最近表现稳定。可以出师。',
    }
  }
  const parts = []
  if (profile.sampleCount < MIN_MASTER_SAMPLE) parts.push(`至少需要 ${MIN_MASTER_SAMPLE} 次真实案例样本（当前 ${profile.sampleCount} 次）`)
  if (gaps.length) parts.push(`有 ${gaps.length} 个能力维度未达标：${gaps.map((g) => g.label).join('、')}`)
  if (recentDecline) parts.push('最近 5 次案例出现连续 3 次以上分数下降，先稳定状态')
  return { ok: false, gaps, recentDecline, reason: `还不能出师——${parts.join('；')}。` }
}

// 最近 5 次案例是否持续下降（连续 3 次以上 score 递减）——真实行为检测，无随机
function hasRecentDecline(attempts) {
  const list = (attempts || []).filter((a) => typeof a?.score === 'number')
  if (list.length < 5) return false
  const recent = list.slice(-5)
  let run = 0
  for (let i = 1; i < recent.length; i++) {
    run = recent[i].score < recent[i - 1].score ? run + 1 : 0
    if (run >= 3) return true
  }
  return false
}

// 选挑战案例：优先未完成的高级复杂案例（mode === 'master'），其次 level 4 未完成
export function pickMasterCase(state) {
  const done = state.completedCases || {}
  const masterPool = CASES.filter((c) => c.mode === 'master' && !done[c.id])
  if (masterPool.length) return masterPool[0]
  const complexPool = CASES.filter((c) => c.level === 4 && !done[c.id])
  return complexPool[0] || CASES.filter((c) => c.level === 4)[0] || null
}

// 出师挑战评分：能力综合 + 提示依赖 + 独立性 + 信念修正 + 边界意识
export function scoreMasterChallenge(caseDef, answers = {}) {
  const r = scoreCase(caseDef, answers)
  const hintCount = Math.min(3, Number(answers.hintCount) || 0)
  const consulted = !!answers.consultedKnowledge
  const independence = Math.max(0, Math.min(100, 100 - hintCount * 24 - (consulted ? 12 : 0)))
  const overall = Math.round(r.total * 0.7 + independence * 0.3)

  const report = buildReport(r, independence, answers)
  return {
    ...report,
    dimensions: r.dimensions,
    baseScore: r.total,
    independence,
    overall,
    hintCount,
    consulted,
    beliefRevision: answers.revisionChoice || null,
    usedUnknown: r.usedUnknown || !!answers.usedUnknown,
  }
}

// 生成出师报告（优势 / 问题 / 习惯）——全部来自本次真实作答
function buildReport(r, independence, answers) {
  const d = r.dimensions
  const strongest = Object.entries(d).sort((a, b) => b[1] - a[1])[0]
  const weakest = Object.entries(d).sort((a, b) => a[1] - b[1])[0]

  const strengths = []
  const issues = []
  let habit = ''

  if (strongest[1] >= 70) strengths.push(`${labelOf(strongest[0])}突出（${strongest[1]}），这是你现在最稳的环节。`)
  if ((d.counter ?? 50) >= 70) strengths.push('你能主动寻找反例，而不是只找支持自己的证据。')
  if ((d.boundary ?? 50) >= 70) strengths.push('你清楚知道「什么时候该说不确定」，并敢于表达。')
  if (independence >= 75) strengths.push('全程几乎不需要提示，独立完成了分析。')
  if (!strengths.length) strengths.push('各维度表现均衡，没有明显短板，也还没有特别突出的方向。')

  if (weakest[1] < 60) issues.push(`「${labelOf(weakest[0])}」仍偏弱（${weakest[1]}），是当前报告里最值得回看的地方。`)
  if ((d.counter ?? 50) < 60) issues.push('当两个解释都成立时，你倾向于过早选择其中一个。')
  if (r.confidence != null && r.actualQuality != null && Math.abs(r.confidence - r.actualQuality) >= 20) {
    issues.push(`你的信心（${r.confidence}）与实际判断质量（${r.actualQuality}）有 ${Math.abs(r.confidence - r.actualQuality)} 分落差。`)
  }
  if (independence < 60) issues.push(`你请求了 ${answers.hintCount || 0} 次提示——提示本身不扣「能力」，但它告诉我们你还依赖外部支撑。`)
  if (!issues.length) issues.push('本次没有检测到明显问题。真正的出师不是「没有错误」，而是知道自己的边界在哪里。')

  habit =
    '在形成结论前，先问自己：「如果另一种解释成立，我应该看到什么？」这是从「分析者」走向「研究者」的关键一步。'

  return { strengths, issues, habit, weakest: { key: weakest[0], label: labelOf(weakest[0]), value: weakest[1] } }
}

function labelOf(key) {
  const map = {
    info: '观察能力', rule: '结构理解', reasoning: '推理能力', counter: '反例意识', over: '证据意识', boundary: '不确定性管理',
  }
  return map[key] || key
}

// 出师报告的一句话结论（克制，不夸大）
export function masterVerdict(overall, independence) {
  if (overall >= 80 && independence >= 75) {
    return '你已经达到当前学习体系定义的独立分析阶段：能独立阅读、分析和复盘复杂案例，并清楚表达自己的不确定性。'
  }
  if (overall >= 65) {
    return '你已经具备较强的独立分析能力，但仍有 1–2 个环节会在高压（复杂、陌生、冲突）案例中露出来。'
  }
  return '你完成了挑战，但综合能力还没达到出师线。这不算失败——它精确告诉了你差在哪。'
}

// 出师后的阶段名：从 L6 继续
export function nextStageAfterMaster(overall) {
  if (overall >= 85) return '下一阶段：研究——把训练过的框架带进自己的真实判断，记录、验证、复盘。'
  if (overall >= 75) return '下一阶段：研究——先回看本次报告的「仍存在的问题」，用 2–3 个反事实案例补上，再进入研究。'
  return '下一阶段：巩固——回到瓶颈维度对应的训练，用真实行为把缺口补上，再重新挑战。'
}
