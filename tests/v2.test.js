// ============================================================
// V2 「玄学学徒制」测试：
//   1. Mastery 能力模型：正确回答≠升级、提示依赖≠独立、难度/陌生权重、时间衰减
//   2. V2 案例评分：analysis / revision / counterfactual / dual / unknown
//   3. 瓶颈驱动训练：当前瓶颈决定下一次训练
//   4. 出师挑战：门槛、提示扣独立性、unknown 合理、多解释不设唯一答案
//   5. 错误博物馆：错误 → 行为改变 → 是否真正改善
//   6. 回归：V1.6.1 能力全部不回归 + 旧数据兼容
//   7. 全新用户成长旅程模拟（0 样本 → 出师报告）
// 运行：npm test
// ============================================================
import { describe, it, expect } from 'vitest'

import { initialState } from '../src/lib/storage'
import { reducer } from '../src/store/reducer'
import { scoreCase } from '../src/lib/caseScoring'
import { getCase, CASES } from '../src/data/cases'
import {
  computeMasteryProfile,
  nextLevelGap,
  agentJudgment,
  MASTERY_DIMENSIONS,
  MASTERY_LEVELS,
} from '../src/agent/masteryEngine'
import { adaptiveTraining } from '../src/agent/adaptiveTraining'
import { reasoningFingerprint } from '../src/agent/reasoningFingerprint'
import { runAgent } from '../src/agent/localAgentEngine'
import { errorMuseumTrend } from '../src/agent/errorMuseum'
import {
  masterChallengeEligibility,
  pickMasterCase,
  scoreMasterChallenge,
  masterVerdict,
  MIN_MASTER_SAMPLE,
} from '../src/agent/masterChallenge'

// ── 工厂：一条真实案例行为记录 ──────────────────────────
function attempt(overrides = {}) {
  return {
    caseId: 'case-021',
    at: '2026-09-15T10:00:00Z',
    attempt: 1,
    redo: false,
    score: 60,
    confidence: 60,
    actualQuality: 60,
    errorTypes: [],
    dimensions: { info: 60, rule: 60, reasoning: 60, counter: 50, over: 60, boundary: 55 },
    level: 3,
    usedUnknown: false,
    hintDependency: 0,
    consultedKnowledge: false,
    beliefRevision: null,
    dualQuality: null,
    mode: 'guided',
    ...overrides,
  }
}

function profileOf(attempts, confidenceHistory = []) {
  return computeMasteryProfile({ caseAttempts: attempts, confidenceHistory })
}

// 一批「全对但高提示依赖」的记录（正确 ≠ 独立）
const highHintAttempts = Array.from({ length: 12 }, (_, i) =>
  attempt({
    caseId: `case-0${String(i + 1).padStart(2, '0')}`,
    score: 95,
    dimensions: { info: 95, rule: 95, reasoning: 95, counter: 80, over: 95, boundary: 95 },
    level: 4,
    hintDependency: 5,
    consultedKnowledge: true,
    mode: 'guided',
  }),
)

// 一批「同样全对、但完全独立」的记录
const independentAttempts = Array.from({ length: 12 }, (_, i) =>
  attempt({
    caseId: `case-0${String(i + 1).padStart(2, '0')}`,
    score: 95,
    dimensions: { info: 95, rule: 95, reasoning: 95, counter: 80, over: 95, boundary: 95 },
    level: 4,
    hintDependency: 0,
    consultedKnowledge: false,
    mode: 'independent',
  }),
)

