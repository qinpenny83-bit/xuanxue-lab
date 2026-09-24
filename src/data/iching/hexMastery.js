// ============================================================
// ☯️ 64卦 掌握度 / 学习阶段 / 推荐（R2-1 → R2-1.5）
// 复用现有 0-6 mastery（state.mastery），不另造等级体系：
//   卦        → key `hx-{seq}`
//   爻        → key `hx-{seq}-{index}`（与 YaoProfile.id 一致）
//   经典片段  → key `cp-{passageId}`（R2-1.5）
//   传统比较  → key `tc-{seq}`（R2-1.5）
// 学习阶段 L0~L5 由掌握度「推导」得出（deterministic），只做展示与导航。
// 学习证据 / 深度进度：全部从真实学习行为推导，不因「点过页面」即判定学会。
// ============================================================

import { getHexagramProfile } from './hexagramProfile'

export function hexMasteryKey(seq) {
  return `hx-${seq}`
}

export function yaoMasteryKey(seq, index) {
  return `hx-${seq}-${index}`
}

// R2-1.5：新实体掌握度 key（复用同一 0-6 掌握度，不复制新引擎）
export function classicMasteryKey(passageId) {
  return `cp-${passageId}`
}

export function traditionCompareKey(seq) {
  return `tc-${seq}`
}

export function hexMastery(state, seq) {
  return (state.mastery && state.mastery[hexMasteryKey(seq)]) || 0
}

export function yaoMastery(state, seq, index) {
  return (state.mastery && state.mastery[yaoMasteryKey(seq, index)]) || 0
}

export function classicMastery(state, passageId) {
  return (state.mastery && state.mastery[classicMasteryKey(passageId)]) || 0
}

export function traditionCompareMastery(state, seq) {
  return (state.mastery && state.mastery[traditionCompareKey(seq)]) || 0
}

// 学习阶段定义（min 为该阶段所需的最低 mastery 0-6）
export const HEX_STAGES = [
  { id: 'L0', label: '初识', tip: '先认识卦象和基本结构', min: 0 },
  { id: 'L1', label: '理解', tip: '理解卦辞和六爻', min: 1 },
  { id: 'L2', label: '应用', tip: '开始分析爻位和结构', min: 3 },
  { id: 'L3', label: '比较', tip: '比较不同解释传统', min: 4 },
  { id: 'L4', label: '独立分析', tip: '自己解释一个案例', min: 5 },
  { id: 'L5', label: '研究', tip: '对照原典与不同传统形成自己的判断', min: 6 },
]

// 卦的综合掌握度：自身 key 与六爻平均的较大者（都来自真实行为，无随机）
export function hexLevel(state, seq) {
  const self = hexMastery(state, seq)
  const sum = [0, 1, 2, 3, 4, 5].reduce((a, i) => a + yaoMastery(state, seq, i), 0)
  const avg = Math.round(sum / 6)
  return Math.max(self, avg)
}

// 学习阶段（L0-L5），附带当前 level 供 UI 显示进度
export function hexStage(state, seq) {
  const level = hexLevel(state, seq)
  let stage = HEX_STAGES[0]
  for (const s of HEX_STAGES) if (level >= s.min) stage = s
  return { ...stage, level, next: HEX_STAGES.find((s) => s.min > level) || null }
}

// 六个爻的掌握度明细（供六爻列表与「下一爻该学什么」）
export function yaoMasteryDetail(state, seq) {
  const p = getHexagramProfile(seq)
  return [0, 1, 2, 3, 4, 5].map((i) => ({
    yao: p.yao[i],
    mastery: yaoMastery(state, seq, i),
  }))
}

// ── 学习证据 / 深度进度（R2-1.5，从真实行为推导）───────────────
// 证据维度：阅读 / 结构 / 原典 / 案例 / 传统比较 / 独立分析
// （「易传」作为卦级深度阶段单独记录，见 hexDepthProgress）

