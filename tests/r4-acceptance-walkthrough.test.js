// ============================================================
// R4 · 最终验收 · 真实手动走查（用户「十八」验收路径）
//
// 场景（与验收描述一一对应）：
//   地图 → 第1关 → 做题 → 完成 → 下一关 → 第2关 → 做题 →
//   刷新 → 继续第2关 → 完成 → 下一关 → 第3关 → 返回地图 →
//   再点第2关（应看到 ✓ 已完成，而非重新开始第一题）→ 再练一次
//
// 通过 reducer + LessonProgress + localStorage 全程模拟真实交互，
// 与 Lesson.jsx 的派发序列（START → RECORD_QUESTION_PROGRESS →
// RECORD_EVIDENCE → RECORD_QUIZ → ADVANCE → COMPLETE_LESSON_ATTEMPT）
// 完全一致，验证端到端状态机而非单个单元。
// ============================================================
import { describe, it, expect } from 'vitest'
import { reducer } from '../src/store/reducer'
import { initialState, saveState, loadState } from '../src/lib/storage'
import {
  questionIdFor,
  variantLesson,
  getNextLessonNode,
  statusOf,
  progressOf,
  lastResultOf,
} from '../src/lib/lessonProgress'
import { getLesson } from '../src/data/lessons'
import { lessonIdForNode } from '../src/data/curriculum/lessonFactory'
import { CURRICULUM_NODES, getCurriculumNode } from '../src/data/curriculum/index'

// 稳定节点：bazi 学院 yin-yang 章节（真实地图顺序，N1→N2→N3 连续）
const N1 = 'yy-concept'
const N2 = 'yy-property'
const N3 = 'yy-cycle'

const lessonOf = (nodeId) => getLesson(lessonIdForNode(nodeId))
const collegeOf = (nodeId) => getCurriculumNode(nodeId).college
const chapterOf = (nodeId) => getCurriculumNode(nodeId).chapter

// 模拟 Lesson.jsx 的「做一题」：记录进度 + 写 Evidence + 记录 quiz（不推进）
function answer(s, nodeId, qIndex, correct = true, stepType = 'choice') {
  const lesson = lessonOf(nodeId)
  const attemptId = s.lessonProgress[nodeId].currentAttemptId
  const qId = questionIdFor(lesson.id, qIndex, attemptId)
  s = reducer(s, {
    type: 'RECORD_QUESTION_PROGRESS',
    nodeId,
    lessonId: lesson.id,
    attemptId,
    questionIndex: qIndex,
    questionId: qId,
    correct,
    stepType,
  })
  s = reducer(s, {
    type: 'RECORD_EVIDENCE',
    evidence: {
      source: 'lesson',
      action: 'complete',
      targetType: 'question',
      targetId: qId,
      context: `课堂 ${lesson.id}`,
      result: correct ? 'correct' : 'wrong',
      masteryKey: stepType,
    },
  })
  s = reducer(s, { type: 'RECORD_QUIZ', item: { lessonId: lesson.id, nodeId, correct, stepType } })
  return s
}

// 模拟「下一题」按钮
function advance(s, nodeId, nextIndex) {
  const attemptId = s.lessonProgress[nodeId].currentAttemptId
  return reducer(s, { type: 'ADVANCE_LESSON_QUESTION', nodeId, attemptId, nextIndex })
}

// 模拟「完成本关」（剩余题目全答 + 完成归档）
function finishLesson(s, nodeId) {
  const lesson = lessonOf(nodeId)
  const p = s.lessonProgress[nodeId]
  const attemptId = p.currentAttemptId
  let i = p.currentQuestionIndex
  while (i < lesson.steps.length) {
    if (!p.completedQuestionIds.includes(questionIdFor(lesson.id, i, attemptId))) {
      s = answer(s, nodeId, i, true, lesson.steps[i].type)
    }
    s = advance(s, nodeId, i + 1)
    i += 1
  }
  return reducer(s, {
    type: 'COMPLETE_LESSON_ATTEMPT',
    nodeId,
    lessonId: lesson.id,
    attemptId,
    result: { correct: lesson.steps.length, total: lesson.steps.length, masteryCorrect: false },
  })
}

// 模拟浏览器 localStorage（供 saveState/loadState 往返验证刷新恢复）
const __store = {}
globalThis.window = {
  localStorage: {
    getItem: (k) => (k in __store ? __store[k] : null),
    setItem: (k, v) => { __store[k] = String(v) },
    removeItem: (k) => { delete __store[k] },
  },
}

