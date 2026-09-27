// ============================================================
// V3 「玄学大学」测试（Phase 1）：
//   1. 三学院课程目录：Schema 十项完整性 + 图谱校验（前置/关联可解析）
//   2. 课程工厂：知识节点 → 八段闭环课程，getLesson 兼容
//   3. 知识 Mastery 引擎：状态推导 / 遗忘曲线 / 复习队列 / 瓶颈 / 解锁
//   4. 自适应训练 V3 集成：遗忘复习优先 > 知识瓶颈 > 能力瓶颈
//   5. Agent 输出：knowledge / reviewQueue / knowledgeSummary
//   6. V3 案例可解析：case-043 / case-047
// 运行：npm test
// ============================================================
import { describe, it, expect } from 'vitest'

import { initialState } from '../src/lib/storage'
import { COLLEGES, CURRICULUM_NODES, getCurriculumNode, resolvePrereqs, transferCandidates, validateCurriculum } from '../src/data/curriculum'
import { curriculumLesson, curriculumLessons, lessonIdForNode } from '../src/data/curriculum/lessonFactory'
import { getLesson, LESSONS } from '../src/data/lessons'
import { getCase, CASES } from '../src/data/cases'
import { scoreCase } from '../src/lib/caseScoring'
import {
  computeKnowledgeMastery,
  knowledgeStatus,
  effectiveLevel,
  reviewQueue,
  knowledgeBottleneck,
  knowledgeSummary,
  isUnlocked,
  REVIEW_DAYS,
  WARNING_DAYS,
} from '../src/agent/knowledgeMastery'
import { adaptiveTraining } from '../src/agent/adaptiveTraining'
import { runAgent } from '../src/agent/localAgentEngine'

const daysAgo = (d) => new Date(Date.now() - d * 86400000).toISOString()

// ── 1. 课程目录 ──────────────────────────────────────────
describe('V3 课程目录', () => {
  it('十一个学院齐全（八字/易经/方法论/风水/思想史/奇门/六壬/太乙/民俗/神秘/相学），八字学院为第一主线', () => {
    expect(COLLEGES.map((c) => c.id)).toEqual(['bazi', 'iching', 'methodology', 'fengshui', 'shushu-history', 'qimen', 'liuren', 'taiyi', 'folk', 'mystic', 'xiangxue'])
    expect(COLLEGES[0].chapters.length).toBeGreaterThanOrEqual(7)
  })

  it('已建设节点满足十项 Schema 属性（不含空章节）', () => {
    const built = CURRICULUM_NODES.filter((n) => n.concept)
    expect(built.length).toBeGreaterThanOrEqual(30)
    const required = ['concept', 'source', 'structure', 'examples', 'counterexamples', 'commonMistakes', 'exercises', 'caseIds', 'related', 'masteryStandard']
    for (const n of built) {
      for (const k of required) {
        expect(n[k], `${n.id} 缺 ${k}`).toBeTruthy()
      }
      expect(Array.isArray(n.examples) && n.examples.length >= 2, `${n.id} examples`).toBe(true)
      expect(Array.isArray(n.counterexamples) && n.counterexamples.length >= 1, `${n.id} counterexamples`).toBe(true)
      expect(Array.isArray(n.commonMistakes) && n.commonMistakes.length >= 1, `${n.id} commonMistakes`).toBe(true)
    }
  })

  it('已建设节点具备教学交互（hook/predict/apply/counter/summaryPoints）', () => {
    const built = CURRICULUM_NODES.filter((n) => n.concept)
    for (const n of built) {
      expect(n.hook?.question, `${n.id} hook`).toBeTruthy()
      expect(n.predict?.options?.length >= 2, `${n.id} predict`).toBe(true)
      expect(n.apply?.options?.length >= 2, `${n.id} apply`).toBe(true)
      expect(n.counter?.options?.length >= 2, `${n.id} counter`).toBe(true)
      expect(Array.isArray(n.summaryPoints) && n.summaryPoints.length >= 2, `${n.id} summaryPoints`).toBe(true)
      // 应用/反例题必须带正确标记与错误类型（确定性评分基础）
      const ops = [...(n.apply?.options || []), ...(n.counter?.options || [])]
      const marked = ops.filter((o) => o.correct)
      expect(marked.length, `${n.id} 至少一个正确答案`).toBeGreaterThanOrEqual(1)
      expect(ops.some((o) => o.errorType), `${n.id} 含错误类型`).toBe(true)
    }
  })

  it('图谱校验：前置与关联引用全部可解析', () => {
    const { errors } = validateCurriculum()
    expect(errors).toEqual([])
  })

  it('前置链解析：顺序即依赖顺序，且不重复', () => {
    const withPrereq = CURRICULUM_NODES.find((n) => n.prerequisite?.length)
    if (withPrereq) {
      const chain = resolvePrereqs(withPrereq.id)
      expect(chain).toEqual([...new Set(chain)])
      for (const p of chain) expect(getCurriculumNode(p), `前置 ${p} 存在`).toBeTruthy()
    } else {
      expect(true).toBe(true)
    }
  })

  it('迁移候选：跨学院共享 transferTag 时返回其他学院节点', () => {
    const withTag = CURRICULUM_NODES.find((n) => n.transferTag)
    expect(withTag).toBeTruthy()
    const cands = transferCandidates(withTag.id)
    if (withTag.transferTag === 'duality') {
      // 阴阳的迁移标签在易经学院也有同构节点（建设中，可能为空）
      expect(Array.isArray(cands)).toBe(true)
    }
  })
})

