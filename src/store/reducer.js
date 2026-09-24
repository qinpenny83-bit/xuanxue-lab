// ============================================================
// 全局状态 reducer（纯函数，可测试）。
// 所有学习事件经此流转：XP / 等级 / 掌握度 / 错误 / 成就 / 连续学习。
// ============================================================

import { XP, levelForXp } from '../game/levels'
import { checkAchievements } from '../game/achievements'
import { recordError } from '../agent/errors'
import { bumpMastery } from '../agent/mastery'
import { todayString, initialState } from '../lib/storage'
import { computeMasteryProfile } from '../agent/masteryEngine'
import { recordEvidence } from '../agent/learningEvidence'
import { makeAttemptId } from '../lib/attemptId'

function now() {
  return new Date().toISOString()
}

function yesterdayString() {
  return todayString(new Date(Date.now() - 86400000))
}

// 任何学习动作都触碰「连续学习」
function touchStreak(state) {
  const today = todayString()
  if (state.lastStudyDate === today) return state
  const streak = state.lastStudyDate === yesterdayString() ? state.streak + 1 : 1
  return { ...state, lastStudyDate: today, streak }
}

function addXp(state, amount) {
  const xp = state.xp + amount
  return { ...state, xp, level: levelForXp(xp).level }
}

function finalize(state) {
  const unlocked = checkAchievements(state)
  if (Object.keys(unlocked).length) {
    state = { ...state, achievements: { ...state.achievements, ...unlocked } }
  }
  return state
}

