// ============================================================
// ☯️ 「经典文本片段」数据层（R2-1.5）
//
// 用一个统一结构 ClassicPassage 承载「可靠经典文本」及其关联：
//   卦 → 原典 → 爻 → 易传 → 解释传统 → 案例 → 练习 → 我的理解
//
// 最高原则：原典绝不「AI 补齐」。
//   四层严格分离：
//     A 原典       —— text（只放已核对的通行本公版文本）
//     B 古代解释   —— tradition（明确标注解释者/传统/文献）
//     C 现代学习说明 —— modernNote（明确标注「现代辅助解释，非原典」）
//     D Agent 提示 —— 由调用方在 UI 生成，不混入数据
//
// 数据来源策略（诚实）：
//   · 象传·大象 64 条 → 单一数据源 hexagrams-data.imagery（已核对），
//     由 daXiangPassage() 在运行时引用生成，不二次手抄。
//   · 系辞传 / 文言传 → 手动收录的「通行本公版名句」（下为可靠文本），
//     逐条标注篇章与关联卦/爻。
//   · 彖传 / 小象 / 序卦 / 杂卦 → 本轮不作逐卦全文抄录（易出错），
//     保持「暂无可靠整理」，由 sourceInfo 标记 needs_review。
//   · 不确定的版本信息 → 显示「通行本整理」而不是伪造学术出处。
// ============================================================

import { HEXAGRAMS } from './hexagrams-data'

// ── 来源声明（研究模式「来源意识」，不虚构出版社/页码/版本）──────────
export const SOURCE_RECEIVED = {
  edition: '通行本整理',
  sourceType: 'received_text',
  confidence: 'verified',
  note: '通行本《周易》公版文本；未标注具体校勘本与页码，以免臆造出处。',
}

export const SOURCE_NEEDS_REVIEW = {
  edition: '通行本整理',
  sourceType: 'received_text',
  confidence: 'needs_review',
  note: '逐卦/逐爻全文尚未在本系统内完成核对，暂不呈现，避免误引。',
}

// 六十四卦名（seq -> name，供片段关联与展示）
const SEQ_NAME = {}
for (const h of HEXAGRAMS) SEQ_NAME[h.seq] = h.name

