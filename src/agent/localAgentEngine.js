// ============================================================
// 本地 Agent 引擎（无 LLM）：
//   用户行为 → 状态 → 掌握度/错误识别 → 推荐 → 反馈 → 下一任务
// 输入 state，输出可解释的「下一步 + 为什么」。
// ============================================================

import { levelForXp } from '../game/levels'
import { topErrors } from './errors'
import { recommend } from './recommendation'
import { composeAgentFeedback } from './feedback'
import { getNode } from '../data/knowledge'
import { learningState } from './learningState'
import { thinkingProfile, profileHighlights, profileNextStep } from './thinkingProfile'
import { composingTeacherMemory } from './teacherMemory'
import { getPersona } from './teacherPersona'
import { calibrationSummary } from './confidence'
import { reasoningFingerprint } from './reasoningFingerprint'
import { adaptiveTraining } from './adaptiveTraining'
import { agentInsight } from './agentInsight'
import { computeMasteryProfile, nextLevelGap, MASTERY_DIMENSIONS, agentJudgment } from './masteryEngine'
import { computeKnowledgeMastery, reviewQueue, knowledgeSummary } from './knowledgeMastery'
import { getLearningState } from './unifiedLearningState'
import { recommendByEvidence } from './evidenceRecommendation'
import { selectDoubtTask, getDoubtTask } from './doubtSelector'
import { getLesson } from '../data/lessons'
import { getNextLessonNode } from '../lib/lessonProgress'
import { nextCoreNode } from './pathEngine'

export function runAgent(state) {
  const lvl = levelForXp(state.xp)
  const reco = recommend(state)
  const errors = topErrors(state.errorPatterns, 3)
  const feedback = composeAgentFeedback(state)

  const { lesson, case: cs, experiment: exp, weakest } = reco

  // V1.6：推理指纹 → 自适应训练 → 洞察（全部 deterministic）
  const fingerprint = reasoningFingerprint(state)
  // V2：学徒能力档案 → 瓶颈驱动训练 → 升级差距说明
  const mastery = computeMasteryProfile(state)
  const training = adaptiveTraining(state, fingerprint, mastery)
  const insight = agentInsight(state, fingerprint)
  const gap = nextLevelGap(mastery)

  // R3 Phase 2：Evidence-first —— Agent 只读统一学习状态 + 证据推荐。
  // 旧 fingerprint 仍保留兼容输出，但推荐主事实源已切换到 getLearningState()。
  const unified = getLearningState(state)
  const evidenceReco = recommendByEvidence(state)

  // R3 Phase 2.5：Evidence-first 唯一主要推荐。
  // 有证据推荐时以证据为准（内部已按「明确风险/重复错误 → 行为缺口 → 正面确认」排序），
  // 无证据时回退旧推荐路径（fingerprint / mastery / 新用户默认），只输出一个主要 next action。
  // R3 Phase 3：怀疑任务进入唯一推荐入口——证据推荐缺失且旧路径只是「通用推荐」时，
  // 若存在需纠偏的认知漏洞，优先安排怀疑任务（比旧路径更对症）；旧路径已是定向干预
  // （针对性案例/复习）或存在证据推荐时，仍保持 Phase 2.5 行为（不重构既有架构）。
  const doubtReco = selectDoubtTask(state, { allowContinuity: false })
  const resolved = resolveNextAction(evidenceReco, { lesson, cs, exp, weakest, state, training, insight, doubtReco })
  const nextAction = resolved.nextAction
  const nextActionSource = resolved.source
  const evidenceWhy = resolved.evidenceWhy

  const masteryList = Object.entries(state.mastery || {})
    .map(([id, v]) => ({ node: getNode(id), level: v }))
    .filter((x) => x.node)
    .sort((a, b) => b.level - a.level)

  const profile = thinkingProfile(state)

  return {
    level: lvl,
    topErrors: errors,
    feedback,
    detectedMistakes: errors.map((e) => e.code),
    recommendations: { lesson, case: cs, experiment: exp, weakest },
    masteryList,
    nextAction,
    nextActionSource,
    evidenceWhy,
    // V1.5 新增：学习状态 / 思维画像 / 老师记忆 / 教学人格 / 信心校准
    learningState: learningState(state),
    profile,
    profileHighlights: profileHighlights(profile),
    profileNextStep: profileNextStep(profile),
    teacherMemory: composingTeacherMemory(state),
    persona: getPersona(state),
    calibration: calibrationSummary(state.confidenceHistory),
    // V1.6 新增：推理指纹 / 自适应训练 / 你可能没发现 / 为什么推荐
    fingerprint,
    training,
    insight,
    whyThisCase: explainRecommendation(state, nextAction, fingerprint, training),
    // V2 新增：学徒能力档案 / 升级差距 / 为什么还不能升级 / Agent 对你的判断
    masteryProfile: mastery,
    masteryGap: gap,
    whyNotPromote: buildWhyNotPromote(mastery, gap, training),
    judgment: agentJudgment(state.caseAttempts),
    // V3 新增：知识画像 / 复习队列 / 知识统计
    knowledge: computeKnowledgeMastery(state),
    reviewQueue: reviewQueue(state),
    knowledgeSummary: knowledgeSummary(state),
    // R3 Phase 2 新增：统一只读学习状态 + Evidence-first 推荐
    unifiedState: unified,
    evidenceRecommendation: evidenceReco,
    // R3 Phase 3 新增：怀疑室推荐（认知漏洞 → 针对性怀疑任务，reason 可直接展示）
    doubtRecommendation: doubtReco,
  }
}

