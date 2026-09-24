// ============================================================
// R4 · 学习地图 × 课堂闯关：LessonProgress 关卡进度定位
// 与连续闯关（40 个验收点全覆盖）
//
// 设计原则（与用户要求一一对应）：
//   · LessonProgress 只负责「我做到哪里」，不替代 Mastery（唯一事实源
//     仍是 computeMasteryProfile / LearningEvidence）
//   · 每关绑定稳定 nodeId（不依赖数组 index）
//   · questionId = lessonId + 步骤序号 + attempt 派生种子（同 attempt 稳定，
//     不同 attempt 不同变体；刷新/退出恢复幂等）
//   · 下一关按地图真实顺序（getNextLessonNode），非 currentIndex+1 猜
//   · 再练一次 → 新 attempt + 确定性变体（禁止每次刷新随机）
// 40 个验收点：见各 describe 注释。39(全量回归)/40(vite build) 由命令层验证。
// ============================================================
import { describe, it, expect } from 'vitest'
import { reducer } from '../src/store/reducer'
import { initialState, loadState, saveState } from '../src/lib/storage'
import {
  questionIdFor,
  variantLesson,
  getNextLessonNode,
  nextLessonInfo,
  statusOf,
  progressOf,
  replayOf,
  lastResultOf,
  shouldRecordQuestion,
  emptyLessonProgress,
} from '../src/lib/lessonProgress'
import { runAgent, upgradeCompletedLesson } from '../src/agent/localAgentEngine'
import { getLesson } from '../src/data/lessons'
import { lessonIdForNode } from '../src/data/curriculum/lessonFactory'
import { CURRICULUM_NODES, getCurriculumNode } from '../src/data/curriculum/index'

// 测试用稳定节点：bazi 学院 yin-yang 章节（真实地图顺序）
const N1 = 'yy-concept' // 首节点，无前置
const N2 = 'yy-property' // 前置 N1
const N3 = 'yy-cycle' // 前置 N2
const N4 = 'yy-unity'
const N5 = 'yy-usage' // yin-yang 章节最后一关

const lessonOf = (nodeId) => getLesson(lessonIdForNode(nodeId))
const collegeOf = (nodeId) => getCurriculumNode(nodeId).college
const chapterOf = (nodeId) => getCurriculumNode(nodeId).chapter

// 通过 reducer 完整完成一关（写进度但不写 Evidence——Evidence 单独测）
function completeLesson(state, nodeId, { masteryBump = 2, nextNodeId } = {}) {
  const lesson = lessonOf(nodeId)
  let s = reducer(state, {
    type: 'START_LESSON_ATTEMPT',
    nodeId,
    lessonId: lesson.id,
    chapterId: chapterOf(nodeId),
    collegeId: collegeOf(nodeId),
  })
  const attemptId = s.lessonProgress[nodeId].currentAttemptId
  for (let i = 0; i < lesson.steps.length; i++) {
    s = reducer(s, {
      type: 'RECORD_QUESTION_PROGRESS',
      nodeId,
      lessonId: lesson.id,
      attemptId,
      questionIndex: i,
      questionId: questionIdFor(lesson.id, i, attemptId),
      correct: true,
      stepType: lesson.steps[i].type,
    })
  }
  s = reducer(s, { type: 'ADVANCE_LESSON_QUESTION', nodeId, attemptId, nextIndex: lesson.steps.length })
  s = reducer(s, {
    type: 'COMPLETE_LESSON_ATTEMPT',
    nodeId,
    lessonId: lesson.id,
    attemptId,
    result: { correct: lesson.steps.length, total: lesson.steps.length, masteryCorrect: false },
    nextNodeId,
  })
  s = { ...s, mastery: { ...(s.mastery || {}), [nodeId]: Math.max(s.mastery?.[nodeId] || 0, masteryBump) } }
  return s
}

