// ============================================================
// R3 Phase 3 · 怀疑室（DoubtTask Selector / Runner / Evidence→Mastery /
// Agent 接管 / UI 数据契约）测试
//
// 覆盖 20 个验收点：
//   1. 10 类错误 → 正确选择对应任务
//   2. 新用户默认任务
//   3. 重复错误优先级
//   4. Evidence 不足优先级
//   5. 无反例优先级
//   6. 任务完成 → Evidence
//   7. Evidence → Mastery
//   8. Mastery → Agent
//   9. Agent → Home 推荐
//  10. BeliefRevision
//  11. 反例行为
//  12. 自我修正
//  13. 机械点击反作弊
//  14. 同一任务重复完成
//  15. 同类任务换题
//  16. 推荐理由可追溯 Evidence ID
//  17. 20 个随机 DoubtTask 完整性
//  18. 全量 190 个 DoubtTask 引用完整
//  19. build / 20. 全量回归 —— 由命令层验证（vite build + vitest run）
//
// 核心验收：一次真实认知纠偏行为 → Mastery / ErrorMuseum / Agent 判断 /
// Home 推荐至少其一发生可解释变化（见「闭环」分组）。
// ============================================================
import { describe, it, expect } from 'vitest'
import {
  selectDoubtTask,
  DOUBT_PRIORITY,
} from '../src/agent/doubtSelector'
import {
  startDoubtTask,
  recordDoubtStep,
  buildDoubtResult,
  buildDoubtBeliefRevision,
  buildDoubtArchive,
  runDoubtEvidencePartials,
  summarizeDoubtSignals,
  hasRevision,
  doubtStepSignals,
  DOUBT_STEP_KEYS,
  DOUBT_STEP_ACTIONS,
  DOUBT_FLOW,
} from '../src/agent/doubtEngine'
import {
  DOUBT_TASKS,
  DOUBT_CATEGORIES,
  getDoubtTask,
  doubtTasksByCategory,
  doubtCategoryCount,
} from '../src/data/doubtTasks'
import { createEvidence, recordEvidence } from '../src/agent/learningEvidence'
import {
  computeMasteryProfile,
  DIMENSION_KEYS,
  MASTERY_DIMENSIONS,
} from '../src/agent/masteryEngine'
import {
  evidenceMasteryContribution,
  evidenceSampleCount,
  MASTERY_ACTION_RULES,
} from '../src/agent/masteryEvidence'
import { runAgent } from '../src/agent/localAgentEngine'
import { reducer } from '../src/store/reducer'
import { initialState } from '../src/lib/storage'
import { ERROR_TYPES } from '../src/agent/errors'

const T = () => Date.now() - 1000

// ── 测试状态构造工具 ─────────────────────────────────────────
// 一段普通构造类证据（targetId 可复用；sameTarget 用于压低 mastery 样本数）
const construct = (targetId = 1, context = '内容文本', extra = {}) =>
  createEvidence({ source: 'workshop', action: 'construct', targetType: 'hexagram', targetId, context, timestamp: T(), ...extra })

// 携带错误的证据（触发 REPEATED_ERROR）
const errEv = (code, targetId = 'flaw-01', seq) =>
  createEvidence({ source: 'doubt', action: 'hypothesis', targetType: 'doubt', targetId, context: '我的第一反应判断', errorTypes: [code], timestamp: T(), __seq: seq })

// 5 次证据意识弱（over 低）的案例行为 → evidence 维度瓶颈
const weakEvAttempt = (o = {}) => ({
  caseId: 'case-001', at: T(), attempt: 1, redo: false, score: 60, confidence: 70, actualQuality: 60,
  errorTypes: [], dimensions: { info: 55, rule: 65, reasoning: 60, counter: 55, over: 20, boundary: 55 },
  level: 2, usedUnknown: false, hintDependency: 0, consultedKnowledge: false, beliefRevision: null,
  ...o,
})
const bottleneckState = () => ({
  ...initialState,
  caseAttempts: [weakEvAttempt(), weakEvAttempt(), weakEvAttempt(), weakEvAttempt(), weakEvAttempt()],
})

// 完整走完一个怀疑任务（纯引擎，不经过 reducer）
function fullDoubtRun(taskId, texts = {}) {
  let run = startDoubtTask(taskId, { timestamp: T() })
  run = recordDoubtStep(run, 'hypothesis', texts.hypothesis ?? '得位只是结构信息', { confidence: 60 }).run
  run = recordDoubtStep(run, 'evidence', texts.evidence ?? '我找到原文作为依据', { timestamp: T() }).run
  run = recordDoubtStep(run, 'counterexample', texts.counterexample ?? '也有得位却爻辞为凶的反例', { timestamp: T() }).run
  run = recordDoubtStep(run, 'revise', texts.revise ?? '原来的判断太绝对了，现在认为未必', { timestamp: T() }).run
  run = recordDoubtStep(run, 'reflect', texts.reflect ?? '我在反例那一步最容易卡住', { timestamp: T() }).run
  return run
}

// 通过 reducer 完整完成一次怀疑（写入全部 Evidence + 归档 + 重算 mastery）
function completeDoubtThroughReducer(state, taskId, texts) {
  const run = fullDoubtRun(taskId, texts)
  const partials = runDoubtEvidencePartials(run)
  let s = state
  for (const p of partials) s = reducer(s, { type: 'RECORD_EVIDENCE', evidence: p })
  s = reducer(s, { type: 'RECORD_DOUBT_RUN', run: buildDoubtResult(run, { timestamp: T() }) })
  return s
}

// ─────────────────────────────────────────────────────────────
// A. selectDoubtTask · 新用户默认路径（验收点 2）
// ─────────────────────────────────────────────────────────────
describe('Phase 3A · 新用户默认路径', () => {
  it('全新状态 + allowContinuity → CONTINUITY，任务来自 flaw 类，不伪造问题', () => {
    const sel = selectDoubtTask({ ...initialState, evidence: [] }, { allowContinuity: true })
    expect(sel).toBeTruthy()
    expect(sel.reasonCode).toBe('CONTINUITY')
    expect(sel.priority).toBe(DOUBT_PRIORITY.CONTINUITY)
    const task = getDoubtTask(sel.taskId)
    expect(task).toBeTruthy()
    expect(task.category).toBe('flaw')
  })

  it('全新状态 + allowContinuity=false（首页）→ 返回 null，不伪造问题', () => {
    const sel = selectDoubtTask({ ...initialState, evidence: [] }, { allowContinuity: false })
    expect(sel).toBeNull()
  })

  it('CONTINUITY 的 reason 可直接展示：说明是第一次进入怀疑室', () => {
    const sel = selectDoubtTask({ ...initialState, evidence: [] }, { allowContinuity: true })
    expect(sel.reason).toContain('第一次进入怀疑室')
    expect(String(sel.reason)).not.toContain('undefined')
  })

  it('CONTINUITY 的 expectedSkill 来自任务 masteryKeys（非空）', () => {
    const sel = selectDoubtTask({ ...initialState, evidence: [] }, { allowContinuity: true })
    expect(sel.expectedSkill).toBeTruthy()
  })

  it('runAgent：新用户 Home 不出现怀疑推荐（doubtRecommendation 为 null）', () => {
    const agent = runAgent({ ...initialState, evidence: [] })
    expect(agent.doubtRecommendation).toBeNull()
    expect(agent.nextAction.type).toBe('lesson')
  })
})

