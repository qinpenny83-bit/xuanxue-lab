// ============================================================
// 自适应训练引擎（V1.6 → V2 → V3）
// 发现问题 → 修改下一次训练。
// 不是「告诉用户有问题」，而是把下一次训练换成对应能力。
// V2 新增：瓶颈驱动推荐（8 维能力档案）。
// V3 新增：知识 Mastery 优先——遗忘复习 > 知识瓶颈 > 能力瓶颈。
//   deterministic：全部来自真实行为数据，无随机。
// 兼容：旧状态（无 V3 课程数据）时自动回退原逻辑。
// ============================================================

import { CASES, getCase } from '../data/cases'
import { getCurriculumNode } from '../data/curriculum'
import { DIMENSION_KEYS } from './masteryEngine'
import { reviewQueue, knowledgeBottleneck } from './knowledgeMastery'
import { getLesson } from '../data/lessons'

const TRAINING_MODES = {
  evidence: {
    key: 'evidence',
    label: '证据训练',
    emoji: '🔎',
    desc: '训练「证据是否足够支持结论」：判断证据强弱、识别信息不足、学会说「现在还不能下结论」。',
    brief: '在下结论之前，找到至少两个能支持你判断的证据。',
  },
  counter: {
    key: 'counter',
    label: '反例训练',
    emoji: '⚖️',
    desc: '训练主动寻找反例：逼自己找一条反对证据，再决定要不要保留结论。',
    brief: '给出结论前，先写下一条「可能推翻它」的证据。',
  },
  calibration: {
    key: 'calibration',
    label: '信心校准训练',
    emoji: '🎯',
    desc: '训练信心与实际判断质量对齐：高信心的判断，是否真的值这么高的把握？',
    brief: '每个判断前，先问自己：这个把握的底气来自几条证据？',
  },
  judgment: {
    key: 'judgment',
    label: '判断训练',
    emoji: '🧭',
    desc: '训练在证据充分时果断下结论：别让过度怀疑压住你已经会的判断。',
    brief: '列出你看到的关键证据，然后给一个「基于这些证据」的结论。',
  },
  boundary: {
    key: 'boundary',
    label: '判断边界训练',
    emoji: '🚧',
    desc: '训练「知道何时该说无法判断」：区分证据不足、信息冲突与真的不会。',
    brief: '每次判断前先问：现有信息足够支持结论吗？不够就明确说出来。',
  },
  synthesis: {
    key: 'synthesis',
    label: '综合分析训练',
    emoji: '🧩',
    desc: '训练多变量整合与解释比较：同时处理多条线索，比较不同解释的支持度。',
    brief: '列出每个变量，比较不同解释各自的支持与反对证据，再选倾向。',
  },
  independence: {
    key: 'independence',
    label: '独立分析训练',
    emoji: '🧗',
    desc: '训练独立完成案例：不给选项、不给提示，由你自己决定从哪开始。',
    brief: '这次没有人提示你，你自己决定先看什么、怎么判断。',
  },
  knowledge: {
    key: 'knowledge',
    label: '知识补强',
    emoji: '📚',
    desc: '概念结构理解偏弱时，先回到课堂补框架，再回案例应用。',
    brief: '先复习相关概念，再回到案例里应用。',
  },
  reasoning: {
    key: 'reasoning',
    label: '推理链训练',
    emoji: '🔗',
    desc: '训练从线索到结论的完整推理链：每一步都要有依据，不跳步。',
    brief: '把你的推理每一步写出来：线索 → 依据 → 结论。',
  },
  review: {
    key: 'review',
    label: '遗忘复习',
    emoji: '🔁',
    desc: '有些知识你已经掌握过，但太久没用了。用「一个高价值复习案例」把记忆接回来，而不是重复刷题。',
    brief: '重做一次相关案例或课程，检验知识是否还接得上。',
  },
}

// 能力瓶颈 → 训练模式
const BOTTLENECK_MODE = {
  observation: 'evidence',
  structure: 'knowledge',
  evidence: 'evidence',
  reasoning: 'reasoning',
  counterexample: 'counter',
  uncertainty: 'boundary',
  synthesis: 'synthesis',
  independence: 'independence',
}