// ── 1. Mastery 能力模型 ─────────────────────────────────
describe('V2 Mastery 能力模型', () => {
  it('0 样本：档案不 ready，等级为 L0，不伪造判断', () => {
    const p = profileOf([])
    expect(p.ready).toBe(false)
    expect(p.level).toBe('L0')
    expect(p.bottleneck).toBeNull()
  })

  it('样本 < 3：能力计算存在但不 ready（不乱判等级）', () => {
    const p = profileOf([attempt(), attempt()])
    expect(p.sampleCount).toBe(2)
    expect(p.ready).toBe(false)
    expect(MASTERY_LEVELS[p.level]).toBeTruthy()
  })

  it('正确回答 ≠ 自动升级：全对但高提示依赖的用户被压在 L5', () => {
    const p = profileOf(highHintAttempts)
    expect(p.independence).toBeLessThanOrEqual(70) // 5 次提示 + 全程查阅知识 → 独立性不足
    expect(p.level).toBe('L5') // 能力都高，但独立性不达标 → 上不了 L6
  })

  it('同样全对、完全独立 → 达到 L6（独立性是关键差异）', () => {
    const p = profileOf(independentAttempts)
    expect(p.independence).toBeGreaterThanOrEqual(90)
    expect(p.level).toBe('L6')
  })

  it('高提示依赖 ≠ 高独立性：同分用户独立性差 ≥ 20 分', () => {
    const a = profileOf(highHintAttempts)
    const b = profileOf(independentAttempts)
    expect(b.independence - a.independence).toBeGreaterThanOrEqual(20)
  })

  it('高难度案例权重更高：复杂案例表现主导综合分析维度', () => {
    const complex = profileOf(
      Array.from({ length: 6 }, (_, i) => attempt({ score: 90, level: 4, dimensions: { info: 80, rule: 80, reasoning: 80, counter: 70, over: 80, boundary: 80 } })),
    )
    const simple = profileOf(
      Array.from({ length: 6 }, (_, i) => attempt({ score: 90, level: 1, dimensions: { info: 80, rule: 80, reasoning: 80, counter: 70, over: 80, boundary: 80 } })),
    )
    expect(complex.synthesis).toBeGreaterThan(simple.synthesis)
  })

  it('陌生案例权重更高：独立/出师模式的真实表现单独记录', () => {
    const p = profileOf(Array.from({ length: 6 }, (_, i) => attempt({ score: 90, mode: 'independent', level: 4 })))
    expect(p.unfamiliarCasePerformance).toBe(90)
    const g = profileOf(Array.from({ length: 6 }, (_, i) => attempt({ score: 90, mode: 'guided' })))
    expect(g.unfamiliarCasePerformance).toBeNull()
  })

  it('时间衰减有效：最近行为权重高于远期', () => {
    const badThenGood = Array.from({ length: 6 }, () => attempt({ dimensions: { ...attempt().dimensions, info: 30 } })).concat(
      Array.from({ length: 2 }, () => attempt({ dimensions: { ...attempt().dimensions, info: 90 } })),
    )
    const p = profileOf(badThenGood)
    // 均匀平均是 45；衰减加权应更接近「最近的 90」→ 高于 45
    expect(p.observation).toBeGreaterThan(45)

    const goodThenBad = Array.from({ length: 2 }, () => attempt({ dimensions: { ...attempt().dimensions, info: 90 } })).concat(
      Array.from({ length: 6 }, () => attempt({ dimensions: { ...attempt().dimensions, info: 30 } })),
    )
    const q = profileOf(goodThenBad)
    expect(q.observation).toBeLessThan(45)
  })

  it('瓶颈识别：最低能力维度 = 当前瓶颈（真实数据推导）', () => {
    const p = profileOf(
      Array.from({ length: 6 }, (_, i) =>
        attempt({ dimensions: { info: 65, rule: 65, reasoning: 65, counter: 30, over: 65, boundary: 65 }, level: 3 }),
      ),
    )
    expect(p.bottleneck.key).toBe('counterexample')
    expect(p.bottleneck.label).toBe('反例意识')
  })

  it('nextLevelGap：样本不足时给出明确说明（不是因为做题不够）', () => {
    const p = profileOf([attempt()])
    const gap = nextLevelGap(p)
    expect(gap.next).toBe('L2')
    expect(gap.sampleShort).toBe(true)
    expect(gap.sampleNote).toContain('至少需要 3 次真实案例样本')
  })

  it('nextLevelGap：能力不足时列出具体短板维度', () => {
    const p = profileOf(
      Array.from({ length: 6 }, (_, i) =>
        attempt({ dimensions: { info: 70, rule: 70, reasoning: 70, counter: 70, over: 40, boundary: 40 }, level: 3 }),
      ),
    )
    const gap = nextLevelGap(p)
    expect(gap.gaps.length).toBeGreaterThan(0)
    const keys = gap.gaps.map((g) => g.key)
    expect(keys).toContain('uncertainty') // over/boundary 双低 → 不确定性管理是实际短板
    expect(keys).not.toContain('independence')
  })

  it('信心校准：误差越小分数越高（真实 confidenceHistory）', () => {
    const good = profileOf([attempt()], [
      { confidence: 90, actual: 90 },
      { confidence: 60, actual: 60 },
    ])
    expect(good.confidenceCalibration).toBe(100)
    const bad = profileOf([attempt()], [{ confidence: 90, actual: 50 }])
    expect(bad.confidenceCalibration).toBe(60)
  })

  it('信念修正聚合：多数时候愿随新信息调整 → 灵活修正', () => {
    const p = profileOf([
      attempt({ beliefRevision: 'revise' }),
      attempt({ beliefRevision: 'revise' }),
      attempt({ beliefRevision: 'revise' }),
      attempt({ beliefRevision: 'keep' }),
    ])
    expect(p.beliefRevision.key).toBe('flexible')
    expect(p.beliefRevision.desc).toContain('愿意调整')
  })
})

