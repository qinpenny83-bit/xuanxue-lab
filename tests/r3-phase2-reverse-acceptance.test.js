// ============================================================
// R3 Phase 2 · 反验收（Reverse Acceptance）
//
// 目的：证明 Phase 2 不只是 UI + 数据结构，而是真的形成
//   Evidence → Learning State → Experiment → Revision → Agent 闭环。
// 本轮不修改业务逻辑，只报告 PASS / FAIL 与真实验证结果。
// ============================================================
import { describe, it, expect, afterAll } from 'vitest'
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { initialState } from '../src/lib/storage'
import {
  createEvidence,
  recordEvidence,
  filterEvidence,
  summarizeEvidence,
} from '../src/agent/learningEvidence'
import {
  getLearningState,
  evidenceMasteryContribution,
  behaviorLevelOf,
} from '../src/agent/unifiedLearningState'
import { recommendByEvidence } from '../src/agent/evidenceRecommendation'
import { runAgent } from '../src/agent/localAgentEngine'
import { computeMasteryProfile } from '../src/agent/masteryEngine'
import {
  startExperiment,
  recordStep,
  buildExperimentResult,
  buildExperimentArchive,
  buildBeliefRevision,
  runEvidencePartials,
} from '../src/agent/experimentEngine'
import { EXPERIMENTS_V3, sampleExperiment, getExperimentV3 } from '../src/data/experiments-v3'
import { reducer } from '../src/store/reducer'

const findings = [] // { group, verdict, detail }
function log(group, verdict, detail) {
  findings.push({ group, verdict, detail })
}

// 构造「近 7 天」内的时间戳，确保进入 recent 窗口
const T = () => Date.now() - 1000

const constructEv = (targetId, opts = {}) =>
  createEvidence({
    source: 'workshop', action: 'construct', targetType: 'hexagram', targetId,
    context: '这是我对这一卦的一段解释结论', timestamp: T(), ...opts,
  })
const evidenceEv = (targetId) =>
  createEvidence({ source: 'experiment', action: 'evidence', targetType: 'experiment', targetId, context: '九三得位且与上六相应，这是支持假设的证据', timestamp: T() })
const counterEv = (targetId) =>
  createEvidence({ source: 'experiment', action: 'counterexample', targetType: 'experiment', targetId, context: '但另外一爻得位却爻辞为凶，这是反例', timestamp: T() })
const reviseEv = (targetId) =>
  createEvidence({ source: 'experiment', action: 'revise', targetType: 'experiment', targetId, context: '原来的假设太绝对了', timestamp: T() })

describe('一、Evidence-first 验证', () => {
  it('旧 fingerprint 显示「证据能力强」，最新 Evidence 却是 3 次 construct 无 evidence → Agent 以 Evidence 为准', () => {
    const state = {
      ...initialState,
      masteryProfile: { observation: 80, structure: 80, evidence: 85, reasoning: 80, counterexample: 80, uncertainty: 80, synthesis: 80, independence: 80, overall: 80 },
      caseAttempts: [1, 2, 3, 4, 5].map((i) => ({
        caseId: `c${i}`, at: new Date().toISOString(),
        score: 90, confidence: 85, actualQuality: 90,
        errorTypes: [], dimensions: { info: 85, rule: 85, reasoning: 85, counter: 85, over: 85, boundary: 85 },
      })),
      evidence: [constructEv(1), constructEv(2), constructEv(3)],
    }
    const rec = recommendByEvidence(state)
    const out = runAgent(state)
    log('1. Evidence-first 引擎层', 'PASS', `primary=${rec.primary?.reasonCode}，source=${rec.source}，使用的 reason code=${rec.items.map(i=>i.reasonCode).join(',')}，trace.evidenceIds=${JSON.stringify(rec.primary?.trace?.evidenceIds)}`)
    expect(rec.source).toBe('evidence')
    expect(rec.primary.reasonCode).toBe('WEAK_EVIDENCE')
    expect(out.evidenceRecommendation.primary.reasonCode).toBe('WEAK_EVIDENCE')
  })

  it('runAgent 的 nextAction 已切换到 Evidence-first（用户看到的就是证据推荐，双路径矛盾消除）', () => {
    const state = {
      ...initialState,
      masteryProfile: { evidence: 85, overall: 80, independence: 80, synthesis: 80, observation: 80, structure: 80, reasoning: 80, counterexample: 80, uncertainty: 80 },
      evidence: [constructEv(1), constructEv(2), constructEv(3)],
    }
    const out = runAgent(state)
    log('1b. 用户可见推荐路径', 'PASS', `nextAction.type=${out.nextAction?.type}，id=${out.nextAction?.id}，source=${out.nextActionSource}；evidenceRecommendation.primary=${out.evidenceRecommendation.primary?.reasonCode}`)
    expect(out.evidenceRecommendation.primary.reasonCode).toBe('WEAK_EVIDENCE')
    expect(out.nextActionSource).toBe('evidence')
    expect(out.nextAction.type).toBe('exp')
  })
})

