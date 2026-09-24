// ============================================================
// R3 Phase 3A · DoubtTask Selector（怀疑任务确定性选择器）
//
// 根据真实学习行为（LearningEvidence / ErrorMuseum / MasteryProfile /
// LearningState / Agent reason codes）发现认知漏洞，选择针对性怀疑任务。
//
// 优先级（干预型优先，新用户默认兜底）：
//   REPEATED_ERROR(7) > MASTERY_BOTTLENECK(6) > WEAK_EVIDENCE(5)
//   > NO_COUNTEREXAMPLE(4) > LOW_UNCERTAINTY(3) > TRADITION_GAP(2)
//   > UNDERUSED_CLASSIC(1) > CONTINUITY(0)
//
// 输出：
//   { taskId, reasonCode, reason, targetError, expectedSkill,
//     evidenceIds, priority }
// reason 必须可以直接展示给用户。
//
// deterministic：全部来自真实数据，禁止随机。
// 同类换题：已完成的怀疑任务优先排除；同类型全部完成后轮换次数最少的任务。
// ============================================================

import { getLearningState } from './unifiedLearningState'
import { computeMasteryProfile } from './masteryEngine'
import { getDoubtTask, DOUBT_TASKS } from '../data/doubtTasks'
import { ERROR_TYPES } from './errors'
import { MASTERY_DIMENSIONS } from './masteryEngine'

// ── 优先级常量 ────────────────────────────────────────────────
export const DOUBT_PRIORITY = {
  REPEATED_ERROR: 7,
  MASTERY_BOTTLENECK: 6,
  WEAK_EVIDENCE: 5,
  NO_COUNTEREXAMPLE: 4,
  LOW_UNCERTAINTY: 3,
  TRADITION_GAP: 2,
  UNDERUSED_CLASSIC: 1,
  CONTINUITY: 0,
}

// 能力维度 → 怀疑任务类别（确定性映射；bottleneck 不包含 independence）
const DIM_TO_CATEGORIES = {
  evidence: ['evidence-review', 'self-doubt'],
  counterexample: ['counterexample'],
  uncertainty: ['self-doubt', 'evidence-review'],
  synthesis: ['deconstruct', 'tradition-conflict'],
  structure: ['deconstruct'],
  reasoning: ['flaw', 'deconstruct'],
  observation: ['flaw'],
}

// 优先级 → 候选任务类别
const CODE_TO_CATEGORIES = {
  WEAK_EVIDENCE: ['evidence-review'],
  NO_COUNTEREXAMPLE: ['counterexample'],
  LOW_UNCERTAINTY: ['self-doubt'],
  TRADITION_GAP: ['tradition-conflict'],
  UNDERUSED_CLASSIC: ['deconstruct'],
  CONTINUITY: ['flaw'],
}

const DIM_LABEL = {}
for (const d of MASTERY_DIMENSIONS) DIM_LABEL[d.key] = d.label

// 已完成的怀疑任务 id 集合（用于换题）
function completedTaskIds(state) {
  const runs = (state && state.doubtRuns) || []
  return new Set(runs.map((r) => r && r.taskId).filter(Boolean))
}

// 在候选任务里「换题」：未完成优先，按完成次数最少 → __dseq 升序。
// 保证：同一类型再次推荐时换具体任务，不永远显示同一句推荐。
function pickTask(state, categories) {
  const doneIds = completedTaskIds(state)
  const runs = (state && state.doubtRuns) || []
  const doneCount = {}
  for (const r of runs) {
    if (r && r.taskId) doneCount[r.taskId] = (doneCount[r.taskId] || 0) + 1
  }
  const pool = DOUBT_TASKS.filter((t) => categories.includes(t.category))
  const fresh = pool.filter((t) => !doneIds.has(t.id))
  const source = fresh.length ? fresh : pool // 全完成则轮换
  return source.sort((a, b) => {
    const da = doneCount[a.id] || 0
    const db = doneCount[b.id] || 0
    if (da !== db) return da - db
    return (a.__dseq || 0) - (b.__dseq || 0)
  })[0] || null
}