// ── 2. V2 案例评分（analysis / revision / counterfactual / dual / unknown）──
describe('V2 案例评分（新模式）', () => {
  it('analysis 独立分析：命中关键线索 + 有展开 → 信息与推理给分', () => {
    const cs = {
      id: 'syn-analysis',
      infoSufficiency: 'insufficient',
      challenges: [
        { type: 'analysis', keywords: ['月令', '日主', '证据'], prompt: '从哪开始分析' },
        { type: 'confidence', prompt: '信心' },
      ],
    }
    const good = scoreCase(cs, { 0: '我会先看月令与日主的关系确定强弱，然后寻找支持与反对的证据，再对照现实信息', 1: 50 })
    expect(good.dimensions.info).toBeGreaterThanOrEqual(65)
    expect(good.dimensions.reasoning).toBeGreaterThanOrEqual(65)

    const empty = scoreCase(cs, { 0: '', 1: 50 })
    expect(empty.dimensions.info).toBeLessThan(30)
  })

  it('revision 信念修正：新信息 → 会改变判断 → 记录 revise，不扣分', () => {
    const cs = getCase('case-033')
    const r = scoreCase(cs, { 0: 0, 1: 0, 2: 0, 3: 70 })
    expect(r.beliefRevision).toBe('revise')
    expect(r.dimensions.reasoning).toBeGreaterThanOrEqual(90)
  })

  it('revision：拒绝在信息变化时修正 → 判定为只找支持自己的证据（E07）', () => {
    const cs = getCase('case-033')
    const r = scoreCase(cs, { 0: 0, 1: 0, 2: 1, 3: 70 })
    expect(r.beliefRevision).toBe('keep')
    expect(r.dimensions.over).toBeLessThan(100) // 被扣避免过度推断分
  })

  it('counterfactual 反事实挑战：能在假设条件下调整分析 → 反例意识得分', () => {
    const cs = getCase('case-032')
    const r = scoreCase(cs, { 0: 0, 1: '先核实他咖啡与加班的真实情况', 2: 0, 3: 60 })
    expect(r.dimensions.counter).toBeGreaterThanOrEqual(90)
  })

  it('dual 双解释挑战：选择证据支持更多的一方 → 标记双解释质量 good', () => {
    const cs = getCase('case-032')
    const r = scoreCase(cs, { 0: 0, 1: '先核实他咖啡与加班的真实情况', 2: 0, 3: 60 })
    expect(r.dualQuality).toBe('good')
  })

  it('多解释案例不设唯一答案：「目前无法判断」是合理选项，不被清零', () => {
    const cs = getCase('case-032')
    // 案例本身：双解释挑战给「目前无法判断」2 分（合理保留），且不标记为错误
    const dualCh = cs.challenges[0]
    expect(dualCh.type).toBe('dual')
    expect(dualCh.options[2].text).toContain('无法判断')
    expect(dualCh.options[2].points).toBe(2)
    expect(dualCh.options[2].errorType).toBeUndefined()

    const r = scoreCase(cs, { 0: 2, 1: '先问清楚再说', 2: 2, 3: 60 })
    // 选择「目前无法判断」不会被清零或判错，只是证据权衡更保守
    expect(r.dimensions.reasoning).toBeGreaterThanOrEqual(45)
    expect(r.total).toBeGreaterThanOrEqual(45)
  })

  it('hintDependency：提示次数 → 依赖分输出（0 次 = 0，5 次封顶 = 100）', () => {
    const cs = { id: 'syn-hint', infoSufficiency: 'insufficient', challenges: [{ type: 'choice', prompt: '判断', options: [{ text: 'A', points: 3 }] }] }
    const none = scoreCase(cs, { 0: 0 })
    expect(none.hintDependency).toBe(0)
    const five = scoreCase(cs, { 0: 0, hintCount: 5 })
    expect(five.hintDependency).toBe(100)
  })

  it('unknown 成为「判断边界」：证据不足时选无法判断 + 理由 → 边界满分', () => {
    const cs = getCase('case-021') // infoSufficiency: 'insufficient'
    const r = scoreCase(cs, { 0: 1, 1: ['他主动发了消息'], 2: 'unknown', 3: 0, 4: 40, unknownReason: 'missing-evidence' })
    expect(r.usedUnknown).toBe(true)
    expect(r.dimensions.boundary).toBe(100)
  })

  it('caseScoring 输出 V2 行为元数据（mode / consultedKnowledge）', () => {
    const cs = getCase('case-032')
    const r = scoreCase(cs, { 0: 0, 1: '先核实咖啡与加班', 2: 0, 3: 60, hintCount: 1, consultedKnowledge: true })
    expect(r.mode).toBe('independent')
    expect(r.consultedKnowledge).toBe(true)
    expect(r.hintDependency).toBe(20)
  })
})

