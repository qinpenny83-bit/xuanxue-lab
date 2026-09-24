// ============================================================
// R3 Phase 2 · Unified Learning State 测试
//
// 覆盖：
//   1. 确定性 Evidence→Mastery 规则（门槛/结构条件/内容门槛）
//   2. 行为分级（PASSIVE_VIEW / MEANINGFUL_VIEW / ACTIVE_ANALYSIS）
//   3. evidenceMasteryContribution 防刷（去重/递减/封顶）
//   4. getLearningState 聚合（behavior/mastery/errors/experiments/…）
//   5. 冲突裁决 preferEvidence
// ============================================================
import { describe, it, expect } from 'vitest'
import {
  BEHAVIOR_LEVELS,
  MASTERY_ACTION_RULES,
  evidenceMasteryContribution,
  behaviorLevelOf,
  targetBehaviorLevel,
  preferEvidence,
  getLearningState,
  evidenceText,
} from '../src/agent/unifiedLearningState'
import { createEvidence } from '../src/agent/learningEvidence'
import { DIMENSION_KEYS } from '../src/agent/masteryEngine'
import { initialState } from '../src/lib/storage'

// ─────────────────────────────────────────────────────────────
describe('MASTERY_ACTION_RULES · 确定性规则', () => {
  it('view 不产生能力贡献', () => {
    expect(MASTERY_ACTION_RULES.view.mastery).toBe(false)
    expect(MASTERY_ACTION_RULES.view.dim).toBeNull()
  })

  it('observe 用户明确要求：不直接加 mastery', () => {
    expect(MASTERY_ACTION_RULES.observe.mastery).toBe(false)
    expect(MASTERY_ACTION_RULES.identify.mastery).toBe(false)
    expect(MASTERY_ACTION_RULES.sample.mastery).toBe(false)
    expect(MASTERY_ACTION_RULES.inspect.mastery).toBe(false)
    expect(MASTERY_ACTION_RULES.predict.mastery).toBe(false)
  })

  it('analyze 需满足结构条件；construct/evidence/… 需有内容', () => {
    expect(MASTERY_ACTION_RULES.analyze.requiresStructure).toBe(true)
    expect(MASTERY_ACTION_RULES.construct.requiresContent).toBe(true)
    expect(MASTERY_ACTION_RULES.evidence.requiresContent).toBe(true)
    expect(MASTERY_ACTION_RULES.counterexample.requiresContent).toBe(true)
    expect(MASTERY_ACTION_RULES.revise.requiresContent).toBe(true)
    expect(MASTERY_ACTION_RULES.reflect.requiresContent).toBe(true)
  })

  it('维度映射符合规格：evidence→evidence / counterexample→counterexample / reflect→uncertainty', () => {
    expect(MASTERY_ACTION_RULES.evidence.dim).toBe('evidence')
    expect(MASTERY_ACTION_RULES.counterexample.dim).toBe('counterexample')
    expect(MASTERY_ACTION_RULES.reflect.dim).toBe('uncertainty')
    expect(MASTERY_ACTION_RULES.construct.dim).toBe('synthesis')
    expect(MASTERY_ACTION_RULES.challenge.dim).toBe('independence')
    expect(MASTERY_ACTION_RULES.revise.dim).toBe('reasoning')
  })

  it('complete / retry / save 都不产生能力贡献', () => {
    for (const a of ['complete', 'retry', 'save']) {
      expect(MASTERY_ACTION_RULES[a].mastery).toBe(false)
    }
  })
})