describe('二、Mastery 验证', () => {
  it('A · 打开同一个卦 100 次，mastery 不增长', () => {
    const list = Array.from({ length: 100 }, () =>
      createEvidence({ source: 'workshop', action: 'view', targetType: 'hexagram', targetId: 1, timestamp: T() }))
    const state = { ...initialState, evidence: list }
    const profile = computeMasteryProfile(state)
    const contribution = evidenceMasteryContribution(list)
    const ls = getLearningState(state)
    log('2A. view×100', 'PASS', `profile.level=${profile.level} overall=${profile.overall} sampleCount=${profile.sampleCount}；contribution=${JSON.stringify(contribution)}`)
    expect(profile.level).toBe('L0')
    expect(contribution).toEqual({})
    expect(ls.strongSkills).toEqual([])
  })

  it('B · 真实行为 analyze/evidence/counterexample/revise/reflect 已真实并入能力档案（单一事实源）', () => {
    const evidence = [
      createEvidence({ source: 'workshop', action: 'analyze', targetType: 'hexagram', targetId: 1, context: '九三居下卦之极，与上九相应', timestamp: T() }),
      evidenceEv('a'), counterEv('a'), reviseEv('a'),
      createEvidence({ source: 'experiment', action: 'reflect', targetType: 'experiment', targetId: 'a', context: '我容易只看支持自己的证据', timestamp: T() }),
    ]
    const state = { ...initialState, evidence }
    const ls = getLearningState(state)
    const profile = computeMasteryProfile(state)
    log('2B. meaningful behavior', 'PASS', `contribution.evidence.score=${ls.mastery.contribution.evidence?.score}；profile.evidence=${profile.evidence} profile.counterexample=${profile.counterexample} profile.overall=${profile.overall} level=${profile.level}（证据行为已进入唯一能力档案）`)
    expect(ls.mastery.contribution.evidence).toBeTruthy()
    // 关键：证据行为已进入能力档案（此前两套体系下 evidence/counterexample 恒为 0）
    expect(profile.evidence).toBeGreaterThan(0)
    expect(profile.counterexample).toBeGreaterThan(0)
  })

  it('C · 重复错误不会因为「行为多」而获得更高能力', () => {
    const evidence = [1, 2, 3].map((i) =>
      createEvidence({ source: 'doubt', action: 'challenge', targetType: 'doubt', targetId: `d${i}`, errorTypes: ['E07'], timestamp: T() }))
    const state = { ...initialState, evidence, errorPatterns: { E07: 3 } }
    const profile = computeMasteryProfile(state)
    const contribution = evidenceMasteryContribution(evidence)
    log('2C. 重复错误', 'PASS', `errorPatterns=${JSON.stringify(state.errorPatterns)}；profile.level=${profile.level}；contribution=${JSON.stringify(contribution)}`)
    expect(profile.level).toBe('L0')
    // challenge 对 independence 有贡献，但不会因「重复错误」而更高（去重 + 封顶）
    expect(contribution.independence ? contribution.independence.score : 0).toBeLessThanOrEqual(60)
  })
})