// ── 3. 瓶颈驱动训练 ─────────────────────────────────────
describe('V2 瓶颈驱动训练（adaptiveTraining）', () => {
  function stateWith(attempts, errorPatterns = {}) {
    return {
      caseAttempts: attempts,
      errorPatterns,
      confidenceHistory: attempts.map((a) => ({ confidence: a.confidence, actual: a.actualQuality })),
      completedCases: {},
    }
  }

  it('证据瓶颈 → 推荐证据训练', () => {
    const atts = Array.from({ length: 6 }, (_, i) =>
      attempt({ dimensions: { info: 55, rule: 60, reasoning: 60, counter: 60, over: 40, boundary: 60 }, level: 3 }),
    )
    const s = stateWith(atts)
    const mp = computeMasteryProfile(s)
    expect(mp.bottleneck.key).toBe('evidence') // (over 40 + info 55)/2 = 48，全场最低
    const t = adaptiveTraining(s, reasoningFingerprint(s), mp)
    expect(t.type).toBe('evidence')
    expect(t.why).toContain('证据')
    expect(t.caseId).toBeTruthy()
  })

  it('反例瓶颈 → 推荐反例/反事实训练', () => {
    const atts = Array.from({ length: 6 }, (_, i) =>
      attempt({ dimensions: { info: 65, rule: 65, reasoning: 65, counter: 30, over: 65, boundary: 65 }, level: 3 }),
    )
    const s = stateWith(atts)
    const mp = computeMasteryProfile(s)
    expect(mp.bottleneck.key).toBe('counterexample')
    const t = adaptiveTraining(s, reasoningFingerprint(s), mp)
    expect(t.type).toBe('counter')
  })

  it('结构理解瓶颈 → 推荐知识补强（回到课堂，而不是继续做题）', () => {
    const atts = Array.from({ length: 6 }, (_, i) =>
      attempt({ dimensions: { info: 70, rule: 30, reasoning: 70, counter: 70, over: 70, boundary: 70 }, level: 3 }),
    )
    const s = stateWith(atts)
    const mp = computeMasteryProfile(s)
    expect(mp.bottleneck.key).toBe('structure')
    const t = adaptiveTraining(s, reasoningFingerprint(s), mp)
    expect(t.type).toBe('knowledge')
    expect(t.caseId).toBeNull()
    expect(t.brief).toContain('复习')
  })

  it('没有显著瓶颈 → 不触发定向训练，回退常规推进', () => {
    const atts = Array.from({ length: 6 }, (_, i) =>
      attempt({
        score: 88,
        dimensions: { info: 80, rule: 80, reasoning: 80, counter: 80, over: 80, boundary: 88 },
        confidence: 70,
        actualQuality: 80,
        level: 3,
        usedUnknown: i % 3 === 0,
      }),
    )
    const s = stateWith(atts)
    const mp = computeMasteryProfile(s)
    // 各维度均 ≥ 64，且最低维度与平均差距 < 10 → 不构成「显著瓶颈」
    expect(mp.bottleneck.value).toBeGreaterThanOrEqual(64)
    const t = adaptiveTraining(s, reasoningFingerprint(s), mp)
    expect(t.type).toBe('normal')
  })

  it('能力档案未就绪（<3 样本）→ 先按节奏推进，不强行判断', () => {
    const s = stateWith([attempt(), attempt()])
    const mp = computeMasteryProfile(s)
    const t = adaptiveTraining(s, reasoningFingerprint(s), mp)
    expect(t.type).toBe('normal')
    expect(t.why).toContain('3 个案例')
  })

  it('瓶颈推荐文案带真实数字与原因（可解释，不是随机）', () => {
    const atts = Array.from({ length: 6 }, (_, i) =>
      attempt({ dimensions: { info: 40, rule: 60, reasoning: 60, counter: 60, over: 40, boundary: 60 }, level: 3 }),
    )
    const s = stateWith(atts)
    const mp = computeMasteryProfile(s)
    const t = adaptiveTraining(s, reasoningFingerprint(s), mp)
    expect(t.why).toContain('/100')
    expect(t.bottleneckLabel).toBeTruthy()
  })
})

