// ============================================================
// 洞察画像快照（纯函数，零数据依赖）：
//   与 agentInsight.js 拆开——本模块不 import 任何数据文件，
//   保证首页首包不会因静态引用而带上 cases.js 等大模块。
// ============================================================

// V1.6.1：画像快照——记录「这次洞察是基于什么行为得出的」
export function buildInsightSnapshot(state, fingerprint, key) {
  const attempts = (state.caseAttempts || []).slice(-8)
  const ev = fingerprint?.evidence || {}
  const unks = attempts.filter((a) => a.usedUnknown)
  return {
    sampleCount: attempts.length,
    primaryKey: fingerprint?.primaryPattern?.key || null,
    errorTop: ev.errorTop || null,
    diffAvg: ev.diffAvg ?? null,
    boundaryAvg: ev.boundaryAvg ?? null,
    counterAvg: ev.counterAvg ?? null,
    unknownUsed: unks.length,
    key: key || null,
  }
}

// V1.6.1：行为变化是否达到刷新阈值（deterministic）
// 主要倾向 / 高频错误 / 信心校准 / 证据意识 / 反例能力 / 「不知道」使用 / 首次达到样本线
export function shouldRefreshInsight(prev, cur) {
  if (!prev) return true
  if (prev.primaryKey !== cur.primaryKey) return true
  if (prev.errorTop !== cur.errorTop) return true
  if (Math.abs((prev.diffAvg ?? 0) - (cur.diffAvg ?? 0)) >= 10) return true
  if (Math.abs((prev.boundaryAvg ?? 0) - (cur.boundaryAvg ?? 0)) >= 15) return true
  if (Math.abs((prev.counterAvg ?? 0) - (cur.counterAvg ?? 0)) >= 15) return true
  if (Math.abs((prev.unknownUsed ?? 0) - (cur.unknownUsed ?? 0)) >= 2) return true
  if (prev.sampleCount < 3 && cur.sampleCount >= 3) return true // 首次达到可判定样本
  return false
}