function errorLabel(code) {
  return ERROR_TYPES[code] ? ERROR_TYPES[code].name : code
}

// 生成可展示的 reason（直接给用户看）
function reasonFor(reasonCode, task, ctx) {
  const title = task ? `「${task.title}」` : '一次怀疑训练'
  switch (reasonCode) {
    case 'REPEATED_ERROR': {
      const code = ctx.targetError
      const count = ctx.errorCount || 0
      return `你最近 ${count} 次行为里反复出现「${errorLabel(code)}」，因此安排一次 ${title}，专门拆掉这个反复出现的坑。`
    }
    case 'MASTERY_BOTTLENECK': {
      const dim = ctx.bottleneckKey
      const value = ctx.bottleneckValue ?? 0
      return `你的能力档案里当前最薄弱的是「${DIM_LABEL[dim] || dim}」（${value}/100），因此安排一次 ${title} 来针对性补这一环。`
    }
    case 'WEAK_EVIDENCE': {
      const n = ctx.constructN ?? 0
      return `你最近 ${n} 次解释都很快形成结论，但没有主动补充依据，因此安排一次 ${title}，逼自己给结论找证据。`
    }
    case 'NO_COUNTEREXAMPLE':
      return `你很少主动寻找反例，判断容易变成单向印证，因此安排一次 ${title}，练习在给结论前先写一条可能推翻它的证据。`
    case 'LOW_UNCERTAINTY':
      return `你的表达里出现了绝对化措辞，却几乎没有记录「不确定之处」，因此安排一次 ${title}，练习判断边界。`
    case 'TRADITION_GAP':
      return `你做了不少结构分析，但还没比较过不同解释传统，因此安排一次 ${title}，比较传统路径而非判定对错。`
    case 'UNDERUSED_CLASSIC':
      return `你分析了很多卦爻，却很少回到原典文本，因此安排一次 ${title}，检验文本证据的边界。`
    case 'CONTINUITY':
      return `这是你第一次进入怀疑室。先从一个最基础的推理漏洞开始：${title}，学会先问「凭什么」。`
    default:
      return `根据你的最近行为，安排一次 ${title}。`
  }
}

function expectedSkillOf(task) {
  if (!task) return null
  if (task.masteryKeys && task.masteryKeys.length) return task.masteryKeys[0]
  return task.category === 'evidence-review' ? 'evidence'
    : task.category === 'counterexample' ? 'counterexample'
      : task.category === 'self-doubt' ? 'uncertainty'
        : task.category === 'tradition-conflict' || task.category === 'deconstruct' ? 'synthesis'
          : 'reasoning'
}

// 能力档案里除 independence 外的最低维度（forceReasonCode 注入时的占位瓶颈）
function fallbackBottleneck(mastery) {
  if (!mastery) return null
  let best = null
  for (const k of Object.keys(DIM_TO_CATEGORIES)) {
    const v = mastery[k] ?? 0
    if (!best || v < best.value) best = { key: k, value: v }
  }
  return best
}