// ── 4. 出师挑战 ─────────────────────────────────────────
describe('V2 出师挑战（masterChallenge）', () => {
  // 12 条高质量记录：全部维度达标、分数稳定、完全独立
  const strongAttempts = Array.from({ length: 12 }, (_, i) =>
    attempt({
      caseId: `case-0${String(i + 1).padStart(2, '0')}`,
      score: 90,
      dimensions: { info: 88, rule: 88, reasoning: 88, counter: 78, over: 85, boundary: 88 },
      level: 4,
      usedUnknown: i % 3 === 0,
      hintDependency: 0,
      consultedKnowledge: false,
      beliefRevision: i % 2 === 0 ? 'revise' : 'unsure',
      dualQuality: i % 2 === 0 ? 'good' : null,
      mode: 'independent',
    }),
  )

  it('0 样本：不能进入出师挑战', () => {
    const e = masterChallengeEligibility(profileOf([]), [])
    expect(e.ok).toBe(false)
    expect(e.reason).toContain('还没有完成任何案例')
  })

  it('样本不足 12 次：不能进入，说明真实缺口', () => {
    const e = masterChallengeEligibility(profileOf(Array.from({ length: 6 }, () => attempt({ score: 90 }))), Array.from({ length: 6 }, () => attempt({ score: 90 })))
    expect(e.ok).toBe(false)
    expect(e.reason).toContain(`${MIN_MASTER_SAMPLE} 次真实案例样本`)
  })

  it('能力缺口：列出未达标的维度（不是笼统的「还差 XP」）', () => {
    const weak = Array.from({ length: 12 }, (_, i) =>
      attempt({ score: 80, dimensions: { info: 88, rule: 88, reasoning: 88, counter: 30, over: 85, boundary: 88 }, level: 4 }),
    )
    const e = masterChallengeEligibility(profileOf(weak), weak)
    expect(e.ok).toBe(false)
    expect(e.gaps.some((g) => g.key === 'counterexample')).toBe(true)
    expect(e.reason).toContain('反例意识')
  })

  it('8 维达标 + 样本充足 + 表现稳定 → 可以进入', () => {
    const e = masterChallengeEligibility(profileOf(strongAttempts), strongAttempts)
    expect(e.ok).toBe(true)
    expect(e.gaps.length).toBe(0)
  })

  it('最近表现持续下降（连续 3 次分数走低）→ 阻止出师', () => {
    const declining = Array.from({ length: 12 }, (_, i) =>
      attempt({
        score: i < 7 ? 90 : [80, 70, 60, 50, 40][i - 7],
        dimensions: { info: 88, rule: 88, reasoning: 88, counter: 78, over: 85, boundary: 88 },
        level: 4,
        mode: 'independent',
      }),
    )
    const e = masterChallengeEligibility(profileOf(declining), declining)
    expect(e.recentDecline).toBe(true)
    expect(e.ok).toBe(false)
  })

  it('使用提示 → 独立性评分下降（允许一次，但影响独立性）', () => {
    const answers = { 0: '先从日主与月令关系开始，再看现实跳槽信息', 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 70 }
    const noHint = scoreMasterChallenge(getCase('case-042'), answers)
    const withHint = scoreMasterChallenge(getCase('case-042'), { ...answers, hintCount: 2 })
    expect(withHint.independence).toBeLessThan(noHint.independence)
    expect(noHint.independence).toBeGreaterThanOrEqual(90)
    expect(withHint.hintCount).toBe(2)
  })

  it('unknown 可以成为出师挑战的合理答案（边界挑战选无法判断）', () => {
    const r = scoreMasterChallenge(getCase('case-042'), {
      0: '先从日主与月令关系开始，再看现实跳槽信息',
      1: 0, 2: 0, 3: 0, 4: 0,
      5: 'unknown', // 边界挑战：明确标出「无法判断」的部分
      6: 70,
      unknownReason: 'missing-evidence',
    })
    expect(r.usedUnknown).toBe(true)
    expect(r.dimensions.boundary).toBeGreaterThanOrEqual(70)
    expect(r.issues.join('')).not.toContain('无法判断') // 表达不确定不是问题
  })

  it('出师报告克制：不宣称「掌握真理 / 精准预测」', () => {
    const v = masterVerdict(90, 95)
    expect(v).toContain('达到当前学习体系定义的独立分析阶段')
    expect(v).not.toContain('真理')
    expect(v).not.toContain('精准预测')
    expect(v).not.toContain('100%')
  })

  it('pickMasterCase：优先选未完成的出师挑战案例', () => {
    expect(pickMasterCase({ completedCases: {} }).id).toBe('case-042')
    const done = pickMasterCase({ completedCases: { 'case-042': {} } })
    expect(done.id).not.toBe('case-042')
    expect(done.level).toBe(4)
  })

  it('出师报告包含优势 / 问题 / 值得训练的习惯（全部来自本次真实作答）', () => {
    const r = scoreMasterChallenge(getCase('case-042'), {
      0: '先从日主与月令关系开始，再看现实跳槽信息，最后找反例',
      1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 70,
    })
    expect(r.strengths.length).toBeGreaterThanOrEqual(1)
    expect(r.issues.length).toBeGreaterThanOrEqual(1)
    expect(r.habit).toContain('如果另一种解释成立')
    expect(r.weakest.label).toBeTruthy()
  })
})