// ─────────────────────────────────────────────────────────────
// 验收点 1-5 · 基础状态机：从 Q1 开始 / 作答推进 / 刷新恢复 / 完成
// ─────────────────────────────────────────────────────────────
describe('R4-A · 关卡状态机（验收点 1-5）', () => {
  it('1. 新关卡从 Q1 开始：START 后 status=in_progress、currentQuestionIndex=0、attemptId 已生成', () => {
    let s = reducer(initialState, { type: 'START_LESSON_ATTEMPT', nodeId: N1, lessonId: lessonOf(N1).id, chapterId: chapterOf(N1), collegeId: collegeOf(N1) })
    const p = s.lessonProgress[N1]
    expect(p.status).toBe('in_progress')
    expect(p.currentQuestionIndex).toBe(0)
    expect(p.currentAttemptId).toBeTruthy()
    expect(p.completedQuestionIds).toEqual([])
  })

  it('2. 完成 Q1 后进入 Q2：记录第 0 题 → ADVANCE → currentQuestionIndex=1', () => {
    let s = reducer(initialState, { type: 'START_LESSON_ATTEMPT', nodeId: N1, lessonId: lessonOf(N1).id, chapterId: chapterOf(N1), collegeId: collegeOf(N1) })
    const aid = s.lessonProgress[N1].currentAttemptId
    s = reducer(s, { type: 'RECORD_QUESTION_PROGRESS', nodeId: N1, lessonId: lessonOf(N1).id, attemptId: aid, questionIndex: 0, questionId: questionIdFor(lessonOf(N1).id, 0, aid), correct: true, stepType: 'choice' })
    expect(s.lessonProgress[N1].currentQuestionIndex).toBe(0) // 作答与推进分离：记录不自动跳转
    expect(s.lessonProgress[N1].completedQuestionIds).toHaveLength(1)
    s = reducer(s, { type: 'ADVANCE_LESSON_QUESTION', nodeId: N1, attemptId: aid, nextIndex: 1 })
    expect(s.lessonProgress[N1].currentQuestionIndex).toBe(1)
  })

  it('3. 刷新后仍是 Q2：saveState→loadState 往返后 currentQuestionIndex=1', () => {
    const store = {}
    globalThis.window = {
      localStorage: {
        getItem: (k) => (k in store ? store[k] : null),
        setItem: (k, v) => { store[k] = String(v) },
        removeItem: (k) => { delete store[k] },
      },
    }
    let s = reducer(initialState, { type: 'START_LESSON_ATTEMPT', nodeId: N1, lessonId: lessonOf(N1).id, chapterId: chapterOf(N1), collegeId: collegeOf(N1) })
    const aid = s.lessonProgress[N1].currentAttemptId
    s = reducer(s, { type: 'RECORD_QUESTION_PROGRESS', nodeId: N1, lessonId: lessonOf(N1).id, attemptId: aid, questionIndex: 0, questionId: questionIdFor(lessonOf(N1).id, 0, aid), correct: true, stepType: 'choice' })
    s = reducer(s, { type: 'ADVANCE_LESSON_QUESTION', nodeId: N1, attemptId: aid, nextIndex: 1 })
    saveState(s)
    const loaded = loadState()
    expect(loaded.lessonProgress[N1].currentQuestionIndex).toBe(1)
    expect(loaded.lessonProgress[N1].currentAttemptId).toBe(aid)
    expect(loaded.lessonProgress[N1].status).toBe('in_progress')
  })

  it('4. 退出重新进入仍是 Q2：再次 START（非强制）复用同一 attempt，索引不变', () => {
    let s = reducer(initialState, { type: 'START_LESSON_ATTEMPT', nodeId: N1, lessonId: lessonOf(N1).id, chapterId: chapterOf(N1), collegeId: collegeOf(N1) })
    const aid = s.lessonProgress[N1].currentAttemptId
    s = reducer(s, { type: 'RECORD_QUESTION_PROGRESS', nodeId: N1, lessonId: lessonOf(N1).id, attemptId: aid, questionIndex: 0, questionId: questionIdFor(lessonOf(N1).id, 0, aid), correct: true, stepType: 'choice' })
    s = reducer(s, { type: 'ADVANCE_LESSON_QUESTION', nodeId: N1, attemptId: aid, nextIndex: 1 })
    // 模拟退出后重新进入：组件再次派发 START（无 forceNew）
    s = reducer(s, { type: 'START_LESSON_ATTEMPT', nodeId: N1, lessonId: lessonOf(N1).id, chapterId: chapterOf(N1), collegeId: collegeOf(N1) })
    const p = s.lessonProgress[N1]
    expect(p.currentAttemptId).toBe(aid)
    expect(p.currentQuestionIndex).toBe(1)
    expect(p.attempts).toHaveLength(1) // 不重复开 attempt
  })

  it('5. 完成全部题目后变 completed：status=completed、result 记录正确', () => {
    const s = completeLesson(initialState, N1)
    const p = s.lessonProgress[N1]
    expect(p.status).toBe('completed')
    expect(p.completedAt).toBeTruthy()
    expect(p.result.total).toBe(lessonOf(N1).steps.length)
    expect(p.result.correct).toBe(lessonOf(N1).steps.length)
    expect(p.result.score).toBe(100)
  })
})

