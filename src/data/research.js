// ============================================================
// 🎓 综合研究院（Research Institute）——确定性数据源
//
// 四个专题：
//   synthesis  跨知识综合分析：一张盘，六个维度，你自己决定从哪里开始
//   transfer   迁移挑战：把一个学院的结构，搬到另一个学院的陌生案例
//   research   研究模式：给一个问题，读资料 → 提取观点 → 比较 → 证据 → 解释 → 局限
//   master     出师挑战：完全陌生复杂案例，全程不主动提示，完成后生成能力报告
//
// 纪律：全部内容确定性给出，不依赖任何外部接口；文本只引用本产品已有
// 课程节点与案例（不编造新来源）；涉及流派差异时标注传统，不做唯一答案。
// ============================================================

// ── 跨知识综合分析（synthesis）────────────────────────────
// 工作台案例：case-050「两个身强，两种活法」（trainingTag: synthesis）
export const SYNTHESIS_CASE_ID = 'case-050'

// 六个分析维度（顺序由用户选择入口后按此规范序展开）
export const SYNTHESIS_DIMENSIONS = [
  {
    id: 'dim-info',
    label: '提取信息',
    emoji: '🔎',
    refNode: 'sy-method',
    question: '面对「两个身强」这组信息，第一步该确认什么？',
    options: [
      { text: '先确认两人的日主、月令、财官食伤的分布，把信息列成表', correct: true },
      { text: '先数两人八字里同五行的字有几个', correct: false },
      { text: '先查「身强」是什么意思，其余慢慢来', correct: false },
    ],
    keyPoint: '信息提取按六要素核对，而不是先数数量。「身强」是结论标签，不是起点信息。',
  },
  {
    id: 'dim-structure',
    label: '判断结构',
    emoji: '🏗️',
    refNode: 'pt-vs-strength',
    question: '甲「身强无依」与乙「身强有泄」的结构差别，本质是？',
    options: [
      { text: '甲缺可用可泄的对象，乙有食伤财星的出口——强弱是承重，结构是内容', correct: true },
      { text: '甲身强更纯粹，所以结构更优', correct: false },
      { text: '两人都是身强，结构应该一样', correct: false },
    ],
    keyPoint: '同一强弱水平，结构可以完全不同：有没有可担、可泄、可制的东西，决定了「强」往哪里去。',
  },
  {
    id: 'dim-strength',
    label: '强弱定位',
    emoji: '⚖️',
    refNode: 'ds-combine',
    question: '「身强」在这里的正确理解是？',
    options: [
      { text: '承重能力的描述，不代表好坏，也不代表两人的命运一样', correct: true },
      { text: '身强就是命好，身弱就是命差', correct: false },
      { text: '身强说明这人意志坚定，做什么都能成', correct: false },
    ],
    keyPoint: '强弱回答「结构需不需要调节」，不回答「命好不好」。把强弱当人生标签，是常见误读。',
  },
  {
    id: 'dim-time',
    label: '时间系统',
    emoji: '⏳',
    refNode: 'lk-layers',
    question: '甲（无依）若逢食伤财星大运，最接近结构思维的解读是？',
    options: [
      { text: '大运在原局结构上补缺或引动，无依之身可能获得出口', correct: true },
      { text: '原局已经定死，大运改变不了任何事', correct: false },
      { text: '大运来了就一定能翻身，不需要再看结构', correct: false },
    ],
    keyPoint: '时间系统与结构是配合关系：大运负责在既有结构上补缺或引动，而不是凭空改写。',
  },
  {
    id: 'dim-compare',
    label: '解释比较',
    emoji: '🔄',
    refNode: 'sy-multi',
    question: '两位分析者对甲的看法不同，最该用什么标准比较？',
    options: [
      { text: '看内部自洽性、解释力、与规则的一致性，而不是谁名气大', correct: true },
      { text: '看谁说得更肯定，谁就更可信', correct: false },
      { text: '两种说法都听过，说明这体系没标准', correct: false },
    ],
    keyPoint: '多解释并存时，比较标准是自洽性、解释力、可检验性与规则一致性——不是站队。',
  },
  {
    id: 'dim-conclusion',
    label: '结论与边界',
    emoji: '🚧',
    refNode: 'unc-calibration',
    question: '对「身强无依」最负责的结论表述是？',
    options: [
      { text: '结构上旺气缺出口，属于等待时运补缺的状态，并标注不确定性', correct: true },
      { text: '甲这辈子没出息', correct: false },
      { text: '甲需要改名补财', correct: false },
    ],
    keyPoint: '负责任结论 = 结构描述 + 时间变量 + 不确定性标注。三个部分缺一不可。',
  },
]

