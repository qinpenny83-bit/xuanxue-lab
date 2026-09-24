// ============================================================
// R6 · 玄学辨伪实验室·第三批扩充（doubtTasks-r6）
//
// 30 个新任务：flaw 5 / evidence-review 5 / counterexample 5 /
//             deconstruct 5 / tradition-conflict 5 / self-doubt 5
// 每类内 level 1→4 递增，difficulty 随 level 形成梯度。
// 面向新增领域：八字（身强身弱/五行缺补/贵人/流年）、风水（朝向招财/
// 摆件/缺角）、奇门（择时/方位）、六壬（课式断吉凶）、民俗（本命年/
// 太岁/属相/能量饰品/话术）中的常见营销说法与伪逻辑。
// 民俗说法均标注「民间说法/民间观念」；出处无法确认写「暂无可靠出处」。
// 禁止编造古籍原文与出处。
//
// __dseq 与核心（1..90）、extra（91..160）错开：doubtTasks.js 合并后
// 要求 __dseq 全局唯一，本文件 161..190。
// ============================================================

// 描述性训练标签 → 现有 8 维能力（masteryEngine 的唯一权威键）。
// masteryKeys 必须能被 masteryEngine 消费，不能混入自定义标签。
const MASTERY_KEY_ALIAS = {
  text: 'evidence', // 文本证据分析 → 证据意识
  deconstruct: 'structure', // 解释拆解 → 结构理解
  tradition: 'synthesis', // 比较传统 → 综合分析（整合/比较不同解释）
  compare: 'synthesis', // 比较 → 综合分析
}

// 与核心/extra 的 __dseq 错开：core 1..90、extra 91..160，本文件 161 起。
// 注意：不能 import 核心文件（会循环引用），故此处硬编码 160 并加注释维护。
let __dseq = 160
function D(task) {
  __dseq += 1
  const masteryKeys = [...new Set((task.masteryKeys || []).map((k) => MASTERY_KEY_ALIAS[k] || k))]
  return {
    difficulty: 2,
    level: 2, // 1 入门 / 2 进阶 / 3 高阶 / 4 综合
    prompt: task.prompt || '',
    statement: task.statement || null,
    evidence: task.evidence || null,
    options: task.options || null,
    correctIndex: task.correctIndex ?? null,
    hint: task.hint || null,
    relatedTerms: [],
    hexagrams: [],
    yaos: [],
    cases: [],
    classics: [],
    traditions: [],
    errorTypes: [],
    sourceInfo: { source: 'curated', note: '玄学思辨训练题（八字/风水/奇门/六壬/民俗）；民间说法已标注，引用非伪造原典。' },
    __dseq,
    ...task,
    masteryKeys,
  }
}

// ── 快捷构造选项 ─────────────────────────────────────────────
function op(choices, correctIndex) {
  return { options: choices.map((text) => ({ text })), correctIndex }
}

