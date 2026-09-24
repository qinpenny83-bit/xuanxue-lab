// ============================================================
// V1.5 新增能力测试：学习状态 / 思维画像 / 老师记忆 / 教学人格 /
// 信心校准 / 无唯一答案评分 / 新 reducer 动作 / 内容规模达标。
// 运行：npm test
// ============================================================
import { describe, it, expect } from 'vitest'

import { initialState } from '../src/lib/storage'
import { reducer } from '../src/store/reducer'
import { learningState } from '../src/agent/learningState'
import { thinkingProfile } from '../src/agent/thinkingProfile'
import { composingTeacherMemory } from '../src/agent/teacherMemory'
import { getPersona } from '../src/agent/teacherPersona'
import { calibrateConfidence, calibrationSummary } from '../src/agent/confidence'
import { scoreCase } from '../src/lib/caseScoring'
import { getCase } from '../src/data/cases'
import { LESSONS, getLesson } from '../src/data/lessons'
import { CASES } from '../src/data/cases'
import { EXPERIMENTS } from '../src/data/experiments'
import { DICTIONARY } from '../src/data/dictionary'
import { DOUBT_SCENARIOS } from '../src/data/doubtLab'
import { PUZZLES } from '../src/data/puzzles'

describe('V1.5 学习状态识别', () => {
  it('完全新手 → 探索', () => {
    expect(learningState(initialState).phase).toBe('exploring')
  })

  it('最近 8 题错 3+ → 卡住', () => {
    const s = {
      mastery: { 'five-elements': 3 },
      quizHistory: Array.from({ length: 8 }, (_, i) => ({
        lessonId: 'x', nodeId: 'five-elements', correct: i < 5, errorType: null, at: '',
      })),
      caseHistory: [],
    }
    s.quizHistory[5].correct = false
    s.quizHistory[6].correct = false
    s.quizHistory[7].correct = false
    expect(learningState(s).phase).toBe('stuck')
  })

  it('已掌握 3 节点且最近连续正确 → 巩固', () => {
    const s = {
      mastery: { 'yin-yang': 4, 'five-elements': 4, 'heavenly-stems': 4 },
      quizHistory: [
        { lessonId: 'a', nodeId: 'five-elements', correct: true, errorType: null, at: '' },
        { lessonId: 'b', nodeId: 'five-elements', correct: true, errorType: null, at: '' },
        { lessonId: 'c', nodeId: 'five-elements', correct: true, errorType: null, at: '' },
      ],
      caseHistory: [],
    }
    expect(learningState(s).phase).toBe('consolidating')
  })
})

describe('V1.5 玄学思维画像', () => {
  it('输出 6 个维度且初始信心校准未点亮', () => {
    const p = thinkingProfile(initialState)
    expect(p.dims.length).toBe(6)
    expect(Object.keys(p.values).length).toBe(6)
    expect(p.calibrationReady).toBe(false)
  })
})

describe('V1.5 连续老师记忆', () => {
  it('连续两次同一错误 → 生成记忆开场', () => {
    const mem = composingTeacherMemory({
      errorEvents: [
        { code: 'E01', at: '2026-09-13T10:00:00Z', context: '案例' },
        { code: 'E01', at: '2026-09-14T10:00:00Z', context: '课堂' },
      ],
      errorPatterns: {},
    })
    expect(mem.hasMemory).toBe(true)
    expect(mem.title).toBe('单变量直接下结论')
  })

  it('无错误 → 无记忆', () => {
    expect(composingTeacherMemory({ errorEvents: [], errorPatterns: {} }).hasMemory).toBe(false)
  })
})

describe('V1.5 三个教学人格', () => {
  it('默认温柔老师', () => {
    expect(getPersona(initialState).id).toBe('gentle')
  })
  it('可切换为怀疑老师', () => {
    const s = { ...initialState, settings: { ...initialState.settings, teacherPersona: 'skeptic' } }
    expect(getPersona(s).id).toBe('skeptic')
  })
})

