// ============================================================
// V1.6.1 真实性与体验打磨测试：
//   1. 「目前无法判断」覆盖所有判断类挑战 + 四场景评分 + 理由画像
//   2. 新用户三阶段（seed / hint / ready），不提前贴人格标签
//   3. 行为变化驱动洞察刷新，严禁伪洞察，每条洞察带真实证据
//   4. 推理轨迹真实性（所有节点来自真实作答，证据评分节点标记风险）
//   5. 重做比较过程优先（答对 ≠ 成长）
//   6. Agent 推荐可解释（推荐 + 原因 + 对应问题 + 训练目标 + 为什么不是另一道题）
//   7. 错误博物馆最近表现标记
//   8. 数据持久化（刷新后 unknownReason / insight snapshot 均恢复）
// 运行：npm test
// ============================================================
import { describe, it, expect, vi, afterEach } from 'vitest'

import { initialState, loadState, saveState } from '../src/lib/storage'
import { reducer } from '../src/store/reducer'
import { scoreCase, UNKNOWN_REASONS } from '../src/lib/caseScoring'
import { getCase, CASES } from '../src/data/cases'
import { reasoningFingerprint } from '../src/agent/reasoningFingerprint'
import { agentInsight, buildInsightSnapshot, shouldRefreshInsight } from '../src/agent/agentInsight'
import { adaptiveTraining } from '../src/agent/adaptiveTraining'
import { runAgent } from '../src/agent/localAgentEngine'
import { errorMuseumTrend } from '../src/agent/errorMuseum'
import { buildTrace, correctionVerdict } from '../src/lib/reasoningTrace'

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

// 合成案例：只含一个指定类型的判断挑战 + 信心
function synthCase(type) {
  return {
    id: `syn-${type}`,
    infoSufficiency: 'insufficient',
    challenges: [
      { type, prompt: '请判断', options: [{ text: 'A', points: 3 }, { text: 'B', points: 0 }] },
      { type: 'confidence', prompt: '信心多少' },
    ],
  }
}

describe('V1.6.1 全类型「目前无法判断」', () => {
  it('所有判断类挑战（choice/conclusion/why/counter/boundary/evidence/open）都接受「无法判断」并进入边界评分', () => {
    const TYPES = ['choice', 'conclusion', 'why', 'counter', 'boundary', 'evidence', 'open']
    for (const t of TYPES) {
      const r = scoreCase(synthCase(t), { 0: 'unknown', 1: 40, unknownReason: 'missing-evidence' })
      expect(r.dimensions.boundary).toBe(100) // 证据不足 + 有理由 → 边界满分
      expect(r.dimensions.over).toBe(100) // 选择不判断 → 不扣避免过度推断分
    }
  })

  it('数据层：所有 30 个案例的「判断类挑战」均可被 unknown 引擎评分（无崩溃）', () => {
    for (const cs of CASES) {
      const answers = {}
      cs.challenges.forEach((ch, i) => {
        if (ch.type === 'classify') answers[i] = []
        else if (ch.type === 'confidence') answers[i] = 50
        else answers[i] = 'unknown'
      })
      answers.unknownReason = 'missing-evidence'
      const r = scoreCase(cs, answers)
      expect(r.total).toBeGreaterThanOrEqual(0)
      expect(r.dimensions.boundary).toBeGreaterThanOrEqual(0)
    }
  })
})

