// ============================================================
// ☯️ 64卦深度档案系统（R2-1）· 统一数据模型
//
// 把「卦」从图鉴卡片升级为可纵深钻研的知识对象：
//   卦 → 基本结构 → 卦辞 → 六爻(384) → 十翼关联 → 爻位/爻际关系
//      → 关键词 → 不同解释传统 → 案例 → 反例 → 练习 → 掌握度
//
// 原则：
//   1. 一切结构字段来自「确定性规则引擎」，绝无 LLM/随机。
//   2. 爻位关系（得位/中/承/乘/比/应/刚柔/内外）从 lines 计算，
//      标注为「传统易学规则」，不包装成科学/唯一结论。
//   3. 原典层只放「已核对」的文本：卦辞 / 大象来自 hexagrams-data.js，
//      六爻爻辞全文来自 yaoText.js（通行本公版，384 条全覆盖）；
//      暂缺的（彖传全文、小象逐爻）显式标记 text:null → UI 显示「暂无可靠整理」。
//   4. 十翼 / 解释传统用「引用」（nodeId）关联到已建成的课程节点，
//      一份知识只存一份，避免内容漂移。
// ============================================================

import { HEXAGRAMS, BAGUA } from './hexagrams-data'
import { YAO_TEXT } from './yaoText'
import {
  getHexagram,
  hexagramRelations,
  linesToSymbol,
  lineLabel,
} from './hexagramTools'
import {
  classicPassagesForHexagram,
  classicPassagesForYao,
  daXiangPassage,
  SOURCE_RECEIVED,
  SOURCE_NEEDS_REVIEW,
} from './classic-passages'
import { casesForHexagram, casesForYao } from './caseGraph'

// ── 六爻位置常量（自下而上，index 0 = 初爻）──────────────────
export const POSITIONS = ['初', '二', '三', '四', '五', '上']
const YANG_POS = new Set([0, 2, 4]) // 初、三、五 为阳位
const YIN_POS = new Set([1, 3, 5]) // 二、四、上 为阴位
export const YING_PAIRS = [
  [0, 3], // 初 — 四
  [1, 4], // 二 — 五
  [2, 5], // 三 — 上
]

// 各爻位传统「通常讨论什么」（通用位置义，非逐卦结论，标注为传统常识）
export const POSITION_MEANING = {
  0: '开端：事物的起始之势，力量或未显，宜潜、宜慎。',
  1: '下卦中位：居中守正之位，多主「内、心、近身」。传统极重「中」。',
  2: '下卦之极：刚过中、处将变之位，传统常言「三多凶」。',
  3: '外卦之初：由内而外的转折点，传统常言「四多惧」。',
  4: '外卦中位：居尊，是「君位/主位」，常主「成事、统领、守中」。',
  5: '极位：事物之终，盛极则变，多有「亢、悔、终」之象。',
}

// ── 卦名拼音（通行本六十四卦，按卦名字点标注）───────────────────
const PINYIN = {
  乾: 'qián', 坤: 'kūn', 屯: 'zhūn', 蒙: 'méng', 需: 'xū', 讼: 'sòng',
  师: 'shī', 比: 'bǐ', 小畜: 'xiǎo xù', 履: 'lǚ', 泰: 'tài', 否: 'pǐ',
  同人: 'tóng rén', 大有: 'dà yǒu', 谦: 'qiān', 豫: 'yù', 随: 'suí', 蛊: 'gǔ',
  临: 'lín', 观: 'guān', 噬嗑: 'shì hé', 贲: 'bì', 剥: 'bō', 复: 'fù',
  无妄: 'wú wàng', 大畜: 'dà xù', 颐: 'yí', 大过: 'dà guò', 坎: 'kǎn', 离: 'lí',
  咸: 'xián', 恒: 'héng', 遁: 'dùn', 大壮: 'dà zhuàng', 晋: 'jìn', 明夷: 'míng yí',
  家人: 'jiā rén', 睽: 'kuí', 蹇: 'jiǎn', 解: 'xiè', 损: 'sǔn', 益: 'yì',
  夬: 'guài', 姤: 'gòu', 萃: 'cuì', 升: 'shēng', 困: 'kùn', 井: 'jǐng',
  革: 'gé', 鼎: 'dǐng', 震: 'zhèn', 艮: 'gèn', 渐: 'jiàn', 归妹: 'guī mèi',
  丰: 'fēng', 旅: 'lǚ', 巽: 'xùn', 兑: 'duì', 涣: 'huàn', 节: 'jié',
  中孚: 'zhōng fú', 小过: 'xiǎo guò', 既济: 'jì jì', 未济: 'wèi jì',
}