// 瓶颈说明文案（真实数据驱动，数字来自能力档案）
const BOTTLENECK_WHY = {
  observation: (v) => `你的观察能力 ${v}/100——在最近案例里，你容易漏掉或忽略关键线索。瓶颈不在知识量，而在「先看什么」。`,
  structure: (v) => `你的结构理解 ${v}/100——概念框架之间容易混在一起。瓶颈不在做题量，而在「知识点之间的关系」。`,
  evidence: (v) => `你的证据意识 ${v}/100——容易在证据不足时就下结论。这是当前最需要训练的判断习惯。`,
  reasoning: (v) => `你的推理能力 ${v}/100——从线索到结论的链条里偶尔跳步。瓶颈在于「每一步都要有依据」。`,
  counterexample: (v) => `你的反例意识 ${v}/100——你更习惯找支持自己的证据。瓶颈在于「主动找推翻自己的证据」。`,
  uncertainty: (v) => `你的不确定性管理 ${v}/100——判断边界还不够稳。瓶颈在于「什么时候该说无法判断」。`,
  synthesis: (v) => `你的综合分析 ${v}/100——多变量与多解释场景还不够稳。瓶颈在于「同时处理多条线索」。`,
  independence: (v) => `你的独立分析 ${v}/100——提示依赖偏高。瓶颈在于「没人提示时自己决定从哪开始」。`,
}

function tagMatches(c, mode) {
  const tag = c.trainingTag
  if (!tag) return false
  if (mode === 'evidence') return ['evidence', 'boundary', 'insufficient', 'mislead', 'conflict'].includes(tag)
  if (mode === 'counter') return ['counter', 'conflict', 'correlation'].includes(tag)
  if (mode === 'calibration') return ['calibration', 'mislead', 'confident-error'].includes(tag)
  if (mode === 'judgment') return ['judgment', 'insufficient'].includes(tag)
  if (mode === 'boundary') return ['boundary', 'insufficient', 'ambiguous'].includes(tag)
  if (mode === 'synthesis') return ['synthesis', 'ambiguous', 'conflict', 'master'].includes(tag)
  if (mode === 'independence') return c.mode === 'independent' || c.mode === 'master'
  if (mode === 'reasoning') return ['insufficient', 'conflict', 'correlation', 'revision', 'ambiguous'].includes(tag)
  return tag === mode
}

// 选择与训练目标匹配、且用户还没完成的案例
function pickCase(state, mode) {
  const done = state.completedCases || {}
  const pool = CASES.filter((c) => tagMatches(c, mode) && !done[c.id])
  const fallback = CASES.filter((c) => !done[c.id])
  const cs = pool[0] || fallback[0] || CASES[0]
  return cs || null
}

