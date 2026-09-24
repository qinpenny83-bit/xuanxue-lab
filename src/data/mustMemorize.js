// ============================================================
// 📖 必背速记（R10）
// 定位：记忆自测工具，不是知识库——术语百科负责「查」，这里负责「记 + 测」。
// 分层与求学主线对齐：
//   L1 字母表   —— 干支、五行、八卦（主线 S1-S2 对应）
//   L2 规则口诀 —— 合化、六合、六冲、三合（主线 S3-S4 对应）
//   L3 64 卦    —— 卦名 + 卦序 + 全称 + 意象（从 hexagrams-data 确定性生成）
//   L4 神煞口诀 —— 常用神煞查法（传承口诀，通行说法，各派查法有差异）
// 原则：
//   1. 条目内容全部来自通行通识 / 现有课程节点 / hexagrams-data，禁止编造。
//   2. 神煞口诀为「传统传承信息」，标注各派差异，不作吉凶断言。
//   3. 条目带 sourceNode（来源课程节点）或 source 说明，可跳转复习。
// ============================================================

import { HEXAGRAMS } from './iching/hexagrams-data'

// 知识节点 → 对应课程 id（「去课程复习」跳转目标，来自 src/data/lessons.js）
const LESSON_OF_NODE = {
  'sb-stems': 'lesson-heavenly-stems',
  'sb-branches': 'lesson-earthly-branches',
  'wx-generate': 'lesson-generating-restraining',
  'wx-restrain': 'lesson-generating-restraining',
  'bg-genesis': 'lesson-bagua',
  'rel-concept': 'lesson-branch-relations',
  'rel-six-he': 'lesson-branch-relations',
  'rel-six-chong': 'lesson-branch-relations',
  'rel-three-he': 'lesson-branch-relations',
}

// —— 条目结构：{ id, group, front, back, tip, sourceNode?, source? } ——

// ── L1 字母表：十天干（阴阳 + 五行 + 方位对应） ──────────────
const STEMS = [
  { c: '甲', yinYang: '阳', element: '木' },
  { c: '乙', yinYang: '阴', element: '木' },
  { c: '丙', yinYang: '阳', element: '火' },
  { c: '丁', yinYang: '阴', element: '火' },
  { c: '戊', yinYang: '阳', element: '土' },
  { c: '己', yinYang: '阴', element: '土' },
  { c: '庚', yinYang: '阳', element: '金' },
  { c: '辛', yinYang: '阴', element: '金' },
  { c: '壬', yinYang: '阳', element: '水' },
  { c: '癸', yinYang: '阴', element: '水' },
]

// ── L1 字母表：十二地支（五行 + 生肖 + 时辰 + 阴阳） ──────────
const BRANCHES = [
  { c: '子', element: '水', zodiac: '鼠', hour: '23-1', yinYang: '阳' },
  { c: '丑', element: '土', zodiac: '牛', hour: '1-3', yinYang: '阴' },
  { c: '寅', element: '木', zodiac: '虎', hour: '3-5', yinYang: '阳' },
  { c: '卯', element: '木', zodiac: '兔', hour: '5-7', yinYang: '阴' },
  { c: '辰', element: '土', zodiac: '龙', hour: '7-9', yinYang: '阳' },
  { c: '巳', element: '火', zodiac: '蛇', hour: '9-11', yinYang: '阴' },
  { c: '午', element: '火', zodiac: '马', hour: '11-13', yinYang: '阳' },
  { c: '未', element: '土', zodiac: '羊', hour: '13-15', yinYang: '阴' },
  { c: '申', element: '金', zodiac: '猴', hour: '15-17', yinYang: '阳' },
  { c: '酉', element: '金', zodiac: '鸡', hour: '17-19', yinYang: '阴' },
  { c: '戌', element: '土', zodiac: '狗', hour: '19-21', yinYang: '阳' },
  { c: '亥', element: '水', zodiac: '猪', hour: '21-23', yinYang: '阴' },
]

// ── L1 字母表：八卦（卦符 + 自然象 + 德性） ──────────────────
const BAGUA = [
  { c: '乾', symbol: '☰', nature: '天', virtue: '健' },
  { c: '兑', symbol: '☱', nature: '泽', virtue: '说（悦）' },
  { c: '离', symbol: '☲', nature: '火', virtue: '丽（附丽）' },
  { c: '震', symbol: '☳', nature: '雷', virtue: '动' },
  { c: '巽', symbol: '☴', nature: '风', virtue: '入' },
  { c: '坎', symbol: '☵', nature: '水', virtue: '陷' },
  { c: '艮', symbol: '☶', nature: '山', virtue: '止' },
  { c: '坤', symbol: '☷', nature: '地', virtue: '顺' },
]

// ── L2 规则口诀：天干五合 ────────────────────────────────────
const STEM_COMBINE = [
  { a: '甲', b: '己', element: '土' },
  { a: '乙', b: '庚', element: '金' },
  { a: '丙', b: '辛', element: '水' },
  { a: '丁', b: '壬', element: '木' },
  { a: '戊', b: '癸', element: '火' },
]