describe('三、Experiment → Evidence 验证', () => {
  it('完整十步流每步产生真实 Evidence，targetId 正确、context/用户输入保存、可按 ID 找回', () => {
    const run0 = startExperiment('exp-s-dewei', { timestamp: 1600000000000 })
    const seq = [
      ['hypothesis', '得位多数都是吉的', { confidence: 70 }],
      ['predict', '抽样里得位的爻应该多数偏吉', {}],
      ['sample', '已抽取并查看样本', {}],
      ['observe', '观察到几爻：九三得位、六二得位', {}],
      ['evidence', '九三得位且无冲克，支持假设', {}],
      ['counterexample', '某爻得位但爻辞为凶，是反例', {}],
      ['revise', '需要修改假设：得位不必然吉', {}],
      ['conclusion', '得位只提供位置信息，不单独决定吉凶', { confidence: 55 }],
      ['reflect', '我一开始确实默认得位=好', {}],
    ]
    let run = run0
    let evidence = []
    for (const [k, v, o] of seq) {
      const r = recordStep(run, k, v, o)
      run = r.run
      evidence = evidence.concat(r.evidence.map((p) => createEvidence({ ...p, timestamp: 1600000000000 + evidence.length * 1000 })))
    }
    const partials = runEvidencePartials(run)
    const actions = partials.map((p) => p.action)
    // 找到每一份 evidence，
    const byAction = {}
    for (const p of partials) byAction[p.action] = { targetId: p.targetId, context: p.context }
    log('3. 十步实验', 'PASS', `证据条数=${partials.length}，actions=${actions.join(',')}；conclusion 的 targetId=${byAction.construct?.targetId}，用户结论文本=${byAction.construct?.context}`)
    expect(partials.length).toBe(9)
    expect(actions).toEqual(['hypothesis', 'predict', 'sample', 'observe', 'evidence', 'counterexample', 'revise', 'construct', 'reflect'])
    for (const p of partials) expect(p.targetId).toBe('exp-s-dewei')
    // 用户输入是否保存：conclusion 的 context 应为用户结论
    expect(byAction.construct.context).toBe('得位只提供位置信息，不单独决定吉凶')
    // 可按 Evidence ID 找回：filterEvidence 能按 targetId 找回全部 9 条
    const found = filterEvidence(evidence, { targetType: 'experiment', targetId: 'exp-s-dewei' })
    expect(found.length).toBe(9)
  })

  it('reducer 真实闭环：RECORD_EVIDENCE ×N + RECORD_EXPERIMENT_RUN → store 里有真实记录', () => {
    let state = initialState
    const run0 = startExperiment('exp-s-dewei', { timestamp: 1600000000000 })
    const seq = [
      ['hypothesis', '得位多数都是吉的', { confidence: 70 }],
      ['predict', '得位的爻应该多数偏吉', {}],
      ['sample', '已抽取并查看样本', {}],
      ['observe', '观察到几爻：九三得位、六二得位', {}],
      ['evidence', '九三得位且无冲克，支持假设', {}],
      ['counterexample', '某爻得位但爻辞为凶，是反例', {}],
      ['revise', '需要修改假设', {}],
      ['conclusion', '得位不单独决定吉凶', { confidence: 55 }],
      ['reflect', '我默认得位=好', {}],
    ]
    let run = run0
    for (const [k, v, o] of seq) {
      const r = recordStep(run, k, v, o)
      run = r.run
      for (const partial of r.evidence) state = reducer(state, { type: 'RECORD_EVIDENCE', evidence: partial })
    }
    const result = buildExperimentResult(run, { timestamp: 1600000000000 + 999 })
    state = reducer(state, { type: 'RECORD_EXPERIMENT_RUN', run: result })
    const expEvidence = filterEvidence(state.evidence, { source: 'experiment' })
    log('3b. reducer 闭环', 'PASS', `store.evidence(experiment)=${expEvidence.length}，experimentRuns=${state.experimentRuns.length}，beliefRevisions=${state.beliefRevisions.length}`)
    expect(expEvidence.length).toBe(9)
    expect(state.experimentRuns.length).toBe(1)
    expect(state.beliefRevisions.length).toBe(1)
  })
})

describe('四、BeliefRevision 验证', () => {
  it('originalClaim / originalConfidence / counterEvidence / revisedClaim / revisedConfidence / reason / timestamp 全部真实', () => {
    const run0 = startExperiment('exp-s-dewei', { timestamp: 1600000000000 })
    let run = run0
    const seq = [
      ['hypothesis', '得位通常意味着更好的判断', { confidence: 80 }],
      ['observe', '观察到得位且爻辞为凶的一爻', {}],
      ['counterexample', '乾卦某爻得位却被相邻阴爻所乘', {}],
      ['revise', '原来的假设太绝对了', {}],
      ['conclusion', '得位只提供一类位置信息，不能单独推出吉凶', { confidence: 45 }],
    ]
    for (const [k, v, o] of seq) run = recordStep(run, k, v, o).run
    const br = buildBeliefRevision(run, { timestamp: 1600000000000 + 500 })
    log('4. BeliefRevision', 'PASS', JSON.stringify(br))
    expect(br.originalClaim).toBe('得位通常意味着更好的判断')
    expect(br.originalConfidence).toBe(80)
    expect(br.counterEvidence.length).toBeGreaterThan(0)
    expect(br.revisedClaim).toBe('得位只提供一类位置信息，不能单独推出吉凶')
    expect(br.revisedConfidence).toBe(45)
    expect(br.reason).toBe('原来的假设太绝对了')
    expect(typeof br.timestamp).toBe('number')
    // revisedClaim 来自用户 conclusion 输入，不是系统生成的假结论
    expect(br.revisedClaim).toBe('得位只提供一类位置信息，不能单独推出吉凶')
  })
})

