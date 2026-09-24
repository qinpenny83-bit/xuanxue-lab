// ============================================================
// R3 Phase 1 · 易工坊「实战工作台」引擎（纯逻辑，可测试）
//
// 原则（对齐本阶段硬约束）：
//   1. 工作台记录「有意义的学习行为」，不机械打点（点一下 ≠ 一条）。
//   2. 开放式输入只做「确定性规则检查」，绝不伪造「AI 评分 / 深层正确性」。
//   3. Evidence ≠ mastery：本模块只产生事实证据，能力仍由 masteryEngine 计算。
//   4. deterministic：无 Math.random，全部可由 rng/seed 注入复现。
// ============================================================

import { getHexagramProfile, getYaoById, getYao, TRADITION_REF } from '../data/iching/hexagramProfile'
import { getTerm } from '../data/iching/termData'
import {
  CLASSIC_PASSAGES,
  daXiangPassage,
  getClassicPassage,
} from '../data/iching/classic-passages'
import { HEXAGRAMS } from '../data/iching/hexagrams-data'
import { ICHING_CASES, getCaseById } from '../data/iching/caseGraph'
import { TEXT_DECODER_SET } from '../data/iching/playEngine'
import { summarizeEvidence, getRecentEvidence } from './learningEvidence'
import { computeMasteryProfile, MASTERY_DIMENSIONS } from './masteryEngine'
import { topErrors } from './errors'
import { getLesson } from '../data/lessons'

// ── 工作台动作白名单（本阶段整体验收的最小集）─────────────────────
export const WORKSHOP_ACTIONS = [
  'view', 'observe', 'identify', 'analyze', 'compare', 'interpret',
  'construct', 'evidence', 'counterexample', 'revise', 'reflect', 'complete', 'retry',
]

// ── 6 个工作台元数据（每个都有明确任务，不是资料页）──────────────
export const WORKSHOPS = [
  { id: 'hexagram', label: '卦象工作台', tag: '观察结构', goal: '先写下你看到的结构事实，再把「事实」和「解释」分开。' },
  { id: 'yao', label: '爻研究台', tag: '研究爻位与爻辞', goal: '说清：为什么同一卦换一个爻，解释就可能变化？' },
  { id: 'classic', label: '经典解读台', tag: '原文→解释→比较', goal: '自己先解释，再对照传统解释与现代说明，找出自己可能误读的地方。' },
  { id: 'case', label: '案例分析台', tag: '案例→证据→反例→结论', goal: '先观察，再选卦/爻，引用证据，检查反例，最后给结论并说明把握。' },
  { id: 'explain', label: '解释构建台', tag: '提出并修正解释', goal: '完整走一遍：观察 → 解释 → 依据 → 反例 → 不确定 → 提交 → 反思 → 修正。' },
  { id: 'free', label: '自由研究台', tag: '跨对象自由探索', goal: '从任意对象出发，建立自己的研究路径，每步留痕。' },
]

// ── 统一打点 helper（JSX 中经 useApp().dispatch 注入）────────────
export function recordWorkshop(dispatch, partial = {}) {
  dispatch({ type: 'RECORD_EVIDENCE', evidence: { source: 'workshop', ...partial } })
}

// ── 经典条目：19 系辞/文言 + 64 大象 + 12 卦辞精读 = 统一阅读材料 ──
function normalizeClassic() {
  const passages = CLASSIC_PASSAGES.map((p) => ({
    id: p.id,
    kind: 'passage',
    source: p.source,
    chapter: p.chapter || '',
    original: p.text,
    traditionalNote: p.tradition || null,
    modernNote: p.modernNote || '',
    wrongMeanings: [],
    relatedHexagrams: p.relatedHexagrams || [],
    relatedYaos: p.relatedYaos || [],
    relatedTerms: p.relatedTerms || [],
  }))
  const daxiang = HEXAGRAMS.map((h) => daXiangPassage(h.seq)).filter(Boolean).map((p) => ({
    id: p.id,
    kind: 'daxiang',
    source: p.source,
    chapter: p.chapter,
    original: p.text,
    traditionalNote: null,
    modernNote: p.modernNote || '',
    wrongMeanings: [],
    relatedHexagrams: p.relatedHexagrams || [],
    relatedYaos: [],
    relatedTerms: ['大象', '卦象'],
  }))
  const guaci = TEXT_DECODER_SET.map((d) => ({
    id: `gc-${d.id}`,
    kind: 'guaci',
    source: '卦辞',
    chapter: `${d.name}卦·卦辞`,
    original: d.guaci,
    traditionalNote: d.meaning,
    modernNote: d.multiNote || '',
    wrongMeanings: d.wrongMeanings || [],
    relatedHexagrams: [],
    relatedYaos: [],
    relatedTerms: d.keyTokens || [],
  }))
  return [...passages, ...daxiang, ...guaci]
}