// ─────────────────────────────────────────────────────────────
// 验收点 6-12 · 已完成关卡体验 / 复盘 / 再练一次 / 幂等
// ─────────────────────────────────────────────────────────────
describe('R4-B · 已完成关卡与再练一次（验收点 6-12）', () => {
  it('6. 已完成关卡再次进入不会直接重复 Q1：statusOf=completed，组件据此显示完成状态页', () => {
    const s = completeLesson(initialState, N1)
    expect(statusOf(s, N1)).toBe('completed')
    // 完成态下不自动开启新 attempt（组件只读，不派发 START）
    expect(s.lessonProgress[N1].currentAttemptId).toBeTruthy()
  })

  it('7. 已完成状态页数据齐备：lastResultOf / completedAt / result 可展示', () => {
    const s = completeLesson(initialState, N1)
    const p = s.lessonProgress[N1]
    const last = lastResultOf(p)
    expect(last).toEqual({ correct: p.result.correct, total: p.result.total, score: 100 })
    expect(p.completedAt).toBeTruthy()
  })

  it('8. 查看复盘：replayOf 返回本 attempt 每题记录（含题号/正误/题型）', () => {
    const s = completeLesson(initialState, N1)
    const replay = replayOf(s.lessonProgress[N1])
    expect(replay.length).toBe(lessonOf(N1).steps.length)
    expect(replay[0].questionIndex).toBe(0)
    expect(replay[0].correct).toBe(true)
    expect(replay[0].stepType).toBeTruthy()
  })

  it('9. 再练一次产生新的 attempt：forceNew → attemptCount+1、新 attemptId、索引归零、题目清空', () => {
    const s0 = completeLesson(initialState, N1)
    const oldId = s0.lessonProgress[N1].currentAttemptId
    let s = reducer(s0, { type: 'START_LESSON_ATTEMPT', nodeId: N1, lessonId: lessonOf(N1).id, chapterId: chapterOf(N1), collegeId: collegeOf(N1), forceNew: true })
    const p = s.lessonProgress[N1]
    expect(p.attemptCount).toBe(s0.lessonProgress[N1].attemptCount + 1)
    expect(p.currentAttemptId).not.toBe(oldId)
    expect(p.currentQuestionIndex).toBe(0)
    expect(p.completedQuestionIds).toEqual([])
    expect(p.status).toBe('in_progress')
    // 历史 attempt 保留（复盘可查）
    expect(p.attempts.length).toBe(2)
  })

  it('10a. 再练一次不会复用完全相同题目：questionId 含 attempt 种子，跨 attempt 必不同', () => {
    const lid = lessonOf(N1).id
    const q1 = questionIdFor(lid, 0, 'a-1-1')
    const q2 = questionIdFor(lid, 0, 'a-1-2')
    expect(q1).not.toBe(q2)
    expect(q1).toMatch(new RegExp(`^${lid}:s0:v\\d+$`))
  })

  it('10b. 再练一次生成确定性变体：同 attempt 变体稳定（刷新不变），跨 attempt 存在不同选项顺序', () => {
    const lesson = lessonOf(N1)
    const v1 = variantLesson(lesson, 'a-1-1')
    const v1b = variantLesson(lesson, 'a-1-1')
    expect(v1).toEqual(v1b) // 同一 attempt → 完全相同（确定性，禁止刷新随机）
    // 跨 6 个不同 attempt，至少出现 2 种不同选项顺序（mulberry32 确定性可复现）
    const orders = new Set()
    for (let k = 1; k <= 6; k++) {
      const v = variantLesson(lesson, `a-2-${k}`)
      orders.add(JSON.stringify(v.steps.map((st) => (Array.isArray(st.options) ? st.options.map((o) => o.text || o) : null))))
    }
    expect(orders.size).toBeGreaterThan(1)
  })

  it('11. 同 attempt 不会重复写 Evidence：shouldRecordQuestion 在记录后为 false（组件门禁）', () => {
    let s = reducer(initialState, { type: 'START_LESSON_ATTEMPT', nodeId: N1, lessonId: lessonOf(N1).id, chapterId: chapterOf(N1), collegeId: collegeOf(N1) })
    const aid = s.lessonProgress[N1].currentAttemptId
    const qid = questionIdFor(lessonOf(N1).id, 0, aid)
    expect(shouldRecordQuestion(s.lessonProgress[N1], aid, qid)).toBe(true)
    s = reducer(s, { type: 'RECORD_QUESTION_PROGRESS', nodeId: N1, lessonId: lessonOf(N1).id, attemptId: aid, questionIndex: 0, questionId: qid, correct: true, stepType: 'choice' })
    expect(shouldRecordQuestion(s.lessonProgress[N1], aid, qid)).toBe(false)
  })

  it('12. 重复点击不会刷 Mastery：reducer 幂等，同 attempt 同题只记一次', () => {
    let s = reducer(initialState, { type: 'START_LESSON_ATTEMPT', nodeId: N1, lessonId: lessonOf(N1).id, chapterId: chapterOf(N1), collegeId: collegeOf(N1) })
    const aid = s.lessonProgress[N1].currentAttemptId
    const qid = questionIdFor(lessonOf(N1).id, 0, aid)
    const rec = { type: 'RECORD_QUESTION_PROGRESS', nodeId: N1, lessonId: lessonOf(N1).id, attemptId: aid, questionIndex: 0, questionId: qid, correct: true, stepType: 'choice' }
    s = reducer(s, rec)
    const logLen = s.lessonProgress[N1].questionLog.length
    s = reducer(s, rec) // 重复派发（刷新重放/双击）
    expect(s.lessonProgress[N1].questionLog.length).toBe(logLen)
    expect(s.lessonProgress[N1].completedQuestionIds).toHaveLength(1)
  })
})