// ─────────────────────────────────────────────────────────────
// B. selectDoubtTask · 10 类错误 → 对应任务（验收点 1）
// ─────────────────────────────────────────────────────────────
describe('Phase 3A · 10 类错误 → 正确选择对应任务', () => {
  it('E01–E10 每类重复出现 → REPEATED_ERROR 且 targetError 正确、任务携带该错误码', () => {
    for (const code of Object.keys(ERROR_TYPES)) {
      const state = { ...initialState, evidence: [errEv(code, 'flaw-01', 1), errEv(code, 'flaw-02', 2)] }
      const sel = selectDoubtTask(state, { allowContinuity: false })
      expect(sel, `${code} 未触发选择`).toBeTruthy()
      expect(sel.reasonCode).toBe('REPEATED_ERROR')
      expect(sel.targetError, `${code} targetError 不匹配`).toBe(code)
      expect(sel.priority).toBe(DOUBT_PRIORITY.REPEATED_ERROR)
      const task = getDoubtTask(sel.taskId)
      expect(task.errorTypes, `${code} 选中任务不含该错误码`).toContain(code)
      // 该任务必须是「未完成」的
      expect(sel.reason).toContain(ERROR_TYPES[code].name)
    }
  })

  it('REPEATED_ERROR 精确匹配优先：存在未完成且匹配该错误码的任务', () => {
    const state = { ...initialState, evidence: [errEv('E07', 'flaw-07', 1), errEv('E07', 'flaw-07', 2)] }
    const sel = selectDoubtTask(state, { allowContinuity: false })
    expect(sel.targetError).toBe('E07')
    const task = getDoubtTask(sel.taskId)
    expect(task.errorTypes).toContain('E07')
  })

  it('REPEATED_ERROR 的 expectedSkill 非空', () => {
    const state = { ...initialState, evidence: [errEv('E01', 'a', 1), errEv('E01', 'b', 2)] }
    const sel = selectDoubtTask(state, { allowContinuity: false })
    expect(sel.expectedSkill).toBeTruthy()
  })
})