// 单爻学习证据：返回 6 个布尔维度，驱动「看过 ≠ 学会」的判断
export function yaoEvidence(state, seq, index) {
  const key = yaoMasteryKey(seq, index)
  const ev = (state.hexEvidence && state.hexEvidence[key]) || {}
  const m = yaoMastery(state, seq, index)
  const quiz = (state.quizHistory || []).filter((q) => q.nodeId === key && q.stepType === 'mastery')
  const note = (state.hexNotes && state.hexNotes[key] && state.hexNotes[key].note) || ''
  return {
    read: !!ev.read,
    structure: !!ev.structure || quiz.length > 0,
    original: !!ev.original || m >= 1,
    cases: !!ev.cases,
    tradition: !!ev.tradition || traditionCompareMastery(state, seq) > 0,
    analyze: note.trim().length > 0,
  }
}

// 卦级「深度进度」八阶段：认识→原典→六爻→结构→易传→传统→案例→独立分析
export const DEPTH_STAGES = [
  { key: 'know', label: '认识' },
  { key: 'original', label: '原典' },
  { key: 'yao', label: '六爻' },
  { key: 'structure', label: '结构' },
  { key: 'yizhuan', label: '易传' },
  { key: 'tradition', label: '传统' },
  { key: 'cases', label: '案例' },
  { key: 'analyze', label: '独立分析' },
]

function triDone(done) {
  return done ? 'done' : 'todo'
}

function triCount(count, total) {
  if (count >= total) return 'done'
  if (count > 0) return 'partial'
  return 'todo'
}

export function hexDepthProgress(state, seq) {
  const p = getHexagramProfile(seq)
  if (!p) return []
  const hmKey = hexMasteryKey(seq)
  const ev = (state.hexEvidence && state.hexEvidence[hmKey]) || {}
  const self = hexMastery(state, seq)
  const detail = yaoMasteryDetail(state, seq)
  const touchedYao = detail.filter((d) => d.mastery > 0).length
  const structYao = p.yao.filter((y) => {
    const yev = (state.hexEvidence && state.hexEvidence[y.id]) || {}
    return yev.structure || (state.quizHistory || []).some((q) => q.nodeId === y.id && q.stepType === 'mastery')
  }).length
  const classicRead = (p.classicPassageIds || []).some((id) => classicMastery(state, id) > 0)
  const compared = traditionCompareMastery(state, seq) > 0 || !!ev.tradition
  const caseRead = !!ev.cases
  const analyzed = !!(
    (state.hexNotes || {})[hmKey]?.note || (state.hexNotes || {})[`${hmKey}-study`]?.note
  )

  return [
    { key: 'know', label: '认识', status: triDone(self >= 1 || !!ev.read || touchedYao > 0) },
    { key: 'original', label: '原典', status: triDone(self >= 1 || !!ev.original) },
    { key: 'yao', label: '六爻', status: triCount(touchedYao, 6) },
    { key: 'structure', label: '结构', status: triCount(structYao, 6) },
    { key: 'yizhuan', label: '易传', status: triDone(classicRead || !!ev.yizhuan) },
    { key: 'tradition', label: '传统', status: triDone(compared) },
    { key: 'cases', label: '案例', status: triDone(caseRead) },
    { key: 'analyze', label: '独立分析', status: triDone(analyzed) },
  ]
}