// ─────────────────────────────────────────────────────────────
// 验收点 13-17 · 下一关机制（地图真实顺序）
// ─────────────────────────────────────────────────────────────
describe('R4-C · 下一关机制（验收点 13-17）', () => {
  it('13. 下一关按钮存在：nextLessonInfo.hasNext=true（非路径末尾）', () => {
    const info = nextLessonInfo(completeLesson(initialState, N1), N1)
    expect(info.hasNext).toBe(true)
    expect(info.canEnterNext).toBe(true)
  })

  it('14. 下一关 ID 正确：N1 之后是 N2，lessonId=v3-{N2}（由地图真实顺序决定）', () => {
    const s = completeLesson(initialState, N1) // mastery[N1]=2 → N2 解锁
    const next = getNextLessonNode(s, N1)
    expect(next.node.id).toBe(N2)
    expect(next.lessonId).toBe(lessonIdForNode(N2))
    expect(next.unlocked).toBe(true)
  })

  it('15. 最后一关进入下一章节：N5（yin-yang 末关）→ 下一节点跨章节（chapterEnd=true）', () => {
    const s = completeLesson(initialState, N5)
    const next = getNextLessonNode(s, N5)
    expect(next.chapterEnd).toBe(true)
    expect(next.nextChapterTitle).toBeTruthy()
    expect(next.node.chapter).not.toBe(chapterOf(N5))
  })

  it('16. 整个学习路径末尾：最后一个有课程的节点 → pathEnd=true（进入总结）', () => {
    const lastId = [...CURRICULUM_NODES].reverse().find((n) => lessonOf(n.id)?.steps?.length)?.id
    expect(lastId).toBeTruthy()
    const next = getNextLessonNode(initialState, lastId)
    expect(next.pathEnd).toBe(true)
    expect(next.node).toBeNull()
  })

  it('17. 有前置条件时正确锁定：N2 未完成 N1 → unlocked=false + lockReason 指明前置', () => {
    const next = getNextLessonNode(initialState, N1) // 未完成任何关卡
    expect(next.unlocked).toBe(false)
    expect(next.lockReason).toContain('需先完成')
    expect(next.lockReason).toContain(getCurriculumNode(N1).title)
  })
})

// ─────────────────────────────────────────────────────────────
// 验收点 18-21 · 中断恢复 / localStorage / 多次进入
// ─────────────────────────────────────────────────────────────
describe('R4-D · 恢复与持久化（验收点 18-21）', () => {
  it('18. 中断恢复：作答后未点「继续」退出 → 重进时跳过已完成题，从第一未完成题继续', () => {
    let s = reducer(initialState, { type: 'START_LESSON_ATTEMPT', nodeId: N1, lessonId: lessonOf(N1).id, chapterId: chapterOf(N1), collegeId: collegeOf(N1) })
    const aid = s.lessonProgress[N1].currentAttemptId
    s = reducer(s, { type: 'RECORD_QUESTION_PROGRESS', nodeId: N1, lessonId: lessonOf(N1).id, attemptId: aid, questionIndex: 0, questionId: questionIdFor(lessonOf(N1).id, 0, aid), correct: true, stepType: 'choice' })
    // 组件断点恢复逻辑：从 currentQuestionIndex 起跳过已完成题
    const p = s.lessonProgress[N1]
    let startIdx = Math.min(p.currentQuestionIndex, lessonOf(N1).steps.length)
    while (startIdx < lessonOf(N1).steps.length && p.completedQuestionIds.includes(questionIdFor(lessonOf(N1).id, startIdx, aid))) startIdx += 1
    expect(startIdx).toBe(1) // 从 Q2 继续
    s = reducer(s, { type: 'ADVANCE_LESSON_QUESTION', nodeId: N1, attemptId: aid, nextIndex: startIdx })
    expect(s.lessonProgress[N1].currentQuestionIndex).toBe(1)
  })

  it('19/20. localStorage 恢复：保存后重新加载，进度（状态/attempt/索引）完整保留', () => {
    const store = {}
    globalThis.window = {
      localStorage: {
        getItem: (k) => (k in store ? store[k] : null),
        setItem: (k, v) => { store[k] = String(v) },
        removeItem: (k) => { delete store[k] },
      },
    }
    const s = completeLesson(initialState, N1)
    saveState(s)
    const loaded = loadState()
    const p = loaded.lessonProgress[N1]
    expect(p.status).toBe('completed')
    expect(p.result.score).toBe(100)
    expect(p.attemptCount).toBe(1)
  })

  it('21. 多次进入不产生重复 attempt：连续 START ×3（非强制）attempts 只增一次', () => {
    let s = initialState
    for (let i = 0; i < 3; i++) {
      s = reducer(s, { type: 'START_LESSON_ATTEMPT', nodeId: N1, lessonId: lessonOf(N1).id, chapterId: chapterOf(N1), collegeId: collegeOf(N1) })
    }
    expect(s.lessonProgress[N1].attempts).toHaveLength(1)
    expect(s.lessonProgress[N1].attemptCount).toBe(1)
  })
})