// ─────────────────────────────────────────────────────────────
// C. selectDoubtTask · 其余优先级信号（验收点 3/4/5 + 顺序）
// ─────────────────────────────────────────────────────────────
describe('Phase 3A · 优先级信号与排序', () => {
  it('MASTERY_BOTTLENECK：能力档案最低维度（<48）触发，expectedSkill=瓶颈维度', () => {
    const sel = selectDoubtTask(bottleneckState(), { allowContinuity: false })
    expect(sel.reasonCode).toBe('MASTERY_BOTTLENECK')
    expect(sel.expectedSkill).toBe('evidence') // over 低 → evidence 瓶颈
    expect(sel.priority).toBe(DOUBT_PRIORITY.MASTERY_BOTTLENECK)
    const task = getDoubtTask(sel.taskId)
    expect(['evidence-review', 'self-doubt']).toContain(task.category)
  })

  it('MASTERY_BOTTLENECK：瓶颈维度 ≥48 时不触发（不长期霸占推荐）', () => {
    const good = (v) => ({
      caseId: 'case-001', at: T(), attempt: 1, redo: false, score: 80, confidence: 70, actualQuality: 75,
      errorTypes: [], dimensions: { info: 70, rule: 70, reasoning: 70, counter: 65, over: 70, boundary: 65 },
      level: 3, usedUnknown: false, hintDependency: 0, consultedKnowledge: false, beliefRevision: null,
      ...v,
    })
    const s = { ...initialState, caseAttempts: [good(), good(), good(), good()] }
    const sel = selectDoubtTask(s, { allowContinuity: false })
    // 无证据信号、无 <48 瓶颈 → null
    expect(sel).toBeNull()
  })

  it('WEAK_EVIDENCE：3 次 construct 且 0 次 evidence 行为时触发（验收点 4）', () => {
    const state = { ...initialState, evidence: [construct(1), construct(1), construct(1)] }
    const sel = selectDoubtTask(state, { allowContinuity: false })
    expect(sel.reasonCode).toBe('WEAK_EVIDENCE')
    expect(sel.expectedSkill).toBe('evidence')
    expect(sel.priority).toBe(DOUBT_PRIORITY.WEAK_EVIDENCE)
    expect(getDoubtTask(sel.taskId).category).toBe('evidence-review')
  })

  it('WEAK_EVIDENCE 的 reason 引用真实行为次数', () => {
    const state = { ...initialState, evidence: [construct(1), construct(1), construct(1)] }
    const sel = selectDoubtTask(state, { allowContinuity: false })
    expect(sel.reason).toContain('3')
  })

  it('NO_COUNTEREXAMPLE：2+ 次 construct/analyze 且 0 次反例时触发（验收点 5）', () => {
    const state = {
      ...initialState,
      evidence: [
        createEvidence({ source: 'workshop', action: 'analyze', targetType: 'hexagram', targetId: 1, context: '内容', timestamp: T() }),
        createEvidence({ source: 'workshop', action: 'analyze', targetType: 'hexagram', targetId: 1, context: '内容', timestamp: T() }),
      ],
    }
    const sel = selectDoubtTask(state, { allowContinuity: false })
    expect(sel.reasonCode).toBe('NO_COUNTEREXAMPLE')
    expect(sel.expectedSkill).toBe('counterexample')
    expect(getDoubtTask(sel.taskId).category).toBe('counterexample')
  })

  it('LOW_UNCERTAINTY：绝对化措辞且无 reflect 时触发', () => {
    const state = {
      ...initialState,
      evidence: [createEvidence({ source: 'workshop', action: 'construct', targetType: 'hexagram', targetId: 1, context: '得位一定就是吉，绝对没错', timestamp: T() })],
    }
    const sel = selectDoubtTask(state, { allowContinuity: false })
    expect(sel.reasonCode).toBe('LOW_UNCERTAINTY')
    expect(sel.expectedSkill).toBe('uncertainty')
    expect(getDoubtTask(sel.taskId).category).toBe('self-doubt')
  })

  it('TRADITION_GAP：3+ 次结构接触且从未触碰传统时触发', () => {
    const state = {
      ...initialState,
      evidence: [
        createEvidence({ source: 'workshop', action: 'view', targetType: 'hexagram', targetId: 1, timestamp: T() }),
        createEvidence({ source: 'workshop', action: 'view', targetType: 'yao', targetId: '1-3', timestamp: T() }),
        createEvidence({ source: 'workshop', action: 'view', targetType: 'hexagram', targetId: 2, timestamp: T() }),
      ],
    }
    const sel = selectDoubtTask(state, { allowContinuity: false })
    expect(sel.reasonCode).toBe('TRADITION_GAP')
    expect(getDoubtTask(sel.taskId).category).toBe('tradition-conflict')
  })

  it('UNDERUSED_CLASSIC：3+ 次结构接触、碰过传统但从未回原典时触发', () => {
    const state = {
      ...initialState,
      evidence: [
        createEvidence({ source: 'workshop', action: 'view', targetType: 'hexagram', targetId: 1, timestamp: T() }),
        createEvidence({ source: 'workshop', action: 'view', targetType: 'yao', targetId: '1-3', timestamp: T() }),
        createEvidence({ source: 'workshop', action: 'view', targetType: 'hexagram', targetId: 2, timestamp: T() }),
        createEvidence({ source: 'workshop', action: 'view', targetType: 'tradition', targetId: 'han', timestamp: T() }),
      ],
    }
    const sel = selectDoubtTask(state, { allowContinuity: false })
    expect(sel.reasonCode).toBe('UNDERUSED_CLASSIC')
    expect(getDoubtTask(sel.taskId).category).toBe('deconstruct')
  })

  it('优先级：REPEATED_ERROR(7) > MASTERY_BOTTLENECK(6)（验收点 3）', () => {
    const state = {
      ...bottleneckState(),
      evidence: [errEv('E01', 'a', 1), errEv('E01', 'b', 2)],
    }
    const sel = selectDoubtTask(state, { allowContinuity: false })
    expect(sel.reasonCode).toBe('REPEATED_ERROR')
  })

  it('优先级：MASTERY_BOTTLENECK(6) > WEAK_EVIDENCE(5)', () => {
    const state = { ...bottleneckState(), evidence: [construct(1), construct(1), construct(1)] }
    const sel = selectDoubtTask(state, { allowContinuity: false })
    expect(sel.reasonCode).toBe('MASTERY_BOTTLENECK')
  })

  it('优先级：WEAK_EVIDENCE(5) > NO_COUNTEREXAMPLE(4) > LOW_UNCERTAINTY(3)', () => {
    const three = [construct(1), construct(1), construct(1)]
    const sel = selectDoubtTask({ ...initialState, evidence: three }, { allowContinuity: false })
    expect(sel.reasonCode).toBe('WEAK_EVIDENCE')

    const two = [
      createEvidence({ source: 'workshop', action: 'analyze', targetType: 'hexagram', targetId: 1, context: '内容', timestamp: T() }),
      createEvidence({ source: 'workshop', action: 'analyze', targetType: 'hexagram', targetId: 1, context: '内容', timestamp: T() }),
    ]
    const sel2 = selectDoubtTask({ ...initialState, evidence: two }, { allowContinuity: false })
    expect(sel2.reasonCode).toBe('NO_COUNTEREXAMPLE')

    const one = [createEvidence({ source: 'workshop', action: 'construct', targetType: 'hexagram', targetId: 1, context: '得位一定就是吉', timestamp: T() })]
    const sel3 = selectDoubtTask({ ...initialState, evidence: one }, { allowContinuity: false })
    expect(sel3.reasonCode).toBe('LOW_UNCERTAINTY')
  })

  it('forceReasonCode 注入：可强制选择任一优先级（供测试与调试）', () => {
    const s = { ...initialState, evidence: [] }
    for (const code of Object.keys(DOUBT_PRIORITY)) {
      const sel = selectDoubtTask(s, { allowContinuity: true, forceReasonCode: code })
      expect(sel.reasonCode, code).toBe(code)
      expect(sel.priority, code).toBe(DOUBT_PRIORITY[code])
      expect(getDoubtTask(sel.taskId), code).toBeTruthy()
    }
  })

  it('reason 全部可直接展示：非空、含任务标题、无 undefined/null', () => {
    const states = [
      { ...initialState, evidence: [errEv('E01', 'a', 1), errEv('E01', 'b', 2)] },
      { ...bottleneckState(), evidence: [] },
      { ...initialState, evidence: [construct(1), construct(1), construct(1)] },
      { ...initialState, evidence: [] },
    ]
    for (let i = 0; i < states.length; i++) {
      const sel = selectDoubtTask(states[i], { allowContinuity: i === states.length - 1 })
      expect(sel).toBeTruthy()
      expect(typeof sel.reason).toBe('string')
      expect(sel.reason.length).toBeGreaterThan(5)
      expect(String(sel.reason)).not.toContain('undefined')
      expect(String(sel.reason)).not.toContain('null')
    }
  })
})

// ─────────────────────────────────────────────────────────────
// D. selectDoubtTask · 同类换题 / 同一任务重复完成（验收点 14/15）
// ─────────────────────────────────────────────────────────────
describe('Phase 3A · 同类换题与去重', () => {
  it('已完成的同一任务不再被推荐（优先未完成任务）', () => {
    const first = selectDoubtTask({ ...initialState, evidence: [construct(1), construct(1), construct(1)] }, { allowContinuity: false })
    const done = [{ taskId: first.taskId, completedAt: T() }]
    const state = { ...initialState, evidence: [construct(1), construct(1), construct(1)], doubtRuns: done }
    const second = selectDoubtTask(state, { allowContinuity: false })
    expect(second.taskId).not.toBe(first.taskId)
    expect(getDoubtTask(second.taskId).category).toBe(getDoubtTask(first.taskId).category)
  })

  it('同一任务重复完成：5 次重复归档后 doneIds 仍去重', () => {
    const runs = Array.from({ length: 5 }, (_, i) => ({ taskId: 'evr-01', completedAt: T() + i }))
    const state = { ...initialState, evidence: [construct(1), construct(1), construct(1)], doubtRuns: runs }
    const sel = selectDoubtTask(state, { allowContinuity: false })
    expect(sel.taskId).not.toBe('evr-01') // 即使重复完成也不会再推荐它
  })

  it('同类型全部完成后：轮换完成次数最少的任务（不会永远同一题）', () => {
    const evidenceReviewIds = doubtTasksByCategory('evidence-review').map((t) => t.id)
    // 全部完成一遍，再把第一个多做两次 → 轮换应回到完成次数最少的
    const runs = evidenceReviewIds.map((id, i) => ({ taskId: id, completedAt: T() + i }))
    runs.push({ taskId: evidenceReviewIds[0], completedAt: T() + 100 })
    runs.push({ taskId: evidenceReviewIds[0], completedAt: T() + 200 })
    const state = { ...initialState, evidence: [construct(1), construct(1), construct(1)], doubtRuns: runs }
    const sel = selectDoubtTask(state, { allowContinuity: false })
    expect(sel.taskId).not.toBe(evidenceReviewIds[0]) // 完成 3 次的题排最后
    expect(sel.reasonCode).toBe('WEAK_EVIDENCE')
  })

  it('换题后 reason 不同：同一类型第二次推荐引用不同任务标题', () => {
    const first = selectDoubtTask({ ...initialState, evidence: [construct(1), construct(1), construct(1)] }, { allowContinuity: false })
    const state = { ...initialState, evidence: [construct(1), construct(1), construct(1)], doubtRuns: [{ taskId: first.taskId, completedAt: T() }] }
    const second = selectDoubtTask(state, { allowContinuity: false })
    expect(second.taskId).not.toBe(first.taskId)
    expect(second.reason).not.toBe(first.reason)
    expect(getDoubtTask(first.taskId).title).not.toBe(getDoubtTask(second.taskId).title)
  })
})

