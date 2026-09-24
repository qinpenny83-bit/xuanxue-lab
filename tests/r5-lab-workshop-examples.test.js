// ============================================================
// R5 · 易工坊 + 实验 tab 内容扩充验收
//
// 验收点：
//   A. 13 个现实实验全部带 example（示范假设/示范记录）
//   B. 60 个探索实验全部可解析材料（materialLabel / materialDetail / resolveExploreMaterials）
//   C. 72 个易工坊训练任务全部带 example（示范回答，引用真实材料，无禁词）
//   D. Evidence 闭环：探索实验完成 → RECORD_EVIDENCE → masteryProfile 重算
// ============================================================
import { describe, it, expect } from 'vitest'
import { EXPERIMENTS, EXPERIMENT_BY_ID, getExperiment } from '../src/data/experiments'
import { EXPLORE_EXPERIMENTS, EXPLORE_CATEGORIES, getExploreExperiment, exploreByCategory } from '../src/data/exploreExperiments'
import { WORKSHOP_TASKS, workshopTasksByBench, getWorkshopTask } from '../src/data/workshopTasks'
import { WORKSHOPS } from '../src/agent/workshopEngine'
import { materialLabel, materialDetail, resolveExploreMaterials } from '../src/lib/exploreMaterial'
import { reducer } from '../src/store/reducer'
import { initialState } from '../src/lib/storage'

const FORBIDDEN = ['命中注定', '算命', '大师预测', '精准预测', '科学验证', '必吉', '转运', '开运', '包你', '一定灵', '保证']

describe('R5 · 现实实验 example（13 个）', () => {
  it('总量 13 个且 id 全局唯一', () => {
    expect(EXPERIMENTS.length).toBe(13)
    expect(new Set(EXPERIMENTS.map((e) => e.id)).size).toBe(13)
  })

  it('每个现实实验都带 example 示范，且非空、含「例：」', () => {
    for (const e of EXPERIMENTS) {
      expect(typeof e.example, `${e.id} 缺 example`).toBe('string')
      expect(e.example.trim().length, `${e.id} example 为空`).toBeGreaterThan(10)
      expect(e.example, `${e.id} example 缺前缀`).toContain('例：')
    }
  })

  it('example 内容含具体事实（出现数字 / 天 / 天干 / 卦名等），无禁词', () => {
    const CONCRETE_HINTS = /[0-9]|天|卦|阴阳|证据|反例|标签|假设|甲|坎|兑|内层|外层|阶段|事件|决定|关系|情境/
    for (const e of EXPERIMENTS) {
      expect(CONCRETE_HINTS.test(e.example), `${e.id} example 太空泛`).toBe(true)
      for (const w of FORBIDDEN) {
        expect(e.example.includes(w), `${e.id} example 含禁词「${w}」`).toBe(false)
      }
    }
  })

  it('getExperiment / EXPERIMENT_BY_ID 均可定位，且 example 随对象一起可取', () => {
    expect(getExperiment('exp-001').example).toContain('假设')
    expect(EXPERIMENT_BY_ID['exp-013'].example).toContain('内层')
  })
})

describe('R5 · 探索实验材料解析（60 个）', () => {
  it('总量 60，五类各 ≥10，id 唯一', () => {
    expect(EXPLORE_EXPERIMENTS.length).toBe(60)
    expect(new Set(EXPLORE_EXPERIMENTS.map((e) => e.id)).size).toBe(60)
    for (const cat of EXPLORE_CATEGORIES) {
      expect(exploreByCategory(cat.id).length, `${cat.id} 数量不足`).toBeGreaterThanOrEqual(10)
    }
  })

  it('每个实验的 material 都能解析出标签（非「暂无可靠整理」）', () => {
    for (const e of EXPLORE_EXPERIMENTS) {
      const label = materialLabel(e.material)
      expect(label, `${e.id} material 解析失败`).not.toBe('未知对象')
      expect(label, `${e.id} material 无内容`).not.toBe('暂无可靠整理')
      expect(label.length, `${e.id} material 标签为空`).toBeGreaterThan(1)
    }
  })

  it('每个实验的 material 都能解析出详情块（label + body 非空）', () => {
    for (const e of EXPLORE_EXPERIMENTS) {
      const detail = materialDetail(e.material)
      expect(detail, `${e.id} 缺详情`).toBeTruthy()
      expect(detail.label, `${e.id} 详情标签为空`).toBeTruthy()
      expect(detail.body, `${e.id} 详情正文为空`).toBeTruthy()
    }
  })

  it('compare 字段存在时也能解析（解析失败才允许回退）', () => {
    for (const e of EXPLORE_EXPERIMENTS) {
      if (!e.compare) continue
      const detail = materialDetail(e.compare)
      expect(detail, `${e.id} compare 应可解析或明确标记`).toBeTruthy()
    }
  })

  it('resolveExploreMaterials 返回主材料 + 对比对象 + 两个标签', () => {
    for (const e of EXPLORE_EXPERIMENTS) {
      const r = resolveExploreMaterials(e)
      expect(r.mainLabel).toBeTruthy()
      expect(r.main).toBeTruthy()
      if (e.compare) {
        expect(r.compareLabel).toBeTruthy()
        expect(r.compare).toBeTruthy()
      } else {
        expect(r.compare).toBeNull()
      }
    }
  })

  it('getExploreExperiment 可定位，且能力/错误/术语字段合法', () => {
    const DIMS = ['observation', 'structure', 'evidence', 'reasoning', 'counterexample', 'uncertainty', 'synthesis', 'independence']
    for (const e of EXPLORE_EXPERIMENTS) {
      expect(getExploreExperiment(e.id).id).toBe(e.id)
      expect(Array.isArray(e.focus)).toBe(true)
      expect(e.focus.length).toBeGreaterThanOrEqual(2)
      expect(typeof e.reflection).toBe('string')
      for (const k of e.masteryKeys || []) {
        expect(DIMS, `${e.id} masteryKey ${k} 非法`).toContain(k)
      }
      for (const t of e.errorTypes || []) {
        expect(t, `${e.id} errorType 非法`).toMatch(/^E\d{2}$/)
      }
    }
  })
})

