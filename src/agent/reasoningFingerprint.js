// ============================================================
// 个人推理指纹引擎（V1.6）—— deterministic，无随机。
// 输入：每次案例的完整推理记录（caseAttempts）+ 错误事件 + 信心历史。
// 输出：主要倾向 / 次要倾向 / 优势 / 盲点 / 信心校准 / 趋势 / 行为证据。
// 规则：
//   1. 数据不足（< 3 次案例）时不乱判定；
//   2. 最近行为权重高于远期（时间衰减加权）；
//   3. 每个倾向必须能被行为数据解释（evidence 字段）。
// ============================================================

export const FINGERPRINT_PATTERNS = {
  quickConclusion: {
    key: 'quickConclusion',
    label: '快速下结论型',
    emoji: '⚡',
    desc: '你判断速度很快，但容易在证据不足时直接形成结论。',
    sign: '信心明显高于实际判断质量，且「一个信息→一个结论」的错误出现较多。',
  },
  observer: {
    key: 'observer',
    label: '观察型',
    emoji: '🔎',
    desc: '你很擅长从案例中发现信息，但容易在证据还不充分时提前形成解释。',
    sign: '找信息能力突出，但「避免过度推断」相对偏弱——会看，但容易看一点就下结论。',
  },
  cautious: {
    key: 'cautious',
    label: '谨慎型',
    emoji: '🛡',
    desc: '你很少过度推断，但有时会因为过度谨慎而错过已有证据。',
    sign: '实际判断质量高于你的信心，说明你其实会，只是不够相信自己。',
  },
  counterSensitive: {
    key: 'counterSensitive',
    label: '反例敏感型',
    emoji: '⚖️',
    desc: '你能够主动寻找反例，遇到冲突信息时会重新检查自己的判断。',
    sign: '「考虑反例」维度突出，且较少出现「只找支持自己的证据」。',
  },
  balanced: {
    key: 'balanced',
    label: '均衡成熟型',
    emoji: '🧭',
    desc: '各维度比较均衡，没有明显的单一弱点。',
    sign: '最近案例各维度得分稳定，错误类型分散、无高频模式。',
  },
}

// 加权平均：weights 与 values 一一对应，权重越大影响越大
function weightedAvg(values, weights) {
  const pairs = values.map((v, i) => [v, weights[i]]).filter(([v]) => typeof v === 'number' && Number.isFinite(v))
  if (!pairs.length) return null
  const wSum = pairs.reduce((a, [, w]) => a + w, 0)
  if (!wSum) return null
  return pairs.reduce((a, [v, w]) => a + v * w, 0) / wSum
}

function sum(arr) {
  return arr.reduce((a, b) => a + b, 0)
}

// 时间衰减权重：最近的样本权重最高（线性递增）
function decayWeights(n) {
  if (n <= 0) return []
  const base = Array.from({ length: n }, (_, i) => i + 1)
  const total = sum(base)
  return base.map((v) => v / total)
}

// 统计最近 attempts 中各类错误的加权计数
function weightedErrorCounts(attempts, weights) {
  const counts = {}
  attempts.forEach((a, i) => {
    ;(a.errorTypes || []).forEach((code) => {
      counts[code] = (counts[code] || 0) + weights[i]
    })
  })
  return counts
}

