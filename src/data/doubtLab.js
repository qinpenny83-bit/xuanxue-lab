// ============================================================
// 怀疑实验室：训练对「玄学判断」的怀疑能力（不是科学课，是通过案例讲）。
// 五个核心认知偏差：巴纳姆效应 / 确认偏误 / 选择性记忆 / 事后解释 / 基准概率。
// ============================================================

export const DOUBT_BIASES = [
  { id: 'barnum', name: '巴纳姆效应', emoji: '🎭', oneLine: '模糊、对谁都成立的描述，让人误以为「只对自己准」。' },
  { id: 'confirmation', name: '确认偏误', emoji: '🔍', oneLine: '我们只留意「支持自己想法的证据」，忽略反对的。' },
  { id: 'selective-memory', name: '选择性记忆', emoji: '🧠', oneLine: '记住「说中的」，忘掉「没说中的」。' },
  { id: 'hindsight', name: '事后解释', emoji: '🔮', oneLine: '事情发生后，才「想通」当时就该知道，其实是事后贴金。' },
  { id: 'base-rate', name: '基准概率', emoji: '📊', oneLine: '判断一个说法时，忽略了「不靠玄学也大概率成立」这件事。' },
]

export const DOUBT_SCENARIOS = [
  {
    id: 'doubt-001',
    biasId: 'barnum',
    title: '它说中了，还是它对谁都适用？',
    claim: '「你外表很坚强，其实内心敏感，渴望被真正理解。」',
    setup: '这是玄学里最常见的「好事开头」。你听了心里一动：这说的不就是我吗？',
    question: '你认为这句话：',
    options: [
      { text: '很可信', overreach: true },
      { text: '有一定参考价值', mild: true },
      { text: '需要验证', mild: true },
      { text: '很可能是泛化描述', best: true },
    ],
    reveal: {
      why: '这句话几乎对每个人都成立——它没有包含任何「排他性」的具体信息。越模糊，越容易让每个人都觉得「在说自己」。',
      test: '一个最简单的检验：把它拿给十个不认识的人看，看看有多少人也会点头。',
    },
  },
  {
    id: 'doubt-002',
    biasId: 'confirmation',
    title: '你在找证据，还是在找认同？',
    claim: '一位命理师说「你今年有贵人运」，你立刻想起上个月有两个朋友帮了你。',
    setup: '但你记不起，去年他也说过类似的话，而那一年你并没有特别顺利。',
    question: '你更倾向于相信「今年有贵人运」，是因为：',
    options: [
      { text: '我找到了支持它的证据', mild: true },
      { text: '我只留意了支持它的事，忽略了反对的事', best: true },
      { text: '命理师从不会错', overreach: true },
    ],
    reveal: {
      why: '当你已经倾向于相信时，大脑会自动「点亮」支持它的记忆，同时把反对的例子悄悄熄灭。这就是确认偏误。',
      test: '逼自己列出三条「今年并没有贵人」的证据，再重新评估一次。',
    },
  },
  {
    id: 'doubt-003',
    biasId: 'selective-memory',
    title: '为什么「准的」总被记住？',
    claim: '某人说「你下个月有一笔小财」。下个月你捡到 50 块，觉得「神准」。',
    setup: '但他还说过另外 9 个预言，其中 8 个没应验——你却几乎忘了那些。',
    question: '「神准」的印象，最可能来自：',
    options: [
      { text: '他确实算得准', overreach: true },
      { text: '我只记住了说中的，忘掉了没说中的', best: true },
      { text: '偶然巧合', mild: true },
    ],
    reveal: {
      why: '记忆会「挑食」：说中的自带高光，没说中的被自动归档。于是命中率在你心里被严重放大了。',
      test: '下一次，把每一条预言都记下来，月底统一核对，看真实的命中率。',
    },
  },
  {
    id: 'doubt-004',
    biasId: 'hindsight',
    title: '「我早就知道会这样」',
    claim: '事情发生之后，有人恍然大悟：「现在回头看，你八字里那个冲，早就注定会分开。」',
    setup: '但同样的盘，在事情发生前，没有人能明确说出「会在何时、以何种方式分开」。',
    question: '这种「事后才看清」的解释，最可能的问题是什么？',
    options: [
      { text: '事后解释，用结果倒推含义', best: true },
      { text: '说明这个人高深', overreach: true },
      { text: '命盘本来就能预测', overreach: true },
    ],
    reveal: {
      why: '事后解释有两个漏洞：一是「马后炮」——发生前说不出来；二是「过度拟合」——任何结果都能从那套符号里找到对应。',
      test: '问一句关键的话：事前你能不能把它写下来、并说清时间和方式？',
    },
  },
  {
    id: 'doubt-005',
    biasId: 'base-rate',
    title: '不靠玄学，这事也大概率发生',
    claim: '命理师说「你今年事业会有一次重要变动」。这一年你果然换了工作。',
    setup: '但「今年多少有一点变动」这件事，对绝大多数正在上升期的人，本来就有不小的概率自然发生。',
    question: '判断这个预言「有多厉害」，最该先问什么？',
    options: [
      { text: '不靠这个预言，这件事本来发生的概率是多少', best: true },
      { text: '命理师口碑好不好', overreach: true },
      { text: '换工作的具体时间说准了没有', mild: true },
    ],
    reveal: {
      why: '如果「一年内有点工作变动」在现实里本就有一半以上概率发生，那说中它并不稀奇——这叫基准概率。越模糊的预言，基准概率越高。',
      test: '把预言拆到「具体、排他、可证伪」，再看它是否还说得中。',
    },
  },
  {
    id: 'doubt-006',
    biasId: 'barnum',
    title: '一组「你信了」的通用形容',
    claim: '「你有时外向健谈，有时又喜欢独处；你对自己要求高，但也会怀疑自己。」',
    setup: '看到这段描述，你几乎确信它是「私人定制」。但在心理学里，它是一段可以被放进任何人的通用文本。',
    question: '为什么这种描述会让人「信以为真」？',
    options: [
      { text: '因为它模糊到能容纳所有人的两面性', best: true },
      { text: '因为它真的只适合我', overreach: true },
      { text: '因为它说得很具体', overreach: true },
    ],
    reveal: {
      why: '每个人都同时拥有「外向与内向」「自信与怀疑」这样的两面，所以一段只描述两面的文字，天然命中所有人。',
      test: '把它里「对谁都成立」的成分划掉，看还剩多少是只关于你的。',
    },
  },
]

export const DOUBT_BY_ID = DOUBT_SCENARIOS.reduce((acc, s) => {
  acc[s.id] = s
  return acc
}, {})

export function getBiasName(biasId) {
  return DOUBT_BIASES.find((b) => b.id === biasId)?.name || '认知偏差'
}
export function getBias(biasId) {
  return DOUBT_BIASES.find((b) => b.id === biasId) || null
}