export function adaptiveTraining(state, fingerprint, masteryProfile) {
  // ── V3：知识 Mastery 优先（遗忘复习 > 知识瓶颈）────────────────
  const reviews = reviewQueue(state)
  if (reviews.length) {
    const r = reviews[0]
    const node = getCurriculumNode(r.nodeId)
    const done = state.completedCases || {}
    // 优先：该知识关联、且还没做过的案例；否则回该知识的课程
    const pool = (node?.caseIds || [])
      .map((id) => getCase(id))
      .filter((c) => c && !done[c.id])
    const cs = pool[0] || null
    const lesson = node ? getLesson(`v3-${node.id}`) : null
    return {
      type: 'review',
      label: '遗忘复习',
      emoji: '🔁',
      desc: TRAINING_MODES.review.desc,
      brief: TRAINING_MODES.review.brief,
      why: `「${node?.title || r.nodeId}」你已经掌握过，但已 ${r.daysSince} 天没复习，有效掌握度从 ${r.level} 降到 ${r.effectiveLevel}。先用一个高价值复习把它接回来。`,
      nodeId: r.nodeId,
      nodeTitle: node?.title || r.nodeId,
      caseId: cs?.id || null,
      caseTitle: cs?.title || null,
      lessonId: lesson ? lesson.id : null,
      lessonTitle: lesson ? lesson.title : null,
    }
  }

  const kbn = knowledgeBottleneck(state)
  if (kbn && kbn.status !== 'review') {
    const node = getCurriculumNode(kbn.nodeId)
    const lesson = node ? getLesson(`v3-${node.id}`) : null
    return {
      type: 'knowledge',
      label: '知识补强',
      emoji: '📚',
      desc: TRAINING_MODES.knowledge.desc,
      brief: TRAINING_MODES.knowledge.brief,
      why: `知识瓶颈在「${node?.title || kbn.nodeId}」：当前 ${kbn.level}/6，状态${kbn.status === 'unstable' ? '不稳定（学过但还接不上应用）' : '还在练习中'}${kbn.daysSince !== null ? `，已 ${kbn.daysSince} 天没巩固` : ''}。先回到这个节点补框架。`,
      nodeId: kbn.nodeId,
      nodeTitle: node?.title || kbn.nodeId,
      caseId: null,
      caseTitle: null,
      lessonId: lesson ? lesson.id : null,
      lessonTitle: lesson ? lesson.title : null,
    }
  }

  // ── V2：瓶颈驱动优先 ──────────────────────────────
  if (masteryProfile && masteryProfile.ready && masteryProfile.bottleneck) {
    const b = masteryProfile.bottleneck
    const avg = DIMENSION_KEYS.reduce((a, k) => a + (masteryProfile[k] ?? 0), 0) / DIMENSION_KEYS.length
    // 只有瓶颈显著（低于 64）或明显落后于平均时才触发定向训练
    const significant = b.value < 64 || avg - b.value >= 10
    if (significant) {
      const mode = BOTTLENECK_MODE[b.key]
      const cs = pickCase(state, mode)
      if (mode === 'knowledge') {
        return {
          type: 'knowledge',
          label: '知识补强',
          emoji: '📚',
          desc: TRAINING_MODES.knowledge.desc,
          brief: TRAINING_MODES.knowledge.brief,
          why: BOTTLENECK_WHY[b.key](b.value),
          bottleneck: b.key,
          bottleneckLabel: b.label,
          caseId: null,
          caseTitle: null,
        }
      }
      return {
        type: mode,
        ...TRAINING_MODES[mode],
        why: BOTTLENECK_WHY[b.key](b.value),
        bottleneck: b.key,
        bottleneckLabel: b.label,
        caseId: cs?.id || null,
        caseTitle: cs?.title || null,
      }
    }
  }

  // ── V1.6 回退：错误模式 + 信心偏差 ──────────────────
  if (!fingerprint || !fingerprint.ready) {
    return {
      type: 'normal',
      label: '按节奏推进',
      emoji: '🧩',
      desc: '行为样本还不足，先按原有路径学习，积累更多判断记录。',
      brief: '',
      why: '至少完成 3 个案例后，系统才能识别你的稳定模式并针对性训练。',
      caseId: null,
      caseTitle: null,
    }
  }

  const err = state.errorPatterns || {}
  const ev = fingerprint.evidence || {}
  const diff = ev.diffAvg ?? 0

  let mode = null
  let why = ''

  if ((err.E01 || 0) >= 3 || ((err.E01 || 0) >= 2 && diff >= 12)) {
    mode = 'evidence'
    why = `最近案例中「证据不足就下结论」的模式较明显：E01 出现 ${err.E01 || 0} 次，你的信心平均比实际判断质量高 ${Math.max(0, diff)} 分。`
  } else if ((err.E07 || 0) >= 2) {
    mode = 'counter'
    why = `你出现了「只寻找支持自己的证据」的模式（E07 共 ${err.E07 || 0} 次）。`
  } else if (diff >= 20) {
    mode = 'calibration'
    why = `你的信心平均比实际判断质量高 ${diff} 分——需要练「这个判断真的值这么多信心吗」。`
  } else if (diff <= -20) {
    mode = 'judgment'
    why = `你的实际判断质量比信心高 ${-diff} 分——你可能不是不会，而是过度怀疑自己的判断。`
  }

  if (!mode) {
    return {
      type: 'normal',
      label: '按节奏推进',
      emoji: '🧩',
      desc: '当前没有检测到需要优先干预的高频模式，按原有学习路径继续。',
      brief: '',
      why: '最近案例没有突出的单一错误模式，可以继续挑战更难的内容。',
      caseId: null,
      caseTitle: null,
    }
  }

  const cs = pickCase(state, mode)
  return {
    type: mode,
    ...TRAINING_MODES[mode],
    why,
    caseId: cs?.id || null,
    caseTitle: cs?.title || null,
  }
}

export { TRAINING_MODES }
