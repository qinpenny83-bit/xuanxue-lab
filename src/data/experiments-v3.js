// ============================================================
// R3 Phase 0 · 实验数据结构 + 第一批 30 个正式实验
//
// 核心：ExperimentProfile 是「提出假设 → 抽取样本 → 观察 → 找证据 →
//       找反例 → 修改结论 → 复盘」的科学实验模型，不是「打卡日记」。
// 样本池 samplePool 直接引用底层知识库（64卦 / 384爻 / 案例 / 经典 / 术语），
// 抽样必须 deterministic（seed 可复现），禁止 Math.random()。
// ============================================================

import { getHexagramProfile, getYao, TRADITION_REF } from './iching/hexagramProfile'
import { getCase, CASES } from './cases'
import { getClassicPassage, CLASSIC_PASSAGES } from './iching/classic-passages'
import { getTerm, termsByCategory } from './iching/termData'
import { EXPERIMENTS_V3_EXTRA } from './experiments-v3-extra'

// ── 分类 ────────────────────────────────────────────────────
export const EXPERIMENT_CATEGORIES = [
  { id: 'structure', label: '结构实验', emoji: '🧱', tip: '检验一个结构判断是否总是成立。' },
  { id: 'text', label: '文本实验', emoji: '📜', tip: '检验文本证据到底够不够用。' },
  { id: 'tradition', label: '解释传统实验', emoji: '🏛️', tip: '比较不同解释传统的观察路径。' },
  { id: 'cognitive', label: '认知实验', emoji: '🧠', tip: '观察自己在解读时被什么带着走。' },
  { id: 'evidence', label: '证据实验', emoji: '🔬', tip: '检验证据与结论之间的关系。' },
]

// 十步实验模板（每个实验共用，第②③⑨步由实验自身 question/hypothesis 填充）
export const TEN_STEP_TEMPLATE = [
  { key: 'question', label: '① 问题', hint: '本实验要回答的那个问题。' },
  { key: 'hypothesis', label: '② 当前假设', hint: '你此刻最相信的那个说法。' },
  { key: 'predict', label: '③ 你认为会怎样', hint: '先写预测，再去看样本。' },
  { key: 'sample', label: '④ 抽取样本', hint: '从真实卦/爻/案例/经典中确定性取样。' },
  { key: 'observe', label: '⑤ 实际观察', hint: '逐条记录你真实看到的结构/文本。' },
  { key: 'evidence', label: '⑥ 支持证据', hint: '哪些样本支持了你的假设。' },
  { key: 'counterexample', label: '⑦ 反例', hint: '哪些样本不支持、甚至推翻了你。' },
  { key: 'revise', label: '⑧ 假设是否需要修改', hint: '诚实判断：原来的说法是不是太绝对。' },
  { key: 'conclusion', label: '⑨ 你的新结论', hint: '写出修正后、带限定的结论。' },
  { key: 'reflect', label: '⑩ 反思', hint: '这次实验，你最容易在哪一步出错。' },
]