export function reducer(state, action) {
  let s = state
  switch (action.type) {
    case 'ONBOARD': {
      s = touchStreak({ ...state, onboarded: true, entryReason: action.entryReason })
      break
    }

    case 'RECORD_QUIZ': {
      const it = action.item
      s = { ...state, quizHistory: [...state.quizHistory, { ...it, at: now() }] }
      if (it.errorType) {
        s.errorPatterns = recordError(s.errorPatterns, it.errorType)
        s.errorEvents = [...state.errorEvents, { code: it.errorType, at: now(), context: it.storeContext || (it.lessonId ? `课堂 ${it.lessonId}` : '练习') }]
      }
      s.consecutiveCorrect = it.correct ? (state.consecutiveCorrect || 0) + 1 : 0
      let target = 1
      if (it.correct && (it.stepType === 'why' || it.stepType === 'mastery')) {
        target = it.stepType === 'mastery' ? 4 : 3
      }
      s.mastery = bumpMastery(s.mastery, it.nodeId, target)
      if (it.correct) s = addXp(s, it.stepType === 'why' ? XP.whyCorrect : XP.stepCorrect)
      s = touchStreak(s)
      break
    }

    case 'COMPLETE_LESSON': {
      // nodeId 由调用方随载荷传入（页面已持有课程数据，reducer 不再查库，避免首包带 curriculum）
      const perfect = !!action.result?.masteryCorrect
      const score = Math.round(((action.result?.correct || 0) / Math.max(action.result?.total || 1, 1)) * 100)
      s = addXp(state, perfect ? XP.lessonPerfect : XP.lessonComplete)
      s = touchStreak(s)
      if (action.nodeId) s.mastery = bumpMastery(s.mastery, action.nodeId, perfect ? 4 : 2)
      const prev = state.completedLessons[action.lessonId] || {}
      s.completedLessons = {
        ...state.completedLessons,
        [action.lessonId]: {
          bestScore: Math.max(prev.bestScore || 0, score),
          count: (prev.count || 0) + 1,
          perfect: prev.perfect || perfect,
          lastAt: now(),
        },
      }
      break
    }

    // ── LessonProgress 关卡进度定位层（不是第二套 Mastery）──
    // 职责：记录「我做到哪里」；能力仍由 masteryEngine/computeMasteryProfile 唯一计算。
    case 'START_LESSON_ATTEMPT': {
      const nodeId = action.nodeId
      const prev = (state.lessonProgress || {})[nodeId] || null
      // 已有进行中 attempt 且非强制新开 → 复用（刷新/重进不重复计数）
      if (!action.forceNew && prev && prev.status === 'in_progress' && prev.currentAttemptId) {
        s = state
        break
      }
      const attemptId = action.attemptId || makeAttemptId(Date.now(), (prev?.attemptCount || 0) + 1)
      const attempt = {
        attemptId,
        startedAt: now(),
        completedAt: null,
        correct: 0,
        total: 0,
        score: null,
        startProfile: state.masteryProfile || null,
        endProfile: null,
      }
      s = {
        ...state,
        lessonProgress: {
          ...(state.lessonProgress || {}),
          [nodeId]: {
            nodeId,
            lessonId: action.lessonId || prev?.lessonId || null,
            chapterId: action.chapterId ?? prev?.chapterId ?? null,
            collegeId: action.collegeId ?? prev?.collegeId ?? null,
            status: 'in_progress',
            startedAt: now(),
            completedAt: null,
            attemptCount: (prev?.attemptCount || 0) + 1,
            currentAttemptId: attemptId,
            currentQuestionIndex: 0,
            completedQuestionIds: [],
            questionLog: [],
            lastQuestionId: null,
            attempts: [...(prev?.attempts || []), attempt],
            result: prev?.result || null,
            nextNodeId: action.nextNodeId ?? prev?.nextNodeId ?? null,
          },
        },
      }
      s = touchStreak(s)
      break
    }

    case 'RECORD_QUESTION_PROGRESS': {
      const nodeId = action.nodeId
      const p = (state.lessonProgress || {})[nodeId] || null
      // 旧 attempt 的迟到事件忽略（防止旧 attempt 覆盖新 attempt）
      if (!p || p.currentAttemptId !== action.attemptId) {
        s = state
        break
      }
      // 同 attempt 同题幂等：刷新/重放不得重复计分、不得重复写进度
      if (p.completedQuestionIds.includes(action.questionId)) {
        s = state
        break
      }
      const entry = {
        questionId: action.questionId,
        questionIndex: action.questionIndex,
        correct: !!action.correct,
        stepType: action.stepType || null,
        errorType: action.errorType || null,
        at: now(),
      }
      s = {
        ...state,
        lessonProgress: {
          ...(state.lessonProgress || {}),
          [nodeId]: {
            ...p,
            completedQuestionIds: [...p.completedQuestionIds, action.questionId],
            questionLog: [...p.questionLog, entry],
            lastQuestionId: action.questionId,
          },
        },
      }
      s = touchStreak(s)
      break
    }

    // 推进到下一题（用户点「继续 →」）；断点恢复时组件会跳过已完成题
    case 'ADVANCE_LESSON_QUESTION': {
      const nodeId = action.nodeId
      const p = (state.lessonProgress || {})[nodeId] || null
      if (!p || p.currentAttemptId !== action.attemptId) {
        s = state
        break
      }
      const next = typeof action.nextIndex === 'number' ? action.nextIndex : p.currentQuestionIndex + 1
      if (next <= p.currentQuestionIndex) {
        s = state
        break
      }
      s = {
        ...state,
        lessonProgress: {
          ...(state.lessonProgress || {}),
          [nodeId]: { ...p, currentQuestionIndex: next },
        },
      }
      s = touchStreak(s)
      break
    }

    case 'COMPLETE_LESSON_ATTEMPT': {
      const nodeId = action.nodeId
      const p = (state.lessonProgress || {})[nodeId] || null
      if (!p || p.currentAttemptId !== action.attemptId) {
        s = state
        break
      }
      const total = action.result?.total ?? p.questionLog.length ?? 0
      const correct = action.result?.correct ?? p.questionLog.filter((q) => q.correct).length ?? 0
      const score = total ? Math.round((correct / total) * 100) : 0
      const profile = state.masteryProfile || null
      const attempts = p.attempts.map((a) =>
        a.attemptId === action.attemptId
          ? { ...a, completedAt: now(), correct, total, score, endProfile: profile }
          : a
      )
      s = {
        ...state,
        lessonProgress: {
          ...(state.lessonProgress || {}),
          [nodeId]: {
            ...p,
            status: 'completed',
            completedAt: now(),
            attempts,
            result: { correct, total, score },
            nextNodeId: action.nextNodeId ?? p.nextNodeId ?? null,
          },
        },
      }
      s = touchStreak(s)
      break
    }

    case 'RECORD_ERROR': {
      s = { ...state, errorPatterns: recordError(state.errorPatterns, action.errorType) }
      if (action.errorType) {
        s.errorEvents = [...state.errorEvents, { code: action.errorType, at: now(), context: action.context || '案例' }]
      }
      break
    }

    case 'RECORD_EVIDENCE': {
      // R3 Phase 0：统一学习证据层打点。
      // 只做「事实记录」，不直接改写 mastery（能力仍由 masteryEngine 计算）。
      // 若调用方未给 beforeMastery，则从当前能力档案快照补一帧（便于证据↔能力对照）。
      const partial = action.evidence || {}
      const profile = state.masteryProfile
      const key = partial.masteryKey || partial.skill
      const beforeMap = profile
        ? (key && profile[key] != null ? profile[key] : (profile.overall ?? null))
        : null
      s = {
        ...state,
        evidence: recordEvidence(state.evidence || [], {
          ...partial,
          beforeMastery: partial.beforeMastery ?? beforeMap,
        }),
      }
      // Doubt / Experiment 答错时：errorTypes 同步进错误博物馆（errorPatterns + errorEvents）。
      if (Array.isArray(partial.errorTypes) && partial.errorTypes.length) {
        const events = [...(s.errorEvents || [])]
        let patterns = s.errorPatterns || {}
        for (const code of partial.errorTypes) {
          patterns = recordError(patterns, code)
          events.push({ code, at: now(), context: partial.context || `来源：${partial.source || 'evidence'}` })
        }
        s = { ...s, errorPatterns: patterns, errorEvents: events }
      }
      // R3 Phase 2.5：闭环 —— 新证据写入后立即重算统一能力档案，
      // 让 Evidence → Mastery → masteryProfile 真正联动（contribution 进入唯一档案，
      // 不再只是「记了一笔贡献」而能力等级纹丝不动）。
      s.masteryProfile = computeMasteryProfile(s)
      s = touchStreak(s)
      break
    }

    case 'RECORD_EXPERIMENT_RUN': {
      // R3 Phase 2：实验完成，归档 ExperimentResult + BeliefRevision。
      // Evidence 已在实验每一步经 RECORD_EVIDENCE 写入；这里只保存结构化结果。
      const run = action.run || {}
      s = { ...state, experimentRuns: [...(state.experimentRuns || []), run] }
      if (run.beliefRevision) {
        s.beliefRevisions = [...(state.beliefRevisions || []), run.beliefRevision]
      }
      s = touchStreak(s)
      break
    }

    case 'RECORD_DOUBT_RUN': {
      // R3 Phase 3：怀疑任务完成，归档 DoubtResult + BeliefRevision。
      // 每步 Evidence 已由 RECORD_EVIDENCE 写入；这里只保存结构化结果，
      // 并立即重算统一能力档案（怀疑行为的贡献真实进入 masteryProfile）。
      const run = action.run || {}
      s = { ...state, doubtRuns: [...(state.doubtRuns || []), run] }
      if (run.beliefRevision) {
        s.beliefRevisions = [...(state.beliefRevisions || []), run.beliefRevision]
      }
      // R3 Phase 3：怀疑室闭环 —— 完成怀疑任务后重新计算能力档案与 LearningState，
      // 让 Agent 能在「问题改善 / 仍然存在」之间做出新的判断。
      s.masteryProfile = computeMasteryProfile(s)
      s = touchStreak(s)
      break
    }

    case 'COMPLETE_CASE': {
      // 相关节点/等级/模式由调用方随载荷传入（页面已持有案例数据，reducer 不再查库，避免首包带 cases.js）
      const total = action.result?.total || 0
      s = addXp(state, total >= 80 ? XP.caseExcellent : XP.caseComplete)
      s = touchStreak(s)
      if (Array.isArray(action.relatedNodes) && action.relatedNodes.length) {
        const lvl = total >= 80 ? 4 : 3
        action.relatedNodes.forEach((n) => (s.mastery = bumpMastery(s.mastery, n, lvl)))
      }
      s.completedCases = {
        ...state.completedCases,
        [action.caseId]: { score: total, dimensions: action.result?.dimensions, lastAt: now() },
      }
      s.caseHistory = [...state.caseHistory, { caseId: action.caseId, score: total, at: now() }]
      if (action.result?.consideredCounter) s.counterAwards = (state.counterAwards || 0) + 1
      // V1.6：写入完整推理历史（供指纹 / 轨迹 / 时间线 / 重做比较）
      s.caseAttempts = [
        ...state.caseAttempts,
        {
          caseId: action.caseId,
          at: now(),
          attempt: action.result?.attempt ?? 1,
          redo: !!action.result?.redo,
          score: total,
          confidence: action.result?.confidence ?? null,
          actualQuality: action.result?.actualQuality ?? total,
          errorTypes: action.result?.errorTypes || [],
          dimensions: action.result?.dimensions,
          level: action.level ?? null,
          usedUnknown: !!action.result?.usedUnknown,
          unknownReason: action.result?.unknownReason || null, // V1.6.1：「目前无法判断」的理由
          // V2：行为元数据（提示依赖 / 知识查阅 / 信念修正 / 双解释 / 模式）
          hintDependency: action.result?.hintDependency ?? 0,
          consultedKnowledge: !!action.result?.consultedKnowledge,
          beliefRevision: action.result?.beliefRevision || null,
          dualQuality: action.result?.dualQuality || null,
          mode: action.result?.mode || action.mode || null,
        },
      ]
      if (action.result?.usedUnknown) s.judgmentUnknownUsed = (state.judgmentUnknownUsed || 0) + 1
      // V2：重算学徒能力档案（deterministic，从真实行为推导）
      s.masteryProfile = computeMasteryProfile(s)
      break
    }

    case 'ACCEPT_INSIGHT': {
      s = {
        ...state,
        insightState: {
          date: todayString(),
          key: action.key,
          caseId: action.caseId || null,
          acceptedAt: now(),
          done: !!action.done,
          snapshot: action.snapshot || state.insightState?.snapshot || null, // V1.6.1：画像快照
          content: action.content || state.insightState?.content || null, // V1.6.1：洞察内容（供「行为无变化时保留展示」）
        },
      }
      break
    }

    case 'SYNC_INSIGHT': {
      // V1.6.1：行为变化驱动洞察刷新——同步当前洞察与其画像快照（不重置已完成状态）
      const prev = state.insightState
      if (prev && prev.key === action.key && prev.done) {
        // 同一洞察且已完成：不打扰
        s = state
        break
      }
      s = {
        ...state,
        insightState: {
          date: todayString(),
          key: action.key,
          caseId: action.caseId || null,
          acceptedAt: prev?.acceptedAt || null,
          done: false,
          snapshot: action.snapshot || prev?.snapshot || null,
          content: action.content || prev?.content || null, // V1.6.1
        },
      }
      break
    }

    case 'RECORD_MASTER_CHALLENGE': {
      // V2：出师挑战结果入档
      s = {
        ...state,
        masterChallenge: {
          attempts: [...(state.masterChallenge?.attempts || []), action.attempt],
          reports: [...(state.masterChallenge?.reports || []), action.report],
        },
      }
      if (action.report?.passed) {
        // 出师成功：这是「独立完成陌生复杂案例」的真实行为证据，
        // 把独立分析与综合分析维度锚定到本次真实表现（取高值，不伪造）
        const p = computeMasteryProfile(s)
        const cur = s.masteryProfile || p
        s.masteryProfile = {
          ...cur,
          independence: Math.max(cur.independence ?? 0, action.report.independence ?? 0),
          synthesis: Math.max(cur.synthesis ?? 0, action.report.overall ?? 0),
          lastUpdated: now(),
        }
      }
      s = touchStreak(s)
      break
    }

    case 'RECORD_CONFIDENCE': {
      s = {
        ...state,
        confidenceHistory: [
          ...state.confidenceHistory,
          { caseId: action.caseId, confidence: action.confidence, actual: action.actual, at: now() },
        ],
      }
      break
    }

    case 'RECORD_PATH_QUIZ': {
      // R7：求学之路段位结业记录。只记录事实结果，不直接改写掌握度；
      // 通过时写一条 Evidence（source=path），进入统一能力闭环。
      const key = action.stageKey
      const prev = (state.pathQuizzes || {})[key] || null
      const next = {
        passed: !!action.passed,
        score: action.score,
        best: Math.max(prev?.best || 0, action.score || 0),
        at: now(),
      }
      s = { ...state, pathQuizzes: { ...(state.pathQuizzes || {}), [key]: next } }
      if (action.passed) {
        s = {
          ...s,
          evidence: recordEvidence(s.evidence || [], {
            source: 'path',
            action: 'pass',
            targetType: 'stage',
            targetId: key,
            context: `求学之路 · ${action.stageName || key} 结业`,
            result: { score: action.score },
            masteryKey: 'synthesis',
            errorTypes: [],
          }),
        }
      }
      s = touchStreak(s)
      break
    }

    case 'RECORD_CHAPTER_QUIZ': {
      // R9：章节闯关记录。只记录事实结果，不直接改写掌握度；
      // 通过时写一条 Evidence（source=challenge），进入统一能力闭环。
      const key = action.chapterId
      const prev = (state.chapterQuizzes || {})[key] || null
      const next = {
        passed: !!action.passed,
        score: action.score,
        best: Math.max(prev?.best || 0, action.score || 0),
        at: now(),
      }
      s = { ...state, chapterQuizzes: { ...(state.chapterQuizzes || {}), [key]: next } }
      if (action.passed) {
        s = {
          ...s,
          evidence: recordEvidence(s.evidence || [], {
            source: 'challenge',
            action: 'pass',
            targetType: 'chapter',
            targetId: key,
            context: `章节闯关 · ${action.chapterName || key} 通关`,
            result: { score: action.score },
            masteryKey: 'synthesis',
            errorTypes: [],
          }),
        }
      }
      s = touchStreak(s)
      break
    }

    case 'TOGGLE_MEMORIZE': {
      // R10：必背速记「已记住」切换。只记录勾选状态，不直接产生掌握度。
      const memId = action.itemId
      if (!memId) break
      const memList = state.memorized || []
      s = {
        ...state,
        memorized: memList.includes(memId) ? memList.filter((x) => x !== memId) : [...memList, memId],
      }
      break
    }

    case 'RECORD_RESEARCH': {
      // 综合研究院进度记录（确定性事实打点）
      // 页面派发单数 kind（transfer/researchNote），存储键为复数（transfers/researchNotes）
      const KIND_KEY = { synthesis: 'synthesis', transfer: 'transfers', researchNote: 'researchNotes' }
      const p = state.researchProgress || { synthesis: [], transfers: [], researchNotes: [] }
      const key = KIND_KEY[action.kind]
      if (!key || !(key in p)) break
      s = {
        ...state,
        researchProgress: {
          ...p,
          [key]: [...p[key], { ...action.entry, at: now() }],
        },
      }
      s = touchStreak(s)
      break
    }

    case 'RECORD_PUZZLE': {
      const entry = { date: todayString(), puzzleId: action.puzzleId, answerIdx: action.answerIdx, correct: action.correct, at: now() }
      s = { ...state, puzzleHistory: [...state.puzzleHistory, entry] }
      if (action.correct) s = addXp(s, XP.stepCorrect)
      s = touchStreak(s)
      break
    }

    case 'REVIEW_EXPERIMENT': {
      s = {
        ...state,
        experimentReviews: {
          ...state.experimentReviews,
          [action.experimentId]: { choice: action.choice, note: action.note || '', at: now() },
        },
      }
      s = addXp(s, XP.selfExplain)
      s = touchStreak(s)
      break
    }

    case 'START_EXPERIMENT': {
      s = addXp(state, XP.experimentStart)
      s.experiments = {
        ...state.experiments,
        [action.experimentId]: { startedAt: now(), assumption: action.assumption || '', entries: [], completed: false },
      }
      break
    }

    case 'LOG_EXPERIMENT': {
      const e = state.experiments[action.experimentId]
      if (!e) return state
      s = {
        ...state,
        experiments: {
          ...state.experiments,
          [action.experimentId]: { ...e, entries: [...e.entries, action.entry] },
        },
      }
      s = touchStreak(s)
      break
    }

    case 'COMPLETE_EXPERIMENT': {
      const e = state.experiments[action.experimentId]
      if (!e) return state
      s = addXp(state, XP.experimentComplete)
      s = touchStreak(s)
      if (action.nodeId) s.mastery = bumpMastery(s.mastery, action.nodeId, 4)
      s.experiments = {
        ...state.experiments,
        [action.experimentId]: { ...e, completed: true, completedAt: now() },
      }
      break
    }

    case 'SAVE_PROFILE': {
      s = { ...state, userProfile: { ...state.userProfile, ...action.profile } }
      break
    }

    case 'SAVE_SELF_EXPLANATION': {
      s = {
        ...state,
        selfExplanations: [...state.selfExplanations, { nodeId: action.nodeId, text: action.text, at: now() }],
      }
      s = addXp(s, XP.selfExplain)
      s = touchStreak(s)
      break
    }

    case 'SAVE_HEX_NOTE': {
      // 64卦档案「我的理解」：按 key（hex 或 yao）持久化笔记。
      const next = { ...(state.hexNotes || {}) }
      if (!action.note || !action.note.trim()) delete next[action.key]
      else next[action.key] = { note: action.note.trim(), at: now() }
      s = { ...state, hexNotes: next }
      break
    }

    case 'DELETE_HEX_NOTE': {
      const next = { ...(state.hexNotes || {}) }
      delete next[action.key]
      s = { ...state, hexNotes: next }
      break
    }

    case 'RECORD_HEX_EVIDENCE': {
      // R2-1.5：记录「学习证据」（阅读/结构/原典/易传/案例/传统/分析）。
      // 只做事实打点，不直接 bump 掌握度——「看过」不等于「学会」。
      const key = action.key
      const kind = action.kind
      const next = { ...(state.hexEvidence || {}) }
      const prev = next[key] || {}
      next[key] = { ...prev, [kind]: true, at: now() }
      s = { ...state, hexEvidence: next }
      s = touchStreak(s)
      break
    }

    case 'RECORD_TERM_EVIDENCE': {
      // R2-2：术语学习证据打点（阅读/关联发现/原典理解/案例应用）。
      // 只打点，不 bump 掌握度——「点开页面」不等于「学会」。
      const key = action.key
      const kind = action.kind
      const next = { ...(state.termEvidence || {}) }
      const prev = next[key] || {}
      next[key] = { ...prev, [kind]: true, at: now() }
      s = { ...state, termEvidence: next }
      s = touchStreak(s)
      break
    }

    case 'SAVE_TERM_NOTE': {
      // R2-2：术语「我的理解」（开放分析），按 key 持久化。
      const next = { ...(state.termNotes || {}) }
      if (!action.note || !action.note.trim()) delete next[action.key]
      else next[action.key] = { note: action.note.trim(), at: now() }
      s = { ...state, termNotes: next }
      s = touchStreak(s)
      break
    }

    case 'DELETE_TERM_NOTE': {
      const next = { ...(state.termNotes || {}) }
      delete next[action.key]
      s = { ...state, termNotes: next }
      break
    }

    case 'RECORD_CONTRAST': {
      // R2-2：易学辨析室作答。答对才把两概念掌握度顶到「能区分」（4）。
      // 记录 chosen 与 correct，供「最近容易混淆」与 Agent 推荐反查。
      const entry = {
        groupId: action.groupId,
        termA: action.termA,
        termB: action.termB,
        chosen: action.chosen ?? null,
        correct: !!action.correct,
        at: now(),
      }
      s = { ...state, contrastHistory: [...(state.contrastHistory || []), entry] }
      if (action.correct) {
        s.mastery = bumpMastery(s.mastery, `term-${action.termA}`, 4)
        s.mastery = bumpMastery(s.mastery, `term-${action.termB}`, 4)
        s = addXp(s, XP.stepCorrect)
      }
      s = touchStreak(s)
      break
    }

    case 'COMPUTE_CHART': {
      s = addXp(state, state.chartComputed ? 0 : XP.chartComputed)
      s = touchStreak(s)
      s.chartComputed = true
      break
    }

    case 'SET_SETTING': {
      s = { ...state, settings: { ...state.settings, [action.key]: action.value } }
      break
    }

    case 'IMPORT': {
      s = action.state
      break
    }

    case 'RESET': {
      return initialState
    }

    default:
      return state
  }

  return finalize(s)
}