// ── 十翼引用（关联到《易传·十翼》课程节点，一份知识只存一份）──────
export const TEN_WINGS_REF = {
  tuan: { label: '彖传', node: 'yz-tuan', desc: '解释卦辞、卦象与卦义。' },
  xiang: { label: '象传', node: 'yz-xiang', desc: '大象释全卦，小象逐爻释。' },
  xici: { label: '系辞传', node: 'yz-xici', desc: '易的哲学总论与变化之纲。' },
  wenyan: { label: '文言传', node: 'yz-wenyan', desc: '专讲乾坤之德。' },
  shuogua: { label: '说卦传', node: 'yz-shuogua', desc: '八卦的象征字典。' },
  xugua: { label: '序卦传', node: 'yz-xugua', desc: '解释六十四卦顺序。' },
  zagua: { label: '杂卦传', node: 'yz-zagua', desc: '一句话点透一卦。' },
}

// ── 解释传统引用（关联到「历代易学与解释传统」课程节点）──────────
export const TRADITION_REF = [
  { key: 'han', label: '汉易（象数）', node: 'yx-han', note: '卦气、纳甲、爻辰的象数框架。' },
  { key: 'wangbi', label: '王弼（义理）', node: 'yx-wangbi', note: '扫象言理，得意忘象。' },
  { key: 'tang', label: '唐《周易正义》', node: 'yx-tang', note: '孔颖达整合汉魏，总为正义。' },
  { key: 'chengyi', label: '程颐（义理）', node: 'yx-chengyi', note: '义理入人事，读易学做人。' },
  { key: 'zhuxi', label: '朱熹（本义）', node: 'yx-zhuxi', note: '本义、经传分读，象数义理再整合。' },
  { key: 'shaoyong', label: '邵雍（先天象数）', node: 'yx-shaoyong', note: '先天八卦、以数统象。' },
]

// ── 确定性：单爻结构关系计算 ─────────────────────────────────
// 全部来自 lines 的推导；传统规则，非科学结论。
function polarity(yang) {
  return yang ? '阳' : '阴'
}

function keyLineForYao(hex, yaoName) {
  if (!hex.keyLine) return null
  const i = hex.keyLine.indexOf('：')
  if (i < 0) return null
  const head = hex.keyLine.slice(0, i).trim()
  return head === yaoName ? hex.keyLine.slice(i + 1).trim() : null
}

export function analyzeYao(lines, index) {
  const arr = lines.split('')
  const yang = arr[index] === '1'

  const dewei = yang ? YANG_POS.has(index) : YIN_POS.has(index)
  const zhong = index === 1 || index === 4

  // 应：初↔四、二↔五、三↔上
  let ying = null
  for (const [a, b] of YING_PAIRS) {
    if (index === a || index === b) {
      const partner = index === a ? b : a
      const same = yang === (arr[partner] === '1')
      ying = {
        partner,
        partnerLabel: POSITIONS[partner],
        type: same ? '敌应（同气，不相呼应）' : '相应（阴阳相异，相呼应）',
        favorable: !same,
      }
      break
    }
  }

  // 比：相邻爻（i-1 与 i+1）
  const bi = []
  if (index > 0) {
    const same = yang === (arr[index - 1] === '1')
    bi.push({
      partner: index - 1,
      partnerLabel: POSITIONS[index - 1],
      type: same ? '同气相邻' : '亲比（阴阳相异）',
      favorable: !same,
    })
  }
  if (index < 5) {
    const same = yang === (arr[index + 1] === '1')
    bi.push({
      partner: index + 1,
      partnerLabel: POSITIONS[index + 1],
      type: same ? '同气相邻' : '亲比（阴阳相异）',
      favorable: !same,
    })
  }

  // 承：本爻（居下）承其上爻；传统重「阴承阳为顺」
  let cheng = null
  if (index < 5) {
    const upYang = arr[index + 1] === '1'
    let type
    if (!yang && upYang) type = '阴承阳（传统视为顺）'
    else if (yang && !upYang) type = '阳承阴（刚居柔下，逆序）'
    else type = `同${polarity(yang)}相承`
    cheng = { to: index + 1, toLabel: POSITIONS[index + 1], type, favorable: !yang && upYang }
  }

  // 乘：本爻（居上）乘其下爻；传统忌「阴乘阳（柔凌刚）」
  let ling = null
  if (index > 0) {
    const downYang = arr[index - 1] === '1'
    let type
    if (!yang && downYang) type = '阴乘阳（柔凌刚，传统多言不协）'
    else if (yang && !downYang) type = '阳乘阴'
    else type = `同${polarity(yang)}相凌`
    ling = { to: index - 1, toLabel: POSITIONS[index - 1], type, favorable: !(!yang && downYang) }
  }

  return {
    position: index,
    positionLabel: POSITIONS[index],
    yang,
    lineType: yang ? '阳' : '阴',
    gangrou: yang ? '刚' : '柔',
    innerOuter: index < 3 ? '内卦（下卦）' : '外卦（上卦）',
    dewei,
    deweiLabel: dewei ? '得位（当位）' : '失位（不当位）',
    zhong,
    zhongzheng: zhong && dewei,
    ying,
    bi,
    cheng,
    ling,
  }
}