// 统一 95 条经典阅读材料（83 经典片段 + 12 卦辞精读）
export const CLASSIC_ENTRIES = normalizeClassic()

export const CLASSIC_BY_ID = CLASSIC_ENTRIES.reduce((acc, c) => {
  acc[c.id] = c
  return acc
}, {})

// 供测试 / 报告使用的规范计数（19 静态 + 64 大象 = 83）
export const CANONICAL_CLASSIC_COUNT = CLASSIC_PASSAGES.length + HEXAGRAMS.length

export function getClassicEntry(id) {
  return CLASSIC_BY_ID[id] || null
}

// ── 确定性随机源（自由研究 / 经典选题可复现）────────────────────
export function seedFromString(str) {
  let h = 2166136261
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

function mulberry32(seed) {
  let a = seed >>> 0
  return function () {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// ── 绝对化表达检测（确定性词表；用于「解释是否过度」的规则提示）───
export const ABSOLUTES = ['一定', '必然', '肯定', '永远', '绝对', '注定', '百分之百', '就是', '等于', '全部', '所有']

export function detectAbsolutes(text = '') {
  return ABSOLUTES.filter((w) => (text || '').includes(w))
}

// ============================================================
// ① 卦象工作台 —— 观察结构
// ============================================================

// 由 profile 确定性推导的「结构事实」（供系统参考 / 启发式比对）
export function profileStructureFacts(profile) {
  if (!profile) return []
  const facts = []
  facts.push(`本卦是「${profile.traditionalName}」（第 ${profile.number} 卦）`)
  if (profile.upperInfo && profile.lowerInfo) {
    facts.push(`上卦为${profile.upperTrigram}（${profile.upperInfo.nature}），下卦为${profile.lowerTrigram}（${profile.lowerInfo.nature}）`)
  }
  const arr = (profile.binaryPattern || '').split('')
  const yang = arr.filter((c) => c === '1').length
  facts.push(`六爻共 ${yang} 阳 ${6 - yang} 阴`)
  for (const r of profile.relations || []) {
    if (r.targetName) facts.push(`${r.type}为${r.targetName}`)
  }
  return facts
}

const FACT_WORDS = ['上卦', '下卦', '错卦', '综卦', '互卦', '得位', '失位', '得中', '中正', '六爻', '阳', '阴', '初', '二', '三', '四', '五', '上', '刚', '柔', '应', '比', '承', '乘', '内卦', '外卦', '天', '地', '雷', '风', '水', '火', '山', '泽']

const INTERP_WORDS = ['吉凶', '大吉', '大利', '亨通', '顺利', '吉祥', '不利', '成功', '失败', '象征', '代表', '寓意', '含义', '意味', '预示', '说明', '表示', '预言', '命运', '好运', '财运', '事业', '婚姻', '吉', '凶']

// 启发式：把用户的一句话判为「结构事实 / 解释 / 未定」。
// 明确：这只是关键词级规则判断，不真正读懂句意；仅供参考，非评分。
export function classifyStructureFact(text = '') {
  const s = String(text || '')
  let factHits = 0
  let interpHits = 0
  for (const w of FACT_WORDS) if (s.includes(w)) factHits += 1
  for (const w of INTERP_WORDS) if (s.includes(w)) interpHits += 1
  if (factHits > interpHits) return { kind: 'fact', factHits, interpHits }
  if (interpHits > factHits) return { kind: 'interpretation', factHits, interpHits }
  return { kind: 'unclear', factHits, interpHits }
}

export function checkStructureObservation(profile, facts = []) {
  const filled = (facts || []).filter((f) => f && String(f).trim()).length
  return { count: filled, complete: filled >= 3, reference: profileStructureFacts(profile) }
}

// ============================================================
// ② 爻研究台 —— 研究爻位与爻辞
// ============================================================

const YAO_STRUCTURE_TERMS = ['得位', '失位', '中', '正', '应', '比', '承', '乘', '刚', '柔', '内卦', '外卦', '初', '二', '三', '四', '五', '上', '位']

export function checkYaoAnalysis(yao, answer = '') {
  const s = String(answer || '')
  const mentioned = YAO_STRUCTURE_TERMS.filter((t) => s.includes(t))
  const hasPositionRef = s.includes(yao?.positionLabel || '') || s.includes('位') || s.includes('位置')
  return { mentioned, count: mentioned.length, hasPositionRef, complete: mentioned.length >= 2 }
}

// ============================================================
// ③ 经典解读台 —— 原文→解释→比较
// ============================================================

export function checkClassicReading(own = '', misread = '') {
  const ownDone = !!(own && own.trim())
  const misreadDone = !!(misread && misread.trim())
  return {
    ownDone,
    misreadDone,
    absolutes: detectAbsolutes(own),
    complete: ownDone && misreadDone,
  }
}

// ============================================================
// ④ 案例分析台 —— 案例→证据→反例→结论
// ============================================================

// 案例可观察的「证据候选」= 情境事实(situation) + 结构提示(chart)
export function caseEvidenceCandidates(caseObj) {
  if (!caseObj) return []
  const s = (caseObj.situation || []).map((x) => ({ type: 'situation', text: x }))
  const c = (caseObj.chart || []).map((x) => ({ type: 'chart', text: `${x.key}：${x.value}` }))
  return [...s, ...c]
}

export function checkCaseFlow({ relatedChosen = false, evidenceChosen = false, hasCounter = null, counterNote = '', conclusion = '', confidence = null } = {}) {
  const missing = []
  if (!relatedChosen) missing.push('相关卦/爻')
  if (!evidenceChosen) missing.push('证据')
  if (hasCounter == null) missing.push('反例')
  if (!conclusion || !conclusion.trim()) missing.push('结论')
  if (!confidence) missing.push('把握程度')
  return {
    relatedChosen,
    evidenceChosen,
    hasCounter,
    conclusionDone: !!(conclusion && conclusion.trim()),
    confidence,
    missing,
    complete: missing.length === 0,
  }
}

// ============================================================
// ⑤ 解释构建台 —— 提出并修正解释（本阶段最重要）
// ============================================================

export function checkExplanationDraft({ observed = '', explanation = '', basis = '', counterexample = '', uncertainty = '' } = {}) {
  const missing = []
  if (!explanation || !explanation.trim()) missing.push('解释')
  if (!basis || !basis.trim()) missing.push('依据')
  const hasCounter = !!(counterexample && counterexample.trim())
  const hasUncertainty = !!(uncertainty && uncertainty.trim())
  const absolutes = detectAbsolutes((explanation || '') + (basis || ''))
  return {
    observedDone: !!(observed && observed.trim()),
    explanationDone: !!(explanation && explanation.trim()),
    basisDone: !!(basis && basis.trim()),
    hasCounter,
    hasUncertainty,
    absolutes,
    missing,
    complete: missing.length === 0,
  }
}

// 反思选项（确定性，非评分）
export const REFLECT_OPTIONS = [
  { value: 'claimed-fact', label: '我把解释当成了事实，需要修正' },
  { value: 'as-interpretation', label: '它只是我的一种解释，不是事实' },
  { value: 'unsure', label: '我不确定哪些是事实、哪些是解释' },
]

// ============================================================
// ⑥ 自由研究台 —— 跨对象探索
// ============================================================

// 解释传统 → 相关经典（按 label 关键词确定性匹配，不编造）
const TRADITION_KEYWORDS = {
  han: ['汉', '象数'],
  wangbi: ['王弼'],
  tang: ['正义', '孔颖达'],
  chengyi: ['程颐', '义理'],
  zhuxi: ['朱熹', '本义'],
  shaoyong: ['邵雍', '先天'],
}

const TRADITION_BY_KEY = TRADITION_REF.reduce((a, t) => {
  a[t.key] = t
  return a
}, {})

export function getTradition(key) {
  return TRADITION_BY_KEY[key] || null
}

// 爻 id 兼容两种写法：`hx-1-0`（档案规范）与 `1-0`（简写）。
export function parseYaoRef(id) {
  const m = String(id).match(/^(?:hx-)?(\d+)-(\d)$/)
  if (!m) return null
  return { seq: Number(m[1]), pos: Number(m[2]) }
}

// 由「类型 + id」确定性给出「下一步可研究对象」（跨对象连接）
export function relatedResearch(type, id) {
  if (type === 'hexagram') {
    const p = getHexagramProfile(id)
    if (!p) return []
    const rel = []
    p.yao.forEach((y) => rel.push({ type: 'yao', id: y.id, label: `${p.name}·${y.name}` }))
    ;(p.classicPassageIds || []).slice(0, 3).forEach((cid) => {
      const c = getClassicEntry(cid)
      if (c) rel.push({ type: 'classic', id: cid, label: `${c.source}·${c.chapter}` })
    })
    ;(p.caseIds || []).slice(0, 3).forEach((csid) => {
      const c = getCaseById(csid)
      if (c) rel.push({ type: 'case', id: csid, label: c.title })
    })
    ;['wangbi', 'chengyi', 'zhuxi'].forEach((tk) => {
      const t = TRADITION_BY_KEY[tk]
      if (t) rel.push({ type: 'tradition', id: tk, label: t.label })
    })
    return rel
  }

  if (type === 'yao') {
    const ref = parseYaoRef(id)
    if (!ref) return []
    const p = getHexagramProfile(ref.seq)
    if (!p) return []
    const rel = []
    p.yao.forEach((y, i) => {
      if (i !== ref.pos) rel.push({ type: 'yao', id: y.id, label: `${p.name}·${y.name}` })
    })
    const y = p.yao[ref.pos]
    ;(y?.classicPassageIds || []).slice(0, 3).forEach((cid) => {
      const c = getClassicEntry(cid)
      if (c) rel.push({ type: 'classic', id: cid, label: `${c.source}·${c.chapter}` })
    })
    ;(y?.cases || []).slice(0, 3).forEach((csid) => {
      const c = getCaseById(csid)
      if (c) rel.push({ type: 'case', id: csid, label: c.title })
    })
    return rel
  }

  if (type === 'term') {
    const t = getTerm(id)
    if (!t) return []
    const rel = []
    ;(t.relatedTermIds || []).slice(0, 5).forEach((tid) => {
      const o = getTerm(tid)
      if (o) rel.push({ type: 'term', id: tid, label: o.term })
    })
    ;(t.classicPassageIds || []).slice(0, 3).forEach((cid) => {
      const c = getClassicEntry(cid)
      if (c) rel.push({ type: 'classic', id: cid, label: `${c.source}·${c.chapter}` })
    })
    ;(t.traditionIds || []).slice(0, 3).forEach((tk) => {
      const o = TRADITION_BY_KEY[tk]
      if (o) rel.push({ type: 'tradition', id: tk, label: o.label })
    })
    return rel
  }

  if (type === 'classic') {
    const c = getClassicEntry(id) || getClassicPassage(id)
    if (!c) return []
    const rel = []
    ;(c.relatedHexagrams || []).slice(0, 4).forEach((seq) => {
      const p = getHexagramProfile(seq)
      if (p) rel.push({ type: 'hexagram', id: seq, label: `${p.name}卦` })
    })
    ;(c.relatedYaos || []).slice(0, 3).forEach((yid) => {
      rel.push({ type: 'yao', id: yid, label: `爻 ${yid}` })
    })
    ;(c.relatedTerms || []).slice(0, 4).forEach((tid) => {
      const o = getTerm(tid)
      if (o) rel.push({ type: 'term', id: tid, label: o.term })
    })
    return rel
  }

  if (type === 'tradition') {
    const kw = TRADITION_KEYWORDS[id] || []
    const rel = CLASSIC_PASSAGES.filter((p) => p.tradition && kw.some((k) => p.tradition.includes(k)))
      .slice(0, 6)
      .map((p) => ({ type: 'classic', id: p.id, label: `${p.source}·${p.chapter}` }))
    if (!rel.length) {
      // 义理类传统常以乾、坤为纲，给出确定性兜底
      rel.push({ type: 'hexagram', id: 1, label: '乾卦' }, { type: 'hexagram', id: 2, label: '坤卦' })
    }
    return rel
  }

  if (type === 'case') {
    const c = getCaseById(id)
    if (!c) return []
    // 案例自身的错误模式 → 对应错误类型说明（提示意识），及可选相关术语
    const rel = []
    for (const m of c.commonMistakes || []) {
      const codes = (m.match(/E\d{2}/g) || [])
      codes.forEach((code) => rel.push({ type: 'error', id: code, label: `错误模式 ${code}` }))
    }
    // 易经案例泛相关：给乾坤两卦作为确定性入口
    if (c.category === 'iching') rel.push({ type: 'hexagram', id: 1, label: '乾卦' }, { type: 'hexagram', id: 2, label: '坤卦' })
    return rel
  }

  return []
}

// 对象可读标签（覆盖 6 种类型，供首页 / 路径展示）
export function workshopTargetLabel(type, id) {
  try {
    if (type === 'hexagram') {
      const p = getHexagramProfile(Number(id))
      return p ? `${p.name}卦` : `#${id}`
    }
    if (type === 'yao') {
      const ref = parseYaoRef(id)
      const p = ref ? getHexagramProfile(ref.seq) : null
      const y = p ? p.yao[ref.pos] : null
      return y ? `${p.name}·${y.name}` : `#${id}`
    }
    if (type === 'term') {
      const t = getTerm(id)
      return t ? t.term : id
    }
    if (type === 'classic') {
      const c = getClassicEntry(id) || getClassicPassage(id)
      if (c) return `${c.source}·${c.chapter}`
      return id
    }
    if (type === 'tradition') {
      const t = TRADITION_BY_KEY[id]
      return t ? t.label : id
    }
    if (type === 'case') {
      const c = getCaseById(id)
      return c ? c.title : id
    }
    if (type === 'question') {
      // questionId 形如 `${lessonId}:s${stepIndex}:v${seed}`（lessonProgress 结构）
      const parts = String(id).split(':')
      const lesson = parts[0] ? getLesson(parts[0]) : null
      if (lesson) {
        const stepIndex = Number((parts[1] || '').replace(/^s/, ''))
        const step = Number.isInteger(stepIndex) && lesson.steps ? lesson.steps[stepIndex] : null
        return step ? `${lesson.title} · 第${stepIndex + 1}步` : lesson.title
      }
      return parts[0] || String(id)
    }
  } catch {
    /* 忽略解析失败 */
  }
  return String(id)
}

// ============================================================
// 首页「3 问」—— 全部由真实数据驱动，新用户走明确标注的默认路径
// ============================================================

// 薄弱行为 → 建议的工作台（deterministic 映射）
export function workshopForWeakness(key) {
  if (key === 'counterexample') return { id: 'explain', label: '解释构建台（主动找反例）', why: '你几乎没有留下「找反例」的记录，判断容易变成单向印证。' }
  if (key === 'evidence') return { id: 'case', label: '案例分析台（引证据）', why: '你很少为结论引用直接证据，试着先证据、后结论。' }
  if (key === 'uncertainty') return { id: 'explain', label: '解释构建台（写不确定）', why: '你没有记录过「不确定之处」，把解释当事实的风险在升高。' }
  if (key === 'observation') return { id: 'hexagram', label: '卦象工作台（结构观察）', why: '先练「只观察、不急着解释」，结构事实是后续一切的基础。' }
  if (key === 'reasoning') return { id: 'yao', label: '爻研究台（为什么换爻会变）', why: '你的推理链还薄，试着说清「位置如何影响含义」。' }
  if (key === 'synthesis') return { id: 'classic', label: '经典解读台（比较多解）', why: '你较少比较不同解释，去读至少一条经典并对照多种解读。' }
  return { id: 'hexagram', label: '卦象工作台（结构观察）', why: '从一个卦的结构观察开始，建立真实的行为记录。' }
}

export function workshopHome(state, opts = {}) {
  const now = opts.now ?? Date.now()
  const evidence = state.evidence || []
  const recent = getRecentEvidence(evidence, { days: 7, now })
  const sum = summarizeEvidence(recent)

  const hasMastery = !!(state.mastery && Object.keys(state.mastery).length)
  const hasErrors = !!(state.errorPatterns && Object.keys(state.errorPatterns).length)
  const hasCases = !!(state.completedCases && Object.keys(state.completedCases).length)
  const isNew = evidence.length === 0 && !hasMastery && !hasErrors && !hasCases

  // 最近研究对象（真实 Evidence）
  const recentTargets = (sum.recentTargets || []).slice(0, 5).map((t) => ({
    type: t.targetType,
    id: t.targetId,
    label: workshopTargetLabel(t.targetType, t.targetId),
    count: t.count,
  }))

  // 最近行为摘要（一段可解释中文）
  const recentSummary = recentTargets.length
    ? `近期你主要研究了 ${recentTargets.slice(0, 3).map((t) => t.label).join('、')}。`
    : ''

  // 「哪里需要继续练」—— 来自重复错误 / 证据薄弱 / 无反例 / 低不确定 / 能力瓶颈
  const toPractice = []
  const seenWorkshop = new Set()

  const push = (w, reason) => {
    if (!w || seenWorkshop.has(w.id)) return
    seenWorkshop.add(w.id)
    toPractice.push({ workshopId: w.id, label: w.label, why: reason })
  }

  // 1) 能力瓶颈（masteryProfile.bottleneck）
  const profile = state.masteryProfile || computeMasteryProfile(state)
  if (profile && profile.bottleneck && profile.sampleCount >= 1) {
    const b = profile.bottleneck
    push(workshopForWeakness(b.key), `你的「${b.label}」相对最弱（${b.value}），优先补这块。`)
  }

  // 2) 关键意识薄弱（证据/反例/不确定性很少被触碰）
  for (const wb of sum.weakBehaviors || []) {
    push(workshopForWeakness(wb.skill), workshopForWeakness(wb.skill).why)
  }

  // 3) 重复错误
  for (const e of (sum.repeatedErrors || []).slice(0, 2)) {
    const map = {
      E07: { id: 'explain', why: '你重复出现「只寻找支持自己的证据」，去主动找一个反例。' },
      E01: { id: 'case', why: '你重复出现「单信息直接下结论」，先收集足够证据再判断。' },
      E02: { id: 'classic', why: '你重复把传统观点当事实，去对照「原文/传统解释/现代说明」的边界。' },
      E06: { id: 'explain', why: '你重复出现「过度解释」，给结论留一个「可能不成立」的空间。' },
    }
    const m = map[e.code]
    if (m) {
      const label = WORKSHOPS.find((w) => w.id === m.id)?.label || m.id
      push({ id: m.id, label }, `${m.why}（${e.code} 出现 ${e.count} 次）`)
    }
  }

  // 兜底：有历史但仍空 → 给一个明确任务
  if (!toPractice.length && !isNew) {
    push(workshopForWeakness('counterexample'), '去解释构建台，尝试给一个结论主动写一个反例。')
  }

  // 「现在可以做什么」
  let nowTask
  if (isNew) {
    nowTask = { id: 'hexagram', label: '卦象工作台（结构观察）', why: '这是「新用户默认路径」的第一步，非个性化推荐。' }
  } else if (toPractice.length) {
    nowTask = { id: toPractice[0].workshopId, label: toPractice[0].label, why: toPractice[0].why }
  } else {
    nowTask = { id: 'hexagram', label: '卦象工作台（结构观察）', why: '从结构观察开始，继续积累真实记录。' }
  }

  return {
    isNew,
    hasRecent: recent.length > 0,
    nowTask,
    recentTargets,
    recentSummary,
    recentCount: recent.length,
    toPractice,
    summary: sum,
  }
}

// 新用户默认路径（明确标注，非个性化）
export const NEW_USER_PATH = {
  label: '新用户默认路径',
  steps: [
    '进入卦象工作台，选乾卦，写下 3 个结构事实',
    '到爻研究台，研究九三，回答「为什么换爻会变」',
    '到经典解读台，读一段〈乾文言〉并自己解释',
    '到案例分析台，选一个案例，引用证据并检查反例',
    '到解释构建台，构建并修正一条自己的解释',
  ],
}