describe('V1.5 信心校准', () => {
  it('过度自信 / 信心不足 / 校准良好', () => {
    expect(calibrateConfidence(90, 63).verdict).toBe('过度自信')
    expect(calibrateConfidence(40, 90).verdict).toBe('信心不足')
    expect(calibrateConfidence(70, 70).verdict).toBe('校准良好')
  })
  it('校准汇总：全命中 → 校准良好', () => {
    const s = calibrationSummary([{ confidence: 50, actual: 60 }, { confidence: 80, actual: 75 }])
    expect(s.ready).toBe(true)
    expect(s.ratio).toBe(100)
    expect(s.verdict).toBe('校准良好')
  })
})

describe('V1.5 无唯一答案与证据强度评分', () => {
  const openCase = getCase('case-015')

  it('开放题选「共同作用」得高分，且输出 actualQuality', () => {
    const r = scoreCase(openCase, { 0: 2, 1: 0, 2: 0, 3: 50 })
    expect(r.dimensions.reasoning).toBeGreaterThanOrEqual(85)
    expect(r.dimensions.info).toBe(100)
    expect(typeof r.actualQuality).toBe('number')
    expect(r.total).toBeGreaterThanOrEqual(80)
  })

  it('开放题选「单一条证据 + 过度推断」被扣减', () => {
    const r = scoreCase(openCase, { 0: 3, 1: 0, 2: 0, 3: 50 })
    expect(r.dimensions.over).toBeLessThan(90)
    expect(r.dimensions.reasoning).toBeLessThan(60)
  })
})

describe('V1.5 reducer 新增动作', () => {
  it('SET_SETTING 切换人格', () => {
    const s = reducer(initialState, { type: 'SET_SETTING', key: 'teacherPersona', value: 'combat' })
    expect(s.settings.teacherPersona).toBe('combat')
  })

  it('RECORD_PUZZLE 记录并加分', () => {
    const s = reducer(initialState, { type: 'RECORD_PUZZLE', puzzleId: 'puzzle-001', answerIdx: 1, correct: true })
    expect(s.puzzleHistory.length).toBe(1)
    expect(s.xp).toBeGreaterThan(initialState.xp)
  })

  it('REVIEW_EXPERIMENT 记录复盘', () => {
    const s = reducer(initialState, { type: 'REVIEW_EXPERIMENT', experimentId: 'exp-001', choice: 'longer', note: '多看几天' })
    expect(s.experimentReviews['exp-001'].choice).toBe('longer')
  })

  it('RECORD_CONFIDENCE 记录信心与真实质量', () => {
    const s = reducer(initialState, { type: 'RECORD_CONFIDENCE', caseId: 'case-001', confidence: 90, actual: 63 })
    expect(s.confidenceHistory.length).toBe(1)
    expect(s.confidenceHistory[0].actual).toBe(63)
  })
})

describe('V1.5 内容规模达标', () => {
  it('微课 20+ / 案例 20 / 实验 10+ / 词典 50+', () => {
    expect(LESSONS.length).toBeGreaterThanOrEqual(20)
    expect(CASES.length).toBeGreaterThanOrEqual(20)
    expect(EXPERIMENTS.length).toBeGreaterThanOrEqual(10)
    expect(DICTIONARY.length).toBeGreaterThanOrEqual(50)
  })

  it('怀疑实验室与每日谜题数据存在', () => {
    expect(DOUBT_SCENARIOS.length).toBeGreaterThanOrEqual(5)
    expect(PUZZLES.length).toBeGreaterThanOrEqual(5)
  })

  it('每节微课都走「问题驱动」结构（hook + 多步骤）', () => {
    for (const l of LESSONS) {
      expect(l.hook).toBeTruthy()
      expect(l.hook.question).toBeTruthy()
      expect(l.steps.length).toBeGreaterThanOrEqual(4)
    }
  })
})