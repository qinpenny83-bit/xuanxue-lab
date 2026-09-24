// ============================================================
// R3 Phase 2 · Experiment Engine 测试
//
// 覆盖：
//   1. 十步流程（问题→假设→预测→样本→观察→证据→反例→修改→结论→复盘）
//   2. 样本真实 + seed 可复现
//   3. 假设 / 反例 / 结论修改记录
//   4. BeliefRevision（核心成长指标：是否根据证据修改观点）
//   5. Evidence 写入（每步 → action）
//   6. ExperimentResult 持久化进入 reducer
//   7. Experiment Archive（实验档案组织）
// ============================================================
import { describe, it, expect } from 'vitest'
import {
  STEP_KEYS,
  STEP_ACTIONS,
  startExperiment,
  recordStep,
  buildBeliefRevision,
  buildExperimentResult,
  runEvidencePartials,
  buildExperimentArchive,
} from '../src/agent/experimentEngine'
import { EXPERIMENTS_V3, TEN_STEP_TEMPLATE, getExperimentV3 } from '../src/data/experiments-v3'
import { reducer } from '../src/store/reducer'
import { initialState } from '../src/lib/storage'

const ALL_10 = ['question', 'hypothesis', 'predict', 'sample', 'observe', 'evidence', 'counterexample', 'revise', 'conclusion', 'reflect']

// ─────────────────────────────────────────────────────────────
describe('十步流程 · 模板与动作映射', () => {
  it('STEP_KEYS 与 TEN_STEP_TEMPLATE 一致且为十步', () => {
    expect(STEP_KEYS).toEqual(ALL_10)
    expect(TEN_STEP_TEMPLATE.map((s) => s.key)).toEqual(ALL_10)
  })

  it('question 不写 Evidence；其余步骤都映射到 action', () => {
    expect(STEP_ACTIONS.question).toBeNull()
    expect(STEP_ACTIONS.hypothesis).toBe('hypothesis')
    expect(STEP_ACTIONS.conclusion).toBe('construct')
    expect(STEP_ACTIONS.reflect).toBe('reflect')
    expect(STEP_ACTIONS.counterexample).toBe('counterexample')
    expect(STEP_ACTIONS.sample).toBe('sample')
  })

  it('30 个实验全部共享同一份十步模板（seed 默认 = id）', () => {
    expect(EXPERIMENTS_V3.length).toBeGreaterThanOrEqual(30)
    for (const e of EXPERIMENTS_V3) {
      expect(e.steps.map((s) => s.key)).toEqual(ALL_10)
      expect(e.seed).toBe(e.id)
    }
  })
})

// ─────────────────────────────────────────────────────────────
describe('startExperiment · 样本真实且可复现', () => {
  it('按 id 启动，返回问题/标题/样本/空步骤', () => {
    const run = startExperiment('exp-s-dewei')
    expect(run.experimentId).toBe('exp-s-dewei')
    expect(run.category).toBe('structure')
    expect(run.question).toContain('得位')
    expect(run.title).toBe('得位一定好吗？')
    expect(run.sample.length).toBe(6)
    expect(run.steps).toEqual({})
  })

  it('同一 seed 两次启动 → 样本完全一致（deterministic）', () => {
    const key = (run) => run.sample.map((s) => `${s.type}:${s.id}`).join('|')
    const a = startExperiment('exp-s-dewei', { seed: 'fixed-seed' })
    const b = startExperiment('exp-s-dewei', { seed: 'fixed-seed' })
    expect(key(a)).toBe(key(b))
  })

  it('样本解析到真实爻（有 label 或 seq/pos）', () => {
    const run = startExperiment('exp-s-dewei')
    expect(run.sample.length).toBeGreaterThan(0)
    for (const s of run.sample) {
      expect(s.type).toBe('yao')
      expect(s.seq).toBeTruthy()
    }
  })

  it('未知 id 返回 null', () => {
    expect(startExperiment('__不存在__')).toBeNull()
  })
})