// ── 确定性推荐：读「当前掌握度 + 真实学习证据」→ 下一步学什么 + 为什么 ──
// 全部从真实 mastery / 阅读 / 错误 / 比较 / 分析 推导，不套模板、不随机。
export function hexRecommendation(state, seq) {
  const p = getHexagramProfile(seq)
  if (!p) return null
  const detail = yaoMasteryDetail(state, seq)
  const untouched = detail.filter((d) => d.mastery <= 0).map((d) => d.yao.name)
  const weak = detail.filter((d) => d.mastery > 0 && d.mastery < 3).map((d) => d.yao.name)
  const low = [...detail].sort((a, b) => a.mastery - b.mastery)[0]

  // R2-1.5：读取真实学习证据，不生成无依据文案
  const hmKey = hexMasteryKey(seq)
  const ev = (state.hexEvidence && state.hexEvidence[hmKey]) || {}
  const read = !!ev.read || hexMastery(state, seq) >= 1
  const compared = traditionCompareMastery(state, seq) > 0 || !!ev.tradition
  const analyzed = !!((state.hexNotes || {})[hmKey]?.note || (state.hexNotes || {})[`${hmKey}-study`]?.note)
  const yaoErrors = (state.quizHistory || []).filter(
    (q) => q.errorType && detail.some((d) => d.yao.id === q.nodeId)
  ).length

  if (untouched.length === 6) {
    return {
      kind: 'start',
      title: `从「${p.name}」的初爻开始拆解`,
      body: read
        ? `你已经浏览过 ${p.name} 卦，但还没有动手。先读卦辞，再自下而上逐爻判断「得位 / 得中 / 应」，别急着背结论。`
        : `你还没拆解过这一卦。先读卦辞，再自下而上逐爻判断「得位 / 得中 / 应」，别急着背结论。`,
      why: `当前 6 爻掌握度均为 0（未接触），卦级掌握度 ${hexMastery(state, seq)}${read ? '；已记录阅读痕迹，但尚未拆解' : ''}。`,
      targetYao: low.yao,
    }
  }

  if (weak.length) {
    return {
      kind: 'weak',
      title: `先稳住「${weak.join('、')}」的爻位关系`,
      body:
        yaoErrors > 0
          ? `你已经接触到 ${p.name} 卦，但 ${weak.join('、')} 的爻位关系还不稳定；最近有 ${yaoErrors} 次爻位判断出错。先做这几爻的「爻位判断」练习。`
          : `你已经接触到 ${p.name} 卦，但 ${weak.join('、')} 的爻位关系还不稳定。下一步先做这几爻的「爻位判断」练习，不要急着学新卦。`,
      why: `这 6 爻中，${weak.join('、')} 的掌握度最低（${low.mastery}），其余爻已 ≥ 3。`,
      targetYao: low.yao,
    }
  }

  const maxYao = Math.max(...detail.map((d) => d.mastery))

  if (!compared && maxYao < 5) {
    return {
      kind: 'compare',
      title: `换一个方向：比较不同解释传统`,
      body: `${p.name} 的六爻结构你已经基本掌握，但还没有比较过不同解释传统对同一文本的读法。下一步做一次「传统比较」。`,
      why: `六爻掌握度均已 ≥ 3，但「传统比较」尚未开始（无比较记录）。`,
      targetYao: null,
    }
  }

  if (maxYao < 5) {
    return {
      kind: 'compare',
      title: `换一个方向：比较不同解释传统`,
      body: `${p.name} 的六爻结构你已经基本掌握，下一步试着比较不同解释传统对同一文本的读法。`,
      why: `六爻掌握度均已 ≥ 3，但还没有进入「独立判断」阶段（最高 ${maxYao}）。`,
      targetYao: null,
    }
  }

  if (!analyzed) {
    return {
      kind: 'research',
      title: `进入研究：对照原典，写下你自己的判断`,
      body: `${p.name} 的六爻与结构你已相当熟悉，也做过传统比较。下一步先自己写下判断，再对照不同传统，别急着看答案。`,
      why: `六爻掌握度最高已达 ${maxYao}，且已比较过传统，但还没有写下「独立分析」。`,
      targetYao: null,
    }
  }

  return {
    kind: 'research',
    title: `进入研究：对照原典，形成你自己的判断`,
    body: `${p.name} 的六爻与结构你已相当熟悉。可以把它和它的错卦/综卦放在一起对照，写出你自己的理解。`,
    why: `六爻掌握度最高已达 ${maxYao}，具备独立分析基础。`,
    targetYao: null,
  }
}

