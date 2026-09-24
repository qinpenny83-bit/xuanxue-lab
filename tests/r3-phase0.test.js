// ============================================================
// R3 Phase 0 · 学习证据层 + 实验/怀疑数据基础 测试
//
// 覆盖：
//   1. LearningEvidence 创建 / 去重 / 筛选 / 统计 / 近 7 天
//   2. 存储（版本迁移）+ reducer（RECORD_EVIDENCE）集成
//   3. ExperimentProfile ≥30 个，samplePool 真实、seed 可复现、引用有效
//   4. DoubtTask ≥160 题，引用 ID / errorType / masteryKey 全部有效
//   5. Linkage：Workshop/Experiment/Doubt → Evidence → Error/Mastery/Agent
// ============================================================
import { describe, it, expect } from 'vitest'
import {
  createEvidence,
  recordEvidence,
  filterEvidence,
  getRecentEvidence,
  summarizeEvidence,
  ACTION_TO_SKILL,
  REASON_CODES,
  DAY_MS,
  EVIDENCE_SOURCES,
  EVIDENCE_ACTIONS,
  EVIDENCE_TARGET_TYPES,
} from '../src/agent/learningEvidence'
import { renderRecentSummary, targetLabel } from '../src/agent/evidenceLabel'
import {
  EXPERIMENTS_V3,
  getExperimentV3,
  sampleExperiment,
} from '../src/data/experiments-v3'
import {
  DOUBT_TASKS,
  getDoubtTask,
  doubtCategoryCount,
} from '../src/data/doubtTasks'
import { getHexagramProfile, getYao, TRADITION_REF } from '../src/data/iching/hexagramProfile'
import { getTerm } from '../src/data/iching/termData'
import { getClassicPassage } from '../src/data/iching/classic-passages'
import { getCase } from '../src/data/cases'
import { ERROR_TYPES } from '../src/agent/errors'
import { DIMENSION_KEYS } from '../src/agent/masteryEngine'
import { reducer } from '../src/store/reducer'
import { initialState, importJSON } from '../src/lib/storage'

const TRADITION_KEYS = TRADITION_REF.map((t) => t.key)

// ─────────────────────────────────────────────────────────────
describe('LearningEvidence · 数据模型', () => {
  it('source / action / targetType 枚举与规格一致', () => {
    expect(EVIDENCE_SOURCES).toEqual(
      ['workshop', 'experiment', 'doubt', 'case', 'lesson', 'classic', 'review', 'agent', 'path', 'challenge'],
    )
    // action 至少覆盖规格指定的 20 种
    for (const a of ['view', 'observe', 'identify', 'analyze', 'compare', 'interpret', 'construct', 'hypothesis', 'predict', 'sample', 'inspect', 'evidence', 'counterexample', 'revise', 'reflect', 'challenge', 'complete', 'retry', 'save', 'pass']) {
      expect(EVIDENCE_ACTIONS).toContain(a)
    }
    for (const t of ['hexagram', 'yao', 'term', 'classic', 'tradition', 'case', 'experiment', 'doubt', 'workshop', 'stage']) {
      expect(EVIDENCE_TARGET_TYPES).toContain(t)
    }
  })

  it('createEvidence 生成规范字段', () => {
    const ev = createEvidence({ source: 'experiment', action: 'hypothesis', targetType: 'hexagram', targetId: 1, timestamp: 1000 })
    expect(ev.version).toBe(1)
    expect(ev.id).toContain('ev-experiment')
    expect(ev.source).toBe('experiment')
    expect(ev.action).toBe('hypothesis')
    expect(ev.targetType).toBe('hexagram')
    expect(ev.targetId).toBe(1)
    expect(ev.skill).toBe('reasoning') // hypothesis → reasoning
    expect(ev.errorTypes).toEqual([])
    expect(ev.beforeMastery).toBeNull()
    expect(ev.afterMastery).toBeNull()
    expect(ev.metadata).toBeNull()
  })

  it('action → skill 只映射到现有 8 维能力', () => {
    for (const skill of Object.values(ACTION_TO_SKILL)) {
      expect(DIMENSION_KEYS).toContain(skill)
    }
  })
})

