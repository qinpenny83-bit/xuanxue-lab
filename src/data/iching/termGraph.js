// ============================================================
// ☯️ 术语知识连接层（R2-2）· termGraph
//
// 把「术语」从孤立词条接进整个知识网络：
//   术语 → 概念 → 原典 → 卦 → 爻 → 十翼 → 解释传统 → 案例 → 练习 → 掌握度
//   并且每一跳都可反查（卦→术语、爻→术语、原典→术语、案例→术语…）。
//
// 原则（deterministic，绝不批量制造 / 绝不让 LLM 判断结构）：
//   1. 结构型术语（中/正/得位/失位/承/乘/比/应/相应/敌应）的「相关爻/卦」
//      全部由 hexagramProfile 的 analyzeYao 结果推导（y.dewei / y.zhong / …），
//      不手写一套独立的「得位数据库」。
//   2. 术语→案例 / 案例→术语 通过「课程节点 id」确定性匹配真实案例，
//      复用 caseGraph 已有的 ICHING_CASES，不新建案例系统。
//   3. 原典/传统/十翼一律走 id 引用（classicPassageIds / tradition node / 十翼 node），
//      一份知识只存一份。
// ============================================================

import { ALL_TERMS, getTerm, TERM_BY_ID } from './termData'
import {
  ALL_YAO,
  YAO_BY_ID,
  getHexagramProfile,
  TRADITION_REF,
  TEN_WINGS_REF,
} from './hexagramProfile'
import { getClassicPassage } from './classic-passages'
import { ICHING_CASES } from './caseGraph'

// ── 结构型术语 → 爻位结构引擎谓词（一处定义，处处同源）──────────────
// 用已算好的单爻字段（dewei/zhong/ying/bi/cheng/ling…）做判断，
// 与「卦档 / 单爻页面」展示的结构保持严格一致。
export const STRUCTURAL_YAO_TEST = {
  zhong: (y) => y.zhong === true,
  zheng: (y) => y.dewei === true, // 正 = 当位/得位
  dewei: (y) => y.dewei === true,
  shiwei: (y) => y.dewei === false,
  zhongzheng: (y) => y.zhongzheng === true,
  cheng: (y) => !!y.cheng,
  sheng: (y) => !!y.ling,
  bi: (y) => Array.isArray(y.bi) && y.bi.length > 0,
  ying: (y) => !!y.ying,
  xiangying: (y) => !!y.ying && y.ying.favorable === true,
  diying: (y) => !!y.ying && y.ying.favorable === false,
}

export function isStructuralTerm(termId) {
  return Object.prototype.hasOwnProperty.call(STRUCTURAL_YAO_TEST, termId)
}

// ── 经典文本型术语的「结构覆盖」（确定性展开，不手写 64/384 条）──────
// 卦辞 / 彖传 / 大象 / 序卦 / 杂卦 → 每卦都有；爻辞 / 小象 → 每爻都有；
// 文言 → 仅乾坤。用于术语→卦/爻的反向检索，遵循「一份知识、规则生成」。
const ALL_HEX_SEQS = ALL_YAO.reduce((s, y) => s.add(y.hexagramId), new Set())
const ALL_YAO_IDS = ALL_YAO.map((y) => y.id)
const CLASSIC_TERM_SCOPE = {
  guaci: { hex: 'all' },
  yaoci: { yao: 'all' },
  jingwen: { hex: 'all', yao: 'all' },
  tuanzhuan: { hex: 'all' },
  xiangzhuan: { hex: 'all', yao: 'all' },
  daxiang: { hex: 'all' },
  xiaoxiang: { yao: 'all' },
  xugua: { hex: 'all' },
  zagua: { hex: 'all' },
  wenyan: { hex: [1, 2] },
}

function termMatchesYao(term, yao) {
  const test = STRUCTURAL_YAO_TEST[term.id]
  if (test) return yao ? test(yao) : false
  const scope = CLASSIC_TERM_SCOPE[term.id]
  if (scope) {
    if (scope.yao === 'all') return true
    return (term.yaoIds || []).includes(yao && yao.id)
  }
  return (term.yaoIds || []).includes(yao && yao.id)
}

function termMatchesHexagram(term, seq) {
  const test = STRUCTURAL_YAO_TEST[term.id]
  if (test) return ALL_YAO.some((y) => y.hexagramId === seq && test(y))
  const scope = CLASSIC_TERM_SCOPE[term.id]
  if (scope) {
    if (scope.hex === 'all') return true
    if (Array.isArray(scope.hex)) return scope.hex.includes(seq)
    return (term.hexagramIds || []).includes(seq)
  }
  return (term.hexagramIds || []).includes(seq)
}

// ── 前向：术语 → 爻 / 卦（结构术语走引擎，其余走 term.yaoIds/hexagramIds）──
export function yaoIdsForTerm(termId) {
  const term = getTerm(termId)
  if (!term) return []
  const test = STRUCTURAL_YAO_TEST[termId]
  if (test) return ALL_YAO.filter(test).map((y) => y.id)
  const scope = CLASSIC_TERM_SCOPE[termId]
  if (scope) {
    if (scope.yao === 'all') return [...ALL_YAO_IDS]
    return term.yaoIds || []
  }
  return term.yaoIds || []
}

