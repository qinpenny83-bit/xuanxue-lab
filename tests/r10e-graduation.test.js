// ============================================================
// R10.3 · 毕业验收：L0→L5 六级毕业考
//
// 验收点：
//   A. 等级映射：6 级（L0-L5），key 与求学之路六段一一对应
//   B. 逐级解锁：第 N 级需 N-1 级已毕业才可解锁
//   C. 毕业条件：全部核心节点完成 且 测验通过（双重完成）
//   D. 未完成节点时测验通过 → 不毕业，补完节点即自动毕业
//   E. 全部毕业 → allGraduated、current 停在 L5
//   F. 确定性：同状态两次计算一致
// ============================================================
import { describe, it, expect } from 'vitest'
import { GRADUATION_LEVELS, graduationSummary } from '../src/agent/pathEngine'
import { PATH_STAGES } from '../src/data/pathStages'
import { initialState } from '../src/lib/storage'

function baseState(over = {}) {
  return { ...initialState, ...over }
}

function allDone(stage) {
  const m = {}
  for (const id of stage.coreNodeIds) m[id] = 4
  return m
}

function passedQuiz(stageKey, score = 100) {
  return { [stageKey]: { passed: true, score, best: score, at: '2026-10-15T00:00:00Z' } }
}

describe('R10.3 · 毕业等级映射', () => {
  it('6 级 L0-L5，key 与六段一一对应', () => {
    expect(GRADUATION_LEVELS).toHaveLength(6)
    expect(GRADUATION_LEVELS.map((g) => g.level)).toEqual(['L0', 'L1', 'L2', 'L3', 'L4', 'L5'])
    expect(GRADUATION_LEVELS.map((g) => g.key)).toEqual(PATH_STAGES.map((s) => s.key))
    expect(GRADUATION_LEVELS.every((g) => g.label && g.tip)).toBe(true)
  })
})

describe('R10.3 · 毕业验收引擎', () => {
  it('空状态：L0 解锁但节点未完成不可考；L1-L5 全部锁定；current 为 L0', () => {
    const g = graduationSummary(baseState())
    expect(g.graduatedCount).toBe(0)
    expect(g.allGraduated).toBe(false)
    expect(g.levels[0].unlocked).toBe(true)
    expect(g.levels[0].canTake).toBe(false)
    for (let i = 1; i < 6; i++) {
      expect(g.levels[i].unlocked, `${i} 级应锁定`).toBe(false)
    }
    expect(g.current.level).toBe('L0')
  })

  it('L0 全部核心节点完成但未考 → L0 可考，L1 仍锁定', () => {
    const g = graduationSummary(baseState({ mastery: allDone(PATH_STAGES[0]) }))
    expect(g.levels[0].complete).toBe(true)
    expect(g.levels[0].canTake).toBe(true)
    expect(g.levels[0].graduated).toBe(false)
    expect(g.levels[1].unlocked).toBe(false)
  })

  it('L0 节点完成 + 测验通过 → L0 毕业，L1 解锁（节点未完成则不可考）', () => {
    const g = graduationSummary(baseState({
      mastery: allDone(PATH_STAGES[0]),
      pathQuizzes: passedQuiz('s1', 80),
    }))
    expect(g.levels[0].graduated).toBe(true)
    expect(g.levels[0].best).toBe(80)
    expect(g.graduatedCount).toBe(1)
    expect(g.levels[1].unlocked).toBe(true)
    expect(g.levels[1].canTake).toBe(false)
  })

  it('测验通过但节点未完成 → 不毕业；补完节点即自动毕业（不重考）', () => {
    const s = baseState({ pathQuizzes: passedQuiz('s1') })
    const g1 = graduationSummary(s)
    expect(g1.levels[0].graduated).toBe(false)
    expect(g1.levels[1].unlocked).toBe(false)
    const g2 = graduationSummary({ ...s, mastery: allDone(PATH_STAGES[0]) })
    expect(g2.levels[0].graduated).toBe(true)
    expect(g2.levels[1].unlocked).toBe(true)
  })

  it('越级不可考：L2 全做完但 L1 未毕业 → L2 仍锁定', () => {
    const mastery = {
      ...allDone(PATH_STAGES[0]),
      ...allDone(PATH_STAGES[1]),
      ...allDone(PATH_STAGES[2]),
    }
    const g = graduationSummary(baseState({ mastery, pathQuizzes: passedQuiz('s1') }))
    expect(g.levels[0].graduated).toBe(true) // L0 毕业（节点齐+测验过）
    expect(g.levels[1].canTake).toBe(true) // L1 节点齐 → 可考
    expect(g.levels[2].unlocked).toBe(false) // L1 未毕业 → L2 锁定
    expect(g.levels[2].canTake).toBe(false)
  })

  it('六级全部毕业 → allGraduated、graduatedCount 6、current 停在 L5', () => {
    const mastery = {}
    const quizzes = {}
    for (const s of PATH_STAGES) {
      Object.assign(mastery, allDone(s))
      quizzes[s.key] = { passed: true, score: 100, best: 100, at: '2026-10-15T00:00:00Z' }
    }
    const g = graduationSummary(baseState({ mastery, pathQuizzes: quizzes }))
    expect(g.allGraduated).toBe(true)
    expect(g.graduatedCount).toBe(6)
    expect(g.current.level).toBe('L5')
    expect(g.levels.every((l) => l.graduated)).toBe(true)
  })

  it('确定性：同状态两次计算完全一致', () => {
    const s = baseState({ mastery: allDone(PATH_STAGES[0]), pathQuizzes: passedQuiz('s1') })
    expect(graduationSummary(s)).toEqual(graduationSummary(s))
  })
})