export const DOUBT_TASKS_R6 = [
  // ============ 一、发现推理漏洞（flaw-31 ~ flaw-35） ============
  D({ id: 'flaw-31', category: 'flaw', title: '「缺什么补什么」的误区', emoji: '🧲',
    level: 1, difficulty: 1,
    prompt: '网上常见说法：',
    statement: '我八字缺金，所以要多戴黄金饰品补金，不然财运会不好。',
    ...op(['缺什么补什么，很有道理', '「缺」只是对盘面结构的描述，缺什么补什么是被营销化的说法，效果也没有可验证的依据', '金代表财富，缺金必须补'], 1),
    correctReasoning: '八字里的「五行缺」只是统计盘面里某五行没有出现，不等于身体缺什么元素，也不等于财运会差；补不补要看整体结构与流派规则，不是「缺了就补」这么简单。',
    explanation: 'E01 + E10：把「结构上缺」当成了「行动上必须补」，还把「缺金」误读成「缺财」。',
    errorTypes: ['E01', 'E10'], masteryKeys: ['structure', 'counterexample'] }),

  D({ id: 'flaw-32', category: 'flaw', title: '本命年等于诸事不顺？', emoji: '🧧',
    level: 1, difficulty: 1,
    prompt: '网上常见说法：',
    statement: '今年是我的本命年，网上说本命年犯太岁，这一年做什么都会不顺。',
    ...op(['本命年确实做什么都倒霉', '「犯太岁」是民间观念，本命年只是其中一种情形，把整年预判成不顺是过度概括', '只有本命年的人才需要注意'], 1),
    correctReasoning: '「犯太岁」是民间观念体系（值、冲、刑、害、破等说法），各地说法不一，并无统一文献标准；「整年不顺」把一个民俗标签变成了整年定论。',
    explanation: 'E01 + E06：把一个民俗标签当成整年的结论，且说法本身在民间也不统一。',
    errorTypes: ['E01', 'E06'], masteryKeys: ['reasoning', 'uncertainty'] }),

  D({ id: 'flaw-33', category: 'flaw', title: '坐北朝南就招财？', emoji: '🧭',
    level: 2, difficulty: 2,
    prompt: '网上常见说法：',
    statement: '这房子坐北朝南，网上说坐北朝南招财，住进来就能发财。',
    ...op(['坐北朝南就是财位，住进去就有钱', '朝向只是风水分析的一个要素，且不同流派说法不一，「住进来就发财」把单一要素当成直接因果', '朝南的房子更好卖，所以肯定招财'], 1),
    correctReasoning: '坐北朝南采光通风好，有现实依据；但「招财」是民间观念，把「朝向」直接连到「发财」缺少中间环节，也忽略了其它要素与流派差异。',
    explanation: 'E01 + E08：把单一要素当结论，并把「朝向好」与「发财」直接挂钩。',
    errorTypes: ['E01', 'E08'], masteryKeys: ['evidence', 'reasoning'] }),

  D({ id: 'flaw-34', category: 'flaw', title: '伏吟课就是必败？', emoji: '🌀',
    level: 3, difficulty: 3,
    prompt: '网上常见说法：',
    statement: '六壬起课一看是「伏吟课」，网上说伏吟主凶，所以这件事必败。',
    ...op(['伏吟就是凶课，必败', '课体名（如伏吟）只是断课的一个入手点，吉凶还要看三传生克、类神与整体课传，「必败」是把课式直接当结论', '不是伏吟的课都是吉课'], 1),
    correctReasoning: '六壬断课以四课三传为主干，课体名（伏吟、返吟等）只是分类标签；同一课体在不同问题、不同组合下结论可以完全不同。',
    explanation: 'E01 + E06：用一个课式标签直接定吉凶，忽略了课传结构。',
    errorTypes: ['E01', 'E06'], masteryKeys: ['structure', 'uncertainty'] }),

  D({ id: 'flaw-35', category: 'flaw', title: '属相相冲就是无缘？', emoji: '💔',
    level: 4, difficulty: 4,
    prompt: '网上常见说法：',
    statement: '有人说我和女朋友属相相冲，明年又是犯太岁的流年，这段感情走不到最后。',
    ...op(['属相相冲就是不能在一起', '属相与流年只是民俗符号，关系结果取决于现实行为与选择，把整段关系归因于属相是过度解释', '克星流年一到，做什么都白费'], 1),
    correctReasoning: '「属相相冲」是民俗分类，用于婚配属于后世引申；现实中的相处、沟通与选择才是关系走向的主要因素，符号不能替代现实。',
    explanation: 'E06 + E05：用单一民俗标签解释整段关系，忽略了现实信息。',
    errorTypes: ['E06', 'E05'], masteryKeys: ['reasoning', 'independence'] }),

  // ============ 二、证据审查（evr-31 ~ evr-35） ============
  D({ id: 'evr-31', category: 'evidence-review', title: '长辈都这么说算证据吗', emoji: '👵',
    level: 1, difficulty: 1,
    prompt: '有人论证「本命年要穿红」时给出理由。哪条判断更符合证据审查？',
    statement: '「本命年穿红是长辈传下来的规矩，大家都这么说，所以必须穿红。」',
    ...op(['长辈都这么说，证据很充分', '「大家都这么说」只是口头传承的民间观念，不能说明穿红与顺遂之间存在可检验的关联', '流传得久，所以有效'], 1),
    correctReasoning: '「长辈都这么说」属于诉诸传统与多数，只能说明该观念流传广，不能证明其效果；要验证穿红与顺遂的关联需要对照记录。',
    explanation: 'E02 + E08：把民间观念的流传当效果证据，并把穿红与顺遂直接挂钩。',
    errorTypes: ['E02', 'E08'], masteryKeys: ['evidence', 'reasoning'] }),

  D({ id: 'evr-32', category: 'evidence-review', title: '三个例子够不够', emoji: '📊',
    level: 1, difficulty: 1,
    prompt: '有人用例子证明「身强的人能当领导」。哪条判断更符合证据审查？',
    statement: '「我认识三个八字身强的人，全都当上了领导，可见身强的人都能当领导。」',
    ...op(['三个例子足够说明问题', '样本只有三个且无对照，属于小样本加选择性记忆，不能推出「身强都能当领导」', '身强的人本来就适合当领导'], 1),
    correctReasoning: '三个身边例子既无随机性也无对照组，还可能只记住了符合结论的人；证据量不足以支撑普遍结论。',
    explanation: 'E07 + E06：只收集支持自己的小样本，并过度概括到所有人。',
    errorTypes: ['E07', 'E06'], masteryKeys: ['evidence', 'counterexample'] }),

  D({ id: 'evr-33', category: 'evidence-review', title: '一次签约成功算数吗', emoji: '🤝',
    level: 2, difficulty: 2,
    prompt: '有人用一次经历证明奇门择时有效。哪条判断更符合证据审查？',
    statement: '「我按奇门挑的吉时去签约，客户当场就同意了，这就是奇门择时的效果。」',
    ...op(['签约成功，证据确凿', '单次成功无法区分是择时起作用还是产品、报价、时机等其它因素，需要对照与多次记录', '吉时签约就会成功'], 1),
    correctReasoning: '一次成功既可能是巧合，也可能是其它现实因素；没有对照组就无法把结果归因于择时。',
    explanation: 'E08 + E07：把一次同时发生当因果，且只记住了成功这一次。',
    errorTypes: ['E08', 'E07'], masteryKeys: ['evidence', 'uncertainty'] }),

  D({ id: 'evr-34', category: 'evidence-review', title: '书上十次都断对', emoji: '📚',
    level: 3, difficulty: 3,
    prompt: '有人引用课例书证明「铸印课主吉」。哪条判断更符合证据审查？',
    statement: '「某课例书里记载了十次铸印课，书上说这十次都断对了，所以铸印课主吉是经过验证的。」',
    ...op(['书上记载的十次都对，可信', '古书通常只记断对的案例，漏记断错的，这是选择性记录，不能当作验证', '古书记载就是可靠的证据'], 1),
    correctReasoning: '课例书是教学与案例汇编，多选取成功示例；没有记录失败的样本，就无法评估准确率，谈不上「经过验证」。',
    explanation: 'E07 + E02：只收集书中的成功案例，并把古书记载直接当成事实证据。',
    errorTypes: ['E07', 'E02'], masteryKeys: ['evidence', 'counterexample'] }),

  D({ id: 'evr-35', category: 'evidence-review', title: '户型图加留言截图够吗', emoji: '🏠',
    level: 4, difficulty: 4,
    prompt: '有人用网友留言证明「房子缺角有影响」。哪条判断更符合证据审查？',
    statement: '「网上说房子缺西北角，家里男主人就会出问题，还附了几张户型图和留言截图作为证据。」',
    ...op(['有户型图和留言，证据充分', '留言截图是匿名自述，无对照、无验证，把户型缺角与家人状况直接挂钩，证据链不成立', '缺角确实会导致家人出问题'], 1),
    correctReasoning: '匿名留言无法核实，也没有「缺角的家庭」与「不缺角的家庭」的对照数据；把缺角与家人状况直接挂钩缺少中间证据。',
    explanation: 'E07 + E08：只收集支持说法的留言，并把缺角与家人状况直接挂钩。',
    errorTypes: ['E07', 'E08'], masteryKeys: ['evidence', 'reasoning'] }),

  // ============ 三、反例猎人（cx-31 ~ cx-35） ============
  D({ id: 'cx-31', category: 'counterexample', title: '缺什么补什么的例外', emoji: '🌲',
    level: 1, difficulty: 1,
    prompt: '有人说「八字缺什么就要补什么」。你能找出反例吗？',
    statement: '八字缺什么就要补什么，缺了不补就会不好。',
    ...op(['没有反例，这句话永远成立', '很多八字「缺」某五行的人境遇各不相同，且不少流派主张要看喜忌而不是见缺就补——这就是现成的反例', '缺金的人补了金都变好了'], 1),
    correctReasoning: '「缺」不等于「需补」，同一盘面在不同流派、不同取用下结论不同；只要存在「缺了没补也并无不好」的例子，断言就不成立。',
    explanation: 'E01 + E07：把「缺」当成唯一行动依据，且拒绝寻找反例。',
    errorTypes: ['E01', 'E07'], masteryKeys: ['counterexample', 'structure'] }),

  D({ id: 'cx-32', category: 'counterexample', title: '属虎的都脾气大？', emoji: '🐯',
    level: 1, difficulty: 1,
    prompt: '有人说「属相决定性格」。你能找出反例吗？',
    statement: '属相决定性格，属虎的人天生脾气大。',
    ...op(['找不到反例，属虎的都脾气大', '同年出生的属虎人数以百万计，性格千差万别——同一属相共享同一种性格的说法很容易被反例推翻', '属虎的人自己都说脾气大'], 1),
    correctReasoning: '属相只与出生年份相关，同一年出生的人性格差异巨大；「属虎脾气大」既无法解释差异，也经不起反例检验。',
    explanation: 'E06 + E01：用一个标签解释所有人，忽略个体差异。',
    errorTypes: ['E06', 'E01'], masteryKeys: ['counterexample', 'reasoning'] }),

  D({ id: 'cx-33', category: 'counterexample', title: '貔貅招财有没有反例', emoji: '💰',
    level: 2, difficulty: 2,
    prompt: '有人说「在财位放貔貅就能招财」。你能找出反例吗？',
    statement: '在财位放貔貅，就能招财。',
    ...op(['放了的都发财，没有反例', '貔貅招财是民间说法，没有对照记录；许多放了貔貅的家庭财运并无变化——反例并不难找', '貔貅是瑞兽，瑞兽不会有反例'], 1),
    correctReasoning: '要验证招财效果需要「放了」与「没放」的对照；而现实中放与不放并无稳定差异，这就是现成的反例群。',
    explanation: 'E08 + E07：把民间说法当因果，并只收集支持案例。',
    errorTypes: ['E08', 'E07'], masteryKeys: ['counterexample', 'evidence'] }),

  D({ id: 'cx-34', category: 'counterexample', title: '贵人入课必成？', emoji: '⭐',
    level: 3, difficulty: 3,
    prompt: '有人说「课里见天乙贵人，事情就有贵人相助」。你能找出反例吗？',
    statement: '课里见天乙贵人，事情就有贵人相助，必成。',
    ...op(['天乙贵人入课就没有不成的事', '贵人是否得力要看落宫、旺衰与生克；贵人入课却被刑冲或空亡的情形并不少见——这就是现成的反例', '天乙贵人是十二天将之首，不会出错'], 1),
    correctReasoning: '课传中的神将只是断课要素之一，贵人被冲、被克、落空时作用会大打折扣；「见贵人必成」经不起课例检验。',
    explanation: 'E01 + E03：只看一个神将就定吉凶，忽略它在整体课传中的位置。',
    errorTypes: ['E01', 'E03'], masteryKeys: ['counterexample', 'structure'] }),

  D({ id: 'cx-35', category: 'counterexample', title: '带贵人星就逢凶化吉？', emoji: '🛡️',
    level: 4, difficulty: 4,
    prompt: '有人说「命带天乙贵人的人一生有贵人帮」。你能找出反例吗？',
    statement: '命带天乙贵人的人一生都有贵人帮，逢凶化吉。',
    ...op(['天乙贵人就是保平安的，没有反例', '贵人星只是命理符号之一，作用要看整体组合与流年互动；带贵人星却人生坎坷的记录并不难找到', '命里有贵人星就什么都不用怕'], 1),
    correctReasoning: '命理符号从来不是单独起效的；带贵人星与实际际遇并无稳定对应，历史上境遇坎坷而命带贵人者并不少见。',
    explanation: 'E06 + E04：把一个符号说成终身保障，忽略组合与时间变化。',
    errorTypes: ['E06', 'E04'], masteryKeys: ['counterexample', 'uncertainty'] }),

  // ============ 四、解释拆解（dec-31 ~ dec-35） ============
  D({ id: 'dec-31', category: 'deconstruct', title: '本命年穿红的层', emoji: '🧧',
    level: 1, difficulty: 1,
    prompt: '拆开一条常见说法，分清它的来源层次。',
    statement: '「本命年穿红」的说法，来自古籍记载、某个流派的规则，还是民间观念？',
    ...op(['这是有明确古籍出处的规矩', '主要是民间观念（红色辟邪的民俗传统），没有统一的古籍出处，具体怎么穿各地说法不一', '这是官方规定的礼仪'], 1),
    correctReasoning: '「本命年穿红」是近现代民俗观念的组成部分，属于民间说法范畴；不同地区、不同时代的具体做法各不相同，暂无可靠出处可统一溯源。',
    explanation: 'E10 + E02：把民间观念误当成有出处的规则，并当成事实标准。',
    errorTypes: ['E10', 'E02'], masteryKeys: ['structure', 'evidence'] }),

  D({ id: 'dec-32', category: 'deconstruct', title: '坐北朝南的层', emoji: '🧭',
    level: 1, difficulty: 1,
    prompt: '拆开一条常见说法，分清它的层次。',
    statement: '「坐北朝南招财」——朝向好（采光通风）与「招财」是两件事，这条说法把两层混在一起了。',
    ...op(['朝向好就招财，是一件事', '「坐北朝南采光通风好」有现实依据；「招财」是民间观念，二者被话术连成了一条因果链', '整句话都是古人的迷信'], 1),
    correctReasoning: '把可观察的现实好处（采光、通风、保暖）与不可验证的说法（招财）区分开，是拆解的关键；前者有现实依据，后者属于民间观念。',
    explanation: 'E02 + E08：把有现实依据的部分与民间观念混为一条因果链。',
    errorTypes: ['E02', 'E08'], masteryKeys: ['structure', 'evidence'] }),

  D({ id: 'dec-33', category: 'deconstruct', title: '奇门择时的三层', emoji: '⏰',
    level: 2, difficulty: 2,
    prompt: '拆开一条常见说法，分清规则层、说法层与话术层。',
    statement: '「奇门择时办事必成」——这里有排盘规则、经验说法、营销话术三层。',
    ...op(['三层是一体的，奇门择时就是必成', '排盘是确定性的规则层；「这个时辰好办事」是经验与流派说法层；「必成」是营销话术层，三层不能混为一谈', '奇门是法术，没有规则层'], 1),
    correctReasoning: '奇门排盘有确定规则（局数、八门九星等），但「吉时」判断存在流派差异，而「必成」属于销售话术；把三层粘成一层是常见误导。',
    explanation: 'E10 + E06：把规则层、说法层、话术层混在一起，还过度承诺结果。',
    errorTypes: ['E10', 'E06'], masteryKeys: ['structure', 'synthesis'] }),

  D({ id: 'dec-34', category: 'deconstruct', title: '化太岁的层', emoji: '🏯',
    level: 3, difficulty: 3,
    prompt: '拆开一条常见说法，分清民俗观念与衍生话术。',
    statement: '「犯太岁必须去化太岁」——「犯太岁」是民俗观念，「必须化解」是商家话术。',
    ...op(['犯太岁不化解就会出大事', '「犯太岁」是民间观念（生肖与流年太岁的关系），「必须化解」是衍生出的消费话术；不同地区、不同时代的化解方式各不相同，没有统一标准', '太岁是真实存在的神灵，必须供奉'], 1),
    correctReasoning: '太岁信仰有深厚的民俗与宗教背景，但「犯太岁必须化」以及具体怎么化，民间说法各异，且与商业消费深度绑定；把「必须」当作定论缺乏可靠依据。',
    explanation: 'E02 + E06：把民俗观念说成必须执行的规则，并放大了后果。',
    errorTypes: ['E02', 'E06'], masteryKeys: ['synthesis', 'evidence'] }),

  D({ id: 'dec-35', category: 'deconstruct', title: '流年不利话术的层', emoji: '🎭',
    level: 4, difficulty: 4,
    prompt: '拆解一条典型的营销断语。',
    statement: '「今年流年不利，需要请个镇物挡一挡」——这句营销话术里混入了哪几层？',
    ...op(['这是专业的命理判断，只有一层', '「流年不利」是对命理框架的简化引用，「需要镇物」把民间辟邪观念转成商品话术；整句缺少可验证的判断依据', '这句话有官方依据'], 1),
    correctReasoning: '「流年不利」本身就需要具体断法支撑，而「需要镇物」更是在观念之上叠加了购买行为；整句话既无出处也无验证，属于话术层的典型结构。',
    explanation: 'E10 + E02：把话术层包装成专业判断，并当成事实输出。',
    errorTypes: ['E10', 'E02'], masteryKeys: ['structure', 'synthesis'] }),

  // ============ 五、传统冲突（tc-21 ~ tc-25） ============
  D({ id: 'tc-21', category: 'tradition-conflict', title: '本命年的说法之争', emoji: '⚔️',
    level: 1, difficulty: 1,
    prompt: '关于同一个民俗对象，存在多种说法。哪种看法更合理？',
    statement: '关于「本命年」：有人说本命年必须穿红避邪，也有人说本命年是「值太岁」需要化太岁，还有人说本命年只是民俗纪念。',
    ...op(['只有穿红避邪一种说法', '民间观念、流派说法、现代解释在历史上并存且互相渗透，不同地区说法不一，不存在唯一的「正宗」', '文献里能查到统一标准'], 1),
    correctReasoning: '本命年观念在不同时代、不同地区形态各异：有避邪民俗、有命理化的「值太岁」说法、也有现代把它当作文化纪念的理解；三者在不同层面成立，不必互相否定。',
    explanation: 'E07 + E02：把多样化的民间观念强行收编为唯一标准。',
    errorTypes: ['E07', 'E02'], masteryKeys: ['synthesis', 'evidence'] }),

  D({ id: 'tc-22', category: 'tradition-conflict', title: '化太岁的做法分歧', emoji: '⚔️',
    level: 1, difficulty: 1,
    prompt: '关于同一个民俗对象，存在多种做法。哪种看法更合理？',
    statement: '关于「化太岁」：有的说去庙里安太岁，有的说戴红绳，有的说请某类饰品。这几套说法是什么关系？',
    ...op(['肯定只有一套是对的', '这些都是后世民俗演化出的不同做法，没有统一文献出处，属于民间观念内部的多样形态，不该互相拆台或分出唯一正确', '文献记载了唯一标准的化解法'], 1),
    correctReasoning: '化太岁做法是民俗与宗教实践长期演化的产物，各地各派做法不同；把它们当成竞争关系、争唯一正宗，是把「多样性」误当成「对错问题」。',
    explanation: 'E07 + E03：把做法差异当成对错之争，忽略整体民俗背景。',
    errorTypes: ['E07', 'E03'], masteryKeys: ['synthesis', 'uncertainty'] }),

  D({ id: 'tc-23', category: 'tradition-conflict', title: '六合婚配 vs 现实相处', emoji: '⚔️',
    level: 2, difficulty: 2,
    prompt: '民俗说法与现代解释冲突时，哪种态度更合理？',
    statement: '关于「属相合婚」：民间流传「六合生肖婚配吉，相冲生肖婚配凶」，而现代解释认为婚配幸福取决于现实相处。',
    ...op(['相信六合，属相不合就分手', '「六合/相冲」是民俗分类，用于婚配属于后世引申；现代解释从现实因素出发。两种说法依据的层面不同，不能简单用其中一种给婚姻下结论', '只有现代解释对，民俗全是错的'], 1),
    correctReasoning: '民俗分类描述的是符号层面的相配关系，现代解释关注的是现实互动；两者层面不同，合理态度是各自注明依据，而不是让符号直接裁决婚姻。',
    explanation: 'E02 + E06：把民俗分类当成婚姻的现实裁决标准。',
    errorTypes: ['E02', 'E06'], masteryKeys: ['synthesis', 'reasoning'] }),

  D({ id: 'tc-24', category: 'tradition-conflict', title: '转盘 vs 飞盘', emoji: '⚔️',
    level: 3, difficulty: 3,
    prompt: '流派之间出现排盘差异时，哪种态度更合理？',
    statement: '关于「奇门择时」：转盘奇门与飞盘奇门排出的盘有时不同，网上两派都说自己才是正宗。',
    ...op(['必有一派是假的，要找出唯一正宗', '奇门本身有转盘、飞盘、阴盘阳盘等传承差异，排法不同源于流派规则不同，是真实的历史多元，不是简单真假问题', '所有奇门盘都一样'], 1),
    correctReasoning: '奇门流派在起局方式、转盘/飞盘布法上确实存在规则差异，这是传承多元而非谁在造假；比较时应说明各自规则与适用语境。',
    explanation: 'E07 + E03：把流派差异当成真假之争，忽略传承的整体脉络。',
    errorTypes: ['E07', 'E03'], masteryKeys: ['synthesis', 'uncertainty'] }),

  D({ id: 'tc-25', category: 'tradition-conflict', title: '两个「贵人」', emoji: '⚔️',
    level: 4, difficulty: 4,
    prompt: '同名概念在不同体系中出现时，哪种态度更合理？',
    statement: '关于「贵人」：六壬传统对贵人的起法与顺逆布法在不同传承里有不同口诀，民间又把「天乙贵人」当成保佑自己的吉星。',
    ...op(['都是同一个贵人，规则都一样', '六壬的「天乙贵人」是课传结构里的神将之一，其起法与顺逆有规则分歧；民间的「贵人星保佑」是命理民俗的引申。同名不同义，混用会制造假冲突', '民间的贵人说法更权威'], 1),
    correctReasoning: '「天乙贵人」在六壬里是课传结构的一部分（有起例口诀差异），在民间说法里又被用作吉星象征；区分体系语境后，冲突大多是名称混用造成的。',
    explanation: 'E10 + E02：把两个体系里同名不同义的概念当成一回事。',
    errorTypes: ['E10', 'E02'], masteryKeys: ['structure', 'synthesis'] }),

  // ============ 六、自我怀疑（sd-21 ~ sd-25） ============
  D({ id: 'sd-21', category: 'self-doubt', title: '被话术推着走', emoji: '🪞',
    level: 1, difficulty: 1,
    prompt: '有人跟你说「今年你犯太岁，不化解会很麻烦」，你听完就想花钱化解。反思：问题出在哪一步？',
    statement: '「今年你犯太岁，不化解会很麻烦」——听完就想照做。',
    ...op(['我把「恐吓式话术」当成了可靠判断，没有先问依据是什么、能不能验证', '照做就好，不用想', '话术就是专业建议'], 0),
    correctReasoning: '当一条建议自带恐吓语气又催促消费时，最该先问证据与出处；我跳过了这一问，直接照单全收。',
    explanation: 'E05 + E06：忽略现实信息，被情绪化话术带着走。',
    errorTypes: ['E05', 'E06'], masteryKeys: ['independence', 'uncertainty'] }),

  D({ id: 'sd-22', category: 'self-doubt', title: '缺水就买黑衣服', emoji: '🪞',
    level: 1, difficulty: 1,
    prompt: '你看到自己的八字「缺水」，立刻买了黑色衣服。反思。',
    statement: '看到八字缺水，我立刻去买黑色衣服补一补。',
    ...op(['我把「缺水」当成了行动指令，没问「缺」在结构里意味着什么、补是否必要', '补上了就安心，没问题', '黑色衣服就是补水'], 0),
    correctReasoning: '「缺」只是盘面结构描述，把它直接翻译成「买黑衣服」的行动指令，中间跳过了取用与流派规则，也缺少任何效果验证。',
    explanation: 'E10 + E01：把结构术语当成购物指令，单点直接行动。',
    errorTypes: ['E10', 'E01'], masteryKeys: ['uncertainty', 'structure'] }),

  D({ id: 'sd-23', category: 'self-doubt', title: '没看依据就下单', emoji: '🪞',
    level: 2, difficulty: 2,
    prompt: '商家说「这个招财摆件放对位置就能旺财」，你下单了。反思你的决策链条。',
    statement: '商家说摆件放对位置就能旺财，我没看任何依据就下单了。',
    ...op(['我的决策跳过了证据环节：没有可验证的效果记录，却把商家的说法当成了购买依据', '花钱买个安心，不是问题', '商家不会骗人'], 0),
    correctReasoning: '购买决策完全建立在商家的单方说法上，既无效果记录也无对照信息；意识到这一点，下次应先找可验证的依据再决定。',
    explanation: 'E07 + E05：只采信支持购买的说法，忽略现实信息与验证。',
    errorTypes: ['E07', 'E05'], masteryKeys: ['evidence', 'independence'] }),

  D({ id: 'sd-24', category: 'self-doubt', title: '一次成功当验证', emoji: '🪞',
    level: 3, difficulty: 3,
    prompt: '你用奇门挑了「吉时」去面试，面试通过了。你觉得自己判断很准。反思。',
    statement: '吉时面试通过，我认为这是奇门择时起效。',
    ...op(['我把一次成功当成了方法有效的证据，没有考虑基准概率与其它解释（准备、岗位匹配等）', '通过了就是起效，无需怀疑', '失败才是运气问题'], 0),
    correctReasoning: '一次通过既可能源于准备充分、岗位匹配，也可能只是概率；没有多次记录与对照，不能把结果归因于择时。',
    explanation: 'E08 + E07：把一次同时发生当因果，只记住成功样本。',
    errorTypes: ['E08', 'E07'], masteryKeys: ['evidence', 'uncertainty'] }),

  D({ id: 'sd-25', category: 'self-doubt', title: '断凶却办成', emoji: '🪞',
    level: 4, difficulty: 4,
    prompt: '你断一个六壬课说「大凶」，结果事情办成了。反思你最可能错在哪？',
    statement: '我断课式为大凶，结果事情顺利办成。',
    ...op(['我最可能把单个课式或单一因素当成了全部依据，忽略了三传生克与类神的综合判断', '断错了就说明六壬不可信', '是我运气差，不是方法问题'], 0),
    correctReasoning: '断课依赖课传结构的综合分析，单凭课体名或单一神将定凶，最容易被结果证伪；这次「办成」正是提醒我检查是否只看了局部。',
    explanation: 'E01 + E03：只看单一点就下结论，忽略了课传整体结构。',
    errorTypes: ['E01', 'E03'], masteryKeys: ['structure', 'uncertainty'] }),
]
