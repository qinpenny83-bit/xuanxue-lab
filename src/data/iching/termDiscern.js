// ============================================================
// ☯️ 易学辨析室（R2-2）· 概念边界数据集
//
// 目标：不是「定义题」，而是「先判断 → 看定义 → 看原典 → 看例子
//      → 看反例 → 看传统差异 → 再回答」的七步辨析流程。
// 每个辨析组必须给出：A/B 概念、一句话区别、为何会混淆、原典/结构例、
// 反例、关联卦/爻、相关传统、以及一个「先作答再看为什么」的练习。
//
// 原则：全部沿用 termData 里已核实的定义与结构规则，不另造口径；
//      引用原典只取 classic-passages 里已核对的 sv-* / wy-* 片段。
// ============================================================

// practice.options 为 2-4 个备选；answerIndex 为正确项下标（0 起）。
// 强调「证据强度 + 信心校准」，不做唯一「算命」答案。

export const DISCERNMENT_GROUPS = [
  // ── 基础 ─────────────────────────────────────────────
  {
    id: 'disc-yin-yang',
    termA: 'yin',
    termB: 'yang',
    title: '阴 vs 阳',
    oneLineDiff: '阴与阳是一对「相对且互补」的两极（静/动、柔/刚、内/外），不是两个固定不变、可单独定义的东西。',
    confusionReason: '最容易把阴阳读成「坏—好」或「女—男」的固定标签，从而给每一方贴上绝对价值。',
    examples: ['阳爻（⚊）与阴爻（⚋）就是阴阳在卦画里的符号化。', '《系辞上》「一阴一阳之谓道」，把「道」定义为阴阳相推的运行规律。'],
    counterExamples: ['六二（阴爻居阴位）可以「得位」，说明「阴」本身不是贬义。', '同一物属阴属阳，取决于「相对什么而言」，不是一成不变。'],
    relatedHexagramIds: [1, 2],
    relatedYaoIds: ['hx-2-1'],
    classicPassageIds: ['sv-01', 'sv-02'],
    traditionKeys: [],
    practice: {
      question: '关于阴阳，下列哪一种说法最准确？',
      options: [
        '阳是好的、阴是坏的',
        '阳是男性、阴是女性',
        '阴阳是相对且互补的两极，不是固定标签',
        '阴阳是两种固定不变的物质',
      ],
      answerIndex: 2,
      explain: '阴阳是「关系」不是「标签」：日与夜、动与静互为条件，判断属阴属阳要看「相对什么而言」。',
    },
  },

  {
    id: 'disc-gangrou-yinyang',
    termA: 'gangrou',
    termB: 'yinyang',
    title: '刚柔 vs 阴阳',
    oneLineDiff: '阴阳是最抽象的二分视角；刚柔是阴阳「落到爻与性质上」的具体体现（阳爻曰刚、阴爻曰柔）。',
    confusionReason: '两者常被当作完全同义词；其实「刚柔」强调的是性质与品质，「阴阳」强调的是相对关系。',
    examples: ['《系辞上》「动静有常，刚柔断矣」，把刚柔当作由动静分化出的具体性质。', '结构引擎里，阳爻记「刚」、阴爻记「柔」。'],
    counterExamples: ['说「这一爻属刚」比说「这一爻属阳」更强调它「刚健/进取」的性质倾向，而非单纯奇偶。'],
    relatedHexagramIds: [1, 2],
    relatedYaoIds: ['hx-1-0', 'hx-2-0'],
    classicPassageIds: ['sv-01'],
    traditionKeys: [],
    practice: {
      question: '「刚柔」和「阴阳」的关系，哪句最准确？',
      options: [
        '刚柔就是阴阳，可以完全互换',
        '刚柔是阴阳在「爻与性质」上的具体体现',
        '刚柔与阴阳无关',
        '刚柔是阴阳之外的另一套二分',
      ],
      answerIndex: 1,
      explain: '阴阳是一般关系，刚柔是它在卦爻里的体现：阳爻为刚、阴爻为柔，偏重性质。',
    },
  },

  {
    id: 'disc-gua-yao',
    termA: 'gua',
    termB: 'yao',
    title: '卦 vs 爻',
    oneLineDiff: '卦是「由六爻组成的整体符号」（一幅局面的象）；爻是「构成卦的一根线」（局面中的一个位置/一个环节）。',
    confusionReason: '卦、爻常被混称；其实「卦」是系统层，「爻」是单元层，一个卦里藏着六爻的细节。',
    examples: ['64 卦各由 6 爻重叠而成；6 爻 × 64 = 384 爻。', '说「乾卦」是看整体纯阳之象，说「乾九五」是看其中某一个具体位置。'],
    counterExamples: ['只谈「卦」容易忽略卦内不同位置的吉凶差异；只谈「爻」容易忽略整卦的格局。'],
    relatedHexagramIds: [1],
    relatedYaoIds: ['hx-1-0', 'hx-1-4'],
    classicPassageIds: [],
    traditionKeys: [],
    practice: {
      question: '「卦」与「爻」的关系，哪句最准确？',
      options: [
        '卦就是爻，只是叫法不同',
        '爻是组成卦的单元，卦是由多爻构成的整体',
        '只有爻没有卦',
        '卦是爻的一半',
      ],
      answerIndex: 1,
      explain: '一卦六爻，三画成八卦、重之为六画六十四卦；爻是单元、卦是整体。',
    },
  },

  // ── 结构 ─────────────────────────────────────────────
  {
    id: 'disc-zhong-zheng',
    termA: 'zhong',
    termB: 'zheng',
    title: '中 vs 正',
    oneLineDiff: '「中」讲位置：爻居二或五位；「正」讲配位：爻的阴阳与位置奇偶是否相配。两者是两套独立条件。',
    confusionReason: '「中」「正」字面都像在夸「对」，极易被当成一回事；其实中≠正，中且正才合称「中正」。',
    examples: ['乾九二（阳爻居二）得「中」但失「正」（二为阴位）。', '乾九五（阳爻居五）既「中」又「正」，才是「中正」。'],
    counterExamples: ['「得中」不等于「得正」：乾九二居中而不当位。', '「得正」也不一定「得中」：乾初九当位但不居中。'],
    relatedHexagramIds: [1],
    relatedYaoIds: ['hx-1-1', 'hx-1-4'],
    classicPassageIds: [],
    traditionKeys: [],
    practice: {
      question: '你认为下面哪一句更准确？',
      options: [
        '中就是正',
        '正就是中',
        '两者有关，但不是同一个概念',
        '完全无关',
      ],
      answerIndex: 2,
      explain: '「中」是位置（居二、五），「正」是阴阳与位置的相配；中而正的爻（如九五）才叫「中正」。',
    },
  },

  {
    id: 'disc-dewei-zhong',
    termA: 'dewei',
    termB: 'zhong',
    title: '得位 vs 中',
    oneLineDiff: '「得位」看阴阳与位置奇偶配不配；「中」只看是否居二、五之中位。得位不必然居中，居中不必然得位。',
    confusionReason: '两者都被当成「吉利」的加分项，容易误以为「得位」或「居中」本身就带来好处。',
    examples: ['乾九三「得位」（阳居阳位）但不居中。', '乾九二「居中」但「失位」（阳居阴位）。'],
    counterExamples: ['既不「得位」也不「居中」的爻，未必凶——还需结合应、比、时。', '「得位」不能直接等同于「吉」。'],
    relatedHexagramIds: [1],
    relatedYaoIds: ['hx-1-1', 'hx-1-2'],
    classicPassageIds: [],
    traditionKeys: [],
    practice: {
      question: '「得位」与「中」的关系，哪句准确？',
      options: [
        '得位者必居中',
        '居中者必得位',
        '两者是不同维度的结构条件，可同时也可只占其一',
        '两者完全没有关系',
      ],
      answerIndex: 2,
      explain: '「得位」是阴阳配位，「中」是位置在二/五；乾九二居中而不当位就是独立例证。',
    },
  },

  {
    id: 'disc-cheng-sheng',
    termA: 'cheng',
    termB: 'sheng',
    title: '承 vs 乘',
    oneLineDiff: '「承」是居下之爻承托其上；「乘」是居上之爻凌驾其下。同样的相邻两爻，从下端看叫承，从上端看叫乘，方向相反。',
    confusionReason: '两者都发生在「相邻两爻」之间，极像同义词；其实一个是「下托上」，一个是「上压下」。',
    examples: ['六二承九三：阴爻在下顺承上面的阳爻（阴承阳，传统视为顺）。', '阴爻骑在相邻阳爻之上，即「阴乘阳」，传统多言不协。'],
    counterExamples: ['同一对相邻爻，对下爻而言是「承」，对上爻而言是「乘」——不是两个爻之间只能有其中一种。'],
    relatedHexagramIds: [2],
    relatedYaoIds: ['hx-2-1'],
    classicPassageIds: [],
    traditionKeys: [],
    practice: {
      question: '「承」与「乘」的区别，哪句正确？',
      options: [
        '承和乘是同义词',
        '承是下托上、乘是上压下，方向相反',
        '承用于内卦、乘用于外卦',
        '两者都只讲「应」的关系',
      ],
      answerIndex: 1,
      explain: '相邻两爻，居下承其上是「承」，居上凌其下是「乘」；方向刚好相反。',
    },
  },

  {
    id: 'disc-bi-ying',
    termA: 'bi',
    termB: 'ying',
    title: '比 vs 应',
    oneLineDiff: '「比」看相邻两爻（紧挨着）；「应」看相隔三位、对位的两爻（初↔四、二↔五、三↔上）。距离远近是关键。',
    confusionReason: '「比」「应」都讲爻与爻的「呼应」，极易混；但比是「身边」的关系，应是「对位远呼」的关系。',
    examples: ['六二与九五，一阴一阳对位，是「二五相应」。', '一阴一阳相邻（如六二与九三）为「亲比」。'],
    counterExamples: ['相邻却不相应、对位却同气的爻，都需具体看，不能一概而论。'],
    relatedHexagramIds: [2],
    relatedYaoIds: ['hx-2-1', 'hx-2-4'],
    classicPassageIds: [],
    traditionKeys: [],
    practice: {
      question: '「比」与「应」的根本区别在哪？',
      options: [
        '比是相邻关系，应是初/二/三↔四/五/上的对位关系',
        '比是阴爻、应是阳爻',
        '比看全卦、应看单爻',
        '两者没有区别',
      ],
      answerIndex: 0,
      explain: '「比」取近（相邻），「应」取远（隔三位对位）；二五是应的主轴。',
    },
  },

  {
    id: 'disc-xiangying-diying',
    termA: 'xiangying',
    termB: 'diying',
    title: '相应 vs 敌应',
    oneLineDiff: '「相应」是对位两爻一阴一阳（相异），互相呼应；「敌应」是对位两爻同阴或同阳（同气），不构成呼应。',
    confusionReason: '「敌应」的「敌」字易被误读成「敌对仇恨」；其实它只是「同气不相呼」这一结构事实。',
    examples: ['六二（阴）与九五（阳）对位，是「相应」。', '乾卦初九与九四（同为阳）对位，是「敌应」。'],
    counterExamples: ['「敌应」不等于「凶」，还需结合中、比、时一起看。'],
    relatedHexagramIds: [1, 2],
    relatedYaoIds: ['hx-1-0', 'hx-2-1'],
    classicPassageIds: ['wy-03'],
    traditionKeys: [],
    practice: {
      question: '「相应」与「敌应」的分界在于？',
      options: [
        '对位两爻阴阳是否相异',
        '爻是否得位',
        '是否居中',
        '是否与相邻爻亲比',
      ],
      answerIndex: 0,
      explain: '对位两爻一阴一阳曰相应，同气（同阴/同阳）曰敌应；关键是「异则相应、同则敌应」。',
    },
  },

  // ── 文本 ─────────────────────────────────────────────
  {
    id: 'disc-guaci-yaoci',
    termA: 'guaci',
    termB: 'yaoci',
    title: '卦辞 vs 爻辞',
    oneLineDiff: '卦辞是解释「整卦」的一句/几句（如乾「元亨利贞」）；爻辞是解释「每一爻」的专属文字（如乾初九「潜龙勿用」）。',
    confusionReason: '两者都是《周易》经文，常被混作「卦象的说明」；其实一个作用于全卦，一个作用于单爻。',
    examples: ['乾卦辞「元亨利贞」讲整卦四德；乾初九「潜龙勿用」只讲这一爻。', '64 卦各有卦辞，384 爻各有爻辞。'],
    counterExamples: ['不能拿爻辞去解释整卦，也不能拿卦辞去单解某一爻。'],
    relatedHexagramIds: [1],
    relatedYaoIds: ['hx-1-0'],
    classicPassageIds: [],
    traditionKeys: [],
    practice: {
      question: '「卦辞」和「爻辞」的区别是？',
      options: [
        '卦辞解释整卦，爻辞解释单个爻',
        '卦辞是十翼、爻辞是经文',
        '只有卦辞、没有爻辞',
        '两者内容完全相同',
      ],
      answerIndex: 0,
      explain: '卦辞总说一卦，爻辞分说六爻；384 爻各有一句爻辞。',
    },
  },

  {
    id: 'disc-tuanzhuan-daxiang',
    termA: 'tuanzhuan',
    termB: 'daxiang',
    title: '彖传 vs 大象',
    oneLineDiff: '《彖传》解释「卦辞、卦象与卦义」（分析卦的结构与义理）；《大象》只从上下卦之象提炼一句「行动纲领」。',
    confusionReason: '两者都属于《易传》里解释一卦的文字，常被并提；但彖传偏「为什么如此」，大象偏「我该怎么照着做」。',
    examples: ['《大象》从上下卦象提炼（如乾大象「天行健，君子以自强不息」）。', '《彖传》多讲卦的结构、刚柔往来之由。'],
    counterExamples: ['大象是「用于自省的准则」，不是卦辞原文；把大象当卦辞文义解读会错位。'],
    relatedHexagramIds: [1],
    relatedYaoIds: [],
    classicPassageIds: [],
    traditionKeys: [],
    practice: {
      question: '《彖传》与《大象》的分工，哪句准确？',
      options: [
        '彖传讲卦义结构，大象讲上下卦象提炼的准则',
        '彖传只讲爻、大象只讲卦',
        '两者是同一篇文章',
        '彖传是经文、大象是传文',
      ],
      answerIndex: 0,
      explain: '彖传重在解卦义结构与哲理，大象则从卦象落到一句行动纲领。',
    },
  },

  {
    id: 'disc-daxiang-xiaoxiang',
    termA: 'daxiang',
    termB: 'xiaoxiang',
    title: '大象 vs 小象',
    oneLineDiff: '《大象》解释「整卦」之象（一卦一条）；《小象》逐爻解释「每一爻」之象（384 条，配合爻辞）。',
    confusionReason: '都以「象」立名，且都属《象传》，极像；其实一个对应「卦」、一个对应「爻」。',
    examples: ['大象一卦一条（六十四卦共 64 条）。', '小象逐爻一条（384 爻各一条小象）。'],
    counterExamples: ['看「某爻」的小象，别误当成整卦的大象。'],
    relatedHexagramIds: [1],
    relatedYaoIds: ['hx-1-0'],
    classicPassageIds: [],
    traditionKeys: [],
    practice: {
      question: '「大象」与「小象」的对应关系是？',
      options: [
        '大象对卦、小象对爻',
        '大象对爻、小象对卦',
        '两者都不对具体对象',
        '两者是同一种',
      ],
      answerIndex: 0,
      explain: '大象释全卦、小象逐爻释；一般说「象」需区分是「大象」还是「小象」。',
    },
  },

  {
    id: 'disc-jingwen-zhuanwen',
    termA: 'jingwen',
    termB: 'zhuanwen',
    title: '经文 vs 易传',
    oneLineDiff: '经文指《周易》「本经」（卦辞、爻辞）；《易传》（十翼）是后人对经的解释，二者时代与性质都不同。',
    confusionReason: '今本常「经传合编」，读者把《易传》的话误当成经文原文。',
    examples: ['「元亨利贞」是乾卦经文（卦辞）。', '「天行健，君子以自强不息」是《象传》（传文），非经文。'],
    counterExamples: ['把「天尊地卑」这类《系辞》语句说成《周易》「经文」，是常见误引。'],
    relatedHexagramIds: [1],
    relatedYaoIds: [],
    classicPassageIds: ['sv-01'],
    traditionKeys: [],
    practice: {
      question: '「经文」与「易传」的关系，哪句准确？',
      options: [
        '易传是经文的一部分',
        '经文是本经卦爻辞，易传是后来的解释',
        '经文就是易传',
        '只有易传、没有经文',
      ],
      answerIndex: 1,
      explain: '经文=卦辞+爻辞；《易传》（十翼）是解释，成书晚于经，应分层分读。',
    },
  },

  // ── 卦关系 ───────────────────────────────────────────
  {
    id: 'disc-cuogua-zonggua',
    termA: 'cuogua',
    termB: 'zonggua',
    title: '错卦 vs 综卦',
    oneLineDiff: '「错卦」是六爻阴阳全部互变（如乾↔坤）；「综卦」是六爻上下颠倒（如屯↔蒙）。一变阴阳、一翻位置。',
    confusionReason: '两者都是「一卦变出另一卦」的成对关系，易混；关键在「变阴阳」还是「倒过来」。',
    examples: ['乾（六阳）的错卦是坤（六阴）。', '屯卦上下颠倒为蒙卦，互为综卦。'],
    counterExamples: ['乾的综卦仍是乾（颠倒后同形），所以「错卦」与「综卦」结果常不同。'],
    relatedHexagramIds: [1, 2],
    relatedYaoIds: [],
    classicPassageIds: [],
    traditionKeys: [],
    practice: {
      question: '「错卦」与「综卦」的操作区别是？',
      options: [
        '错卦变阴阳、综卦上下颠倒',
        '错卦上下颠倒、综卦变阴阳',
        '两者完全相同',
        '错卦取互体、综卦取变爻',
      ],
      answerIndex: 0,
      explain: '错卦=六爻阴阳全互变；综卦=六爻上下颠倒（覆卦）。',
    },
  },

  {
    id: 'disc-bengua-zhigua',
    termA: 'bengua',
    termB: 'zhigua',
    title: '本卦 vs 之卦',
    oneLineDiff: '「本卦」是变化出发点的原卦；「之卦」是经历变爻后得到的变后之卦。合起来读，才看得到「变」。',
    confusionReason: '两者来自「变卦」这同一套流程，易被当作同一个卦；其实一个是「前」、一个是「后」。',
    examples: ['占筮遇变爻：原卦为本，变后之卦为之。', '「之卦」在筮法中常与「本卦」合看变化趋势。'],
    counterExamples: ['只看本卦会忽略变化的去向；只看之卦会丢掉起点。'],
    relatedHexagramIds: [],
    relatedYaoIds: [],
    classicPassageIds: [],
    traditionKeys: [],
    practice: {
      question: '「本卦」与「之卦」的关系是？',
      options: [
        '本卦是变前、之卦是变后',
        '之卦是变前、本卦是变后',
        '两者是同一卦的不同称呼',
        '两者无关系',
      ],
      answerIndex: 0,
      explain: '有变爻才有本/之之分：本卦为起始之象，之卦为变化去向。',
    },
  },

  {
    id: 'disc-hugua-biangua',
    termA: 'hugua',
    termB: 'biangua',
    title: '互卦 vs 变卦',
    oneLineDiff: '「互卦」是从原卦中间四爻重组出的「卦中藏卦」（取二三四、三四五）；「变卦」是因变爻阴阳互变而得的另一卦。',
    confusionReason: '两者都「从一卦得到另一卦」，易混；但互卦是「重组卦身」，变卦是「改变爻性」。',
    examples: ['互卦取二三四爻为下、三四五爻为上。', '变卦由动爻阴阳互变（或经之卦）而成。'],
    counterExamples: ['互卦不动爻的阴阳，只是重取；变卦则改变具体爻。'],
    relatedHexagramIds: [],
    relatedYaoIds: [],
    classicPassageIds: [],
    traditionKeys: [],
    practice: {
      question: '「互卦」与「变卦」的区别是？',
      options: [
        '互卦重组卦身、变卦改变爻性',
        '互卦改变爻性、变卦重组卦身',
        '两者相同',
        '互卦只用于乾卦',
      ],
      answerIndex: 0,
      explain: '互卦=取中间四爻重组成新卦；变卦=动爻阴阳互变得新卦。',
    },
  },

  // ── 方法 / 思想 ───────────────────────────────────────
  {
    id: 'disc-xiang-shu',
    termA: 'xiang',
    termB: 'shu',
    title: '象 vs 数',
    oneLineDiff: '「象」是卦爻呈现的形象/象征（天、地、水、火…）；「数」是卦爻背后的数目/次序（奇偶、爻位、卦序）。',
    confusionReason: '「象数」常连用，让人以为象=数；其实一个是「看得见的征象」，一个是「可计算的数目」。',
    examples: ['乾为天、坤为地，是「象」。', '初三五为阳位、二四上为阴位，是「数」。'],
    counterExamples: ['不是每个「象」都能直接换成一个「数」，也不是每个「数」都有固定「象」。'],
    relatedHexagramIds: [1, 2],
    relatedYaoIds: [],
    classicPassageIds: ['sv-05'],
    traditionKeys: ['shaoyong'],
    practice: {
      question: '「象」与「数」的侧重点分别是什么？',
      options: [
        '象重形象象征、数重数目次序',
        '象重数目、数重形象',
        '两者都重占卜结果',
        '两者没有区别',
      ],
      answerIndex: 0,
      explain: '象=卦爻的形象象征；数=奇偶、爻位、卦序等可计算的数目。',
    },
  },

  {
    id: 'disc-xiangshu-yili',
    termA: 'xiangshu',
    termB: 'yili',
    title: '象数 vs 义理',
    oneLineDiff: '「象数」以卦象与数目为门径读易；「义理」以卦中蕴含的道理为门径读易。两大传统长期并立、多有交集。',
    confusionReason: '常被对立成「象数=迷信、义理=正经」或反过来；其实两者是两套读法，而非正误之争。',
    examples: ['汉易卦气、纳甲属象数一脉；王弼「扫象言理」属义理一脉。', '《系辞》「形而上者谓之道」常被义理派引用。'],
    counterExamples: ['王弼「扫象」不是「不要象」，而是「不为象所拘」；程颐、朱熹也非全弃象数。'],
    relatedHexagramIds: [],
    relatedYaoIds: [],
    classicPassageIds: ['sv-07', 'sv-08'],
    traditionKeys: ['han', 'wangbi', 'chengyi', 'zhuxi'],
    practice: {
      question: '「象数」与「义理」的关系，哪句最妥当？',
      options: [
        '象数与义理是两种读易门径，多有交集',
        '象数正确、义理错误',
        '义理正确、象数错误',
        '两者完全不相关',
      ],
      answerIndex: 0,
      explain: '象数重卦象数目、义理重道理；是两条路径，不是「对 vs 错」。',
    },
  },

  {
    id: 'disc-zhanzhi-yili',
    termA: 'zhanzhi',
    termB: 'yili',
    title: '占筮 vs 义理解释',
    oneLineDiff: '「占筮」是「由数推变、决疑」的操作方法；「义理解释」是「读卦悟理」的学问路径。一是问事、一是读理。',
    confusionReason: '读易常被等同于「算命式占筮」，忽视义理这一独立而重要的传统。',
    examples: ['《系辞》「以吉凶断疑」关涉占筮之用。', '义理派（王弼、程颐、朱熹）把易读成「做人做事之道」。'],
    counterExamples: ['义理解读完全不依赖「起卦占问」也能成立；占筮也非「宿命预言」。'],
    relatedHexagramIds: [],
    relatedYaoIds: [],
    classicPassageIds: ['sv-06'],
    traditionKeys: ['wangbi', 'chengyi'],
    practice: {
      question: '「占筮」与「义理解释」的区别是？',
      options: [
        '占筮是决疑操作、义理是读卦悟理',
        '义理是决疑操作、占筮是读卦悟理',
        '两者完全相同',
        '占筮只用于乾卦',
      ],
      answerIndex: 0,
      explain: '占筮问「此事吉凶如何」，义理解读问「这个道理如何做人」；二者是不同门径。',
    },
  },

  {
    id: 'disc-shi-wei',
    termA: 'shi',
    termB: 'wei',
    title: '时 vs 位',
    oneLineDiff: '「时」讲处在什么时机/阶段（何时）；「位」讲处在什么位置/态势（何在）。同样的行为，因时因位而义别。',
    confusionReason: '「时位」常连用，易混为一谈；其实一个是时间维度、一个是位置维度。',
    examples: ['《系辞》「藏器于身，待时而动」讲「时」。', '爻位（初至六上的位置）讲「位」。'],
    counterExamples: ['「当位」未必「当时」；结构上合适，时机上未必合适。'],
    relatedHexagramIds: [1],
    relatedYaoIds: ['hx-1-0'],
    classicPassageIds: ['sv-12'],
    traditionKeys: [],
    practice: {
      question: '「时」与「位」分别对应哪两个维度？',
      options: [
        '时=时间维度、位=位置维度',
        '时=位置、位=时间',
        '两者都只指时间',
        '两者都只指位置',
      ],
      answerIndex: 0,
      explain: '时问「何时」，位问「何在」；时位合看，是易学判断的重要方法。',
    },
  },

  {
    id: 'disc-dewei-zheng',
    termA: 'dewei',
    termB: 'zheng',
    title: '得位 vs 正',
    oneLineDiff: '「得位」「当位」「正」在本系统中是同一结构事实（阳居阳位、阴居阴位），只是指称侧重点略有出入。',
    confusionReason: '「得位」听起来像「得到位置」，「正」听起来像「正确」，语感差异让人以为不是一回事。',
    examples: ['结构引擎对每爻算 dewei，true 即「得位=正」。', '「正」不是道德上的「正义」，是阴阳配位。'],
    counterExamples: ['「正」不带来「必吉」；它只是一个结构条件。'],
    relatedHexagramIds: [1],
    relatedYaoIds: ['hx-1-0'],
    classicPassageIds: [],
    traditionKeys: [],
    practice: {
      question: '「得位」与「正」的关系是？',
      options: [
        '两者指同一结构事实（阴阳配位），是同一条件的不同称呼',
        '得位吉、正则凶',
        '得位居中、正不居中',
        '两者完全无关',
      ],
      answerIndex: 0,
      explain: '「正=当位=得位」：阳居阳位、阴居阴位；只是叫法侧重点不同。',
    },
  },

  // ── 历史 ─────────────────────────────────────────────
  {
    id: 'disc-wangbi-chengyi',
    termA: 'wangbi',
    termB: 'chengyi',
    title: '王弼解释 vs 程颐解释',
    oneLineDiff: '王弼重「言意之辨、得意忘象」，扫象以见理；程颐重「义理入人事、体用一源」，把易读成做人做事的准则。',
    confusionReason: '两人都属义理传统，容易被当作「同一套说理」；其实王弼偏形上思辨，程颐偏人事践行。',
    examples: ['王弼据《系辞》「书不尽言，言不尽意」讲得意忘象。', '程颐《程氏易传》把卦爻落到「进德修业、格物穷理」。'],
    counterExamples: ['王弼「扫象」并非「弃象」；程颐也并非全不讲象。'],
    relatedHexagramIds: [1],
    relatedYaoIds: [],
    classicPassageIds: ['sv-08', 'wy-02'],
    traditionKeys: ['wangbi', 'chengyi'],
    practice: {
      question: '王弼与程颐读易的差异，哪句准确？',
      options: [
        '王弼重言意之辨、程颐重义理入人事',
        '王弼重象数、程颐重占筮',
        '两人观点完全相同',
        '王弼重人事、程颐重言意',
      ],
      answerIndex: 0,
      explain: '王弼以「得意忘象」扫象见理；程颐以「体用一源」把易落回人事修为。',
    },
  },

  {
    id: 'disc-zhuxi-wangbi',
    termA: 'zhuxi',
    termB: 'wangbi',
    title: '朱熹解释 vs 王弼解释',
    oneLineDiff: '王弼纯主义理、扫象言理；朱熹主张「经传分读、象数义理兼采」，比王弼更愿意回到象数与「本义」。',
    confusionReason: '两人都是影响极大的解释者，但方法论取向不同：一个扫象、一个整合。',
    examples: ['王弼以义理为主的《周易注》。', '朱熹《周易本义》分立经传、兼采象数义理。'],
    counterExamples: ['朱熹不代表「回到象数算命」；他是要「经传分开，各还其位」。'],
    relatedHexagramIds: [],
    relatedYaoIds: [],
    classicPassageIds: ['sv-07'],
    traditionKeys: ['wangbi', 'zhuxi'],
    practice: {
      question: '朱熹与王弼的区别，哪句准确？',
      options: [
        '王弼扫象言理、朱熹经传分读兼采象数义理',
        '王弼经传分读、朱熹扫象言理',
        '两人观点一致',
        '王弼重占筮、朱熹重义理',
      ],
      answerIndex: 0,
      explain: '王弼主纯义理，朱熹《周易本义》分读经传、兼采象数与义理。',
    },
  },
]

// ── 索引 / 反查 ─────────────────────────────────────────
export const DISCERNMENT_BY_ID = DISCERNMENT_GROUPS.reduce((acc, g) => {
  acc[g.id] = g
  return acc
}, {})

export function getDiscernment(id) {
  return DISCERNMENT_BY_ID[id] || null
}

// 由 termId 反查所有包含它的辨析组（供术语页「别和这些概念混淆」用）
export function discernmentsForTerm(termId) {
  return DISCERNMENT_GROUPS.filter((g) => g.termA === termId || g.termB === termId)
}

export function discernmentPartner(termId, groupId) {
  const g = DISCERNMENT_BY_ID[groupId]
  if (!g) return null
  if (g.termA === termId) return g.termB
  if (g.termB === termId) return g.termA
  return null
}

export const DISCERNMENT_COUNT = DISCERNMENT_GROUPS.length