// V2：「你还不能进入 LX」的原因解释（真实能力差距，不是 XP 不够）
function buildWhyNotPromote(profile, gap, training) {
  if (!profile || profile.sampleCount === 0 || !gap || !gap.next) return null
  if (gap.gaps.length === 0 && !gap.sampleShort) return null

  const name = (k) => MASTERY_DIMENSIONS.find((d) => d.key === k)?.label || k
  const parts = []
  if (gap.sampleShort) parts.push(gap.sampleNote)
  if (gap.gaps.length) {
    const dims = gap.gaps.map((g) => `${name(g.key)} ${g.value}/${g.need}`).join('、')
    parts.push(`当前短板是：${dims}。不是因为做题数量不够，而是这些能力还没到门槛。`)
  }
  const suggest = training && training.type !== 'normal'
    ? `建议下一步：先做「${training.label}」，而不是继续学新知识。`
    : '建议下一步：按当前推荐完成针对性训练，再回来挑战升级。'
  return {
    next: gap.next,
    nextName: gap.nextName,
    reason: parts.join(' '),
    suggest,
  }
}

function resolveNextAction(evidenceReco, ctx) {
  const primary = evidenceReco && evidenceReco.primary
  if (primary) {
    return {
      nextAction: evidenceNextAction(primary),
      source: 'evidence',
      evidenceWhy: evidenceWhyOf(primary),
    }
  }
  const { lesson, cs, exp, weakest, state, training, insight } = ctx
  const legacyAction = upgradeCompletedLesson(pickNextAction(lesson, cs, exp, weakest, state, training, insight), state)
  // R3 Phase 3：证据推荐缺失时——旧路径若是「定向干预」（带 training 标签的
  // 针对性案例/复习/补框架），保持 Phase 2.5 稳定行为，不重复安排怀疑任务；
  // 只有旧路径是「通用推荐」时，若存在需纠偏的认知漏洞（selectDoubtTask 命中，
  // 非 CONTINUITY 默认路径），优先安排怀疑任务作为唯一下一步。
  const doubtSel = ctx.doubtReco
  if (doubtSel && doubtSel.taskId && !legacyAction.training) {
    return {
      nextAction: doubtNextAction(doubtSel),
      source: 'doubt',
      evidenceWhy: doubtWhyOf(doubtSel),
    }
  }
  // R7：求学之路优先——legacy 路径的「通用课程推荐」若无定向训练理由，
  // 且当前段存在未完成的核心必修节点，则优先指向该节点（软引导，不强制）。
  if (legacyAction && legacyAction.type === 'lesson' && !legacyAction.training) {
    const core = nextCoreNode(state)
    if (core && core.nodeId !== legacyAction.nodeId) {
      const l = getLesson(`v3-${core.nodeId}`)
      if (l) {
        return {
          nextAction: {
            type: 'lesson',
            id: l.id,
            nodeId: core.nodeId,
            title: `求学之路 · 第 ${core.stage.order} 段：${core.title}`,
            why: `当前求学之路第 ${core.stage.order} 段「${core.stage.name}」的核心必修节点，先完成它再深入。`,
            pathPriority: true,
          },
          source: 'legacy',
          evidenceWhy: null,
        }
      }
    }
  }
  return {
    nextAction: legacyAction,
    source: 'legacy',
    evidenceWhy: null,
  }
}

// Agent 推荐必须理解完成状态：
//   - 推荐的基础课程已完成，且没有复习/补框架等训练理由 → 升级为地图上的下一未完成关
//   - 存在训练理由（review / knowledge / 明确能力缺口）→ 保持推荐（完成 ≠ 永远不再推荐，
//     若能力仍不足则推荐更高阶/不同变体，由既有 training 机制负责）
export function upgradeCompletedLesson(action, state) {
  if (!action || action.type !== 'lesson') return action
  let nodeId = null
  if (action.nodeId) nodeId = action.nodeId
  else if (action.id) {
    const l = getLesson(action.id)
    nodeId = l ? l.nodeId : null
  }
  if (!nodeId) return action
  const p = (state.lessonProgress || {})[nodeId]
  if (!p || p.status !== 'completed') return action
  // 定向训练（复习/补框架/证据触发）→ 保持，不强行换关
  if (action.training) return action
  // 已完成基础任务且无新理由 → 推进到地图下一未完成节点
  const next = getNextLessonNode(state, nodeId)
  if (next && next.node && next.unlocked && next.lessonId) {
    return {
      type: 'lesson',
      id: next.lessonId,
      nodeId: next.node.id,
      title: `下一关：${next.node.emoji} ${next.node.title}`,
      why: `你已完成基础训练「${p.lessonId || ''}」，能力仍在积累，继续推进下一关。`,
      completedUpgraded: true,
    }
  }
  return action
}