export function hexagramIdsForTerm(termId) {
  const term = getTerm(termId)
  if (!term) return []
  const seqs = new Set(term.hexagramIds || [])
  const test = STRUCTURAL_YAO_TEST[termId]
  if (test) {
    for (const y of ALL_YAO) if (test(y)) seqs.add(y.hexagramId)
  }
  const scope = CLASSIC_TERM_SCOPE[termId]
  if (scope) {
    if (scope.hex === 'all') return [...ALL_HEX_SEQS].sort((a, b) => a - b)
    if (Array.isArray(scope.hex)) return scope.hex
    return [...seqs]
  }
  return [...seqs]
}

// 前向「已解析」对象：供术语页直接渲染与跳转
export function hexagramsForTerm(termId) {
  return hexagramIdsForTerm(termId)
    .map((seq) => {
      const p = getHexagramProfile(seq)
      return p
        ? { seq: p.number, name: p.name, traditionalName: p.traditionalName, pinyin: p.pinyin, symbol: p.symbol }
        : null
    })
    .filter(Boolean)
}

function summarizeYao(y) {
  if (!y) return null
  return {
    id: y.id,
    hexagramId: y.hexagramId,
    hexagramName: y.hexagramName,
    name: y.name,
    yang: y.yang,
    dewei: y.dewei,
    deweiLabel: y.deweiLabel,
    positionLabel: y.positionLabel,
  }
}

export function yaosForTerm(termId) {
  return yaoIdsForTerm(termId).map((yid) => summarizeYao(YAO_BY_ID[yid])).filter(Boolean)
}

// ── 术语 → 原典 / 十翼 / 传统 ─────────────────────────────────
export function classicsForTerm(termId) {
  const term = getTerm(termId)
  if (!term) return []
  return (term.classicPassageIds || []).map((id) => getClassicPassage(id)).filter(Boolean)
}

// 术语的全部课程节点引用（十翼节点 + 传统节点，均为 node id）
function nodeRefs(term) {
  return new Set([...(term.tenWingNodeIds || []), ...(term.traditionIds || [])])
}

export function termsForNode(nodeId) {
  return ALL_TERMS.filter((t) => nodeRefs(t).has(nodeId)).map((t) => t.id)
}

export function tenWingsForTerm(termId) {
  const term = getTerm(termId)
  if (!term) return []
  const refs = new Set(term.tenWingNodeIds || [])
  return Object.values(TEN_WINGS_REF).filter((w) => refs.has(w.node))
}

export function termsForTenWing(nodeId) {
  return ALL_TERMS.filter((t) => (t.tenWingNodeIds || []).includes(nodeId)).map((t) => t.id)
}

export function traditionsForTerm(termId) {
  const term = getTerm(termId)
  if (!term) return []
  const refs = nodeRefs(term)
  return TRADITION_REF.filter((t) => refs.has(t.node))
}

export function termsForTradition(nodeOrKey) {
  const ref = TRADITION_REF.find((t) => t.key === nodeOrKey || t.node === nodeOrKey)
  if (!ref) return []
  return ALL_TERMS.filter((t) => nodeRefs(t).has(ref.node)).map((t) => t.id)
}

// ── 术语 → 案例 / 案例 → 术语（经课程节点确定性匹配）────────────────
const TERM_CATEGORY_NODES = {
  core: ['ic-what', 'ic-zhouyi', 'ht-guaci', 'yg-oppose', 'bg-genesis'],
  structure: ['hx-generation', 'hx-lines', 'hx-upper-lower', 'hx-naming', 'yg-yao', 'yg-position', 'bg-genesis'],
  position: ['yp-overview', 'yp-six', 'yp-dewei', 'yp-zhong', 'yp-cheng', 'yp-sheng', 'yp-bi', 'yp-ying', 'yg-position'],
  relation: ['hc-benbian', 'hc-mutual', 'hc-opposite', 'hc-reverse', 'hc-change', 'ic-bian'],
  classic: ['yz-overview', 'yz-tuan', 'yz-xiang', 'yz-xici', 'yz-wenyan', 'yz-shuogua', 'yz-xugua', 'yz-zagua', 'ic-classics', 'ht-guaci', 'ht-yaoci'],
  thought: ['ic-xiang', 'ic-shu', 'ic-li', 'ic-guan', 'ht-jixiong'],
  method: ['ic-xiang', 'ic-shu', 'ic-li', 'ic-guan', 'hx-network', 'hc-change'],
  tradition: ['yx-overview', 'yx-han', 'yx-xiangshu', 'yx-wangbi', 'yx-tang', 'yx-chengyi', 'yx-zhuxi', 'yx-shaoyong', 'yx-compare'],
}

function matchedCasesForTerm(term) {
  const refs = nodeRefs(term)
  const categoryNodes = TERM_CATEGORY_NODES[term.category] || []
  return ICHING_CASES.filter((c) => {
    const nodes = c.relatedNodes || []
    return nodes.some((n) => refs.has(n)) || categoryNodes.some((n) => nodes.includes(n))
  })
}

