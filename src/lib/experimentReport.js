// ============================================================
// 实验报告生成器：把 0–10 的记录变成一份「诚实的复盘」。
// 采用规则化趋势分析，不做神秘化解读。
// ============================================================

export function generateExperimentReport(experiment, entries, assumption = '') {
  const days = entries.filter((e) => e && e.metrics).length
  if (days === 0) {
    return { empty: true, message: '还没有任何记录，先去完成第一天的记录吧。' }
  }

  const metrics = experiment.metrics.map((m) => {
    const values = entries.map((e) => Number(e.metrics[m.key])).filter((v) => !Number.isNaN(v))
    const half = Math.floor(values.length / 2)
    const mean1 = avg(values.slice(0, half))
    const mean2 = avg(values.slice(half))
    const delta = round1(mean2 - mean1)
    const trend = Math.abs(delta) < 1.5 ? '平稳' : delta > 0 ? '上升' : '下降'
    return { key: m.key, label: m.label, values, mean1, mean2, delta, trend, consistency: consistencyLabel(values) }
  })

  const overallChange = metrics.filter((m) => m.trend !== '平稳').length
  const volatility = volatilityLevel(entries, metrics)

  // 假设 vs 数据（关键词规则匹配，明确标注为「有限规则判断」）
  const judgement = judgeAssumption(assumption, metrics, volatility)

  return {
    empty: false,
    daysRecorded: days,
    totalDays: experiment.days,
    metrics,
    overallChange,
    volatility,
    assumption,
    judgement,
    disclaimer:
      '这份报告只描述你记录到的数据变化，不证明任何超自然因果。它的唯一目的，是帮你观察「自己的判断是否经得起现实记录」。',
  }
}

function avg(arr) {
  if (!arr.length) return 0
  return arr.reduce((a, b) => a + b, 0) / arr.length
}

function round1(n) {
  return Math.round(n * 10) / 10
}

function consistencyLabel(values) {
  if (values.length < 2) return '数据不足'
  const m = avg(values)
  const variance = values.reduce((a, b) => a + (b - m) * (b - m), 0) / values.length
  const std = Math.sqrt(variance)
  if (std < 1.2) return '较为稳定'
  if (std < 2.5) return '有一定波动'
  return '波动较大'
}

function volatilityLevel(entries, metrics) {
  const keys = metrics.map((m) => m.key)
  const all = entries.flatMap((e) => keys.map((k) => Number(e.metrics[k])).filter((v) => !Number.isNaN(v)))
  if (!all.length) return '无法判断'
  const m = avg(all)
  const variance = all.reduce((a, b) => a + (b - m) * (b - m), 0) / all.length
  const std = Math.sqrt(variance)
  if (std < 1.5) return '低'
  if (std < 3) return '中'
  return '高'
}

function judgeAssumption(assumption, metrics, volatility) {
  if (!assumption || !assumption.trim()) {
    return { verdict: '未提供假设', supported: [], mismatched: [], undecided: metrics.map((m) => m.label) }
  }
  const text = assumption
  const supported = []
  const mismatched = []
  const undecided = []

  const changedMetrics = metrics.filter((m) => m.trend !== '平稳')
  const changedLabels = changedMetrics.map((m) => m.label)

  if (/起伏|不稳|波动|变化/.test(text)) {
    if (changedMetrics.length > 0) {
      supported.push(`记录显示 ${changedLabels.join('、')} 确有变化`)
    } else {
      mismatched.push('你假设「有起伏」，但记录到的数据整体平稳')
    }
  }
  if (/平稳|稳定|一样|恒定/.test(text)) {
    if (changedMetrics.length === 0) {
      supported.push('记录到的数据整体平稳，与你的假设一致')
    } else {
      mismatched.push(`你假设「平稳」，但 ${changedLabels.join('、')} 有变化`)
    }
  }
  if (/情绪/.test(text)) {
    const mood = metrics.find((m) => m.label.includes('情绪'))
    if (mood) (mood.trend === '平稳' ? undecided : supported).push(`情绪维度趋势为「${mood.trend}」`)
  }
  if (/精力/.test(text)) {
    const energy = metrics.find((m) => m.label.includes('精力'))
    if (energy) (energy.trend === '平稳' ? undecided : supported).push(`精力维度趋势为「${energy.trend}」`)
  }
  if (/行动/.test(text)) {
    const action = metrics.find((m) => m.label.includes('行动'))
    if (action) (action.trend === '平稳' ? undecided : supported).push(`行动力维度趋势为「${action.trend}」`)
  }

  // 未覆盖的维度归入「无法判断」
  const mentioned = new Set()
  const seen = [...supported, ...mismatched, ...undecided].join('')
  metrics.forEach((m) => {
    if (!seen.includes(m.label)) undecided.push(`${m.label}维度与你的假设无直接对应`)
  })

  const verdict =
    mismatched.length > 0
      ? '部分不一致'
      : supported.length > 0
        ? '基本支持'
        : '证据不足以做判断'

  return {
    verdict,
    supported: dedupe(supported),
    mismatched: dedupe(mismatched),
    undecided: dedupe(undecided),
    note: '以上是基于关键词的有限规则判断，仅供复盘参考，不替代你的自主思考。',
  }
}

function dedupe(arr) {
  return [...new Set(arr)]
}