// ── 系辞传 / 文言传 可靠片段（通行本公版名句）─────────────────────
// 字段：id / source / chapter / text(原典) / modernNote(现代辅助，注明非原典)
//       relatedHexagrams / relatedYaos / relatedTerms / tradition
export const CLASSIC_PASSAGES = [
  // —— 系辞传 ——
  {
    id: 'sv-01',
    source: '系辞传',
    chapter: '系辞上·一',
    text: '天尊地卑，乾坤定矣。卑高以陈，贵贱位矣。动静有常，刚柔断矣。',
    modernNote: '现代辅助解释（非原典）：以天高地卑的秩序，引出乾坤两卦与阴阳刚柔的基本定位。',
    relatedHexagrams: [1, 2],
    relatedYaos: [],
    relatedTerms: ['乾坤', '阴阳', '刚柔'],
    tradition: null,
  },
  {
    id: 'sv-02',
    source: '系辞传',
    chapter: '系辞上·五',
    text: '一阴一阳之谓道。继之者善也，成之者性也。',
    modernNote: '现代辅助解释（非原典）：把「道」理解为阴阳交替变化的运行规律，是《系辞》最重要的哲学命题之一。',
    relatedHexagrams: [],
    relatedYaos: [],
    relatedTerms: ['阴阳', '道'],
    tradition: null,
  },
  {
    id: 'sv-03',
    source: '系辞传',
    chapter: '系辞上·五',
    text: '生生之谓易。',
    modernNote: '现代辅助解释（非原典）：「易」的核心是持续的生成与变化，而非静止的结论。',
    relatedHexagrams: [24, 51],
    relatedYaos: [],
    relatedTerms: ['变易', '生生'],
    tradition: null,
  },
  {
    id: 'sv-04',
    source: '系辞传',
    chapter: '系辞上·八',
    text: '二人同心，其利断金；同心之言，其臭如兰。',
    modernNote: '现代辅助解释（非原典）：以「同心」设喻，谈人与人真诚相应的力量；常被引来说明「同人」的精神。',
    relatedHexagrams: [13],
    relatedYaos: [],
    relatedTerms: ['同人', '相应'],
    tradition: null,
  },
  {
    id: 'sv-05',
    source: '系辞传',
    chapter: '系辞上·十一',
    text: '是故易有太极，是生两仪，两仪生四象，四象生八卦。',
    modernNote: '现代辅助解释（非原典）：描述象数体系从「太极」逐层分化的生成结构，是先天象数与卦序推演的经典依据。',
    relatedHexagrams: [1, 2, 11, 12],
    relatedYaos: [],
    relatedTerms: ['太极', '两仪', '四象', '八卦'],
    tradition: '邵雍（先天象数）',
  },
  {
    id: 'sv-06',
    source: '系辞传',
    chapter: '系辞上·十一',
    text: '极数知来之谓占，通变之谓事，阴阳不测之谓神。',
    modernNote: '现代辅助解释（非原典）：把「占」定位为「由数推演变化」的方法，而非宿命预言。',
    relatedHexagrams: [],
    relatedYaos: [],
    relatedTerms: ['占筮', '变通', '阴阳'],
    tradition: null,
  },
  {
    id: 'sv-07',
    source: '系辞传',
    chapter: '系辞上·十二',
    text: '形而上者谓之道，形而下者谓之器。',
    modernNote: '现代辅助解释（非原典）：以「形」为界，区分看不见的道理与看得见的事物，是「道—器」之别的重要出处。',
    relatedHexagrams: [1, 2],
    relatedYaos: [],
    relatedTerms: ['道', '器'],
    tradition: '王弼（义理）',
  },
  {
    id: 'sv-08',
    source: '系辞传',
    chapter: '系辞上·十二',
    text: '书不尽言，言不尽意。',
    modernNote: '现代辅助解释（非原典）：指出文字与语言的边界，提醒读者警惕「把文字解释当成唯一完整答案」。',
    relatedHexagrams: [],
    relatedYaos: [],
    relatedTerms: ['言意', '得意忘象'],
    tradition: '王弼（义理）',
  },
  {
    id: 'sv-09',
    source: '系辞传',
    chapter: '系辞下·一',
    text: '天地之大德曰生。',
    modernNote: '现代辅助解释（非原典）：把「生」视为天地最根本的德性，是「生生之谓易」的呼应。',
    relatedHexagrams: [1, 2, 27],
    relatedYaos: [],
    relatedTerms: ['生生', '德'],
    tradition: null,
  },
  {
    id: 'sv-10',
    source: '系辞传',
    chapter: '系辞下·二',
    text: '易穷则变，变则通，通则久。',
    modernNote: '现代辅助解释（非原典）：说明「变」是摆脱困局、走向持久的途径，常用于理解革卦、剥极而复这一类卦的意涵。',
    relatedHexagrams: [23, 24, 49],
    relatedYaos: [],
    relatedTerms: ['变通', '穷', '革'],
    tradition: null,
  },
  {
    id: 'sv-11',
    source: '系辞传',
    chapter: '系辞下·二',
    text: '古者包牺氏之王天下也，仰则观象于天，俯则观法于地。',
    modernNote: '现代辅助解释（非原典）：讲「八卦」如何从对天地的观察中产生，说明易学「观象取法」的源头。',
    relatedHexagrams: [1, 2],
    relatedYaos: [],
    relatedTerms: ['观象', '八卦'],
    tradition: null,
  },
  {
    id: 'sv-12',
    source: '系辞传',
    chapter: '系辞下·五',
    text: '君子藏器于身，待时而动，何不利之有？',
    modernNote: '现代辅助解释（非原典）：以「藏器」喻积累与等待，讲「时机」对行动的重要性。',
    relatedHexagrams: [5, 33, 1],
    relatedYaos: [],
    relatedTerms: ['时位', '待时'],
    tradition: null,
  },
  {
    id: 'sv-13',
    source: '系辞传',
    chapter: '系辞下·五',
    text: '善不积不足以成名，恶不积不足以灭身。',
    modernNote: '现代辅助解释（非原典）：强调「积累」的方向决定结果，呼应「积善」思想。',
    relatedHexagrams: [2, 37],
    relatedYaos: [],
    relatedTerms: ['积善', '渐'],
    tradition: null,
  },
  {
    id: 'sv-14',
    source: '系辞传',
    chapter: '系辞下·五',
    text: '德薄而位尊，知小而谋大，力小而任重，鲜不及矣。',
    modernNote: '现代辅助解释（非原典）：警示「德位不相称」的风险，是判断「当位与否」的一层反面参照。',
    relatedHexagrams: [25, 28, 50],
    relatedYaos: [],
    relatedTerms: ['德位', '当位'],
    tradition: null,
  },

  // —— 文言传（仅乾坤两卦）——
  {
    id: 'wy-01',
    source: '文言传',
    chapter: '乾文言',
    text: '元者，善之长也；亨者，嘉之会也；利者，义之和也；贞者，事之干也。',
    modernNote: '现代辅助解释（非原典）：对「元亨利贞」四德作出义理式展开，是后世解乾卦四德的重要起点。',
    relatedHexagrams: [1],
    relatedYaos: [],
    relatedTerms: ['元亨利贞', '四德'],
    tradition: '义理传统',
  },
  {
    id: 'wy-02',
    source: '文言传',
    chapter: '乾文言',
    text: '君子进德修业。忠信，所以进德也；修辞立其诚，所以居业也。',
    modernNote: '现代辅助解释（非原典）：把乾卦的「进」落到「进德修业」上，是义理派读乾的重要落点。',
    relatedHexagrams: [1],
    relatedYaos: [],
    relatedTerms: ['进德修业', '乾'],
    tradition: '程颐（义理）',
  },
  {
    id: 'wy-03',
    source: '文言传',
    chapter: '乾文言',
    text: '同声相应，同气相求。水流湿，火就燥。',
    modernNote: '现代辅助解释（非原典）：用「同类相感」来解释乾九五「飞龙在天，利见大人」的相应之理。',
    relatedHexagrams: [1],
    relatedYaos: ['hx-1-4'],
    relatedTerms: ['相应', '九五'],
    tradition: null,
  },
  {
    id: 'wy-04',
    source: '文言传',
    chapter: '坤文言',
    text: '坤至柔而动也刚，至静而德方。',
    modernNote: '现代辅助解释（非原典）：说明坤卦并非「软弱」，其「柔」中蕴含「刚」，静中自有方向。',
    relatedHexagrams: [2],
    relatedYaos: [],
    relatedTerms: ['柔', '坤', '德'],
    tradition: null,
  },
  {
    id: 'wy-05',
    source: '文言传',
    chapter: '坤文言',
    text: '积善之家，必有余庆；积不善之家，必有余殃。',
    modernNote: '现代辅助解释（非原典）：以「积」解释坤卦初六「履霜，坚冰至」——微小的开端会逐渐累积为结果。',
    relatedHexagrams: [2],
    relatedYaos: ['hx-2-0'],
    relatedTerms: ['积善', '履霜'],
    tradition: null,
  },
]