// ── 5. 错误博物馆：错误 → 行为改变 → 是否真正改善 ────────
describe('V2 错误博物馆「改变」追踪', () => {
  it('出现同一错误但反例意识显著提升 → change 标记为改善', () => {
    const atts = [
      attempt({ errorTypes: ['E01'], dimensions: { info: 55, rule: 55, reasoning: 45, counter: 30, over: 50, boundary: 40 } }),
      attempt({ errorTypes: ['E01'], dimensions: { info: 55, rule: 55, reasoning: 45, counter: 35, over: 60, boundary: 45 } }),
      attempt({ errorTypes: ['E01'], dimensions: { info: 70, rule: 70, reasoning: 70, counter: 80, over: 75, boundary: 70 } }),
      attempt({ errorTypes: ['E01'], dimensions: { info: 75, rule: 75, reasoning: 75, counter: 85, over: 85, boundary: 75 } }),
    ]
    const t = errorMuseumTrend({ caseAttempts: atts, errorPatterns: { E01: 4 } }, 'E01')
    expect(t.change.improving).toBe(true)
    expect(t.change.text).toContain('反例意识')
    expect(t.trend).toBe('improving')
  })

  it('行为没有变化 → change 说明「稳定」，不伪造进步', () => {
    const atts = Array.from({ length: 4 }, (_, i) =>
      attempt({ errorTypes: ['E07'], dimensions: { info: 55, rule: 55, reasoning: 55, counter: 45, over: 50, boundary: 50 } }),
    )
    const t = errorMuseumTrend({ caseAttempts: atts, errorPatterns: { E07: 4 } }, 'E07')
    expect(t.change.improving).toBeNull()
    expect(t.change.text).toContain('没有明显变化')
  })

  it('出现 ≥3 次且最近不再出现 → 已经稳定解决', () => {
    const atts = [
      attempt({ errorTypes: ['E01'], dimensions: { info: 50, rule: 50, reasoning: 45, counter: 30, over: 40, boundary: 40 } }),
      attempt({ errorTypes: ['E01'], dimensions: { info: 50, rule: 50, reasoning: 45, counter: 30, over: 40, boundary: 40 } }),
      attempt({ errorTypes: ['E01'], dimensions: { info: 60, rule: 60, reasoning: 60, counter: 70, over: 75, boundary: 70 } }),
      attempt({ errorTypes: ['E01'], dimensions: { info: 70, rule: 70, reasoning: 70, counter: 80, over: 85, boundary: 75 } }),
      attempt({ errorTypes: [], dimensions: { info: 80, rule: 80, reasoning: 80, counter: 80, over: 85, boundary: 80 } }),
      attempt({ errorTypes: [], dimensions: { info: 85, rule: 85, reasoning: 85, counter: 85, over: 88, boundary: 85 } }),
      attempt({ errorTypes: [], dimensions: { info: 85, rule: 85, reasoning: 85, counter: 85, over: 88, boundary: 85 } }),
      attempt({ errorTypes: [], dimensions: { info: 85, rule: 85, reasoning: 85, counter: 85, over: 88, boundary: 85 } }),
      attempt({ errorTypes: [], dimensions: { info: 85, rule: 85, reasoning: 85, counter: 85, over: 88, boundary: 85 } }),
      attempt({ errorTypes: [], dimensions: { info: 85, rule: 85, reasoning: 85, counter: 85, over: 88, boundary: 85 } }),
    ]
    const t = errorMuseumTrend({ caseAttempts: atts, errorPatterns: { E01: 4 } }, 'E01')
    expect(t.trend).toBe('solved')
  })
})