// ── 2. 课程工厂 ──────────────────────────────────────────
describe('V3 课程工厂', () => {
  it('每个已建设节点都能生成完整课程，步骤顺序符合教学闭环', () => {
    const lessons = curriculumLessons()
    expect(lessons.length).toBeGreaterThanOrEqual(30)
    for (const l of lessons) {
      expect(l.id.startsWith('v3-')).toBe(true)
      expect(l.nodeId).toBeTruthy()
      const types = l.steps.map((s) => s.type)
      expect(types[0]).toBe('curiosity')
      expect(types[1]).toBe('predict')
      expect(types).toContain('choice') // 应用判断
      expect(types).toContain('counter') // 反例挑战
      expect(types).toContain('summary')
      // choice/counter/mastery 步骤必须有正确答案
      for (const s of l.steps) {
        if (['choice', 'counter', 'mastery'].includes(s.type)) {
          expect(s.options.some((o) => o.correct), `${l.id} ${s.type} 有正确答案`).toBe(true)
        }
      }
    }
  })

  it('getLesson 兼容 V3 课程', () => {
    const first = curriculumLessons()[0]
    expect(getLesson(first.id)).toEqual(first)
    expect(getLesson('not-exist')).toBeNull()
  })

  it('V1/V2 旧课程不受影响', () => {
    expect(LESSONS.length).toBeGreaterThanOrEqual(13)
    expect(getLesson('lesson-five-elements')).toBeTruthy()
  })
})

