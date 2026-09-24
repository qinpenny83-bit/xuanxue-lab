// ============================================================
// ☯️ 易经学院案例库（系统化重构）· 第八批 case-121 ~ case-123
// 覆盖：《易传》十翼（彖传/系辞的分工、象传/说卦的取象、
//       十翼 BOSS 区分经·传·附会）。
// 核心立场：十翼是最早的系统解释层，学它不背结论，而是
//   「区分经传、定位出处、比较解释、标注不确定性」。
// 每个案例至少包含 1 个「目前无法判断」类选项（部分为最高分）。
// 案例 id 与课程节点 caseIds 一一对应。
// ============================================================

export const CASES_ICHING_8 = [
  {
    id: 'case-121',
    title: '「大哉乾元」与「易有太极」，是在讲同一件事吗',
    difficulty: 4,
    level: 3,
    levelName: '推理',
    category: 'iching',
    blindTest: false,
    subject: '一位把彖传与系辞混着读的人',
    minutes: 8,
    relatedNodes: ['yz-tuan', 'yz-xici'],
    trainingTag: 'classic',
    infoSufficiency: 'sufficient',
    mode: 'guided',
    situation: [
      '小岑刚接触十翼，读到两句都带「生」的话：',
      '《彖传》：「大哉乾元，万物资始，乃统天。」',
      '《系辞》：「易有太极，是生两仪，两仪生四象。」',
      '他问：「这两句不都是在讲宇宙怎么来的吗？是不是同一个意思？」',
    ],
    chartLabel: '彖传断卦义 vs 系辞立总纲：两个不同的工作',
    chart: [
      { key: '彖传', value: '逐卦解释：从上下卦结构与刚柔位置，断「这一卦」的卦义' },
      { key: '系辞', value: '整体立法：讲阴阳、变化、象数、圣人观象这些「通理」' },
      { key: '共同盲点', value: '两者都是哲学/象征语言，都不是可检验的科学机制' },
    ],
    challenges: [
      {
        type: 'choice',
        dimension: 'reasoning',
        prompt: '「大哉乾元」和「易有太极」这两句的关系，最准确的理解是？',
        options: [
          { text: '分工不同：彖传断「乾」这一卦的卦义，系辞立「易」的哲学总纲', points: 3, feedback: '对，一句管一卦、一句管全局。' },
          { text: '都在讲宇宙大爆炸', points: 0, errorType: 'E01', feedback: '把哲学/象征语言当科学机制。' },
          { text: '其实是同一句的不同抄本', points: 0, errorType: 'E03', feedback: '出处、对象、性质都不同，不可混。' },
        ],
      },
      {
        type: 'choice',
        dimension: 'reasoning',
        prompt: '有人拿「两仪生四象」论证「古人早就发现了细胞分裂」。哪里不对？',
        options: [
          { text: '这是层次化生成的象征语言，无可测量、无可检验，不能当生物学结论', points: 3, feedback: '对，性质不同，不能混判。' },
          { text: '古人确实更早发现', points: 0, errorType: 'E01', feedback: '把象征当科学发现。' },
          { text: '细胞分裂也是二分，说明同源', points: 0, errorType: 'E06', feedback: '表面相似不构成同源证据。' },
        ],
      },
      {
        type: 'counter',
        dimension: 'counter',
        prompt: '「彖传和系辞都在讲宇宙生成，所以都是科学」——哪个反例最有力？',
        options: [
          { text: '彖传断的是卦义、系辞立的是总纲，两者均无测量与可检验程序，属于哲学传统而非科学', points: 3, feedback: '对，工作对象不同，但都不是科学。' },
          { text: '古人的科学比现代发达', points: 0, errorType: 'E07', feedback: '厚古薄今且不可检验。' },
          { text: '科学也讲阴阳太极', points: 0, errorType: 'E06', feedback: '借用词汇不构成同义。' },
        ],
      },
      {
        type: 'analysis',
        dimension: 'evidence',
        prompt: '怎么判断一句十翼原文是「哲学命题」还是「科学陈述」？写出你的判断步骤。',
        keywords: ['出处', '命题', '可检验', '测量', '象征', '对象', '性质', '分界'],
        placeholder: '例如：先看它出自哪一篇、对象是什么，再看它有没有可测量、可证伪的检验方式，最后区别哲学命题与科学陈述……',
      },
      {
        type: 'conclusion',
        dimension: 'boundary',
        prompt: '把彖传的「断卦义」和系辞的「立总纲」分开读，最重要的好处是？',
        options: [
          { text: '知道每句话在体系里的位置：不把哲学当科学、不把卦义当通理', points: 3, feedback: '对，定位决定理解。' },
          { text: '记起来更方便', points: 0, errorType: 'E06', feedback: '方便记忆不等于正确理解。' },
          { text: '目前无法判断：两篇分工太抽象', points: 1, feedback: '分工清晰：一管单卦、一管全局。' },
        ],
      },
      {
        type: 'confidence',
        dimension: 'calibration',
        prompt: '你对「十翼是哲学/象征语言，不是科学陈述」的信心是多少？',
      },
    ],
    reveal: {
      realBackground: '《彖传》逐卦解释，从上下卦结构与刚柔位置断「这一卦」的卦义；《系辞》不讲单卦，而给「易」整体立法（阴阳、变化、象数、圣人观象、大衍之数）。「大哉乾元」解释的是乾卦，「易有太极」讲的是易的展开结构。两者都是哲学与象征语言，不是科学机制。',
      expectedReasoning: '正确路径：先定位各自出处（彖曰/系辞曰），再区分「管一卦」与「管全局」，最后指出两者的共同性质是「哲学命题」而非「科学陈述」。',
      otherMayHold: '对「太极」「两仪」的具体训释，历代有宇宙论、生成论、象数论等多种读法——多元并存正说明它是解释传统，不是单一科学定理。',
      takeaway: '彖传管一卦，系辞管全局；分清位置，才不会把哲学当科学。',
    },
    commonMistakes: ['把彖传与系辞都当「宇宙生成论」，混淆哲学与科学（E01）。', '记句子不记「它在解释什么」（E06）。', '把「避免科学化」的提醒误当贬低古人（E03）。'],
  },
  {
    id: 'case-122',
    title: '「乾为天、为马、为父」——背下来，就懂了吗',
    difficulty: 3,
    level: 2,
    levelName: '推理',
    category: 'iching',
    blindTest: false,
    subject: '一位只会背取象清单的人',
    minutes: 7,
    relatedNodes: ['yz-xiang', 'yz-shuogua'],
    trainingTag: 'classic',
    infoSufficiency: 'sufficient',
    mode: 'guided',
    situation: [
      '小苏把《说卦》「乾为天、为圆、为君、为父、为马」背得滚瓜烂熟。',
      '可当被问「为什么乾还能是『首』『果』『金玉』」时，他卡住了。',
      '老师说：「你背的是象的清单，不是象的道理——先抓『健』这个性。」',
    ],
    chartLabel: '取象三步：定性 → 投影 → 以类相推',
    chart: [
      { key: '① 定性', value: '乾的根本性质是「健」（《说卦》：「乾，健也」）' },
      { key: '② 投影', value: '天、马、父、君……都是「健」在不同领域里的投影' },
      { key: '③ 以类相推', value: '抓住「健」，就能自己推出新取象，而不是死背清单' },
    ],
    challenges: [
      {
        type: 'choice',
        dimension: 'reasoning',
        prompt: '为什么「乾」既是天、又是马、又是父？',
        options: [
          { text: '它们共享「健行、主动」的性质，是取象不是定义', points: 3, feedback: '对，性是最根本的，象是投影。' },
          { text: '古人在这些字里藏了秘密编码', points: 0, errorType: 'E01', feedback: '把取象神秘化为编码。' },
          { text: '「乾」这个字本来就有这三个意思', points: 0, errorType: 'E03', feedback: '取象是「以类相推」，不是字义有多解。' },
        ],
      },
      {
        type: 'choice',
        dimension: 'reasoning',
        prompt: '《说卦传》与《象传·大象》在取象上是什么关系？',
        options: [
          { text: '说卦立「象的字典」，大象传从卦象提炼「人事原则」（君子以…）', points: 3, feedback: '对，一个定象，一个用象。' },
          { text: '两篇讲的是同一件事', points: 0, errorType: 'E06', feedback: '分工不同，不可混。' },
          { text: '说卦传专释爻辞', points: 0, errorType: 'E03', feedback: '专释爻辞的是小象传。' },
        ],
      },
      {
        type: 'counter',
        dimension: 'counter',
        prompt: '「坎=水=财运」是《易经》原文规定的——哪个反例最有力？',
        options: [
          { text: '《说卦》给坎的定性是「陷」「险」，水只是取象之一；「水主财」是后世民俗应用，非原文', points: 3, feedback: '对，出处与层次要分清。' },
          { text: '水确实主财', points: 0, errorType: 'E03', feedback: '把民俗应用当原文。' },
          { text: '说卦传没写全', points: 0, errorType: 'E06', feedback: '不是没写全，是被后世偷换了重点。' },
        ],
      },
      {
        type: 'analysis',
        dimension: 'evidence',
        prompt: '「天行健，君子以自强不息」——怎么验证它出自《象传·大象》而不是乾卦卦辞？',
        keywords: ['出处', '卦辞', '大象传', '对应', '核对', '原文', '君子以', '性质'],
        placeholder: '例如：查通行本乾卦，先看卦辞原文（元亨利贞），再看「彖曰」「象曰」标记，确认「君子以…」句式出自象传……',
      },
      {
        type: 'conclusion',
        dimension: 'boundary',
        prompt: '学象传与说卦，最应该先抓住的是？',
        options: [
          { text: '抓「性」再推「象」：象是性质的投影，不是死等式', points: 3, feedback: '对，抓性才能自己取象。' },
          { text: '背全所有取象清单', points: 0, errorType: 'E06', feedback: '背象不见性，换领域就卡壳。' },
          { text: '目前无法判断：取象太杂', points: 1, feedback: '杂是表面，背后有「以类相推」的规律。' },
        ],
      },
      {
        type: 'confidence',
        dimension: 'calibration',
        prompt: '你对「抓性推象，而非背象清单」的信心是多少？',
      },
    ],
    reveal: {
      realBackground: '《说卦》先给八卦定性：乾健、坤顺、震动、巽入、坎陷、离丽、艮止、兑说；再层层展开取象（自然、人伦、身体、动物、万物）。取象是「性质」向不同领域的投影——乾=天=父=马，共享「健」；坎=水=险，本在「陷」。后世「水主财」是民俗应用，不是《说卦》本旨。',
      expectedReasoning: '正确路径：先抓「健」这个定性，再看天/马/父都是「健」的投影，最后用「出处与层次」反例戳破「坎=水=财」的民俗误读。',
      otherMayHold: '历代对象传「君子以…」句式的应用有浓淡之别（义理派极重视、象数派较淡化），但都承认它是「从卦象到人事」的取义动作。',
      takeaway: '象是性质的投影；抓性再推象，你就从「背字典」升级到「会取象」。',
    },
    commonMistakes: ['把背清单当懂卦，只见象不见性（E06）。', '把取象当死等式（乾=天，一字一义）（E01）。', '把后世民俗取象（坎=财）误归到《说卦》原文（E03）。'],
  },
  {
    id: 'case-123',
    title: '十翼 BOSS：一段混合文本，标出经、传与附会',
    difficulty: 5,
    level: 4,
    levelName: '反例',
    category: 'iching',
    blindTest: true,
    subject: '一位接受十翼独立分析终考的人',
    minutes: 10,
    relatedNodes: ['yz-boss'],
    trainingTag: 'independent',
    infoSufficiency: 'insufficient',
    mode: 'blind',
    situation: [
      'Boss 关：一段关于「乾」的混合文本——',
      '「乾：元亨利贞。彖曰：大哉乾元，万物资始。象曰：天行健，君子以自强不息。系辞曰：一阴一阳之谓道。后人所加：乾卦代表事业腾飞，买乾卦周边必定发财。」',
      '要求：逐句分层（经/传/后世附会），还原结构，比较解释，写出不确定性。',
    ],
    chartLabel: '十翼四关：分层 / 还原 / 比较 / 不确定性',
    chart: [
      { key: '① 分层', value: '每句标注：经（卦辞）？传（彖/象/系辞）？后世附会？' },
      { key: '② 还原', value: '「自强不息」对应乾卦、出处大象传、基于「天行」之象' },
      { key: '③ 比较', value: '「贞」训「正」还是「占问」——两说皆有据' },
      { key: '④ 不确定性', value: '「事业腾飞」无文本依据，但无法证伪其个人体感' },
    ],
    challenges: [
      {
        type: 'choice',
        dimension: 'reasoning',
        prompt: '本 Boss 的评分标准最可能是？',
        options: [
          { text: '分层准、还原对、解释有比较、不确定写得明', points: 3, feedback: '对，四关的过程质量是评分核心。' },
          { text: '背出全部十翼原文', points: 0, errorType: 'E06', feedback: '考区分与比较，不考背诵。' },
          { text: '选出唯一的正确答案', points: 0, errorType: 'E01', feedback: '没有唯一答案，考的是分层与比较。' },
        ],
      },
      {
        type: 'choice',
        dimension: 'structure',
        prompt: '「天行健，君子以自强不息」出自哪篇十翼的哪一部分？',
        options: [
          { text: '《象传·大象》，是对乾卦的解释', points: 3, feedback: '对，大象传释整卦之象并以「君子以」落到人事。' },
          { text: '乾卦的卦辞原文', points: 0, errorType: 'E03', feedback: '卦辞原文是「元亨利贞」。' },
          { text: '《系辞传》的名句', points: 0, errorType: 'E06', feedback: '名句易混，但它出自象传。' },
        ],
      },
      {
        type: 'choice',
        dimension: 'reasoning',
        prompt: '「乾卦代表事业腾飞、买周边必发财」这一句，最合理的定位是？',
        options: [
          { text: '现代附会：与经文义理无关，无文本依据且无法证伪', points: 3, feedback: '对，先分层，再看有没有依据。' },
          { text: '是对乾卦的准确解释', points: 0, errorType: 'E01', feedback: '接受单象标签而不查依据。' },
          { text: '有道理，因为乾=天=高升', points: 0, errorType: 'E06', feedback: '用联想替代文本依据。' },
        ],
      },
      {
        type: 'counter',
        dimension: 'counter',
        prompt: '「读得多自然就会分经传」——哪个反例最有力？',
        options: [
          { text: '久读不练分层的人，照样把「自强不息」当卦辞原文；区分能力来自刻意的分层训练', points: 3, feedback: '对，眼力是练出来的，不是翻出来的。' },
          { text: '读得多自然就懂了', points: 0, errorType: 'E06', feedback: '输入量不自动转化为区分能力。' },
          { text: '读得多的人不会错', points: 0, errorType: 'E07', feedback: '以资历替代证据。' },
        ],
      },
      {
        type: 'analysis',
        dimension: 'evidence',
        prompt: '四关中，「不确定性」一步应该写什么？给出具体条目。',
        keywords: ['信息缺口', '出处', '附会', '多种解释', '证据', '无法判断', '标注', '边界'],
        placeholder: '例如：指出「事业腾飞」无文本依据、哪些训读存在争议（贞=正/占问）、哪些地方我目前无法判断……',
      },
      {
        type: 'conclusion',
        dimension: 'boundary',
        prompt: '如果这场考试没有标准答案，它到底考什么？',
        options: [
          { text: '分层/还原/比较/不确定性的能力，以及敢不敢写「我不知道」', points: 3, feedback: '对，这就是十翼 Boss 的全部。' },
          { text: '考能否准确预测未来', points: 0, errorType: 'E01', feedback: '十翼是解释传统，不是预测工具。' },
          { text: '目前无法判断：考试标准不清', points: 1, feedback: '标准清晰：分层准、比较有据、不确定写得明。' },
        ],
      },
      {
        type: 'confidence',
        dimension: 'calibration',
        prompt: '你对「能独立区分经·传·附会」的信心是多少？',
      },
    ],
    reveal: {
      realBackground: '混合文本分层（参考）：①「乾：元亨利贞」=经（卦辞）；②「彖曰：大哉乾元」=传·彖；③「象曰：天行健，君子以自强不息」=传·象（大象）；④「系辞曰：一阴一阳之谓道」=传·系辞；⑤「乾卦代表事业腾飞、买周边必发财」=现代附会，无文本依据。四关：分层／还原／比较／不确定性。',
      expectedReasoning: '正确路径：逐句标注出处（经/传/附会），还原「自强不息」对应乾卦与「天行」之象，比较「贞」的多种训读，最后把「事业腾飞」这类无据附会写进不确定性栏并说明为何无法证伪。',
      otherMayHold: '「元亨利贞」的断句与训读（四德说是文言传的一种解释，另有「大亨、利于贞问」训诂）——多元并存正是开启「解释比较」的入口。',
      takeaway: '分不清经传，读再多也是被带着走；识别附会不是禁区，是考点。',
    },
    commonMistakes: ['把传文当经文（E03）。', '只给一种解释、回避比较（E06）。', '不敢写「无法判断」，硬凑结论（E04）。'],
  },
]