// ── L2 规则口诀：地支六合 ────────────────────────────────────
const BRANCH_SIX_COMBINE = [
  { a: '子', b: '丑', element: '土' },
  { a: '寅', b: '亥', element: '木' },
  { a: '卯', b: '戌', element: '火' },
  { a: '辰', b: '酉', element: '金' },
  { a: '巳', b: '申', element: '水' },
  { a: '午', b: '未', element: '土' },
]

// ── L2 规则口诀：地支六冲 ────────────────────────────────────
const BRANCH_SIX_CLASH = [
  { a: '子', b: '午' },
  { a: '丑', b: '未' },
  { a: '寅', b: '申' },
  { a: '卯', b: '酉' },
  { a: '辰', b: '戌' },
  { a: '巳', b: '亥' },
]

// ── L2 规则口诀：三合局 ──────────────────────────────────────
const BRANCH_TRIPLE = [
  { group: '申子辰', element: '水局' },
  { group: '寅午戌', element: '火局' },
  { group: '巳酉丑', element: '金局' },
  { group: '亥卯未', element: '木局' },
]

// ── L4 神煞口诀（传承信息，通行说法；查法与取用各派有差异，不作吉凶断言） ──
const SHENSHA = [
  {
    name: '天乙贵人',
    rule: '甲戊庚牛羊，乙己鼠猴乡，丙丁猪鸡位，壬癸兔蛇藏，六辛逢虎马，此是贵人方。',
    note: '以日干查地支，是命理传统中最常提的吉神之一；查法与取用各派略有差异。',
  },
  {
    name: '文昌贵人',
    rule: '甲巳乙午丙戊申，丁己酉位庚亥临，辛子壬寅癸逢卯，文昌入命利文星。',
    note: '以日干查地支；口诀版本有差异，此处采通行说法，寓意「利文书、学习」属传统观念。',
  },
  {
    name: '驿马',
    rule: '申子辰马在寅，寅午戌马在申，巳酉丑马在亥，亥卯未马在巳。',
    note: '按年支或日支查；传统读作「走动、出行」的符号，不直接等于「奔波好坏」。',
  },
  {
    name: '桃花（咸池）',
    rule: '申子辰在酉，寅午戌在卯，巳酉丑在午，亥卯未在子。',
    note: '按年支或日支查；传统读作「人缘、魅力」的符号，网络常把桃花夸大为「感情注定」，属过度解释。',
  },
  {
    name: '华盖',
    rule: '申子辰见辰，寅午戌见戌，巳酉丑见丑，亥卯未见未。',
    note: '按年支或日支查；传统读作「孤高、艺术、宗教」倾向的符号，属传统说法。',
  },
  {
    name: '羊刃',
    rule: '甲刃在卯，丙戊刃在午，庚刃在酉，壬刃在子。',
    note: '阳干论刃，阴干一般不取羊刃（各派不同）；传统读作「旺极、刚烈」的符号，不是简单的吉凶标记。',
  },
  {
    name: '禄神',
    rule: '甲禄在寅，乙禄在卯，丙戊禄在巳，丁己禄在午，庚禄在申，辛禄在酉，壬禄在亥，癸禄在子。',
    note: '天干临官为禄，按日干查；传统读作「衣禄、资源」的符号，属传统说法。',
  },
  {
    name: '空亡',
    rule: '甲子旬空戌亥，甲戌旬空申酉，甲申旬空午未，甲午旬空辰巳，甲辰旬空寅卯，甲寅旬空子丑。',
    note: '六甲旬中旬首之外的两支为空亡；传统读作「虚、落空」的符号，须结合整体结构，不可单看。',
  },
]

// ── L3：64 卦条目（从 hexagrams-data 确定性生成，不手写） ─────
function buildHexItems() {
  return HEXAGRAMS.map((h) => ({
    id: `hx-${h.seq}`,
    group: 'hex64',
    front: `第 ${h.seq} 卦`,
    back: `${h.name} · ${h.full}（上${h.upper}下${h.lower}）`,
    tip: h.imagery || h.guaci,
    source: '通行本《周易》卦序',
  }))
}

