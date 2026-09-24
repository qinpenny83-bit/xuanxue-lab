// ============================================================
// Agent 洞察引擎（V1.6.1）——「你可能没发现」。
// 行为变化驱动刷新：完成案例 → 重算画像 → 与上次快照比较 →
// 显著变化才更新洞察；无变化保留原洞察。
// 严禁伪洞察：样本不足不生成、每条洞察必须带真实行为证据。
// 所有数字均来自 state 数据（deterministic，无随机文案）。
// ============================================================

import { CASES } from '../data/cases'
import { buildInsightSnapshot, shouldRefreshInsight } from './agentInsightSnapshot'

export { buildInsightSnapshot, shouldRefreshInsight }

function pickCase(state, tags) {
  const done = state.completedCases || {}
  const pool = CASES.filter((c) => tags.includes(c.trainingTag) && !done[c.id])
  return pool[0] || null
}

// 从 caseAttempts 提取「过早确定方向」的证据：
// 早期步骤就选了确定结论，且后面没有反例修正，或证据维度偏低
function earlyConclusionStats(state) {
  const attempts = (state.caseAttempts || []).slice(-8)
  if (!attempts.length) return null
  let early = 0
  let weakEvidence = 0
  attempts.forEach((a) => {
    const over = a.dimensions?.over ?? 50
    const info = a.dimensions?.info ?? 50
    if (over < 60) early += 1
    if (info < 55 || over < 50) weakEvidence += 1
  })
  return { total: attempts.length, early, weakEvidence }
}

// 每条洞察都要带「真实行为来源」：具体哪几次案例让 Agent 得出这个结论
function evidenceDetail(attempts) {
  return {
    cases: attempts.slice(-5).map((a) => ({
      caseId: a.caseId,
      score: a.score,
      errorTypes: a.errorTypes || [],
      over: a.dimensions?.over ?? null,
      info: a.dimensions?.info ?? null,
      boundary: a.dimensions?.boundary ?? null,
      confidence: a.confidence ?? null,
      usedUnknown: a.usedUnknown,
      unknownReason: a.unknownReason || null,
    })),
  }
}

// 候选洞察（只有行为依据足够时才产生；否则返回 null）
function buildCandidate(state, fingerprint) {
  const attempts = (state.caseAttempts || []).slice(-8)
  const err = state.errorPatterns || {}
  const ev = fingerprint?.evidence
  const diff = ev?.diffAvg ?? 0
  const early = earlyConclusionStats(state)

  // 洞察 1：证据还没够，就开始解释（快速下结论 / 观察型最常见的坑）
  if (early && early.early >= 2 && early.early >= Math.ceil(early.total * 0.5) && (err.E01 || 0) >= 2) {
    const cs = pickCase(state, ['evidence', 'insufficient', 'mislead'])
    if (cs) {
      return {
        key: 'evidence-before-conclusion',
        title: '你可能没发现',
        headline: '证据还没够，就开始解释。',
        body: `最近 ${early.total} 次案例里，你有 ${early.early} 次很早就确定了方向。但其中 ${early.weakEvidence} 次，真正支持这个结论的证据其实很单薄。这说明你最近最大的训练点可能不是「不会判断」，而是「证据还没够，就开始解释」。`,
        evidence: [
          `最近 ${early.total} 次案例`,
          `${early.early} 次过早确定方向`,
          `${early.weakEvidence} 次支持证据单薄`,
        ],
        caseId: cs.id,
        caseTitle: cs.title,
        evidenceDetail: evidenceDetail(attempts),
      }
    }
  }

  // 洞察 2：90% 的判断，真的值得这么确定吗？（过度自信）
  if (diff >= 20) {
    const cs = pickCase(state, ['calibration', 'mislead'])
    if (cs) {
      return {
        key: 'overconfidence',
        title: '你可能没发现',
        headline: '你的信心，跑在了证据前面。',
        body: `最近你的信心平均比实际判断质量高 ${diff} 分。这不是「不够准」，而是一个信号：你给结论的把握，超过了证据能支撑的程度。`,
        evidence: [`信心平均 ${ev?.confAvg ?? '—'}`, `实际判断质量平均低 ${diff} 分`],
        caseId: cs.id,
        caseTitle: cs.title,
        evidenceDetail: evidenceDetail(attempts),
      }
    }
  }

  // 洞察 3：你其实已经会了，只是不够相信自己（信心不足）
  if (diff <= -20) {
    const cs = pickCase(state, ['judgment', 'insufficient'])
    if (cs) {
      return {
        key: 'underconfidence',
        title: '你可能没发现',
        headline: '你其实已经会了，只是不够相信自己。',
        body: `你的实际判断质量平均比信心高 ${-diff} 分。你不是不会判断，而是把「不确定」当成了习惯。下一题，试着相信你已经看到的证据。`,
        evidence: [`实际判断质量平均高 ${-diff} 分`, `信心偏低`],
        caseId: cs.id,
        caseTitle: cs.title,
        evidenceDetail: evidenceDetail(attempts),
      }
    }
  }

  // 洞察 4：你只看到了支持你的那半边（E07）
  if ((err.E07 || 0) >= 2) {
    const cs = pickCase(state, ['counter', 'conflict'])
    if (cs) {
      return {
        key: 'confirmation-bias',
        title: '你可能没发现',
        headline: '你只看到了支持你的那半边。',
        body: `最近你的判断里有 ${err.E07} 次出现「只寻找支持自己的证据」。真正成熟的判断，会主动给反对意见留一个位置。`,
        evidence: [`E07 出现 ${err.E07} 次`, '缺少主动反证'],
        caseId: cs.id,
        caseTitle: cs.title,
        evidenceDetail: evidenceDetail(attempts),
      }
    }
  }

  // 洞察 5：你已经知道什么时候该说「不确定」（正面确认）
  if (ev && (ev.boundaryAvg ?? 0) >= 70) {
    return {
      key: 'boundary-aware',
      title: '你可能没发现',
      headline: '你已经开始知道「什么时候不该下结论」。',
      body: `你的判断边界意识约 ${ev.boundaryAvg} 分——在证据不足时，你学会了停下来。这是大多数学习者最晚获得的能力之一。`,
      evidence: [`判断边界约 ${ev.boundaryAvg} 分`, '证据不足时选择不判断'],
      caseId: null,
      caseTitle: null,
      evidenceDetail: evidenceDetail(attempts),
    }
  }

  return null
}

// 主入口：样本不足不编造；行为无显著变化保留原洞察；行为变化才换新洞察
export function agentInsight(state, fingerprint) {
  const attempts = (state.caseAttempts || []).slice(-8)
  if (attempts.length < 2) return null // 无足够数据 → 不编造洞察

  const candidate = buildCandidate(state, fingerprint)
  if (!candidate) return null

  const snapshot = buildInsightSnapshot(state, fingerprint, candidate.key)
  const prev = state.insightState
  if (prev?.snapshot && !shouldRefreshInsight(prev.snapshot, snapshot)) {
    // 行为没显著变化 → 保留原洞察（已完成的不再打扰，未完成的继续展示）
    if (prev.done) return null
    if (prev.content) return { ...prev.content, snapshot: prev.snapshot }
    return null
  }

  return { ...candidate, snapshot }
}
