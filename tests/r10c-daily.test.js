// ============================================================
// P1-4 · 每日一卦/每日一练（确定性日期种子）验收
// 1. 同日期必同结果（可复现），不同日期大概率不同（种子滚动）
// 2. 每日一卦必在 64 卦范围内，字段完整
// 3. 每日一练必在必背条目范围内，front/back 非空
// ============================================================
import { describe, it, expect } from 'vitest'
import { seedForDate, dailyHexagram, dailyMemoItem } from '../src/data/daily'
import { HEXAGRAMS } from '../src/data/iching/hexagrams-data'
import { MEMORIZE_ALL_ITEMS } from '../src/data/mustMemorize'

describe('P1-4 · 每日选择器确定性', () => {
  it('同日期种子与结果可复现', () => {
    expect(seedForDate('2026-10-15')).toBe(seedForDate('2026-10-15'))
    expect(dailyHexagram('2026-10-15').seq).toBe(dailyHexagram('2026-10-15').seq)
    expect(dailyMemoItem('2026-10-15').id).toBe(dailyMemoItem('2026-10-15').id)
  })

  it('相邻日期结果滚动（非每日同一条）', () => {
    const a = dailyHexagram('2026-10-15').seq
    const b = dailyHexagram('2026-10-16').seq
    const c = dailyMemoItem('2026-10-15').id
    const d = dailyMemoItem('2026-10-16').id
    // 64 卦 / 全部必背条目数量下，连续两天几乎必然不同（取弱断言：允许个别巧合但要求大体滚动）
    expect(a).not.toBe(b)
    expect(c).not.toBe(d)
  })

  it('每日一卦必在 64 卦内且字段完整', () => {
    for (const date of ['2026-01-01', '2026-06-15', '2026-10-15', '2026-12-31']) {
      const h = dailyHexagram(date)
      expect(h.seq).toBeGreaterThanOrEqual(1)
      expect(h.seq).toBeLessThanOrEqual(64)
      expect(h.name && h.full && h.guaci && h.plain && h.imagery).toBeTruthy()
    }
  })

  it('每日一练必在必背条目内且 front/back 非空', () => {
    for (const date of ['2026-01-01', '2026-06-15', '2026-10-15', '2026-12-31']) {
      const it = dailyMemoItem(date)
      expect(MEMORIZE_ALL_ITEMS.some((x) => x.id === it.id)).toBe(true)
      expect(it.front && it.back).toBeTruthy()
    }
  })

  it('未传日期时使用当天（与直接调用等价）', () => {
    expect(dailyHexagram()).toBe(dailyHexagram(new Date().toISOString().slice(0, 10)))
    expect(dailyMemoItem()).toBe(dailyMemoItem(new Date().toISOString().slice(0, 10)))
  })
})
