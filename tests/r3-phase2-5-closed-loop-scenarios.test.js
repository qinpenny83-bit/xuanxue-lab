// ============================================================
// R3 Phase 2.5 · 学习状态闭环 · 场景与唯一事实源测试
//
// 覆盖（聚焦 Evidence → Mastery → L0-L6 → Agent → UI 的真正闭环）：
//   A. Evidence → Mastery Evidence 派生（质量 / 门槛 / 结构条件）
//   B. Evidence → 能力贡献（去重 / 递减 / 封顶 / 质量加权 / 样本计数）
//   C. computeMasteryProfile 唯一能力事实源（max 合并 / 等级门控 / 不主导）
//   D. reducer RECORD_EVIDENCE 立即重算（闭环）
//   E. Agent → UI 推荐唯一（Evidence-first / 可解释 / 回退）
//   F. 场景A · 连续 construct 无 evidence → WEAK_EVIDENCE
//   G. 场景C · 防刷（view×N / construct×N 不无限增长）
//   H. 场景D · 观点修正不被 LOW_UNCERTAINTY 误报覆盖
//   I. 推荐优先级（唯一主要推荐，干预先于正面确认）
// ============================================================
import { describe, it, expect } from 'vitest'
import { initialState } from '../src/lib/storage'
import { createEvidence } from '../src/agent/learningEvidence'
import analyzeSignals, { SIGNAL_TYPES } from '../src/lib/textSignals'
import {
  MASTERY_CAP,
  evidenceText,
  qualityLabel,
  deriveMasteryEvidence,
  evidenceMasteryContribution,
  evidenceSampleCount,
} from '../src/agent/masteryEvidence'
import {
  computeMasteryProfile,
  levelFromValues,
  DIMENSION_KEYS,
} from '../src/agent/masteryEngine'
import { getLearningState } from '../src/agent/unifiedLearningState'
import { recommendByEvidence } from '../src/agent/evidenceRecommendation'
import { runAgent } from '../src/agent/localAgentEngine'
import { reducer } from '../src/store/reducer'
import { EXPERIMENTS_V3 } from '../src/data/experiments-v3'

// 近 7 天内的时间戳，确保进入 recent 窗口
const T = () => Date.now() - 1000

// 构造一条有实质内容的 Evidence（默认 targetType=hexagram）
const mkEv = (action, targetId, extra = {}) =>
  createEvidence({
    source: 'experiment', action, targetType: 'hexagram', targetId,
    context: '这是一段有实质内容', timestamp: T(), ...extra,
  })

// 覆盖 6 个可贡献维度 × 各 5 个不同目标（observation/structure 无法由证据派生）
function meaningfulHexEvidence() {
  const arr = []
  let id = 0
  const add = (action, n) => { for (let i = 0; i < n; i++) arr.push(mkEv(action, ++id)) }
  add('construct', 5)
  add('evidence', 5)
  add('counterexample', 5)
  add('revise', 5)
  add('reflect', 5)
  add('challenge', 5)
  return arr
}

// 构造一条 caseAttempt（V2 权威来源），维度分可控
const attempt = (dims) => ({
  caseId: 'c1', at: new Date().toISOString(), score: 80, confidence: 80,
  actualQuality: 80, errorTypes: [], dimensions: dims,
})

