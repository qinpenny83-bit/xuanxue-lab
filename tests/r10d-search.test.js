// ============================================================
// P2-5 · 全局搜索索引验收
// 1. 索引覆盖六类内容，条目数合理（64 卦 / 术语 / 课程 / 案例 / 词典 / 必背）
// 2. normalize：全角转半角、标点归一、去空白
// 3. searchAll：多关键词全命中、标题优先排序、每类上限
// 4. 典型查询能找到对应内容（卦名 / 术语 / 课程 / 案例 / 词典）
// ============================================================
import { describe, it, expect } from 'vitest'
import { normalize, searchAll, countMatches, searchIndexStats } from '../src/data/searchIndex'

describe('P2-5 · 索引覆盖', () => {
  it('六类内容均有条目且数量合理', () => {
    const stats = searchIndexStats()
    expect(stats.hex).toBeGreaterThanOrEqual(64)
    expect(stats.term).toBeGreaterThanOrEqual(100)
    expect(stats.course).toBeGreaterThanOrEqual(300)
    expect(stats.case).toBeGreaterThanOrEqual(60)
    expect(stats.dict).toBeGreaterThanOrEqual(20)
    expect(stats.memorize).toBeGreaterThanOrEqual(80)
  })
})

describe('P2-5 · 归一化', () => {
  it('全角转半角、标点归一、去空白', () => {
    expect(normalize('ＡＢＣ')).toBe('abc')
    expect(normalize('承、乘、比、应')).toBe('承 乘 比 应')
    expect(normalize('  乾 为 天  ')).toBe('乾 为 天')
  })
})

describe('P2-5 · 搜索行为', () => {
  it('空查询返回空结果', () => {
    expect(searchAll('')).toEqual([])
    expect(searchAll('   ')).toEqual([])
  })

  it('搜卦名命中卦档（标题优先）', () => {
    const r = searchAll('水雷屯')
    expect(r.hex && r.hex.length).toBeGreaterThan(0)
    expect(r.hex[0].type).toBe('hex')
    expect(r.hex[0].title).toContain('屯')
  })

  it('搜术语命中「承」「乘」等条目', () => {
    const r1 = searchAll('承')
    expect(r1.term && r1.term.length).toBeGreaterThan(0)
    expect(r1.term.map((t) => t.id)).toContain('cheng')
    const r2 = searchAll('乘')
    expect(r2.term.map((t) => t.id)).toContain('sheng')
  })

  it('多关键词全部命中（缺一词则不返回）', () => {
    const r = searchAll('乾 天行健')
    expect(Object.keys(r).length).toBeGreaterThan(0)
    // 不存在的组合 → 空
    const miss = searchAll('乾 不存在的词汇xyz')
    expect(Object.keys(miss).length).toBe(0)
  })

  it('结果按标题命中优先排序，且每类不超过上限', () => {
    const r = searchAll('乾', 5)
    for (const list of Object.values(r)) {
      expect(list.length).toBeLessThanOrEqual(5)
    }
    if (r.hex) {
      expect(r.hex[0].title).toContain('乾')
    }
  })

  it('countMatches 与 searchAll 的命中数一致', () => {
    const counts = countMatches('乾')
    const results = searchAll('乾')
    for (const [type, n] of Object.entries(counts)) {
      expect(results[type]?.length ?? 0).toBeLessThanOrEqual(n)
    }
  })
})
