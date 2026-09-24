// ============================================================
// R6 · 方法论学院 + 综合研究院验收
//
// 验收点：
//   A. 方法论学院：5 章 25 节点，注册进 COLLEGES，Schema 齐全，引用可解析
//   B. 综合研究院：4 个 topic，跨知识综合分析 6 维度数据合法
//   C. 研究模式：资料引用全部可解析，步骤完整
//   D. 迁移挑战：migrationChallenges 确定性工作
//   E. 出师挑战：scoreMasterChallenge 可评分、报告可生成
//   F. 进度记录：RECORD_RESEARCH / RECORD_CONFIDENCE 行为正确
// ============================================================
import { describe, it, expect } from 'vitest'
import {
  COLLEGES,
  CURRICULUM_NODES,
  getCurriculumNode,
  validateCurriculum,
  RESEARCH_INSTITUTE,
} from '../src/data/curriculum'
import {
  SYNTHESIS_DIMENSIONS,
  SYNTHESIS_CASE_ID,
  TRANSFER_PROTOCOL,
  TRANSFER_SELFCHECK,
  RESEARCH_QUESTION,
  MASTER_CASE_ID,
  MASTER_ELIGIBILITY_NOTE,
} from '../src/data/research'
import { getCase } from '../src/data/cases'
import { migrationChallenges } from '../src/agent/knowledgeMastery'
import { scoreMasterChallenge, masterVerdict, nextStageAfterMaster } from '../src/agent/masterChallenge'
import { reducer } from '../src/store/reducer'
import { initialState } from '../src/lib/storage'

const FORBIDDEN = ['命中注定', '算命', '大师预测', '精准预测', '科学验证', '必吉', '转运', '开运', '包你', '一定灵', '保证', '绝对', '必定', '百分之百']

const REQUIRED_FIELDS = [
  'id', 'title', 'college', 'chapter', 'level', 'prerequisite', 'emoji',
  'concept', 'source', 'structure', 'examples', 'counterexamples',
  'commonMistakes', 'exercises', 'caseIds', 'related', 'masteryStandard',
  'errorTypes', 'transferTag', 'hook', 'predict', 'apply', 'counter',
  'summaryPoints', 'microExperiment',
]

function deepStrings(obj, out = []) {
  if (typeof obj === 'string') {
    out.push(obj)
    return out
  }
  if (obj && typeof obj === 'object') {
    for (const v of Object.values(obj)) deepStrings(v, out)
  }
  return out
}

const METHODOLOGY_CHAPTERS = ['observe', 'reason', 'uncertainty', 'bias', 'classics']
const METHODOLOGY_COUNTS = [4, 5, 4, 8, 4]

describe('R6 · 方法论学院（补齐建设）', () => {
  it('注册进 COLLEGES：第 3 位（八字 → 易经 → 方法论 → 其他 → 研究院最后）', () => {
    const ids = COLLEGES.map((c) => c.id)
    expect(ids[2]).toBe('methodology')
    expect(ids.indexOf('methodology')).toBeLessThan(ids.indexOf('fengshui'))
  })

  it('5 章 25 节点，章节与数量正确，id 前缀正确', () => {
    const m = COLLEGES.find((c) => c.id === 'methodology')
    expect(m).toBeTruthy()
    expect(m.chapters.map((ch) => ch.id)).toEqual(METHODOLOGY_CHAPTERS)
    expect(m.chapters.map((ch) => ch.nodes.length)).toEqual(METHODOLOGY_COUNTS)
    expect(m.chapters.reduce((a, ch) => a + ch.nodes.length, 0)).toBe(25)
    const prefixes = { observe: 'obs-', reason: 'rea-', uncertainty: 'unc-', bias: 'bias-', classics: 'cls-' }
    for (const ch of m.chapters) {
      for (const n of ch.nodes) {
        expect(n.id.startsWith(prefixes[ch.id]), `${n.id} 前缀`).toBe(true)
        expect(n.college).toBe('methodology')
      }
    }
  })

  it('25 个节点 26 字段齐全', () => {
    const nodes = CURRICULUM_NODES.filter((n) => n.college === 'methodology')
    expect(nodes.length).toBe(25)
    for (const n of nodes) {
      for (const f of REQUIRED_FIELDS) {
        expect(n[f] !== undefined, `${n.id} 缺字段 ${f}`).toBe(true)
      }
    }
  })

  it('无禁词（深扫全部字符串），apply/counter 3 选项恰 1 正确、错误项带 errorType 与 feedback', () => {
    const nodes = CURRICULUM_NODES.filter((n) => n.college === 'methodology')
    for (const n of nodes) {
      const all = deepStrings(n)
      for (const w of FORBIDDEN) {
        expect(all.every((s) => !s.includes(w)), `${n.id} 含禁词「${w}」`).toBe(true)
      }
      for (const key of ['apply', 'counter']) {
        expect(n[key].options.length, `${n.id} ${key} 选项数`).toBe(3)
        expect(n[key].options.filter((o) => o.correct === true).length, `${n.id} ${key} 正确项数`).toBe(1)
        for (const o of n[key].options) {
          expect(typeof o.feedback === 'string' && o.feedback.length > 0, `${n.id} ${key} 缺 feedback`).toBe(true)
          if (o.correct !== true) {
            expect(typeof o.errorType === 'string' && o.errorType.length > 0, `${n.id} ${key} 错误项缺 errorType`).toBe(true)
          }
        }
      }
      expect(n.predict.options.length, `${n.id} predict 选项数`).toBe(3)
    }
  })

  it('level 0-6 且章内非递减；前置链引用可解析', () => {
    const m = COLLEGES.find((c) => c.id === 'methodology')
    const ids = new Set(CURRICULUM_NODES.map((n) => n.id))
    for (const ch of m.chapters) {
      for (let i = 1; i < ch.nodes.length; i++) {
        expect(ch.nodes[i].level >= ch.nodes[i - 1].level, `${ch.id} 第 ${i} 节点 level 回退`).toBe(true)
      }
      for (const n of ch.nodes) {
        expect(n.level).toBeGreaterThanOrEqual(0)
        expect(n.level).toBeLessThanOrEqual(6)
        for (const p of n.prerequisite || []) expect(ids.has(p), `${n.id} 前置 ${p} 不存在`).toBe(true)
        for (const r of n.related || []) expect(ids.has(r), `${n.id} 关联 ${r} 不存在`).toBe(true)
      }
    }
  })

  it('案例引用全部存在（case-001 ~ case-025）', () => {
    const { errors } = validateCurriculum()
    expect(errors, errors.slice(0, 8).join('\n')).toEqual([])
    const nodes = CURRICULUM_NODES.filter((n) => n.college === 'methodology')
    for (const n of nodes) {
      for (const cid of n.caseIds || []) {
        expect(getCase(cid), `${n.id} 案例 ${cid} 不存在`).toBeTruthy()
      }
    }
  })
})