// ─────────────────────────────────────────────────────────────
describe('evidenceMasteryContribution · 门槛 / 去重 / 递减 / 封顶', () => {
  it('空列表返回空对象', () => {
    expect(evidenceMasteryContribution([])).toEqual({})
    expect(evidenceMasteryContribution(null)).toEqual({})
  })

  it('view 不产生任何贡献', () => {
    const list = [createEvidence({ source: 'workshop', action: 'view', targetType: 'hexagram', targetId: 1 })]
    expect(evidenceMasteryContribution(list)).toEqual({})
  })

  it('observe 即使有内容也不加分（observe 只做记录）', () => {
    const list = [createEvidence({ source: 'experiment', action: 'observe', targetType: 'hexagram', targetId: 1, context: '六爻皆阳，层层向上' })]
    expect(evidenceMasteryContribution(list)).toEqual({})
  })

  it('construct 有内容才贡献 synthesis，且单对象 score=12', () => {
    const list = [createEvidence({ source: 'workshop', action: 'construct', targetType: 'hexagram', targetId: 1, context: '乾卦讲的是健行之时位' })]
    const c = evidenceMasteryContribution(list)
    expect(c.synthesis.uniqueTargets).toBe(1)
    expect(c.synthesis.count).toBe(1)
    expect(c.synthesis.score).toBe(12)
    expect(c.synthesis.capped).toBe(false)
  })

  it('construct 无内容（空文本）不加分（最低证据门槛）', () => {
    const list = [createEvidence({ source: 'workshop', action: 'construct', targetType: 'hexagram', targetId: 1, context: '' })]
    expect(evidenceMasteryContribution(list)).toEqual({})
  })

  it('analyze 无结构化信号不加分', () => {
    const list = [createEvidence({ source: 'workshop', action: 'analyze', targetType: 'hexagram', targetId: 1, context: '我觉得很不错' })]
    expect(evidenceMasteryContribution(list)).toEqual({})
  })

  it('analyze 有爻位/关系/文本信号才贡献 reasoning', () => {
    const list = [createEvidence({ source: 'workshop', action: 'analyze', targetType: 'yao', targetId: '1-2', context: '九三处于下卦之上，与上九对应' })]
    const c = evidenceMasteryContribution(list)
    expect(c.reasoning.uniqueTargets).toBe(1)
  })

  it('同一对象重复操作不重复计（防刷核心）', () => {
    const mk = () => createEvidence({ source: 'workshop', action: 'construct', targetType: 'hexagram', targetId: 1, context: '乾卦健行' })
    const list = [mk(), mk(), mk(), mk(), mk()]
    const c = evidenceMasteryContribution(list)
    expect(c.synthesis.uniqueTargets).toBe(1)
    expect(c.synthesis.count).toBe(1)
  })

  it('不同对象贡献递减并有封顶（score ≤ 60）', () => {
    const list = []
    for (let i = 1; i <= 100; i++) {
      list.push(createEvidence({ source: 'workshop', action: 'construct', targetType: 'hexagram', targetId: i, context: '卦象分析' }))
    }
    const c = evidenceMasteryContribution(list)
    expect(c.synthesis.uniqueTargets).toBe(100)
    expect(c.synthesis.score).toBeLessThanOrEqual(60)
    expect(c.synthesis.capped).toBe(true)
  })

  it('evidence / counterexample / reflect 按维度分离贡献', () => {
    const list = [
      createEvidence({ source: 'workshop', action: 'evidence', targetType: 'case', targetId: 'c1', context: '原文有直接依据' }),
      createEvidence({ source: 'workshop', action: 'counterexample', targetType: 'case', targetId: 'c1', context: '存在反例' }),
      createEvidence({ source: 'workshop', action: 'reflect', targetType: 'case', targetId: 'c1', context: '我在这一步最容易过度解释' }),
    ]
    const c = evidenceMasteryContribution(list)
    expect(c.evidence.uniqueTargets).toBe(1)
    expect(c.counterexample.uniqueTargets).toBe(1)
    expect(c.uncertainty.uniqueTargets).toBe(1)
  })
})

