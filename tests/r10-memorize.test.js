// ============================================================
// R10 · 必背速记验收
// 1. 分组与条目完整性：4 组、id 唯一、front/back 非空
// 2. 64 卦条目：恰好 64 条，序号 1-64，卦名与全称齐全
// 3. 干支条目：10 天干 + 12 地支齐全
// 4. 神煞口诀：常用神煞至少 6 条，均带查法口诀与审慎说明
// 5. sourceNode 引用全部有效（零悬空）
// 6. TOGGLE_MEMORIZE 状态行为正确（加/去/去重）
// ============================================================
import { describe, it, expect } from 'vitest'
import {
  MEMORIZE_GROUPS,
  MEMORIZE_ALL_ITEMS,
  MEMORIZE_ITEM_BY_ID,
  MEMORIZE_TOTAL,
} from '../src/data/mustMemorize'
import { getCurriculumNode } from '../src/data/curriculum'
import { getLesson, LESSONS } from '../src/data/lessons'
import { HEXAGRAMS } from '../src/data/iching/hexagrams-data'
import { initialState } from '../src/lib/storage'
import { reducer } from '../src/store/reducer'

describe('R10 · 必背数据完整性', () => {
  it('共 4 组，条目 id 全局唯一，front/back 均非空', () => {
    expect(MEMORIZE_GROUPS.length).toBe(4)
    const ids = MEMORIZE_ALL_ITEMS.map((it) => it.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const it of MEMORIZE_ALL_ITEMS) {
      expect(it.front && it.front.trim(), `${it.id} 缺front`).toBeTruthy()
      expect(it.back && it.back.trim(), `${it.id} 缺back`).toBeTruthy()
    }
    expect(MEMORIZE_TOTAL).toBe(ids.length)
    expect(MEMORIZE_ITEM_BY_ID[ids[0]]).toBeTruthy()
  })

  it('64 卦条目恰好 64 条，与 hexagrams-data 一一对应', () => {
    const hex = MEMORIZE_GROUPS.find((g) => g.id === 'hex64')
    expect(hex.items.length).toBe(64)
    expect(hex.items.length).toBe(HEXAGRAMS.length)
    for (const h of HEXAGRAMS) {
      const it = MEMORIZE_ITEM_BY_ID[`hx-${h.seq}`]
      expect(it, `缺第 ${h.seq} 卦 ${h.name}`).toBeTruthy()
      expect(it.front).toContain(`第 ${h.seq} 卦`)
      expect(it.back).toContain(h.name)
      expect(it.back).toContain(h.full)
    }
  })

  it('十天干与十二地支条目齐全', () => {
    const alpha = MEMORIZE_GROUPS.find((g) => g.id === 'alpha')
    const stemIds = alpha.items.filter((it) => it.id.startsWith('stem-'))
    const branchIds = alpha.items.filter((it) => it.id.startsWith('branch-'))
    expect(stemIds.length).toBe(10)
    expect(branchIds.length).toBe(12)
    for (const c of '甲乙丙丁戊己庚辛壬癸') {
      expect(MEMORIZE_ITEM_BY_ID[`stem-${c}`], `缺天干 ${c}`).toBeTruthy()
    }
    for (const c of '子丑寅卯辰巳午未申酉戌亥') {
      expect(MEMORIZE_ITEM_BY_ID[`branch-${c}`], `缺地支 ${c}`).toBeTruthy()
    }
  })

  it('常用神煞至少 6 条，均含查法口诀与审慎说明', () => {
    const ss = MEMORIZE_GROUPS.find((g) => g.id === 'shensha')
    expect(ss.items.length).toBeGreaterThanOrEqual(6)
    for (const it of ss.items) {
      expect(it.back.length, `${it.id} 口诀过短`).toBeGreaterThan(10)
      expect(it.tip, `${it.id} 缺审慎说明`).toBeTruthy()
      expect(it.source, `${it.id} 缺来源标注`).toBeTruthy()
    }
  })

  it('sourceNode 引用全部有效（零悬空）', () => {
    const dangling = []
    for (const it of MEMORIZE_ALL_ITEMS) {
      if (!it.sourceNode) continue
      if (!getCurriculumNode(it.sourceNode)) dangling.push(`${it.id} -> ${it.sourceNode}`)
    }
    expect(dangling, `悬空引用：${dangling.join(', ')}`).toEqual([])
  })

  it('lessonId 跳转目标全部存在于课程目录（LESSONS）', () => {
    const ids = new Set(LESSONS.map((l) => l.id))
    const bad = []
    for (const it of MEMORIZE_ALL_ITEMS) {
      if (!it.lessonId) continue
      if (!ids.has(it.lessonId)) bad.push(`${it.id} -> ${it.lessonId}`)
    }
    expect(bad, `无效课程跳转：${bad.join(', ')}`).toEqual([])
  })
})

describe('R10 · TOGGLE_MEMORIZE 状态行为', () => {
  it('勾选加入、再点移除、不同条目累加、移除后保留其余', () => {
    let s = reducer({ ...initialState }, { type: 'TOGGLE_MEMORIZE', itemId: 'stem-甲' })
    expect(s.memorized).toEqual(['stem-甲'])
    // 再次勾选同一条目 = 取消
    s = reducer(s, { type: 'TOGGLE_MEMORIZE', itemId: 'stem-甲' })
    expect(s.memorized).toEqual([])
    // 两个不同条目累加
    s = reducer(s, { type: 'TOGGLE_MEMORIZE', itemId: 'stem-甲' })
    s = reducer(s, { type: 'TOGGLE_MEMORIZE', itemId: 'hx-1' })
    expect(s.memorized).toEqual(['stem-甲', 'hx-1'])
    // 取消其中一个，其余保留
    s = reducer(s, { type: 'TOGGLE_MEMORIZE', itemId: 'stem-甲' })
    expect(s.memorized).toEqual(['hx-1'])
  })

  it('缺少 itemId 时状态不变', () => {
    const s = reducer({ ...initialState }, { type: 'TOGGLE_MEMORIZE' })
    expect(s.memorized).toEqual([])
  })
})