describe('R6 · 综合研究院结构与数据', () => {
  it('RESEARCH_INSTITUTE 提供 4 个 topic（synthesis/transfer/research/master）', () => {
    expect(RESEARCH_INSTITUTE.topics.map((t) => t.id)).toEqual(['synthesis', 'transfer', 'research', 'master'])
    for (const t of RESEARCH_INSTITUTE.topics) {
      expect(t.title).toBeTruthy()
      expect(t.desc.length).toBeGreaterThan(10)
    }
  })

  it('跨知识综合分析：6 个维度，refNode 与案例存在，3 选项恰 1 正确', () => {
    expect(SYNTHESIS_DIMENSIONS.length).toBe(6)
    const ids = new Set(CURRICULUM_NODES.map((n) => n.id))
    for (const d of SYNTHESIS_DIMENSIONS) {
      expect(ids.has(d.refNode), `维度 ${d.id} refNode ${d.refNode} 不存在`).toBe(true)
      expect(d.options.length).toBe(3)
      expect(d.options.filter((o) => o.correct).length).toBe(1)
      expect(d.keyPoint.length).toBeGreaterThan(10)
    }
    const cs = getCase(SYNTHESIS_CASE_ID)
    expect(cs).toBeTruthy()
    expect(cs.trainingTag).toBe('synthesis')
  })

  it('研究模式：资料引用可解析，6 步流程完整', () => {
    expect(RESEARCH_QUESTION.steps.length).toBe(6)
    for (const m of RESEARCH_QUESTION.materials) {
      expect(m.stance).toBeTruthy()
      expect(m.excerpt.length).toBeGreaterThan(10)
      expect(m.source).toContain('本产品')
    }
    for (const ref of ['ds-count', 'ds-combine', 'ds-myths']) {
      expect(getCurriculumNode(ref), `研究资料引用 ${ref} 不存在`).toBeTruthy()
    }
    expect(getCase('case-046'), '研究资料案例 case-046 不存在').toBeTruthy()
    expect(RESEARCH_QUESTION.question.length).toBeGreaterThan(20)
  })

  it('迁移挑战：协议 3 步 + 自检 4 项', () => {
    expect(TRANSFER_PROTOCOL.length).toBe(3)
    expect(TRANSFER_SELFCHECK.length).toBe(4)
    for (const s of TRANSFER_SELFCHECK) expect(s.text.length).toBeGreaterThan(10)
  })

  it('出师挑战：使用陌生复杂案例 case-054（Level 5, strange）', () => {
    const cs = getCase(MASTER_CASE_ID)
    expect(cs).toBeTruthy()
    expect(cs.trainingTag).toBe('strange')
    expect(cs.level).toBeGreaterThanOrEqual(4)
    expect(MASTER_ELIGIBILITY_NOTE.length).toBeGreaterThan(10)
  })

  it('研究院数据无禁词', () => {
    const all = deepStrings({ SYNTHESIS_DIMENSIONS, TRANSFER_PROTOCOL, TRANSFER_SELFCHECK, RESEARCH_QUESTION })
    for (const w of FORBIDDEN) {
      expect(all.every((s) => !s.includes(w)), `研究院数据含禁词「${w}」`).toBe(true)
    }
  })
})