// ── 索引 ───────────────────────────────────────────────────
export const PASSAGE_BY_ID = CLASSIC_PASSAGES.reduce((acc, p) => {
  acc[p.id] = p
  return acc
}, {})

export function getClassicPassage(id) {
  if (PASSAGE_BY_ID[id]) return PASSAGE_BY_ID[id]
  // dx-N 是〈大象传〉片段：由 daXiangPassage(seq) 确定性生成，未常驻 PASSAGE_BY_ID。
  // 让 dx-N 成为一等公民 id，保证怀疑任务等处的经典引用可解析（0 dangling）。
  if (typeof id === 'string' && /^dx-\d+$/.test(id)) {
    return daXiangPassage(Number(id.slice(3))) || null
  }
  return null
}

// 由「卦」反查相关经典片段（系辞/文言可靠片段，含「通用」片段）
export function classicPassagesForHexagram(seq) {
  return CLASSIC_PASSAGES.filter(
    (p) => p.relatedHexagrams.length === 0 || p.relatedHexagrams.includes(seq)
  )
}

// 由「爻」反查相关经典片段
export function classicPassagesForYao(seq, index) {
  const yaoId = `hx-${seq}-${index}`
  return CLASSIC_PASSAGES.filter(
    (p) =>
      p.relatedYaos.includes(yaoId) ||
      (p.relatedHexagrams.length === 0 || p.relatedHexagrams.includes(seq))
  )
}

// 象传·大象：单一数据源引用（hexagrams-data.imagery），不二次手抄
export function daXiangPassage(seq) {
  const h = HEXAGRAMS.find((x) => x.seq === seq)
  if (!h || !h.imagery) return null
  return {
    id: `dx-${seq}`,
    source: '象传',
    chapter: '大象传',
    text: h.imagery,
    modernNote: '现代辅助解释（非原典）：〈大象传〉从上下卦之象提炼出一句行动纲领，属于「解释」而非卦辞原文。',
    relatedHexagrams: [seq],
    relatedYaos: [],
    relatedTerms: ['大象', '卦象'],
    tradition: null,
    sourceInfo: { ...SOURCE_RECEIVED },
  }
}

// 随机经典：用于「随机深挖」升级（读一段系辞/文言/大象，不抽签算命）
export function randomClassicPassage() {
  const pool = CLASSIC_PASSAGES
  return pool[Math.floor(Math.random() * pool.length)]
}

// 判断某爻/某卦是否「暂无专属经典」：仅用于 UI 提示，不做「空指针」文案
export function hasClassicContent(seq) {
  return classicPassagesForHexagram(seq).length > 0 || !!daXiangPassage(seq)
}

// 相关卦名（由序号还原，供片段 UI 展示）
export function hexName(seq) {
  return SEQ_NAME[seq] || `第${seq}卦`
}