describe('V1.6.1 「不知道」四场景评分', () => {
  it('情况 A：证据明显不足时选「无法判断」+ 理由 → 判断边界满分', () => {
    const cs = getCase('case-021') // infoSufficiency: 'insufficient'
    const r = scoreCase(cs, { 0: 1, 1: ['他主动发了消息', '消息发生在凌晨'], 2: 'unknown', 3: 0, 4: 40, unknownReason: 'missing-evidence' })
    expect(r.dimensions.boundary).toBe(100)
    expect(r.notes.join('')).toContain('证据不足时选择「不判断」')
    expect(r.notes.join('')).toContain('判断边界意识')
  })

  it('情况 B：证据明显充分时选「无法判断」→ 识别过度谨慎，不给高分', () => {
    const cs = getCase('case-029') // infoSufficiency: 'sufficient'
    const r = scoreCase(cs, { 0: 0, 1: 'unknown', 2: 0, 3: 60, unknownReason: 'missing-evidence' })
    expect(r.dimensions.boundary).toBeLessThan(50)
    expect(r.dimensions.over).toBeLessThan(100) // 过度谨慎也扣「避免过度推断」
    expect(r.notes.join('')).toContain('过度谨慎')
    expect(r.notes.join('')).toContain('低估了已有信息')
  })

  it('情况 C：信息互相冲突时选「无法判断」→ 高分（注意到冲突，没强行解释）', () => {
    const cs = getCase('case-022') // infoConflict: true
    const r = scoreCase(cs, { 0: 'unknown', 1: 'unknown', 2: 'unknown', 3: 50, unknownReason: 'conflict' })
    expect(r.dimensions.boundary).toBe(100)
    expect(r.notes.join('')).toContain('注意到了信息之间的冲突')
    expect(r.notes.join('')).toContain('没有强行解释')
  })

  it('情况 D：选「无法判断」但没有理由 → 不给满分，提示说明缺什么', () => {
    const cs = getCase('case-021')
    const r = scoreCase(cs, { 0: 1, 1: ['他主动发了消息', '消息发生在凌晨'], 2: 'unknown', 3: 0, 4: 40 })
    expect(r.dimensions.boundary).toBe(50) // 1.5/3 → 中性偏上，非满分
    expect(r.notes.join('')).toContain('到底缺少哪条信息')
  })

  it('证据不足但选「无法判断」且理由为 knowledge → 仍给正向评价但非满分', () => {
    const cs = getCase('case-021')
    const r = scoreCase(cs, { 0: 1, 1: ['他主动发了消息', '消息发生在凌晨'], 2: 'unknown', 3: 0, 4: 40, unknownReason: 'knowledge' })
    expect(r.dimensions.boundary).toBe(100)
  })
})

describe('V1.6.1 「为什么无法判断」理由进入推理画像', () => {
  it('连续因「缺少关键证据」选无法判断 → 画像给出边界意识提示', () => {
    const s = {
      ...initialState,
      caseAttempts: [
        attempt({ usedUnknown: true, unknownReason: 'missing-evidence' }),
        attempt({ usedUnknown: true, unknownReason: 'missing-evidence' }),
        attempt({ usedUnknown: true, unknownReason: 'missing-evidence' }),
      ],
    }
    const fp = reasoningFingerprint(s)
    expect(fp.unknownAnalysis.total).toBe(3)
    expect(fp.unknownAnalysis.byReason['missing-evidence']).toBe(3)
    expect(fp.unknownAnalysis.note).toContain('缺少关键证据')
  })

  it('多次因「还没学会知识」选无法判断 → 画像提示知识自信不足', () => {
    const s = {
      ...initialState,
      caseAttempts: [
        attempt({ usedUnknown: true, unknownReason: 'knowledge' }),
        attempt({ usedUnknown: true, unknownReason: 'knowledge' }),
        attempt({ usedUnknown: true, unknownReason: 'knowledge' }),
      ],
    }
    const fp = reasoningFingerprint(s)
    expect(fp.unknownAnalysis.note).toContain('知识')
    expect(fp.unknownAnalysis.note).toContain('信心')
  })

  it('reducer 持久化 unknownReason：COMPLETE_CASE 记录理由并计入 judgmentUnknownUsed', () => {
    const s = reducer(initialState, {
      type: 'COMPLETE_CASE',
      caseId: 'case-021',
      result: { total: 72, dimensions: { info: 60, rule: 60, reasoning: 60, counter: 50, over: 80, boundary: 100 }, confidence: 45, actualQuality: 72, errorTypes: [], usedUnknown: true, unknownReason: 'conflict', attempt: 1, redo: false },
    })
    expect(s.caseAttempts[0].usedUnknown).toBe(true)
    expect(s.caseAttempts[0].unknownReason).toBe('conflict')
    expect(s.judgmentUnknownUsed).toBe(1)
  })
})