// ─────────────────── A. Evidence → Mastery Evidence 派生 ───────────────────
describe('Phase 2.5 · Evidence → Mastery Evidence 派生', () => {
  it('view / observe / complete 不产生 mastery evidence', () => {
    const list = [
      mkEv('view', 1, { context: '' }),
      mkEv('observe', 2),
      mkEv('complete', 3),
    ]
    expect(deriveMasteryEvidence(list)).toEqual([])
  })

  it('空内容 construct 不产出（最低证据门槛）', () => {
    expect(deriveMasteryEvidence([mkEv('construct', 1, { context: '' })])).toEqual([])
  })

  it('有内容 construct 产出 1 条，dimension=synthesis，quality=low，weight=1', () => {
    const d = deriveMasteryEvidence([mkEv('construct', 1)])
    expect(d.length).toBe(1)
    expect(d[0].dimension).toBe('synthesis')
    expect(d[0].quality).toBe('low')
    expect(d[0].weight).toBe(1)
  })

  it('analyze 无结构信号不产出', () => {
    expect(deriveMasteryEvidence([mkEv('analyze', 1, { context: '我觉得很不错' })])).toEqual([])
  })

  it('analyze 有结构信号产出 reasoning', () => {
    const d = deriveMasteryEvidence([mkEv('analyze', 1, { context: '九三得位且与上六相应' })])
    expect(d.length).toBe(1)
    expect(d[0].dimension).toBe('reasoning')
  })

  it('完整推理闭环（evidence+counterexample+revise）→ quality=high，weight=1.5', () => {
    const tid = 7
    const list = [
      mkEv('construct', tid), mkEv('evidence', tid),
      mkEv('counterexample', tid), mkEv('revise', tid),
    ]
    const c = deriveMasteryEvidence(list).find((x) => x.dimension === 'synthesis')
    expect(c.quality).toBe('high')
    expect(c.weight).toBe(1.5)
  })

  it('部分闭环（evidence+counterexample）→ quality=medium，weight=1.3', () => {
    const tid = 8
    const list = [mkEv('construct', tid), mkEv('evidence', tid), mkEv('counterexample', tid)]
    const c = deriveMasteryEvidence(list).find((x) => x.dimension === 'synthesis')
    expect(c.quality).toBe('medium')
    expect(c.weight).toBe(1.3)
  })

  it('携带错误 errorTypes → weight 减半，quality=error，reason 说明减半', () => {
    const d = deriveMasteryEvidence([mkEv('construct', 1, { errorTypes: ['E07'] })])
    expect(d[0].quality).toBe('error')
    expect(d[0].weight).toBe(0.5)
    expect(d[0].reason).toContain('减半')
  })

  it('闭环证据的 reason 标注「完整推理闭环」', () => {
    const tid = 9
    const list = [
      mkEv('construct', tid), mkEv('evidence', tid),
      mkEv('counterexample', tid), mkEv('revise', tid),
    ]
    const c = deriveMasteryEvidence(list).find((x) => x.dimension === 'synthesis')
    expect(c.reason).toContain('完整推理闭环')
  })

  it('evidenceText 从 context / result / result.text / metadata.text 取文本', () => {
    expect(evidenceText({ context: 'a' })).toBe('a')
    expect(evidenceText({ result: 'd' })).toBe('d')
    expect(evidenceText({ result: { text: 'b' } })).toBe('b')
    expect(evidenceText({ metadata: { text: 'c' } })).toBe('c')
    expect(evidenceText({})).toBe('')
  })

  it('qualityLabel 四档映射', () => {
    expect(qualityLabel(1.5)).toBe('high')
    expect(qualityLabel(1.3)).toBe('medium')
    expect(qualityLabel(1.0)).toBe('low')
    expect(qualityLabel(0.5)).toBe('error')
  })
})

