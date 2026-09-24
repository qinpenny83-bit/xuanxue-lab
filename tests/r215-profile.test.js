// ============================================================
// R2-1.5 · 卦/爻 新字段 + Agent 确定性推荐 测试
// 验证：sourceInfo / classicPassageIds / caseIds / daXiang 接线；
//       彖传/小象/系辞原文保持 null（不编造）；
//       解释传统不产生重复数据；
//       Agent 推荐基于真实学习状态、deterministic、无模板空话。
// ============================================================
import { describe, it, expect } from 'vitest'
import {
  HEXAGRAM_PROFILES,
  ALL_YAO,
  TRADITION_REF,
} from '../src/data/iching/hexagramProfile'
import { hexRecommendation, hexDepthProgress, yaoEvidence } from '../src/data/iching/hexMastery'

describe('卦/爻 · R2-1.5 新字段接线', () => {
  it('每卦 sourceInfo：卦辞/爻辞/大象 verified，彖传/小象 needs_review（不冒充已核对）', () => {
    for (const p of HEXAGRAM_PROFILES) {
      expect(p.sourceInfo.guaci.confidence).toBe('verified')
      expect(p.sourceInfo.yaoci.confidence).toBe('verified')
      expect(p.sourceInfo.daxiang.confidence).toBe('verified')
      expect(p.sourceInfo.tuan.confidence).toBe('needs_review')
      expect(p.sourceInfo.xiaoxiang.confidence).toBe('needs_review')
    }
  })

  it('每卦都有 daXiang，且与 tenWings.daxiang 同源；classicPassageIds / caseIds 均已接线且非空', () => {
    for (const p of HEXAGRAM_PROFILES) {
      expect(p.daXiang).toBeTruthy()
      expect(p.daXiang.text).toBe(p.tenWings.daxiang.text)
      expect(Array.isArray(p.classicPassageIds)).toBe(true)
      expect(p.classicPassageIds.length, `${p.name} 缺经典关联`).toBeGreaterThan(0)
      expect(Array.isArray(p.caseIds)).toBe(true)
      expect(p.caseIds.length, `${p.name} 缺案例关联`).toBeGreaterThan(0)
    }
  })

  it('每爻 sourceInfo（爻辞/小象）与经典关联非空', () => {
    for (const y of ALL_YAO) {
      expect(y.sourceInfo.yaoci.confidence).toBe('verified')
      expect(y.sourceInfo.xiaoxiang.confidence).toBe('needs_review')
      expect(Array.isArray(y.classicPassageIds)).toBe(true)
      expect(y.classicPassageIds.length, `${y.id} 缺经典关联`).toBeGreaterThan(0)
    }
  })

  it('彖传 / 小象（六条）/ 系辞 原文保持 null：未逐卦核对时绝不编造', () => {
    for (const p of HEXAGRAM_PROFILES) {
      expect(p.tenWings.tuan.text).toBeNull()
      expect(p.tenWings.xiaoxiang.text).toBeNull()
      expect(p.tenWings.xici.text).toBeNull()
      for (const y of p.yao) {
        expect(y.tenWings.xiaoxiang.text).toBeNull()
      }
    }
  })

  it('解释传统不产生重复：TRADITION_REF key 唯一，每卦/每爻只挂同套传统', () => {
    const keys = TRADITION_REF.map((t) => t.key)
    expect(new Set(keys).size).toBe(keys.length)
    for (const p of HEXAGRAM_PROFILES) {
      expect(p.interpretationTraditions.map((t) => t.key)).toEqual(keys)
    }
  })
})

describe('Agent 推荐 · 基于真实学习状态（deterministic）', () => {
  const empty = { mastery: {}, hexEvidence: {}, hexNotes: {}, quizHistory: [] }

  it('全新用户：乾卦推荐为 start（未接触）', () => {
    const rec = hexRecommendation(empty, 1)
    expect(rec).toBeTruthy()
    expect(rec.kind).toBe('start')
    expect(rec.why).toContain('0')
    expect(typeof rec.body).toBe('string')
  })

  it('同一 state 多次调用返回一致结果（无随机）', () => {
    const state = { mastery: { 'hx-1': 2, 'hx-1-0': 2, 'hx-1-1': 3, 'hx-1-2': 3, 'hx-1-3': 3, 'hx-1-4': 3, 'hx-1-5': 3 }, hexEvidence: {}, hexNotes: {}, quizHistory: [] }
    const a = hexRecommendation(state, 1)
    const b = hexRecommendation(state, 1)
    expect(a).toEqual(b)
  })

  it('推荐理由引用真实掌握度数值（why 非空且包含实证信息）', () => {
    const rec = hexRecommendation(empty, 1)
    expect(rec.why.length).toBeGreaterThan(0)
    expect(rec.why).toMatch(/掌握度|未接触|爻/)
  })

  it('过度包装的「机运/命中」式空话不应出现在推荐理由中', () => {
    const state = { mastery: { 'hx-1': 6, 'hx-1-0': 6, 'hx-1-1': 6, 'hx-1-2': 6, 'hx-1-3': 6, 'hx-1-4': 6, 'hx-1-5': 6 }, hexEvidence: { 'hx-1': { tradition: true } }, hexNotes: {}, quizHistory: [] }
    const rec = hexRecommendation(state, 1)
    expect(rec.why).not.toMatch(/最近很适合|机缘已到|注定|命中/)
  })
})

describe('深度进度 / 学习证据 · 八阶段（从真实行为推导）', () => {
  const empty = { mastery: {}, hexEvidence: {}, hexNotes: {}, quizHistory: [] }

  it('hexDepthProgress 输出八阶段，含「认识→原典→六爻→结构→易传→传统→案例→独立分析」', () => {
    const depth = hexDepthProgress(empty, 1)
    expect(depth).toHaveLength(8)
    const labels = depth.map((s) => s.label)
    expect(labels).toEqual(['认识', '原典', '六爻', '结构', '易传', '传统', '案例', '独立分析'])
    for (const s of depth) {
      expect(['done', 'partial', 'todo']).toContain(s.status)
    }
  })

  it('yaoEvidence 返回六个证据维度（阅读/结构/原典/案例/传统/独立分析）', () => {
    const ev = yaoEvidence(empty, 1, 4)
    for (const k of ['read', 'structure', 'original', 'cases', 'tradition', 'analyze']) {
      expect(k in ev).toBe(true)
    }
    // 全新用户无任何学习证据
    expect(ev.read).toBe(false)
    expect(ev.analyze).toBe(false)
  })

  it('记录了阅读证据后，read 变 true；但仅阅读不足以判定「独立分析」', () => {
    const state = { mastery: {}, hexEvidence: { 'hx-1-4': { read: true, original: true } }, hexNotes: {}, quizHistory: [] }
    const ev = yaoEvidence(state, 1, 4)
    expect(ev.read).toBe(true)
    expect(ev.original).toBe(true)
    expect(ev.analyze).toBe(false) // 看过 ≠ 独立分析过
  })
})