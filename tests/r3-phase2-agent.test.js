// ============================================================
// R3 Phase 2 · Agent Evidence-first 推荐测试
//
// 覆盖：
//   1. 新 reason code 全部就位
//   2. Evidence-first：推荐主事实源 = getLearningState（非旧 fingerprint）
//   3. 冲突裁决：Evidence 优先于 fingerprint / mastery 的正面信号
//   4. 每个推荐可追溯到 Evidence ID / Error / Experiment
//   5. 三个真实场景（A 弱证据 / B 信念修正 / C 重复错误）
//   6. runAgent 输出统一状态 + 证据推荐
// ============================================================
import { describe, it, expect } from 'vitest'
import { REASON_CODES, createEvidence } from '../src/agent/learningEvidence'
import { recommendByEvidence } from '../src/agent/evidenceRecommendation'
import { getLearningState } from '../src/agent/unifiedLearningState'
import { runAgent } from '../src/agent/localAgentEngine'
import { initialState } from '../src/lib/storage'

const NEW_CODES = [
  'WEAK_EVIDENCE', 'NO_COUNTEREXAMPLE', 'LOW_UNCERTAINTY', 'REPEATED_ERROR',
  'REPEATED_BELIEF', 'BELIEF_REVISION', 'TRADITION_GAP', 'UNDERUSED_CLASSIC',
  'READY_FOR_INDEPENDENCE',
]

function constructEvidence(targetId, opts = {}) {
  return createEvidence({
    source: 'workshop',
    action: 'construct',
    targetType: 'hexagram',
    targetId,
    context: '这是一个解释结论',
    timestamp: opts.timestamp ?? Date.now() - 1000,
    ...opts,
  })
}

// ─────────────────────────────────────────────────────────────
describe('Reason Code · 新能力全部就位', () => {
  it('REASON_CODES 包含全部 9 个新 reason code', () => {
    for (const c of NEW_CODES) {
      expect(REASON_CODES, `缺 ${c}`).toHaveProperty(c)
    }
  })
})

// ─────────────────────────────────────────────────────────────
describe('Evidence-first · 主事实源切换', () => {
  it('推荐结果标注 source=evidence（非 fingerprint）', () => {
    const rec = recommendByEvidence({ ...initialState })
    expect(rec.source).toBe('evidence')
    expect(rec.evidenceCount).toBe(0)
  })

  it('无任何证据行为时不产生 recommendation（不因点击/旧数据瞎推）', () => {
    const rec = recommendByEvidence({ ...initialState })
    expect(rec.items).toEqual([])
    expect(rec.primary).toBeNull()
  })

  it('推荐由 Evidence 驱动，而非旧 fingerprint（caseAttempts 高能力也不影响证据推荐）', () => {
    // caseAttempts 造出「能力强」的旧指纹画像，但 Evidence 显示弱证据
    const state = {
      ...initialState,
      masteryProfile: { independence: 85, synthesis: 85, evidence: 20 },
      evidence: [
        constructEvidence(1, { timestamp: Date.now() - 3000 }),
        constructEvidence(2, { timestamp: Date.now() - 2000 }),
        constructEvidence(3, { timestamp: Date.now() - 1000 }),
      ],
    }
    const rec = recommendByEvidence(state)
    // 即使 READY_FOR_INDEPENDENCE 被 mastery 触发，干预型 Evidence 推荐仍是 primary
    expect(rec.items.some((i) => i.reasonCode === 'READY_FOR_INDEPENDENCE')).toBe(true)
    expect(rec.primary.reasonCode).toBe('WEAK_EVIDENCE')
  })
})

// ─────────────────────────────────────────────────────────────
describe('Scenario A · 连续 construct 但无 evidence → WEAK_EVIDENCE', () => {
  it('getLearningState 产出 WEAK_EVIDENCE 信号', () => {
    const state = {
      ...initialState,
      evidence: [
        constructEvidence(1, { timestamp: Date.now() - 3000 }),
        constructEvidence(2, { timestamp: Date.now() - 2000 }),
        constructEvidence(3, { timestamp: Date.now() - 1000 }),
      ],
    }
    const ls = getLearningState(state)
    expect(ls.recommendationSignals.WEAK_EVIDENCE.active).toBe(true)
    expect(ls.recommendationSignals.WEAK_EVIDENCE.meta.constructN).toBe(3)
    expect(ls.recommendationSignals.WEAK_EVIDENCE.meta.evidenceN).toBe(0)
  })

  it('primary = WEAK_EVIDENCE，且可追溯到 Evidence ID', () => {
    const state = {
      ...initialState,
      evidence: [
        constructEvidence(1, { timestamp: Date.now() - 3000 }),
        constructEvidence(2, { timestamp: Date.now() - 2000 }),
        constructEvidence(3, { timestamp: Date.now() - 1000 }),
      ],
    }
    const rec = recommendByEvidence(state)
    expect(rec.primary.reasonCode).toBe('WEAK_EVIDENCE')
    expect(rec.primary.trace.evidenceIds.length).toBe(3)
    expect(rec.primary.experiment).toBeTruthy()
    expect(rec.primary.experiment.id).toBeTruthy()
  })

  it('少于 3 次 construct 不误报 WEAK_EVIDENCE', () => {
    const state = { ...initialState, evidence: [constructEvidence(1)] }
    expect(recommendByEvidence(state).items.find((i) => i.reasonCode === 'WEAK_EVIDENCE')).toBeUndefined()
  })
})