describe('V1.6.1 新用户三阶段', () => {
  it('第 0 次：🌱 我还不了解你的推理习惯（无画像、无标签）', () => {
    const fp = reasoningFingerprint(initialState)
    expect(fp.stage.key).toBe('seed')
    expect(fp.stage.emoji).toBe('🌱')
    expect(fp.ready).toBe(false)
    expect(fp.primaryPattern).toBeNull()
    expect(fp.why).toContain('先完成一次案件')
  })

  it('第 1 次：👀 我开始发现一些迹象（样本太少，不贴标签）', () => {
    const fp = reasoningFingerprint({ ...initialState, caseAttempts: [attempt()] })
    expect(fp.stage.key).toBe('hint')
    expect(fp.stage.emoji).toBe('👀')
    expect(fp.ready).toBe(false)
    expect(fp.primaryPattern).toBeNull()
    expect(fp.why).toContain('暂时不会判断')
  })

  it('第 2 次：仍是迹象阶段，样本 2/3', () => {
    const fp = reasoningFingerprint({ ...initialState, caseAttempts: [attempt(), attempt()] })
    expect(fp.stage.key).toBe('hint')
    expect(fp.sampleCount).toBe(2)
    expect(fp.ready).toBe(false)
  })

  it('第 3 次以后：🧠 我可以告诉你一个发现（达到最低样本量）', () => {
    const s = { ...initialState, caseAttempts: [attempt(), attempt(), attempt()] }
    const fp = reasoningFingerprint(s)
    expect(fp.stage.key).toBe('ready')
    expect(fp.stage.emoji).toBe('🧠')
    expect(fp.ready).toBe(true)
  })

  it('指纹描述的是「最近的行为状态」，不是固定人格（同样行为会随数据变化）', () => {
    const good = attempt({ dimensions: { info: 80, reasoning: 75, counter: 80, over: 85, boundary: 70 }, confidence: 70, actualQuality: 75 })
    const sA = { ...initialState, caseAttempts: [badAttempt(), badAttempt(), badAttempt(), badAttempt(), badAttempt()], errorPatterns: { E01: 5 } }
    const sB = { ...initialState, caseAttempts: [good, good, good, good, good], errorPatterns: {} }
    const fpA = reasoningFingerprint(sA)
    const fpB = reasoningFingerprint(sB)
    expect(fpA.primaryPattern.key).toBe('quickConclusion')
    expect(fpB.primaryPattern.key).not.toBe('quickConclusion')
  })
})

describe('V1.6.1 洞察真实性（严禁伪洞察）', () => {
  it('0 次案例 → 不生成洞察', () => {
    expect(agentInsight(initialState, reasoningFingerprint(initialState))).toBeNull()
  })

  it('只有 1 次案例 → 不生成洞察（样本不足，不编造）', () => {
    const s = { ...initialState, caseAttempts: [badAttempt()] }
    expect(agentInsight(s, reasoningFingerprint(s))).toBeNull()
  })

  it('有充分行为证据 → 生成洞察，且每条洞察带真实案例来源', () => {
    const s = { ...initialState, caseAttempts: [badAttempt(), badAttempt(), badAttempt(), badAttempt(), badAttempt()], errorPatterns: { E01: 5 } }
    const ins = agentInsight(s, reasoningFingerprint(s))
    expect(ins).not.toBeNull()
    expect(ins.evidenceDetail.cases.length).toBeGreaterThanOrEqual(3)
    for (const c of ins.evidenceDetail.cases) {
      expect(c.caseId).toBeTruthy()
      expect(typeof c.score).toBe('number')
      expect(typeof c.over).toBe('number')
    }
  })

  it('行为均衡且无突出模式 → 不强行生成洞察', () => {
    const good = attempt({ dimensions: { info: 80, reasoning: 80, counter: 80, over: 85, boundary: 60 }, confidence: 70, actualQuality: 75 })
    const s = { ...initialState, caseAttempts: [good, good, good, good, good] }
    expect(agentInsight(s, reasoningFingerprint(s))).toBeNull()
  })
})