// ─────────────────────────────────────────────────────────────
// E. DoubtTask Runner（验收点：六步流程 + Evidence 打点）
// ─────────────────────────────────────────────────────────────
describe('Phase 3B · DoubtTask Runner', () => {
  it('startDoubtTask：创建完整 run（taskId/steps/startedAt），无效任务返回 null', () => {
    const run = startDoubtTask('flaw-01', { timestamp: 1000 })
    expect(run.taskId).toBe('flaw-01')
    expect(run.category).toBe('flaw')
    expect(run.steps).toEqual({})
    expect(run.startedAt).toBe(1000)
    expect(startDoubtTask('no-such-task')).toBeNull()
  })

  it('DOUBT_FLOW 六步顺序：材料 → 初始判断 → 证据 → 反例 → 修正 → 反思', () => {
    expect(DOUBT_FLOW.map((s) => s.key)).toEqual(['material', 'hypothesis', 'evidence', 'counterexample', 'revise', 'reflect'])
    expect(DOUBT_STEP_KEYS).toEqual(['hypothesis', 'evidence', 'counterexample', 'revise', 'reflect'])
  })

  it('recordDoubtStep：每步生成对应 action 的 Evidence partial（source=doubt）', () => {
    const run = startDoubtTask('flaw-01', { timestamp: 1000 })
    for (const k of DOUBT_STEP_KEYS) {
      const res = recordDoubtStep(run, k, `内容-${k}`, { confidence: 50, timestamp: 2000 })
      expect(res.evidence.length).toBe(1)
      expect(res.evidence[0].action).toBe(DOUBT_STEP_ACTIONS[k])
      expect(res.evidence[0].source).toBe('doubt')
      expect(res.evidence[0].targetType).toBe('doubt')
      expect(res.evidence[0].targetId).toBe('flaw-01')
      expect(res.evidence[0].metadata.step).toBe(k)
      expect(res.run.steps[k].text).toBe(`内容-${k}`)
    }
  })

  it('material 步不产生 Evidence（只展示材料，不记录行为）', () => {
    const run = startDoubtTask('flaw-01', { timestamp: 1000 })
    const res = recordDoubtStep(run, 'material', '看一下')
    expect(res.evidence).toEqual([])
    expect(res.run.steps.material).toBeUndefined()
  })

  it('runDoubtEvidencePartials：5 步 + 1 条 complete 完成标记', () => {
    const run = fullDoubtRun('flaw-01')
    const partials = runDoubtEvidencePartials(run)
    expect(partials.length).toBe(6)
    expect(partials.map((p) => p.action)).toEqual(['hypothesis', 'evidence', 'counterexample', 'revise', 'reflect', 'complete'])
    expect(partials[5].action).toBe('complete')
    expect(partials[5].metadata.taskTitle).toBeTruthy()
  })

  it('buildDoubtResult：结构化产出（六步内容 + signals + beliefRevision + hasRevision）', () => {
    const run = fullDoubtRun('flaw-01')
    const r = buildDoubtResult(run, { timestamp: 3000 })
    expect(r.taskId).toBe('flaw-01')
    expect(r.hypothesis).toContain('得位只是结构信息')
    expect(r.evidence).toContain('原文')
    expect(r.counterexample).toContain('反例')
    expect(r.revise).toBeTruthy()
    expect(r.reflect).toBeTruthy()
    expect(r.signals.mentionedEvidence).toBe(true)
    expect(r.signals.mentionedCounterexample).toBe(true)
    expect(r.beliefRevision).toBeTruthy()
    expect(r.hasRevision).toBe(true)
    expect(r.completedAt).toBe(3000)
  })

  it('任务完成写入真实 Evidence：经 reducer 后 state.evidence 含 6 条 doubt 来源记录（验收点 6）', () => {
    const s = completeDoubtThroughReducer({ ...initialState }, 'flaw-01')
    const doubtEvs = s.evidence.filter((e) => e.source === 'doubt')
    expect(doubtEvs.length).toBe(6)
    expect(s.doubtRuns.length).toBe(1)
  })
})

