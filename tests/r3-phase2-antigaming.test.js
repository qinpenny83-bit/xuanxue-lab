// ============================================================
// R3 Phase 2 · 防刷（Anti-gaming）测试
//
// 核心目标：用户不能通过「疯狂点击 / 重复同一对象」刷成高手。
// ============================================================
import { describe, it, expect } from 'vitest'
import { evidenceMasteryContribution, getLearningState, behaviorLevelOf } from '../src/agent/unifiedLearningState'
import { createEvidence } from '../src/agent/learningEvidence'
import { initialState } from '../src/lib/storage'

const viewOn = (targetId) =>
  createEvidence({ source: 'workshop', action: 'view', targetType: 'hexagram', targetId, timestamp: Date.now() - 1000 })

const constructOn = (targetId) =>
  createEvidence({ source: 'workshop', action: 'construct', targetType: 'hexagram', targetId, context: '这是我的一段分析', timestamp: Date.now() - 1000 })

// ─────────────────────────────────────────────────────────────
describe('反刷核心 · 点击不产生能力', () => {
  it('连续打开同一个卦 100 次，不产生任何能力贡献', () => {
    const list = Array.from({ length: 100 }, () => viewOn(1))
    expect(evidenceMasteryContribution(list)).toEqual({})
  })

  it('连续打开同一个卦 100 次，不会成为高手', () => {
    const state = { ...initialState, evidence: Array.from({ length: 100 }, () => viewOn(1)) }
    const ls = getLearningState(state)
    expect(ls.behavior.totalActions).toBe(100) // 行为有记录
    expect(ls.strongSkills).toEqual([]) // 但没有强项
    const keys = ls.weakSkills.map((w) => w.key)
    expect(keys).toContain('evidence')
    expect(keys).toContain('counterexample')
    expect(keys).toContain('uncertainty')
    expect(ls.recommendationSignals.READY_FOR_INDEPENDENCE).toBeUndefined()
  })

  it('纯 view 永远只是 PASSIVE_VIEW（即便 100 次）', () => {
    const list = Array.from({ length: 100 }, () => viewOn(1))
    for (const e of list) {
      expect(behaviorLevelOf(e)).toBe('PASSIVE_VIEW')
    }
  })
})

// ─────────────────────────────────────────────────────────────
describe('反刷核心 · 同一对象重复操作不叠加', () => {
  it('对同一对象 construct 100 次，uniqueTargets 仍只有 1', () => {
    const list = Array.from({ length: 100 }, () => constructOn(1))
    const c = evidenceMasteryContribution(list)
    expect(c.synthesis.uniqueTargets).toBe(1)
    expect(c.synthesis.count).toBe(1)
    expect(c.synthesis.score).toBe(12) // 单对象固定 12 分
  })

  it('对同一对象 analyze 100 次（都含结构词），不叠加', () => {
    const list = Array.from({ length: 100 }, () =>
      createEvidence({ source: 'workshop', action: 'analyze', targetType: 'hexagram', targetId: 1, context: '九三处于下卦，与上九对应', timestamp: Date.now() - 1000 }),
    )
    const c = evidenceMasteryContribution(list)
    expect(c.reasoning.uniqueTargets).toBe(1)
  })
})

// ─────────────────────────────────────────────────────────────
describe('反刷核心 · 多对象收益递减且封顶', () => {
  it('不同对象越多收益越递减', () => {
    const one = evidenceMasteryContribution([constructOn(1)]).synthesis.score
    const two = evidenceMasteryContribution([constructOn(1), constructOn(2)]).synthesis.score
    const three = evidenceMasteryContribution([constructOn(1), constructOn(2), constructOn(3)]).synthesis.score
    expect(one).toBe(12)
    expect(two).toBeGreaterThan(one)
    expect(three).toBeGreaterThan(two)
    // 递增的边际递减：第二个对象的增量 > 第三个对象的增量
    expect(two - one).toBeGreaterThan(three - two)
  })

  it('单维度贡献封顶 60 分，无法刷到高手级别', () => {
    const list = Array.from({ length: 200 }, (_, i) => constructOn(i + 1))
    const c = evidenceMasteryContribution(list)
    expect(c.synthesis.score).toBeLessThanOrEqual(60)
    expect(c.synthesis.capped).toBe(true)
  })

  it('即使 200 个不同对象，也不会被刷成高手（等级仍 L0，单维封顶 60）', () => {
    const state = { ...initialState, evidence: Array.from({ length: 200 }, (_, i) => constructOn(i + 1)) }
    const ls = getLearningState(state)
    // 能力档案已吸收证据贡献（单一事实源），但只封顶 60 托底，不会刷成高手
    expect(ls.mastery.profile.level).toBe('L0')
    expect(ls.mastery.profile.synthesis).toBeLessThanOrEqual(60)
    expect(ls.recommendationSignals.READY_FOR_INDEPENDENCE).toBeUndefined()
  })
})

// ─────────────────────────────────────────────────────────────
describe('反刷核心 · 错误行为不能简单加分', () => {
  it('errorTypes 不参与能力贡献计算（犯错不会被当成加分项）', () => {
    const withErr = createEvidence({ source: 'doubt', action: 'challenge', targetType: 'doubt', targetId: 'a', errorTypes: ['E04'], timestamp: Date.now() - 1000 })
    const withoutErr = createEvidence({ source: 'doubt', action: 'challenge', targetType: 'doubt', targetId: 'a', timestamp: Date.now() - 1000 })
    const c1 = evidenceMasteryContribution([withErr])
    const c2 = evidenceMasteryContribution([withoutErr])
    // 犯错不会加分：带错误的证据「权重减半」，贡献更低（而非更高）
    expect(c1.independence.score).toBeLessThan(c2.independence.score)
  })

  it('重复错误进入错误博物馆（REPEATED_ERROR），而不是转成能力', () => {
    const list = []
    for (let i = 0; i < 2; i++) {
      list.push(createEvidence({ source: 'doubt', action: 'challenge', targetType: 'doubt', targetId: `d${i}`, errorTypes: ['E04'], timestamp: Date.now() - 1000 }))
    }
    const ls = getLearningState({ ...initialState, evidence: list })
    expect(ls.recommendationSignals.REPEATED_ERROR.active).toBe(true)
    const c = evidenceMasteryContribution(list)
    expect(c.independence.score).toBeLessThanOrEqual(60)
  })
})