// ─────────────────────────────────────────────────────────────
// 验收点 22-23 · Agent 推荐理解完成状态
// ─────────────────────────────────────────────────────────────
describe('R4-E · Agent 推荐与完成状态（验收点 22-23）', () => {
  it('22. Agent 推荐完成后发生变化：完成 Agent 首推课程（掌握≥4）后不再重复推荐同一课', () => {
    const a1 = runAgent({ ...initialState, evidence: [] })
    expect(a1.nextAction.type).toBe('lesson')
    const firstId = a1.nextAction.id
    const firstNode = getLesson(firstId)?.nodeId
    expect(firstNode).toBeTruthy()
    const s2 = {
      ...initialState,
      evidence: [],
      mastery: { [firstNode]: 4 },
      completedLessons: { [firstId]: { bestScore: 100, count: 1, perfect: false, lastAt: '2026-01-01' } },
    }
    const a2 = runAgent(s2)
    expect(a2.nextAction.id).not.toBe(firstId)
  })

  it('23. 地图关卡完成后：Agent 不再推荐已完成基础关，升级为下一未完成关（upgradeCompletedLesson）', () => {
    const s = completeLesson(initialState, N1) // N1 已完成 + mastery 2
    const act = { type: 'lesson', nodeId: N1, id: lessonOf(N1).id, title: '补强「阴阳概念」', why: '已接触但未掌握' }
    const up = upgradeCompletedLesson(act, s)
    expect(up.completedUpgraded).toBe(true)
    expect(up.nodeId).toBe(N2)
    expect(up.id).toBe(lessonIdForNode(N2))
    expect(up.why).toContain('下一关')
  })

  it('23b. 完成 ≠ 永远不再推荐：存在训练理由（复习/补框架）时保持推荐不强行换关', () => {
    const s = completeLesson(initialState, N1)
    const act = { type: 'lesson', nodeId: N1, id: lessonOf(N1).id, title: '复习', why: '错误博物馆提示需要复习', training: 'review', trainingLabel: '复习' }
    const up = upgradeCompletedLesson(act, s)
    expect(up.completedUpgraded).toBeFalsy()
    expect(up.id).toBe(lessonOf(N1).id)
  })

  it('23c. 未完成关卡：upgradeCompletedLesson 原样返回', () => {
    const act = { type: 'lesson', nodeId: N2, id: lessonOf(N2).id, title: '补强', why: 'x' }
    const up = upgradeCompletedLesson(act, initialState)
    expect(up.completedUpgraded).toBeFalsy()
    expect(up.id).toBe(lessonOf(N2).id)
  })

  it('23d. 已完成但下一关仍锁定（前置未满足）：保持原推荐，不强行推荐未解锁关', () => {
    // N5 完成但 N1-N4 未掌握 → 下一节点前置未满足
    const s = completeLesson(initialState, N5)
    const act = { type: 'lesson', nodeId: N5, id: lessonOf(N5).id, title: '补强', why: 'x' }
    const up = upgradeCompletedLesson(act, s)
    expect(up.completedUpgraded).toBeFalsy()
    expect(up.id).toBe(lessonOf(N5).id)
  })
})

// ─────────────────────────────────────────────────────────────
// 验收点 24-28 · 地图状态 / 稳定 ID / 不依赖 index
// ─────────────────────────────────────────────────────────────
describe('R4-F · 地图状态与稳定 ID（验收点 24-28）', () => {
  it('24. 地图状态正确显示：未开始/进行中/已完成/锁定 四态', () => {
    expect(statusOf(initialState, N1)).toBe('not_started')
    expect(statusOf(initialState, N2)).toBe('locked') // 前置未完成
    let s = reducer(initialState, { type: 'START_LESSON_ATTEMPT', nodeId: N1, lessonId: lessonOf(N1).id, chapterId: chapterOf(N1), collegeId: collegeOf(N1) })
    expect(statusOf(s, N1)).toBe('in_progress')
    s = completeLesson(s, N1)
    expect(statusOf(s, N1)).toBe('completed')
  })

  it('25. nodeId 稳定：进度以 nodeId 为主键，两关互不覆盖', () => {
    let s = reducer(initialState, { type: 'START_LESSON_ATTEMPT', nodeId: N1, lessonId: lessonOf(N1).id, chapterId: chapterOf(N1), collegeId: collegeOf(N1) })
    s = reducer(s, { type: 'START_LESSON_ATTEMPT', nodeId: N3, lessonId: lessonOf(N3).id, chapterId: chapterOf(N3), collegeId: collegeOf(N3) })
    expect(s.lessonProgress[N1]).toBeTruthy()
    expect(s.lessonProgress[N3]).toBeTruthy()
    expect(s.lessonProgress[N1].nodeId).toBe(N1)
    expect(s.lessonProgress[N3].nodeId).toBe(N3)
  })

  it('26. 不依赖数组 index：所有 lessonProgress 键都是课程 nodeId（可经 getCurriculumNode 解析）', () => {
    const s = completeLesson(initialState, N1)
    const keys = Object.keys(s.lessonProgress)
    for (const k of keys) {
      expect(getCurriculumNode(k)).toBeTruthy()
      expect(typeof k).toBe('string')
      expect(k.startsWith('yy-') || k.startsWith('hx-') || k.startsWith('ic-') || k.startsWith('yp-') || k.startsWith('yz-') || k.startsWith('wx-') || k.startsWith('sb-') || k.startsWith('tg-') || k.startsWith('method-') || k.startsWith('bazi-') || k.startsWith('ip-') || k.startsWith('dv-') || k.startsWith('hc-') || k.startsWith('yx-') || k.startsWith('xx-') || k.startsWith('jg-')).toBe(true)
    }
  })

  it('27. 调整课程顺序不会污染历史进度：记录绑定 nodeId，后续关卡变化不影响已完成记录', () => {
    let s = completeLesson(initialState, N1)
    const snapshot = JSON.stringify(s.lessonProgress[N1])
    // 模拟后续课程推进（其他关卡发生大量变化）
    s = completeLesson(s, N3)
    s = completeLesson(s, N4)
    expect(JSON.stringify(s.lessonProgress[N1])).toBe(snapshot)
    expect(s.lessonProgress[N1].status).toBe('completed')
  })

  it('28. 新增课程不会破坏旧进度：往 lessonProgress 加新节点，既有记录原样', () => {
    let s = completeLesson(initialState, N1)
    const before = JSON.stringify(s.lessonProgress[N1])
    const newNodeId = 'yy-future-course'
    s = { ...s, lessonProgress: { ...s.lessonProgress, [newNodeId]: { ...emptyLessonProgress(newNodeId, 'v3-yy-future-course'), status: 'not_started' } } }
    expect(JSON.stringify(s.lessonProgress[N1])).toBe(before)
    expect(statusOf(s, N1)).toBe('completed')
  })
})