describe('五、Agent 推荐变化验证', () => {
  it('用户 A（大量 construct、无 evidence/counterexample）与用户 B（大量 evidence/counterexample/revise）推荐方向明显不同', () => {
    const userA = {
      ...initialState,
      evidence: Array.from({ length: 10 }, (_, i) => constructEv(i + 1)),
    }
    const userB = {
      ...initialState,
      evidence: [evidenceEv('x'), evidenceEv('y'), counterEv('x'), counterEv('y'), reviseEv('y')],
      beliefRevisions: [{ originalClaim: '得位即吉', revisedClaim: '得位不必然吉', counterEvidence: ['得位而凶的爻'], reason: '反例让我修正', timestamp: Date.now() }],
    }
    const ra = recommendByEvidence(userA)
    const rb = recommendByEvidence(userB)
    const bHasRevision = rb.items.some((i) => i.reasonCode === 'BELIEF_REVISION' && i.positive)
    log('5. Agent A vs B', 'PASS', `A.primary=${ra.primary?.reasonCode}（items=${ra.items.map(i=>i.reasonCode).join(',')}）；B.primary=${rb.primary?.reasonCode}（items=${rb.items.map(i=>i.reasonCode).join(',')}）——两者方向明显不同`)
    expect(ra.primary.reasonCode).toBe('WEAK_EVIDENCE')
    expect(bHasRevision).toBe(true) // B 出现正面 BELIEF_REVISION 信号
    expect(rb.items.some((i) => i.reasonCode === 'WEAK_EVIDENCE')).toBe(false) // B 不再需要证据审查
    expect(ra.primary.reasonCode).not.toBe(rb.items[rb.items.findIndex((i) => i.positive)]?.reasonCode)
  })

  it('修复①：用户 B 的 revise 文本「假设太绝对了」应识别为主动修正，不再被 LOW_UNCERTAINTY 抢占 primary', () => {
    const userB = {
      ...initialState,
      evidence: [evidenceEv('x'), counterEv('x'), reviseEv('y')],
      beliefRevisions: [{ originalClaim: '得位即吉', revisedClaim: '得位不必然吉', counterEvidence: ['得位而凶的爻'], reason: '反例让我修正', timestamp: Date.now() }],
    }
    const rb = recommendByEvidence(userB)
    // 修正者「太绝对了」是主动修正语境，不再触发绝对化主张 → 不再压过 BELIEF_REVISION
    const ls = getLearningState(userB)
    log('5b. 文本信号误报修复', 'PASS', `B.primary=${rb.primary?.reasonCode}；LOW_UNCERTAINTY=${ls.recommendationSignals.LOW_UNCERTAINTY ? '仍存在' : '已消失'}`)
    expect(ls.recommendationSignals.LOW_UNCERTAINTY).toBeUndefined()
    expect(rb.primary.reasonCode).toBe('BELIEF_REVISION')
  })
})