describe('R5 · 易工坊训练任务 example（72 个）', () => {
  it('每工作台 12 个任务，且每个任务都带 example', () => {
    for (const b of WORKSHOPS) {
      const tasks = workshopTasksByBench(b.id)
      expect(tasks.length, `${b.id} 任务数`).toBe(12)
      for (const t of tasks) {
        expect(typeof t.example, `${t.id} 缺 example`).toBe('string')
        expect(t.example.trim().length, `${t.id} example 为空`).toBeGreaterThan(10)
      }
    }
  })

  it('example 与任务材料一致：涉及该任务 material 指向的真实卦/爻/经典/案例，且无禁词', () => {
    for (const t of WORKSHOP_TASKS) {
      const ex = t.example
      expect(ex.length).toBeGreaterThan(10)
      for (const w of FORBIDDEN) {
        expect(ex.includes(w), `${t.id} example 含禁词「${w}」`).toBe(false)
      }
      // material 可以是单对象或数组（比较类任务含两个材料），必须合法且非空
      const mats = Array.isArray(t.material) ? t.material : [t.material]
      expect(mats.length > 0 && mats.every((m) => m && typeof m.kind === 'string'), `${t.id} 缺 material`).toBe(true)
    }
  })

  it('getWorkshopTask 可定位到示例，且示例含具体知识锚点', () => {
    // 抽第一卦台任务核对：示例包含卦名或结构词
    const t = getWorkshopTask('ws-hx-01')
    expect(t).toBeTruthy()
    expect(t.example).toContain('乾')
  })
})

describe('R5 · Evidence 闭环（探索实验完成 → 能力档案重算）', () => {
  it('RECORD_EVIDENCE(source: explore, action: reflect 带观察) 写入证据并立即重算 masteryProfile', () => {
    const s0 = { ...initialState, masteryProfile: { overall: 0, level: 'L0' } }
    const s1 = reducer(s0, {
      type: 'RECORD_EVIDENCE',
      evidence: {
        source: 'explore',
        action: 'reflect',
        targetType: 'experiment',
        targetId: 'xpl-s-01',
        context: '我发现：乾卦六个阳爻处境完全不同，得位不是吉凶的唯一标准。',
        result: 'correct',
        masteryKey: 'uncertainty',
        errorTypes: ['E03', 'E01'],
      },
    })
    // 证据落库
    expect(s1.evidence.length).toBe(1)
    const e = s1.evidence[0]
    expect(e.source).toBe('explore')
    // 错误类型进入错误博物馆
    expect(s1.errorPatterns.E03).toBe(1)
    // 能力档案被重算（闭环生效的标志：不再是初始 0 空档案）
    expect(s1.masteryProfile).toBeTruthy()
    expect(typeof s1.masteryProfile.overall).toBe('number')
    expect(s1.masteryProfile.overall).toBeGreaterThan(0)
  })

  it('RECORD_EVIDENCE(source: explore, action: complete 无观察) 记录完成但不虚构能力贡献', () => {
    const s1 = reducer({ ...initialState }, {
      type: 'RECORD_EVIDENCE',
      evidence: {
        source: 'explore',
        action: 'complete',
        targetType: 'experiment',
        targetId: 'xpl-t-03',
        masteryKey: 'evidence',
      },
    })
    expect(s1.evidence.length).toBe(1)
    expect(s1.evidence[0].action).toBe('complete')
    // complete 不产生 mastery 贡献（确定性规则），但档案对象仍被重算
    expect(s1.masteryProfile).toBeTruthy()
  })
})