export function reasoningFingerprint(state) {
  const attempts = (state.caseAttempts || []).slice(-8) // 只取最近 8 次，保证「最近行为权重高」
  const stage = stageOf(attempts.length)

  if (attempts.length < 3) {
    return {
      ready: false,
      sampleCount: attempts.length,
      stage,
      primaryPattern: null,
      secondaryPatterns: [],
      strengths: [],
      blindSpots: [],
      confidenceCalibration: calibrationOf(state),
      trend: { direction: 'stable', desc: stage.key === 'hint' ? '我已经开始看到一些迹象，但样本还太少，先不急着给你贴标签。' : '先让我看看你会怎么判断。' },
      evidence: null,
      unknownAnalysis: unknownAnalysisOf(attempts),
      why: stage.key === 'hint'
        ? `当前样本只有 ${attempts.length} 次。要形成可靠的推理倾向，至少需要 3 个案例样本——我暂时不会判断你的主要推理倾向。`
        : '先完成一次案件，让我看看你会怎么判断。',
    }
  }

  const n = attempts.length
  const w = decayWeights(n) // 线性时间衰减：越近权重越大

  const dims = (key) => attempts.map((a) => a.dimensions?.[key])
  const infoAvg = weightedAvg(dims('info'), w)
  const reasoningAvg = weightedAvg(dims('reasoning'), w)
  const counterAvg = weightedAvg(dims('counter'), w)
  const overAvg = weightedAvg(dims('over'), w)
  const boundaryAvg = weightedAvg(dims('boundary'), w)

  const errW = weightedErrorCounts(attempts, w)

  // 信心 vs 实际质量：只统计带信心的样本
  const diffPairs = attempts
    .map((a) => [a.confidence, a.actualQuality])
    .filter(([c, q]) => typeof c === 'number' && typeof q === 'number')
  let diffAvg = null
  if (diffPairs.length >= 2) {
    const diffs = diffPairs.map(([c, q]) => c - q)
    const dw = decayWeights(diffs.length)
    diffAvg = weightedAvg(diffs, dw)
  }
  const confAvg = weightedAvg(attempts.map((a) => a.confidence), w)

  const score = {
    quickConclusion:
      (errW.E01 || 0) * 24 + (errW.E08 || 0) * 16 + Math.max(0, 55 - (overAvg ?? 55)) * 0.4 + Math.max(0, (diffAvg ?? 0) - 12) * 0.7,
    observer: (infoAvg ?? 40) * 0.5 + Math.max(0, 60 - (overAvg ?? 60)) * 0.5 + Math.max(0, (reasoningAvg ?? 50) - (infoAvg ?? 50)) * -0.3,
    cautious: Math.max(0, -(diffAvg ?? 0) - 10) * 0.8 + Math.max(0, (boundaryAvg ?? 50) - 70) * 0.3,
    counterSensitive: (counterAvg ?? 40) * 0.55 + Math.min(30, (state.counterAwards || 0) * 12) + Math.max(0, 16 - (errW.E07 || 0)) * 1.2,
  }

  // 主倾向：最高分；低于阈值视为「均衡」
  const ranked = Object.entries(score).sort((a, b) => b[1] - a[1])
  const top = ranked[0]
  const second = ranked[1]
  const MIN_PRIMARY = 22
  const MIN_SECONDARY = 14

  const primaryKey = top[1] >= MIN_PRIMARY ? top[0] : 'balanced'
  const primaryPattern = FINGERPRINT_PATTERNS[primaryKey]
  const secondaryPatterns = []
  if (primaryKey !== 'balanced' && second[1] >= MIN_SECONDARY) {
    secondaryPatterns.push({ key: second[0], ...FINGERPRINT_PATTERNS[second[0]] })
  }

  // 优势 / 盲点（取最近加权维度均值）
  const dimEntries = [
    { key: 'info', label: '找信息', value: infoAvg },
    { key: 'reasoning', label: '综合判断', value: reasoningAvg },
    { key: 'counter', label: '反例意识', value: counterAvg },
    { key: 'over', label: '证据克制', value: overAvg },
    { key: 'boundary', label: '判断边界', value: boundaryAvg },
  ].filter((d) => typeof d.value === 'number')
  const strengths = dimEntries.filter((d) => d.value >= 65).map((d) => ({ ...d, value: Math.round(d.value) }))
  const blindSpots = dimEntries.filter((d) => d.value < 50).map((d) => ({ ...d, value: Math.round(d.value) }))

  // 趋势：后一半 vs 前一半（over + counter + boundary 的合成）
  const half = Math.max(1, Math.floor(n / 2))
  const front = attempts.slice(0, n - half)
  const back = attempts.slice(n - half)
  const synth = (list) => {
    const vals = list.map((a) => {
      const d = a.dimensions || {}
      return ((d.over ?? 50) + (d.counter ?? 50) + (d.boundary ?? 50)) / 3
    })
    return vals.length ? vals.reduce((x, y) => x + y, 0) / vals.length : 50
  }
  const delta = synth(back) - synth(front)
  let direction = 'stable'
  let desc = '最近一段时间你的推理质量保持稳定。'
  if (delta >= 5) {
    direction = 'improving'
    desc = `最近 ${half} 次案例的整体推理质量比之前提升了约 ${Math.round(delta)} 分——你在进步。`
  } else if (delta <= -5) {
    direction = 'declining'
    desc = `最近 ${half} 次案例的整体推理质量比之前下降了约 ${Math.round(-delta)} 分——值得停下来复盘。`
  }

  const evidence = {
    caseCount: attempts.length,
    errorTop: topErrorOf(errW),
    infoAvg: infoAvg == null ? null : Math.round(infoAvg),
    overAvg: overAvg == null ? null : Math.round(overAvg),
    counterAvg: counterAvg == null ? null : Math.round(counterAvg),
    boundaryAvg: boundaryAvg == null ? null : Math.round(boundaryAvg),
    confAvg: confAvg == null ? null : Math.round(confAvg),
    diffAvg: diffAvg == null ? null : Math.round(diffAvg),
    diffPairs: diffPairs.length,
  }

  return {
    ready: true,
    sampleCount: attempts.length,
    stage,
    primaryPattern,
    secondaryPatterns,
    strengths: strengths.slice(0, 3),
    blindSpots: blindSpots.slice(0, 3),
    confidenceCalibration: calibrationOf(state),
    trend: { direction, desc },
    evidence,
    unknownAnalysis: unknownAnalysisOf(attempts),
    why: patternWhy(primaryKey, evidence),
  }
}