describe('V1.6.1 行为变化驱动洞察刷新', () => {
  it('行为无显著变化 → 保留原洞察（不频繁更换）', () => {
    const attempts = [badAttempt(), badAttempt(), badAttempt(), badAttempt(), badAttempt()]
    const base = { ...initialState, caseAttempts: attempts, errorPatterns: { E01: 5 } }
    const fp = reasoningFingerprint(base)
    const snap = buildInsightSnapshot(base, fp, 'evidence-before-conclusion')
    const content = { key: 'evidence-before-conclusion', title: '你可能没发现', headline: 'h', body: 'b', evidence: ['e'], caseId: 'case-021', caseTitle: 't', evidenceDetail: { cases: [] } }
    const s = { ...base, insightState: { date: '2026-09-17', key: 'evidence-before-conclusion', caseId: 'case-021', acceptedAt: 'x', done: false, snapshot: snap, content } }
    const ins = agentInsight(s, reasoningFingerprint(s))
    expect(ins).not.toBeNull()
    expect(ins.key).toBe('evidence-before-conclusion')
    expect(ins.snapshot).toEqual(snap) // 原快照保留
  })

  it('主要倾向发生变化 → 刷新为新洞察', () => {
    const base = { ...initialState, caseAttempts: [badAttempt(), badAttempt(), badAttempt(), badAttempt(), badAttempt()], errorPatterns: { E01: 5 } }
    const s = {
      ...base,
      insightState: {
        date: '2026-09-17',
        key: 'boundary-aware',
        done: false,
        snapshot: { sampleCount: 5, primaryKey: 'cautious', errorTop: null, diffAvg: -15, boundaryAvg: 80, counterAvg: 60, unknownUsed: 0, key: 'boundary-aware' },
        content: { key: 'boundary-aware', title: '你可能没发现', headline: 'h', body: 'b', evidence: [], caseId: null, caseTitle: null, evidenceDetail: { cases: [] } },
      },
    }
    const ins = agentInsight(s, reasoningFingerprint(s))
    expect(ins).not.toBeNull()
    expect(ins.key).toBe('evidence-before-conclusion') // 从 boundary-aware 换成新洞察
  })

  it('首次达到最低样本线（2 → 3 次）→ 触发刷新', () => {
    const s = {
      ...initialState,
      caseAttempts: [badAttempt(), badAttempt(), badAttempt()],
      errorPatterns: { E01: 3 },
      insightState: {
        date: '2026-09-17',
        key: 'x',
        done: false,
        snapshot: { sampleCount: 2, primaryKey: null, errorTop: null, diffAvg: null, boundaryAvg: null, counterAvg: null, unknownUsed: 0, key: 'x' },
        content: null,
      },
    }
    const ins = agentInsight(s, reasoningFingerprint(s))
    expect(ins).not.toBeNull()
    expect(ins.key).toBe('evidence-before-conclusion')
  })

  it('shouldRefreshInsight：无变化 false，主要倾向/证据/边界/反例变化均触发 true', () => {
    const base = { sampleCount: 5, primaryKey: 'quickConclusion', errorTop: 'E01', diffAvg: 20, boundaryAvg: 40, counterAvg: 35, unknownUsed: 0, key: 'k' }
    expect(shouldRefreshInsight(base, { ...base })).toBe(false)
    expect(shouldRefreshInsight(base, { ...base, primaryKey: 'cautious' })).toBe(true)
    expect(shouldRefreshInsight(base, { ...base, errorTop: 'E07' })).toBe(true)
    expect(shouldRefreshInsight(base, { ...base, diffAvg: 5 })).toBe(true)
    expect(shouldRefreshInsight(base, { ...base, boundaryAvg: 70 })).toBe(true)
    expect(shouldRefreshInsight(base, { ...base, counterAvg: 70 })).toBe(true)
    expect(shouldRefreshInsight(base, { ...base, unknownUsed: 2 })).toBe(true)
    expect(shouldRefreshInsight({ sampleCount: 2, primaryKey: null }, { sampleCount: 3, primaryKey: null })).toBe(true)
  })
})