// ── 单卦完整档案构建 ─────────────────────────────────────────
function buildProfile(hex) {
  const relations = []
  for (const [type, label, note] of [
    ['opposite', '错卦', '六爻阴阳全部互变，成对出现（如乾坤）。'],
    ['reverse', '综卦', '六爻上下颠倒，又称「覆卦/反对」。'],
    ['mutual', '互卦', '取二三四爻为下、三四五爻为上，卦中藏卦。'],
  ]) {
    const target = hexagramRelations(hex)[type]
    relations.push({
      type: label,
      target: target ? target.seq : null,
      targetName: target ? target.full : null,
      targetLines: target ? target.lines : null,
      tradition: '传统易学',
      note,
    })
  }

  // 经典片段 / 案例（R2-1.5）：在卦级先算好，爻级复用，避免重复计算与重复数据
  const daXiang = daXiangPassage(hex.seq)
  const hexClassicIds = [
    ...classicPassagesForHexagram(hex.seq).map((p) => p.id),
    ...(daXiang ? [daXiang.id] : []),
  ]
  const hexCaseIds = casesForHexagram(hex.seq).map((c) => c.id)

  const yao = [0, 1, 2, 3, 4, 5].map((i) => {
    const a = analyzeYao(hex.lines, i)
    const yaoName = lineLabel(i, a.yang)
    const yaoCaseList = casesForYao(hex.seq, i)
    return {
      id: `hx-${hex.seq}-${i}`,
      hexagramId: hex.seq,
      hexagramName: hex.name,
      name: yaoName, // 初九 / 六二 / … / 上九
      ...a,
      originalText: YAO_TEXT[hex.seq]?.[i] ?? keyLineForYao(hex, yaoName) ?? null, // 通行本爻辞全文（公版）；兜底用 keyLine，其余为 null
      modernExplanation: null, // 暂无可靠整理（不编造逐爻白话注）
      positionMeaning: POSITION_MEANING[i],
      tenWings: {
        xiaoxiang: { label: '小象', node: TEN_WINGS_REF.xiang.node, text: null },
        wenyan: hex.name === '乾' || hex.name === '坤'
          ? { label: '文言', node: TEN_WINGS_REF.wenyan.node, text: null }
          : null,
      },
      interpretationTraditions: TRADITION_REF.map((t) => ({ ...t, text: null })),
      cases: yaoCaseList.cases.map((c) => c.id), // 爻位结构案例 + 卦级案例兜底（R2-1.5）
      commonMistakes: hex.myth ? [hex.myth] : [],
      practiceIds: ['dewei', 'zhong', ...(a.ying ? ['ying'] : []), ...(a.bi.length ? ['bi'] : [])],
      // ── 来源声明 · 经典片段关联（R2-1.5）──
      sourceInfo: {
        yaoci: { ...SOURCE_RECEIVED },
        xiaoxiang: { ...SOURCE_NEEDS_REVIEW },
      },
      classicPassageIds: [
        ...classicPassagesForYao(hex.seq, i).map((p) => p.id),
        ...(daXiang ? [daXiang.id] : []),
      ],
    }
  })

  return {
    id: `hex-${hex.seq}`,
    number: hex.seq,
    name: hex.name,
    traditionalName: hex.full, // 全称，如「乾为天」
    pinyin: PINYIN[hex.name] || null,
    sequences: hex.seq,
    upperTrigram: hex.upper,
    lowerTrigram: hex.lower,
    upperInfo: BAGUA[hex.upper] || null,
    lowerInfo: BAGUA[hex.lower] || null,
    binaryPattern: hex.lines, // 自下而上 1=阳 0=阴
    yinYangPattern: linesToSymbol(hex.lines), // 卦符（⚊/⚋）
    symbol: linesToSymbol(hex.lines),
    // ── 文本层（已核对）──
    guaci: hex.guaci, // 卦辞原文（通行本，公版）
    plain: hex.plain, // 白话学习解释（非唯一答案）
    // ── 结构层 ──
    yao, // 六爻 YaoProfile（自下而上）
    // ── 十翼层 ──
    tenWings: {
      tuan: { label: '彖传', node: TEN_WINGS_REF.tuan.node, text: null }, // 暂无可靠整理
      daxiang: { label: '大象', node: TEN_WINGS_REF.xiang.node, text: hex.imagery || null }, // 出自 hexagrams-data.imagery（已核对）
      xiaoxiang: { label: '小象（六条）', node: TEN_WINGS_REF.xiang.node, text: null },
      xici: { label: '系辞（相关）', node: TEN_WINGS_REF.xici.node, text: null },
      wenyan: hex.name === '乾' || hex.name === '坤'
        ? { label: '文言', node: TEN_WINGS_REF.wenyan.node, text: null }
        : null,
      shuogua: { label: '说卦（取象）', node: TEN_WINGS_REF.shuogua.node, text: null },
      xugua: { label: '序卦', node: TEN_WINGS_REF.xugua.node, text: null },
      zagua: { label: '杂卦', node: TEN_WINGS_REF.zagua.node, text: null },
    },
    // ── 解释传统层 ──
    interpretationTraditions: TRADITION_REF.map((t) => ({ ...t, text: null })),
    // ── 卦间关系 ──
    relations,
    // ── 意象 / 误读（已核对）──
    imagery: hex.imagery || null,
    myth: hex.myth || null,
    // ── 来源声明 / 经典片段 / 案例（R2-1.5）──
    sourceInfo: {
      guaci: { ...SOURCE_RECEIVED },
      yaoci: { ...SOURCE_RECEIVED },
      daxiang: { ...SOURCE_RECEIVED },
      tuan: { ...SOURCE_NEEDS_REVIEW },
      xiaoxiang: { ...SOURCE_NEEDS_REVIEW },
    },
    daXiang, // 象传·大象（单一数据源 imagery，见 classic-passages）
    classicPassageIds: hexClassicIds,
    caseIds: hexCaseIds,
  }
}