// ─────────────────────────────────────────────────────────────
describe('Scenario B · 实验找反例并修改 → BELIEF_REVISION', () => {
  it('beliefRevisions 触发 BELIEF_REVISION，且为正面信号', () => {
    const state = {
      ...initialState,
      beliefRevisions: [{ originalClaim: '得位是吉', revisedClaim: '得位不一定是吉', counterEvidence: ['得位但凶的爻'] }],
    }
    const rec = recommendByEvidence(state)
    const item = rec.items.find((i) => i.reasonCode === 'BELIEF_REVISION')
    expect(item).toBeTruthy()
    expect(item.positive).toBe(true)
    expect(item.trace.revisions.length).toBe(1)
  })
})

// ─────────────────────────────────────────────────────────────
describe('Scenario C · 连续同一种错误 → REPEATED_ERROR', () => {
  it('Evidence 中重复 errorTypes 触发 REPEATED_ERROR', () => {
    const state = {
      ...initialState,
      evidence: [
        createEvidence({ source: 'doubt', action: 'challenge', targetType: 'doubt', targetId: 'a', errorTypes: ['E04'], timestamp: Date.now() - 2000 }),
        createEvidence({ source: 'doubt', action: 'challenge', targetType: 'doubt', targetId: 'b', errorTypes: ['E04'], timestamp: Date.now() - 1000 }),
      ],
    }
    const ls = getLearningState(state)
    expect(ls.recommendationSignals.REPEATED_ERROR.active).toBe(true)
    const rec = recommendByEvidence(state)
    expect(rec.primary.reasonCode).toBe('REPEATED_ERROR')
    expect(rec.primary.trace.errorCodes).toContain('E04')
  })

  it('不重复的错误不触发 REPEATED_ERROR', () => {
    const state = {
      ...initialState,
      evidence: [
        createEvidence({ source: 'doubt', action: 'challenge', targetType: 'doubt', targetId: 'a', errorTypes: ['E04'], timestamp: Date.now() - 1000 }),
      ],
    }
    expect(getLearningState(state).recommendationSignals.REPEATED_ERROR).toBeUndefined()
  })
})

// ─────────────────────────────────────────────────────────────
describe('推荐可追溯性 · 不做万能 AI 老师', () => {
  it('每个推荐项都带 trace（可回溯到真实数据）', () => {
    const state = {
      ...initialState,
      evidence: [
        constructEvidence(1, { timestamp: Date.now() - 3000 }),
        constructEvidence(2, { timestamp: Date.now() - 2000 }),
        constructEvidence(3, { timestamp: Date.now() - 1000 }),
      ],
    }
    for (const item of recommendByEvidence(state).items) {
      expect(item.reasonCode).toBeTruthy()
      expect(item.trace).toBeTruthy()
      expect(Object.keys(item.trace).length).toBeGreaterThan(0)
    }
  })

  it('无任何证据时 runAgent 仍输出 unifiedState + evidenceRecommendation', () => {
    const out = runAgent({ ...initialState })
    expect(out.unifiedState).toBeTruthy()
    expect(out.evidenceRecommendation.source).toBe('evidence')
  })

  it('runAgent 的证据推荐与 recommendByEvidence 一致（同一事实源）', () => {
    const state = {
      ...initialState,
      evidence: [
        constructEvidence(1, { timestamp: Date.now() - 3000 }),
        constructEvidence(2, { timestamp: Date.now() - 2000 }),
        constructEvidence(3, { timestamp: Date.now() - 1000 }),
      ],
    }
    const out = runAgent(state)
    expect(out.evidenceRecommendation.primary.reasonCode).toBe('WEAK_EVIDENCE')
    expect(out.unifiedState.behavior.totalActions).toBe(3)
  })
})