// ── 6. 回归 + 旧数据兼容 ────────────────────────────────
describe('V2 回归与兼容', () => {
  it('runAgent 输出集成 masteryProfile / whyNotPromote / judgment', () => {
    const atts = Array.from({ length: 6 }, (_, i) =>
      attempt({ dimensions: { info: 55 + i * 4, rule: 55 + i * 4, reasoning: 55 + i * 4, counter: 40 + i * 6, over: 50 + i * 5, boundary: 50 + i * 5 }, level: 1 }),
    )
    const s = { ...initialState, caseAttempts: atts, confidenceHistory: atts.map((a) => ({ confidence: a.confidence, actual: a.actualQuality })) }
    const agent = runAgent(s)
    expect(agent.masteryProfile).toBeTruthy()
    expect(agent.masteryProfile.ready).toBe(true)
    expect(agent.judgment).not.toBeNull()
    expect(Array.isArray(agent.judgment.items)).toBe(true)
  })

  it('样本不足时 whyNotPromote 给出真实说明（不是 XP 不够）', () => {
    const s = { ...initialState, caseAttempts: [attempt()], confidenceHistory: [] }
    const agent = runAgent(s)
    expect(agent.whyNotPromote).toBeTruthy()
    expect(agent.whyNotPromote.reason).toContain('真实案例样本')
  })

  it('COMPLETE_CASE 后自动重算能力档案 + 写入 V2 行为元数据', () => {
    const result = {
      total: 82,
      confidence: 70,
      actualQuality: 82,
      errorTypes: ['E01'],
      dimensions: { info: 80, rule: 80, reasoning: 75, counter: 60, over: 65, boundary: 60 },
      usedUnknown: false,
      unknownReason: null,
      hintDependency: 40,
      consultedKnowledge: false,
      beliefRevision: 'revise',
      dualQuality: null,
      mode: 'guided',
    }
    const cs1 = getCase('case-001')
    const s = reducer({ ...initialState }, { type: 'COMPLETE_CASE', caseId: 'case-001', relatedNodes: cs1.relatedNodes, level: cs1.level, mode: cs1.mode, result })
    expect(s.caseAttempts.length).toBe(1)
    expect(s.caseAttempts[0].hintDependency).toBe(40)
    expect(s.caseAttempts[0].beliefRevision).toBe('revise')
    expect(s.caseAttempts[0].mode).toBe('guided')
    expect(s.masteryProfile.sampleCount).toBe(1)
    expect(s.masteryProfile.level).toBe('L1')
  })

  it('旧数据兼容：缺少 V2 字段的历史记录不报错、安全推导', () => {
    const legacy = {
      caseId: 'case-003',
      at: '2026-08-01T10:00:00Z',
      attempt: 1,
      redo: false,
      score: 72,
      confidence: 65,
      actualQuality: 70,
      errorTypes: ['E03'],
      dimensions: { info: 70, rule: 65, reasoning: 70, counter: 55, over: 60, boundary: 55 },
      level: 4,
      usedUnknown: false,
    }
    const s = { ...initialState, caseAttempts: [legacy, legacy, legacy] }
    const p = computeMasteryProfile(s)
    expect(p.ready).toBe(true)
    expect(typeof p.independence).toBe('number')
    expect(p.hintDependency).toBe(0) // 缺失 → 基线，不伪造
    expect(p.beliefRevision).toBeNull()

    // 旧状态（无 masteryProfile）直接走 COMPLETE_CASE 也不报错
    const cs1 = getCase('case-001')
    const r = reducer({ ...initialState, masteryProfile: undefined }, {
      type: 'COMPLETE_CASE',
      caseId: 'case-001',
      relatedNodes: cs1.relatedNodes,
      level: cs1.level,
      mode: cs1.mode,
      result: { total: 75, confidence: 60, actualQuality: 75, dimensions: { info: 70, rule: 70, reasoning: 70, counter: 60, over: 65, boundary: 60 }, hintDependency: 0 },
    })
    expect(r.masteryProfile.sampleCount).toBe(1)
  })

  it('全量案例可被评分（含 V2/V3 复杂案例），无崩溃、维度完整', () => {
    // V3 新增 case-043 ~ case-054（见 cases-v3.js，含 Phase 2 中级与 Phase 3 高级综合案例）
    // V3 Phase 4 易经学院新增 case-055 ~ case-120（见 cases-iching-1~7.js）
    // 系统化重构新增 case-121 ~ case-123（见 cases-iching-8.js，十翼）、
    // case-124 ~ case-129（见 cases-iching-9.js，爻位与爻际关系）、
    // case-130 ~ case-135（见 cases-iching-10.js，历代易学与解释传统）
    // R6 真实案例推演场新增 24 案例：case-fs-01~08 / case-qm-01~03 / case-lr-01~03 /
    // case-bz-01~04 / case-ly-01~04 / case-mh-01~02（风水/奇门/六壬/八字/六爻/梅花）
    expect(CASES.length).toBe(159)
    const v2 = CASES.filter((c) => (c.mode === 'independent' || c.mode === 'master') || c.id >= 'case-031')
    expect(v2.length).toBeGreaterThanOrEqual(12)
    for (const cs of CASES) {
      const answers = {}
      cs.challenges.forEach((ch, i) => {
        if (ch.type === 'analysis') answers[i] = '先看关键信息，再找证据，最后下结论'
        else if (ch.type === 'classify') answers[i] = []
        else if (ch.type === 'confidence') answers[i] = 60
        else if (ch.type === 'revision') answers[i] = 0
        else if (ch.type === 'counterfactual') answers[i] = 0
        else if (ch.type === 'dual') answers[i] = 0
        else answers[i] = 'unknown'
      })
      const r = scoreCase(cs, { ...answers, unknownReason: 'missing-evidence' })
      expect(r.total).toBeGreaterThanOrEqual(0)
      expect(r.dimensions.boundary).toBeGreaterThanOrEqual(0)
      expect(Array.isArray(r.notes)).toBe(true)
    }
  })
})