// ─────────────────────────────────────────────────────────────
describe('LearningEvidence · 去重 / 筛选 / 统计', () => {
  it('recordEvidence 追加，且同动作 2 秒内去重', () => {
    const partial = { source: 'doubt', action: 'challenge', targetType: 'doubt', targetId: 'flaw-01' }
    const l1 = recordEvidence([], { ...partial, timestamp: 1000 })
    expect(l1.length).toBe(1)
    const l2 = recordEvidence(l1, { ...partial, timestamp: 2500 }) // 1.5s → 去重
    expect(l2.length).toBe(1)
    const l3 = recordEvidence(l2, { ...partial, timestamp: 4000 }) // 3s → 追加
    expect(l3.length).toBe(2)
    // 不同 targetId 不去重
    const l4 = recordEvidence(l3, { ...partial, targetId: 'flaw-02', timestamp: 4100 })
    expect(l4.length).toBe(3)
  })

  it('filterEvidence 按 source / action / targetType / targetId / days 筛选，时间升序', () => {
    const now = 1_000_000
    const arr = [
      createEvidence({ source: 'workshop', action: 'analyze', targetType: 'hexagram', targetId: 1, timestamp: now - DAY_MS * 10 }),
      createEvidence({ source: 'doubt', action: 'challenge', targetType: 'doubt', targetId: 'flaw-01', timestamp: now - DAY_MS * 2 }),
      createEvidence({ source: 'experiment', action: 'hypothesis', targetType: 'hexagram', targetId: 1, timestamp: now - 1000 }),
    ]
    expect(filterEvidence(arr, { source: 'doubt' }).length).toBe(1)
    expect(filterEvidence(arr, { targetType: 'hexagram' }).length).toBe(2)
    expect(filterEvidence(arr, { targetId: 1 }).length).toBe(2)
    expect(filterEvidence(arr, { days: 7 }, { now }).length).toBe(2)
    expect(filterEvidence(arr, { action: 'analyze' }).length).toBe(1)
    const sorted = filterEvidence(arr, {})
    let last = -Infinity
    for (const e of sorted) { expect(e.timestamp).toBeGreaterThanOrEqual(last); last = e.timestamp }
  })

  it('getRecentEvidence 支持最近 7 天 / 30 天', () => {
    const now = 1_000_000
    const arr = [
      createEvidence({ source: 'agent', action: 'view', targetType: 'term', targetId: 'yaoci', timestamp: now - DAY_MS * 3 }),
      createEvidence({ source: 'agent', action: 'view', targetType: 'term', targetId: 'guaci', timestamp: now - DAY_MS * 10 }),
    ]
    expect(getRecentEvidence(arr, { days: 7, now }).length).toBe(1)
    expect(getRecentEvidence(arr, { days: 30, now }).length).toBe(2)
  })

  it('summarizeEvidence 统计假设/反例/证据检查/修改数，且行为次数≠能力', () => {
    const arr = [
      createEvidence({ source: 'experiment', action: 'hypothesis', targetType: 'hexagram', targetId: 1, timestamp: 1 }),
      createEvidence({ source: 'experiment', action: 'counterexample', targetType: 'hexagram', targetId: 1, timestamp: 2 }),
      createEvidence({ source: 'doubt', action: 'revise', targetType: 'doubt', targetId: 'flaw-01', timestamp: 3 }),
    ]
    const sum = summarizeEvidence(arr)
    expect(sum.totalActions).toBe(3)
    expect(sum.experimentActions).toBe(2)
    expect(sum.doubtActions).toBe(1)
    expect(sum.workshopActions).toBe(0)
    expect(sum.hypothesisCount).toBe(1)
    expect(sum.counterexampleCount).toBe(1)
    expect(sum.revisionCount).toBe(1)
    // 关键：汇总只输出「次数」，不输出任何 +mastery 的伪结论
    expect(sum).not.toHaveProperty('mastery')
    expect(sum).not.toHaveProperty('capability')
  })

  it('重复错误通过 errorTypes 统计为 repeatedErrors', () => {
    const arr = [
      createEvidence({ source: 'doubt', action: 'challenge', targetType: 'doubt', targetId: 'a', errorTypes: ['E04'], timestamp: 1 }),
      createEvidence({ source: 'doubt', action: 'challenge', targetType: 'doubt', targetId: 'b', errorTypes: ['E04'], timestamp: 2 }),
    ]
    const sum = summarizeEvidence(arr)
    expect(sum.repeatedErrors.some((e) => e.code === 'E04')).toBe(true)
  })
})