// ─────────────────── B. Evidence → 能力贡献 ───────────────────
describe('Phase 2.5 · Evidence → 能力贡献（去重/递减/封顶/质量）', () => {
  it('空列表 / null 返回空对象', () => {
    expect(evidenceMasteryContribution([])).toEqual({})
    expect(evidenceMasteryContribution(null)).toEqual({})
  })

  it('view 不产生任何贡献', () => {
    expect(evidenceMasteryContribution([mkEv('view', 1, { context: '' })])).toEqual({})
  })

  it('单条 construct 贡献 synthesis.score=12', () => {
    const c = evidenceMasteryContribution([mkEv('construct', 1)])
    expect(c.synthesis.score).toBe(12)
    expect(c.synthesis.uniqueTargets).toBe(1)
  })

  it('同一对象重复操作去重（uniqueTargets=1，不加倍）', () => {
    const list = [mkEv('construct', 1), mkEv('construct', 1), mkEv('construct', 1)]
    const c = evidenceMasteryContribution(list)
    expect(c.synthesis.uniqueTargets).toBe(1)
    expect(c.synthesis.score).toBe(12)
  })

  it('不同对象 100 条 → score 封顶 60，capped=true', () => {
    const list = Array.from({ length: 100 }, (_, i) => mkEv('construct', i + 1))
    const c = evidenceMasteryContribution(list)
    expect(c.synthesis.uniqueTargets).toBe(100)
    expect(c.synthesis.score).toBeLessThanOrEqual(MASTERY_CAP)
    expect(c.synthesis.capped).toBe(true)
  })

  it('闭环证据维度 score > 孤立证据 score（质量加权）', () => {
    const iso = evidenceMasteryContribution([mkEv('construct', 1)]).synthesis.score
    const loop = evidenceMasteryContribution([
      mkEv('construct', 2), mkEv('evidence', 2), mkEv('counterexample', 2), mkEv('revise', 2),
    ]).synthesis.score
    expect(loop).toBeGreaterThan(iso)
  })

  it('携带错误的证据贡献更低（减半）', () => {
    const clean = evidenceMasteryContribution([mkEv('construct', 1)]).synthesis.score
    const err = evidenceMasteryContribution([mkEv('construct', 2, { errorTypes: ['E07'] })]).synthesis.score
    expect(err).toBeLessThan(clean)
  })

  it('evidence / counterexample / reflect 按维度分离贡献', () => {
    const c = evidenceMasteryContribution([mkEv('evidence', 1), mkEv('counterexample', 2), mkEv('reflect', 3)])
    expect(c.evidence.uniqueTargets).toBe(1)
    expect(c.counterexample.uniqueTargets).toBe(1)
    expect(c.uncertainty.uniqueTargets).toBe(1)
  })

  it('evidenceSampleCount：view 不计，有效目标才计', () => {
    expect(evidenceSampleCount([mkEv('view', 1, { context: '' })])).toBe(0)
    expect(evidenceSampleCount([mkEv('construct', 1), mkEv('construct', 2), mkEv('construct', 3)])).toBe(3)
  })
})