// 怀疑任务推荐 → 统一 nextAction（type='doubt'，指向怀疑室具体任务）
function doubtNextAction(sel) {
  const task = getDoubtTask(sel.taskId)
  return {
    type: 'doubt',
    id: sel.taskId,
    title: task ? `${task.emoji || '🪞'} ${task.title}` : '怀疑训练',
    why: sel.reason,
    reasonCode: sel.reasonCode,
    targetError: sel.targetError,
    expectedSkill: sel.expectedSkill,
    evidenceIds: sel.evidenceIds || [],
    priority: sel.priority,
  }
}

// 怀疑推荐的可解释依据（理由 + 触发 Evidence + 要纠正的行为）
function doubtWhyOf(sel) {
  const points = [sel.reason]
  if (sel.targetError) {
    points.push(`要纠正的行为：${ERROR_TYPES[sel.targetError]?.name || sel.targetError}`)
  }
  if (sel.expectedSkill) points.push(`训练能力：${sel.expectedSkill}`)
  if (sel.evidenceIds && sel.evidenceIds.length) points.push(`依据（学习记录）：${sel.evidenceIds.join('、')}`)
  return {
    title: '为什么安排这次怀疑？',
    points,
    evidenceIds: sel.evidenceIds || [],
    errorCodes: sel.targetError ? [sel.targetError] : [],
  }
}

// 证据推荐 → 统一 nextAction（唯一主要推荐）。
// 用独立 type 'exp' 指向推理实验 (/exp/:id)，避免与旧 /lab 实验混淆。
function evidenceNextAction(primary) {
  const exp = primary.experiment
  return {
    type: 'exp',
    id: exp?.id ?? null,
    title: exp?.title || primary.headline,
    why: primary.body,
    headline: primary.headline,
    reasonCode: primary.reasonCode,
    positive: !!primary.positive,
    trace: primary.trace || {},
    meta: primary.meta || {},
  }
}

// 可解释依据：为什么推荐这件事？（理由 + 可追溯的 Evidence ID / 错误 / 能力维度）
function evidenceWhyOf(primary) {
  const trace = primary.trace || {}
  const points = []
  if (primary.headline) points.push(primary.headline)
  if (primary.body) points.push(primary.body)
  const evidenceIds = trace.evidenceIds || []
  const errorCodes = trace.errorCodes || []
  const masteryKeys = trace.masteryKeys || []
  const revisions = Array.isArray(trace.revisions) ? trace.revisions : []
  if (evidenceIds.length) points.push(`依据（学习记录）：${evidenceIds.join('、')}`)
  if (errorCodes.length) points.push(`依据（错误类型）：${errorCodes.join('、')}`)
  if (masteryKeys.length) points.push(`依据（能力维度）：${masteryKeys.join('、')}`)
  if (revisions.length) points.push(`依据（观点修正）：共 ${revisions.length} 次修正`)
  return {
    title: '为什么推荐这件事？',
    points,
    evidenceIds,
    errorCodes,
  }
}