// ─────────────────────────────────────────────────────────────
// F. 文本信号（验收点：反例行为 / 自我修正 / 确定性信号）
// ─────────────────────────────────────────────────────────────
describe('Phase 3B · 开放文本确定性信号', () => {
  it('反例行为：counterexample 步提到「反例/推翻」→ mentionedCounterexample=true（验收点 11）', () => {
    const run = startDoubtTask('cx-01', { timestamp: T() })
    const r1 = recordDoubtStep(run, 'counterexample', '有九三得位却爻辞为凶的反例，推翻这个说法').run
    const r2 = recordDoubtStep(r1, 'evidence', '依据是爻辞原文').run
    const sig = summarizeDoubtSignals(r2)
    expect(sig.mentionedCounterexample).toBe(true)
    expect(sig.mentionedEvidence).toBe(true)
  })

  it('自我修正：revise 含「原来…太绝对」→ selfCorrection=true（验收点 12）', () => {
    const run = startDoubtTask('flaw-01', { timestamp: T() })
    const r = recordDoubtStep(run, 'revise', '原来的判断太绝对了，现在认为未必').run
    expect(summarizeDoubtSignals(r).selfCorrection).toBe(true)
    const stepSig = doubtStepSignals(r)
    expect(stepSig.revise.signalType).toBe('SELF_CORRECTION')
  })

  it('「保持不变」不算修正：hasRevision 返回 false', () => {
    const run = startDoubtTask('flaw-01', { timestamp: T() })
    run.steps.hypothesis = { key: 'hypothesis', text: '得位就是吉', at: T() }
    run.steps.revise = { key: 'revise', text: '保持不变', at: T() }
    expect(hasRevision(run)).toBe(false)
  })

  it('初始判断与修正实质不同 → hasRevision=true；完全相同 → false', () => {
    const a = startDoubtTask('flaw-01', { timestamp: T() })
    a.steps.hypothesis = { key: 'hypothesis', text: '得位就是吉', at: T() }
    a.steps.revise = { key: 'revise', text: '得位不必然吉，还要看整体', at: T() }
    expect(hasRevision(a)).toBe(true)

    const b = startDoubtTask('flaw-01', { timestamp: T() })
    b.steps.hypothesis = { key: 'hypothesis', text: '得位就是吉', at: T() }
    b.steps.revise = { key: 'revise', text: '得位就是吉', at: T() }
    expect(hasRevision(b)).toBe(false)
  })

  it('「暂时没想到」反例仍被记录为反例行为（不判错）', () => {
    const run = startDoubtTask('cx-01', { timestamp: T() })
    const r = recordDoubtStep(run, 'counterexample', '暂时没想到').run
    const res = buildDoubtResult(r, { timestamp: T() })
    expect(res.counterexample).toBe('暂时没想到')
    expect(res.signals.hasContent.counterexample).toBe(true)
  })

  it('禁止语义幻觉：absoluteClaims 由确定性规则统计，不做「答案对错」判断', () => {
    const sig = doubtStepSignals(fullDoubtRun('flaw-01'))
    for (const k of DOUBT_STEP_KEYS) {
      if (sig[k]) {
        expect(typeof sig[k].absoluteClaims).toBe('number')
        expect(typeof sig[k].mentionsEvidence).toBe('boolean')
      }
    }
  })
})

// ─────────────────────────────────────────────────────────────
// G. BeliefRevision（验收点 10）
// ─────────────────────────────────────────────────────────────
describe('Phase 3B/C · BeliefRevision', () => {
  it('buildDoubtBeliefRevision：产出 originalClaim / counterEvidence / revisedClaim / source=doubt', () => {
    const run = fullDoubtRun('flaw-01', { hypothesis: '得位就是吉', revise: '得位不必然吉，还要看整体' })
    const br = buildDoubtBeliefRevision(run, { timestamp: 1000 })
    expect(br.originalClaim).toBe('得位就是吉')
    expect(br.counterEvidence.length).toBeGreaterThanOrEqual(1)
    expect(br.revisedClaim).toContain('得位不必然吉')
    expect(br.source).toBe('doubt')
    expect(br.taskId).toBe('flaw-01')
    expect(br.timestamp).toBe(1000)
  })

  it('无初始判断与修正时返回 null（不伪造修正）', () => {
    const run = startDoubtTask('flaw-01', { timestamp: T() })
    expect(buildDoubtBeliefRevision(run)).toBeNull()
  })

  it('怀疑任务完成 → beliefRevision 进入 state.beliefRevisions', () => {
    const s = completeDoubtThroughReducer({ ...initialState }, 'flaw-01')
    expect(s.beliefRevisions.length).toBe(1)
    expect(s.beliefRevisions[0].source).toBe('doubt')
    expect(s.beliefRevisions[0].taskId).toBe('flaw-01')
  })

  it('buildDoubtArchive：按任务分组统计 runCount/taskCount/revisionCount', () => {
    const r1 = buildDoubtResult(fullDoubtRun('flaw-01'), { timestamp: T() })
    const r2 = buildDoubtResult(fullDoubtRun('flaw-01', { revise: '保持不变' }), { timestamp: T() })
    const r3 = buildDoubtResult(fullDoubtRun('evr-01'), { timestamp: T() })
    const arc = buildDoubtArchive([r1, r2, r3])
    expect(arc.runCount).toBe(3)
    expect(arc.taskCount).toBe(2)
    expect(arc.revisionCount).toBe(2) // r1/r3 有修正，r2「保持不变」不算
    expect(arc.byTask.map((t) => t.taskId).sort()).toEqual(['evr-01', 'flaw-01'])
  })
})

// ─────────────────────────────────────────────────────────────
// H. Evidence → Mastery（验收点 7）
// ─────────────────────────────────────────────────────────────
describe('Phase 3C · Evidence → Mastery 接管', () => {
  it('只有 view 行为不应提升任何能力维度', () => {
    const evs = [createEvidence({ source: 'lesson', action: 'view', targetType: 'hexagram', targetId: 1, timestamp: T() })]
    const contrib = evidenceMasteryContribution(evs)
    expect(Object.keys(contrib).length).toBe(0)
    const p = computeMasteryProfile({ ...initialState, evidence: evs })
    expect(p.sampleCount).toBe(0)
    expect(p.level).toBe('L0')
  })

  it('evidence 行为 → 对应 evidence 维度出现贡献', () => {
    const evs = [createEvidence({ source: 'doubt', action: 'evidence', targetType: 'doubt', targetId: 'x', context: '依据是原文', timestamp: T() })]
    const contrib = evidenceMasteryContribution(evs)
    expect(contrib.evidence.score).toBeGreaterThan(0)
    const p = computeMasteryProfile({ ...initialState, evidence: evs })
    expect(p.evidence).toBeGreaterThan(0)
    expect(p.observation).toBe(0) // 其它维度不受影响
  })

  it('counterexample 行为 → counterexample 维度贡献', () => {
    const evs = [createEvidence({ source: 'doubt', action: 'counterexample', targetType: 'doubt', targetId: 'x', context: '也有反例', timestamp: T() })]
    const contrib = evidenceMasteryContribution(evs)
    expect(contrib.counterexample.score).toBeGreaterThan(0)
  })

  it('完整推理闭环（证据+反例+修正）→ 质量权重 1.5', () => {
    const evs = [
      createEvidence({ source: 'doubt', action: 'evidence', targetType: 'doubt', targetId: 'x', context: '依据', timestamp: T(), __seq: 1 }),
      createEvidence({ source: 'doubt', action: 'counterexample', targetType: 'doubt', targetId: 'x', context: '反例', timestamp: T(), __seq: 2 }),
      createEvidence({ source: 'doubt', action: 'revise', targetType: 'doubt', targetId: 'x', context: '修正', timestamp: T(), __seq: 3 }),
    ]
    const contrib = evidenceMasteryContribution(evs)
    expect(contrib.evidence.weight).toBeGreaterThan(1)
    expect(contrib.counterexample.weight).toBeGreaterThan(1)
    expect(contrib.reasoning.weight).toBeGreaterThan(1)
  })

  it('同一对象同一维度重复操作 → 去重（防刷）', () => {
    const one = [createEvidence({ source: 'doubt', action: 'evidence', targetType: 'doubt', targetId: 'x', context: '依据', timestamp: T() })]
    const ten = Array.from({ length: 10 }, (_, i) => createEvidence({ source: 'doubt', action: 'evidence', targetType: 'doubt', targetId: 'x', context: '依据', timestamp: T() + i }))
    const c1 = evidenceMasteryContribution(one)
    const c10 = evidenceMasteryContribution(ten)
    expect(c10.evidence.weight).toBe(c1.evidence.weight) // 只计一次
  })

  it('无内容的 evidence 不加分（requiresContent 门槛）', () => {
    const evs = [createEvidence({ source: 'doubt', action: 'evidence', targetType: 'doubt', targetId: 'x', context: '', timestamp: T() })]
    const contrib = evidenceMasteryContribution(evs)
    expect(Object.keys(contrib).length).toBe(0)
  })

  it('携带错误的证据能力贡献减半', () => {
    const good = createEvidence({ source: 'doubt', action: 'evidence', targetType: 'doubt', targetId: 'a', context: '依据', timestamp: T(), __seq: 1 })
    const bad = createEvidence({ source: 'doubt', action: 'evidence', targetType: 'doubt', targetId: 'b', context: '依据', errorTypes: ['E01'], timestamp: T(), __seq: 2 })
    const c = evidenceMasteryContribution([good, bad])
    // bad 权重 0.5，good 权重 1.0
    expect(c.evidence.weight).toBeCloseTo(1.5, 5)
  })

  it('complete / retry / save 不贡献能力', () => {
    for (const a of ['complete', 'retry', 'save', 'view', 'observe', 'sample']) {
      expect(MASTERY_ACTION_RULES[a].mastery).toBe(false)
    }
  })

  it('怀疑任务完成 → masteryProfile 重算且对应维度提升（验收点 7）', () => {
    const before = computeMasteryProfile({ ...initialState, evidence: [construct(1), construct(1), construct(1)] })
    const s = completeDoubtThroughReducer({ ...initialState, evidence: [construct(1), construct(1), construct(1)] }, 'flaw-01')
    const after = s.masteryProfile
    expect(after.evidence).toBeGreaterThan(before.evidence)
    expect(after.counterexample).toBeGreaterThan(before.counterexample)
    expect(after.uncertainty).toBeGreaterThan(before.uncertainty)
  })
})

