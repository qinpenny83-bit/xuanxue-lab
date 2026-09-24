// ============================================================
// 核心测试：八字确定性 / 易经起卦 / 案例评分 / Agent / 存储。
// 运行：npm test
// ============================================================
import { describe, it, expect } from 'vitest'
import { computeFourPillars, tenGod } from '../src/lib/bazi'
import { isYangStem } from '../src/lib/constants'
import {
  numberToTrigramIndex,
  buildHexagram,
  hexagramName,
  castByNumbers,
  castByTime,
  castByCoins,
  changedHexagram,
} from '../src/lib/iching'
import { scoreCase } from '../src/lib/caseScoring'
import { generateExperimentReport } from '../src/lib/experimentReport'
import { runAgent } from '../src/agent/localAgentEngine'
import { bumpMastery } from '../src/agent/mastery'
import { recordError, topErrors, ERROR_TYPES } from '../src/agent/errors'
import { reducer } from '../src/store/reducer'
import { initialState, importJSON, exportJSON } from '../src/lib/storage'
import { getCase } from '../src/data/cases'
import { getLesson } from '../src/data/lessons'

describe('八字：确定性计算（对照已知万年历）', () => {
  it('1949-10-01 14:00 → 己丑 癸酉 甲子 辛未', () => {
    const chart = computeFourPillars({ year: 1949, month: 10, day: 1, hour: 14, minute: 0, utcOffsetHours: 8 })
    expect(chart.pillars.year.text).toBe('己丑')
    expect(chart.pillars.month.text).toBe('癸酉')
    expect(chart.pillars.day.text).toBe('甲子')
    expect(chart.pillars.hour.text).toBe('辛未')
    expect(chart.dayStem).toBe('甲')
  })

  it('立春前属于上一年的年柱', () => {
    // 2023-02-01 在 2023 立春（约 2-4）之前，属壬寅年
    const chart = computeFourPillars({ year: 2023, month: 2, day: 1, hour: 12, minute: 0, utcOffsetHours: 8 })
    expect(chart.effYear).toBe(2022)
    expect(chart.pillars.year.stemIdx).toBe((2022 - 4) % 10 < 0 ? (2022 - 4) % 10 + 10 : (2022 - 4) % 10)
  })

  it('十神：甲日主遇己土 → 正财', () => {
    expect(tenGod(0, 5)).toBe('正财') // 甲(0) 我克 己(5)，阴阳相异 → 正财
    expect(tenGod(0, 0)).toBe('比肩') // 甲遇甲
  })

  it('天干阴阳：甲阳、乙阴', () => {
    expect(isYangStem(0)).toBe(true)
    expect(isYangStem(1)).toBe(false)
  })
})

describe('易经：起卦规则可解释、可重复', () => {
  it('数字→卦序正确映射（8→坤）', () => {
    expect(numberToTrigramIndex(1)).toBe(0) // 乾
    expect(numberToTrigramIndex(8)).toBe(7) // 坤
  })

  it('castByNumbers(8,3,5) → 地火明夷，且结果可复现', () => {
    const a = castByNumbers(8, 3, 5)
    const b = castByNumbers(8, 3, 5)
    expect(a.hexagram.name).toBe('地火明夷')
    expect(a.movingLines).toEqual([5])
    expect(a.hexagram).toEqual(b.hexagram)
    expect(a.changed.name).toBe(b.changed.name)
  })

  it('六十四卦名称：上乾下坤为「否」，上坤下乾为「泰」', () => {
    expect(hexagramName(0, 7)).toBe('天地否') // 乾=0，坤=7
    expect(hexagramName(7, 0)).toBe('地天泰')
  })

  it('时间起卦结果稳定成形', () => {
    const d = new Date(2026, 8, 14, 10, 30)
    const r = castByTime(d)
    expect(r.hexagram.name).toBeTruthy()
    expect(r.movingLines.length).toBe(1)
  })

  it('三钱起卦生成六爻且动爻翻转得变卦', () => {
    const r = castByCoins(() => 0.5) // 固定随机源
    expect(r.hexagram.lines.length).toBe(6)
    expect(r.lineDetails.length).toBe(6)
    const changed = changedHexagram(r.hexagram, r.movingLines)
    expect(changed.name).toBeTruthy()
  })
})

