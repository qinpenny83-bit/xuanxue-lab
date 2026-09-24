// ============================================================
// ☯️ 案例↔卦/爻 知识连接（R2-1.5）
//
// 把现有案例接入「卦档 / 单爻」：案例不再是一堆孤立条目，而是
//   案例 → 知识点 → 卦 → 爻 → 经典 → 解释传统
// 的一条可反查的连接。
//
// 设计原则（deterministic，绝不批量制造）：
//   · 不为「凑满 384 爻」而虚构案例。某爻没有专属案例，就明确说
//     「暂无专属案例」，并推荐相邻爻 / 同卦 / 结构相似爻 / 经典 / 传统。
//   · 通用类「读卦」案例（解读文本、结构、十翼、解释传统）对每卦都
//     真正相关，因此按「五级案例分级」对每卦确定性归集（按卦序轮换，
//     避免 64 卦永远展示同一批，同时保证每个案例都属于对应层级、可解释）。
// ============================================================

import { CASES } from '../cases'

// ── 课程节点分组（用于把案例 relatedNodes 归到某个学习维度）──────────
const NODE_GROUPS = {
  text: ['ht-guaci', 'ht-yaoci', 'ht-position', 'ht-jixiong', 'ht-guwen', 'ht-boss', 'ic-what', 'ic-zhouyi'],
  structure: [
    'yp-overview', 'yp-six', 'yp-dewei', 'yp-zhong', 'yp-cheng', 'yp-sheng', 'yp-bi', 'yp-ying', 'yp-gangrou', 'yp-boss',
    'hx-generation', 'hx-lines', 'hx-upper-lower', 'hx-naming', 'hx-network', 'hx-lab',
    'yg-yao', 'yg-position', 'yg-change', 'ic-bian',
  ],
  compare: [
    'yz-overview', 'yz-tuan', 'yz-xiang', 'yz-xici', 'yz-wenyan', 'yz-shuogua', 'yz-xugua', 'yz-zagua', 'yz-read', 'yz-boss',
    'yx-overview', 'yx-han', 'yx-xiangshu', 'yx-wangbi', 'yx-tang', 'yx-chengyi', 'yx-zhuxi', 'yx-shaoyong', 'yx-compare', 'yx-boss',
    'ic-classics', 'ic-xiang', 'ic-li', 'ic-shu', 'ic-guan',
    'hc-benbian', 'hc-mutual', 'hc-opposite', 'hc-reverse', 'hc-change', 'hc-misuse', 'hc-boss',
  ],
}

const YAO_STRUCTURE_NODES = [
  'yp-overview', 'yp-six', 'yp-dewei', 'yp-zhong', 'yp-cheng', 'yp-sheng', 'yp-bi', 'yp-ying', 'yp-gangrou', 'yp-boss',
  'yg-yao', 'yg-position', 'ht-yaoci', 'ht-position',
]

// ── 五级案例分级（对应「让卦档可学」的五种深度）────────────────────
export const CASE_LEVELS = {
  1: { level: 1, label: '文本理解', tip: '这条爻辞在文本层面说了什么' },
  2: { level: 2, label: '结构分析', tip: '这个爻为什么处在这个位置' },
  3: { level: 3, label: '解释比较', tip: '不同解释传统对同一文本的不同读法' },
  4: { level: 4, label: '反例', tip: '为什么「这一爻 = 某个固定结论」并不充分' },
  5: { level: 5, label: '综合分析', tip: '卦象 + 爻位 + 原文 + 上下文一起看' },
}

// ── 从现有案例元数据抽取「错误模式」────────────────────────
function collectErrorTypes(c) {
  const found = new Set()
  const scan = (s) => {
    if (typeof s !== 'string') return
    for (const m of s.match(/E\d{2}/g) || []) found.add(m)
  }
  for (const cm of c.commonMistakes || []) scan(cm)
  for (const ch of c.challenges || []) {
    for (const opt of ch.options || []) scan(opt.errorType)
  }
  return [...found]
}

// ── 现有易经案例（category === 'iching'）────────────────────
export const ICHING_CASES = CASES.filter((c) => c.category === 'iching')

const CASE_BY_ID = {}
for (const c of CASES) CASE_BY_ID[c.id] = c

export function getCaseById(id) {
  return CASE_BY_ID[id] || null
}