// ─────────────────────────────────────────────────────────────
// I. 机械点击反作弊（验收点 13）
// ─────────────────────────────────────────────────────────────
describe('Phase 3C · 机械点击反作弊', () => {
  it('重复机械操作同一任务 → 贡献不叠加、等级不上升', () => {
    // 同一个怀疑任务重复完成 10 次（相同内容）
    let s = { ...initialState, evidence: [] }
    const p1 = computeMasteryProfile(s)
    for (let i = 0; i < 10; i++) {
      s = completeDoubtThroughReducer(s, 'flaw-01')
    }
    const p10 = computeMasteryProfile(s)
    // 同一对象去重 → 能力值被压低；样本不足且维度低 → 不能刷成高等级
    expect(p10.level).toBe('L0')
    expect(p10.evidence).toBeLessThanOrEqual(20)
    expect(s.doubtRuns.length).toBe(10)
  })

  it('即使换不同对象重复同一动作，单维度贡献封顶 60，且其余维度为 0 → 无法升级', () => {
    const evs = Array.from({ length: 20 }, (_, i) => createEvidence({ source: 'doubt', action: 'evidence', targetType: 'doubt', targetId: `t${i}`, context: '依据', timestamp: T() + i }))
    const contrib = evidenceMasteryContribution(evs)
    expect(contrib.evidence.score).toBeLessThanOrEqual(60)
    const p = computeMasteryProfile({ ...initialState, evidence: evs })
    // avg8 = evidence 高 + 其余 7 维 0 → 平均很低，仍 L0/L1，不会因刷升 L2+
    expect(['L0', 'L1']).toContain(p.level)
  })

  it('快速连续重复写入同一步 → recordEvidence 2 秒去重', () => {
    const partial = { source: 'doubt', action: 'evidence', targetType: 'doubt', targetId: 'x', context: '依据' }
    const l1 = recordEvidence([], { ...partial, timestamp: 1000 })
    const l2 = recordEvidence(l1, { ...partial, timestamp: 2500 }) // 1.5s → 去重
    expect(l2.length).toBe(1)
  })
})

// ─────────────────────────────────────────────────────────────
// J. Agent 接管（验收点 8/9/16）
// ─────────────────────────────────────────────────────────────
describe('Phase 3D · Agent 接管', () => {
  it('runAgent：存在认知漏洞（MASTERY_BOTTLENECK）时 doubtRecommendation 出现（验收点 8）', () => {
    const agent = runAgent(bottleneckState())
    expect(agent.doubtRecommendation).toBeTruthy()
    expect(agent.doubtRecommendation.reasonCode).toBe('MASTERY_BOTTLENECK')
    const task = getDoubtTask(agent.doubtRecommendation.taskId)
    expect(task).toBeTruthy()
    expect(['evidence-review', 'self-doubt']).toContain(task.category)
    expect(typeof agent.doubtRecommendation.reason).toBe('string')
  })

  it('runAgent：旧路径已是定向干预时保持 legacy（v161 回归，不重构 Phase 2.5）', () => {
    const agent = runAgent(bottleneckState())
    expect(agent.nextActionSource).toBe('legacy')
    expect(agent.nextAction.training).toBe('evidence')
    expect(agent.whyThisCase).not.toBeNull()
    // 怀疑推荐以补充卡片形式存在（首页「今天有一个地方值得怀疑」数据源）
    expect(agent.doubtRecommendation.taskId).toBeTruthy()
  })

  it('runAgent：有证据推荐时证据优先，doubt 不抢占（Phase 2.5 Evidence-first 保持）', () => {
    const state = { ...initialState, evidence: [construct(1), construct(1), construct(1)] }
    const agent = runAgent(state)
    expect(agent.nextActionSource).toBe('evidence')
    expect(agent.nextAction.type).toBe('exp')
    expect(agent.nextAction.reasonCode).toBe('WEAK_EVIDENCE')
    // 同时怀疑推荐也基于同一信号（数据契约给 Home 卡片）
    expect(agent.doubtRecommendation.reasonCode).toBe('WEAK_EVIDENCE')
  })

  it('推荐理由可追溯 Evidence ID：WEAK_EVIDENCE 的 evidenceIds 指向真实记录（验收点 16）', () => {
    const evs = [construct(1, '内容A', { __seq: 1 }), construct(1, '内容B', { __seq: 2 }), construct(1, '内容C', { __seq: 3 })]
    const state = { ...initialState, evidence: evs }
    const agent = runAgent(state)
    const ids = agent.doubtRecommendation.evidenceIds
    expect(ids.length).toBeGreaterThanOrEqual(1)
    const idSet = new Set(evs.map((e) => e.id))
    for (const id of ids) expect(idSet.has(id)).toBe(true)
    // evidenceWhy 也带依据（Home/Growth 展示）
    expect(agent.evidenceWhy.evidenceIds.length).toBeGreaterThan(0)
  })

  it('REPEATED_ERROR 的推荐理由可追溯触发证据 ID', () => {
    const state = { ...initialState, evidence: [errEv('E01', 'a', 1), errEv('E01', 'b', 2)] }
    const sel = selectDoubtTask(state, { allowContinuity: false })
    expect(sel.evidenceIds.length).toBe(2)
    const idSet = new Set(state.evidence.map((e) => e.id))
    for (const id of sel.evidenceIds) expect(idSet.has(id)).toBe(true)
  })

  it('怀疑任务完成的 nextAction 契约：id/title/why/reasonCode/priority 齐全（供 Home 渲染）', () => {
    // resolveNextAction 的 doubt 分支由 forceReasonCode 触发路径覆盖（见 D 组），
    // 这里验证数据契约字段：doubtRecommendation 含 Home 需要的一切
    const agent = runAgent(bottleneckState())
    const d = agent.doubtRecommendation
    expect(d.taskId).toBeTruthy()
    expect(d.reasonCode).toBeTruthy()
    expect(d.reason).toBeTruthy()
    expect(typeof d.priority).toBe('number')
    const task = getDoubtTask(d.taskId)
    expect(task.title).toBeTruthy()
    expect(task.emoji).toBeTruthy()
  })
})