// ─────────────────────────────────────────────────────────────
describe('LearningEvidence · 验收：最近 7 天做了什么（来自真实 Evidence）', () => {
  it('renderRecentSummary 从真实证据推导高频对象 / 薄弱行为 / 重复错误', () => {
    const now = Date.now()
    const base = { timestamp: now - 1000 }
    const ev = (p) => createEvidence({ ...base, ...p })
    const arr = [
      ev({ source: 'workshop', action: 'hypothesis', targetType: 'hexagram', targetId: 1 }),
      ev({ source: 'workshop', action: 'hypothesis', targetType: 'yao', targetId: '1-2' }),
      ev({ source: 'workshop', action: 'counterexample', targetType: 'hexagram', targetId: 1 }),
      ev({ source: 'workshop', action: 'counterexample', targetType: 'hexagram', targetId: 1 }),
      ev({ source: 'doubt', action: 'revise', targetType: 'doubt', targetId: 'flaw-01' }),
      ev({ source: 'doubt', action: 'challenge', targetType: 'doubt', targetId: 'flaw-02', errorTypes: ['E04', 'E04'] }),
    ]
    const text = renderRecentSummary(arr, { now })
    // 必须来自真实统计，而非写死
    expect(text).toContain('近期高频对象')
    expect(text).toContain('假设') // hypothesis ×2
    expect(text).toContain('反例') // counterexample ×2
    expect(text).toContain('修改') // revise ×1
    expect(text).toContain('E04') // 重复错误
  })

  it('证据/反例都没碰过 → 薄弱行为自动浮现，不写死', () => {
    const arr = [createEvidence({ source: 'workshop', action: 'analyze', targetType: 'hexagram', targetId: 1, timestamp: 1 })]
    const sum = summarizeEvidence(arr)
    const weak = sum.weakBehaviors.map((b) => b.skill)
    expect(weak).toContain('evidence')
    expect(weak).toContain('counterexample')
    expect(weak).toContain('uncertainty')
  })

  it('targetLabel 解析真实卦 / 爻 / 术语', () => {
    expect(targetLabel('hexagram', 1)).toContain('乾')
    expect(targetLabel('yao', '1-0')).toContain('乾')
    const t = getTerm('yaoci')
    expect(t).toBeTruthy()
    expect(targetLabel('term', 'yaoci')).toBe(t.term)
    expect(targetLabel('term', '__不存在__')).toBe('__不存在__')
  })

  it('targetLabel 解析课程题目 questionId 为可读标签，不露英文内部 ID', () => {
    expect(targetLabel('question', 'lesson-yin-yang:s1:v800800011')).toBe('阴阳不是好坏 · 第2步')
  })
})

// ─────────────────────────────────────────────────────────────
describe('存储 & reducer · 持久化 / 版本迁移 / RECORD_EVIDENCE', () => {
  it('initialState 含 evidence: []（旧用户数据自动补默认，不破坏既有字段）', () => {
    expect(Array.isArray(initialState.evidence)).toBe(true)
    const merged = importJSON('{"version":1,"xp":123,"completedCases":{"c1":{}}}')
    expect(merged.evidence).toEqual([])
    expect(merged.xp).toBe(123)
    expect(merged.completedCases).toEqual({ c1: {} })
  })

  it('RECORD_EVIDENCE 持久化证据并捕获 beforeMastery（Evidence → Mastery）', () => {
    const s0 = { ...initialState, masteryProfile: { overall: 55, reasoning: 40 } }
    const s1 = reducer(s0, {
      type: 'RECORD_EVIDENCE',
      evidence: { source: 'workshop', action: 'analyze', targetType: 'hexagram', targetId: 1 },
    })
    expect(s1.evidence.length).toBe(1)
    const e = s1.evidence[0]
    expect(DIMENSION_KEYS).toContain(e.skill) // analyze → reasoning
    expect(e.beforeMastery).toBe(55) // 无显式 skill 时回落到 overall 快照
    // 关键：记录证据不直接 bump「节点掌握度」（行为次数 ≠ 节点掌握度）
    expect(s1.mastery).toEqual(s0.mastery)
    // R3 Phase 2.5：能力档案改为「caseAttempts + Evidence」单一事实源，RECORD_EVIDENCE 后立即重算。
    // 本条 analyze 无内容（requiresStructure 不满足），不产生证据贡献 → 档案按真实数据重算为 L0。
    expect(s1.masteryProfile.level).toBe('L0')
    expect(s1.masteryProfile.overall).toBe(0)
  })

  it('RECORD_EVIDENCE 携带 errorTypes 时同步进 errorMuseum（errorPatterns + errorEvents）', () => {
    const s1 = reducer({ ...initialState }, {
      type: 'RECORD_EVIDENCE',
      evidence: { source: 'doubt', action: 'challenge', targetType: 'doubt', targetId: 'flaw-01', errorTypes: ['E04', 'E07'] },
    })
    expect(s1.errorPatterns.E04).toBe(1)
    expect(s1.errorPatterns.E07).toBe(1)
    expect(s1.errorEvents.length).toBe(2)
  })
})