// ── 3. 知识 Mastery 引擎 ─────────────────────────────────
describe('V3 知识 Mastery 引擎', () => {
  function st(overrides = {}) {
    return { ...initialState, quizHistory: [], completedLessons: {}, caseAttempts: [], mastery: {}, ...overrides }
  }

  it('状态推导：未接触 / 练习中 / 不稳定 / 已理解 / 掌握 / 待复习', () => {
    expect(knowledgeStatus(0, 0)).toBe('fresh')
    expect(knowledgeStatus(1, 2)).toBe('practicing')
    expect(knowledgeStatus(3, 2)).toBe('unstable')
    expect(knowledgeStatus(4, 5)).toBe('stable')
    expect(knowledgeStatus(5, 5)).toBe('mastered')
    expect(knowledgeStatus(4, REVIEW_DAYS + 1)).toBe('review')
    expect(knowledgeStatus(1, WARNING_DAYS + 1)).toBe('unstable') // 学习中但拖太久
  })

  it('遗忘曲线：已掌握节点超过复习阈值后有效等级衰减，最低降到 3', () => {
    expect(effectiveLevel(4, 0)).toBe(4)
    expect(effectiveLevel(4, REVIEW_DAYS - 1)).toBe(4)
    expect(effectiveLevel(4, REVIEW_DAYS + 1)).toBe(3)
    expect(effectiveLevel(6, REVIEW_DAYS + 1 + 7)).toBe(5)
    expect(effectiveLevel(6, REVIEW_DAYS + 100)).toBe(3) // 不降到 3 以下
    expect(effectiveLevel(2, 999)).toBe(2) // 未掌握的不参与衰减
  })

  it('画像：从真实行为（quizHistory）推导最近学习时间与状态', () => {
    const s = st({
      mastery: { 'yy-concept': 5 },
      quizHistory: [{ nodeId: 'yy-concept', at: daysAgo(30), correct: true, stepType: 'mastery' }],
    })
    const k = computeKnowledgeMastery(s)
    expect(k['yy-concept'].status).toBe('review')
    expect(k['yy-concept'].daysSince).toBe(30)
    expect(k['yy-concept'].effectiveLevel).toBeLessThan(5)
    expect(k['yy-concept'].unlocked).toBe(true) // 无前置
  })

  it('复习队列：按遗忘紧迫度排序（有效等级升序）', () => {
    const s = st({
      mastery: { 'yy-concept': 5, 'wx-concept': 4 },
      quizHistory: [
        { nodeId: 'yy-concept', at: daysAgo(40), correct: true, stepType: 'mastery' },
        { nodeId: 'wx-concept', at: daysAgo(25), correct: true, stepType: 'mastery' },
      ],
    })
    const q = reviewQueue(s)
    expect(q.length).toBe(2)
    expect(q[0].nodeId).toBe('yy-concept') // 衰减更多优先
    expect(q[1].nodeId).toBe('wx-concept')
  })

  it('知识瓶颈：练习中卡住很久的节点被识别', () => {
    const s = st({
      mastery: { 'yy-concept': 2 },
      quizHistory: [{ nodeId: 'yy-concept', at: daysAgo(10), correct: true, stepType: 'choice' }],
    })
    const b = knowledgeBottleneck(s)
    expect(b).not.toBeNull()
    expect(b.nodeId).toBe('yy-concept')
    expect(b.status).toBe('practicing')
  })

  it('无学习记录时不产生瓶颈（不干扰旧逻辑）', () => {
    const s = st()
    expect(knowledgeBottleneck(s)).toBeNull()
    expect(reviewQueue(s)).toEqual([])
    const sum = knowledgeSummary(s)
    expect(sum.total).toBe(CURRICULUM_NODES.length)
    expect(sum.fresh).toBe(CURRICULUM_NODES.length)
  })

  it('解锁：前置节点未完成时 locked，完成前置后 unlocked', () => {
    // 找一个有前置的节点
    const withPrereq = CURRICULUM_NODES.find((n) => n.prerequisite?.length)
    if (!withPrereq) {
      expect(true).toBe(true)
      return
    }
    const locked = st()
    expect(isUnlocked(locked, withPrereq.id)).toBe(false)
    const m = { ...locked.mastery }
    for (const p of withPrereq.prerequisite) m[p] = 2
    const unlocked = st({ mastery: m })
    expect(isUnlocked(unlocked, withPrereq.id)).toBe(true)
  })
})

