// ============================================================
// R3 Phase 2 · 开放文本的结构化语义信号（TextSignals）
//
// 严格确定性：只做「关键词/字面模式」检测，绝不声称理解了语义。
// 用途：辅助判断用户是否覆盖了关键分析维度
//       （位置 / 关系 / 文本 / 证据 / 反例 / 不确定性），
//       或是否存在绝对化表达。不是「判对错」，更不做 AI 评分。
// ============================================================

import { HEXAGRAMS } from '../data/iching/hexagrams-data'
import { ALL_TERMS } from '../data/iching/termData'

// 爻位行名（初/二/三/四/五/上 × 九/六）
const YAO_LINE_RE = /(初九|九二|六二|九三|六三|九四|六四|九五|六五|上九|上六)/g

const POSITION_WORDS = [
  '爻位', '位置', '得位', '失位', '当位', '不当位', '中正', '得中', '中位',
  '居中', '居上', '居下', '上位', '下位', '上卦', '下卦', '内卦', '外卦',
  '阳位', '阴位',
]

const RELATION_WORDS = [
  '相应', '对应', '有应', '无应', '敌应', '呼应', '遥应', '相感',
  '相比', '相承', '相乘', '相邻', '比邻', '相凌', '相斥', '关系',
]

const TEXT_WORDS = [
  '卦辞', '爻辞', '大象', '彖传', '象传', '系辞', '系辞传', '文言', '文言传',
  '原文', '经文', '本义', '经传', '传文', '卦名', '爻名',
]

const EVIDENCE_WORDS = [
  '证据', '依据', '根据', '支持', '证明', '印证', '材料', '样本', '引用', '出自', '说明', '佐证',
]

const COUNTER_WORDS = [
  '反例', '反对', '推翻', '反驳', '不支持', '相反', '例外', '但也有', '除非', '矛盾', '反证',
]

const UNCERTAINTY_WORDS = [
  '不确定', '可能', '或许', '也许', '不一定', '未必', '无法判断', '难以', '存疑',
  '待定', '取决于', '有保留', '条件', '暂', '尚', '恐',
]

export const ABSOLUTE_WORDS = [
  '一定', '必然', '肯定', '永远', '绝对', '注定', '势必', '必定', '毫无疑问', '百分之百', '全都', '从来', '总是',
]

// 主动修正语境标记：出现这些词时，文本是在否定/修正自己过去的判断，
// 其中的「绝对化措辞」描述的是「过去的过度自信」，不算当下的绝对化主张。
const SELF_CORRECTION_MARKERS = [
  '太绝对', '太肯定', '太武断', '过于绝对', '过度绝对',
  '我原来', '我之前', '我以前', '我起初', '原来我', '之前我',
  '现在认为', '现在觉得', '现在看', '改为', '修正为', '改成',
]

// 区分三类语义信号（确定性规则，无 NLP）：
//   ABSOLUTE_CLAIM  绝对化主张（当下的过度自信）
//   SELF_CORRECTION 主动修正（承认过去的判断过度自信）
//   UNCERTAINTY_ACKNOWLEDGEMENT 不确定性承认（由 mentionsUncertainty 表达）
export const SIGNAL_TYPES = {
  ABSOLUTE_CLAIM: 'ABSOLUTE_CLAIM',
  SELF_CORRECTION: 'SELF_CORRECTION',
  UNCERTAINTY_ACKNOWLEDGEMENT: 'UNCERTAINTY_ACKNOWLEDGEMENT',
}

// 区分「绝对化主张」与「主动修正」：修正语境的绝对词不算绝对化主张。
export function classifyAbsolutes(text) {
  const s = String(text || '')
  const selfCorrection = SELF_CORRECTION_MARKERS.some((m) => s.includes(m))
  const absoluteClaims = selfCorrection ? 0 : countHits(s, ABSOLUTE_WORDS)
  return {
    absoluteClaims,
    selfCorrection,
    selfCorrectionMarkers: SELF_CORRECTION_MARKERS.filter((m) => s.includes(m)),
    signalType: selfCorrection
      ? SIGNAL_TYPES.SELF_CORRECTION
      : absoluteClaims > 0
        ? SIGNAL_TYPES.ABSOLUTE_CLAIM
        : null,
  }
}

function countHits(text, words) {
  let n = 0
  for (const w of words) if (text.includes(w)) n += 1
  return n
}

function detectEntities(text) {
  const hexagrams = []
  const hexNames = new Set(HEXAGRAMS.map((h) => h.name))
  for (const name of hexNames) {
    if (text.includes(`${name}卦`) && !hexagrams.includes(name)) hexagrams.push(name)
  }
  const yaos = new Set()
  const m = text.match(YAO_LINE_RE)
  if (m) m.forEach((y) => yaos.add(y))
  const terms = []
  const termNames = new Map()
  for (const t of ALL_TERMS) {
    const name = t.term
    if (name && name.length >= 2 && !termNames.has(name)) termNames.set(name, t)
  }
  for (const [name] of termNames) {
    if (text.includes(name) && !terms.includes(name)) terms.push(name)
  }
  return { hexagrams, yaos: [...yaos], terms }
}

// 主入口：对一段开放文本做确定性结构分析（不判对错）
export function analyzeSignals(text = '') {
  const s = String(text || '')
  const yaos = (s.match(YAO_LINE_RE) || []).length
  const abs = classifyAbsolutes(s)
  return {
    length: s.length,
    mentionsPosition: countHits(s, POSITION_WORDS) > 0 || yaos > 0,
    positionHits: countHits(s, POSITION_WORDS) + yaos,
    mentionsRelation: countHits(s, RELATION_WORDS) > 0,
    mentionsText: countHits(s, TEXT_WORDS) > 0,
    mentionsEvidence: countHits(s, EVIDENCE_WORDS) > 0,
    mentionsCounterexample: countHits(s, COUNTER_WORDS) > 0,
    mentionsUncertainty: countHits(s, UNCERTAINTY_WORDS) > 0,
    absoluteLanguage: ABSOLUTE_WORDS.filter((w) => s.includes(w)),
    absoluteHits: countHits(s, ABSOLUTE_WORDS),
    absoluteClaims: abs.absoluteClaims,
    selfCorrection: abs.selfCorrection,
    selfCorrectionMarkers: abs.selfCorrectionMarkers,
    signalType: abs.signalType,
    referencedEntities: detectEntities(s),
  }
}

export default analyzeSignals