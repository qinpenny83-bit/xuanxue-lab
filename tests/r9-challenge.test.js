// ============================================================
// R9 · 章节闯关：每章 10 题（变式优先）、答对 8/10 通关、状态与证据闭环
// ============================================================
import { describe, it, expect } from 'vitest'
import { COLLEGES, getCurriculumNode } from '../src/data/curriculum'
import { chapterQuiz, checkChapterQuiz } from '../src/agent/pathEngine'
import { initialState } from '../src/lib/storage'
import { reducer } from '../src/store/reducer'

const ALL_CH = COLLEGES.flatMap((c) => c.chapters.map((ch) => ch.id))

function rightAnswers(quiz) {
  return quiz.map((item) => {
    const node = getCurriculumNode(item.nodeId)
    const rightIdx = node[item.kind].options.findIndex((o) => o.correct)
    return { qId: item.qId, idx: rightIdx }
  })
}

describe('R9 · 章节闯关', () => {
  it('每个章节都能生成恰好 10 题，且不泄露答案', () => {
    for (const id of ALL_CH) {
      const q = chapterQuiz(id)
      expect(q.length, `章节 ${id} 应生成 10 题，实际 ${q.length}`).toBe(10)
      for (const item of q) {
        expect(item.correct, `${item.qId} 不得携带答案`).toBeUndefined()
        expect(item.qId).toMatch(/^[a-z0-9-]+:[a-zA-Z]+$/)
      }
    }
  })

  it('闯关题来源合法：对应节点真实题库，恰 1 个正确项', () => {
    for (const id of ALL_CH) {
      for (const item of chapterQuiz(id)) {
        const node = getCurriculumNode(item.nodeId)
        expect(node, `${item.qId} 节点缺失`).toBeTruthy()
        const src = node[item.kind]
        expect(src, `${item.qId} 题库缺失`).toBeTruthy()
        expect(src.options.filter((o) => o.correct).length).toBe(1)
        expect(item.options.length).toBe(src.options.length)
      }
    }
  })

  it('10 题答对 8 题通关，答对 7 题不通过', () => {
    const q = chapterQuiz('observe')
    expect(q.length).toBe(10)
    const all = rightAnswers(q)
    expect(checkChapterQuiz('observe', all).passed).toBe(true)
    const seven = all.slice(0, 7)
    const r = checkChapterQuiz('observe', seven)
    expect(r.passed).toBe(false)
    expect(r.correct).toBe(7)
    expect(r.score).toBe(70)
  })

  it('变式题优先：首个节点先取 applyB（存在时）', () => {
    const q = chapterQuiz('observe')
    expect(q[0].kind).toBe('applyB')
    expect(q.length).toBe(10)
  })

  it('小章节（不足 10 节点）通过同一节点多题凑满 10 题', () => {
    // 「禁忌之网」仅 3 节点，靠同一节点多种题型凑满 10 题
    const q = chapterQuiz('my-taboo')
    expect(q.length).toBe(10)
    const nodes = new Set(q.map((x) => x.nodeId))
    expect(nodes.size).toBeLessThanOrEqual(3)
  })

  it('RECORD_CHAPTER_QUIZ 写入状态，通过时产生 Evidence，best 不回落', () => {
    let s = { ...initialState, evidence: [] }
    s = reducer(s, { type: 'RECORD_CHAPTER_QUIZ', chapterId: 'observe', chapterName: '如何观察', passed: true, score: 80 })
    expect(s.chapterQuizzes.observe.passed).toBe(true)
    expect(s.chapterQuizzes.observe.best).toBe(80)
    expect(s.evidence.some((e) => e.source === 'challenge' && e.action === 'pass' && e.targetType === 'chapter' && e.targetId === 'observe')).toBe(true)

    s = reducer(s, { type: 'RECORD_CHAPTER_QUIZ', chapterId: 'observe', chapterName: '如何观察', passed: false, score: 60 })
    expect(s.chapterQuizzes.observe.best).toBe(80)
    expect(s.chapterQuizzes.observe.passed).toBe(false)
    expect(s.chapterQuizzes.observe.score).toBe(60)
  })
})