// ── 确定性练习生成（从结构引擎推导，不编造题目）────────────────
// 单爻三问：得位 / 得中 / 应。答案与解释全部来自 analyzeYao。
export function yaoQuestions(profile, index) {
  const y = profile.yao[index]
  const qs = []

  qs.push({
    id: 'dewei',
    prompt: `${y.name} 是「得位（当位）」还是「失位（不当位）」，能判断吗？`,
    options: ['得位（当位）', '失位（不当位）'],
    answer: y.dewei ? 0 : 1,
    explain: `${y.name} 是${y.lineType}爻；${y.dewei ? '它所居之位属' + y.lineType + '位，所以「当位」。' : '它所居之位不属' + y.lineType + '位，所以「不当位」。'}`,
  })

  qs.push({
    id: 'zhong',
    prompt: `${y.name} 处在「中位」吗？`,
    options: ['是，处在中位', '否，不在中位'],
    answer: y.zhong ? 0 : 1,
    explain: y.zhong
      ? `${y.name} 是${y.positionLabel === '二' ? '下卦' : '外卦'}的中位（${y.positionLabel}爻居中），传统极重「中」。${y.zhongzheng ? '它又得位又居中，谓「中正」。' : ''}`
      : `${y.name}（${y.positionLabel}爻）不在二、五这两个中位上。`,
  })

  if (y.ying) {
    qs.push({
      id: 'ying',
      prompt: `按传统爻位规则，${y.name} 与 ${y.ying.partnerLabel}爻 是否构成「相应」（阴阳相异、相呼应）？`,
      options: ['是，相应', '否，敌应（同气不呼应）'],
      answer: y.ying.favorable ? 0 : 1,
      explain: y.ying.favorable
        ? `${y.name}（${y.lineType}）与 ${y.ying.partnerLabel}爻（${y.lineType === '阳' ? '阴' : '阳'}）阴阳相异，相呼应，谓「相应」。`
        : `${y.name}（${y.lineType}）与 ${y.ying.partnerLabel}爻 都是${y.lineType}，同气不呼应，谓「敌应」。`,
    })
  }

  return qs
}

// 单卦三问：上卦 / 下卦 / 得位数。答案来自确定性结构。
export function hexQuestions(profile) {
  const BAGUA_NAMES = ['乾', '兑', '离', '震', '巽', '坎', '艮', '坤']
  const deweiCount = profile.yao.filter((y) => y.dewei).length
  return [
    {
      id: 'upper',
      prompt: `「${profile.name}」的上卦（外卦）是哪一个八卦？`,
      options: BAGUA_NAMES,
      answer: BAGUA_NAMES.indexOf(profile.upperTrigram),
      explain: `${profile.name} 的外卦（上卦）是「${profile.upperTrigram}」（${profile.upperInfo?.nature}），六爻的后三位（上三爻）。`,
    },
    {
      id: 'lower',
      prompt: `「${profile.name}」的下卦（内卦）是哪一个八卦？`,
      options: BAGUA_NAMES,
      answer: BAGUA_NAMES.indexOf(profile.lowerTrigram),
      explain: `${profile.name} 的内卦（下卦）是「${profile.lowerTrigram}」（${profile.lowerInfo?.nature}），六爻的前三位（下三爻）。`,
    },
    {
      id: 'dewei-count',
      prompt: `「${profile.name}」六爻中，有几条爻「得位（当位）」？`,
      options: ['0', '1', '2', '3', '4', '5', '6'],
      answer: deweiCount, // 下标即数值（0-6）
      explain: `阳爻居初/三/五、阴爻居二/四/上为「当位」；${profile.name}（${profile.binaryPattern}）中恰有 ${deweiCount} 条当位。`,
    },
  ]
}