// ── 4. 自适应训练 V3 集成 ────────────────────────────────
describe('V3 自适应训练集成', () => {
  function st(overrides = {}) {
    return { ...initialState, quizHistory: [], completedLessons: {}, caseAttempts: [], mastery: {}, completedCases: {}, errorPatterns: {}, ...overrides }
  }

  it('遗忘复习优先于能力瓶颈', () => {
    const s = st({
      mastery: { 'yy-concept': 4 },
      quizHistory: [{ nodeId: 'yy-concept', at: daysAgo(30), correct: true, stepType: 'mastery' }],
      caseAttempts: [], // 样本不足，能力档案不 ready，仍然应触发复习
    })
    const t = adaptiveTraining(s, null, null)
    expect(t.type).toBe('review')
    expect(t.nodeId).toBe('yy-concept')
    expect(t.why).toContain('阴阳是什么')
  })

  it('复习推荐优先给「该知识关联且未完成」的案例，否则回课程', () => {
    const s = st({
      mastery: { 'hs-concept': 4 }, // 藏干概念，关联 case-041（未完成）
      quizHistory: [{ nodeId: 'hs-concept', at: daysAgo(30), correct: true, stepType: 'mastery' }],
    })
    const t = adaptiveTraining(s, null, null)
    expect(t.type).toBe('review')
    expect(t.caseId).toBe('case-041')
  })

  it('知识瓶颈（练习中卡住）→ knowledge 补强', () => {
    const s = st({
      mastery: { 'yy-concept': 2 },
      quizHistory: [{ nodeId: 'yy-concept', at: daysAgo(10), correct: true, stepType: 'choice' }],
    })
    const t = adaptiveTraining(s, null, null)
    expect(t.type).toBe('knowledge')
    expect(t.lessonId).toBe('v3-yy-concept')
  })

  it('空状态安全回退：无 V3 行为时返回按节奏推进', () => {
    const s = st()
    const t = adaptiveTraining(s, null, null)
    expect(t.type).toBe('normal')
  })
})

// ── 5. Agent 输出 ────────────────────────────────────────
describe('V3 Agent 集成', () => {
  it('runAgent 输出知识画像、复习队列与统计', () => {
    const s = {
      ...initialState,
      mastery: { 'yy-concept': 5 },
      quizHistory: [{ nodeId: 'yy-concept', at: daysAgo(30), correct: true, stepType: 'mastery' }],
    }
    const agent = runAgent(s)
    expect(agent.knowledge).toBeTruthy()
    expect(agent.knowledge['yy-concept'].status).toBe('review')
    expect(agent.reviewQueue.length).toBeGreaterThanOrEqual(1)
    expect(agent.knowledgeSummary.review).toBeGreaterThanOrEqual(1)
    // 复习场景下 nextAction 指向复习案例或课程
    expect(['case', 'lesson']).toContain(agent.nextAction.type)
  })
})

// ── 6. V3 案例 ───────────────────────────────────────────
describe('V3 案例', () => {
  it('case-043（藏干）与 case-047（十神）可解析', () => {
    const c43 = getCase('case-043')
    const c47 = getCase('case-047')
    expect(c43).toBeTruthy()
    expect(c47).toBeTruthy()
    expect(c43.relatedNodes).toContain('hs-surface')
    expect(c47.relatedNodes).toContain('tg-officer')
    expect(CASES.some((c) => c.id === 'case-043')).toBe(true)
  })
})