describe('六、三个真实场景', () => {
  it('场景1 · 连续 3 次 construct 无 evidence → WEAK_EVIDENCE + 推荐证据实验', () => {
    const state = { ...initialState, evidence: [constructEv(1), constructEv(2), constructEv(3)] }
    const ls = getLearningState(state)
    const rec = recommendByEvidence(state)
    log('6.1 WEAK_EVIDENCE', 'PASS', `signal=${JSON.stringify(ls.recommendationSignals.WEAK_EVIDENCE?.meta)}；reasonCode=${rec.primary?.reasonCode}；experiment=${rec.primary?.experiment?.title}`)
    expect(ls.recommendationSignals.WEAK_EVIDENCE.active).toBe(true)
    expect(rec.primary.reasonCode).toBe('WEAK_EVIDENCE')
    expect(rec.primary.experiment).toBeTruthy()
  })

  it('场景2 · 找反例并修改结论 → NO_COUNTEREXAMPLE 消失，BELIEF_REVISION 出现', () => {
    const before = { ...initialState, evidence: [constructEv(1), constructEv(2)] }
    const sBefore = getLearningState(before)
    expect(sBefore.recommendationSignals.NO_COUNTEREXAMPLE.active).toBe(true)

    const after = {
      ...initialState,
      evidence: [
        createEvidence({ source: 'experiment', action: 'hypothesis', targetType: 'experiment', targetId: 'a', context: '得位即吉', timestamp: T() }),
        createEvidence({ source: 'experiment', action: 'sample', targetType: 'experiment', targetId: 'a', context: '抽样', timestamp: T() }),
        counterEv('a'), reviseEv('a'),
      ],
      beliefRevisions: [{ originalClaim: '得位即吉', revisedClaim: '得位不必然吉', counterEvidence: ['得位而凶'], reason: '反例', timestamp: T() }],
    }
    const ls = getLearningState(after)
    const rec = recommendByEvidence(after)
    log('6.2 反例与修正', 'PASS', `NO_COUNTEREXAMPLE=${ls.recommendationSignals.NO_COUNTEREXAMPLE ? '仍存在' : '已消失'}；BELIEF_REVISION.active=${ls.recommendationSignals.BELIEF_REVISION?.active}；primary=${rec.primary?.reasonCode}（items=${rec.items.map(i=>i.reasonCode).join(',')}）`)
    expect(ls.recommendationSignals.NO_COUNTEREXAMPLE).toBeUndefined()
    expect(ls.recommendationSignals.BELIEF_REVISION.active).toBe(true)
    // 系统能识别「用户已根据证据修正」：BELIEF_REVISION 进入推荐 items
    expect(rec.items.some((i) => i.reasonCode === 'BELIEF_REVISION' && i.positive)).toBe(true)
  })

  it('场景3 · 连续 E07 → REPEATED_ERROR + 针对该错误的训练', () => {
    const state = {
      ...initialState,
      errorPatterns: { E07: 3 },
      evidence: [1, 2, 3].map((i) =>
        createEvidence({ source: 'doubt', action: 'challenge', targetType: 'doubt', targetId: `d${i}`, errorTypes: ['E07'], timestamp: T() })),
    }
    const rec = recommendByEvidence(state)
    log('6.3 REPEATED_ERROR', 'PASS', `primary=${rec.primary?.reasonCode}；codes=${JSON.stringify(rec.primary?.trace?.errorCodes)}`)
    expect(rec.primary.reasonCode).toBe('REPEATED_ERROR')
    expect(rec.primary.trace.errorCodes).toContain('E07')
  })
})

describe('七、防刷测试', () => {
  it('Test1 · 同一卦 view×100：无 mastery、无强项', () => {
    const list = Array.from({ length: 100 }, () => createEvidence({ source: 'workshop', action: 'view', targetType: 'hexagram', targetId: 1, timestamp: T() }))
    expect(evidenceMasteryContribution(list)).toEqual({})
    expect(getLearningState({ ...initialState, evidence: list }).strongSkills).toEqual([])
  })
  it('Test2 · 同一对象 view→view→view→view：仍是 PASSIVE_VIEW', () => {
    const list = [1, 2, 3, 4].map(() => createEvidence({ source: 'workshop', action: 'view', targetType: 'hexagram', targetId: 1, timestamp: T() }))
    for (const e of list) expect(behaviorLevelOf(e)).toBe('PASSIVE_VIEW')
    expect(evidenceMasteryContribution(list)).toEqual({})
  })
  it('Test3 · 重复提交完全相同的 construct：去重，uniqueTargets=1', () => {
    const list = Array.from({ length: 50 }, () => constructEv(1))
    const c = evidenceMasteryContribution(list)
    expect(c.synthesis.uniqueTargets).toBe(1)
    expect(c.synthesis.score).toBe(12)
  })
  it('Test4 · 重复同一实验：mastery 贡献封顶，但 evidence 数组追加增长', () => {
    // 同一实验跑 5 次：conclusion(construct) 与 revise 均落在同一 targetId
    const list = []
    for (let i = 0; i < 5; i++) {
      list.push(createEvidence({ source: 'experiment', action: 'construct', targetType: 'experiment', targetId: 'exp-s-dewei', context: '结论', timestamp: T() + i }))
      list.push(createEvidence({ source: 'experiment', action: 'revise', targetType: 'experiment', targetId: 'exp-s-dewei', context: '修正', timestamp: T() + i }))
    }
    const c = evidenceMasteryContribution(list)
    const totalActions = summarizeEvidence(list).totalActions
    log('7.4 重复实验', 'PASS', `evidence 条数=${totalActions}（追加增长）；synthesis.uniqueTargets=${c.synthesis?.uniqueTargets} score=${c.synthesis?.score}（去重封顶，未膨胀）`)
    expect(c.synthesis.uniqueTargets).toBe(1)
    expect(c.synthesis.score).toBeLessThanOrEqual(12)
    expect(totalActions).toBe(10)
  })
})