// ─────────────────── C. computeMasteryProfile 唯一事实源 ───────────────────
describe('Phase 2.5 · Mastery → L0-L6（唯一能力事实源）', () => {
  it('空状态 → L0 / overall 0 / sampleCount 0 / not ready', () => {
    const p = computeMasteryProfile({ ...initialState })
    expect(p.level).toBe('L0')
    expect(p.overall).toBe(0)
    expect(p.sampleCount).toBe(0)
    expect(p.ready).toBe(false)
  })

  it('单条 construct → synthesis=12，但 avg8 不足，仍 L0', () => {
    const p = computeMasteryProfile({ ...initialState, evidence: [mkEv('construct', 1)] })
    expect(p.synthesis).toBe(12)
    expect(p.overall).toBe(2) // (0+0+0+0+0+0+12+0)/8 = 1.5 → round 2
    expect(p.level).toBe('L0')
    expect(p.sampleCount).toBe(1)
  })

  it('完整多维度证据（6 维×5 目标）→ 维度真实并入，等级升到 L1', () => {
    const p = computeMasteryProfile({ ...initialState, evidence: meaningfulHexEvidence() })
    expect(p.synthesis).toBe(40)
    expect(p.evidence).toBe(40)
    expect(p.counterexample).toBe(40)
    expect(p.reasoning).toBe(40)
    expect(p.uncertainty).toBe(40)
    expect(p.independence).toBe(40)
    expect(p.observation).toBe(0) // 证据无法派生
    expect(p.structure).toBe(0)
    expect(p.level).toBe('L1') // avg8 >= 20 且样本 >= 1，但 observation/structure 挡住更高等级
  })

  it('levelFromValues 双重门控：能力值再高，样本为 0 也判 L0', () => {
    const v = { observation: 90, structure: 90, evidence: 90, reasoning: 90, counterexample: 90, uncertainty: 90, synthesis: 90, independence: 90 }
    expect(levelFromValues(v, 0).key).toBe('L0')
  })

  it('Evidence 不主导：大量 evidence 维度封顶 60，不会到 100', () => {
    const list = Array.from({ length: 50 }, (_, i) => mkEv('evidence', i + 1))
    const p = computeMasteryProfile({ ...initialState, evidence: list })
    expect(p.evidence).toBe(60)
    expect(p.evidence).toBeLessThanOrEqual(MASTERY_CAP)
  })

  it('max 合并：案例分 80 高于证据分 → 案例权威胜出', () => {
    const p = computeMasteryProfile({
      ...initialState,
      caseAttempts: [attempt({ info: 80, rule: 80, reasoning: 80, counter: 80, over: 80, boundary: 80 })],
      evidence: [mkEv('evidence', 1)],
    })
    expect(p.evidence).toBe(80) // round((80+80)/2)=80 > 证据分 12
  })

  it('max 合并反向：案例分 20 低于证据分 → Evidence 托底调节', () => {
    const p = computeMasteryProfile({
      ...initialState,
      caseAttempts: [attempt({ info: 20, rule: 20, reasoning: 20, counter: 20, over: 20, boundary: 20 })],
      evidence: [mkEv('evidence', 1), mkEv('evidence', 2)],
    })
    expect(p.evidence).toBe(22) // 证据分 22 > 案例分 20
  })

  it('DIMENSION_KEYS 8 维度顺序确定', () => {
    expect(DIMENSION_KEYS).toEqual(['observation', 'structure', 'evidence', 'reasoning', 'counterexample', 'uncertainty', 'synthesis', 'independence'])
  })

  it('bottleneck 指向最低维度（不把 independence 当瓶颈）', () => {
    const p = computeMasteryProfile({ ...initialState, evidence: [mkEv('evidence', 1)] })
    expect(p.bottleneck).toBeTruthy()
    expect(p.bottleneck.key).not.toBe('independence')
  })
})

// ─────────────────── D. reducer RECORD_EVIDENCE 闭环 ───────────────────
describe('Phase 2.5 · reducer RECORD_EVIDENCE 立即重算', () => {
  it('记录有内容 construct → masteryProfile 立即重算（overall > 0）', () => {
    const s = reducer(initialState, {
      type: 'RECORD_EVIDENCE',
      evidence: { source: 'workshop', action: 'construct', targetType: 'hexagram', targetId: 1, context: '内容', timestamp: T() },
    })
    expect(s.evidence.length).toBe(1)
    expect(s.masteryProfile.overall).toBeGreaterThan(0)
  })

  it('记录 view → masteryProfile 不变（防刷）', () => {
    const s = reducer(initialState, {
      type: 'RECORD_EVIDENCE',
      evidence: { source: 'workshop', action: 'view', targetType: 'hexagram', targetId: 1, timestamp: T() },
    })
    expect(s.masteryProfile.overall).toBe(0)
    expect(s.masteryProfile.level).toBe('L0')
  })

  it('连续记录 construct → synthesis 随目标数增长', () => {
    let s = initialState
    s = reducer(s, { type: 'RECORD_EVIDENCE', evidence: { source: 'workshop', action: 'construct', targetType: 'hexagram', targetId: 1, context: '内容', timestamp: T() } })
    const a = s.masteryProfile.synthesis
    s = reducer(s, { type: 'RECORD_EVIDENCE', evidence: { source: 'workshop', action: 'construct', targetType: 'hexagram', targetId: 2, context: '内容', timestamp: T() } })
    expect(s.masteryProfile.synthesis).toBeGreaterThan(a)
  })

  it('RECORD_EVIDENCE 不改变 caseAttempts（证据与案例来源隔离）', () => {
    const s = reducer(initialState, {
      type: 'RECORD_EVIDENCE',
      evidence: { source: 'workshop', action: 'construct', targetType: 'hexagram', targetId: 1, context: '内容', timestamp: T() },
    })
    expect((s.caseAttempts || []).length).toBe(0)
  })
})