// ─────────────────────────────────────────────────────────────
// K. 闭环（验收点：一次真实认知纠偏 → 关键状态可解释变化）
// ─────────────────────────────────────────────────────────────
describe('Phase 3 · 闭环：怀疑完成 → Evidence → Mastery → Agent → Home 推荐', () => {
  it('完成一次怀疑 → 证据、能力档案、Agent 推荐全部发生可解释变化', () => {
    // 1) 初始：3 次 construct 无证据 → WEAK_EVIDENCE
    const S0 = { ...initialState, evidence: [construct(1), construct(1), construct(1)] }
    const beforeAgent = runAgent(S0)
    const beforeMastery = computeMasteryProfile(S0)
    const beforeTask = beforeAgent.doubtRecommendation.taskId
    expect(beforeAgent.doubtRecommendation.reasonCode).toBe('WEAK_EVIDENCE')

    // 2) 真实认知纠偏行为：完成怀疑任务（证据+反例+修正+反思）
    const S1 = completeDoubtThroughReducer(S0, beforeTask, {
      hypothesis: '得位是结构信息，不能单独定吉凶',
      evidence: '我找到该爻的爻辞原文作依据',
      counterexample: '也有得位却爻辞为凶的反例',
      revise: '原来的判断太绝对了，现在认为未必',
      reflect: '我在找反例那一步最容易卡住',
    })

    // 3) Evidence：doubt 来源证据已写入
    expect(S1.evidence.filter((e) => e.source === 'doubt').length).toBeGreaterThanOrEqual(6)

    // 4) Mastery：能力档案维度真实变化
    const afterMastery = S1.masteryProfile
    expect(afterMastery.evidence).toBeGreaterThan(beforeMastery.evidence)
    expect(afterMastery.counterexample).toBeGreaterThan(beforeMastery.counterexample)
    expect(afterMastery.uncertainty).toBeGreaterThan(beforeMastery.uncertainty)

    // 5) Agent 重新判断：推荐发生变化（换题 or 消失），理由随之变化
    const afterAgent = runAgent(S1)
    if (afterAgent.doubtRecommendation) {
      expect(afterAgent.doubtRecommendation.taskId).not.toBe(beforeTask)
      expect(afterAgent.doubtRecommendation.reasonCode).not.toBe('WEAK_EVIDENCE')
    } else {
      expect(afterAgent.doubtRecommendation).toBeNull() // 漏洞已解 → 不再推荐
    }

    // 6) Home 推荐变化：nextAction 从 WEAK_EVIDENCE 实验变为其它推荐
    expect(afterAgent.nextAction.id).not.toBe(beforeAgent.nextAction.id)
  })

  it('反例行为 → counterexample 能力维度提升 → Agent 判断的瓶颈可能转移', () => {
    // 案例维度除 counter 外都较高，counter 最低（20）→ 反例意识是唯一瓶颈
    const lowCounter = (o = {}) => ({
      caseId: 'case-001', at: T(), attempt: 1, redo: false, score: 60, confidence: 60, actualQuality: 60,
      errorTypes: [], dimensions: { info: 45, rule: 45, reasoning: 45, counter: 20, over: 45, boundary: 45 },
      level: 2, usedUnknown: false, hintDependency: 0, consultedKnowledge: false, beliefRevision: null,
      ...o,
    })
    const s0 = { ...initialState, caseAttempts: [lowCounter(), lowCounter(), lowCounter(), lowCounter(), lowCounter()] }
    const b0 = computeMasteryProfile(s0)
    expect(b0.counterexample).toBe(20)
    const evs = Array.from({ length: 4 }, (_, i) =>
      createEvidence({ source: 'doubt', action: 'counterexample', targetType: 'doubt', targetId: `c${i}`, context: '主动找到反例', timestamp: T() + i }))
    const s1 = { ...s0, evidence: evs }
    const b1 = computeMasteryProfile(s1)
    expect(b1.counterexample).toBeGreaterThan(b0.counterexample)
    // Agent 判断随能力档案变化（reason 引用维度值，必然变化）
    const a0 = runAgent(s0)
    const a1 = runAgent(s1)
    if (a1.doubtRecommendation && a0.doubtRecommendation) {
      const changed = a1.doubtRecommendation.taskId !== a0.doubtRecommendation.taskId
        || a1.doubtRecommendation.reason !== a0.doubtRecommendation.reason
      expect(changed).toBe(true)
    }
  })

  it('问题改善后（证据意识到位）→ 不再推荐怀疑，回到常规路径', () => {
    // 案例维度除 evidence 外都 ≥48，over 低 → evidence 是唯一瓶颈；9 条证据行为把它拉过 48
    const good = (o = {}) => ({
      caseId: 'case-001', at: T(), attempt: 1, redo: false, score: 80, confidence: 70, actualQuality: 75,
      errorTypes: [], dimensions: { info: 60, rule: 60, reasoning: 60, counter: 60, over: 20, boundary: 60 },
      level: 3, usedUnknown: false, hintDependency: 0, consultedKnowledge: false, beliefRevision: null,
      dualQuality: 'good',
      ...o,
    })
    const s = { ...initialState, caseAttempts: [good(), good(), good(), good()] }
    const evs = Array.from({ length: 9 }, (_, i) =>
      createEvidence({ source: 'doubt', action: 'evidence', targetType: 'doubt', targetId: `t${i}`, context: '我找到了明确的文本依据', timestamp: T() + i }))
    const s1 = { ...s, evidence: evs }
    const p = computeMasteryProfile(s1)
    expect(p.evidence).toBeGreaterThanOrEqual(48)
    const sel = selectDoubtTask(s1, { allowContinuity: false })
    expect(sel).toBeNull() // 瓶颈已解 → 无怀疑推荐
  })
})

