// ============================================================
// V1.6 新增能力测试：个人推理指纹 / Agent 洞察 / 自适应训练 /
// 判断边界（不知道选项）/ 重做比较 / 推理轨迹与进化时间线 /
// 错误博物馆趋势 / 数据持久化。
// 运行：npm test
// ============================================================
import { describe, it, expect, vi, afterEach } from 'vitest'

import { initialState, loadState, saveState } from '../src/lib/storage'
import { reducer } from '../src/store/reducer'
import { scoreCase } from '../src/lib/caseScoring'
import { getCase, CASES } from '../src/data/cases'
import { reasoningFingerprint } from '../src/agent/reasoningFingerprint'
import { adaptiveTraining } from '../src/agent/adaptiveTraining'
import { agentInsight } from '../src/agent/agentInsight'
import { errorMuseumTrend } from '../src/agent/errorMuseum'
import { buildTrace, traceHabit, correctionVerdict, buildEvolutionTimeline } from '../src/lib/reasoningTrace'

// 一条案例推理记录（attempt）的工厂
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
    ...overrides,
  }
}

// E01 高频 + 高信心的「坏」样本
function badAttempt() {
  return attempt({
    errorTypes: ['E01'],
    confidence: 90,
    actualQuality: 55,
    dimensions: { info: 55, reasoning: 45, counter: 35, over: 25, boundary: 30 },
  })
}

describe('V1.6 个人推理指纹', () => {
  it('deterministic：同样输入两次输出完全一致', () => {
    const s = { ...initialState, caseAttempts: [badAttempt(), badAttempt(), badAttempt(), badAttempt(), badAttempt()], errorPatterns: { E01: 5 } }
    const a = JSON.stringify(reasoningFingerprint(s))
    const b = JSON.stringify(reasoningFingerprint(s))
    expect(a).toBe(b)
  })

  it('E01 高频 + 高信心 → 稳定识别「快速下结论型」', () => {
    const s = { ...initialState, caseAttempts: [badAttempt(), badAttempt(), badAttempt(), badAttempt(), badAttempt()], errorPatterns: { E01: 5 } }
    const fp = reasoningFingerprint(s)
    expect(fp.ready).toBe(true)
    expect(fp.sampleCount).toBe(5)
    expect(fp.primaryPattern.key).toBe('quickConclusion')
    expect(fp.why).toContain('信心平均比实际判断质量高')
    // 行为证据可解释：错误最多的是 E01
    expect(fp.evidence.errorTop).toBe('E01')
  })

  it('最近行为权重高于远期：先好后坏 vs 先坏后好，加权结果不同', () => {
    const good = attempt({ dimensions: { info: 60, reasoning: 65, counter: 50, over: 75, boundary: 70 }, confidence: 60, actualQuality: 60 })
    const sA = { ...initialState, caseAttempts: [good, good, good, badAttempt(), badAttempt(), badAttempt()], errorPatterns: { E01: 3 } }
    const sB = { ...initialState, caseAttempts: [badAttempt(), badAttempt(), badAttempt(), good, good, good], errorPatterns: { E01: 3 } }
    const fpA = reasoningFingerprint(sA)
    const fpB = reasoningFingerprint(sB)
    // 两次数据简单平均相同，但加权后「最近的坏样本」让 A 的克制分更低、信心落差更大
    expect(fpA.evidence.overAvg).toBeLessThan(fpB.evidence.overAvg)
    expect(fpA.evidence.diffAvg).toBeGreaterThan(fpB.evidence.diffAvg)
  })

  it('数据不足（<3 次）时不乱判定', () => {
    const s = { ...initialState, caseAttempts: [attempt(), attempt()] }
    const fp = reasoningFingerprint(s)
    expect(fp.ready).toBe(false)
    expect(fp.primaryPattern).toBeNull()
    expect(fp.why).toContain('3 个案例')
  })

  it('输出包含次要倾向、优势与盲点', () => {
    const s = { ...initialState, caseAttempts: [badAttempt(), badAttempt(), badAttempt(), badAttempt(), badAttempt()], errorPatterns: { E01: 5 } }
    const fp = reasoningFingerprint(s)
    expect(Array.isArray(fp.secondaryPatterns)).toBe(true)
    expect(Array.isArray(fp.strengths)).toBe(true)
    expect(Array.isArray(fp.blindSpots)).toBe(true)
    expect(fp.trend.direction).toBeTruthy()
  })
})