// ─────────────────── E. Agent → UI 推荐唯一（场景E）───────────────────
describe('Phase 2.5 · Evidence → Agent → UI 推荐唯一', () => {
  const conflictState = () => ({ ...initialState, evidence: [mkEv('construct', 1), mkEv('construct', 2), mkEv('construct', 3)] })

  it('有证据信号 → nextActionSource=evidence，type=exp，id 指向真实实验', () => {
    const out = runAgent(conflictState())
    expect(out.nextActionSource).toBe('evidence')
    expect(out.nextAction.type).toBe('exp')
    expect(EXPERIMENTS_V3.some((e) => e.id === out.nextAction.id)).toBe(true)
  })

  it('nextAction.id 与证据推荐 primary.experiment.id 一致（同源）', () => {
    const out = runAgent(conflictState())
    expect(out.nextAction.id).toBe(out.evidenceRecommendation.primary.experiment.id)
  })

  it('evidenceWhy 带可追溯依据（evidenceIds + 理由点）', () => {
    const out = runAgent(conflictState())
    expect(out.evidenceWhy.title).toBe('为什么推荐这件事？')
    expect(out.evidenceWhy.evidenceIds.length).toBeGreaterThan(0)
    expect(out.evidenceWhy.points.some((p) => p.includes('依据'))).toBe(true)
  })

  it('旧 fingerprint 路径本可能给课程，但最终唯一推荐仍是证据推荐', () => {
    // mastery 为空 → 旧路径 totalMastery=0 会推荐 lesson；证据信号存在时应以证据为准
    const out = runAgent(conflictState())
    expect(out.nextActionSource).toBe('evidence')
    expect(out.nextAction.type).toBe('exp')
  })

  it('无证据信号 → 回退 legacy（旧路径）', () => {
    const out = runAgent({ ...initialState, evidence: [] })
    expect(out.nextActionSource).toBe('legacy')
  })

  it('nextAction.reasonCode 与 evidenceRecommendation.primary.reasonCode 一致', () => {
    const out = runAgent(conflictState())
    expect(out.nextAction.reasonCode).toBe(out.evidenceRecommendation.primary.reasonCode)
  })
})

// ─────────────────── F. 场景A · 连续 construct 无 evidence ───────────────────
describe('Phase 2.5 · 场景A · 连续 construct 无 evidence', () => {
  const state = () => ({ ...initialState, evidence: [mkEv('construct', 1), mkEv('construct', 2), mkEv('construct', 3)] })

  it('WEAK_EVIDENCE 信号 active', () => {
    expect(getLearningState(state()).recommendationSignals.WEAK_EVIDENCE.active).toBe(true)
  })

  it('primary.reasonCode = WEAK_EVIDENCE', () => {
    expect(recommendByEvidence(state()).primary.reasonCode).toBe('WEAK_EVIDENCE')
  })

  it('runAgent.nextAction 指向证据类实验', () => {
    const out = runAgent(state())
    expect(out.nextAction.type).toBe('exp')
    expect(out.nextAction.reasonCode).toBe('WEAK_EVIDENCE')
  })
})