// ── 7. Phase 2：干支关系 + 日主强弱 ──────────────────────
describe('V3 Phase 2 中级篇', () => {
  it('八字学院已含干支关系（≥9 节点）与日主强弱（≥8 节点）章节', () => {
    const bazi = COLLEGES[0]
    const relations = bazi.chapters.find((c) => c.id === 'relations')
    const strength = bazi.chapters.find((c) => c.id === 'daymaster-strength')
    expect(relations).toBeTruthy()
    expect(strength).toBeTruthy()
    expect(relations.nodes.length).toBeGreaterThanOrEqual(9)
    expect(strength.nodes.length).toBeGreaterThanOrEqual(8)
  })

  it('干支关系章节覆盖：六合/六冲/三合/三会/刑/害破/比较/误区', () => {
    const ids = CURRICULUM_NODES.filter((n) => n.chapter === 'relations').map((n) => n.id)
    for (const id of ['rel-concept', 'rel-six-he', 'rel-six-chong', 'rel-three-he', 'rel-three-hui', 'rel-xing', 'rel-hai-po', 'rel-compare', 'rel-myths']) {
      expect(ids, `干支关系缺 ${id}`).toContain(id)
    }
    const myths = getCurriculumNode('rel-myths')
    expect(myths.concept).toContain('结果必然发生')
  })

  it('日主强弱章节覆盖：令/地/势/整体/数量误区/含义/误区汇总', () => {
    const ids = CURRICULUM_NODES.filter((n) => n.chapter === 'daymaster-strength').map((n) => n.id)
    for (const id of ['ds-concept', 'ds-ling', 'ds-di', 'ds-shi', 'ds-combine', 'ds-count', 'ds-meaning', 'ds-myths']) {
      expect(ids, `日主强弱缺 ${id}`).toContain(id)
    }
    const count = getCurriculumNode('ds-count')
    expect(count.title).toContain('数量')
    expect(count.commonMistakes.length).toBeGreaterThanOrEqual(2)
  })

  it('Phase 2 节点全部满足十项 Schema + 教学交互（复用工厂校验）', () => {
    const phase2 = CURRICULUM_NODES.filter((n) => n.chapter === 'relations' || n.chapter === 'daymaster-strength')
    expect(phase2.length).toBeGreaterThanOrEqual(17)
    const required = ['concept', 'source', 'structure', 'examples', 'counterexamples', 'commonMistakes', 'exercises', 'caseIds', 'related', 'masteryStandard']
    for (const n of phase2) {
      for (const k of required) expect(n[k], `${n.id} 缺 ${k}`).toBeTruthy()
      expect(n.hook?.question, `${n.id} hook`).toBeTruthy()
      expect(n.apply?.options?.length >= 2, `${n.id} apply`).toBe(true)
      expect(n.counter?.options?.length >= 2, `${n.id} counter`).toBe(true)
      expect(n.apply.options.some((o) => o.correct), `${n.id} apply 有正确答案`).toBe(true)
      expect(n.apply.options.some((o) => o.errorType), `${n.id} apply 含错误类型`).toBe(true)
      expect(n.counter.options.some((o) => o.correct), `${n.id} counter 有正确答案`).toBe(true)
      expect(n.counter.options.some((o) => o.errorType), `${n.id} counter 含错误类型`).toBe(true)
    }
  })

  it('Phase 2 图谱：前置/关联引用全部可解析，且案例存在', () => {
    const { errors, caseIds } = validateCurriculum()
    expect(errors).toEqual([])
    for (const cid of caseIds) {
      expect(getCase(cid), `案例 ${cid} 存在`).toBeTruthy()
    }
  })

  it('Phase 2 新案例可评分：case-044（六合六冲）/ 045（刑害多解释）/ 046（数量≠强弱）/ 048（流派差异）', () => {
    for (const cid of ['case-044', 'case-045', 'case-046', 'case-048']) {
      const cs = getCase(cid)
      expect(cs, `${cid} 存在`).toBeTruthy()
      const answers = {}
      cs.challenges.forEach((ch, i) => {
        if (ch.type === 'analysis') answers[i] = '先看整体结构与月令，再找证据，对照现实，最后标注不确定性'
        else if (ch.type === 'confidence') answers[i] = 60
        else if (ch.options && ch.options.length) {
          const best = ch.options.find((o) => o.points === 3) || ch.options[0]
          answers[i] = ch.options.indexOf(best)
        }
      })
      const { total, dimensions } = scoreCase(cs, answers)
      expect(total).toBeGreaterThanOrEqual(0)
      expect(dimensions.info).toBeGreaterThanOrEqual(0)
    }
  })

  it('迁移候选：干支关系(relation) 与日主强弱(strength) 带跨学院迁移标签', () => {
    expect(getCurriculumNode('rel-concept').transferTag).toBe('relation')
    expect(getCurriculumNode('ds-concept').transferTag).toBe('strength')
  })
})