describe('V1.6.1 推理轨迹真实性', () => {
  it('所有节点都来自真实作答：未作答的挑战不产生节点', () => {
    const cs = getCase('case-021')
    const nodes = buildTrace(cs, { 0: 1 }, null)
    expect(nodes.length).toBe(1)
    expect(nodes[0].label).toBe('选择规则')
    expect(nodes[0].text).toContain('先看看有没有更多信息')
    expect(nodes.some((n) => n.label === '证据评分')).toBe(false) // 无 result 时不伪造
  })

  it('证据评分节点来自真实 result.dimensions.over（数值一致，不伪造）', () => {
    const cs = getCase('case-021')
    const nodes = buildTrace(cs, { 0: 0, 1: ['他主动发了消息', '消息发生在凌晨'], 2: 0, 3: 0, 4: 80 }, { dimensions: { over: 40 } })
    const evNode = nodes.find((n) => n.label === '证据评分')
    expect(evNode).toBeTruthy()
    expect(evNode.text).toContain('40/100')
  })

  it('证据评分 < 55 → 标记风险点（“证据还不充分时已形成结论”）', () => {
    const cs = getCase('case-021')
    const nodes = buildTrace(cs, { 0: 0, 1: ['他主动发了消息', '消息发生在凌晨'], 2: 0, 3: 0, 4: 80 }, { dimensions: { over: 40 } })
    const evNode = nodes.find((n) => n.label === '证据评分')
    expect(evNode.risk).toBe(true)
    expect(evNode.riskText).toContain('风险')
  })

  it('证据评分 >= 70 → 无风险标记', () => {
    const cs = getCase('case-021')
    const nodes = buildTrace(cs, { 0: 0, 1: ['他主动发了消息', '消息发生在凌晨'], 2: 0, 3: 0, 4: 80 }, { dimensions: { over: 80 } })
    const evNode = nodes.find((n) => n.label === '证据评分')
    expect(evNode.risk).toBe(false)
    expect(evNode.riskText).toBeNull()
  })

  it('选择「无法判断」→ 轨迹出现判断边界节点', () => {
    const cs = getCase('case-021')
    const nodes = buildTrace(cs, { 0: 1, 1: ['他主动发了消息', '消息发生在凌晨'], 2: 'unknown', 3: 0, 4: 45 })
    const unk = nodes.find((n) => n.isUnknown)
    expect(unk).toBeTruthy()
    expect(unk.text).toContain('我目前无法判断')
    expect(unk.icon).toBe('🚦')
  })
})

describe('V1.6.1 重做比较（过程优先）', () => {
  it('分数提高但推理过程无改善 → 只说「答案对了」，不夸成长', () => {
    const v = correctionVerdict(
      { score: 60, confidence: 70, errorTypes: [], actualQuality: 60, dimensions: { info: 60, over: 60, counter: 50, boundary: 55 } },
      { score: 75, confidence: 70, errorTypes: [], actualQuality: 60, dimensions: { info: 60, over: 60, counter: 50, boundary: 55 } },
    )
    expect(v.tone).toBe('neutral')
    expect(v.title).toContain('答案正确了')
    expect(v.title).toContain('推理过程没有明显改善')
    expect(v.deltas).toContain('分数 +15')
  })

  it('分数持平但过程改善（主动找反例）→ 肯定「真正改善的是推理过程」', () => {
    const v = correctionVerdict(
      { score: 70, confidence: 70, errorTypes: ['E07'], actualQuality: 70, dimensions: { info: 70, over: 70, counter: 40, boundary: 60 } },
      { score: 70, confidence: 70, errorTypes: [], actualQuality: 70, dimensions: { info: 70, over: 70, counter: 70, boundary: 60 } },
    )
    expect(v.tone).toBe('good')
    expect(v.title).toContain('真正改善的不是答案')
    expect(v.deltas).toContain('主动寻找反例')
  })

  it('分数提高且过程改善 → 明显改善', () => {
    const v = correctionVerdict(
      { score: 55, confidence: 90, errorTypes: ['E01'], actualQuality: 55, dimensions: { info: 50, over: 40, counter: 50, boundary: 40 } },
      { score: 78, confidence: 80, errorTypes: [], actualQuality: 78, dimensions: { info: 75, over: 70, counter: 60, boundary: 70 } },
    )
    expect(v.tone).toBe('good')
    expect(v.title).toContain('明显改善')
    expect(v.deltas.some((d) => d.includes('证据意识'))).toBe(true)
  })

  it('回归：onRedo 保存的 first 必须含 score 字段，绝不出现 undefined/-NaN（scoreCase 原始字段是 total）', () => {
    // 模拟真实链路：scoreCase 返回 total 字段 → onRedo 转换 → correctionVerdict
    const r1 = scoreCase(getCase('case-021'), { 0: 'unknown', 1: ['他主动发了消息', '消息发生在凌晨'], 2: 'unknown', 3: 0, 4: 78 })
    const first = {
      score: r1.total,
      confidence: r1.confidence,
      actualQuality: r1.actualQuality,
      errorTypes: [],
      dimensions: r1.dimensions,
    }
    const r2 = scoreCase(getCase('case-021'), { 0: 1, 1: ['他主动发了消息', '消息发生在凌晨'], 2: 1, 3: 0, 4: 40 })
    const second = {
      score: r2.total,
      confidence: r2.confidence,
      actualQuality: r2.actualQuality,
      errorTypes: [],
      dimensions: r2.dimensions,
    }
    expect(first.score).toBeTypeOf('number')
    const v = correctionVerdict(first, second)
    expect(String(v.body)).not.toContain('undefined')
    expect(String(v.body)).not.toContain('NaN')
    expect(v.deltas.join(' ')).not.toContain('NaN')
    expect(v.body).toContain(String(first.score))
  })
})