// ─────────────────────────────────────────────────────────────
describe('ExperimentProfile · 全量 80 个实验', () => {
  const EXPECT_CATS = { structure: 18, text: 16, tradition: 16, cognitive: 15, evidence: 15 }

  it('≥80 个，分类严格符合 18/16/16/15/15（第一批 8/6/6/5/5 + 扩充 10×5）', () => {
    expect(EXPERIMENTS_V3.length).toBe(80)
    const count = {}
    for (const e of EXPERIMENTS_V3) count[e.category] = (count[e.category] || 0) + 1
    for (const [k, n] of Object.entries(EXPECT_CATS)) {
      expect(count[k], `分类 ${k}`).toBe(n)
    }
  })

  it('id 唯一，字段完整（question/hypothesis/samplePool/十步模板）', () => {
    const ids = EXPERIMENTS_V3.map((e) => e.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const e of EXPERIMENTS_V3) {
      expect(e.question).toBeTruthy()
      expect(e.hypothesis).toBeTruthy()
      expect(e.samplePool).toBeTruthy()
      expect(e.steps.length).toBe(10)
      expect(e.seed).toBe(e.id) // seed 默认等于 id，保证可复现
    }
  })

  it('sampleExperiment 解析到真实实体，且 seed 可复现', () => {
    const key = (list) => list.map((x) => `${x.type}:${x.seq ?? ''}:${x.pos ?? ''}`).join('|')
    for (const e of EXPERIMENTS_V3) {
      const a = sampleExperiment(e, { count: 5 })
      const b = sampleExperiment(e, { count: 5 })
      expect(a.length, `${e.id} 样本非空`).toBeGreaterThan(0)
      expect(key(a)).toBe(key(b)) // deterministic
      for (const s of a) expect(s.ref, `${e.id} 样本实体`).toBeTruthy()
    }
  })

  it('所有引用 ID 有效（术语/卦/爻/案例/经典/传统/错误类型）', () => {
    for (const e of EXPERIMENTS_V3) {
      for (const t of e.relatedTerms) expect(getTerm(t), `${e.id} term:${t}`).toBeTruthy()
      for (const h of e.hexagrams) expect(getHexagramProfile(h), `${e.id} hex:${h}`).toBeTruthy()
      for (const y of e.yaos) expect(getYao(y.seq, y.pos), `${e.id} yao:${y.seq}-${y.pos}`).toBeTruthy()
      for (const c of e.cases) expect(getCase(c), `${e.id} case:${c}`).toBeTruthy()
      for (const cl of e.classics) expect(getClassicPassage(cl), `${e.id} classic:${cl}`).toBeTruthy()
      for (const tr of e.traditions) expect(TRADITION_KEYS, `${e.id} tradition:${tr}`).toContain(tr)
      for (const er of e.errorTypes) expect(ERROR_TYPES[er], `${e.id} err:${er}`).toBeTruthy()
    }
  })

  it('getExperimentV3 / 分类检索可用', () => {
    expect(getExperimentV3('exp-s-dewei').title).toBe('得位一定好吗？')
    expect(getExperimentV3('__不存在__')).toBeNull()
  })
})

