// ============================================================
// 🎮 易经互动玩法引擎（Phase 4 · Step 7）
// 全部 deterministic / 可注入随机源：闪卡出题、卦象侦探、古文破译。
// 设计原则：游戏化只增强学习，不掩盖内容；评价的是「解释质量与推理过程」。
// ============================================================

import { HEXAGRAMS, BAGUA } from './hexagrams-data'
import {
  getHexagram,
  hexagramRelations,
  oppositeHex,
  reverseHex,
  mutualHex,
  linesToSymbol,
} from './hexagramTools'

// ── 通用工具 ──────────────────────────────────────────────

// 洗牌（可注入随机源，返回新数组）
export function shuffle(arr, rng = Math.random) {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

// 从数组中取 n 个不重复项（安全回退：不足时返回全部）
export function pickDistinct(arr, n, rng = Math.random) {
  const pool = [...arr]
  const out = []
  while (out.length < n && pool.length) {
    const i = Math.floor(rng() * pool.length)
    out.push(pool.splice(i, 1)[0])
  }
  return out
}

// 八卦名列表（按 BAGUA 键序）
const BAGUA_NAMES = Object.keys(BAGUA)

// ── ① 八卦闪卡 ──────────────────────────────────────────
// mode:
//   'symbol-name'        卦符 → 卦名
//   'name-symbol'        卦名 → 卦符
//   'name-nature'        卦名 → 自然象
//   'upper-lower-name'   上下卦 → 六十四卦名
export function flashcardRound(mode, rng = Math.random) {
  if (mode === 'upper-lower-name') {
    const target = HEXAGRAMS[Math.floor(rng() * HEXAGRAMS.length)]
    const answer = target.full
    const distractorPool = HEXAGRAMS.filter((h) => h.full !== answer).map((h) => h.full)
    const options = shuffle([answer, ...pickDistinct(distractorPool, 3, rng)], rng)
    return {
      mode,
      prompt: `上${target.upper} 下${target.lower}`,
      hint: '这个上下卦组合是哪一卦？',
      answer,
      options,
      explain: `${target.upper}（上卦）＋${target.lower}（下卦）＝${answer}。`,
      nodeId: 'hg-read-card',
    }
  }

  const targetName = BAGUA_NAMES[Math.floor(rng() * BAGUA_NAMES.length)]
  const target = BAGUA[targetName]

  if (mode === 'name-nature') {
    const answer = target.nature
    const pool = Object.values(BAGUA).map((b) => b.nature)
    const options = shuffle([answer, ...pickDistinct(pool.filter((n) => n !== answer), 3, rng)], rng)
    return {
      mode,
      prompt: `${targetName}（${target.symbol}）`,
      hint: '它的自然象是什么？',
      answer,
      options,
      explain: `${targetName}＝${target.nature}，八卦以「自然之象」立义：乾天、坤地、震雷、巽风、坎水、离火、艮山、兑泽。`,
      nodeId: 'bg-genesis',
    }
  }

  if (mode === 'name-symbol') {
    const answer = target.symbol
    const pool = BAGUA_NAMES.map((n) => BAGUA[n].symbol)
    const options = shuffle([answer, ...pickDistinct(pool.filter((s) => s !== answer), 3, rng)], rng)
    return {
      mode,
      prompt: targetName,
      hint: '它的卦符是？',
      answer,
      options,
      explain: `${targetName} 的卦符是 ${target.symbol}，三爻结构 ${target.trigram}（自下而上）。`,
      nodeId: 'bg-xiantian',
    }
  }

  // symbol-name（默认）
  const answer = targetName
  const options = shuffle([answer, ...pickDistinct(BAGUA_NAMES.filter((n) => n !== answer), 3, rng)], rng)
  return {
    mode,
    prompt: target.symbol,
    hint: '这个卦符是哪一卦？',
    answer,
    options,
    explain: `${target.symbol} 是${targetName}，三爻结构 ${target.trigram}，其德为「${target.keyword}」。`,
    nodeId: 'bg-xiantian',
  }
}

// 闪卡关卡配置（供界面复用）
export const FLASH_MODES = [
  { value: 'symbol-name', label: '卦符→卦名', desc: '看到卦符，认出卦名' },
  { value: 'name-symbol', label: '卦名→卦符', desc: '看到卦名，写出卦符' },
  { value: 'name-nature', label: '卦名→自然象', desc: '八卦的自然之象' },
  { value: 'upper-lower-name', label: '上下卦→卦名', desc: '上下卦组合出六十四卦' },
]

// ── ② 卦象侦探 ──────────────────────────────────────────
// kind: 'opposite' 错卦 / 'reverse' 综卦 / 'mutual' 互卦
// 返回：目标卦 + 正确选项 + 干扰项 + 判定依据（可解释）
export function detectiveRound(kind, rng = Math.random) {
  for (let guard = 0; guard < 50; guard++) {
    const target = HEXAGRAMS[Math.floor(rng() * HEXAGRAMS.length)]
    const rel = hexagramRelations(target)
    const answerHex = rel[kind]
    if (!answerHex || answerHex.name === target.name) continue // 自反/自错等情况跳过
    const distractorPool = HEXAGRAMS.filter((h) => h.name !== answerHex.name && h.name !== target.name).map((h) => h.name)
    const options = shuffle([answerHex.name, ...pickDistinct(distractorPool, 3, rng)], rng)
    return {
      kind,
      target: {
        name: target.name,
        full: target.full,
        lines: target.lines,
        symbol: linesToSymbol(target.lines),
      },
      answer: answerHex.name,
      options,
      why: detectiveWhy(kind, target, answerHex),
      nodeId: 'hc-detective',
    }
  }
  return null
}

function detectiveWhy(kind, target, answerHex) {
  const base = `${target.full}（${linesToSymbol(target.lines)}）`
  if (kind === 'opposite') {
    return `${base} 的错卦是把每一爻阴阳全换：${oppositeHex(target.lines)} → ${answerHex.full}。错卦也叫「旁通」，看的是「完全相反」的立场。`
  }
  if (kind === 'reverse') {
    return `${base} 的综卦是把六爻上下颠倒：${reverseHex(target.lines)} → ${answerHex.full}。综卦也叫「覆卦」，看的是「反过来看」的视角。`
  }
  return `${base} 的互卦取 2/3/4 爻为下卦、3/4/5 爻为上卦：${mutualHex(target.lines)} → ${answerHex.full}。互卦藏在六爻内部，看的是「卦中藏卦」。`
}

export const DETECTIVE_KINDS = [
  { value: 'opposite', label: '错卦', hint: '六爻阴阳全换' },
  { value: 'reverse', label: '综卦', hint: '六爻上下颠倒' },
  { value: 'mutual', label: '互卦', hint: '取 2-4 与 3-5 爻' },
]

// ── ③ 古文破译室 ────────────────────────────────────────
// 精选公版卦辞（来源：通行本《周易》卦辞，公版文本），
// 每条包含：原文 / 关键概念词 / 正确白话 / 干扰解释 / 多种解释说明。
export const TEXT_DECODER_SET = [
  {
    id: 'qian',
    name: '乾',
    guaci: '元亨利贞。',
    tokens: ['元', '亨', '利', '贞'],
    keyTokens: ['元', '贞'],
    meaning: '「元亨利贞」是乾卦四德：创始、通达、适宜、正固。它描述一个完整过程，不是一句单纯的「大吉大利」。',
    wrongMeanings: [
      '四个字都表示「很顺利」，读作「非常吉利」就行。',
      '意思是「一开始就赚钱，一直赚下去」。',
      '只要保持「进取」，任何时候都会成功。',
    ],
    multiNote: '历代对四德有多种讲法：有解作「春夏秋冬」四时之德，有解作「仁义礼智」四德。都认可「元亨利贞」是一个有层次的过程描述，而非笼统的吉祥话。',
    nodeId: 'ht-guaci',
  },
  {
    id: 'kun',
    name: '坤',
    guaci: '元亨，利牝马之贞。君子有攸往，先迷后得主。',
    tokens: ['元亨', '牝马', '贞', '有攸往', '先迷', '后得主'],
    keyTokens: ['牝马', '后得主'],
    meaning: '坤以「牝马」为喻：母马柔顺却健行，能跟随而不盲从。「先迷后得主」指抢先冒进会迷失，跟随正道反而有主。',
    wrongMeanings: [
      '意思是「女人要服从男人，跟着走就行」。',
      '坤卦完全代表「被动软弱」，什么都不用做。',
      '牝马只是比喻「速度慢」，做事慢一点就好。',
    ],
    multiNote: '「牝马」与「先迷后得主」在历代解释中侧重不同：有重「顺」、有重「健而顺」。但把坤解作「纯粹的服从」是后世简化，经典原意是「承载而有边界」的德性。',
    nodeId: 'ht-guaci',
  },
  {
    id: 'tun',
    name: '屯',
    guaci: '元亨利贞。勿用有攸往，利建侯。',
    tokens: ['元亨利贞', '勿用', '有攸往', '利建侯'],
    keyTokens: ['勿用', '利建侯'],
    meaning: '屯是万物初生、困难重重的阶段：这时不宜贸然远行，而要先「建侯」——把根基和帮手立起来。',
    wrongMeanings: [
      '屯卦就是「倒霉」，遇到屯就什么都不做。',
      '「勿用有攸往」意思是永远不要行动。',
      '「利建侯」是鼓励去当官发财。',
    ],
    multiNote: '「利建侯」有解作「封建诸侯」，也有解作「建立自己的根基与依靠」。两种讲法一致指向：困难期要先立根基，而不是急着远行。',
    nodeId: 'ht-guaci',
  },
  {
    id: 'meng',
    name: '蒙',
    guaci: '匪我求童蒙，童蒙求我。初筮告，再三渎，渎则不告。',
    tokens: ['匪我求', '童蒙', '初筮告', '再三渎', '渎则不告'],
    keyTokens: ['童蒙求我', '渎则不告'],
    meaning: '蒙卦讲求学的姿态：是学习者主动来问，教才有效；反复追问同一件事是轻慢，轻慢就不再回答。',
    wrongMeanings: [
      '「蒙」就是「笨」，蒙卦在评价人的智商。',
      '「渎则不告」意思是问问题会被凶。',
      '学习者应该被动等待老师主动教学。',
    ],
    multiNote: '「童蒙」历代都解作「蒙昧待启之人」，但强调的是「求学态度」而非智商标签；「再三渎」的重心在「轻慢」，不在「次数本身」。',
    nodeId: 'ht-guaci',
  },
  {
    id: 'xu',
    name: '需',
    guaci: '有孚，光亨，贞吉。利涉大川。',
    tokens: ['有孚', '光亨', '贞吉', '利涉大川'],
    keyTokens: ['有孚', '利涉大川'],
    meaning: '需是「等待」：带着诚信与信心等待条件成熟，才能「利涉大川」——该等的时候等，不是干等，更不是永远不动。',
    wrongMeanings: [
      '需卦就是「拖延症」，劝人一直拖着。',
      '「利涉大川」是要人真的去渡河。',
      '等待等于被动，什么都不准备。',
    ],
    multiNote: '需卦的关键在「等什么、为什么等」：有孚（内心有据）的等与空耗的等完全不同。后世解卦常把「等待」误读为「拖延」。',
    nodeId: 'ht-guaci',
  },
  {
    id: 'song',
    name: '讼',
    guaci: '有孚窒惕，中吉，终凶。利见大人，不利涉大川。',
    tokens: ['有孚窒惕', '中吉', '终凶', '利见大人', '不利涉大川'],
    keyTokens: ['中吉', '终凶'],
    meaning: '讼卦讲争讼：能争赢也不一定好——适可而止是中吉，争到底终凶；所以要找明理的人调停，不要硬闯大险。',
    wrongMeanings: [
      '讼卦教你打官司的策略，赢到最后最好。',
      '「中吉」指中间位置的人吉祥。',
      '遇到纠纷一定要争到底，争赢就是胜利。',
    ],
    multiNote: '「中吉终凶」是讼卦的核心张力：卦辞肯定「中」（适可而止），否定「终」（争到底）。这是「以和为贵」在卦辞中的直接体现。',
    nodeId: 'ht-guaci',
  },
  {
    id: 'tai',
    name: '泰',
    guaci: '小往大来，吉亨。',
    tokens: ['小往', '大来', '吉亨'],
    keyTokens: ['小往', '大来'],
    meaning: '泰卦「小往大来」：阴往阳来，天地交而万物通。但泰卦最深刻的是九三「无平不陂」——通畅是条件性的，不是永久的。',
    wrongMeanings: [
      '泰卦等于「永远顺利」，抽到就一直好下去。',
      '「小往大来」指小的离开、大的进来，所以是财运卦。',
      '泰就是「太平」，什么都不用担心。',
    ],
    multiNote: '泰卦卦辞虽吉，但爻辞反复提醒「无平不陂，无往不复」。若只读卦辞不读爻辞，会漏掉泰卦最核心的警惕。',
    nodeId: 'ht-guaci',
  },
  {
    id: 'pi',
    name: '否',
    guaci: '否之匪人，不利君子贞，大往小来。',
    tokens: ['匪人', '不利君子贞', '大往小来'],
    keyTokens: ['不利君子贞', '大往小来'],
    meaning: '否卦天地不交、闭塞不通：不利的局面下，君子要「俭德辟难」——保存自己、不慕荣利，等待转机（否极泰来）。',
    wrongMeanings: [
      '否卦就是「全坏」，抽到注定倒霉。',
      '「匪人」指卦象里有个坏人要害你。',
      '闭塞时期什么都不要做，躺平就好。',
    ],
    multiNote: '否极泰来是经典自己的结构：否卦教的是「闭塞期的自处」，不是认命。把否读成「全坏」就漏掉了保存与转机的空间。',
    nodeId: 'ht-guaci',
  },
  {
    id: 'qian2',
    name: '谦',
    guaci: '亨，君子有终。',
    tokens: ['亨', '君子', '有终'],
    keyTokens: ['君子有终'],
    meaning: '谦卦「君子有终」：谦不是假装低调，而是「有功而不自居」——有实力而自处低，才能善始善终。',
    wrongMeanings: [
      '谦就是「没本事也要装低调」。',
      '谦卦劝人永远退让，不要争取任何东西。',
      '「有终」指最后一定会发财成功。',
    ],
    multiNote: '谦卦的前提是「有」：有实力而自处低才是谦；空无一物的低调只是空。后世把「谦」简化成「客套退让」，丢了「有功」这个前提。',
    nodeId: 'ht-guaci',
  },
  {
    id: 'fu',
    name: '复',
    guaci: '亨。出入无疾，朋来无咎。反复其道，七日来复。利有攸往。',
    tokens: ['出入无疾', '朋来无咎', '反复其道', '七日来复', '利有攸往'],
    keyTokens: ['反复其道', '七日来复'],
    meaning: '复卦一阳来复：败到极点，生机已在萌动。「不远复」——犯错后及时回头，越早恢复越省力。',
    wrongMeanings: [
      '复卦是说「循环一定发生」，所以可以等它自然变好。',
      '「七日来复」是预言七天后一定成功。',
      '复就是「卷土重来」，跌得越重越好。',
    ],
    multiNote: '复卦强调「早回头」：「不远复，无祗悔」。把复读成「等循环自动变好」就漏掉了卦中「主动回头」的动作。',
    nodeId: 'ht-guaci',
  },
  {
    id: 'jiji',
    name: '既济',
    guaci: '亨小，利贞。初吉终乱。',
    tokens: ['亨小', '利贞', '初吉终乱'],
    keyTokens: ['初吉终乱'],
    meaning: '既济是「已经渡过」：事成之后更要守正。「初吉终乱」——开头顺利，若松懈，结局会乱；守正是唯一防乱的办法。',
    wrongMeanings: [
      '既济＝大功告成，可以放心庆祝了。',
      '「亨小」指小人物才顺利。',
      '既济之后一切稳定，不需要再努力。',
    ],
    multiNote: '既济是六十四卦中唯一「六爻皆当位」的卦，看似圆满，卦辞却警告「初吉终乱」。圆满恰恰是警惕的开始。',
    nodeId: 'ht-guaci',
  },
  {
    id: 'weiji',
    name: '未济',
    guaci: '亨。小狐汔济，濡其尾，无攸利。',
    tokens: ['小狐', '汔济', '濡其尾', '无攸利'],
    keyTokens: ['汔济', '濡其尾'],
    meaning: '未济是「还没渡过」：小狐狸快上岸时弄湿尾巴——越接近成功越要谨慎，未完成反而意味着还有空间。',
    wrongMeanings: [
      '未济＝失败，抽到就说明做不成。',
      '「濡其尾」是预言会受伤。',
      '未完成就一定是坏事，要尽快结束。',
    ],
    multiNote: '未济是全卦最后一卦：事未成而可成。它讲「接近成功时的谨慎」，把未济读成「失败判决」就偏离了卦意。',
    nodeId: 'ht-guaci',
  },
]

// 破译题：随机（或按 id）取一条
export function decoderRound(rng = Math.random) {
  return TEXT_DECODER_SET[Math.floor(rng() * TEXT_DECODER_SET.length)]
}

// 破译评价（deterministic）：
//   1) 关键词命中：用户选中的核心词比例
//   2) 解释质量：是否命中正确白话、是否含绝对化表达
export function evaluateDecoder(item, selectedTokens, chosenMeaning, ownWords = '') {
  const keyHit = item.keyTokens.filter((t) => selectedTokens.includes(t)).length
  const keyScore = Math.round((keyHit / Math.max(item.keyTokens.length, 1)) * 100)

  let meaningScore = 0
  if (chosenMeaning) meaningScore = chosenMeaning === item.meaning ? 100 : 25

  // 绝对化表达检测（确定性词表）
  const absolutes = ['一定', '必然', '肯定', '永远', '绝对', '注定', '百分之百', '就是', '等于']
  const over = absolutes.filter((w) => (ownWords || '').includes(w))
  const overPenalty = over.length ? Math.min(over.length * 15, 45) : 0

  const quality = Math.max(0, Math.round(keyScore * 0.4 + meaningScore * 0.6 - overPenalty))

  let note = ''
  if (over.length) note = `你用了「${over.join('、')}」这类绝对化表达——卦辞提供的是视角，不是确定结论。`
  else if (keyScore >= 80 && meaningScore >= 80) note = '关键词抓得准，白话解释也对，理解到位。'
  else if (meaningScore >= 80) note = '白话解释对，但可以再看看哪些词是真正的核心。'
  else if (keyScore >= 80) note = '关键词抓得不错，再对照一下白话解释与原文的对应。'
  else note = '多留意卦辞里反复出现的关键词，它们常是理解入口。'

  return { keyScore, meaningScore, quality, overWords: over, note, nodeId: item.nodeId }
}
