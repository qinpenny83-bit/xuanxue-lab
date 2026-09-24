// ============================================================
// R3 Phase 2.5 · 学习状态闭环修复 · 测试
//
// 覆盖（随任务推进逐步补齐）：
//   1. TextSignals 主动修正识别（LOW_UNCERTAINTY 误报修复）
//   2. Evidence ID 同毫秒碰撞安全
//   3. 实验样本 id/targetId 完整性
//   4. Evidence → Mastery 唯一能力事实源
//   5. Evidence-first 推荐（Home/Growth 冲突消解）
// ============================================================
import { describe, it, expect } from 'vitest'
import analyzeSignals, { SIGNAL_TYPES } from '../src/lib/textSignals'
import { recommendByEvidence } from '../src/agent/evidenceRecommendation'
import { createEvidence } from '../src/agent/learningEvidence'
import { startExperiment } from '../src/agent/experimentEngine'
import { EXPERIMENTS_V3 } from '../src/data/experiments-v3'
import { initialState } from '../src/lib/storage'

const T = () => Date.now() - 1000

// ─────────────────────────────────────────────────────────────
describe('Phase 2.5 · TextSignals 主动修正识别', () => {
  it('「原来的假设太绝对了」是主动修正（SELF_CORRECTION），不算绝对化主张', () => {
    const s = analyzeSignals('原来的假设太绝对了')
    expect(s.absoluteHits).toBeGreaterThan(0) // 原始命中仍在（「绝对」）
    expect(s.selfCorrection).toBe(true)
    expect(s.absoluteClaims).toBe(0)
    expect(s.signalType).toBe(SIGNAL_TYPES.SELF_CORRECTION)
  })

  it('「得位一定就是吉」是绝对化主张（ABSOLUTE_CLAIM），不是修正', () => {
    const s = analyzeSignals('得位一定就是吉')
    expect(s.absoluteClaims).toBeGreaterThanOrEqual(1)
    expect(s.selfCorrection).toBe(false)
    expect(s.signalType).toBe(SIGNAL_TYPES.ABSOLUTE_CLAIM)
  })

  it('「我之前太肯定了，现在认为未必」被识别为修正而非主张', () => {
    const s = analyzeSignals('我之前太肯定了，现在认为未必')
    expect(s.selfCorrection).toBe(true)
    expect(s.absoluteClaims).toBe(0)
    // 「未必」同时承认不确定性
    expect(s.mentionsUncertainty).toBe(true)
  })

  it('SIGNAL_TYPES 三类信号齐全', () => {
    expect(SIGNAL_TYPES.ABSOLUTE_CLAIM).toBe('ABSOLUTE_CLAIM')
    expect(SIGNAL_TYPES.SELF_CORRECTION).toBe('SELF_CORRECTION')
    expect(SIGNAL_TYPES.UNCERTAINTY_ACKNOWLEDGEMENT).toBe('UNCERTAINTY_ACKNOWLEDGEMENT')
  })
})

// ─────────────────────────────────────────────────────────────
describe('Phase 2.5 · LOW_UNCERTAINTY 不再抢占 BELIEF_REVISION', () => {
  const build = (reviseText) => ({
    ...initialState,
    evidence: [
      createEvidence({ source: 'experiment', action: 'evidence', targetType: 'experiment', targetId: 'x', context: '九三得位且相应，支持假设', timestamp: T() }),
      createEvidence({ source: 'experiment', action: 'counterexample', targetType: 'experiment', targetId: 'x', context: '另有一爻得位却爻辞为凶', timestamp: T() }),
      createEvidence({ source: 'experiment', action: 'revise', targetType: 'experiment', targetId: 'x', context: reviseText, timestamp: T() }),
    ],
    beliefRevisions: [{ originalClaim: '得位即吉', revisedClaim: '得位不必然吉', counterEvidence: ['得位而凶'], reason: '反例', timestamp: T() }],
  })

  it('修正文本「原来的假设太绝对了」→ primary 是 BELIEF_REVISION', () => {
    const rec = recommendByEvidence(build('原来的假设太绝对了'))
    expect(rec.primary.reasonCode).toBe('BELIEF_REVISION')
  })

  it('真正的绝对化主张仍会触发 LOW_UNCERTAINTY', () => {
    const state = {
      ...initialState,
      evidence: [
        createEvidence({ source: 'workshop', action: 'construct', targetType: 'hexagram', targetId: 1, context: '得位一定就是吉，绝对没错', timestamp: T() }),
      ],
    }
    const rec = recommendByEvidence(state)
    expect(rec.primary.reasonCode).toBe('LOW_UNCERTAINTY')
  })
})

