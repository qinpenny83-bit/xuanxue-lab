// ============================================================
// 🧠 间隔复习（SM-2 超简化，确定性、纯函数、可测试）
// 只服务「已记住」条目：标记记住后开始排期，复习后更新间隔。
// 原则：轻量不强迫——只算「下次该复习的日期」，从不打断学习流程。
// ============================================================

export const EASE_INIT = 2.5
export const INTERVAL_INIT = 1 // 首次记住 → 明天该过目一眼

// 评分档位（评分越高，间隔越长）
export const RATING = {
  AGAIN: 0, // 忘了 → 重新计时（间隔回到 1 天）
  HARD: 2, // 勉强 → 间隔×1.2，难度微升
  GOOD: 4, // 记住了 → 标准 SM-2 推进
  EASY: 5, // 很熟 → 间隔×1.6 直跳
}

// 把「今天 + n 天」算成 YYYY-MM-DD（以本地日期为准，纯函数不碰 Date.now）
export function addDays(dateStr, days) {
  const [y, m, d] = dateStr.split('-').map(Number)
  const dt = new Date(y, m - 1, d)
  dt.setDate(dt.getDate() + days)
  const yy = dt.getFullYear()
  const mm = String(dt.getMonth() + 1).padStart(2, '0')
  const dd = String(dt.getDate()).padStart(2, '0')
  return `${yy}-${mm}-${dd}`
}

// 初始记住：建立复习档案
export function initCard(today) {
  return {
    rep: 1,
    ease: EASE_INIT,
    interval: INTERVAL_INIT,
    due: addDays(today, INTERVAL_INIT),
    lastReview: today,
    reviews: 1,
  }
}

// SM-2 推进：rating 取自 RATING
export function reviewCard(card, rating, today) {
  if (rating === RATING.AGAIN) {
    // 忘了：重新计时，但保留已复习次数与难度印象
    return {
      ...card,
      rep: 1,
      interval: INTERVAL_INIT,
      ease: Math.max(1.3, card.ease - 0.2),
      due: addDays(today, INTERVAL_INIT),
      lastReview: today,
      reviews: card.reviews + 1,
    }
  }
  const q = rating // HARD=2 / GOOD=4 / EASY=5
  const ease = Math.max(1.3, card.ease + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02)))
  let interval
  if (card.rep === 1) interval = rating === RATING.EASY ? 4 : 3
  else if (card.rep === 2) interval = rating === RATING.EASY ? 10 : rating === RATING.GOOD ? 6 : 4
  else interval = Math.round(card.interval * ease * (rating === RATING.EASY ? 1.6 : rating === RATING.GOOD ? 1 : 1.2))
  return {
    ...card,
    rep: card.rep + 1,
    ease,
    interval,
    due: addDays(today, interval),
    lastReview: today,
    reviews: card.reviews + 1,
  }
}

// 今天是否到期（due <= today）
export function isDue(card, today) {
  if (!card) return false
  return card.due <= today
}

// 归一化旧数据：老状态里只有 memorized 数组，无复习档案 → 补建
export function withCard(archive, itemId, today) {
  if (archive && archive[itemId]) return archive[itemId]
  return initCard(today)
}