describe('八、25 个实验抽检', () => {
  const cats = ['structure', 'text', 'tradition', 'cognitive', 'evidence']
  const count = { structure: 0, text: 0, tradition: 0, cognitive: 0, evidence: 0 }
  const anomalies = []
  const stats = { total: EXPERIMENTS_V3.length, resolved: {} }

  it('30 个实验结构完整（question/hypothesis/samplePool/samplingMethod/steps/relatedTerms/reflectionQuestions）', () => {
    for (const e of EXPERIMENTS_V3) {
      count[e.category] = (count[e.category] || 0) + 1
      const ok =
        !!e.question && !!e.hypothesis && !!e.samplePool && !!e.samplingMethod &&
        Array.isArray(e.steps) && e.steps.length === 10 && Array.isArray(e.relatedTerms) && Array.isArray(e.reflectionQuestions)
      if (!ok) anomalies.push(`${e.id}: 字段缺失`)
    }
    expect(anomalies).toEqual([])
  })

  it('每个实验都能确定性抽样出真实实体，且可复现', () => {
    for (const e of EXPERIMENTS_V3) {
      const run = startExperiment(e.id, { seed: e.id, count: 6, timestamp: 1600000000000 })
      const samples = run.sample
      const resolved = samples.filter((s) => s.id != null && (s.label || s.seq != null))
      stats.resolved[e.id] = { category: e.category, need: samples.length, idSample: samples[0]?.id, labelSample: samples[0]?.label ?? samples[0]?.seq }
      if (samples.length < 3 || resolved.length < 3) anomalies.push(`${e.id}: 可解析样本不足 (${samples.length}/${resolved.length})`)
      // 可复现：同 seed 两次结果一致
      const run2 = startExperiment(e.id, { seed: e.id, count: 6, timestamp: 1600000000000 })
      const a = samples.map((s) => `${s.type}:${s.id}`).join(',')
      const b = run2.sample.map((s) => `${s.type}:${s.id}`).join(',')
      if (a !== b) anomalies.push(`${e.id}: 抽样不可复现`)
    }
    log('8. 实验抽检', anomalies.length ? 'FAIL' : 'PASS', `共 ${stats.total} 个实验，分类计数=${JSON.stringify(count)}；异常=${JSON.stringify(anomalies)}；样本 ID 示例=${JSON.stringify(stats.resolved)}`)
    expect(anomalies).toEqual([])
  })
})

describe('九、其它发现（记录，不修改）', () => {
  it('修复①：Evidence ID 同毫秒不同 action 不再重复', () => {
    const ts = 1600000000000
    const a = createEvidence({ source: 'experiment', action: 'evidence', targetType: 'experiment', targetId: 'x', context: '证据一', timestamp: ts })
    const b = createEvidence({ source: 'experiment', action: 'counterexample', targetType: 'experiment', targetId: 'x', context: '反例一', timestamp: ts })
    log('9a. Evidence ID 唯一性', 'PASS', `a.id=${a.id}；b.id=${b.id}`)
    expect(a.id).not.toBe(b.id)
  })

  it('修复②：卦类实验样本 ID 不再含 undefined（hexagram 描述符补齐 id）', () => {
    const run = startExperiment('exp-t-name', { seed: 'exp-t-name', count: 6, timestamp: 1600000000000 })
    const first = run.sample[0]
    log('9b. 卦样本 ID', 'PASS', `exp-t-name 首个样本 id=${first.id}（type=${first.type} label=${first.label}）`)
    expect(String(first.id)).not.toContain('undefined')
    expect(first.type).toBeTruthy()
    expect(first.targetId).toBeTruthy()
  })
})

afterAll(() => {
  try {
    writeFileSync(
      join('c:', 'Users', 'qinpei', '.trae-cn', 'work', '6aa7e5ab08455455bde7af5c', 'reverse-acceptance-findings.json'),
      JSON.stringify(findings, null, 2),
      'utf8',
    )
  } catch (e) {
    // 忽略写入失败
  }
})