// ─────────────────────────────────────────────────────────────
describe('行为分级 · view 污染治理', () => {
  it('行为分级只有三档', () => {
    expect(BEHAVIOR_LEVELS).toEqual({
      PASSIVE_VIEW: 'PASSIVE_VIEW',
      MEANINGFUL_VIEW: 'MEANINGFUL_VIEW',
      ACTIVE_ANALYSIS: 'ACTIVE_ANALYSIS',
    })
  })

  it('纯 view（只看不写）→ PASSIVE_VIEW', () => {
    const ev = createEvidence({ source: 'workshop', action: 'view', targetType: 'hexagram', targetId: 1 })
    expect(behaviorLevelOf(ev)).toBe(BEHAVIOR_LEVELS.PASSIVE_VIEW)
  })

  it('observe 无内容/未完成 → PASSIVE_VIEW（不依赖停留时间）', () => {
    const short = createEvidence({ source: 'experiment', action: 'observe', targetType: 'hexagram', targetId: 1, context: '' })
    expect(behaviorLevelOf(short)).toBe(BEHAVIOR_LEVELS.PASSIVE_VIEW)
  })

  it('observe 有内容 → MEANINGFUL_VIEW', () => {
    const ev = createEvidence({ source: 'experiment', action: 'observe', targetType: 'hexagram', targetId: 1, context: '初九潜藏、九二见大人' })
    expect(behaviorLevelOf(ev)).toBe(BEHAVIOR_LEVELS.MEANINGFUL_VIEW)
  })

  it('observe 标注 complete=true → MEANINGFUL_VIEW', () => {
    const ev = createEvidence({ source: 'experiment', action: 'observe', targetType: 'hexagram', targetId: 1, metadata: { complete: true } })
    expect(behaviorLevelOf(ev)).toBe(BEHAVIOR_LEVELS.MEANINGFUL_VIEW)
  })

  it('主动提交分析（analyze/construct/evidence…）→ ACTIVE_ANALYSIS', () => {
    for (const a of ['analyze', 'construct', 'evidence', 'counterexample', 'revise', 'hypothesis', 'challenge']) {
      const ev = createEvidence({ source: 'workshop', action: a, targetType: 'hexagram', targetId: 1, context: 'x' })
      expect(behaviorLevelOf(ev), `action=${a}`).toBe(BEHAVIOR_LEVELS.ACTIVE_ANALYSIS)
    }
  })
})

// ─────────────────────────────────────────────────────────────
describe('targetBehaviorLevel · 取对象最高行为等级', () => {
  it('无记录返回 null', () => {
    expect(targetBehaviorLevel([], 'hexagram', 1)).toBeNull()
  })

  it('只有 view → PASSIVE_VIEW', () => {
    const ev = [createEvidence({ source: 'workshop', action: 'view', targetType: 'hexagram', targetId: 1 })]
    expect(targetBehaviorLevel(ev, 'hexagram', 1)).toBe(BEHAVIOR_LEVELS.PASSIVE_VIEW)
  })

  it('view + observe(有内容) → MEANINGFUL_VIEW', () => {
    const ev = [
      createEvidence({ source: 'workshop', action: 'view', targetType: 'hexagram', targetId: 1 }),
      createEvidence({ source: 'experiment', action: 'observe', targetType: 'hexagram', targetId: 1, context: '六爻皆阳' }),
    ]
    expect(targetBehaviorLevel(ev, 'hexagram', 1)).toBe(BEHAVIOR_LEVELS.MEANINGFUL_VIEW)
  })

  it('一旦主动分析 → ACTIVE_ANALYSIS（最高优先）', () => {
    const ev = [
      createEvidence({ source: 'workshop', action: 'view', targetType: 'hexagram', targetId: 1 }),
      createEvidence({ source: 'workshop', action: 'analyze', targetType: 'hexagram', targetId: 1, context: 'x' }),
    ]
    expect(targetBehaviorLevel(ev, 'hexagram', 1)).toBe(BEHAVIOR_LEVELS.ACTIVE_ANALYSIS)
  })
})

// ─────────────────────────────────────────────────────────────
describe('preferEvidence · 冲突裁决（Evidence 优先）', () => {
  it('有证据派生值时以证据为准', () => {
    expect(preferEvidence(5, 0)).toBe(5)
    expect(preferEvidence(0, 3)).toBe(0) // 0 也是有效值
  })

  it('证据缺失时回退 fallback', () => {
    expect(preferEvidence(null, 3)).toBe(3)
    expect(preferEvidence(undefined, 3)).toBe(3)
  })
})