describe('V1.6 Agent 洞察（你可能没发现）', () => {
  it('无任何行为数据 → 不编造洞察', () => {
    expect(agentInsight(initialState, reasoningFingerprint(initialState))).toBeNull()
  })

  it('样本不足（1 次）→ 不生成洞察', () => {
    const s = { ...initialState, caseAttempts: [attempt()] }
    expect(agentInsight(s, reasoningFingerprint(s))).toBeNull()
  })

  it('E01 高频 → 洞察必须有行为依据，且推荐与洞察一致', () => {
    const s = { ...initialState, caseAttempts: [badAttempt(), badAttempt(), badAttempt(), badAttempt(), badAttempt()], errorPatterns: { E01: 5 } }
    const ins = agentInsight(s, reasoningFingerprint(s))
    expect(ins).not.toBeNull()
    expect(ins.key).toBe('evidence-before-conclusion')
    expect(ins.body).toContain('很早就确定了方向')
    expect(ins.evidence.length).toBeGreaterThanOrEqual(3)
    // 推荐的案例必须与洞察主题一致（证据训练）
    const cs = getCase(ins.caseId)
    expect(['evidence', 'insufficient', 'mislead']).toContain(cs.trainingTag)
  })

  it('信心显著高于实际质量 → 生成过度自信洞察', () => {
    const over = attempt({ confidence: 90, actualQuality: 55, dimensions: { info: 70, reasoning: 65, counter: 60, over: 50, boundary: 55 } })
    const s = { ...initialState, caseAttempts: [over, over, over, over, over], confidenceHistory: [{ confidence: 90, actual: 55 }] }
    const fp = reasoningFingerprint(s)
    const ins = agentInsight(s, fp)
    expect(ins).not.toBeNull()
    expect(['overconfidence', 'evidence-before-conclusion']).toContain(ins.key)
  })
})

describe('V1.6 自适应训练引擎', () => {
  const readyFp = { ready: true, evidence: { diffAvg: 0, caseCount: 5 } }

  it('E01 高频 → 证据训练（且案例匹配）', () => {
    const s = { ...initialState, errorPatterns: { E01: 3 } }
    const t = adaptiveTraining(s, readyFp)
    expect(t.type).toBe('evidence')
    expect(t.caseId).toBeTruthy()
    expect(['evidence', 'boundary', 'insufficient', 'mislead', 'conflict']).toContain(getCase(t.caseId).trainingTag)
  })

  it('E07 高频 → 反例训练（且案例匹配）', () => {
    const s = { ...initialState, errorPatterns: { E07: 2 } }
    const t = adaptiveTraining(s, readyFp)
    expect(t.type).toBe('counter')
    expect(['counter', 'conflict', 'correlation']).toContain(getCase(t.caseId).trainingTag)
  })

  it('信心明显偏高（diff >= 20）→ 信心校准训练', () => {
    const s = { ...initialState, errorPatterns: {} }
    const t = adaptiveTraining(s, { ready: true, evidence: { diffAvg: 25, caseCount: 5 } })
    expect(t.type).toBe('calibration')
  })

  it('信心明显偏低（diff <= -20）→ 判断训练', () => {
    const s = { ...initialState, errorPatterns: {} }
    const t = adaptiveTraining(s, { ready: true, evidence: { diffAvg: -25, caseCount: 5 } })
    expect(t.type).toBe('judgment')
  })

  it('无突出模式 → 按节奏推进', () => {
    const s = { ...initialState, errorPatterns: {} }
    const t = adaptiveTraining(s, { ready: true, evidence: { diffAvg: 3, caseCount: 5 } })
    expect(t.type).toBe('normal')
  })

  it('指纹未就绪 → 不强行定向训练', () => {
    const t = adaptiveTraining(initialState, { ready: false })
    expect(t.type).toBe('normal')
  })
})