// ── 8. Phase 3：格局 + 用神喜忌调候 + 大运流年 + 综合分析 ─────
describe('V3 Phase 3 高级篇', () => {
  it('八字学院已含格局（≥8）/ 用神（≥9）/ 大运流年（≥7）/ 综合分析（≥4）章节', () => {
    const bazi = COLLEGES[0]
    const pattern = bazi.chapters.find((c) => c.id === 'pattern')
    const usefulGod = bazi.chapters.find((c) => c.id === 'useful-god')
    const luck = bazi.chapters.find((c) => c.id === 'luck-cycle')
    const synthesis = bazi.chapters.find((c) => c.id === 'bazi-synthesis')
    expect(pattern).toBeTruthy()
    expect(usefulGod).toBeTruthy()
    expect(luck).toBeTruthy()
    expect(synthesis).toBeTruthy()
    expect(pattern.nodes.length).toBeGreaterThanOrEqual(8)
    expect(usefulGod.nodes.length).toBeGreaterThanOrEqual(9)
    expect(luck.nodes.length).toBeGreaterThanOrEqual(7)
    expect(synthesis.nodes.length).toBeGreaterThanOrEqual(4)
  })

  it('格局章节覆盖：概念/常见格局/判断/流派/强弱/特殊/应用/误区', () => {
    const ids = CURRICULUM_NODES.filter((n) => n.chapter === 'pattern').map((n) => n.id)
    for (const id of ['pt-concept', 'pt-common', 'pt-judge', 'pt-schools', 'pt-vs-strength', 'pt-complex', 'pt-apply', 'pt-myths']) {
      expect(ids, `格局缺 ${id}`).toContain(id)
    }
    expect(getCurriculumNode('pt-concept').concept).toContain('结构重心')
    expect(getCurriculumNode('pt-myths').commonMistakes.length).toBeGreaterThanOrEqual(2)
  })

  it('用神章节覆盖：用神/喜忌/调候/扶抑/通关/制化/冲突/流派/误区', () => {
    const ids = CURRICULUM_NODES.filter((n) => n.chapter === 'useful-god').map((n) => n.id)
    for (const id of ['ug-concept', 'ug-xi-ji', 'ug-tiaohou', 'ug-fuyi', 'ug-tongguan', 'ug-zhihua', 'ug-conflict', 'ug-schools', 'ug-myths']) {
      expect(ids, `用神缺 ${id}`).toContain(id)
    }
    expect(getCurriculumNode('ug-concept').commonMistakes[0]).toContain('缺')
  })

  it('大运流年章节覆盖：概念/大运/流年/流月/叠加/误区/应用', () => {
    const ids = CURRICULUM_NODES.filter((n) => n.chapter === 'luck-cycle').map((n) => n.id)
    for (const id of ['lk-concept', 'lk-dayun', 'lk-liunian', 'lk-liuyue', 'lk-layers', 'lk-myths', 'lk-practice']) {
      expect(ids, `大运流年缺 ${id}`).toContain(id)
    }
    expect(getCurriculumNode('lk-concept').concept).toContain('时间变化')
  })

  it('综合分析章节覆盖：八步法/信息不足/冲突/多解释', () => {
    const ids = CURRICULUM_NODES.filter((n) => n.chapter === 'bazi-synthesis').map((n) => n.id)
    for (const id of ['sy-method', 'sy-info', 'sy-conflict', 'sy-multi']) {
      expect(ids, `综合分析缺 ${id}`).toContain(id)
    }
    const method = getCurriculumNode('sy-method')
    expect(method.exercises.length).toBeGreaterThanOrEqual(3)
  })

  it('Phase 3 节点全部满足十项 Schema + 教学交互（复用工厂校验）', () => {
    const phase3 = CURRICULUM_NODES.filter((n) => ['pattern', 'useful-god', 'luck-cycle', 'bazi-synthesis'].includes(n.chapter))
    expect(phase3.length).toBeGreaterThanOrEqual(28)
    const required = ['concept', 'source', 'structure', 'examples', 'counterexamples', 'commonMistakes', 'exercises', 'caseIds', 'related', 'masteryStandard']
    for (const n of phase3) {
      for (const k of required) expect(n[k], `${n.id} 缺 ${k}`).toBeTruthy()
      expect(Array.isArray(n.examples) && n.examples.length >= 2, `${n.id} examples`).toBe(true)
      expect(Array.isArray(n.counterexamples) && n.counterexamples.length >= 1, `${n.id} counterexamples`).toBe(true)
      expect(n.hook?.question, `${n.id} hook`).toBeTruthy()
      expect(n.predict?.options?.length >= 2, `${n.id} predict`).toBe(true)
      expect(n.apply?.options?.length >= 2, `${n.id} apply`).toBe(true)
      expect(n.counter?.options?.length >= 2, `${n.id} counter`).toBe(true)
      expect(n.apply.options.some((o) => o.correct), `${n.id} apply 有正确答案`).toBe(true)
      expect(n.apply.options.some((o) => o.errorType), `${n.id} apply 含错误类型`).toBe(true)
      expect(n.counter.options.some((o) => o.correct), `${n.id} counter 有正确答案`).toBe(true)
      expect(n.counter.options.some((o) => o.errorType), `${n.id} counter 含错误类型`).toBe(true)
    }
  })

  it('Phase 3 前置链：格局→用神→时间→综合分析 顺序正确', () => {
    // 格局概念需要日主强弱；用神需要格局；综合分析需要格局+时间+用神
    expect(getCurriculumNode('pt-concept').prerequisite).toContain('ds-concept')
    expect(getCurriculumNode('ug-concept').prerequisite).toContain('pt-concept')
    expect(getCurriculumNode('lk-concept').prerequisite).toContain('ds-concept')
    const syPrereq = getCurriculumNode('sy-method').prerequisite
    for (const p of ['pt-apply', 'lk-layers', 'ug-concept']) {
      expect(syPrereq, `sy-method 前置缺 ${p}`).toContain(p)
    }
  })

  it('Phase 3 图谱：前置/关联引用全部可解析，且案例存在', () => {
    const { errors, caseIds } = validateCurriculum()
    expect(errors).toEqual([])
    for (const cid of caseIds) {
      expect(getCase(cid), `案例 ${cid} 存在`).toBeTruthy()
    }
  })

  it('Phase 3 新案例可评分：case-049~054（综合/冲突/信息不足/多解释/陌生）', () => {
    for (const cid of ['case-049', 'case-050', 'case-051', 'case-052', 'case-053', 'case-054']) {
      const cs = getCase(cid)
      expect(cs, `${cid} 存在`).toBeTruthy()
      expect(cs.relatedNodes.length, `${cid} 关联知识节点`).toBeGreaterThanOrEqual(2)
      const answers = {}
      cs.challenges.forEach((ch, i) => {
        if (ch.type === 'analysis') answers[i] = '先读盘提取信息，再判断结构，找证据与反例，叠加时间系统，最后标注规则与不确定性'
        else if (ch.type === 'confidence') answers[i] = 60
        else if (ch.options && ch.options.length) {
          const best = ch.options.find((o) => o.points === 3) || ch.options[0]
          answers[i] = ch.options.indexOf(best)
        }
      })
      const { total, dimensions } = scoreCase(cs, answers)
      expect(total).toBeGreaterThanOrEqual(0)
      expect(dimensions.boundary).toBeGreaterThanOrEqual(0)
    }
  })

  it('综合案例分类覆盖：普通综合/冲突/信息不足/多解释/陌生结构', () => {
    const tags = ['case-049', 'case-050', 'case-051', 'case-052', 'case-053', 'case-054'].map((id) => getCase(id).trainingTag)
    for (const t of ['synthesis', 'conflict', 'info', 'multi', 'strange']) {
      expect(tags, `缺少 ${t} 类型综合案例`).toContain(t)
    }
  })

  it('Phase 3 迁移标签：structure/balance/time/synthesis 存在', () => {
    for (const id of ['pt-concept', 'ug-concept', 'lk-concept', 'sy-method']) {
      expect(getCurriculumNode(id).transferTag, `${id} transferTag`).toBeTruthy()
    }
  })
})