describe('V1.6.1 Agent 推荐可解释', () => {
  it('推荐与错误类型一致：E01 高频 → 证据训练，推荐案例训练目标匹配', () => {
    const s = { ...initialState, errorPatterns: { E01: 3 } }
    const t = adaptiveTraining(s, { ready: true, evidence: { diffAvg: 0, caseCount: 5 } })
    expect(t.type).toBe('evidence')
    expect(t.why).toContain('E01 出现 3 次') // 推荐原因含真实行为数据
    const cs = getCase(t.caseId)
    expect(['evidence', 'boundary', 'insufficient', 'mislead', 'conflict']).toContain(cs.trainingTag)
  })

  it('runAgent：为什么推荐包含「推荐+原因+对应问题+训练目标+为什么不是另一道题」', () => {
    // V2：完整 6 维行为数据，证据意识是真正最弱项（over/info 双低 → evidence 瓶颈）→ 推荐证据训练
    const evBadAttempt = () =>
      attempt({
        errorTypes: ['E01'],
        confidence: 90,
        actualQuality: 55,
        dimensions: { info: 55, rule: 65, reasoning: 60, counter: 55, over: 20, boundary: 55 },
      })
    const s = { ...initialState, caseAttempts: [evBadAttempt(), evBadAttempt(), evBadAttempt(), evBadAttempt(), evBadAttempt()], errorPatterns: { E01: 5 } }
    const agent = runAgent(s)
    expect(agent.fingerprint.ready).toBe(true)
    expect(agent.training.type).toBe('evidence')
    expect(agent.whyThisCase).not.toBeNull()
    const joined = agent.whyThisCase.points.join(' ')
    expect(joined).toContain('推荐：')
    expect(joined).toContain('原因：')
    expect(joined).toContain('对应问题：')
    expect(joined).toContain('训练目标：')
    expect(agent.whyThisCase.whyNotLesson).toContain('应用判断')
  })

  it('推荐案例与洞察一致：洞察推荐证据类案例，不是五行基础题', () => {
    const s = { ...initialState, caseAttempts: [badAttempt(), badAttempt(), badAttempt(), badAttempt(), badAttempt()], errorPatterns: { E01: 5 } }
    const ins = agentInsight(s, reasoningFingerprint(s))
    expect(ins).not.toBeNull()
    const cs = getCase(ins.caseId)
    expect(['evidence', 'insufficient', 'mislead']).toContain(cs.trainingTag)
  })
})

describe('V1.6.1 错误博物馆最近表现', () => {
  it('最近 3 次表现标记：❌→⚠️→✅ 映射真实证据克制分', () => {
    const mk = (over) => attempt({ errorTypes: ['E01'], dimensions: { ...attempt().dimensions, over } })
    const s = { ...initialState, caseAttempts: [mk(30), mk(30), mk(60), mk(85)], errorPatterns: { E01: 4 } }
    const t = errorMuseumTrend(s, 'E01')
    expect(t.marks).toEqual(['❌', '❌', '⚠️', '✅'])
    expect(t.trend).toBe('improving') // 最近一次已基本不造成影响
  })
})

