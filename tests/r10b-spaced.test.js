// ============================================================
// R10.1 · 必背间隔复习（SM-2 超简化）验收
// 1. spaced 纯函数：initCard / reviewCard / isDue / addDays
// 2. TOGGLE_MEMORIZE 勾选时建立复习档案
// 3. RECORD_MEMORIZE_REVIEW 推进间隔与到期日
// 4. 未标记记住的条目不进入复习队列
// ============================================================
import { describe, it, expect } from 'vitest'
import {
  EASE_INIT,
  RATING,
  initCard,
  reviewCard,
  isDue,
  addDays,
  withCard,
} from '../src/lib/spaced'
import { initialState, todayString } from '../src/lib/storage'
import { reducer } from '../src/store/reducer'

describe('R10.1 · SM-2 纯函数', () => {
  it('initCard 首记：明天到期，标准初始难度', () => {
    const c = initCard('2026-10-15')
    expect(c.rep).toBe(1)
    expect(c.ease).toBe(EASE_INIT)
    expect(c.interval).toBe(1)
    expect(c.due).toBe('2026-10-16')
    expect(c.lastReview).toBe('2026-10-15')
  })

  it('reviewCard 评分越高间隔越长（忘了重置 / 记住推进 / 很熟跳档）', () => {
    const base = initCard('2026-10-15')
    const again = reviewCard(base, RATING.AGAIN, '2026-10-16')
    expect(again.rep).toBe(1)
    expect(again.interval).toBe(1)
    expect(again.due).toBe('2026-10-17')

    const good = reviewCard(base, RATING.GOOD, '2026-10-16')
    expect(good.rep).toBe(2)
    expect(good.interval).toBe(3)
    expect(good.due).toBe('2026-10-19')

    const easy = reviewCard(base, RATING.EASY, '2026-10-16')
    expect(easy.interval).toBe(4)
    expect(easy.due).toBe('2026-10-20')
  })

  it('连续记住时间隔指数增长（遗忘曲线的核心）', () => {
    let c = initCard('2026-10-15') // due 10-16
    c = reviewCard(c, RATING.GOOD, '2026-10-16') // interval 3, due 10-19
    c = reviewCard(c, RATING.GOOD, '2026-10-19') // interval 6, due 10-25
    c = reviewCard(c, RATING.GOOD, '2026-10-25') // interval 6*2.6 ≈ 16, due 11-10
    expect(c.interval).toBeGreaterThanOrEqual(15)
    expect(c.rep).toBe(4)
    expect(c.due).toBe(addDays('2026-10-25', c.interval))
  })

  it('isDue：到期日当天及之前都算到期，之后不算', () => {
    const c = initCard('2026-10-15') // due 10-16
    expect(isDue(c, '2026-10-16')).toBe(true)
    expect(isDue(c, '2026-10-17')).toBe(true) // 过期也算
    expect(isDue(c, '2026-10-15')).toBe(false)
    expect(isDue(null, '2026-10-16')).toBe(false)
  })

  it('addDays 跨月与跨年正确', () => {
    expect(addDays('2026-01-31', 1)).toBe('2026-02-01')
    expect(addDays('2026-12-30', 3)).toBe('2027-01-02')
    expect(addDays('2026-10-15', 0)).toBe('2026-10-15')
  })

  it('withCard：无档案时补建，有档案时原样返回', () => {
    const archive = { 'stem-甲': { rep: 3, due: '2026-11-01' } }
    const kept = withCard(archive, 'stem-甲', '2026-10-15')
    expect(kept.due).toBe('2026-11-01')
    const fresh = withCard({}, 'stem-乙', '2026-10-15')
    expect(fresh.rep).toBe(1)
    expect(fresh.due).toBe('2026-10-16')
  })
})

describe('R10.1 · 状态流转', () => {
  it('勾选「已记住」自动建立复习档案（明天到期）', () => {
    let s = reducer({ ...initialState }, { type: 'TOGGLE_MEMORIZE', itemId: 'stem-甲' })
    expect(s.memorized).toEqual(['stem-甲'])
    expect(s.memorizeCards['stem-甲']).toBeTruthy()
    expect(s.memorizeCards['stem-甲'].due).toBe(addDays(todayString(), 1))
    // 取消再勾选：复用原档案，不重置
    s = reducer(s, { type: 'TOGGLE_MEMORIZE', itemId: 'stem-甲' })
    expect(s.memorized).toEqual([])
    const again = reducer(s, { type: 'TOGGLE_MEMORIZE', itemId: 'stem-甲' })
    expect(again.memorized).toEqual(['stem-甲'])
    expect(again.memorizeCards['stem-甲'].due).toBe(s.memorizeCards['stem-甲'].due)
  })

  it('评分后间隔推进、到期日延后、复习次数累加', () => {
    let s = reducer({ ...initialState }, { type: 'TOGGLE_MEMORIZE', itemId: 'hx-1' })
    const dueBefore = s.memorizeCards['hx-1'].due
    s = reducer(s, { type: 'RECORD_MEMORIZE_REVIEW', itemId: 'hx-1', rating: RATING.GOOD })
    const card = s.memorizeCards['hx-1']
    expect(card.reviews).toBe(2)
    expect(card.rep).toBe(2)
    expect(card.interval).toBe(3)
    expect(card.due > dueBefore).toBe(true)
  })

  it('未标记记住的条目不进入复习队列', () => {
    const s = reducer({ ...initialState }, { type: 'RECORD_MEMORIZE_REVIEW', itemId: 'stem-甲', rating: RATING.GOOD })
    expect(s.memorizeCards).toEqual({})
    expect(s.memorized).toEqual([])
  })

  it('缺 itemId 或非法评分时状态不变', () => {
    let s = reducer({ ...initialState }, { type: 'RECORD_MEMORIZE_REVIEW', rating: RATING.GOOD })
    expect(s.memorizeCards).toEqual({})
    s = reducer({ ...initialState }, { type: 'TOGGLE_MEMORIZE', itemId: 'stem-甲' })
    s = reducer(s, { type: 'RECORD_MEMORIZE_REVIEW', itemId: 'stem-甲', rating: undefined })
    expect(s.memorizeCards['stem-甲'].reviews).toBe(1) // 未评分：不推进
  })
})