describe('案例评分：多维推理评估', () => {
  const cs = getCase('case-001')

  it('满分作答应接近满分', () => {
    const answers = {
      0: 1, // 看结构
      1: ['与领导关系恶化', '睡眠质量下降', '收到新 Offer'], // 只勾证据
      2: 1, // 现实为主
      3: 0, // 主动考虑反例
      4: 50, // 适度信心
    }
    const r = scoreCase(cs, answers)
    expect(r.total).toBeGreaterThanOrEqual(90)
  })

  it('单变量下结论应显著扣分', () => {
    const answers = {
      0: 0, // 先找「缺」
      1: ['工作 5 年', '28 岁', '是女性'], // 背景当证据
      2: 0, // 命盘显示变动期
      3: 1, // 没有反例
      4: 100, // 过度自信
    }
    const r = scoreCase(cs, answers)
    expect(r.total).toBeLessThan(60)
    expect(r.dimensions.over).toBeLessThan(80)
  })
})

describe('本地 Agent：状态 → 掌握 → 推荐 → 反馈', () => {
  it('空状态推荐第一课，且识别无错误', () => {
    const out = runAgent(initialState)
    expect(out.nextAction.type).toBe('lesson')
    expect(out.level.level).toBe(1)
    expect(out.topErrors).toEqual([])
  })

  it('掌握度只升不降', () => {
    let m = {}
    m = bumpMastery(m, 'five-elements', 3)
    m = bumpMastery(m, 'five-elements', 1)
    expect(m['five-elements']).toBe(3)
  })

  it('错误记录与 Top 错误', () => {
    let e = recordError({}, 'E01')
    e = recordError(e, 'E01')
    e = recordError(e, 'E03')
    const top = topErrors(e, 3)
    expect(top[0].code).toBe('E01')
    expect(top[0].count).toBe(2)
    expect(ERROR_TYPES['E01'].name).toBe('单变量直接下结论')
  })
})

describe('Reducer 与存储：进度闭环', () => {
  it('RECORD_QUIZ 答对 why 提升掌握度到 3 并加 XP', () => {
    const s1 = reducer(initialState, { type: 'RECORD_QUIZ', item: { lessonId: 'lesson-five-elements', nodeId: 'five-elements', correct: true, errorType: null, stepType: 'why' } })
    expect(s1.mastery['five-elements']).toBe(3)
    expect(s1.xp).toBeGreaterThan(initialState.xp)
    expect(s1.streak).toBe(1)
  })

  it('COMPLETE_LESSON 记录完成并写回 XP', () => {
    const s1 = reducer(initialState, { type: 'COMPLETE_LESSON', lessonId: 'lesson-five-elements', nodeId: 'five-elements', result: { correct: 5, total: 5, masteryCorrect: true } })
    expect(s1.completedLessons['lesson-five-elements']).toBeTruthy()
    expect(s1.mastery['five-elements']).toBeGreaterThanOrEqual(4)
  })

  it('导入导出往返一致', () => {
    const s1 = { ...initialState, xp: 123 }
    const restored = importJSON(exportJSON(s1))
    expect(restored.xp).toBe(123)
  })

  it('课程与案例数据完整', () => {
    const lesson = getLesson('lesson-five-elements')
    expect(lesson.title).toBe('五行到底是什么？')
    expect(lesson.steps.length).toBeGreaterThanOrEqual(6)
    const cs = getCase('case-001')
    expect(cs.title).toBe('她为什么最近特别想换工作？')
    expect(cs.challenges.length).toBeGreaterThanOrEqual(5)
  })
})

describe('实验报告：规则化趋势分析', () => {
  const exp = {
    metrics: [{ key: 'energy', label: '精力' }],
    days: 7,
  }
  it('空记录给出提示', () => {
    const r = generateExperimentReport(exp, [], '')
    expect(r.empty).toBe(true)
  })
  it('上升趋势被识别', () => {
    const entries = [1, 2, 3, 4, 5, 6].map((v) => ({ metrics: { energy: v } }))
    const r = generateExperimentReport(exp, entries, '我最近状态起伏很大')
    expect(r.metrics[0].trend).toBe('上升')
  })
})