// ============================================================
// R3 Phase 1 · 全量数据引用完整性检查 测试
//
// 目标：保证知识图谱里每一条引用（hexagramId / yaoId / termId /
//   classicId / traditionId / caseId）都解析得到真实对象，
//   任何悬空引用都必须报错、不静默忽略。
// ============================================================
import { describe, it, expect } from 'vitest'
import { checkDataIntegrity, hasDanglingReferences } from '../src/lib/dataIntegrity'

describe('dataIntegrity · 全量引用完整性', () => {
  it('checkDataIntegrity 返回规范结构（errors/bySpace/passed/counts）', () => {
    const r = checkDataIntegrity()
    expect(Array.isArray(r.errors)).toBe(true)
    expect(r.bySpace).toBeTruthy()
    for (const key of ['hexagram', 'yao', 'term', 'classic', 'tradition', 'case']) {
      expect(Array.isArray(r.bySpace[key]), `bySpace.${key}`).toBe(true)
    }
    expect(typeof r.passed).toBe('boolean')
    expect(r.counts).toBeTruthy()
  })

  it('全量检查零悬空引用：errors 必须为空', () => {
    const r = checkDataIntegrity()
    const detail = r.errors.slice(0, 10).map((e) => `[${e.space}] ${e.msg}`).join('\n')
    expect(r.errors, `发现 ${r.errors.length} 条悬空引用：\n${detail}`).toEqual([])
    expect(r.passed).toBe(true)
  })

  it('六类引用空间各自零悬空', () => {
    const r = checkDataIntegrity()
    for (const key of ['hexagram', 'yao', 'term', 'classic', 'tradition', 'case']) {
      expect(r.bySpace[key], `${key} 空间存在悬空引用`).toEqual([])
    }
  })

  it('hasDanglingReferences 在数据完整时为 false', () => {
    expect(hasDanglingReferences()).toBe(false)
  })

  it('实体计数符合预期：64 卦 / 384 爻 / 6 解释传统', () => {
    const r = checkDataIntegrity()
    expect(r.counts.hexagrams).toBe(64)
    expect(r.counts.yaos).toBe(384)
    expect(r.counts.traditions).toBe(Traditions_expected())
    expect(r.counts.classics).toBeGreaterThanOrEqual(83)
    expect(r.counts.terms).toBeGreaterThan(0)
    expect(r.counts.cases).toBeGreaterThan(0)
  })

  it('每一卦档案的爻都被完整覆盖（64 卦 × 6 爻 = 384）', () => {
    const r = checkDataIntegrity()
    expect(r.counts.yaos).toBe(r.counts.hexagrams * 6)
  })
})

function Traditions_expected() {
  // TRADITION_REF 有 6 个解释传统（han/wangbi/tang/chengyi/zhuxi/shaoyong）
  return 6
}