// ── 导出：64 档 + 384 爻 ＋ 索引 ─────────────────────────────
export const HEXAGRAM_PROFILES = HEXAGRAMS.map(buildProfile)

export const HEX_PROFILE_BY_SEQ = HEXAGRAM_PROFILES.reduce((acc, p) => {
  acc[p.number] = p
  return acc
}, {})

export const HEX_PROFILE_BY_NAME = HEXAGRAM_PROFILES.reduce((acc, p) => {
  acc[p.name] = p
  return acc
}, {})

export const HEX_PROFILE_BY_LINES = HEXAGRAM_PROFILES.reduce((acc, p) => {
  acc[p.binaryPattern] = p
  return acc
}, {})

export function getHexagramProfile(seqOrNameOrLines) {
  if (typeof seqOrNameOrLines === 'number') return HEX_PROFILE_BY_SEQ[seqOrNameOrLines] || null
  const s = String(seqOrNameOrLines).trim()
  // 先匹配 6 位二进制卦符（如 111111 / 000000），再匹配卦序数字（如 '1'～'64'）
  if (/^[01]{6}$/.test(s)) return HEX_PROFILE_BY_LINES[s] || null
  if (/^\d+$/.test(s)) return HEX_PROFILE_BY_SEQ[Number(s)] || null
  return HEX_PROFILE_BY_NAME[s] || null
}

// 384 爻的扁平索引：每爻可独立检索 / 学习
export const ALL_YAO = HEXAGRAM_PROFILES.flatMap((p) => p.yao)

export const YAO_BY_ID = ALL_YAO.reduce((acc, y) => {
  acc[y.id] = y
  return acc
}, {})

export function getYaoById(id) {
  return YAO_BY_ID[id] || null
}

export function getYao(hexagramSeqOrName, positionIndex) {
  const p = getHexagramProfile(hexagramSeqOrName)
  if (!p || positionIndex < 0 || positionIndex > 5) return null
  return p.yao[positionIndex]
}

// 便捷：由任意卦名/序号/六爻串还原卦对象（与 getHexagramProfile 一致）
export { getHexagram as getHexagramRaw } from './hexagramTools'