// ── 主入口：selectDoubtTask(state, opts) ─────────────────────
// state: 全局状态（含 evidence / caseAttempts / errorPatterns / doubtRuns / masteryProfile）
// opts:
//   allowContinuity (bool, 默认 true)：CONTINUITY 是否允许（/doubt 页面允许；
//       首页 Agent 推荐时传 false，避免新用户被首页直接塞怀疑任务）
//   forceReasonCode：测试注入，强制按某 reasonCode 选择
export function selectDoubtTask(state, opts = {}) {
  const ls = getLearningState(state, opts)
  const mastery = state.masteryProfile || computeMasteryProfile(state)
  const signals = ls.recommendationSignals || {}

  // 1) REPEATED_ERROR：最近重复出现的错误码（>=2 次）
  const repeated = (ls.errors && ls.errors.repeated && ls.errors.repeated.length)
    ? ls.errors.repeated
    : []
  if (opts.forceReasonCode === 'REPEATED_ERROR' || (!opts.forceReasonCode && repeated.length)) {
    // forceReasonCode 注入时可能没有真实重复错误：用 E01 占位（E01–E10 均有对应任务）
    const err = repeated[0] || { code: 'E01', count: 0 }
    // 优先：errorTypes 精确匹配该错误码且未完成的任务；其次同类别未完成任务；最后轮换。
    const doneIds = completedTaskIds(state)
    const exact = DOUBT_TASKS.filter((t) => (t.errorTypes || []).includes(err.code) && !doneIds.has(t.id))
    let chosen = exact.length ? exact[0] : null
    if (!chosen) {
      const sameType = DOUBT_TASKS.filter((t) => (t.errorTypes || []).includes(err.code))
      const fallback = sameType.length ? sameType : DOUBT_TASKS.filter((t) => t.category === 'flaw')
      chosen = pickTask(state, [...new Set(fallback.map((t) => t.category))])
    }
    const ctx = { targetError: err.code, errorCount: (state.errorPatterns || {})[err.code] || err.count || 0 }
    return {
      taskId: chosen ? chosen.id : null,
      reasonCode: 'REPEATED_ERROR',
      reason: reasonFor('REPEATED_ERROR', chosen, ctx),
      targetError: err.code,
      expectedSkill: expectedSkillOf(chosen),
      evidenceIds: signals.REPEATED_ERROR && signals.REPEATED_ERROR.trace
        ? signals.REPEATED_ERROR.trace.evidenceIds || []
        : [],
      priority: DOUBT_PRIORITY.REPEATED_ERROR,
    }
  }

  // 2) MASTERY_BOTTLENECK：能力档案最低维度（independence 不参与；
  //    仅当该维度「明显薄弱」（<48）时才触发，避免长期霸占推荐）
  if (opts.forceReasonCode === 'MASTERY_BOTTLENECK' || (!opts.forceReasonCode && mastery && mastery.ready && mastery.bottleneck)) {
    // forceReasonCode 注入时可能没有真实瓶颈：用能力档案最低维度占位
    const bk = opts.forceReasonCode === 'MASTERY_BOTTLENECK'
      ? (mastery.bottleneck || fallbackBottleneck(mastery))
      : mastery.bottleneck
    if (bk && bk.key && (opts.forceReasonCode === 'MASTERY_BOTTLENECK' || bk.value < 48) && DIM_TO_CATEGORIES[bk.key] && DIM_TO_CATEGORIES[bk.key].length) {
      const task = pickTask(state, DIM_TO_CATEGORIES[bk.key])
      if (task) {
        return {
          taskId: task.id,
          reasonCode: 'MASTERY_BOTTLENECK',
          reason: reasonFor('MASTERY_BOTTLENECK', task, { bottleneckKey: bk.key, bottleneckValue: bk.value }),
          targetError: null,
          expectedSkill: bk.key,
          evidenceIds: [],
          priority: DOUBT_PRIORITY.MASTERY_BOTTLENECK,
        }
      }
    }
  }

  // 3) WEAK_EVIDENCE
  if (opts.forceReasonCode === 'WEAK_EVIDENCE' || (!opts.forceReasonCode && signals.WEAK_EVIDENCE && signals.WEAK_EVIDENCE.active)) {
    const task = pickTask(state, CODE_TO_CATEGORIES.WEAK_EVIDENCE)
    if (task) {
      return {
        taskId: task.id,
        reasonCode: 'WEAK_EVIDENCE',
        reason: reasonFor('WEAK_EVIDENCE', task, { constructN: signals.WEAK_EVIDENCE?.meta?.constructN ?? 0 }),
        targetError: null,
        expectedSkill: 'evidence',
        evidenceIds: signals.WEAK_EVIDENCE?.trace?.evidenceIds || [],
        priority: DOUBT_PRIORITY.WEAK_EVIDENCE,
      }
    }
  }

  // 4) NO_COUNTEREXAMPLE
  if (opts.forceReasonCode === 'NO_COUNTEREXAMPLE' || (!opts.forceReasonCode && signals.NO_COUNTEREXAMPLE && signals.NO_COUNTEREXAMPLE.active)) {
    const task = pickTask(state, CODE_TO_CATEGORIES.NO_COUNTEREXAMPLE)
    if (task) {
      return {
        taskId: task.id,
        reasonCode: 'NO_COUNTEREXAMPLE',
        reason: reasonFor('NO_COUNTEREXAMPLE', task),
        targetError: null,
        expectedSkill: 'counterexample',
        evidenceIds: signals.NO_COUNTEREXAMPLE?.trace?.evidenceIds || [],
        priority: DOUBT_PRIORITY.NO_COUNTEREXAMPLE,
      }
    }
  }

  // 5) LOW_UNCERTAINTY
  if (opts.forceReasonCode === 'LOW_UNCERTAINTY' || (!opts.forceReasonCode && signals.LOW_UNCERTAINTY && signals.LOW_UNCERTAINTY.active)) {
    const task = pickTask(state, CODE_TO_CATEGORIES.LOW_UNCERTAINTY)
    if (task) {
      return {
        taskId: task.id,
        reasonCode: 'LOW_UNCERTAINTY',
        reason: reasonFor('LOW_UNCERTAINTY', task),
        targetError: null,
        expectedSkill: 'uncertainty',
        evidenceIds: signals.LOW_UNCERTAINTY?.trace?.evidenceIds || [],
        priority: DOUBT_PRIORITY.LOW_UNCERTAINTY,
      }
    }
  }

  // 6) TRADITION_GAP
  if (opts.forceReasonCode === 'TRADITION_GAP' || (!opts.forceReasonCode && signals.TRADITION_GAP && signals.TRADITION_GAP.active)) {
    const task = pickTask(state, CODE_TO_CATEGORIES.TRADITION_GAP)
    if (task) {
      return {
        taskId: task.id,
        reasonCode: 'TRADITION_GAP',
        reason: reasonFor('TRADITION_GAP', task),
        targetError: null,
        expectedSkill: 'synthesis',
        evidenceIds: signals.TRADITION_GAP?.trace?.evidenceIds || [],
        priority: DOUBT_PRIORITY.TRADITION_GAP,
      }
    }
  }

  // 7) UNDERUSED_CLASSIC
  if (opts.forceReasonCode === 'UNDERUSED_CLASSIC' || (!opts.forceReasonCode && signals.UNDERUSED_CLASSIC && signals.UNDERUSED_CLASSIC.active)) {
    const task = pickTask(state, CODE_TO_CATEGORIES.UNDERUSED_CLASSIC)
    if (task) {
      return {
        taskId: task.id,
        reasonCode: 'UNDERUSED_CLASSIC',
        reason: reasonFor('UNDERUSED_CLASSIC', task),
        targetError: null,
        expectedSkill: 'synthesis',
        evidenceIds: signals.UNDERUSED_CLASSIC?.trace?.evidenceIds || [],
        priority: DOUBT_PRIORITY.UNDERUSED_CLASSIC,
      }
    }
  }

  // 8) CONTINUITY：新用户默认路径（/doubt 页面兜底）
  const allowContinuity = opts.allowContinuity !== false
  if (opts.forceReasonCode === 'CONTINUITY' || (!opts.forceReasonCode && allowContinuity)) {
    const task = pickTask(state, CODE_TO_CATEGORIES.CONTINUITY)
    if (task) {
      return {
        taskId: task.id,
        reasonCode: 'CONTINUITY',
        reason: reasonFor('CONTINUITY', task),
        targetError: null,
        expectedSkill: expectedSkillOf(task),
        evidenceIds: [],
        priority: DOUBT_PRIORITY.CONTINUITY,
      }
    }
  }

  return null
}

// 便捷：直接按任务 id 取任务（供 UI）
export { getDoubtTask }