describe('R4-验收 · 真实手动走查（地图→闯关→刷新→完成→返回地图→再练一次）', () => {
  it('完整走一遍验收路径：第1关完成→下一关→第2关做题→刷新→继续→完成→下一关→第3关→返回地图→第2关已完结→再练一次是新 attempt', () => {
    const stepsN1 = lessonOf(N1).steps.length
    const stepsN2 = lessonOf(N2).steps.length
    expect(stepsN1).toBeGreaterThan(0)
    expect(stepsN2).toBeGreaterThan(0)

    // —— 地图 → 第1关（Q1 开始）——
    let s = reducer(initialState, {
      type: 'START_LESSON_ATTEMPT',
      nodeId: N1,
      lessonId: lessonOf(N1).id,
      chapterId: chapterOf(N1),
      collegeId: collegeOf(N1),
    })
    let p = s.lessonProgress[N1]
    const a1 = p.currentAttemptId
    expect(p.status).toBe('in_progress')
    expect(p.currentQuestionIndex).toBe(0)
    expect(p.completedQuestionIds).toHaveLength(0)

    // —— 做题 Q1 → 进入 Q2 ——
    s = answer(s, N1, 0, true, lessonOf(N1).steps[0].type)
    s = advance(s, N1, 1)
    expect(s.lessonProgress[N1].currentQuestionIndex).toBe(1)

    // —— 完成第1关 ——
    s = finishLesson(s, N1)
    p = s.lessonProgress[N1]
    expect(p.status).toBe('completed')
    expect(p.result.total).toBe(stepsN1)
    expect(s.evidence.length).toBeGreaterThanOrEqual(stepsN1) // 每道完成题都写了 Evidence

    // —— 下一关（真实地图顺序）→ 第2关 Q1 ——
    const next1 = getNextLessonNode(s, N1)
    expect(next1.node.id).toBe(N2)
    expect(next1.unlocked).toBe(true)
    s = reducer(s, {
      type: 'START_LESSON_ATTEMPT',
      nodeId: N2,
      lessonId: lessonOf(N2).id,
      chapterId: chapterOf(N2),
      collegeId: collegeOf(N2),
    })
    const a2 = s.lessonProgress[N2].currentAttemptId
    expect(s.lessonProgress[N2].status).toBe('in_progress')
    expect(s.lessonProgress[N2].currentQuestionIndex).toBe(0)

    // —— 第2关做题 Q1（不完成，先刷新）——
    s = answer(s, N2, 0, true, lessonOf(N2).steps[0].type)
    s = advance(s, N2, 1)
    expect(s.lessonProgress[N2].currentQuestionIndex).toBe(1)
    expect(s.lessonProgress[N2].completedQuestionIds).toHaveLength(1)

    // —— 刷新（saveState → loadState）→ 继续第2关（Q2，不是 Q1）——
    saveState(s)
    const reloaded = loadState()
    expect(reloaded.lessonProgress[N1].status).toBe('completed')
    const rp = reloaded.lessonProgress[N2]
    expect(rp.status).toBe('in_progress')
    expect(rp.currentAttemptId).toBe(a2)
    expect(rp.currentQuestionIndex).toBe(1)
    expect(rp.completedQuestionIds).toHaveLength(1)
    expect(statusOf(reloaded, N2)).toBe('in_progress')
    // 组件恢复逻辑：跳过已完成题，从第一个未完成题继续 → 指向 Q2
    expect(rp.completedQuestionIds).not.toContain(questionIdFor(lessonOf(N2).id, 1, a2))
    s = reloaded

    // —— 完成第2关 ——
    s = finishLesson(s, N2)
    p = s.lessonProgress[N2]
    expect(p.status).toBe('completed')
    expect(p.result.total).toBe(stepsN2)

    // —— 下一关 → 第3关 ——
    const next2 = getNextLessonNode(s, N2)
    expect(next2.node.id).toBe(N3)
    expect(next2.unlocked).toBe(true)
    s = reducer(s, {
      type: 'START_LESSON_ATTEMPT',
      nodeId: N3,
      lessonId: lessonOf(N3).id,
      chapterId: chapterOf(N3),
      collegeId: collegeOf(N3),
    })
    expect(s.lessonProgress[N3].status).toBe('in_progress')
    expect(s.lessonProgress[N3].currentQuestionIndex).toBe(0)

    // —— 返回地图 → 再点第2关：应显示 ✓ 已完成，而不是重新开始第一题 ——
    expect(statusOf(s, N2)).toBe('completed')
    const p2 = progressOf(s, N2)
    expect(p2.completedAt).toBeTruthy()
    expect(lastResultOf(p2)).toEqual({ correct: stepsN2, total: stepsN2, score: 100 })
    // 完成态下组件只显示完成状态页，不自动派发 START → attempt 保持原样
    expect(s.lessonProgress[N2].currentAttemptId).toBe(a2)
    expect(s.lessonProgress[N2].attemptCount).toBe(1)

    // —— 第2关 → 再练一次：新的 attempt，且不重复完全相同题目 ——
    s = reducer(s, {
      type: 'START_LESSON_ATTEMPT',
      nodeId: N2,
      lessonId: lessonOf(N2).id,
      chapterId: chapterOf(N2),
      collegeId: collegeOf(N2),
      forceNew: true,
    })
    const p2b = s.lessonProgress[N2]
    expect(p2b.status).toBe('in_progress')
    expect(p2b.attemptCount).toBe(2)
    expect(p2b.currentAttemptId).not.toBe(a2)
    expect(p2b.completedQuestionIds).toHaveLength(0)
    expect(p2b.currentQuestionIndex).toBe(0)
    // questionId 含 attempt 种子：跨 attempt 必不同 → 不是同一套题
    const qOld = questionIdFor(lessonOf(N2).id, 0, a2)
    const qNew = questionIdFor(lessonOf(N2).id, 0, p2b.currentAttemptId)
    expect(qNew).not.toBe(qOld)
    // 确定性变体：同一 attempt 刷新稳定，跨 attempt 存在不同选项顺序
    const vOld = variantLesson(lessonOf(N2), a2)
    const vNew = variantLesson(lessonOf(N2), p2b.currentAttemptId)
    const vNew2 = variantLesson(lessonOf(N2), p2b.currentAttemptId)
    expect(JSON.stringify(vNew.steps)).toBe(JSON.stringify(vNew2.steps)) // 同 attempt 稳定
    const choiceDiff = lessonOf(N2).steps.some(
      (st, i) => Array.isArray(st.options) && JSON.stringify(vOld.steps[i]?.options) !== JSON.stringify(vNew.steps[i]?.options)
    )
    const hasChoice = lessonOf(N2).steps.some((st) => Array.isArray(st.options) && st.options.length > 1)
    if (hasChoice) expect(choiceDiff).toBe(true) // 有选择类题目则变体确实不同

    // —— 全程：N1/N2 已完成、N3 进行中、无丢失 ——
    expect(statusOf(s, N1)).toBe('completed')
    expect(statusOf(s, N2)).toBe('in_progress') // 再练一次的进行中（不覆盖 N1/N3）
    expect(statusOf(s, N3)).toBe('in_progress')
    expect(Object.keys(s.lessonProgress).sort()).toEqual([N1, N2, N3].sort())
  })

  it('走查全程 Agent 推荐理解完成状态：N1 完成后推荐升级为 N2（地图真实顺序）', () => {
    let s = reducer(initialState, {
      type: 'START_LESSON_ATTEMPT',
      nodeId: N1,
      lessonId: lessonOf(N1).id,
      chapterId: chapterOf(N1),
      collegeId: collegeOf(N1),
    })
    s = finishLesson(s, N1)
    // 完成 N1 后，Agent 不再重复推荐已完成基础关，升级为地图下一未完成关 N2
    const next = getNextLessonNode(s, N1)
    expect(next.node.id).toBe(N2)
    expect(next.unlocked).toBe(true)
  })

  it('nodeId 全程稳定：不依赖数组 index，连续 3 关记录各自独立', () => {
    let s = reducer(initialState, {
      type: 'START_LESSON_ATTEMPT',
      nodeId: N1,
      lessonId: lessonOf(N1).id,
      chapterId: chapterOf(N1),
      collegeId: collegeOf(N1),
    })
    s = finishLesson(s, N1)
    s = reducer(s, {
      type: 'START_LESSON_ATTEMPT',
      nodeId: N2,
      lessonId: lessonOf(N2).id,
      chapterId: chapterOf(N2),
      collegeId: collegeOf(N2),
    })
    s = finishLesson(s, N2)
    const ids = Object.keys(s.lessonProgress)
    for (const id of ids) {
      expect(getCurriculumNode(id)).toBeTruthy()
      expect(progressOf(s, id).nodeId).toBe(id)
    }
    expect(ids).toContain(N1)
    expect(ids).toContain(N2)
  })
})
