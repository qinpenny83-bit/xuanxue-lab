// ============================================================
// 梅花易数案例（CASES_MEIHUA_1，case-mh-01 ~ case-mh-02）
// 主题：体用 / 互卦
// 关联课程节点来自易经学院（hc-* 变化、ic-shu 数、yx-shaoyong 邵雍）
// 与术数思想史（hs-sy-meihua 梅花易数传统）。
// ============================================================

export const CASES_MEIHUA_1 = [
  {
    id: 'case-mh-01',
    title: '体卦生用卦，结果就不好？',
    difficulty: 1,
    level: 1,
    levelName: '入门',
    category: 'meihua',
    blindTest: false,
    subject: '一位学梅花易数的人',
    minutes: 6,
    relatedNodes: ['hs-sy-meihua', 'hc-benbian', 'yx-shaoyong'],
    trainingTag: 'mislead',
    infoSufficiency: 'sufficient',
    mode: 'guided',
    situation: [
      '他学梅花易数，起卦后分体用：本卦上卦为体，下卦为用。',
      '他的卦里体卦生用卦，网上口诀说「体生用，泄气，主耗损」。',
      '他有点慌，觉得自己问的事要赔钱。',
    ],
    chartLabel: '体用生克与完整断法',
    chart: [
      { key: '体卦', value: '代表求测者/主体' },
      { key: '用卦', value: '代表所测之事/客体；体生用 = 泄气之象（传统说法）' },
    ],
    challenges: [
      {
        type: 'choice',
        dimension: 'rule',
        prompt: '关于「体生用」，最接近梅花体系内处理方式的是？',
        options: [
          { text: '体生用是「泄气」类结构标记，但还要看体用旺衰、互变卦与季节，不能单点定吉凶', points: 3, feedback: '对，口诀只是速记。' },
          { text: '体生用就是要破财', points: 0, errorType: 'E01', feedback: '把结构标记直接翻译成破财。' },
          { text: '体生用就是好事，付出有回报', points: 0, errorType: 'E01', feedback: '又跳到相反的极端。' },
        ],
      },
      {
        type: 'choice',
        dimension: 'reasoning',
        prompt: '「网上口诀」与「完整断法」的关系是？',
        options: [
          { text: '口诀是入门速记，完整断法要叠加旺衰、互变卦与应期，口诀不能直接当结论', points: 3, feedback: '对，路标不等于终点。' },
          { text: '口诀就是全部规则', points: 0, errorType: 'E01', feedback: '把速记当成了完整规则。' },
          { text: '口诀是错的，应该反过来读', points: 0, errorType: 'E03', feedback: '不是口诀错，是用法太粗。' },
        ],
      },
      {
        type: 'analysis',
        dimension: 'evidence',
        prompt: '要判断这卦吉凶倾向，你需要什么信息？',
        keywords: ['体用旺衰', '互卦', '变卦', '季节', '月建', '所问之事', '体用关系'],
        placeholder: '例如：体用二卦谁旺谁衰、互卦变卦如何参与、当前季节对体用的生克影响……',
      },
      {
        type: 'conclusion',
        dimension: 'boundary',
        prompt: '关于「体生用」，最合理的结论是？',
        options: [
          { text: '体生用是耗泄倾向的结构标记，是否成立要看旺衰与辅助卦象；单凭这一条不足以判断吉凶', points: 3, feedback: '对，单点结构标记不能定吉凶。' },
          { text: '体生用就是大凶', points: 0, errorType: 'E01', feedback: '把结构标记当成判决。' },
          { text: '无法判断，所以口诀不可信', points: 0, errorType: 'E03', feedback: '口诀是速记不是结论；按旺衰互变完整走一遍流程，判断是可以形成的。' },
        ],
      },
      {
        type: 'confidence',
        dimension: 'over',
        prompt: '你对「口诀是路标，不是终点」的信心是多少？',
      },
    ],
    reveal: {
      realBackground: '梅花易数以体用生克为核心语言：体生用传统上被视为「泄气」之象，但完整判断要结合体用旺衰、互卦、变卦与季节月建；口诀只是速记。',
      expectedReasoning: '正确路径：定体用 → 看生克关系 → 看旺衰（季节月建）→ 看互变卦 → 组合成吉凶倾向，而不是背完口诀就下结论。',
      otherMayHold: '不同梅花流派对体用生克的权重有差异：有的重体用旺衰，有的重外应，有的重变卦；口诀在各派中的优先级也不同。',
      takeaway: '口诀是路标，不是终点。',
    },
    commonMistakes: ['背口诀直接定吉凶（E01）。', '忽略旺衰与互变卦（E01）。', '把口诀当普遍规则（E03）。'],
  },
  {
    id: 'case-mh-02',
    title: '互卦到底要不要看？',
    difficulty: 2,
    level: 2,
    levelName: '基础',
    category: 'meihua',
    blindTest: false,
    subject: '一位自学梅花的人',
    minutes: 7,
    relatedNodes: ['hc-mutual', 'hs-sy-meihua', 'ic-shu'],
    trainingTag: 'multi',
    infoSufficiency: 'insufficient',
    mode: 'guided',
    situation: [
      '他起卦后排出互卦，网上有人说「互卦看过程、中间阶段」，有人说「互卦可以不用，直接看体用与变卦」。',
      '两个说法他都见过，不知道哪个对。',
      '他想知道：互卦在梅花里到底是什么地位。',
    ],
    chartLabel: '互卦地位的两种说法',
    chart: [
      { key: '说法 A', value: '互卦看事情中间过程与隐藏因素' },
      { key: '说法 B', value: '互卦可省略，主看体用与变卦' },
    ],
    challenges: [
      {
        type: 'choice',
        dimension: 'rule',
        prompt: '关于互卦的地位，最接近梅花传统的是？',
        options: [
          { text: '互卦在多数梅花传统里用于补充「中间阶段」的信息，但不同流派对其权重看法不一', points: 3, feedback: '对，互卦是工具，权重因流派而异。' },
          { text: '互卦必须看，不看就断不准', points: 0, errorType: 'E03', feedback: '把某派用法当成普遍规则。' },
          { text: '互卦完全没用，是后人加的', points: 0, errorType: 'E06', feedback: '否认传统来源是没有查证的断言。' },
        ],
      },
      {
        type: 'choice',
        dimension: 'reasoning',
        prompt: '两个网上说法矛盾时，最合理的处理是？',
        options: [
          { text: '先确认各自流派背景，再在自己的断卦流程里测试互卦是否增加有效信息', points: 3, feedback: '对，用案例验证而不是用热度投票。' },
          { text: '信点赞多的那个', points: 0, errorType: 'E03', feedback: '热度不是依据。' },
          { text: '两个都背下来，混着用', points: 0, errorType: 'E01', feedback: '混用两套权重规则会让断卦失去一致性。' },
        ],
      },
      {
        type: 'analysis',
        dimension: 'evidence',
        prompt: '要判断互卦在你的流程里是否值得用，你需要什么？',
        keywords: ['流派', '断卦流程', '互卦信息', '应验', '变卦', '体用', '案例对比'],
        placeholder: '例如：互卦在具体案例里是否补充了中间过程的信息、去掉互卦后结论是否变化、你跟随的流派怎么用……',
      },
      {
        type: 'conclusion',
        dimension: 'boundary',
        prompt: '关于互卦，最负责任的结论是？',
        options: [
          { text: '互卦是流派工具而非普遍铁律：用不用、怎么用取决于流派与个人流程；证据不足时，无法判断互卦在该卦中是否关键', points: 3, feedback: '对，先认流派，再谈用不用。' },
          { text: '互卦一定要用', points: 0, errorType: 'E03', feedback: '把流派用法当成普遍铁律。' },
          { text: '互卦一定不要用', points: 0, errorType: 'E03', feedback: '又跳到另一个极端。' },
        ],
      },
      {
        type: 'confidence',
        dimension: 'over',
        prompt: '你对「互卦是工具不是铁律」的信心是多少？',
      },
    ],
    reveal: {
      realBackground: '互卦（二三四爻与三四五爻重组的卦）在梅花传统中常被用于看中间过程，但《梅花易数》文本与后世流派的用法并不完全一致，有的流派重互卦，有的简化不用。',
      expectedReasoning: '正确路径：了解互卦的构造与常见用法 → 识别自己跟随的流派 → 在案例中对比用与不用互卦的差异 → 形成自己的流程，而不是背网上的说法。',
      otherMayHold: '「互卦是否必要」本身就是梅花内部的分歧点；有的流派还加入外应、体用互变等多层信息，取舍标准各派不同。',
      takeaway: '互卦是工具不是铁律——先认流派，再谈用不用。',
    },
    commonMistakes: ['把互卦当必须步骤（E03）。', '以网上热度代替流派依据（E03）。', '混用两套权重规则（E01）。'],
  },
]