// ─────────────────── G. 场景C · 防刷 ───────────────────
describe('Phase 2.5 · 场景C · 防刷', () => {
  it('view×100 → 能力不增长（L0 / overall 0）', () => {
    const list = Array.from({ length: 100 }, (_, i) => mkEv('view', i + 1, { context: '' }))
    const p = computeMasteryProfile({ ...initialState, evidence: list })
    expect(p.level).toBe('L0')
    expect(p.overall).toBe(0)
  })

  it('同一对象 construct×100 → 去重后仅 score=12', () => {
    const list = Array.from({ length: 100 }, () => mkEv('construct', 1))
    const c = evidenceMasteryContribution(list)
    expect(c.synthesis.uniqueTargets).toBe(1)
    expect(c.synthesis.score).toBe(12)
  })

  it('不同对象 construct×100 → 封顶 60，不无限增长', () => {
    const list = Array.from({ length: 100 }, (_, i) => mkEv('construct', i + 1))
    const c = evidenceMasteryContribution(list)
    expect(c.synthesis.score).toBe(60)
    expect(c.synthesis.capped).toBe(true)
  })

  it('view×100 不进入 sampleCount（样本门槛不因浏览而达标）', () => {
    const list = Array.from({ length: 100 }, (_, i) => mkEv('view', i + 1, { context: '' }))
    const p = computeMasteryProfile({ ...initialState, evidence: list })
    expect(p.sampleCount).toBe(0)
  })
})

// ─────────────────── H. 场景D · 观点修正 ───────────────────
describe('Phase 2.5 · 场景D · 观点修正（LOW_UNCERTAINTY 不误报）', () => {
  it('「原来的假设太绝对了」识别为主动修正，不算绝对化主张', () => {
    const s = analyzeSignals('原来的假设太绝对了')
    expect(s.selfCorrection).toBe(true)
    expect(s.absoluteClaims).toBe(0)
    expect(s.signalType).toBe(SIGNAL_TYPES.SELF_CORRECTION)
  })

  it('修正场景 primary=BELIEF_REVISION，LOW_UNCERTAINTY 不抢占', () => {
    const state = {
      ...initialState,
      evidence: [mkEv('evidence', 1), mkEv('counterexample', 1), mkEv('revise', 1, { context: '原来的假设太绝对了' })],
      beliefRevisions: [{ originalClaim: '得位即吉', revisedClaim: '得位不必然吉', counterEvidence: ['x'], reason: '反例', timestamp: T() }],
    }
    const rec = recommendByEvidence(state)
    expect(rec.primary.reasonCode).toBe('BELIEF_REVISION')
    expect(getLearningState(state).recommendationSignals.LOW_UNCERTAINTY).toBeUndefined()
  })

  it('真正绝对化主张仍触发 LOW_UNCERTAINTY', () => {
    const state = { ...initialState, evidence: [mkEv('construct', 1, { context: '得位一定就是吉，绝对没错' })] }
    expect(recommendByEvidence(state).primary.reasonCode).toBe('LOW_UNCERTAINTY')
  })
})

// ─────────────────── I. 推荐优先级（唯一主要推荐）───────────────────
describe('Phase 2.5 · 推荐优先级（唯一主要推荐）', () => {
  it('干预型 WEAK_EVIDENCE 先于正面 BELIEF_REVISION（多信号按优先级降序）', () => {
    const state = { ...initialState, evidence: [mkEv('construct', 1), mkEv('construct', 2), mkEv('construct', 3)] }
    const rec = recommendByEvidence(state)
    expect(rec.items[0].reasonCode).toBe('WEAK_EVIDENCE')
    expect(rec.items[1].reasonCode).toBe('NO_COUNTEREXAMPLE')
    expect(rec.primary.reasonCode).toBe('WEAK_EVIDENCE')
  })

  it('primary 唯一且为最高优先级（四个信号严格按优先级降序）', () => {
    const rec = recommendByEvidence({ ...initialState, evidence: [mkEv('construct', 1), mkEv('construct', 2), mkEv('construct', 3)] })
    // 3 次 construct（结构触碰≥3、无传统/原典）会同时触发 4 个信号
    expect(rec.items.map((i) => i.reasonCode)).toEqual([
      'WEAK_EVIDENCE', 'NO_COUNTEREXAMPLE', 'TRADITION_GAP', 'UNDERUSED_CLASSIC',
    ])
    expect(rec.primary).toBe(rec.items[0])
  })

  it('无任何信号 → primary 为 null（回退 legacy）', () => {
    expect(recommendByEvidence({ ...initialState, evidence: [] }).primary).toBeNull()
  })
})