// ── 迁移挑战（transfer）───────────────────────────────────
// 三步骤协议：①回顾结构 → ②面对陌生场景 → ③迁移应用 + 反例自检
export const TRANSFER_PROTOCOL = [
  {
    id: 't1',
    title: '回顾结构',
    desc: '先把你已经掌握的结构写下来：它解决什么问题、由哪几部分构成、在什么条件下成立。',
  },
  {
    id: 't2',
    title: '面对陌生场景',
    desc: '把同一结构放进另一个学院的陌生案例。先别急着套，确认这个场景里「结构对应物」是什么。',
  },
  {
    id: 't3',
    title: '迁移应用与反例',
    desc: '写出迁移结论，再用你学过的反例习惯自检：什么情况下这个迁移会不成立？',
  },
]

// 迁移自检清单（勾选式，来自方法论反例训练）
export const TRANSFER_SELFCHECK = [
  { id: 'sc1', text: '我确认了两个场景里的「结构对应物」是什么，而不是照搬术语' },
  { id: 'sc2', text: '我列出了这个迁移成立的边界条件' },
  { id: 'sc3', text: '我想到了一个让迁移不成立的反例或例外' },
  { id: 'sc4', text: '我区分了「结构相同」与「结论相同」——结构能搬，结论未必能搬' },
]

// ── 研究模式（research）───────────────────────────────────
export const RESEARCH_QUESTION = {
  id: 'rq-strength-schools',
  title: '强弱判断：数数量 vs 看结构',
  emoji: '🧪',
  question: '日主强弱的判断里，「数同类字的数量」与「看令、地、势的整体结构」两种做法一直并存。它们各自的立场是什么？分歧点在哪里？什么证据能支持其中一方？',
  materials: [
    {
      id: 'm1',
      from: '课程节点 ds-count「数量误区」',
      stance: '数量派',
      excerpt: '数「日主同类字有几个」来判断强弱，是现代网络最常见的做法。它的吸引力在于简单、可计数、能立刻给出答案。',
      source: '《日主强弱》· 数量误区（本产品课程节点 ds-count）',
    },
    {
      id: 'm2',
      from: '课程节点 ds-combine「整体结构」',
      stance: '结构派',
      excerpt: '强弱判断 = 令、地、势三者综合权衡：得令看月令，得地看通根，得势看帮扶。没有单一公式，要把整体摆在一起看。',
      source: '《日主强弱》· 整体结构（本产品课程节点 ds-combine）',
    },
    {
      id: 'm3',
      from: '案例 case-046「数量不等于强弱」',
      stance: '案例证据',
      excerpt: '专门用于破除「数数量」误区的训练案例：一张盘数量上「同类字」不少，但结构上无根无令，实际很弱。数量与强弱可以背离。',
      source: '案例 case-046（本产品案例库）',
    },
    {
      id: 'm4',
      from: '课程节点 ds-myths「常见误区」',
      stance: '边界提醒',
      excerpt: '流派结论不能当铁律：不同传统对「根」「令」「势」的权重设定不同，判定强弱要先声明自己用的规则，再给结论。',
      source: '《日主强弱》· 常见误区（本产品课程节点 ds-myths）',
    },
  ],
  steps: [
    { id: 's1', title: '提取观点', desc: '分别用一句话写出「数量派」与「结构派」各自的核心主张。' },
    { id: 's2', title: '列表比较', desc: '比较两派：各自在什么情况下说得通？分歧点集中在哪个环节（根？令？权重？）。' },
    { id: 's3', title: '找证据', desc: '上面四份资料里，哪些主张有课程或案例支持？哪些只是说法？' },
    { id: 's4', title: '我的解释', desc: '综合资料，写出你目前对「数量 vs 结构」之争的解释。' },
    { id: 's5', title: '指出局限', desc: '你的解释在什么情况下不成立？还缺什么信息才能进一步判断？' },
    { id: 's6', title: '研究笔记', desc: '把上面的内容整理成一份研究笔记保存，之后可以回来修订。' },
  ],
}

// ── 出师挑战（master）─────────────────────────────────────
// 使用陌生复杂案例 case-054（trainingTag: strange，Level 5）
export const MASTER_CASE_ID = 'case-054'
export const MASTER_ELIGIBILITY_NOTE =
  '建议：先掌握至少 4 个知识点、完成过综合案例再进入。挑战全程不主动提示，主动请求提示会影响独立性评分。'
