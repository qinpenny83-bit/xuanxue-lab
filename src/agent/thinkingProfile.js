// ============================================================
// 玄学思维画像：观察力 / 综合判断 / 证据意识 / 反例意识 / 自我纠错 / 信心校准
// 全部由已记录的行为规则化合成，0–100，可解释。
// ============================================================

const PROFILE_DIMS = [
  { key: 'observation', label: '观察力', desc: '能否分清证据与背景、抓到关键信息。' },
  { key: 'integration', label: '综合判断', desc: '能否把多个信息综合成一个结论。' },
  { key: 'evidence', label: '证据意识', desc: '能否克制「看着像就下结论」。' },
  { key: 'counter', label: '反例意识', desc: '能否主动想「反过来会怎样」。' },
  { key: 'selfCorrection', label: '自我纠错', desc: '遇到反馈后能否修正自己的判断。' },
  { key: 'calibration', label: '信心校准', desc: '信心是否接近实际判断质量。' },
]

function caseDimAvg(state, key) {
  const dims = Object.values(state.completedCases || {})
    .map((c) => c.dimensions && c.dimensions[key])
    .filter((v) => typeof v === 'number')
  if (!dims.length) return 0
  return Math.round(dims.reduce((a, b) => a + b, 0) / dims.length)
}

function errorPenalty(state, codes) {
  let p = 0
  codes.forEach((c) => {
    p += (state.errorPatterns && state.errorPatterns[c]) || 0
  })
  return Math.min(40, p * 12)
}

function calibrationScore(state) {
  const hist = state.confidenceHistory || []
  if (hist.length < 2) return 0
  const good = hist.filter((h) => Math.abs((h.confidence || 0) - (h.actual || 0)) <= 20).length
  return Math.round((good / hist.length) * 100)
}

export function thinkingProfile(state) {
  const mastery = state.mastery || {}
  const selfExpl = (state.selfExplanations || []).length

  // 观察力：案例「找信息」维度 + 基础节点掌握
  const info = caseDimAvg(state, 'info')
  const observeNodes = ['heavenly-stems', 'earthly-branches', 'bagua']
  const observeMastery = observeNodes.map((id) => mastery[id] || 0).reduce((a, b) => a + b, 0) / 18 * 100
  const observation = info > 0 ? Math.round(info * 0.6 + observeMastery * 0.4) : Math.round(observeMastery)

  // 综合判断：案例「推理完整度」维度
  const reasoning = caseDimAvg(state, 'reasoning')
  const integration = reasoning > 0 ? reasoning : Math.round((mastery['ten-gods'] || 0) / 6 * 100)

  // 证据意识：反比 E01/E06/E08，正向参考「避免过度推断」维度
  const over = caseDimAvg(state, 'over')
  const evidence = Math.max(0, 100 - errorPenalty(state, ['E01', 'E06', 'E08']) - (over > 0 ? 0 : 10) + (over > 0 ? Math.round(over * 0.1) : 0))

  // 反例意识：案例「考虑反例」维度 + 主动提反例次数
  const counterDim = caseDimAvg(state, 'counter')
  const counterAwards = state.counterAwards || 0
  const counter = Math.min(100, Math.round((counterDim > 0 ? counterDim * 0.7 : 30) + counterAwards * 10))

  // 自我纠错：自我解释 + 主动反例 + 连续正确
  const selfCorrection = Math.min(100, selfExpl * 12 + counterAwards * 8 + Math.min(20, (state.consecutiveCorrect || 0) * 2))

  // 信心校准
  const calib = calibrationScore(state)

  return {
    dims: PROFILE_DIMS,
    values: {
      observation,
      integration,
      evidence,
      counter,
      selfCorrection,
      calibration: calib,
    },
    calibrationReady: (state.confidenceHistory || []).length >= 2,
  }
}

export function profileHighlights(profile) {
  const vals = profile.values
  const entries = Object.entries(vals).map(([k, v]) => ({ key: k, label: PROFILE_DIMS.find((d) => d.key === k)?.label || k, value: v }))
  const sorted = [...entries].sort((a, b) => b.value - a.value)

  // 进步最快 = 高分且最近有提升的趋势（简化：取最高维度）
  const best = sorted[0]
  // 问题 = 最低维度（低于 50 才算「问题」）
  const worst = sorted[sorted.length - 1]

  return {
    best: { label: best.label, value: best.value },
    issue: worst.value < 60 ? { label: worst.label, value: worst.value } : null,
  }
}

export function profileNextStep(profile) {
  const h = profileHighlights(profile)
  if (h.issue) {
    const hints = {
      observation: '去「观察类」案例里练习分证据 vs 背景。',
      integration: '找一个多线索案例，练习「先列、再合」。',
      evidence: '每次下结论前，逼自己列出一条反对证据。',
      counter: '完成一个反例挑战，习惯性问「反过来会怎样」。',
      selfCorrection: '多做几次自我解释，写下来再对照反馈。',
      calibration: '完成带信心评分的案例，练习「该说不确定时说不确定」。',
    }
    return { title: `针对性练「${h.issue.label}」`, why: hints[h.issue.key] || '针对薄弱维度做一轮定向训练。' }
  }
  return { title: '挑战更高难度案例', why: '各项能力比较均衡，可以尝试更难的多层推理。' }
}