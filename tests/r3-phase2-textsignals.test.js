// ============================================================
// R3 Phase 2 · TextSignals 开放文本结构化语义信号
//
// 原则：只做确定性「关键词/字面模式」检测，不判对错、不做 AI 评分。
// ============================================================
import { describe, it, expect } from 'vitest'
import analyzeSignals, { ABSOLUTE_WORDS } from '../src/lib/textSignals'

describe('TextSignals · 主入口与空输入', () => {
  it('空字符串返回全零结构，无 any 判对错字段', () => {
    const s = analyzeSignals('')
    expect(s.length).toBe(0)
    expect(s.mentionsPosition).toBe(false)
    expect(s.mentionsRelation).toBe(false)
    expect(s.mentionsText).toBe(false)
    expect(s.mentionsEvidence).toBe(false)
    expect(s.mentionsCounterexample).toBe(false)
    expect(s.mentionsUncertainty).toBe(false)
    expect(s.absoluteLanguage).toEqual([])
    expect(s.absoluteHits).toBe(0)
    expect(s.referencedEntities).toEqual({ hexagrams: [], yaos: [], terms: [] })
    // 关键哲学约束：结构化信号「不判对错」
    expect(s).not.toHaveProperty('correct')
    expect(s).not.toHaveProperty('isCorrect')
    expect(s).not.toHaveProperty('score')
  })

  it('null / undefined / 非字符串安全降级', () => {
    expect(() => analyzeSignals(null)).not.toThrow()
    expect(() => analyzeSignals(undefined)).not.toThrow()
    expect(analyzeSignals(123).length).toBe(3)
  })
})

describe('TextSignals · 维度信号（位置/关系/文本）', () => {
  it('检测爻位与位置词（用户示例句）', () => {
    const s = analyzeSignals('九三处于下卦之上，又与上九对应')
    expect(s.mentionsPosition).toBe(true)
    expect(s.positionHits).toBeGreaterThanOrEqual(2) // 九三 + 下卦
    expect(s.mentionsRelation).toBe(true) // 对应
  })

  it('检测爻位行名（初九/六二/九三…）', () => {
    expect(analyzeSignals('六二当位').mentionsPosition).toBe(true)
    expect(analyzeSignals('九五之尊居上卦中位').mentionsPosition).toBe(true)
  })

  it('检测关系词（相应/相承/相比）', () => {
    expect(analyzeSignals('初爻与四爻相应').mentionsRelation).toBe(true)
    expect(analyzeSignals('下爻相承上爻').mentionsRelation).toBe(true)
    expect(analyzeSignals('两爻相比').mentionsRelation).toBe(true)
  })

  it('检测文本词（卦辞/爻辞/大象/彖传/系辞）', () => {
    expect(analyzeSignals('卦辞说元亨利贞').mentionsText).toBe(true)
    expect(analyzeSignals('还需要看大象传').mentionsText).toBe(true)
    expect(analyzeSignals('彖传与象传不同').mentionsText).toBe(true)
  })

  it('无任何结构词的普通句子不触发结构信号', () => {
    const s = analyzeSignals('今天天气不错')
    expect(s.mentionsPosition).toBe(false)
    expect(s.mentionsRelation).toBe(false)
    expect(s.mentionsText).toBe(false)
  })
})

describe('TextSignals · 证据/反例/不确定性信号', () => {
  it('检测证据词', () => {
    const s = analyzeSignals('我有证据支持这个结论，原文可作依据')
    expect(s.mentionsEvidence).toBe(true)
  })

  it('检测反例词', () => {
    const s = analyzeSignals('存在一个反例可以推翻它，但也有例外')
    expect(s.mentionsCounterexample).toBe(true)
  })

  it('检测不确定性词', () => {
    const s = analyzeSignals('这个问题可能无法判断，我不确定')
    expect(s.mentionsUncertainty).toBe(true)
  })

  it('证据词不会误判为反例（二者独立）', () => {
    const s = analyzeSignals('有证据支持')
    expect(s.mentionsEvidence).toBe(true)
    expect(s.mentionsCounterexample).toBe(false)
  })
})

describe('TextSignals · 绝对化表达检测', () => {
  it('ABSOLUTE_WORDS 覆盖常见绝对化措辞', () => {
    for (const w of ['一定', '必然', '肯定', '永远', '绝对', '百分之百', '从来']) {
      expect(ABSOLUTE_WORDS).toContain(w)
    }
  })

  it('检测到绝对化表达并列出命中词', () => {
    const s = analyzeSignals('得位一定就是吉，绝对没错')
    expect(s.absoluteHits).toBeGreaterThanOrEqual(2) // 一定 + 绝对
    expect(s.absoluteLanguage).toContain('一定')
    expect(s.absoluteLanguage).toContain('绝对')
  })

  it('无绝对化措辞时 absoluteHits 为 0', () => {
    expect(analyzeSignals('这种情况下可能更顺').absoluteHits).toBe(0)
  })
})

describe('TextSignals · 实体引用识别', () => {
  it('识别卦名实体（乾卦 / 坤卦）', () => {
    const s = analyzeSignals('乾卦与坤卦的取义不同')
    expect(s.referencedEntities.hexagrams).toContain('乾')
    expect(s.referencedEntities.hexagrams).toContain('坤')
  })

  it('识别爻位行名实体', () => {
    const s = analyzeSignals('九三和上九形成对应')
    expect(s.referencedEntities.yaos).toContain('九三')
    expect(s.referencedEntities.yaos).toContain('上九')
  })

  it('识别术语实体（长度≥2）', () => {
    const s = analyzeSignals('这体现了阴阳的互动')
    expect(s.referencedEntities.terms).toContain('阴阳')
  })
})