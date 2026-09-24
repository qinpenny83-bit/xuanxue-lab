// ============================================================
// 本地存储层：所有用户数据经 localStorage 持久化，刷新不丢失。
// 提供导出 / 导入 / 清空。
// ============================================================

export const STORAGE_KEY = 'xuanxue-lab:v1'

export const initialState = {
  version: 1,
  onboarded: false,
  entryReason: null,
  userProfile: {
    name: '',
    gender: '',
    birthYear: 1995,
    birthMonth: 6,
    birthDay: 15,
    birthHour: 12,
    birthMinute: 0,
    utcOffsetHours: 8,
    timezoneLabel: '北京时间 (UTC+8)',
  },
  mastery: {}, // nodeId -> 0..6
  xp: 0,
  level: 1,
  streak: 0,
  lastStudyDate: null, // 'YYYY-MM-DD'
  completedLessons: {}, // lessonId -> { bestScore, count, lastAt }
  completedCases: {}, // caseId -> { score, dimensions, confidence, lastAt }
  caseHistory: [], // [{ caseId, score, at }]
  errorPatterns: {}, // 'E01' -> count
  experiments: {}, // experimentId -> { startedAt, entries[], completed }
  dailyTask: null, // { date, lessonId, caseId, experimentId, done }
  achievements: {}, // id -> { unlockedAt }
  settings: { reducedMotion: false, teacherPersona: 'gentle' },
  quizHistory: [], // [{ lessonId, nodeId, correct, errorType, at }]
  selfExplanations: [], // [{ nodeId, text, at }]
  hexNotes: {}, // 64卦档案「我的理解」：{ key: { note, at } }，key 形如 `hx-1` 或 `hx-1-0`
  hexEvidence: {}, // 64卦档案「学习证据」：{ key: { read, structure, original, yizhuan, cases, tradition, analyze, at } }
  termNotes: {}, // 术语百科「我的理解」：{ key: { note, at } }，key 形如 `term-{id}`
  termEvidence: {}, // 术语百科「学习证据」：{ key: { read, link, original, case, at } }
  contrastHistory: [], // 易学辨析室作答记录：[{ groupId, termA, termB, chosen, correct, at }]
  errorEvents: [], // [{ code, at, context }] —— 供「老师记忆」与「错误博物馆」使用
  confidenceHistory: [], // [{ caseId, confidence, actual, at }] —— 信心校准
  puzzleHistory: [], // [{ date, puzzleId, answerIdx, at }] —— 每日谜题
  experimentReviews: {}, // experimentId -> { choice, note, at } —— 实验复盘
  consecutiveCorrect: 0,
  counterAwards: 0,
  chartComputed: false,
  // R3 Phase 0：统一学习证据层（LearningEvidence）——纯事实记录，行为次数≠能力水平
  evidence: [], // [{ version,id,timestamp,source,action,targetType,targetId,context,result,evidence,errorTypes,confidence,beforeMastery,afterMastery,masteryKey,skill,metadata }]
  // R3 Phase 2：实验引擎产物
  experimentRuns: [], // [{ runId, experimentId, category, title, question, sample, steps, hypothesis, predict, evidence, counterexample, revise, conclusion, reflect, beliefRevision, completedAt }]
  beliefRevisions: [], // [{ originalClaim, originalConfidence, counterEvidence, revisedClaim, revisedConfidence, reason, timestamp }]
  // R3 Phase 3：怀疑室（DoubtTask Runner）产物
  doubtRuns: [], // [{ runId, taskId, category, title, emoji, prompt, statement, hypothesis, evidence, counterexample, revise, reflect, selectedOption, correctIndex, errorTypes, masteryKeys, signals, beliefRevision, hasRevision, completedAt }]
  // V1.6：个人推理指纹 Agent
  caseAttempts: [], // [{ caseId, at, attempt, redo, score, confidence, actualQuality, errorTypes[], dimensions, level, usedUnknown, unknownReason, hintDependency, consultedKnowledge, beliefRevision, dualQuality, mode }] —— 每次案例的完整推理记录
  insightState: null, // { date, key, caseId, acceptedAt, done, snapshot } —— 当前洞察状态（行为变化驱动刷新）
  judgmentUnknownUsed: 0, // 「我目前无法判断」使用次数（判断边界意识）
  // V2：学徒能力档案（能力等级，非 XP）
  masteryProfile: null, // 每次案例完成后由 masteryEngine 计算并保存
  masterChallenge: { attempts: [], reports: [] }, // 出师挑战记录
  // 综合研究院进度：{ synthesis: [], transfers: [], researchNotes: [] } —— 纯事实记录
  researchProgress: { synthesis: [], transfers: [], researchNotes: [] },
  // 关卡进度定位层（LessonProgress）：只负责「我做到哪里」，不替代 Mastery。
  // nodeId -> { nodeId, lessonId, chapterId, status, currentAttemptId,
  //             currentQuestionIndex, completedQuestionIds, questionLog, attempts, result }
  lessonProgress: {},
  // R7：求学之路 · 六段主线结业记录：{ [stageKey]: { passed, score, best, at } }
  pathQuizzes: {},
  // R9：章节闯关记录：{ [chapterId]: { passed, score, best, at } }
  chapterQuizzes: {},
  // R10：必背速记已背条目：string[]（条目 id 集合，如 'stem-甲' / 'hx-1'）
  memorized: [],
}

export function loadState() {
  if (typeof window === 'undefined') return { ...initialState }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return { ...initialState }
    const parsed = JSON.parse(raw)
    return { ...initialState, ...parsed, settings: { ...initialState.settings, ...(parsed.settings || {}) } }
  } catch {
    return { ...initialState }
  }
}

export function saveState(state) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {
    // 存储空间满等情况：静默失败
  }
}

export function clearState() {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.removeItem(STORAGE_KEY)
  } catch {
    /* noop */
  }
}

export function exportJSON(state) {
  return JSON.stringify(state, null, 2)
}

export function importJSON(text) {
  const parsed = JSON.parse(text)
  return { ...initialState, ...parsed, version: 1 }
}

export function todayString(d = new Date()) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function downloadJSON(state, filename = '玄学实验室-学习数据.json') {
  const blob = new Blob([exportJSON(state)], { type: 'application/json;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}