// ─────────────────────────────────────────────────────────────
describe('recordStep · 每步写 Evidence', () => {
  it('非法 stepKey 不改变 run，不写证据', () => {
    const run = startExperiment('exp-s-dewei', { seed: 's' })
    const { run: next, evidence } = recordStep(run, 'not-a-step', 'x')
    expect(next).toEqual(run)
    expect(evidence).toEqual([])
  })

  it('question 步骤不写 Evidence', () => {
    const run = startExperiment('exp-s-dewei', { seed: 's' })
    const { evidence } = recordStep(run, 'question', '得位一定好吗？')
    expect(evidence).toEqual([])
  })

  it('hypothesis 记录 confidence 并写 hypothesis 证据', () => {
    const run = startExperiment('exp-s-dewei', { seed: 's' })
    const { run: next, evidence } = recordStep(run, 'hypothesis', '得位大多是吉', { confidence: 80 })
    expect(next.steps.hypothesis.confidence).toBe(80)
    expect(evidence.length).toBe(1)
    expect(evidence[0].action).toBe('hypothesis')
    expect(evidence[0].source).toBe('experiment')
    expect(evidence[0].targetType).toBe('experiment')
    expect(evidence[0].targetId).toBe('exp-s-dewei')
    expect(evidence[0].context).toBe('得位大多是吉')
  })

  it('对象型 value 抽取 text 作为 context', () => {
    const run = startExperiment('exp-s-dewei', { seed: 's' })
    const { evidence } = recordStep(run, 'observe', { text: '初九潜藏，六二得中' })
    expect(evidence[0].action).toBe('observe')
    expect(evidence[0].context).toBe('初九潜藏，六二得中')
  })
})

// ─────────────────────────────────────────────────────────────
describe('BeliefRevision · 观点修正（核心成长指标）', () => {
  function runWith(counterexample = null, revise = null) {
    let run = startExperiment('exp-s-dewei', { seed: 's' })
    ;({ run } = recordStep(run, 'hypothesis', '得位一定是吉', { confidence: 80 }))
    if (counterexample) ({ run } = recordStep(run, 'counterexample', counterexample))
    if (revise) ({ run } = recordStep(run, 'revise', revise))
    ;({ run } = recordStep(run, 'conclusion', '得位提供的是位置信息，不代表吉凶', { confidence: 55 }))
    return run
  }

  it('记录原始主张 / 反证据 / 修正后主张', () => {
    const br = buildBeliefRevision(runWith('找到得位但爻辞偏凶的例子', '原假设太绝对'))
    expect(br.originalClaim).toBe('得位一定是吉')
    expect(br.originalConfidence).toBe(80)
    expect(br.revisedClaim).toBe('得位提供的是位置信息，不代表吉凶')
    expect(br.revisedConfidence).toBe(55)
    expect(br.counterEvidence).toContain('找到得位但爻辞偏凶的例子')
    expect(br.reason).toBe('原假设太绝对')
  })

  it('假设与结论都为空时不产生 BeliefRevision', () => {
    const run = startExperiment('exp-s-dewei', { seed: 's' })
    expect(buildBeliefRevision(run)).toBeNull()
  })

  it('没有反例时 counterEvidence 为空数组但修正仍可成立', () => {
    const br = buildBeliefRevision(runWith(null, '我重新考虑了边界'))
    expect(br.counterEvidence).toEqual([])
    expect(br.revisedClaim).toBeTruthy()
  })
})

// ─────────────────────────────────────────────────────────────
describe('buildExperimentResult · 完整实验产物', () => {
  it('走完十步后生成结构化结果 + BeliefRevision + completedAt', () => {
    let run = startExperiment('exp-s-dewei', { seed: 's' })
    const steps = [
      ['question', '得位一定好吗？'],
      ['hypothesis', '得位大多是吉', 80],
      ['predict', '大多数得位爻会偏吉'],
      ['observe', '样本里有的得位爻爻辞偏凶'],
      ['evidence', '有两条得位爻确实偏吉'],
      ['counterexample', '找到得位但凶的例子'],
      ['revise', '得位不等于吉，只是位置信息'],
      ['conclusion', '得位提供位置信息，吉凶要看整体', 55],
      ['reflect', '我一开始默认了得位=吉'],
    ]
    for (const [k, v, c] of steps) {
      const r = recordStep(run, k, v, c != null ? { confidence: c } : {})
      run = r.run
    }
    const result = buildExperimentResult(run, { timestamp: 123 })
    expect(result.hypothesis).toBe('得位大多是吉')
    expect(result.hypothesisConfidence).toBe(80)
    expect(result.conclusionConfidence).toBe(55)
    expect(result.counterexample).toBe('找到得位但凶的例子')
    expect(result.beliefRevision).toBeTruthy()
    expect(result.completedAt).toBe(123)
    expect(result.runId).toBe(run.runId)
  })
})