describe('R6 · 出师挑战引擎集成', () => {
  function goodAnswers(cs) {
    const a = {}
    cs.challenges.forEach((ch, i) => {
      if (ch.type === 'analysis') a[i] = '检查真从与假从的分歧：微根权重按流派规则声明，比较两套解读的自洽性，先列结构再谈结论'
      else if (ch.type === 'confidence') a[i] = 70
      else if (ch.options && ch.options.length) {
        const best = ch.options.find((o) => o.points === 3)
        a[i] = best ? ch.options.indexOf(best) : 0
      }
    })
    return a
  }

  it('好答案 → 生成报告：overall / independence / 维度 / 优势 / 问题', () => {
    const cs = getCase(MASTER_CASE_ID)
    const r = scoreMasterChallenge(cs, goodAnswers(cs))
    expect(r.overall).toBeGreaterThanOrEqual(0)
    expect(r.overall).toBeLessThanOrEqual(100)
    expect(r.independence).toBeGreaterThanOrEqual(0)
    expect(r.dimensions).toBeTruthy()
    expect(r.strengths.length).toBeGreaterThanOrEqual(1)
    expect(r.issues.length).toBeGreaterThanOrEqual(1)
    expect(r.habit.length).toBeGreaterThan(10)
  })

  it('差答案（全选错误项 + 大量提示）→ 分数显著更低', () => {
    const cs = getCase(MASTER_CASE_ID)
    const bad = {}
    cs.challenges.forEach((ch, i) => {
      if (ch.type === 'analysis') bad[i] = ''
      else if (ch.type === 'confidence') bad[i] = 100
      else if (ch.options && ch.options.length) bad[i] = 0
    })
    const r = scoreMasterChallenge(cs, { ...bad, hintCount: 3, consultedKnowledge: true })
    const good = scoreMasterChallenge(cs, { ...goodAnswers(cs), hintCount: 0, consultedKnowledge: false })
    expect(r.overall).toBeLessThan(good.overall)
    expect(r.independence).toBeLessThan(good.independence)
  })

  it('masterVerdict / nextStageAfterMaster 确定性输出', () => {
    expect(masterVerdict(90, 85).length).toBeGreaterThan(10)
    expect(nextStageAfterMaster(90)).toContain('研究')
    expect(nextStageAfterMaster(60)).toContain('巩固')
  })
})

describe('R6 · 迁移挑战引擎', () => {
  it('无掌握节点时返回空（空状态安全）', () => {
    expect(migrationChallenges(initialState)).toEqual([])
  })

  it('掌握结构节点后返回跨学院候选', () => {
    const s = { ...initialState, mastery: { 'pt-concept': 4 } }
    const m = migrationChallenges(s)
    expect(m.length).toBeGreaterThanOrEqual(1)
    const first = m.find((x) => x.from.id === 'pt-concept')
    expect(first).toBeTruthy()
    expect(first.to.length).toBeGreaterThan(0)
    for (const t of first.to) {
      expect(t.college).not.toBe('bazi')
    }
  })
})

describe('R6 · 研究院进度记录', () => {
  it('RECORD_RESEARCH 写入 synthesis / transfer / researchNote，未知 kind 忽略', () => {
    let s = reducer(initialState, { type: 'RECORD_RESEARCH', kind: 'synthesis', entry: { caseId: 'case-050', correct: 5, total: 6 } })
    expect(s.researchProgress.synthesis.length).toBe(1)
    s = reducer(s, { type: 'RECORD_RESEARCH', kind: 'transfer', entry: { from: 'a', to: 'b', checks: 3 } })
    expect(s.researchProgress.transfers.length).toBe(1)
    s = reducer(s, { type: 'RECORD_RESEARCH', kind: 'researchNote', entry: { questionId: 'rq', note: 'x' } })
    expect(s.researchProgress.researchNotes.length).toBe(1)
    const before = s.researchProgress.researchNotes.length
    s = reducer(s, { type: 'RECORD_RESEARCH', kind: 'unknown', entry: {} })
    expect(s.researchProgress.researchNotes.length).toBe(before)
    expect(s.researchProgress.synthesis.length).toBe(1)
  })

  it('RECORD_CONFIDENCE 未被破坏（回归保护）', () => {
    const s = reducer(initialState, { type: 'RECORD_CONFIDENCE', caseId: 'case-054', confidence: 70, actual: 65 })
    expect(s.confidenceHistory.length).toBe(1)
    expect(s.confidenceHistory[0].confidence).toBe(70)
  })
})
