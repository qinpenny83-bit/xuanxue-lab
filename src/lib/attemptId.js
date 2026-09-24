// ============================================================
// 关卡尝试 ID / 题目 ID 纯函数（零依赖）：
//   从 lessonProgress.js 拆出——本模块不 import 任何数据模块，
//   保证首页首包不会因静态引用而带上 curriculum 全量。
//   实现与 lessonProgress.js 原版逐字一致（测试依赖确定性）。
// ============================================================

// ── 确定性 RNG（与实验/易工坊同一套）──────────────────────────
export function hashSeed(str) {
  let h = 2166136261 >>> 0
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

export function mulberry32(a) {
  return function () {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// attemptId → 数字种子（同一 attempt 稳定，不同 attempt 不同变体）
export function attemptSeed(attemptId) {
  return hashSeed(`attempt:${attemptId || ''}`)
}

// 生成 attemptId：时间戳 + 递增计数（保证单调唯一，测试可注入）
let __counter = 0
export function makeAttemptId(ts = Date.now(), counter = null) {
  __counter += 1
  const c = counter != null ? counter : __counter
  return `a-${ts}-${c}`
}

// 题目身份：lessonId + 步骤序号 + attempt 派生种子
// 同一 attempt 同一题 → 同一 questionId（刷新/恢复幂等）
// 不同 attempt 同一题 → 不同 questionId（新行为，可安全写入新 Evidence）
export function questionIdFor(lessonId, stepIndex, attemptId) {
  return `${lessonId}:s${stepIndex}:v${attemptSeed(attemptId)}`
}