function pickNextAction(lesson, cs, exp, weakest, state, training, insight) {
  // V3：遗忘复习优先——一个高价值复习案例 > 回到课程
  if (training?.type === 'review') {
    if (training.caseId) {
      return {
        type: 'case',
        id: training.caseId,
        title: training.caseTitle,
        why: training.why,
        training: 'review',
        trainingLabel: training.label,
        trainingBrief: training.brief,
        reviewNode: training.nodeId,
        reviewNodeTitle: training.nodeTitle,
      }
    }
    if (training.lessonId) {
      return {
        type: 'lesson',
        id: training.lessonId,
        title: training.lessonTitle,
        why: training.why,
        training: 'review',
        trainingLabel: training.label,
        trainingBrief: training.brief,
        reviewNode: training.nodeId,
        reviewNodeTitle: training.nodeTitle,
      }
    }
  }
  // V3：知识瓶颈 → 回到课堂补框架
  if (training?.type === 'knowledge' && training.lessonId) {
    return {
      type: 'lesson',
      id: training.lessonId,
      title: training.lessonTitle,
      why: training.why,
      training: 'knowledge',
      trainingLabel: training.label,
      trainingBrief: training.brief,
      knowledgeNode: training.nodeId,
      knowledgeNodeTitle: training.nodeTitle,
    }
  }
  // V2：知识瓶颈（旧路径兼容）→ 回到课堂补框架
  if (training?.type === 'knowledge') {
    return {
      type: 'lesson',
      id: lesson?.item?.id,
      title: lesson?.item?.title || '补强概念框架',
      why: training.why,
      training: 'knowledge',
      trainingLabel: training.label,
      trainingBrief: training.brief,
    }
  }
  // 定向训练优先：当指纹识别出需要干预的模式，且存在匹配案例
  if (training?.type !== 'normal' && training.caseId) {
    return {
      type: 'case',
      id: training.caseId,
      title: training.caseTitle,
      why: training.why,
      training: training.type,
      trainingLabel: training.label,
      trainingBrief: training.brief,
    }
  }
  // 洞察优先：洞察给出的「接受挑战」案例
  if (insight?.caseId && insight.key) {
    return {
      type: 'case',
      id: insight.caseId,
      title: insight.caseTitle,
      why: insight.body,
      insight: insight.key,
      insightHeadline: insight.headline,
    }
  }
  const masteredCount = Object.values(state.mastery || {}).filter((v) => v >= 4).length
  const totalMastery = Object.keys(state.mastery || {}).length

  // 完全新手 → 先上课
  if (totalMastery === 0) {
    return { type: 'lesson', id: lesson?.item?.id, title: lesson?.item?.title, why: '先上第一课，建立基线。' }
  }
  // 存在薄弱点（已接触但未掌握）→ 先补
  if (weakest.node && masteredCount < 5) {
    return { type: 'lesson', nodeId: weakest.node.id, title: `补强「${weakest.node.title}」`, why: `你已接触但只达到 ${weakest.level} 级，离「能应用」还有距离。` }
  }
  // 课堂推进
  if (lesson?.item) {
    return { type: 'lesson', id: lesson.item.id, title: lesson.item.title, why: lesson.why }
  }
  // 案例
  if (cs?.item) {
    return { type: 'case', id: cs.item.id, title: cs.item.title, why: cs.why }
  }
  // 实验
  if (exp?.item) {
    return { type: 'experiment', id: exp.item.id, title: exp.item.title, why: exp.why }
  }
  return { type: 'review', title: '回顾所学', why: '内容都完成了，回顾复盘，巩固能力。' }
}

// 「为什么推荐这道题？」：可解释的推荐依据（普通用户能看懂）
// V1.6.1：推荐 = 推荐内容 + 推荐原因 + 对应问题 + 训练目标 + 为什么不是另一道题
function explainRecommendation(state, nextAction, fingerprint, training) {
  const err = state.errorPatterns || {}
  const attempts = (state.caseAttempts || []).slice(-7)
  const ev = fingerprint?.evidence
  const mastered = Object.values(state.mastery || {}).filter((v) => v >= 4).length

  const whyNotLesson =
    nextAction?.type === 'case'
      ? `你已经掌握 ${mastered} 个基础知识点。当前主要问题出现在「应用判断」，所以今天优先进入案件，而不是继续学习新知识。`
      : null

  if (nextAction?.training && training) {
    const isReview = training.type === 'review'
    const isKnowledge = training.type === 'knowledge'
    return {
      title: isReview ? '为什么先复习？' : isKnowledge ? '为什么先回课堂？' : '为什么是这道题？',
      points: [
        `推荐：${training.label}`,
        `原因：${training.why}`,
        isReview
          ? `对应问题：知识会遗忘。掌握过的节点长期不用会衰减，复习一个高价值案例比重新刷十道题更有效。`
          : isKnowledge
            ? `对应问题：概念结构是后续分析的底座，先补框架再回案例。`
            : `对应问题：证据不足时过早形成判断`,
        `训练目标：${training.brief}`,
      ],
      whyNotLesson,
    }
  }
  if (nextAction?.insight && insightPoints(nextAction, attempts, err)) {
    return {
      title: '为什么是这道题？',
      points: insightPoints(nextAction, attempts, err),
      whyNotLesson,
    }
  }
  return null
}

function insightPoints(nextAction, attempts, err) {
  const key = nextAction.insight
  if (key === 'overconfidence' || key === 'evidence-before-conclusion') {
    return ['你的判断质量与信心之间有明显落差。', '这道案例专门训练「证据是否足够支持结论」。']
  }
  if (key === 'underconfidence') {
    return ['你的实际判断质量高于信心。', '这道案例训练「在证据充分时果断下结论」。']
  }
  if (key === 'confirmation-bias') {
    return [`你最近出现 ${err.E07 || 0} 次「只找支持自己的证据」。`, '这道案例要求你主动找反例。']
  }
  return null
}