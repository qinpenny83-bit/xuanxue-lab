// ============================================================
// R3 Phase 2 · Evidence-first 推荐引擎
//
// 只读 getLearningState()，从 recommendationSignals 产出
// 可追溯（Evidence ID / Error / Mastery / ExperimentResult）的具体行为推荐。
// 不做「万能 AI 老师」：每个推荐都挂在真实数据上。
// ============================================================

import { getLearningState } from './unifiedLearningState'
import { EXPERIMENTS_V3 } from '../data/experiments-v3'

function experimentForCategories(categories) {
  return EXPERIMENTS_V3.find((e) => categories.includes(e.category)) || null
}

// 优先级：干预先行，正面确认靠后
const CATALOG = [
  { code: 'WEAK_EVIDENCE', priority: 10, categories: ['evidence'], headline: '你最近几次解释都很快形成结论，但没有主动补充依据。', body: '下一步做一次「证据审查实验」，逼自己给结论找至少一条直接证据。' },
  { code: 'NO_COUNTEREXAMPLE', priority: 9, categories: ['evidence'], headline: '你很少主动寻找反例，判断容易变成单向印证。', body: '做一次「反例」实验，在给结论前先逼自己写下一条可能推翻它的证据。' },
  { code: 'LOW_UNCERTAINTY', priority: 8, categories: ['cognitive'], headline: '你的表达里出现了绝对化措辞，却几乎没有记录「不确定之处」。', body: '做一次「什么时候该说我不知道」实验，练习判断边界。' },
  { code: 'REPEATED_ERROR', priority: 7, categories: ['evidence', 'cognitive'], headline: '你在重复出现同一类错误模式。', body: '回到对应错误类型，做一次针对性实验，纠正这个反复出现的坑。' },
  { code: 'REPEATED_BELIEF', priority: 6, categories: ['evidence', 'cognitive'], headline: '你反复解释同一对象，但从没回头修正过自己的观点。', body: '回到该对象，主动找一个反例，再修正你的解释。' },
  { code: 'BELIEF_REVISION', priority: 5, categories: ['structure', 'text'], headline: '你开始根据证据修改自己的观点——这是重要的成长信号。', body: '挑战更复杂的结构问题（如「中正是否一定吉」）。', positive: true },
  { code: 'TRADITION_GAP', priority: 4, categories: ['tradition'], headline: '你做了不少结构分析，但还没比较过不同解释传统。', body: '做一次「王弼与程颐观察重点是否相同」实验，比较传统路径而非判定对错。' },
  { code: 'UNDERUSED_CLASSIC', priority: 3, categories: ['text'], headline: '你分析了很多卦爻，却很少回到原典文本。', body: '做一次「只看卦辞够不够」实验，检验文本证据的边界。' },
  { code: 'READY_FOR_INDEPENDENCE', priority: 2, categories: ['structure', 'evidence'], headline: '你的独立分析能力已经足够，可以进入开放式实验。', body: '选一个开放实验，独立走完整十步。', positive: true },
]

export function recommendByEvidence(state, opts = {}) {
  const ls = getLearningState(state, opts)
  const signals = ls.recommendationSignals || {}
  const items = []
  for (const c of CATALOG) {
    const sig = signals[c.code]
    if (!sig || !sig.active) continue
    const exp = experimentForCategories(c.categories)
    items.push({
      reasonCode: c.code,
      headline: c.headline,
      body: c.body,
      positive: !!c.positive,
      meta: sig.meta || {},
      trace: sig.trace || {},
      experiment: exp ? { id: exp.id, title: exp.title, category: exp.category } : null,
    })
  }
  items.sort((a, b) => {
    const pa = CATALOG.find((c) => c.code === a.reasonCode)?.priority ?? 0
    const pb = CATALOG.find((c) => c.code === b.reasonCode)?.priority ?? 0
    return pb - pa // 干预型（高 priority）排在前面
  })
  return {
    source: 'evidence',
    evidenceCount: ls.behavior.totalActions,
    items,
    primary: items[0] || null,
  }
}