describe('V1.6 判断边界（「不知道」选项）', () => {
  it('证据不足时选「不知道」→ 正向评价（判断边界满分）', () => {
    const cs = getCase('case-021') // infoSufficiency: 'insufficient'
    const r = scoreCase(cs, { 0: 1, 1: ['他主动发了消息', '消息发生在凌晨'], 2: 'unknown', 3: 0, 4: 40, unknownReason: 'missing-evidence' })
    expect(r.dimensions.boundary).toBe(100)
    expect(r.notes.join('')).toContain('证据不足时选择「不判断」')
  })

  it('证据充分时选「不知道」→ 识别过度谨慎', () => {
    const cs = getCase('case-029') // infoSufficiency: 'sufficient'
    const r = scoreCase(cs, { 0: 0, 1: 'unknown', 2: 0, 3: 60, unknownReason: 'missing-evidence' })
    expect(r.dimensions.boundary).toBeLessThan(50)
    expect(r.dimensions.over).toBeLessThan(100)
    expect(r.notes.join('')).toContain('过度谨慎')
  })

  it('证据不足却硬下结论 → 不因「猜中」得高分', () => {
    const cs = getCase('case-021')
    const r = scoreCase(cs, { 0: 0, 1: ['他主动发了消息', '消息发生在凌晨'], 2: 0, 3: 1, 4: 85 })
    expect(r.dimensions.over).toBeLessThan(60)
    expect(r.dimensions.boundary).toBe(50) // 未触碰边界维度 → 中性基线
  })
})

describe('V1.6 如果重来一次（重做比较）', () => {
  it('分数提高 → 识别为明显改善', () => {
    const v = correctionVerdict({ score: 60, confidence: 90, errorTypes: ['E01'], actualQuality: 55 }, { score: 78, confidence: 80, errorTypes: [], actualQuality: 78 })
    expect(v.tone).toBe('good')
    expect(v.title).toContain('明显改善')
  })

  it('分数不变但开始考虑反例 → 过程进步（不只看答案变没变）', () => {
    const v = correctionVerdict({ score: 70, confidence: 70, errorTypes: ['E07'], actualQuality: 70 }, { score: 70, confidence: 70, errorTypes: [], actualQuality: 70 })
    expect(v.tone).toBe('good')
    expect(v.deltas).toContain('主动寻找反例')
  })

  it('分数下降 → 不把「改答案」当进步', () => {
    const v = correctionVerdict({ score: 82, confidence: 70, errorTypes: [], actualQuality: 70 }, { score: 60, confidence: 70, errorTypes: [], actualQuality: 62 })
    expect(v.tone).toBe('warn')
    expect(v.title).toContain('更不稳')
  })

  it('无对比数据 → 返回 null', () => {
    expect(correctionVerdict(null, { score: 70 })).toBeNull()
    expect(correctionVerdict({ score: 70 }, null)).toBeNull()
  })
})

describe('V1.6 错误博物馆趋势', () => {
  const mk = (over) => attempt({ errorTypes: ['E01'], dimensions: { ...attempt().dimensions, over } })

  it('识别「已经稳定解决」：出现够多且最近不再出现', () => {
    const s = {
      ...initialState,
      caseAttempts: [mk(30), mk(30), mk(30), mk(30), attempt({ errorTypes: [] }), attempt({ errorTypes: [] }), attempt({ errorTypes: [] }), attempt({ errorTypes: [] }), attempt({ errorTypes: [] })],
      errorPatterns: { E01: 4 },
    }
    const t = errorMuseumTrend(s, 'E01')
    expect(t.trend).toBe('solved')
    expect(t.label).toBe('已经稳定解决')
  })

  it('识别「正在改善」：最近出现时已基本不造成影响', () => {
    const s = { ...initialState, caseAttempts: [mk(30), mk(30), mk(75), mk(75)], errorPatterns: { E01: 4 } }
    const t = errorMuseumTrend(s, 'E01')
    expect(t.trend).toBe('improving')
  })

  it('识别「反复出现」：最近两次仍是硬伤', () => {
    const s = { ...initialState, caseAttempts: [mk(30), mk(30), mk(30), mk(30)], errorPatterns: { E01: 4 } }
    const t = errorMuseumTrend(s, 'E01')
    expect(t.trend).toBe('repeating')
  })

  it('案例中从未出现该错误 → 不强行下结论', () => {
    const s = { ...initialState, caseAttempts: [attempt({ errorTypes: [] })], errorPatterns: { E01: 1 } }
    const t = errorMuseumTrend(s, 'E01')
    expect(t.trend).toBeNull()
  })
})

