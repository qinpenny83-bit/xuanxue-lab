// ============================================================
// 🗓️ 每日内容选择器（确定性种子）
// 与每日谜题同一思路：按日期字符串哈希，稳定选出「今天」的卦与记忆条目。
// 不联网、可复现、日期变则内容变。
// ============================================================

import { HEXAGRAMS } from './iching/hexagrams-data'
import { MEMORIZE_ALL_ITEMS } from './mustMemorize'

// 日期字符串 → 稳定 32 位种子（与 puzzles.js 同算法）
export function seedForDate(dateStr) {
  const d = dateStr || new Date().toISOString().slice(0, 10)
  let seed = 0
  for (let i = 0; i < d.length; i++) seed = (seed * 31 + d.charCodeAt(i)) >>> 0
  return seed
}

// 每日一卦：64 卦里稳定选 1
export function dailyHexagram(dateStr = null) {
  const seed = seedForDate(dateStr)
  return HEXAGRAMS[seed % HEXAGRAMS.length]
}

// 每日一练：必背条目里稳定选 1（覆盖全部四组）
export function dailyMemoItem(dateStr = null) {
  const seed = seedForDate(dateStr)
  return MEMORIZE_ALL_ITEMS[seed % MEMORIZE_ALL_ITEMS.length]
}
