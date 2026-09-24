// ============================================================
// 每日谜题：2 分钟的小挑战，用一个反常识问题勾住人。
// ============================================================

export const PUZZLES = [
  {
    id: 'puzzle-001',
    question: '两个人都说自己「缺水」。你觉得他们应该得到同样的建议吗？',
    teaser: '网上都说「缺水就补水」。但同样是水「少」，两个人需要的却很可能是两种完全不同的东西。',
    options: [
      { text: '当然，缺水就补水', correct: false, explain: '如果把「水」只当成一个要凑齐的数量，你就会错过它背后的结构。' },
      { text: '不一定，要看水在各自盘里的角色', correct: true, explain: '对。水是「被需要的调候」「被克的对象」还是「专气」，角色不同，处理就完全不同。' },
      { text: '完全不知道', correct: false, explain: '不知道是正常的——但这正是「先别急着给建议」的理由。' },
    ],
  },
  {
    id: 'puzzle-002',
    question: '「木多的人一定木旺」，这句话成立吗？',
    teaser: '直觉上，数量多就该强。可旺衰判断偏偏总在打脸这个直觉。',
    options: [
      { text: '成立，数量越多越旺', correct: false, explain: '数量陷阱。旺衰还要看得令、得地、得势。' },
      { text: '不成立，要看结构与季节', correct: true, explain: '对。秋金当令时，木再多也可能不强。' },
      { text: '时对时错', correct: false, explain: '「时对时错」不是判断，而是回避了真正的结构分析。' },
    ],
  },
  {
    id: 'puzzle-003',
    question: '「七杀」这个名字很凶，那带七杀的人一定不好吗？',
    teaser: '名字会骗人。七杀首先是一个「关系标签」，不是一句判决。',
    options: [
      { text: '一定会凶', correct: false, explain: '把关系标签当成了品行判词。' },
      { text: '不一定，它只是「克我且同阴阳」的关系', correct: true, explain: '对。是鞭策还是压迫，要看全局配比。' },
      { text: '七杀其实是吉神', correct: false, explain: '反向贴标签同样不可取——它是中性的关系。' },
    ],
  },
  {
    id: 'puzzle-004',
    question: '起卦的本质，是在「问神」吗？',
    teaser: '铜钱一抛卦就出来了。可换个数字卦就换一个，神难道也随便改主意？',
    options: [
      { text: '是，卦是神的指示', correct: false, explain: '把「规则可复现」的过程，理解成了超自然通灵。' },
      { text: '不是，是生成一个用来结构化思考的符号框架', correct: true, explain: '对。起卦的价值在「框架」，让你换个角度想问题，而不是替你想。' },
      { text: '看情况', correct: false, explain: '「看情况」回避了起卦的本质：一套透明的规则。' },
    ],
  },
  {
    id: 'puzzle-005',
    question: '「你今年会遇贵人」这句话，靠什么判断它值不值得信？',
    teaser: '越肯定的话，越要问一句：凭什么？',
    options: [
      { text: '看它有没有过程、能不能被核对', correct: true, explain: '对。能说清依据、可被检验的说法，可信度才分得出高下。' },
      { text: '看对方名气大不大', correct: false, explain: '名气和「这条判断准不准」没有必然关系。' },
      { text: '说得越肯定越可信', correct: false, explain: '恰恰相反——越肯定又越不给你过程，越要小心。' },
    ],
  },
  {
    id: 'puzzle-006',
    question: '「被克」在五行里，一定是坏事吗？',
    teaser: '一听到「克」就紧张的人，可能没想过：没有克，五行体系会失衡。',
    options: [
      { text: '一定是坏事', correct: false, explain: '把中性的调控关系，当成了奖惩。' },
      { text: '不一定，克是维持平衡的调控', correct: true, explain: '对。适度是约束，过载才是破坏。' },
      { text: '一定是好事', correct: false, explain: '反向绝对化也是错，关键在「度」和全局。' },
    ],
  },
  {
    id: 'puzzle-007',
    question: '同一组「乾坤」，位置换一下意思就变，这说明什么？',
    teaser: '上乾下坤是「否」，上坤下乾是「泰」。位置，就是六十四卦的秘密。',
    options: [
      { text: '上下内外的秩序本身就有含义', correct: true, explain: '对。上卦在外、下卦在内，位置的上下状态直读入卦义。' },
      { text: '卦名是随便乱起的', correct: false, explain: '卦名的差别，恰恰来自结构的差别。' },
      { text: '这是玄学的故弄玄虚', correct: false, explain: '这不是故弄玄虚，而是一套有规则的符号结构。' },
    ],
  },
]

export const PUZZLE_BY_ID = PUZZLES.reduce((acc, p) => {
  acc[p.id] = p
  return acc
}, {})

// 按日期稳定选择当天谜题（不依赖联网，可复现）
export function puzzleForDate(dateStr = null) {
  const d = dateStr || new Date().toISOString().slice(0, 10)
  let seed = 0
  for (let i = 0; i < d.length; i++) seed = (seed * 31 + d.charCodeAt(i)) >>> 0
  return PUZZLES[seed % PUZZLES.length]
}