// ─────────────────────────────────────────────────────────────
describe('DoubtTask · ≥190 题', () => {
  const EXPECT_CATS = { flaw: 35, 'evidence-review': 35, counterexample: 35, deconstruct: 35, 'tradition-conflict': 25, 'self-doubt': 25 }

  it('≥190 题，分类严格符合 35/35/35/35/25/25（核心 20/20/20/20/5/5 + 扩充 10/10/10/10/15/15 + R6 5/5/5/5/5/5）', () => {
    expect(DOUBT_TASKS.length).toBe(190)
    const count = doubtCategoryCount()
    for (const [k, n] of Object.entries(EXPECT_CATS)) {
      expect(count[k], `分类 ${k}`).toBe(n)
    }
  })

  it('id 唯一，选项/正确项/推理/解析完整（区分选择题与开放题）', () => {
    const ids = DOUBT_TASKS.map((t) => t.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const t of DOUBT_TASKS) {
      expect(t.prompt, `${t.id} prompt`).toBeTruthy()
      expect(t.correctReasoning).toBeTruthy()
      expect(t.explanation).toBeTruthy()
      if (t.correctIndex != null) {
        // 选择题：必须有完整选项与正确项
        expect(t.options.length, `${t.id} 选项`).toBeGreaterThanOrEqual(2)
        expect(t.correctIndex).toBeGreaterThanOrEqual(0)
        expect(t.options[t.correctIndex], `${t.id} 正确项`).toBeTruthy()
      } else {
        // 开放题（反例猎人）：去 64卦/384爻 找反例，需有 statement + hint，无固定选项
        expect(t.statement, `${t.id} statement`).toBeTruthy()
        expect(t.hint, `${t.id} hint`).toBeTruthy()
      }
    }
  })

  it('所有引用 ID / errorType / masteryKey 有效', () => {
    for (const t of DOUBT_TASKS) {
      for (const term of t.relatedTerms) expect(getTerm(term), `${t.id} term:${term}`).toBeTruthy()
      for (const h of t.hexagrams) expect(getHexagramProfile(h), `${t.id} hex:${h}`).toBeTruthy()
      for (const y of t.yaos) expect(getYao(y.seq, y.pos), `${t.id} yao:${y.seq}-${y.pos}`).toBeTruthy()
      for (const tr of t.traditions) expect(TRADITION_KEYS, `${t.id} tradition:${tr}`).toContain(tr)
      for (const er of t.errorTypes) expect(ERROR_TYPES[er], `${t.id} err:${er}`).toBeTruthy()
      for (const mk of t.masteryKeys) expect(DIMENSION_KEYS, `${t.id} masteryKey:${mk}`).toContain(mk)
    }
  })

  it('getDoubtTask 可用', () => {
    expect(getDoubtTask('flaw-01').category).toBe('flaw')
    expect(getDoubtTask('__不存在__')).toBeNull()
  })
})

// ─────────────────────────────────────────────────────────────
describe('Linkage · 各入口 → Evidence → Error / Mastery / Agent', () => {
  it('Workshop → Evidence', () => {
    const s = reducer({ ...initialState }, {
      type: 'RECORD_EVIDENCE',
      evidence: { source: 'workshop', action: 'analyze', targetType: 'hexagram', targetId: 1, context: '64卦档案' },
    })
    expect(s.evidence[0].source).toBe('workshop')
  })

  it('Experiment → Evidence', () => {
    const s = reducer({ ...initialState }, {
      type: 'RECORD_EVIDENCE',
      evidence: { source: 'experiment', action: 'hypothesis', targetType: 'hexagram', targetId: 1 },
    })
    expect(s.evidence[0].source).toBe('experiment')
    expect(s.evidence[0].action).toBe('hypothesis')
  })

  it('Doubt → Evidence + errorMuseum（答错记录 errorType）', () => {
    const s = reducer({ ...initialState }, {
      type: 'RECORD_EVIDENCE',
      evidence: { source: 'doubt', action: 'challenge', targetType: 'doubt', targetId: 'flaw-01', errorTypes: ['E07'], result: 'wrong' },
    })
    expect(s.evidence.some((e) => e.source === 'doubt')).toBe(true)
    expect(s.evidence[0].errorTypes).toContain('E07')
    expect(s.errorPatterns.E07).toBe(1)
    expect(s.errorEvents.some((e) => e.code === 'E07')).toBe(true)
  })

  it('Evidence → Agent：reason code 候选齐全，弱项从证据推导而不写死', () => {
    expect(Object.keys(REASON_CODES)).toEqual([
      'WEAK_TERM', 'REPEATED_ERROR', 'NO_COUNTEREXAMPLE', 'LOW_EVIDENCE',
      'WEAK_EVIDENCE', 'LOW_UNCERTAINTY', 'RECENT_YAO', 'RECENT_HEXAGRAM', 'UNUSED_CLASSIC',
      'UNDERUSED_CLASSIC', 'TRADITION_GAP', 'REPEATED_BELIEF', 'BELIEF_REVISION', 'READY_FOR_INDEPENDENCE',
    ])
    const arr = [createEvidence({ source: 'workshop', action: 'analyze', targetType: 'hexagram', targetId: 1, timestamp: 1 })]
    const weak = summarizeEvidence(arr).weakBehaviors.map((b) => b.skill)
    expect(weak).toContain('counterexample')
    expect(weak).toContain('evidence')
  })

  it('Evidence → Mastery：skill 映射到 8 维，beforeMastery 取自能力档案', () => {
    const s = reducer({ ...initialState, masteryProfile: { overall: 42 } }, {
      type: 'RECORD_EVIDENCE',
      evidence: { source: 'workshop', action: 'counterexample', targetType: 'hexagram', targetId: 1 },
    })
    const e = s.evidence[0]
    expect(e.skill).toBe('counterexample')
    expect(DIMENSION_KEYS).toContain(e.skill)
    expect(e.beforeMastery).toBe(42)
  })
})