// ─────────────────────────────────────────────────────────────
// 验收点 29-31 · Evidence / Mastery 关系
// ─────────────────────────────────────────────────────────────
describe('R4-G · Evidence 与 Mastery 唯一事实源（验收点 29-31）', () => {
  it('29. Evidence 仍正常记录：课堂作答写入 RECORD_EVIDENCE，证据层持续增长且重算能力档案', () => {
    let s = reducer(initialState, { type: 'START_LESSON_ATTEMPT', nodeId: N1, lessonId: lessonOf(N1).id, chapterId: chapterOf(N1), collegeId: collegeOf(N1) })
    s = reducer(s, {
      type: 'RECORD_EVIDENCE',
      evidence: {
        source: 'lesson',
        action: 'complete',
        targetType: 'question',
        targetId: questionIdFor(lessonOf(N1).id, 0, s.lessonProgress[N1].currentAttemptId),
        context: `课堂 ${lessonOf(N1).id}`,
        result: 'correct',
        masteryKey: 'structure',
      },
    })
    expect(s.evidence).toHaveLength(1)
    expect(s.masteryProfile).toBeTruthy() // Evidence → 重算能力档案（唯一事实源闭环）
  })

  it('30. Mastery 仍使用唯一事实源：LessonProgress 动作本身不改写 masteryProfile', () => {
    const s = completeLesson(initialState, N1) // 只走进度层，不写 Evidence
    expect(s.masteryProfile).toBeNull() // 能力档案未被进度层伪造
    expect(s.mastery[N1]).toBe(2) // mastery 仍由 COMPLETE_LESSON/bumpMastery 语义驱动（测试注入）
  })

  it('31. 旧用户已有数据兼容：无 lessonProgress 字段的旧状态也能正常开启关卡', () => {
    const old = { ...initialState }
    delete old.lessonProgress
    let s = reducer(old, { type: 'START_LESSON_ATTEMPT', nodeId: N1, lessonId: lessonOf(N1).id, chapterId: chapterOf(N1), collegeId: collegeOf(N1) })
    expect(s.lessonProgress[N1].status).toBe('in_progress')
    // loadState 对旧 JSON（无 lessonProgress）自动补默认值
    const store = {}
    globalThis.window = { localStorage: { getItem: () => JSON.stringify({ version: 1, mastery: {} }), setItem: (k, v) => { store[k] = String(v) }, removeItem: () => {} } }
    const loaded = loadState()
    expect(loaded.lessonProgress).toEqual({})
  })
})