// V1.6.1：三阶段——先观察、再发现迹象、最后才下判断
function stageOf(n) {
  if (n <= 0) {
    return { key: 'seed', emoji: '🌱', title: '我还不了解你的推理习惯', desc: '先让我看看你会怎么判断。今天没有画像，也没有标签——先做一道案件。' }
  }
  if (n < 3) {
    return { key: 'hint', emoji: '👀', title: '我开始发现一些迹象', desc: '我注意到你在判断时似乎有一些习惯，但现在样本还太少。我先不急着给你贴标签。' }
  }
  return { key: 'ready', emoji: '🧠', title: '我现在可以告诉你一个发现', desc: '基于你最近的真实行为，这是你当前的推理状态——它会随你的行为而变。' }
}

// V1.6.1：「目前无法判断」的行为统计——进入推理画像
function unknownAnalysisOf(attempts) {
  const unks = attempts.filter((a) => a.usedUnknown)
  if (!unks.length) {
    return { total: 0, byReason: {}, note: null }
  }
  const byReason = {}
  unks.forEach((a) => {
    const r = a.unknownReason || 'other'
    byReason[r] = (byReason[r] || 0) + 1
  })
  const missing = byReason['missing-evidence'] || 0
  const knowledge = byReason['knowledge'] || 0
  let note = null
  if (missing >= 2 && missing >= unks.length / 2) {
    note = `你最近 ${unks.length} 次选择「无法判断」都提到缺少关键证据——判断边界意识在形成，这是好迹象。`
  } else if (knowledge >= 2 && knowledge >= unks.length / 2) {
    note = `你多次因为「我还没学会相关知识」选择不判断——也许不是判断力的问题，而是对知识的信心不足。`
  }
  return { total: unks.length, byReason, note }
}

function calibrationOf(state) {
  const hist = state.confidenceHistory || []
  if (hist.length < 2) return { ready: false, verdict: '样本不足', ratio: null, samples: hist.length }
  const diffs = hist.map((h) => Math.abs((h.confidence || 0) - (h.actual || 0)))
  const good = diffs.filter((d) => d <= 20).length
  const ratio = Math.round((good / diffs.length) * 100)
  if (ratio >= 70) return { ready: true, verdict: '校准良好', ratio, samples: hist.length }
  const avgDiff = diffs.reduce((a, b) => a + b, 0) / diffs.length
  if (avgDiff > 20) return { ready: true, verdict: '偏高自信', ratio, samples: hist.length }
  return { ready: true, verdict: '偏低自信', ratio, samples: hist.length }
}

function topErrorOf(errW) {
  const entries = Object.entries(errW).sort((a, b) => b[1] - a[1])
  return entries.length ? entries[0][0] : null
}

function patternWhy(key, evidence) {
  switch (key) {
    case 'quickConclusion':
      return `最近 ${evidence.caseCount} 次案例中，你的信心平均比实际判断质量高 ${Math.max(0, evidence.diffAvg ?? 0)} 分，且「单一信息直接下结论」类错误出现较多。`
    case 'observer':
      return `你的找信息能力约 ${evidence.infoAvg} 分，但「避免过度推断」约 ${evidence.overAvg} 分——会观察，但容易看一点就开始解释。`
    case 'cautious':
      return `你的实际判断质量高于你给自己的信心（差约 ${Math.max(0, -(evidence.diffAvg ?? 0))} 分）——你不是不会，而是不够相信自己。`
    case 'counterSensitive':
      return `你的反例意识约 ${evidence.counterAvg} 分，且很少出现「只找支持自己的证据」类错误。`
    default:
      return '最近各维度得分均衡，没有出现明显的高频错误模式。'
  }
}