// ─────────────────────────────────────────────────────────────
describe('getLearningState · 统一只读聚合', () => {
  it('返回完整聚合结构（11+ 个顶层键）', () => {
    const ls = getLearningState({ ...initialState })
    for (const k of ['behavior', 'mastery', 'errors', 'experiments', 'doubts', 'recentTargets', 'recentEvidence', 'weakSkills', 'strongSkills', 'uncertainty', 'recommendationSignals']) {
      expect(ls, `缺 key ${k}`).toHaveProperty(k)
    }
  })

  it('新用户（无证据）→ 薄弱技能自动浮现关键维度', () => {
    const ls = getLearningState({ ...initialState })
    const keys = ls.weakSkills.map((w) => w.key)
    expect(keys).toContain('evidence')
    expect(keys).toContain('counterexample')
    expect(keys).toContain('uncertainty')
    expect(ls.strongSkills).toEqual([])
    expect(ls.behavior.totalActions).toBe(0)
  })

  it('behavior 聚合真实证据次数与来源/动作计数', () => {
    const ev = [
      createEvidence({ source: 'workshop', action: 'construct', targetType: 'hexagram', targetId: 1, context: 'x' }),
      createEvidence({ source: 'experiment', action: 'hypothesis', targetType: 'experiment', targetId: 'e1', context: '假设' }),
      createEvidence({ source: 'workshop', action: 'view', targetType: 'hexagram', targetId: 2 }),
    ]
    const ls = getLearningState({ ...initialState, evidence: ev })
    expect(ls.behavior.totalActions).toBe(3)
    expect(ls.behavior.byAction.construct).toBe(1)
    expect(ls.behavior.byAction.hypothesis).toBe(1)
    expect(ls.behavior.byAction.view).toBe(1)
    expect(ls.behavior.bySource.workshop).toBe(2)
    expect(ls.behavior.bySource.experiment).toBe(1)
  })

  it('recentEvidence 按时间升序且受 recentEvidenceCount 限制', () => {
    const ev = []
    for (let i = 0; i < 15; i++) {
      ev.push(createEvidence({ source: 'workshop', action: 'view', targetType: 'hexagram', targetId: i, timestamp: 1000 + i }))
    }
    const ls = getLearningState({ ...initialState, evidence: ev }, { now: 1000 + 100 })
    expect(ls.recentEvidence.length).toBeLessThanOrEqual(10)
    let last = -Infinity
    for (const e of ls.recentEvidence) {
      expect(e.timestamp).toBeGreaterThanOrEqual(last)
      last = e.timestamp
    }
  })

  it('mastery 单一事实源：证据贡献已并入能力档案', () => {
    const ev = [createEvidence({ source: 'workshop', action: 'construct', targetType: 'hexagram', targetId: 1, context: '乾卦健行' })]
    const ls = getLearningState({ ...initialState, evidence: ev })
    expect(ls.mastery.profile).toBeTruthy()
    expect(ls.mastery.contribution.synthesis).toBeTruthy()
    expect(ls.mastery.contribution.synthesis.score).toBe(12)
    // 证据贡献已并入能力档案（单一事实源），synthesis 不再是 0
    expect(ls.mastery.profile.synthesis).toBe(12)
    expect(ls.mastery.profile.overall).toBeGreaterThan(0)
  })

  it('errors 聚合 errorPatterns 与 evidence 中的重复错误', () => {
    const ev = [
      createEvidence({ source: 'doubt', action: 'challenge', targetType: 'doubt', targetId: 'a', errorTypes: ['E04'], timestamp: Date.now() - 1000 }),
      createEvidence({ source: 'doubt', action: 'challenge', targetType: 'doubt', targetId: 'b', errorTypes: ['E04'], timestamp: Date.now() - 900 }),
    ]
    const ls = getLearningState({ ...initialState, evidence: ev, errorPatterns: { E04: 2 } })
    expect(ls.errors.top[0].code).toBe('E04')
    expect(ls.errors.repeated.some((e) => e.code === 'E04')).toBe(true)
  })

  it('experiments / doubts / beliefRevisions 聚合到统一状态', () => {
    const state = {
      ...initialState,
      experimentRuns: [{ runId: 'r1', completedAt: 1 }],
      beliefRevisions: [{ originalClaim: '得位是吉', revisedClaim: '得位不一定是吉' }],
    }
    const ls = getLearningState(state)
    expect(ls.experiments.runs).toBe(1)
    expect(ls.experiments.completed).toBe(1)
    expect(ls.experiments.beliefRevisions.length).toBe(1)
  })
})

// ─────────────────────────────────────────────────────────────
describe('evidenceText · 开放文本抽取', () => {
  it('优先 context → result 字符串 → result.text → metadata.text', () => {
    expect(evidenceText(createEvidence({ context: 'a' }))).toBe('a')
    expect(evidenceText(createEvidence({ result: 'b' }))).toBe('b')
    expect(evidenceText(createEvidence({ result: { text: 'c' } }))).toBe('c')
    expect(evidenceText(createEvidence({ metadata: { text: 'd' } }))).toBe('d')
  })

  it('空返回空字符串', () => {
    expect(evidenceText(null)).toBe('')
    expect(evidenceText(createEvidence({}))).toBe('')
  })
})