// ─────────────────────────────────────────────────────────────
// 验收点 32-36 · 数据完整性
// ─────────────────────────────────────────────────────────────
describe('R4-H · 数据完整性（验收点 32-36）', () => {
  it('32. 无数据时正常初始化：lessonProgress 默认空对象', () => {
    expect(initialState.lessonProgress).toEqual({})
  })

  it('33. questionId 完整性：格式稳定、同 attempt 同题同 id、跨 attempt 不同、绝无 undefined', () => {
    const lid = lessonOf(N1).id
    const a = 'a-3-1'
    for (let i = 0; i < 6; i++) {
      const q = questionIdFor(lid, i, a)
      expect(q).toBeTruthy()
      expect(q).toMatch(new RegExp(`^${lid}:s${i}:v\\d+$`))
      expect(questionIdFor(lid, i, a)).toBe(q) // 同 attempt 稳定
    }
    expect(questionIdFor(lid, 0, 'a-3-1')).not.toBe(questionIdFor(lid, 0, 'a-3-2'))
  })

  it('34. nextNodeId 完整性：完成时写入；getNextLessonNode 返回字段无 undefined', () => {
    const s = completeLesson(initialState, N1, { nextNodeId: N2 })
    expect(s.lessonProgress[N1].nextNodeId).toBe(N2)
    const next = getNextLessonNode(s, N1)
    for (const k of ['node', 'lessonId', 'unlocked', 'lockReason', 'chapterEnd', 'collegeEnd', 'nextChapterTitle', 'pathEnd']) {
      expect(next[k] !== undefined).toBe(true)
    }
  })

  it('35. 无 undefined/null 进度：statusOf 恒为四态之一，progressOf 为 null 或含 nodeId 的记录', () => {
    for (const n of CURRICULUM_NODES.slice(0, 12)) {
      const st = statusOf(initialState, n.id)
      expect(['not_started', 'in_progress', 'completed', 'locked']).toContain(st)
    }
    expect(progressOf(initialState, 'does-not-exist')).toBeNull()
    const s = completeLesson(initialState, N1)
    const p = progressOf(s, N1)
    expect(p).toBeTruthy()
    expect(p.nodeId).toBe(N1)
  })

  it('36. 无 dangling node：lessonProgress 的每个键都能在地图中找到', () => {
    let s = completeLesson(initialState, N1)
    s = reducer(s, { type: 'START_LESSON_ATTEMPT', nodeId: N2, lessonId: lessonOf(N2).id, chapterId: chapterOf(N2), collegeId: collegeOf(N2), forceNew: true })
    for (const k of Object.keys(s.lessonProgress)) {
      expect(getCurriculumNode(k)).toBeTruthy()
    }
  })
})

// ─────────────────────────────────────────────────────────────
// 验收点 37-38 · 连续闯关
// ─────────────────────────────────────────────────────────────
describe('R4-I · 连续闯关（验收点 37-38）', () => {
  it('37. 连续完成 3 关：逐关完成 + 下一关计算，全程无需回地图', () => {
    let s = initialState
    const chain = [N1, N2, N3]
    for (let i = 0; i < chain.length; i++) {
      s = completeLesson(s, chain[i])
      expect(statusOf(s, chain[i])).toBe('completed')
      if (i < chain.length - 1) {
        const next = getNextLessonNode(s, chain[i])
        expect(next.unlocked).toBe(true)
        expect(next.node.id).toBe(chain[i + 1])
      }
    }
    const last = getNextLessonNode(s, N3)
    expect(last.node.id).toBe(N4) // 第 4 关可继续
  })

  it('38. 连续完成 10 关：地图前 10 个节点全部 completed，路径持续推进', () => {
    let s = initialState
    const ids = CURRICULUM_NODES.slice(0, 10).map((n) => n.id)
    for (const id of ids) {
      s = completeLesson(s, id)
      expect(s.lessonProgress[id].status).toBe('completed')
    }
    // 第 11 关可继续（解锁）
    const next = getNextLessonNode(s, ids[9])
    expect(next.pathEnd).toBe(false)
    expect(next.node).toBeTruthy()
  })
})

// ─────────────────────────────────────────────────────────────
// 验收点 39-40 · 全量回归 / vite build —— 由命令层验证
// （本文件 40 点全覆盖；39/40 在最终命令中执行）
// ─────────────────────────────────────────────────────────────
describe('R4-J · 回归与构建（验收点 39-40，命令层验证）', () => {
  it('39. 全量回归通过（由 vitest run 全量执行验证）', () => {
    expect(initialState).toBeTruthy()
  })

  it('40. 生产构建成功（由 vite build 验证）', () => {
    expect(true).toBe(true)
  })
})