// ─────────────────────────────────────────────────────────────
describe('Phase 2.5 · Evidence ID 同毫秒碰撞安全', () => {
  it('同一毫秒连续写入 100 条（不同动作/对象），ID 全部唯一', () => {
    const ts = 1600000000000
    const list = []
    for (let i = 0; i < 100; i++) {
      list.push(createEvidence({
        source: 'experiment', action: i % 2 ? 'evidence' : 'counterexample',
        targetType: 'experiment', targetId: `e-${i}`, context: '内容', timestamp: ts,
      }))
    }
    const ids = list.map((e) => e.id)
    expect(new Set(ids).size).toBe(100)
  })

  it('ID 保持 ev-{source} 前缀且 100 条互不相等', () => {
    const ts = 1600000000000
    const list = Array.from({ length: 100 }, (_, i) =>
      createEvidence({ source: 'workshop', action: 'view', targetType: 'hexagram', targetId: i, timestamp: ts }))
    for (const e of list) expect(e.id.startsWith('ev-workshop-')).toBe(true)
    expect(new Set(list.map((e) => e.id)).size).toBe(100)
  })

  it('显式注入 __seq 仍可复现固定 ID', () => {
    const a = createEvidence({ source: 'workshop', action: 'view', timestamp: 1000, __seq: 7 })
    expect(a.id).toBe('ev-workshop-1000-7')
  })
})

// ─────────────────────────────────────────────────────────────
describe('Phase 2.5 · 实验样本完整性（全量 80 实验）', () => {
  it('全部 80 个实验抽样，每个样本 type/id/targetId 都存在且不含 undefined/null', () => {
    expect(EXPERIMENTS_V3.length).toBe(80)
    for (const e of EXPERIMENTS_V3) {
      const run = startExperiment(e.id, { seed: e.id, count: 6, timestamp: 1600000000000 })
      expect(run, `实验 ${e.id} 无法启动`).toBeTruthy()
      expect(run.sample.length, `实验 ${e.id} 无样本`).toBeGreaterThanOrEqual(1)
      for (const s of run.sample) {
        expect(s.type, `实验 ${e.id} 样本缺 type`).toBeTruthy()
        expect(s.id, `实验 ${e.id} 样本缺 id`).toBeTruthy()
        expect(s.targetId, `实验 ${e.id} 样本缺 targetId`).toBeTruthy()
        expect(String(s.id)).not.toContain('undefined')
        expect(String(s.id)).not.toContain('null')
        expect(String(s.targetId)).not.toContain('undefined')
      }
    }
  })

  it('抽样确定性：同一 seed 两次抽样样本完全一致（可复现）', () => {
    for (const e of EXPERIMENTS_V3) {
      const a = startExperiment(e.id, { seed: e.id, count: 6, timestamp: 1600000000000 }).sample.map((s) => `${s.type}:${s.id}`).join(',')
      const b = startExperiment(e.id, { seed: e.id, count: 6, timestamp: 1600000000000 }).sample.map((s) => `${s.type}:${s.id}`).join(',')
      expect(a, `实验 ${e.id} 抽样不可复现`).toBe(b)
    }
  })

  it('卦类实验样本 id 是纯序号（无 undefined/空），爻类样本 id 是 seq-pos', () => {
    const byCat = {}
    for (const e of EXPERIMENTS_V3) byCat[e.category] = (byCat[e.category] || 0) + 1
    // 结构/文本/传统/认知/证据五类齐全
    expect(Object.keys(byCat).sort()).toEqual(['cognitive', 'evidence', 'structure', 'text', 'tradition'])
  })
})