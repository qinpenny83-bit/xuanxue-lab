// ============================================================
// 错误博物馆趋势（V1.6 + V2）：判断同一个坑是「正在改善 / 反复出现 / 已经解决」。
// V2 新增「改变」说明：用真实行为（相关能力维度）解释这次改善/反复是怎么发生的。
// 完全基于真实数据（caseAttempts + errorEvents），deterministic，无随机。
// ============================================================

// 每个错误码 → 最能代表「行为改变」的能力维度 + 改善/恶化文案
const CHANGE_MAP = {
  E01: { dim: 'counter', name: '反例意识', up: '开始先找证据、不再单看一个变量就下结论', down: '又回到单变量直接下结论' },
  E02: { dim: 'boundary', name: '判断边界', up: '开始区分「传统观点」与「确定结论」', down: '又把传统观点当成了事实' },
  E03: { dim: 'rule', name: '结构理解', up: '开始把信息放回整体结构里看', down: '仍在孤立地看单个信息' },
  E04: { dim: 'observation', name: '观察能力', up: '开始注意时间变化与更多变量', down: '仍容易忽略时间维度' },
  E05: { dim: 'over', name: '证据克制', up: '开始结合现实证据、克制过度推断', down: '仍容易脱离现实信息直接下结论' },
  E06: { dim: 'boundary', name: '判断边界', up: '开始给结论留「可能不成立」的空间', down: '仍容易用一个标签解释一切' },
  E07: { dim: 'counter', name: '反例意识', up: '开始主动找反对自己的证据', down: '仍只找支持自己的证据' },
  E08: { dim: 'reasoning', name: '推理能力', up: '开始区分「同时发生」与「导致」', down: '仍容易把相关性当因果' },
  E09: { dim: 'reasoning', name: '推理能力', up: '开始能说出「为什么」，而不只是记住结论', down: '仍停留在记住结论、说不出推理' },
  E10: { dim: 'rule', name: '结构理解', up: '开始分清易混术语', down: '仍在混淆概念' },
}

function avgDim(list, dim) {
  const vals = list.map((a) => a.dimensions?.[dim]).filter((v) => typeof v === 'number')
  return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null
}

// 「改变」说明：比较该错误「较早出现」与「最近出现」时的相关能力维度
function behaviorChange(occ, code) {
  const map = CHANGE_MAP[code]
  if (!map || occ.length < 2) return null
  const mid = Math.ceil(occ.length / 2)
  const older = occ.slice(0, mid)
  const newer = occ.slice(mid)
  const a = avgDim(older, map.dim)
  const b = avgDim(newer, map.dim)
  if (a == null || b == null) return null
  const r = (v) => Math.round(v)
  if (b - a >= 10) return { text: `${map.name} ${r(a)} → ${r(b)}，${map.up}`, improving: true }
  if (a - b >= 10) return { text: `${map.name} ${r(a)} → ${r(b)}，${map.down}`, improving: false }
  return { text: `${map.name} 稳定在 ${r(b)} 左右，行为没有明显变化`, improving: null }
}

// 把一次「出现该错误」的案例尝试标记为 ❌ / ⚠️ / ✅：
//   - 该次「避免过度推断」维度 >= 70 → ✅（错误没有主导这次判断）
//   - >= 55 → ⚠️（有影响但被部分控制）
//   - 否则 → ❌（错误仍然主导了判断）
function markOccurrence(attempt) {
  const over = attempt.dimensions?.over ?? 50
  if (over >= 70) return '✅'
  if (over >= 55) return '⚠️'
  return '❌'
}

// state: 全局状态。code: 'E01'..'E10'
export function errorMuseumTrend(state, code) {
  const attempts = state.caseAttempts || []
  const occ = attempts.filter((a) => (a.errorTypes || []).includes(code))

  // 完全没在案例里出现 → 无法评估趋势（可能只来自课堂练习）
  if (occ.length === 0) {
    return { code, trend: null, label: '暂无趋势数据', marks: [], count: state.errorPatterns?.[code] || 0, change: null }
  }

  const change = behaviorChange(occ, code)
  const recent = attempts.slice(-5)
  const recentOcc = recent.filter((a) => (a.errorTypes || []).includes(code))

  // 出现够多（>=3 次），且最近 5 次案例中不再出现 → 已经稳定解决
  if (occ.length >= 3 && recentOcc.length === 0) {
    return {
      code,
      trend: 'solved',
      label: '已经稳定解决',
      emoji: '✅',
      marks: occ.slice(-4).map(markOccurrence),
      count: state.errorPatterns?.[code] || occ.length,
      lastSeenCount: attempts.length - 1 - attempts.lastIndexOf(occ[occ.length - 1]),
      change,
    }
  }

  const marks = occ.slice(-4).map(markOccurrence)
  const lastTwo = marks.slice(-2)

  // 最近出现时基本没造成影响 → 正在改善
  if (lastTwo.length && lastTwo.every((m) => m === '✅')) {
    return { code, trend: 'improving', label: '正在改善', emoji: '📈', marks, count: state.errorPatterns?.[code] || occ.length, change }
  }
  // 最近两次都是硬伤 → 反复出现
  if (lastTwo.length && lastTwo.every((m) => m === '❌')) {
    return { code, trend: 'repeating', label: '反复出现', emoji: '⚠️', marks, count: state.errorPatterns?.[code] || occ.length, change }
  }
  // 最后一次是 ⚠️/✅ → 倾向改善
  if (lastTwo.length && lastTwo[lastTwo.length - 1] !== '❌') {
    return { code, trend: 'improving', label: '正在改善', emoji: '📈', marks, count: state.errorPatterns?.[code] || occ.length, change }
  }
  return { code, trend: 'repeating', label: '仍然存在', emoji: '⚠️', marks, count: state.errorPatterns?.[code] || occ.length, change }
}