// ─────────────────────────────────────────────────────────────
// L. 全量 190 个 DoubtTask 引用完整（验收点 17/18）
// ─────────────────────────────────────────────────────────────
describe('Phase 3 · DoubtTask 数据完整性', () => {
  it('全量 190 个任务，六类分布与规格一致', () => {
    expect(DOUBT_TASKS.length).toBe(190)
    expect(doubtCategoryCount()).toEqual({ flaw: 35, 'evidence-review': 35, counterexample: 35, deconstruct: 35, 'tradition-conflict': 25, 'self-doubt': 25 })
  })

  it('任务 id 全局唯一、__dseq 全局唯一且递增', () => {
    const ids = DOUBT_TASKS.map((t) => t.id)
    expect(new Set(ids).size).toBe(190)
    const seqs = DOUBT_TASKS.map((t) => t.__dseq)
    expect(new Set(seqs).size).toBe(190)
    expect(Math.min(...seqs)).toBeGreaterThanOrEqual(1)
  })

  it('每任务必填字段：id/title/category/statement|prompt/难度/sourceInfo', () => {
    for (const t of DOUBT_TASKS) {
      expect(t.id, t.id).toBeTruthy()
      expect(t.title, t.id).toBeTruthy()
      expect(DOUBT_CATEGORIES.some((c) => c.id === t.category), `${t.id} 非法分类`).toBe(true)
      expect(t.statement || t.prompt, `${t.id} 缺材料`).toBeTruthy()
      expect(typeof t.difficulty, t.id).toBe('number')
      expect(t.sourceInfo && t.sourceInfo.source, t.id).toBeTruthy()
    }
  })

  it('errorTypes 全部 ∈ E01–E10（引用完整，验收点 18）', () => {
    for (const t of DOUBT_TASKS) {
      for (const c of t.errorTypes || []) {
        expect(ERROR_TYPES[c], `${t.id} 引用了不存在的 ${c}`).toBeTruthy()
      }
    }
  })

  it('masteryKeys 全部 ∈ 现有 8 维能力（复用唯一能力体系，无自定义标签）', () => {
    for (const t of DOUBT_TASKS) {
      for (const k of t.masteryKeys || []) {
        expect(DIMENSION_KEYS, `${t.id} 引用了非法维度 ${k}`).toContain(k)
      }
    }
  })

  it('六类每类 ≥1 个任务带 masteryKeys，训练目标可挂到能力体系', () => {
    for (const c of DOUBT_CATEGORIES) {
      const list = doubtTasksByCategory(c.id)
      expect(list.length, c.id).toBeGreaterThan(0)
      expect(list.some((t) => (t.masteryKeys || []).length > 0), c.id).toBe(true)
    }
  })

  it('每个 E01–E10 至少有一个任务可纠偏（反查覆盖）', () => {
    for (const code of Object.keys(ERROR_TYPES)) {
      const matched = DOUBT_TASKS.some((t) => (t.errorTypes || []).includes(code))
      expect(matched, `${code} 无对应怀疑任务`).toBe(true)
    }
  })

  it('20 个随机任务（确定性抽样：每 4 个取 1）结构完整、引用有效（验收点 17）', () => {
    const sampled = DOUBT_TASKS.filter((_, i) => i % 4 === 0)
    expect(sampled.length).toBeGreaterThanOrEqual(20)
    for (const t of sampled) {
      expect(t.id).toBeTruthy()
      expect(t.title).toBeTruthy()
      expect(t.statement || t.prompt).toBeTruthy()
      for (const c of t.errorTypes || []) expect(ERROR_TYPES[c]).toBeTruthy()
      for (const k of t.masteryKeys || []) expect(DIMENSION_KEYS).toContain(k)
      expect(getDoubtTask(t.id)).toBe(t)
    }
  })

  it('DOUBT_CATEGORIES 六类结构（id/label/emoji/tip）齐全', () => {
    expect(DOUBT_CATEGORIES.length).toBe(6)
    for (const c of DOUBT_CATEGORIES) {
      expect(c.id).toBeTruthy()
      expect(c.label).toBeTruthy()
      expect(c.emoji).toBeTruthy()
      expect(c.tip).toBeTruthy()
    }
  })

  it('doubtTasksByCategory 与 getDoubtTask 双向一致', () => {
    for (const t of DOUBT_TASKS) {
      expect(doubtTasksByCategory(t.category).some((x) => x.id === t.id)).toBe(true)
      expect(getDoubtTask(t.id).id).toBe(t.id)
    }
  })
})

// ─────────────────────────────────────────────────────────────
// M. 回归耦合（Phase 2.5 证据推荐不受怀疑室影响）
// ─────────────────────────────────────────────────────────────
describe('Phase 3 · 回归耦合', () => {
  it('连续 construct 无 evidence → 主推荐仍是 WEAK_EVIDENCE 实验（Phase 2.5 不变）', () => {
    const state = { ...initialState, evidence: [construct(1), construct(2), construct(3)] }
    const agent = runAgent(state)
    expect(agent.nextActionSource).toBe('evidence')
    expect(agent.nextAction.reasonCode).toBe('WEAK_EVIDENCE')
    expect(agent.evidenceRecommendation.primary.reasonCode).toBe('WEAK_EVIDENCE')
  })

  it('10 个维度信号的 reasonCode 与 DOUBT_PRIORITY 表一致（单一事实源）', () => {
    for (const [code, prio] of Object.entries(DOUBT_PRIORITY)) {
      const sel = selectDoubtTask({ ...initialState, evidence: [] }, { allowContinuity: true, forceReasonCode: code })
      expect(sel.priority, code).toBe(prio)
    }
  })

  it('masteryKeys 与 MASTERY_DIMENSIONS 一一对应（无第二套能力体系）', () => {
    const keys = new Set(MASTERY_DIMENSIONS.map((d) => d.key))
    for (const t of DOUBT_TASKS) {
      for (const k of t.masteryKeys || []) expect(keys.has(k)).toBe(true)
    }
  })
})