// ── 7. 全新用户成长旅程（模拟验收）───────────────────────
describe('V2 全新用户成长旅程（0 样本 → 出师报告）', () => {
  it('完整走通：观察 → 洞察 → 瓶颈训练 → 改善 → 独立 → 出师', () => {
    // 阶段 1：新用户，0 次案例
    let s = { ...initialState }
    expect(computeMasteryProfile(s).ready).toBe(false)
    expect(runAgent(s).masteryProfile.ready).toBe(false)

    // 阶段 2：第 1–3 个案例（引导模式，有提示、表现一般）→ 档案开始成形
    const early = (n, i) =>
      attempt({
        caseId: `case-0${n}`,
        at: `2026-09-0${i + 1}T10:00:00Z`,
        score: 62 + i * 3,
        dimensions: { info: 55 + i * 4, rule: 55 + i * 4, reasoning: 55 + i * 4, counter: 40 + i * 5, over: 50 + i * 5, boundary: 50 + i * 5 },
        level: 1,
        hintDependency: 2,
        consultedKnowledge: true,
        mode: 'guided',
      })
    s = { ...s, caseAttempts: [early(1, 0), early(2, 1), early(3, 2)] }
    let p = computeMasteryProfile(s)
    expect(p.ready).toBe(true)
    expect(p.level).toBe('L2') // 有样本、观察/结构达标 → 练习者

    // 阶段 3：第 4–6 个案例（开始主动找反例）→ 出现第一个「Agent 对你的判断」
    const mid = (n, i) =>
      attempt({
        caseId: `case-0${n}`,
        at: `2026-09-0${i + 1}T10:00:00Z`,
        score: 72 + i * 2,
        dimensions: { info: 66 + i * 3, rule: 66 + i * 3, reasoning: 66 + i * 3, counter: 40 + i * 5, over: 62 + i * 4, boundary: 60 + i * 5 },
        level: 2,
        hintDependency: 1,
        consultedKnowledge: false,
        mode: 'semi',
      })
    s = { ...s, caseAttempts: [...s.caseAttempts, mid(4, 3), mid(5, 4), mid(6, 5)] }
    const agent2 = runAgent(s)
    expect(agent2.judgment).not.toBeNull() // 反例意识从 ~42 → ~70，行为变化被真实检测到
    expect(agent2.judgment.items[0].text).toContain('反例')

    // 阶段 4：瓶颈驱动推荐（此时反例意识仍是最低维度）
    const t = adaptiveTraining(s, reasoningFingerprint(s), computeMasteryProfile(s))
    expect(t.type).toBe('counter') // 反例瓶颈 → 反例/反事实训练

    // 阶段 5：用户改善——提示减少、独立完成、主动找反例、表达不确定
    const strong = (n, i) =>
      attempt({
        caseId: `case-0${n}`,
        at: `2026-09-${String(i + 1).padStart(2, '0')}T10:00:00Z`,
        score: 90,
        dimensions: { info: 88, rule: 88, reasoning: 88, counter: 78, over: 85, boundary: 88 },
        level: 4,
        usedUnknown: i % 3 === 0,
        hintDependency: 0,
        consultedKnowledge: false,
        beliefRevision: i % 2 === 0 ? 'revise' : 'unsure',
        dualQuality: i % 2 === 0 ? 'good' : null,
        mode: 'independent',
      })
    const later = [strong(7, 6), strong(8, 7), strong(9, 8), strong(10, 9), strong(11, 10), strong(12, 11)]
    s = { ...s, caseAttempts: [...s.caseAttempts, ...later] }
    p = computeMasteryProfile(s)
    expect(p.hintDependency).toBe(0) // 提示依赖降为 0
    expect(p.independence).toBeGreaterThanOrEqual(90)
    expect(p.level).toBe('L6')

    // 阶段 6：达到出师条件 → 进入出师挑战
    const elig = masterChallengeEligibility(p, s.caseAttempts)
    expect(elig.ok).toBe(true)

    // 阶段 7：完成出师挑战 → 生成出师能力报告
    const report = scoreMasterChallenge(getCase('case-042'), {
      0: '先从日主与月令关系开始，再看现实跳槽信息，最后主动找反例',
      1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 70,
    })
    expect(report.overall).toBeGreaterThanOrEqual(70)
    expect(report.independence).toBeGreaterThanOrEqual(90)
    expect(report.strengths.length).toBeGreaterThanOrEqual(1)
    expect(report.habit).toContain('如果另一种解释成立')
    expect(masterVerdict(report.overall, report.independence)).toContain('独立分析阶段')

    // 阶段 8：出师后不宣称「精通」，指向下一阶段
    const agentFinal = runAgent(s)
    expect(agentFinal.masteryProfile.level).toBe('L6')
    expect(agentFinal.whyNotPromote).toBeNull() // 已到最高阶段，不再有「不能升级」提示
  })
})