export function casesForTerm(termId, { limit = 6 } = {}) {
  const term = getTerm(termId)
  if (!term) return []
  return matchedCasesForTerm(term)
    .slice(0, limit)
    .map((c) => ({
      id: c.id,
      title: c.title,
      levelName: c.levelName,
      trainingTag: c.trainingTag,
      nodeIds: c.relatedNodes || [],
    }))
}

export function termsForCase(caseId) {
  const out = []
  for (const term of ALL_TERMS) {
    if (matchedCasesForTerm(term).some((c) => c.id === caseId)) out.push(term.id)
  }
  return out
}

// ── 反向：知识对象 → 术语 ─────────────────────────────────────
export function termsForYao(yaoId) {
  const yao = YAO_BY_ID[yaoId]
  return ALL_TERMS.filter((t) => termMatchesYao(t, yao)).map((t) => t.id)
}

export function termsForHexagram(seq) {
  return ALL_TERMS.filter((t) => termMatchesHexagram(t, seq)).map((t) => t.id)
}

export function termsForClassic(passageId) {
  return ALL_TERMS.filter((t) => (t.classicPassageIds || []).includes(passageId)).map((t) => t.id)
}

// ── 术语关系网络（相关 / 辨析 / 前驱 / 子节点）────────────────────
// 学习依赖：关键结构术语给「精确前驱链」，其余按「相关术语中层级更早者」推导。
const PREREQ_OVERRIDES = {
  // 中正 → 爻位 → 阴阳 → 正位 → 中
  zhongzheng: ['yaowei', 'yinyang', 'zheng', 'zhong'],
  zhong: ['yaowei', 'erwu', 'wuweis'],
  zheng: ['yaowei', 'yinyang', 'yangyao', 'yinyao'],
  dewei: ['yaowei', 'yinyang'],
  shiwei: ['yaowei', 'yinyang'],
  cheng: ['yaowei', 'yinyang', 'bi'],
  sheng: ['yaowei', 'yinyang', 'bi'],
  bi: ['yaowei', 'yinyang'],
  ying: ['yaowei', 'yinyang', 'bi'],
  xiangying: ['ying', 'yinyang'],
  diying: ['ying', 'yinyang'],
  cuogua: ['gua', 'bagua', 'liuyao'],
  zonggua: ['gua', 'bagua', 'shanggua', 'xiagua'],
  hugua: ['gua', 'liuyao', 'neigua', 'waigua'],
  biangua: ['bengua', 'bianyao'],
  zhigua: ['bengua', 'bianyao'],
}

export function prerequisitesForTerm(termId) {
  const term = getTerm(termId)
  if (!term) return []
  if (PREREQ_OVERRIDES[termId]) return PREREQ_OVERRIDES[termId].filter((id) => TERM_BY_ID[id])
  return (term.relatedTermIds || [])
    .filter((id) => TERM_BY_ID[id] && TERM_BY_ID[id].level < term.level)
    .filter((id) => !(term.contrastTermIds || []).includes(id))
}

export function summarizeTerm(idOrTerm) {
  const t = typeof idOrTerm === 'string' ? TERM_BY_ID[idOrTerm] : idOrTerm
  if (!t) return null
  return {
    id: t.id,
    term: t.term,
    traditionalTerm: t.traditionalTerm,
    pinyin: t.pinyin,
    category: t.category,
    level: t.level,
    shortDefinition: t.shortDefinition,
  }
}

export function termRelations(termId) {
  const term = getTerm(termId)
  if (!term) return null
  const related = (term.relatedTermIds || []).map(summarizeTerm).filter(Boolean)
  const contrasts = (term.contrastTermIds || []).map(summarizeTerm).filter(Boolean)
  const prerequisites = prerequisitesForTerm(termId).map(summarizeTerm).filter(Boolean)
  const children = ALL_TERMS.filter(
    (t) =>
      (t.relatedTermIds || []).includes(termId) || prerequisitesForTerm(t.id).includes(termId)
  ).map(summarizeTerm)
  return { related, contrasts, prerequisites, children }
}

// ── 术语完整网络（术语页一次性取用的「知识连接快照」）──────────────
export function termNetwork(termId) {
  const term = getTerm(termId)
  if (!term) return null
  return {
    term,
    hexagrams: hexagramsForTerm(termId),
    yaos: yaosForTerm(termId),
    classicPassages: classicsForTerm(termId),
    tenWings: tenWingsForTerm(termId),
    traditions: traditionsForTerm(termId),
    cases: casesForTerm(termId),
    relations: termRelations(termId),
    masteryKey: term.masteryKey,
  }
}

// ── 首页 / 推荐用「精选术语」（确定性 curated，非随机）──────────────
export const FEATURED_TERM_IDS = [
  'yinyang', 'gangrou', 'zhong', 'zheng', 'dewei', 'ying', 'bi', 'cheng', 'sheng',
  'guaci', 'yaoci', 'tuanzhuan', 'daxiang', 'xiaoxiang', 'cuogua', 'zonggua', 'hugua',
  'xiangshu', 'yili', 'wangbi', 'zhuxi',
]