describe('V1.6 推理轨迹与进化时间线', () => {
  it('buildTrace 能还原「不知道」轨迹节点', () => {
    const cs = getCase('case-021')
    const nodes = buildTrace(cs, { 0: 1, 1: ['他主动发了消息', '消息发生在凌晨'], 2: 'unknown', 3: 0, 4: 45 })
    expect(nodes.some((n) => n.isUnknown)).toBe(true)
  })

  it('traceHabit 能给出习惯提示与更好的做法', () => {
    const cs = getCase('case-021')
    const nodes = buildTrace(cs, { 0: 1, 1: ['他主动发了消息', '消息发生在凌晨'], 2: 0, 3: 1, 4: 85 })
    const habit = traceHabit(nodes, { dimensions: { info: 90, rule: 80, reasoning: 20, counter: 30, over: 40, boundary: 40 } })
    expect(habit.issue || habit.better).toBeTruthy()
    expect(habit.better.length).toBeGreaterThan(0)
  })

  it('进化时间线：样本不足返回 null', () => {
    expect(buildEvolutionTimeline([attempt()])).toBeNull()
  })

  it('进化时间线：按阶段描述推理方式变化', () => {
    const early = attempt({ errorTypes: ['E01'], confidence: 90, actualQuality: 50, dimensions: { info: 50, reasoning: 40, counter: 35, over: 25, boundary: 30 }, at: '2026-09-01T10:00:00Z' })
    const later = attempt({ usedUnknown: true, confidence: 60, actualQuality: 78, dimensions: { info: 80, reasoning: 75, counter: 75, over: 80, boundary: 90 }, at: '2026-09-15T10:00:00Z' })
    const tl = buildEvolutionTimeline([early, early, later, later, later])
    expect(tl).not.toBeNull()
    expect(tl.phases.length).toBeGreaterThanOrEqual(2)
    expect(tl.phases.every((p) => p.week && p.range && p.desc)).toBe(true)
  })
})

describe('V1.6 数据持久化', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('刷新后：推理历史、洞察状态保留，指纹可基于保留数据重算', () => {
    const store = {}
    const fakeLocalStorage = {
      getItem: (k) => (k in store ? store[k] : null),
      setItem: (k, v) => { store[k] = String(v) },
      removeItem: (k) => { delete store[k] },
    }
    vi.stubGlobal('window', { localStorage: fakeLocalStorage })

    let s = loadState()
    s = reducer(s, {
      type: 'COMPLETE_CASE',
      caseId: 'case-021',
      result: { total: 80, dimensions: { info: 90, rule: 80, reasoning: 70, counter: 80, over: 85, boundary: 75 }, confidence: 70, actualQuality: 80, errorTypes: ['E01'], consideredCounter: true, usedUnknown: false, attempt: 1, redo: false },
    })
    s = reducer(s, { type: 'ACCEPT_INSIGHT', key: 'evidence-before-conclusion', caseId: 'case-021' })
    saveState(s)

    const reloaded = loadState()
    expect(reloaded.caseAttempts.length).toBe(1)
    expect(reloaded.caseAttempts[0].usedUnknown).toBe(false)
    expect(reloaded.insightState.key).toBe('evidence-before-conclusion')
    expect(reloaded.insightState.done).toBe(false)
    const fp = reasoningFingerprint(reloaded)
    expect(fp.ready).toBe(false) // 指纹与历史数据一起保留，样本不足时不乱判
  })

  it('COMPLETE_CASE 记录完整推理历史（含未知选择与重做标记）', () => {
    const s = reducer(initialState, {
      type: 'COMPLETE_CASE',
      caseId: 'case-021',
      result: { total: 75, dimensions: { info: 90, rule: 80, reasoning: 70, counter: 80, over: 85, boundary: 100 }, confidence: 50, actualQuality: 75, errorTypes: [], consideredCounter: true, usedUnknown: true, attempt: 2, redo: true },
    })
    expect(s.caseAttempts.length).toBe(1)
    expect(s.caseAttempts[0].usedUnknown).toBe(true)
    expect(s.caseAttempts[0].redo).toBe(true)
    expect(s.caseAttempts[0].attempt).toBe(2)
    expect(s.judgmentUnknownUsed).toBe(1)
  })
})

describe('V1.6 内容规模', () => {
  it('新增 10 个推理训练案例（case-021~030），每个都有 trainingTag 且结构完整', () => {
    const v16 = CASES.filter((c) => c.id >= 'case-021' && c.id <= 'case-030')
    expect(v16.length).toBe(10)
    for (const c of v16) {
      expect(c.trainingTag).toBeTruthy()
      expect(c.challenges.length).toBeGreaterThanOrEqual(3)
      expect(c.situation.length).toBeGreaterThanOrEqual(1)
      expect(c.reveal.takeaway).toBeTruthy()
    }
  })

  it('案例总数不少于 30（原 20 + 新增 10）', () => {
    expect(CASES.length).toBeGreaterThanOrEqual(30)
  })
})