// ─────────────────────────────────────────────────────────────
describe('runEvidencePartials · 实验步骤转 Evidence', () => {
  it('十步中只有 question 不产出，其余 9 步各自产出 action', () => {
    let run = startExperiment('exp-s-dewei', { seed: 's' })
    for (const [k, v] of [
      ['question', 'q'], ['hypothesis', 'h'], ['predict', 'p'], ['sample', 's'],
      ['observe', 'o'], ['evidence', 'e'], ['counterexample', 'c'],
      ['revise', 'r'], ['conclusion', 'x'], ['reflect', 'f'],
    ]) {
      run = recordStep(run, k, v).run
    }
    const partials = runEvidencePartials(run)
    expect(partials.length).toBe(9)
    expect(partials.every((p) => p.source === 'experiment')).toBe(true)
    expect(partials.every((p) => p.metadata.runId === run.runId)).toBe(true)
  })
})

// ─────────────────────────────────────────────────────────────
describe('持久化 · RECORD_EXPERIMENT_RUN 进入 reducer', () => {
  it('归档 ExperimentResult + BeliefRevision', () => {
    const run = {
      runId: 'r1', experimentId: 'exp-s-dewei', category: 'structure', title: '得位一定好吗？',
      beliefRevision: { originalClaim: 'a', revisedClaim: 'b' },
      completedAt: 1,
    }
    const s = reducer({ ...initialState }, { type: 'RECORD_EXPERIMENT_RUN', run })
    expect(s.experimentRuns.length).toBe(1)
    expect(s.beliefRevisions.length).toBe(1)
    expect(s.beliefRevisions[0].originalClaim).toBe('a')
  })

  it('run 无 beliefRevision 时不写入 beliefRevisions', () => {
    const s = reducer({ ...initialState }, { type: 'RECORD_EXPERIMENT_RUN', run: { runId: 'r2', completedAt: 1 } })
    expect(s.experimentRuns.length).toBe(1)
    expect(s.beliefRevisions.length).toBe(0)
  })
})

// ─────────────────────────────────────────────────────────────
describe('buildExperimentArchive · 我的易学推理实验记录', () => {
  it('按实验分组、统计假设/反例/修正数', () => {
    const runs = [
      { experimentId: 'exp-s-dewei', title: '得位一定好吗？', category: 'structure', runId: 'r1', hypothesis: '得位是吉', counterexample: '得位但凶', conclusion: '得位不等于吉', beliefRevision: { originalClaim: '得位是吉', revisedClaim: '得位不等于吉', counterEvidence: ['得位但凶'] }, completedAt: 1 },
      { experimentId: 'exp-s-dewei', title: '得位一定好吗？', category: 'structure', runId: 'r2', hypothesis: '得位不影响', conclusion: '依然有影响', beliefRevision: { originalClaim: '得位不影响', revisedClaim: '依然有影响', counterEvidence: [] }, completedAt: 2 },
      { experimentId: 'exp-t-guaci-only', title: '只看卦辞够不够？', category: 'text', runId: 'r3', hypothesis: '卦辞够用', conclusion: '不够用', beliefRevision: { originalClaim: '卦辞够用', revisedClaim: '不够用', counterEvidence: [] }, completedAt: 3 },
    ]
    const archive = buildExperimentArchive(runs)
    expect(archive.runCount).toBe(3)
    expect(archive.hypothesisCount).toBe(3)
    expect(archive.counterexampleCount).toBe(1)
    expect(archive.revisionCount).toBe(3)
    expect(archive.byExperiment.length).toBe(2)
    const dewei = archive.byExperiment.find((g) => g.experimentId === 'exp-s-dewei')
    expect(dewei.runs.length).toBe(2)
  })

  it('空存档返回零计数', () => {
    const a = buildExperimentArchive([])
    expect(a.runCount).toBe(0)
    expect(a.byExperiment).toEqual([])
  })
})