// ============================================================
// R2-1.5 · ClassicPassage 数据层测试
// 验证：来源字段（不伪造出处）/ 关联卦 / 关联爻 / 单一数据源 /
//       可靠片段完整性 / 大象单一来源 / 随机经典 / 内容可读性。
// ============================================================
import { describe, it, expect } from 'vitest'
import {
  CLASSIC_PASSAGES,
  SOURCE_RECEIVED,
  SOURCE_NEEDS_REVIEW,
  getClassicPassage,
  classicPassagesForHexagram,
  classicPassagesForYao,
  daXiangPassage,
  randomClassicPassage,
  hasClassicContent,
} from '../src/data/iching/classic-passages'
import { HEXAGRAMS } from '../src/data/iching/hexagrams-data'

describe('ClassicPassage · 来源声明（不伪造出处）', () => {
  it('来源声明包含 edition / sourceType / confidence / note 四要素', () => {
    for (const s of [SOURCE_RECEIVED, SOURCE_NEEDS_REVIEW]) {
      expect(s.edition).toBe('通行本整理')
      expect(s.sourceType).toBe('received_text')
      expect(['verified', 'needs_review']).toContain(s.confidence)
      expect(typeof s.note).toBe('string')
      expect(s.note.length).toBeGreaterThan(0)
    }
  })

  it('来源声明不出现出版社 / 页码 / 版本等臆造出处', () => {
    for (const s of [SOURCE_RECEIVED, SOURCE_NEEDS_REVIEW]) {
      expect(s.edition).not.toMatch(/出版社|第\s*\d+\s*页|版本/)
    }
  })
})

describe('ClassicPassage · 片段完整性', () => {
  it('每条片段 id 唯一，且含 source / chapter / 非空 text / modernNote 标注「非原典」', () => {
    expect(CLASSIC_PASSAGES.length).toBeGreaterThan(0)
    const ids = CLASSIC_PASSAGES.map((p) => p.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const p of CLASSIC_PASSAGES) {
      expect(typeof p.id).toBe('string')
      expect(typeof p.source).toBe('string')
      expect(typeof p.chapter).toBe('string')
      expect(typeof p.text).toBe('string')
      expect(p.text.trim().length).toBeGreaterThan(0)
      expect(p.modernNote).toContain('非原典')
      expect(Array.isArray(p.relatedTerms)).toBe(true)
    }
  })

  it('source 只来自易传分类（系辞传 / 文言传），不放杂项', () => {
    for (const p of CLASSIC_PASSAGES) {
      expect(['系辞传', '文言传']).toContain(p.source)
    }
  })

  it('getClassicPassage：已知 id 取到对象，未知 id 返回 null', () => {
    expect(getClassicPassage('sv-01')).toBeTruthy()
    expect(getClassicPassage('wy-03')).toBeTruthy()
    expect(getClassicPassage('不存在的片段')).toBeNull()
  })
})

describe('ClassicPassage · 关联卦 / 爻', () => {
  it('classicPassagesForHexagram 只返回「该卦专属」或「通用」片段', () => {
    const qian = classicPassagesForHexagram(1)
    expect(qian.length).toBeGreaterThan(0)
    for (const p of qian) {
      expect(p.relatedHexagrams.length === 0 || p.relatedHexagrams.includes(1)).toBe(true)
    }
  })

  it('classicPassagesForYao 能命中 relatedYaos 里显式关联的爻（乾九五）', () => {
    const jiuwu = classicPassagesForYao(1, 4)
    expect(jiuwu.some((p) => p.id === 'wy-03')).toBe(true)
  })

  it('64 卦均存在「大象」片段，且文本来自单一数据源 hexagrams-data.imagery（不二次手抄）', () => {
    for (let seq = 1; seq <= 64; seq++) {
      const h = HEXAGRAMS.find((x) => x.seq === seq)
      const dx = daXiangPassage(seq)
      expect(dx, `第 ${seq} 卦缺大象片段`).toBeTruthy()
      expect(dx.source).toBe('象传')
      expect(dx.text).toBe(h.imagery)
    }
  })

  it('randomClassicPassage 从可靠池中抽取，永不返回池外对象', () => {
    for (let i = 0; i < 30; i++) {
      const p = randomClassicPassage()
      expect(CLASSIC_PASSAGES).toContain(p)
      expect(p.text.trim().length).toBeGreaterThan(0)
    }
  })

  it('hasClassicContent：64 卦均至少有大象可读', () => {
    for (let seq = 1; seq <= 64; seq++) {
      expect(hasClassicContent(seq)).toBe(true)
    }
  })
})