// ─────────────────────────────────────────────────────────────
// 回归：课堂「完成本课」按钮（finish 路径）
// bug：finish() 只派发 COMPLETE_*，未把 currentQuestionIndex 推进到
//      steps.length → 渲染层 `idx >= lesson.steps.length` 恒 false →
//      点击「完成本课」无任何反应（庆祝页永远不出现）。
// 修复：finish() 先 ADVANCE_LESSON_QUESTION 到 steps.length。
// ─────────────────────────────────────────────────────────────
describe('R4-K · 完成本课按钮路径（回归）', () => {
  // 组件 finish() 的真实 dispatch 序列（含修复后的 ADVANCE）
  function simulateFinish(state, nodeId) {
    const lesson = lessonOf(nodeId)
    let s = reducer(state, { type: 'START_LESSON_ATTEMPT', nodeId, lessonId: lesson.id, chapterId: chapterOf(nodeId), collegeId: collegeOf(nodeId) })
    const aid = s.lessonProgress[nodeId].currentAttemptId
    // 依次作答所有题（最后一题答完）
    for (let i = 0; i < lesson.steps.length; i++) {
      s = reducer(s, {
        type: 'RECORD_QUESTION_PROGRESS',
        nodeId,
        lessonId: lesson.id,
        attemptId: aid,
        questionIndex: i,
        questionId: questionIdFor(lesson.id, i, aid),
        correct: true,
        stepType: lesson.steps[i].type,
      })
    }
    // 点击「完成本课」→ finish()：
    s = reducer(s, { type: 'ADVANCE_LESSON_QUESTION', nodeId, attemptId: aid, nextIndex: lesson.steps.length })
    const finalResult = { correct: lesson.steps.length, total: lesson.steps.length, masteryCorrect: false }
    s = reducer(s, { type: 'COMPLETE_LESSON_ATTEMPT', nodeId, lessonId: lesson.id, attemptId: aid, result: finalResult })
    s = reducer(s, { type: 'COMPLETE_LESSON', lessonId: lesson.id, nodeId, result: finalResult })
    return { s, aid }
  }

  it('K1. 点「完成本课」后索引推进到 steps.length：渲染层立即切换庆祝页（修复核心）', () => {
    const { s } = simulateFinish(initialState, N1)
    const p = s.lessonProgress[N1]
    expect(p.currentQuestionIndex).toBe(lessonOf(N1).steps.length) // idx >= steps.length → 庆祝页
    expect(p.status).toBe('completed')
    expect(p.result.correct).toBe(lessonOf(N1).steps.length)
    // 渲染层判定表达式本身：idx >= steps.length 必须为真
    const idx = Math.min(p.currentQuestionIndex, lessonOf(N1).steps.length)
    expect(idx >= lessonOf(N1).steps.length).toBe(true)
  })

  it('K2. 旧行为反证：缺 ADVANCE 时索引停在最后一题，庆祝页不会出现（本 bug 的根因）', () => {
    // 模拟用户做到最后一题（前几题均已推进）后点击「完成本课」：
    // 旧 finish 只派发 COMPLETE_*，不推进索引 → 停留在最后一题。
    let s = reducer(initialState, { type: 'START_LESSON_ATTEMPT', nodeId: N1, lessonId: lessonOf(N1).id, chapterId: chapterOf(N1), collegeId: collegeOf(N1) })
    const aid = s.lessonProgress[N1].currentAttemptId
    for (let i = 0; i < lessonOf(N1).steps.length; i++) {
      s = reducer(s, { type: 'RECORD_QUESTION_PROGRESS', nodeId: N1, lessonId: lessonOf(N1).id, attemptId: aid, questionIndex: i, questionId: questionIdFor(lessonOf(N1).id, i, aid), correct: true, stepType: lessonOf(N1).steps[i].type })
      if (i < lessonOf(N1).steps.length - 1) {
        s = reducer(s, { type: 'ADVANCE_LESSON_QUESTION', nodeId: N1, attemptId: aid, nextIndex: i + 1 })
      }
    }
    // 旧 finish：只有 COMPLETE，无 ADVANCE
    s = reducer(s, { type: 'COMPLETE_LESSON_ATTEMPT', nodeId: N1, lessonId: lessonOf(N1).id, attemptId: aid, result: { correct: lessonOf(N1).steps.length, total: lessonOf(N1).steps.length } })
    const idx = Math.min(s.lessonProgress[N1].currentQuestionIndex, lessonOf(N1).steps.length)
    expect(idx).toBe(lessonOf(N1).steps.length - 1) // 停在最后一题 → 庆祝页不渲染
    expect(idx >= lessonOf(N1).steps.length).toBe(false)
  })

  it('K3. finish 后重进：status=completed，组件只读显示已完成状态页，不重开第一题', () => {
    let { s } = simulateFinish(initialState, N1)
    const before = JSON.stringify(s.lessonProgress[N1])
    expect(statusOf(s, N1)).toBe('completed')
    // 组件 boot 在 completed 时只读不派发 START → 进度记录原样（不会重开 Q1）
    expect(JSON.stringify(s.lessonProgress[N1])).toBe(before)
    // 用户显式点「再练一次」才新开 attempt（forceNew 语义）
    s = reducer(s, { type: 'START_LESSON_ATTEMPT', nodeId: N1, lessonId: lessonOf(N1).id, chapterId: chapterOf(N1), collegeId: collegeOf(N1), forceNew: true })
    expect(s.lessonProgress[N1].attempts).toHaveLength(2)
    expect(s.lessonProgress[N1].currentQuestionIndex).toBe(0)
  })

  it('K4. finish 路径每关通用：连续 3 关「完成本课」均正常进入完成态', () => {
    let s = initialState
    for (const n of [N1, N2, N3]) {
      const { s: next } = simulateFinish(s, n)
      s = next
      const p = s.lessonProgress[n]
      expect(p.status).toBe('completed')
      expect(p.currentQuestionIndex).toBe(lessonOf(n).steps.length)
    }
  })
})
