// ============================================================
// AI 老师的三个人格：温柔 / 实战 / 怀疑。
// 只改变「语气与反馈侧重」，不改变教学内容与评分结果。
// ============================================================

export const PERSONAS = {
  gentle: {
    id: 'gentle',
    label: '温柔老师',
    emoji: '🌿',
    desc: '多鼓励、多引导、少批评。',
    greet: '别紧张，慢慢来。我们先从一个小问题开始。',
    correct: [
      '做得很好，你抓住了关键。继续保持。',
      '这一步踩得很稳。能再说说你是怎么想到的吗？',
      '对了。你已经开始用自己的话复述思路了。',
      '很好，方向没错。顺着这个思路继续。',
    ],
    wrong: '没关系，这一步偏了。我们一起看看问题出在哪。',
    challenge: '不着急，跟着我一步一步来。',
  },
  combat: {
    id: 'combat',
    label: '实战老师',
    emoji: '⚔️',
    desc: '少提示、直接挑战、强调证据。',
    greet: '闲话少说，上案例。我要看你的证据，不是感觉。',
    correct: [
      '可以。但要答我：你的依据是什么？',
      '没错。说说你这一步的证据来自哪里？',
      '方向对了。你的判断是哪条信息推出来的？',
      '这一步成立。你参考了哪条规则？',
    ],
    wrong: '停。这里证据不够，你的结论下得太早了。',
    challenge: '直接来。别绕，拿证据说话。',
  },
  skeptic: {
    id: 'skeptic',
    label: '怀疑老师',
    emoji: '🧠',
    desc: '专找漏洞、常提反例、不轻易接受结论。',
    greet: '记住，我的职责是给你的每个判断找漏洞。',
    correct: [
      '这次我暂时挑不出毛病。但换一个证据，你的结论还成立吗？',
      '暂时没找到漏洞。换个角度看，你还能找到反对的理由吗？',
      '逻辑上通了。你能再给一个反例吗？',
      '目前这一步没问题。换一个情境，它还成立吗？',
    ],
    wrong: '漏洞在这：你只看了支持的一面。反过来呢？',
    challenge: '先别急着接受结论——它最可能错在哪？',
  },
}

export function getPersona(state) {
  const id = state?.settings?.teacherPersona || 'gentle'
  return PERSONAS[id] || PERSONAS.gentle
}

// 根据人格生成「差一点/做对了」的叙事语气，供课堂反馈复用。
// 支持传入人格 id 或人格对象；数组型文案每次随机取一条，避免复读机。
export function personaLine(persona, kind) {
  const p = typeof persona === 'string' ? PERSONAS[persona] || PERSONAS.gentle : persona
  const src = (p && p[kind]) || (p && p.greet) || PERSONAS.gentle.greet
  if (Array.isArray(src)) {
    return src[Math.floor(Math.random() * src.length)]
  }
  return src
}