function intersects(nodes, group) {
  return (nodes || []).some((n) => group.includes(n))
}

function matchLevel(c, seqLevel, nodes) {
  // seqLevel 为五级分级中的 1..5
  if (seqLevel === 1) return intersects(nodes, NODE_GROUPS.text)
  if (seqLevel === 2) return intersects(nodes, NODE_GROUPS.structure)
  if (seqLevel === 3) return intersects(nodes, NODE_GROUPS.compare)
  if (seqLevel === 4) return c.trainingTag === 'counter' || c.trainingTag === 'mislead'
  if (seqLevel === 5) return c.trainingTag === 'synthesis'
  return false
}

// 确定性轮换切片：同一卦每次得到同一批案例，不同卦会轮换到不同代表
function rotate(pool, seq, count) {
  if (pool.length === 0) return []
  const out = []
  for (let k = 0; k < count && k < pool.length; k++) {
    out.push(pool[(seq + k) % pool.length])
  }
  return out
}

function toRef(c, seqLevel) {
  return {
    id: c.id,
    title: c.title,
    caseLevel: seqLevel,
    levelLabel: CASE_LEVELS[seqLevel].label,
    originalLevel: c.level,
    levelName: c.levelName,
    nodeIds: c.relatedNodes || [],
    errorTypes: collectErrorTypes(c),
  }
}

// ── 卦级案例：按五级分级归集（每级最多 2 条，确定性轮换）─────────
export function casesForHexagram(seq, countPerLevel = 2) {
  const result = []
  for (let lv = 1; lv <= 5; lv++) {
    const pool = ICHING_CASES.filter((c) => matchLevel(c, lv, c.relatedNodes || []))
    for (const c of rotate(pool, seq, countPerLevel)) result.push(toRef(c, lv))
  }
  return result
}

// ── 爻级案例：爻位结构案例 + 卦级案例兜底 ───────────────────────
// 返回 { cases, dedicated, suggestions }
export function casesForYao(seq, index) {
  const yaoStructure = ICHING_CASES.filter((c) => intersectYaoNodes(c.relatedNodes || []))
  const hexCases = casesForHexagram(seq, 1)

  const dedicated = yaoStructure.slice(0, 2).map((c) => toRef(c, 2))
  const cases = dedicated.length ? dedicated : hexCases.slice(0, 3)

  const suggestions = {
    adjacent: adjacentYaoSuggestion(seq, index),
    sameHex: `同卦其余爻：查看「${seq}」卦的其它五爻。`,
    structure: '结构相似爻：六爻中「得位 / 得中 / 相应」结构与本爻相反或相同的爻，可互相对照。',
    classic: '相关经典：见本爻的〈大象〉与相关〈系辞〉〈文言〉片段。',
    tradition: '解释传统：比较汉易、王弼、程颐、朱熹对同一爻位的不同取法。',
  }

  return { cases, dedicated: dedicated.length > 0, suggestions }
}

function intersectYaoNodes(nodes) {
  return (nodes || []).some((n) => YAO_STRUCTURE_NODES.includes(n))
}

function adjacentYaoSuggestion(seq, index) {
  const pos = ['初', '二', '三', '四', '五', '上']
  const neighbors = []
  if (index > 0) neighbors.push(`${pos[index - 1]}爻`)
  if (index < 5) neighbors.push(`${pos[index + 1]}爻`)
  return neighbors.length ? `相邻爻：可对照 ${neighbors.join('、')} 的位置与关系。` : '相邻爻：作为端点爻，可与对爻（初↔四 / 二↔五 / 三↔上）对照。'
}

// ── 反查：由案例查它连接的卦 / 爻 / 知识点 / 错误模式 ───────────
export function caseKnowledgeRefs(caseId) {
  const c = CASE_BY_ID[caseId]
  if (!c) return null
  const isIching = c.category === 'iching'
  return {
    id: caseId,
    title: c.title,
    category: c.category,
    knowledgeNodeIds: c.relatedNodes || [],
    errorTypes: collectErrorTypes(c),
    // 易经通用读卦案例对 64 卦均相关；非易经案例不挂卦
    genericHexagram: isIching,
    hexagramIds: [],
  }
}

// 便于测试与 UI：判断某卦是否「有可学案例」
export function hasHexagramCases(seq) {
  return casesForHexagram(seq).length > 0
}