// ── 组装分组 ────────────────────────────────────────────────
const groupL1 = {
  id: 'alpha',
  label: 'L1 字母表',
  emoji: '🔤',
  stage: 'S1-S2',
  desc: '干支、五行、八卦——看懂一切盘面的「字母表」。',
  items: [
    ...STEMS.map((s) => ({
      id: `stem-${s.c}`,
      group: 'alpha',
      front: `十天干：${s.c}`,
      back: `${s.c} = ${s.yinYang}${s.element}`,
      tip: '天干是八字最上层的符号，每个干带阴阳 + 五行双重属性。',
      sourceNode: 'sb-stems',
    })),
    ...BRANCHES.map((b) => ({
      id: `branch-${b.c}`,
      group: 'alpha',
      front: `十二地支：${b.c}`,
      back: `${b.c} = ${b.element} · 生肖${b.zodiac} · ${b.hour}时 · ${b.yinYang}`,
      tip: '地支是「位置与时间」的符号：五行属性 + 时间坐标 + 生肖。',
      sourceNode: 'sb-branches',
    })),
    {
      id: 'wx-sheng',
      group: 'alpha',
      front: '五行相生',
      back: '木 → 火 → 土 → 金 → 水 → 木（循环）',
      tip: '相生是「促进、滋养」的循环，不是单行道。',
      sourceNode: 'wx-generate',
    },
    {
      id: 'wx-ke',
      group: 'alpha',
      front: '五行相克',
      back: '木克土 → 土克水 → 水克火 → 火克金 → 金克木',
      tip: '相克是「约束、制衡」，是系统保持平衡的刹车，不等于凶。',
      sourceNode: 'wx-restrain',
    },
    ...BAGUA.map((g) => ({
      id: `bg-${g.c}`,
      group: 'alpha',
      front: `八卦：${g.c}`,
      back: `${g.c} ${g.symbol} = ${g.nature} · 其德为${g.virtue}`,
      tip: '八卦是「自然象 + 德性」的组合，先记象，再记德。',
      sourceNode: 'bg-genesis',
    })),
  ],
}

const groupL2 = {
  id: 'rules',
  label: 'L2 规则口诀',
  emoji: '🧮',
  stage: 'S3-S4',
  desc: '合化、六合、六冲、三合——干支关系的常用口诀。',
  items: [
    ...STEM_COMBINE.map((x) => ({
      id: `combine-${x.a}${x.b}`,
      group: 'rules',
      front: `天干五合：${x.a} + ${x.b}`,
      back: `${x.a}${x.b} 合${x.element}`,
      tip: '合 ≠ 合化：成化需要条件（月令、透干等），不能见合即断化。',
      sourceNode: 'rel-concept',
    })),
    ...BRANCH_SIX_COMBINE.map((x) => ({
      id: `sixh-${x.a}${x.b}`,
      group: 'rules',
      front: `地支六合：${x.a} + ${x.b}`,
      back: `${x.a}${x.b} 合${x.element}`,
      tip: '六合是「结合、牵绊、转化」的关系，结合可能是助力，也可能是锁链。',
      sourceNode: 'rel-six-he',
    })),
    ...BRANCH_SIX_CLASH.map((x) => ({
      id: `sixc-${x.a}${x.b}`,
      group: 'rules',
      front: `地支六冲：${x.a} 与 ${x.b}`,
      back: `${x.a}${x.b} 相冲`,
      tip: '冲有「掉、开、动」三种读法，不能一律断凶，先看被冲之物本身的状态。',
      sourceNode: 'rel-six-chong',
    })),
    ...BRANCH_TRIPLE.map((x) => ({
      id: `triple-${x.group}`,
      group: 'rules',
      front: `三合局：${x.group}`,
      back: `${x.group} 合${x.element}`,
      tip: '三合缺一位是半合，不是成局；成局还要看月令、冲克、透干。',
      sourceNode: 'rel-three-he',
    })),
  ],
}

const groupHex = {
  id: 'hex64',
  label: 'L3 六十四卦',
  emoji: '☯️',
  stage: 'S3-S5',
  desc: '卦名 + 卦序 + 全称 + 意象。理解「为什么 A 之后是 B」比死背序号更重要。',
  items: buildHexItems(),
}

const groupShensha = {
  id: 'shensha',
  label: 'L4 神煞口诀',
  emoji: '✨',
  stage: 'S5',
  desc: '常用神煞查法口诀（传承信息，通行说法；各派查法有差异，不作吉凶断言）。',
  items: SHENSHA.map((s) => ({
    id: `ss-${s.name}`,
    group: 'shensha',
    front: `神煞：${s.name}`,
    back: s.rule,
    tip: s.note,
    source: '传统命理传承口诀（通行说法，版本有差异）',
  })),
}

// 为所有带 sourceNode 的条目补充 lessonId（课程跳转目标）
function withLessonId(items) {
  return items.map((it) =>
    it.sourceNode && LESSON_OF_NODE[it.sourceNode] ? { ...it, lessonId: LESSON_OF_NODE[it.sourceNode] } : it
  )
}

export const MEMORIZE_GROUPS = [groupL1, groupL2, groupHex, groupShensha].map((g) => ({
  ...g,
  items: withLessonId(g.items),
}))

export const MEMORIZE_ALL_ITEMS = MEMORIZE_GROUPS.flatMap((g) => g.items)

export const MEMORIZE_ITEM_BY_ID = MEMORIZE_ALL_ITEMS.reduce((acc, it) => {
  acc[it.id] = it
  return acc
}, {})

export function getMemorizeItem(id) {
  return MEMORIZE_ITEM_BY_ID[id] || null
}

export function getMemorizeGroup(id) {
  return MEMORIZE_GROUPS.find((g) => g.id === id) || null
}

// 总条目数（供测试与页面展示）
export const MEMORIZE_TOTAL = MEMORIZE_ALL_ITEMS.length