describe('V1.6.1 数据持久化', () => {
  afterEach(() => vi.unstubAllGlobals())

  function stubStorage() {
    const store = {}
    const fakeLocalStorage = {
      getItem: (k) => (k in store ? store[k] : null),
      setItem: (k, v) => { store[k] = String(v) },
      removeItem: (k) => { delete store[k] },
    }
    vi.stubGlobal('window', { localStorage: fakeLocalStorage })
  }

  it('刷新后：caseAttempts 的 unknownReason / usedUnknown / 重做标记恢复', () => {
    stubStorage()
    let s = loadState()
    s = reducer(s, {
      type: 'COMPLETE_CASE',
      caseId: 'case-021',
      result: { total: 72, dimensions: { info: 60, rule: 60, reasoning: 60, counter: 50, over: 80, boundary: 100 }, confidence: 45, actualQuality: 72, errorTypes: [], usedUnknown: true, unknownReason: 'missing-evidence', attempt: 2, redo: true },
    })
    saveState(s)
    const reloaded = loadState()
    expect(reloaded.caseAttempts.length).toBe(1)
    expect(reloaded.caseAttempts[0].usedUnknown).toBe(true)
    expect(reloaded.caseAttempts[0].unknownReason).toBe('missing-evidence')
    expect(reloaded.caseAttempts[0].redo).toBe(true)
    expect(reloaded.caseAttempts[0].attempt).toBe(2)
  })

  it('刷新后：insightState 的 snapshot / content 完整恢复（供行为无变化时保留展示）', () => {
    stubStorage()
    const snap = { sampleCount: 5, primaryKey: 'quickConclusion', errorTop: 'E01', diffAvg: 20, boundaryAvg: 40, counterAvg: 35, unknownUsed: 0, key: 'evidence-before-conclusion' }
    const content = { key: 'evidence-before-conclusion', title: '你可能没发现', headline: 'h', body: 'b', evidence: ['最近 5 次案例'], caseId: 'case-021', caseTitle: 't', evidenceDetail: { cases: [{ caseId: 'case-021', score: 55, over: 25 }] } }
    let s = loadState()
    s = reducer(s, { type: 'ACCEPT_INSIGHT', key: 'evidence-before-conclusion', caseId: 'case-021', done: false, snapshot: snap, content })
    saveState(s)
    const reloaded = loadState()
    expect(reloaded.insightState.snapshot).toEqual(snap)
    expect(reloaded.insightState.content).toEqual(content)
    expect(reloaded.insightState.key).toBe('evidence-before-conclusion')
  })

  it('刷新后：推理指纹可基于恢复的数据重算，且样本足够才 ready', () => {
    stubStorage()
    let s = loadState()
    s = reducer(s, { type: 'COMPLETE_CASE', caseId: 'case-021', result: { total: 55, dimensions: { info: 55, rule: 60, reasoning: 45, counter: 35, over: 25, boundary: 30 }, confidence: 90, actualQuality: 55, errorTypes: ['E01'], usedUnknown: false, attempt: 1, redo: false } })
    s = reducer(s, { type: 'COMPLETE_CASE', caseId: 'case-022', result: { total: 60, dimensions: { info: 60, rule: 60, reasoning: 50, counter: 40, over: 30, boundary: 40 }, confidence: 85, actualQuality: 60, errorTypes: ['E01'], usedUnknown: false, attempt: 1, redo: false } })
    s = reducer(s, { type: 'COMPLETE_CASE', caseId: 'case-023', result: { total: 58, dimensions: { info: 55, rule: 60, reasoning: 45, counter: 35, over: 28, boundary: 32 }, confidence: 88, actualQuality: 58, errorTypes: ['E01'], usedUnknown: false, attempt: 1, redo: false } })
    saveState(s)
    const reloaded = loadState()
    const fp = reasoningFingerprint(reloaded)
    expect(fp.ready).toBe(true)
    expect(fp.sampleCount).toBe(3)
    expect(fp.primaryPattern.key).toBe('quickConclusion')
  })
})