// ── 确定性质 seed 抽样工具 ───────────────────────────────────
function hashSeed(str) {
  let h = 2166136261
  const s = String(str)
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

function mulberry32(a) {
  return function () {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function pickDistinct(pool, count, seedStr) {
  const rng = mulberry32(hashSeed(seedStr))
  const idx = Array.from({ length: pool.length }, (_, i) => i)
  for (let i = idx.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[idx[i], idx[j]] = [idx[j], idx[i]]
  }
  return idx.slice(0, Math.min(count, pool.length)).map((i) => pool[i])
}

function yaoDescriptor(seq, pos) {
  return { type: 'yao', seq, pos, id: `${seq}-${pos}` }
}

function hexagramDescriptor(seq) {
  return { type: 'hexagram', seq, id: String(seq) }
}

function resolveDescriptor(d) {
  if (d.type === 'hexagram') {
    const p = getHexagramProfile(d.seq)
    return p ? { type: 'hexagram', id: String(d.seq), seq: d.seq, name: p.name, ref: p } : null
  }
  if (d.type === 'yao') {
    const y = getYao(d.seq, d.pos)
    return y ? { type: 'yao', id: `${d.seq}-${d.pos}`, seq: d.seq, pos: d.pos, label: `${getHexagramProfile(d.seq)?.name || d.seq}·${y.positionLabel}`, ref: y } : null
  }
  if (d.type === 'case') {
    const c = getCase(d.id)
    return c ? { type: 'case', id: d.id, title: c.title, ref: c } : null
  }
  if (d.type === 'classic') {
    const p = getClassicPassage(d.id)
    return p ? { type: 'classic', id: d.id, title: p.chapter, ref: p } : null
  }
  if (d.type === 'term') {
    const t = getTerm(d.id)
    return t ? { type: 'term', id: d.id, title: t.term, ref: t } : null
  }
  if (d.type === 'tradition') {
    const t = TRADITION_REF.find((x) => x.key === d.id)
    return t ? { type: 'tradition', id: d.id, title: t.label, ref: t } : null
  }
  return null
}

function buildPool(samplePool) {
  const kind = samplePool?.kind || 'hexagram'
  if (Array.isArray(samplePool?.ids) && samplePool.ids.length) {
    return samplePool.ids.map((id) => {
      if (kind === 'hexagram') return hexagramDescriptor(id)
      if (kind === 'yao' && id && id.seq != null) return yaoDescriptor(id.seq, id.pos)
      return { type: kind, id }
    })
  }
  if (kind === 'hexagram') {
    return Array.from({ length: 64 }, (_, i) => hexagramDescriptor(i + 1))
  }
  if (kind === 'yao') {
    const out = []
    for (let seq = 1; seq <= 64; seq++) {
      for (let pos = 0; pos <= 5; pos++) out.push(yaoDescriptor(seq, pos))
    }
    return out
  }
  if (kind === 'case') {
    const cats = samplePool.categories
    const list = cats ? CASES.filter((c) => cats.includes(c.category)) : CASES
    return list.map((c) => ({ type: 'case', id: c.id }))
  }
  if (kind === 'classic') {
    return CLASSIC_PASSAGES.map((p) => ({ type: 'classic', id: p.id }))
  }
  if (kind === 'term') {
    const pool = samplePool.category ? termsByCategory(samplePool.category) : []
    return (pool || []).map((t) => ({ type: 'term', id: t.id }))
  }
  if (kind === 'tradition') {
    return TRADITION_REF.map((t) => ({ type: 'tradition', id: t.key }))
  }
  return []
}

// 确定性抽样：seed 可复现，返回已解析到现有实体的样本描述。
export function sampleExperiment(experiment, opts = {}) {
  const count = opts.count ?? 5
  const seed = opts.seed ?? experiment.seed ?? experiment.id
  const pool = buildPool(experiment.samplePool)
  const descriptors = experiment.samplePool?.ids?.length
    ? pool
    : pickDistinct(pool, count, seed)
  return descriptors.map(resolveDescriptor).filter(Boolean)
}

// ── 数据模型工厂 ─────────────────────────────────────────────
// 能力键规范化：四板块共用 8 维能力词汇表（masteryEngine 唯一权威键）：
//   observation / structure / evidence / reasoning / counterexample /
//   uncertainty / synthesis / independence
// 描述性标签统一映射，禁止出现游离自定义键（保证知识覆盖审计可收敛）。
const SKILL_ALIAS = {
  text: 'evidence', // 文本分析 → 证据意识
  compare: 'synthesis', // 比较 → 综合分析
  revise: 'reasoning', // 修正假设 → 推理
  tradition: 'synthesis', // 比较传统 → 综合分析
  reflection: 'uncertainty', // 反思 → 不确定性认知
}
function normalizeSkills(list) {
  return [...new Set((list || []).map((k) => SKILL_ALIAS[k] || k))]
}
let __seq = 0
function E(exp) {
  __seq += 1
  return {
    difficulty: 2,
    level: 2,
    samplingMethod: 'deterministic-sample',
    seed: exp.id,
    steps: TEN_STEP_TEMPLATE,
    relatedTerms: [],
    hexagrams: [],
    yaos: [],
    cases: [],
    classics: [],
    traditions: [],
    requiredEvidence: 1,
    counterexampleType: 'counterexample',
    relatedHexagrams: [],
    relatedYaos: [],
    relatedClassics: [],
    relatedTraditions: [],
    reflectionQuestions: [],
    masteryKeys: [],
    errorTypes: [],
    __seq,
    ...exp,
    expectedSkills: normalizeSkills(exp.expectedSkills),
  }
}

// ── 30 个正式实验（第一批，保留）──────────────────────────────
export const EXPERIMENTS_V3_CORE = [
  // ============ A. 结构实验（8） ============
  E({
    id: 'exp-s-dewei', category: 'structure', title: '得位一定好吗？', subtitle: '拆解「当位 = 吉」这个最常见的默认。', emoji: '🎯',
    question: '「得位（当位）」是否足以单独推出吉、或推出好的评价？',
    hypothesis: '大多数得位的爻，评价都偏吉/偏顺。',
    prerequisites: ['得位', '爻位', '中正'],
    samplePool: { kind: 'yao' }, expectedSkills: ['structure', 'counterexample', 'observation'],
    counterexamples: ['找到得位但爻辞偏凶/偏难的爻', '比较同一卦里得位与失位爻的评价'],
    relatedTerms: ['dewei', 'yaowei', 'zhongzheng'], masteryKeys: [], errorTypes: ['E01', 'E03'],
    reflectionQuestions: ['你一开始是否真的默认「得位=好」？', '得位带来的到底是一类什么信息？'],
  }),
  E({
    id: 'exp-s-zhong', category: 'structure', title: '得中一定好吗？', subtitle: '中位（二、五）是否天然优于其它位。', emoji: '⚖️',
    question: '处在「中」位（二、五）的爻，是否总比「不中」更有优势？',
    hypothesis: '越靠中，爻的处境越好。',
    prerequisites: ['爻位', '得位'],
    samplePool: { kind: 'yao' }, expectedSkills: ['structure', 'counterexample'],
    counterexamples: ['找个得中但受冲克、或自身阴阳不利的爻'],
    relatedTerms: ['yaowei', 'zhongzheng'], masteryKeys: [], errorTypes: ['E01', 'E03'],
    reflectionQuestions: ['「中」提供的是位置信息，还是评价信息？', '中位与吉凶之间的关系是必然的吗？'],
  }),
  E({
    id: 'exp-s-zhongzheng', category: 'structure', title: '中正一定意味着吉吗？', subtitle: '得中且得位，是否就是「结构上的最优」。', emoji: '👑',
    question: '「中正」（既得中又得位）是否意味着这一个爻一定是好爻？',
    hypothesis: '中正的爻，基本都能推出积极结论。',
    prerequisites: ['中正', '得位'],
    samplePool: { kind: 'yao' }, expectedSkills: ['structure', 'counterexample', 'uncertainty'],
    counterexamples: ['在中正的爻里找爻辞偏凶的例子'],
    relatedTerms: ['zhongzheng', 'dewei', 'yaowei'], masteryKeys: [], errorTypes: ['E01', 'E07'],
    reflectionQuestions: ['中正 vs 吉，是不是被你悄悄划了等号？'],
  }),
  E({
    id: 'exp-s-yang-pos', category: 'structure', title: '阳爻居阳位一定好吗？', subtitle: '刚居刚位是否总是顺。', emoji: '☀️',
    question: '阳爻落在阳位（初、三、五），是否总是好的？',
    hypothesis: '同类相得（阳居阳位）偏向顺。',
    prerequisites: ['刚柔', '爻位'],
    samplePool: { kind: 'yao' }, expectedSkills: ['structure', 'counterexample'],
    counterexamples: ['阳爻居阳位但被相邻阴爻所「乘」、或有「敌应」的例子'],
    relatedTerms: ['gangrou', 'yaowei', 'dewei'], masteryKeys: [], errorTypes: ['E01', 'E03'],
    reflectionQuestions: ['「得位」与「得中」是否已经混淆为一体？'],
  }),
  E({
    id: 'exp-s-yin-pos', category: 'structure', title: '阴爻居阴位一定好吗？', subtitle: '柔居柔位是否总是顺。', emoji: '🌙',
    question: '阴爻落在阴位（二、四、上），是否总是好的？',
    hypothesis: '同类相得（阴居阴位）偏向顺。',
    prerequisites: ['刚柔', '爻位'],
    samplePool: { kind: 'yao' }, expectedSkills: ['structure', 'counterexample'],
    counterexamples: ['阴爻居阴位但处于「乘」或被强克位置的例子'],
    relatedTerms: ['gangrou', 'yaowei', 'dewei'], masteryKeys: [], errorTypes: ['E01', 'E03'],
    reflectionQuestions: ['你判断「好」时，用的是位置规则还是结果联想？'],
  }),
  E({
    id: 'exp-s-pos5', category: 'structure', title: '五爻位是不是天然特殊？', subtitle: '「九五」的地位是不是结构决定的。', emoji: '🪜',
    question: '五爻位（上的居中）是否在任何卦里都天然特殊、天然重要？',
    hypothesis: '五爻位是卦的核心，总是关键的。',
    prerequisites: ['爻位', '得位'],
    samplePool: { kind: 'yao' }, expectedSkills: ['structure', 'counterexample', 'uncertainty'],
    counterexamples: ['找九五是「闲爻」、或关键在别处的卦'],
    relatedTerms: ['yaowei', 'dewei', 'zhongzheng'], masteryKeys: [], errorTypes: ['E01', 'E06'],
    reflectionQuestions: ['「九五=帝王」是原典结构，还是后世文化联想？'],
  }),
  E({
    id: 'exp-s-ying', category: 'structure', title: '应关系一定意味着吉吗？', subtitle: '阴阳相应是否总是好兆头。', emoji: '🔗',
    question: '「相应」（初↔四、二↔五、三↔上，阴阳相异）是否一定导向吉？',
    hypothesis: '有应比无应好，相应就顺。',
    prerequisites: ['应', '爻位'],
    samplePool: { kind: 'yao' }, expectedSkills: ['structure', 'counterexample'],
    counterexamples: ['找到「相应」却因同气相斥/位不利而凶的例子'],
    relatedTerms: ['ying', 'yaowei'], masteryKeys: [], errorTypes: ['E01', 'E03'],
    reflectionQuestions: ['「应」描述的是一种呼应，还是一种吉凶判定？'],
  }),
  E({
    id: 'exp-s-bi-vs-ying', category: 'structure', title: '比与应到底有什么区别？', subtitle: '相邻与遥应，两种关系不要混。', emoji: '🧭',
    question: '「比」（相邻）与「应」（遥对）带来的是不是同一种信息？',
    hypothesis: '比与应都表示「关系好」，可以互换理解。',
    prerequisites: ['比', '应'],
    samplePool: { kind: 'yao' }, expectedSkills: ['structure', 'compare', 'reasoning'],
    counterexamples: ['一个「比亲」却「敌应」、或相反的例子'],
    relatedTerms: ['bi', 'ying', 'yaowei'], masteryKeys: [], errorTypes: ['E10', 'E03'],
    reflectionQuestions: ['你能用一句话说清「比」与「应」的空间差异吗？'],
  }),

  // ============ B. 文本实验（6） ============
  E({
    id: 'exp-t-name', category: 'text', title: '卦名会不会误导解释？', subtitle: '先入为主的卦名是否绑架判断。', emoji: '🏷️',
    question: '只看卦名去判断一卦，会不会把解释带偏？',
    hypothesis: '卦名只是标签，不会影响结构判断。',
    prerequisites: ['卦名', '卦象'],
    samplePool: { kind: 'hexagram' }, expectedSkills: ['text', 'evidence', 'uncertainty', 'observation'],
    counterexamples: ['卦名与卦辞/爻辞倾向相反的例子'],
    relatedTerms: ['guanming', 'guaxiang', 'guaci'], masteryKeys: [], errorTypes: ['E06', 'E07'],
    reflectionQuestions: ['你第一眼看到卦名时，结论是否已经出来了？'],
  }),
  E({
    id: 'exp-t-guaci-only', category: 'text', title: '只看卦辞够不够？', subtitle: '单文本证据的边界。', emoji: '📜',
    question: '只看卦辞、不看爻辞与结构，能否做出可靠的解释？',
    hypothesis: '卦辞是总纲，够用了。',
    prerequisites: ['卦辞', '爻辞'],
    samplePool: { kind: 'hexagram' }, expectedSkills: ['text', 'evidence', 'reasoning', 'observation'],
    counterexamples: ['卦辞与大部分爻辞指向不同的卦'],
    relatedTerms: ['guaci', 'yaoci'], masteryKeys: [], errorTypes: ['E03', 'E01'],
    reflectionQuestions: ['「总纲」是否能替代「具体爻位」的判断？'],
  }),
  E({
    id: 'exp-t-yaoci-only', category: 'text', title: '只看爻辞够不够？', subtitle: '脱离卦结构的爻辞有多危险。', emoji: '🔍',
    question: '只看某一爻辞、不看它在卦中的位置，能否解释这一爻？',
    hypothesis: '爻辞自带完整含义，能独立解读。',
    prerequisites: ['爻辞', '爻位'],
    samplePool: { kind: 'yao' }, expectedSkills: ['text', 'structure', 'evidence', 'observation'],
    counterexamples: ['同一条爻辞在不同卦/不同位置含义有别的例子'],
    relatedTerms: ['yaoci', 'yaowei'], masteryKeys: [], errorTypes: ['E03', 'E01'],
    reflectionQuestions: ['爻辞到底是「位置说的话」，还是「孤立的一句话」？'],
  }),
  E({
    id: 'exp-t-daxiang', category: 'text', title: '大象会改变你的解释吗？', subtitle: '加入〈大象〉前后的判断差异。', emoji: '🏔️',
    question: '先看卦爻辞做解释，再加入〈大象传〉，结论会不会变？',
    hypothesis: '大象只是补充，不会改变结论方向。',
    prerequisites: ['大象', '象传'],
    samplePool: { kind: 'hexagram' }, expectedSkills: ['text', 'compare', 'revise', 'observation'],
    counterexamples: ['大象给出「德性/人事」面向，而自己不谈人事的例子'],
    relatedTerms: ['daxiang', 'xiangzhuan'], masteryKeys: [], errorTypes: ['E06', 'E03'],
    reflectionQuestions: ['大象教你的是「判断吉凶」，还是「如何自处」？'],
  }),
  E({
    id: 'exp-t-yizhuan', category: 'text', title: '《易传》是否总能解释原文？', subtitle: '传与经之间的解释关系要检验。', emoji: '📖',
    question: '《易传》的解读，是否总能贴合经文的原意？',
    hypothesis: '传就是经的正确注脚，照着读即可。',
    prerequisites: ['彖传', '象传', '系辞传'],
    samplePool: { kind: 'hexagram' }, expectedSkills: ['text', 'compare', 'uncertainty'],
    counterexamples: ['传与经之间理解存在张力、或传引入新框架的例子'],
    relatedTerms: ['tuanzhuan', 'xiangzhuan'], masteryKeys: [], errorTypes: ['E02', 'E06'],
    reflectionQuestions: ['「传」是「经」的唯一解释，还是众多解释之一？'],
  }),
  E({
    id: 'exp-t-modern', category: 'text', title: '现代解释与原典之间差多远？', subtitle: '翻译与联想会在哪一步渗入。', emoji: '🌉',
    question: '你读到的「现代白话解释」，离原文到底隔了几层？',
    hypothesis: '现代白话就是原文的直接翻译，没有额外东西。',
    prerequisites: ['卦辞', '爻辞'],
    samplePool: { kind: 'hexagram' }, expectedSkills: ['text', 'evidence', 'uncertainty'],
    counterexamples: ['白话里带出现代价值观联想、而原文没有对应字词的例子'],
    relatedTerms: ['guaci', 'yaoci'], masteryKeys: [], errorTypes: ['E06', 'E02'],
    reflectionQuestions: ['你能区分「翻译」和「引申」吗？'],
  }),

  // ============ C. 解释传统实验（6） ============
  E({
    id: 'exp-c-wangbi-chengyi', category: 'tradition', title: '王弼与程颐观察重点是否相同？', subtitle: '两种义理路径的差异。', emoji: '🏛️',
    question: '王弼（得意忘象）与程颐（义理入人事）观察同一卦时，重点是否相同？',
    hypothesis: '他们都在讲义理，所以结论差不多。',
    prerequisites: ['王弼', '程颐'],
    samplePool: { kind: 'hexagram' }, traditions: ['wangbi', 'chengyi'], expectedSkills: ['compare', 'tradition', 'reasoning'],
    counterexamples: ['对同一卦，两人取义侧重点不同的例子'],
    relatedTerms: [], masteryKeys: [], errorTypes: ['E02', 'E03'],
    reflectionQuestions: ['一个求「理」，一个求「人事」，这会不会改变推导路径？'],
  }),
  E({
    id: 'exp-c-chengyi-zhuxi', category: 'tradition', title: '程颐与朱熹如何不同？', subtitle: '义理入人与经传分读的分野。', emoji: '🏛️',
    question: '同属理学传统，程颐与朱熹的读法在哪里分岔？',
    hypothesis: '程朱一体，读法没有本质区别。',
    prerequisites: ['程颐', '朱熹'],
    samplePool: { kind: 'hexagram' }, traditions: ['chengyi', 'zhuxi'], expectedSkills: ['compare', 'tradition'],
    counterexamples: ['程颐偏人事、朱熹重本义与经传分读的例子'],
    relatedTerms: [], masteryKeys: [], errorTypes: ['E02', 'E10'],
    reflectionQuestions: ['「本义」这个目标，是朱熹独有的吗？'],
  }),
  E({
    id: 'exp-c-xiangshu-yili', category: 'tradition', title: '象数与义理的观察路径有何不同？', subtitle: '两大传统的起点差异。', emoji: '⚙️',
    question: '象数派与义理派面对同一卦，最先看的东西有什么不同？',
    hypothesis: '他们只是术语不同，看的是同一个东西。',
    prerequisites: ['汉易', '王弼'],
    samplePool: { kind: 'hexagram' }, traditions: ['han', 'wangbi'], expectedSkills: ['compare', 'tradition', 'structure'],
    counterexamples: ['象数先看卦气纳甲、义理先看卦义人事的例子'],
    relatedTerms: [], masteryKeys: [], errorTypes: ['E02', 'E10'],
    reflectionQuestions: ['「看什么」不同，会不会导致「看到什么」也不同？'],
  }),
  E({
    id: 'exp-c-multi', category: 'tradition', title: '同一卦为何能有多种解释？', subtitle: '多解并存是否意味着「没有定解」。', emoji: '🔀',
    question: '同一卦出现多种解释，是因为文本有歧义，还是因为方法不同？',
    hypothesis: '多解并存，说明《周易》本身无法确定。',
    prerequisites: ['卦象', '王弼', '程颐'],
    samplePool: { kind: 'hexagram' }, traditions: ['wangbi', 'chengyi', 'zhuxi'], expectedSkills: ['compare', 'uncertainty'],
    counterexamples: ['同卦多解但都「自洽」的例子'],
    relatedTerms: [], masteryKeys: [], errorTypes: ['E07', 'E06'],
    reflectionQuestions: ['「没有唯一答案」和「没有答案」是一回事吗？'],
  }),
  E({
    id: 'exp-c-evidence', category: 'tradition', title: '不同传统依赖的证据一样吗？', subtitle: '证据类型的差异。', emoji: '🧾',
    question: '不同解释传统在「给证据」时，用的是同一种证据吗？',
    hypothesis: '大家都引原文，证据当然一样。',
    prerequisites: ['汉易', '王弼', '朱熹'],
    samplePool: { kind: 'hexagram' }, traditions: ['han', 'wangbi', 'zhuxi'], expectedSkills: ['evidence', 'compare', 'tradition'],
    counterexamples: ['象数引卦气纳甲、义理引卦义尽心、本义引经传分读的例子'],
    relatedTerms: [], masteryKeys: [], errorTypes: ['E02', 'E03'],
    reflectionQuestions: ['「引原典」和「引框架」是两种证据，你分得清吗？'],
  }),
  E({
    id: 'exp-c-benyi', category: 'tradition', title: '「本义」真的容易确定吗？', subtitle: '回到作者原意有多难。', emoji: '🎯',
    question: '后人常说的「求本义（原意）」，在实践里是否容易做到？',
    hypothesis: '只要认真读原文，就能还原作者本义。',
    prerequisites: ['朱熹', '彖传'],
    samplePool: { kind: 'hexagram' }, traditions: ['zhuxi'], expectedSkills: ['uncertainty', 'evidence', 'reasoning'],
    counterexamples: ['原文本无定指、后人补义的例子'],
    relatedTerms: ['tuanzhuan', 'guaci'], masteryKeys: [], errorTypes: ['E02', 'E06'],
    reflectionQuestions: ['「本义」是一种有证据的目标，还是一种理想假设？'],
  }),

  // ============ D. 认知实验（5） ============
  E({
    id: 'exp-cog-first', category: 'cognitive', title: '第一印象会不会影响解释？', subtitle: '先出现的线索是否权重更大。', emoji: '💭',
    question: '你最先看到的信息，会不会悄悄决定了后面的结论？',
    hypothesis: '只要理性分析，先后顺序影响不大。',
    prerequisites: ['卦名', '卦象'],
    samplePool: { kind: 'hexagram' }, expectedSkills: ['uncertainty', 'reflection'],
    counterexamples: ['改变信息呈现顺序后，判断也跟着变的例子'],
    relatedTerms: ['guanming'], masteryKeys: [], errorTypes: ['E07', 'E06'],
    reflectionQuestions: ['如果换一个顺序看，你的结论还会一样吗？'],
  }),
  E({
    id: 'exp-cog-name', category: 'cognitive', title: '看到卦名后会不会先入为主？', subtitle: '标签效应。', emoji: '🏷️',
    question: '先知道卦名，是否会让你「顺着卦名找证据」？',
    hypothesis: '卦名只是代号，不会带我走。',
    prerequisites: ['卦名'],
    samplePool: { kind: 'hexagram' }, expectedSkills: ['uncertainty', 'counterexample'],
    counterexamples: ['卦名是吉义、但爻辞多凶的卦'],
    relatedTerms: ['guanming', 'guaxiang'], masteryKeys: [], errorTypes: ['E07', 'E06'],
    reflectionQuestions: ['如果这卦不叫这个名字，你还会这样解读吗？'],
  }),
  E({
    id: 'exp-cog-ji', category: 'cognitive', title: '看到「吉」字会不会自动找吉证据？', subtitle: '确认偏误在文本层的表现。', emoji: '🔎',
    question: '看到卦爻辞里的「吉」，你会不会自动去收集「为什么吉」的证据？',
    hypothesis: '吉凶是文本写明的，不存在偏误。',
    prerequisites: ['卦辞', '爻辞'],
    samplePool: { kind: 'yao' }, expectedSkills: ['uncertainty', 'counterexample', 'evidence'],
    counterexamples: ['爻辞标「吉」、但结构处于险位的爻'],
    relatedTerms: ['yaoci', 'guaci'], masteryKeys: [], errorTypes: ['E07', 'E06'],
    reflectionQuestions: ['看到「吉」，你有没有继续追问「凭什么吉」？'],
  }),
  E({
    id: 'exp-cog-xiong', category: 'cognitive', title: '看到「凶」字会不会忽略其他信息？', subtitle: '负面字眼的遮蔽效应。', emoji: '🚧',
    question: '看到「凶」，你是否会忽略该爻仍存在的积极结构信息？',
    hypothesis: '凶就是凶，看别的没用。',
    prerequisites: ['卦辞', '爻辞'],
    samplePool: { kind: 'yao' }, expectedSkills: ['uncertainty', 'structure', 'counterexample'],
    counterexamples: ['爻辞带警告、但结构得位得中、其实是提醒避险的例子'],
    relatedTerms: ['yaoci', 'yaowei'], masteryKeys: [], errorTypes: ['E07', 'E03'],
    reflectionQuestions: ['「凶」是判决，还是提醒你注意条件？'],
  }),
  E({
    id: 'exp-cog-moreinfo', category: 'cognitive', title: '信息增加后解释一定更好吗？', subtitle: '更多信息 ≠ 更准判断。', emoji: '📈',
    question: '加入的信息越多，你的解释是不是就越好？',
    hypothesis: '信息越多，判断越可靠。',
    prerequisites: ['卦象', '爻辞', '大象'],
    samplePool: { kind: 'yao' }, expectedSkills: ['uncertainty', 'reasoning', 'compare'],
    counterexamples: ['信息增加后反而「过度解释」、离原文更远的例子'],
    relatedTerms: ['yaoci', 'daxiang'], masteryKeys: [], errorTypes: ['E06', 'E03'],
    reflectionQuestions: ['哪些信息是「证据」，哪些只是「干扰」？'],
  }),

  // ============ E. 证据实验（5） ============
  E({
    id: 'exp-e-one', category: 'evidence', title: '一条证据够不够？', subtitle: '单点证据的推导风险。', emoji: '🔬',
    question: '只凭一条证据，能不能可靠地推出一个结论？',
    hypothesis: '只要这条证据是真的，结论就成立。',
    prerequisites: ['卦辞', '爻辞'],
    samplePool: { kind: 'yao' }, expectedSkills: ['evidence', 'reasoning', 'counterexample'],
    counterexamples: ['一条「真证据」被其它结构信息推翻的例子'],
    relatedTerms: ['guaci'], masteryKeys: [], errorTypes: ['E01', 'E03'],
    reflectionQuestions: ['「证据为真」和「结论成立」之间还差什么？'],
  }),
  E({
    id: 'exp-e-conflict', category: 'evidence', title: '原典与后世解释冲突时怎么办？', subtitle: '证据冲突的取舍。', emoji: '⚔️',
    question: '当原文与后世解释打架时，你的结论应该偏向谁？',
    hypothesis: '以原文为准，后世解释可以忽略。',
    prerequisites: ['卦辞', '王弼', '程颐'],
    samplePool: { kind: 'hexagram' }, traditions: ['wangbi', 'chengyi'], expectedSkills: ['evidence', 'compare', 'uncertainty'],
    counterexamples: ['后世解释其实「补」出了原文没有的前提的例子'],
    relatedTerms: ['guaci'], masteryKeys: [], errorTypes: ['E02', 'E07'],
    reflectionQuestions: ['「以原文为准」本身是不是也需要论证？'],
  }),
  E({
    id: 'exp-e-counter-rule', category: 'evidence', title: '一个反例能否推翻一个经验？', subtitle: '反例的恰当权重。', emoji: '🔨',
    question: '找到一个反例，是否就足以推翻「某结构通常如此」的经验？',
    hypothesis: '一个反例就能推翻通例。',
    prerequisites: ['得位', '中正'],
    samplePool: { kind: 'yao' }, expectedSkills: ['counterexample', 'reasoning', 'uncertainty'],
    counterexamples: ['反例其实是「条件更复杂」，而非「通例完全错误」的例子'],
    relatedTerms: ['dewei', 'zhongzheng'], masteryKeys: [], errorTypes: ['E01', 'E07'],
    reflectionQuestions: ['反例推翻的是「结论」，还是「结论的绝对性」？'],
  }),
  E({
    id: 'exp-e-structure-vs-text', category: 'evidence', title: '结构证据与文本证据有何区别？', subtitle: '两种证据的贡献不同。', emoji: '🧱',
    question: '「结构证据」（得位/得中/应）与「文本证据」（辞/传）在推论里起的作用一样吗？',
    hypothesis: '都是证据，作用相同。',
    prerequisites: ['得位', '卦辞', '爻辞'],
    samplePool: { kind: 'yao' }, expectedSkills: ['evidence', 'compare', 'structure'],
    counterexamples: ['结构与文本「打架」、结论随证据类型而变的例子'],
    relatedTerms: ['dewei', 'guaci', 'yaoci'], masteryKeys: [], errorTypes: ['E01', 'E03'],
    reflectionQuestions: ['结构证据告诉「位置如何」，文本证据告诉「传统如何说」，你分得开吗？'],
  }),
  E({
    id: 'exp-e-unknown', category: 'evidence', title: '什么时候该说「我不知道」？', subtitle: '判断边界意识。', emoji: '❓',
    question: '什么情况下，最诚实的做法是明确说「我现在还无法确定」？',
    hypothesis: '高手都应该给出确定结论，说不知道是水平不够。',
    prerequisites: ['卦象', '爻位'],
    samplePool: { kind: 'hexagram' }, expectedSkills: ['uncertainty', 'evidence', 'independence'],
    counterexamples: ['信息不足时硬下结论、反而出错的例子'],
    relatedTerms: ['guaxiang', 'yaowei'], masteryKeys: [], errorTypes: ['E06', 'E01'],
    reflectionQuestions: ['「不确定」和「无能」是不是被你等同了？'],
  }),
]

// 第二批扩充实验（30 → 80+，来自 experiments-v3-extra.js）
export const EXPERIMENTS_V3 = [...EXPERIMENTS_V3_CORE, ...EXPERIMENTS_V3_EXTRA]

export const EXPERIMENT_V3_BY_ID = EXPERIMENTS_V3.reduce((acc, e) => {
  acc[e.id] = e
  return acc
}, {})

export function getExperimentV3(id) {
  return EXPERIMENT_V3_BY_ID[id] || null
}

export function experimentsByCategory(categoryId) {
  return EXPERIMENTS_V3.filter((e) => e.category === categoryId)
}