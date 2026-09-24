// ============================================================
// R7 · 求学之路·六段主线 验收
//
// 验收点：
//   A. 六段结构完整：6 段、每段 >= 8 个核心节点、节点 ID 全部有效
//   B. 核心节点无重复、覆盖 >= 6 个学院（方法论/八字/易经必在）
//   C. 难度逐段上升：后段核心节点平均 level >= 前段
//   D. 进度计算：done 判定（mastery>=4 或 lesson 完成）正确
//   E. 阶段测验确定性：同段两次生成题完全一致；判定阈值 4/5
//   F. 软引导：未结业不影响节点可访问性（无硬锁字段）
//   G. 持久化：RECORD_PATH_QUIZ 写入 pathQuizzes 并产生 Evidence
//   H. Agent 联动：legacy 课程推荐优先当前段核心节点
// ============================================================
import { describe, it, expect } from 'vitest'
import { PATH_STAGES, stageOfNode, ALL_CORE_IDS, getStage } from '../src/data/pathStages'
import { CURRICULUM_NODES, getCurriculumNode } from '../src/data/curriculum'
import {
  stageProgress, currentStage, pathSummary, nextCoreNode, nodeDone, stageQuiz, checkStageQuiz,
} from '../src/agent/pathEngine'
import { initialState } from '../src/lib/storage'
import { reducer } from '../src/store/reducer'
import { runAgent } from '../src/agent/localAgentEngine'
import { createEvidence } from '../src/agent/learningEvidence'

describe('R7 · 六段主线结构', () => {
  it('6 段、顺序、每段 >= 8 个核心节点', () => {
    expect(PATH_STAGES.length).toBe(6)
    expect(PATH_STAGES.map((s) => s.key)).toEqual(['s1', 's2', 's3', 's4', 's5', 's6'])
    for (const s of PATH_STAGES) {
      expect(s.coreNodeIds.length, `${s.key} 核心节点数`).toBeGreaterThanOrEqual(8)
    }
  })

  it('核心节点 ID 全部有效，且无重复', () => {
    const ids = new Set(CURRICULUM_NODES.map((n) => n.id))
    for (const id of ALL_CORE_IDS) {
      expect(ids.has(id), `${id} 必须是现有节点`).toBe(true)
    }
    expect(new Set(ALL_CORE_IDS).size).toBe(ALL_CORE_IDS.length)
  })

  it('覆盖至少 6 个学院；方法论/八字/易经必在', () => {
    const colleges = new Set()
    for (const id of ALL_CORE_IDS) {
      const n = getCurriculumNode(id)
      if (n) colleges.add(n.college)
    }
    expect(colleges.size).toBeGreaterThanOrEqual(6)
    for (const c of ['methodology', 'bazi', 'iching']) {
      expect(colleges.has(c), `${c} 必须被主线覆盖`).toBe(true)
    }
  })

  it('难度逐段上升（后段平均 level >= 前段平均 level）', () => {
    const avgLevel = (s) => {
      const ls = s.coreNodeIds.map((id) => getCurriculumNode(id)?.level ?? 0)
      return ls.reduce((a, b) => a + b, 0) / ls.length
    }
    for (let i = 1; i < PATH_STAGES.length; i++) {
      expect(avgLevel(PATH_STAGES[i])).toBeGreaterThanOrEqual(avgLevel(PATH_STAGES[i - 1]))
    }
  })

  it('stageOfNode 反查正确；非核心节点返回 null', () => {
    expect(stageOfNode('obs-fact')).toBe('s1')
    expect(stageOfNode('sy-method')).toBe('s6')
    expect(stageOfNode('not-exist')).toBeNull()
    const nonCore = CURRICULUM_NODES.find((n) => !ALL_CORE_IDS.includes(n.id))
    expect(stageOfNode(nonCore.id)).toBeNull()
    expect(getStage('s3').name).toBe('结构识别')
  })
})

describe('R7 · 引擎：进度 / 当前段 / 测验', () => {
  function baseState(over = {}) {
    return { ...initialState, ...over }
  }

  it('空状态：当前段 s1，进度 0，下一节点为 s1 第一个核心节点', () => {
    const s = baseState()
    expect(currentStage(s).key).toBe('s1')
    expect(pathSummary(s).currentKey).toBe('s1')
    expect(stageProgress(s, 's1').done).toBe(0)
    expect(stageProgress(s, 's1').total).toBe(12)
    const next = nextCoreNode(s)
    expect(next.nodeId).toBe('obs-fact')
    expect(next.stageKey).toBe('s1')
  })

  it('nodeDone：mastery>=4 或 lesson 完成均算完成', () => {
    const s1 = baseState({ mastery: { 'obs-fact': 4 } })
    expect(nodeDone(s1, 'obs-fact')).toBe(true)
    const s2 = baseState({ lessonProgress: { 'obs-extract': { status: 'completed' } } })
    expect(nodeDone(s2, 'obs-extract')).toBe(true)
    const s3 = baseState({ mastery: { 'obs-fact': 2 } })
    expect(nodeDone(s3, 'obs-fact')).toBe(false)
  })

  it('阶段测验确定性：同段两次生成完全一致；题目不含 correct 字段', () => {
    const q1 = stageQuiz('s1')
    const q2 = stageQuiz('s1')
    expect(q1).toEqual(q2)
    expect(q1.length).toBe(5)
    expect(q1[0].qId).toBe('obs-fact:applyB')
    for (const q of q1) {
      expect(q.options.some((o) => o.correct !== undefined)).toBe(false)
      expect(q.options.every((o) => typeof o.idx === 'number')).toBe(true)
    }
  })

  it('结业判定：5 题对 4 题通过；对 3 题不通过', () => {
    const quiz = stageQuiz('s1')
    const answers = quiz.map((q, i) => {
      const node = getCurriculumNode(q.nodeId)
      const src = node[q.kind]
      const rightIdx = src.options.findIndex((o) => o.correct)
      return { qId: q.qId, idx: i < 4 ? rightIdx : (rightIdx + 1) % src.options.length }
    })
    const r = checkStageQuiz('s1', answers)
    expect(r.passed).toBe(true)
    // 只对 3 题（后 2 题确定性改错）→ 不通过
    const answersFail = answers.map((a, i) => {
      if (i < 3) return a
      const node = getCurriculumNode(a.qId.split(':')[0])
      const src = node[a.qId.split(':')[1]]
      const rightIdx = src.options.findIndex((o) => o.correct)
      const wrong = src.options.map((_, k) => k).find((k) => k !== rightIdx && k !== a.idx)
      return { qId: a.qId, idx: wrong }
    })
    const r2 = checkStageQuiz('s1', answersFail)
    expect(r2.correct).toBe(3)
    expect(r2.passed).toBe(false)
  })

  it('结业后当前段推进到下一段；软引导（无硬锁字段）', () => {
    const quiz = stageQuiz('s1')
    const answers = quiz.map((q) => {
      const node = getCurriculumNode(q.nodeId)
      const rightIdx = node[q.kind].options.findIndex((o) => o.correct)
      return { qId: q.qId, idx: rightIdx }
    })
    const s = baseState({ pathQuizzes: { s1: { passed: true, score: 100, best: 100, at: '2026-09-21T00:00:00Z' } } })
    expect(currentStage(s).key).toBe('s2')
    expect(nextCoreNode(s).nodeId).toBe('yy-property')
    // 软引导：没有 unlocked 类硬锁字段
    expect(Object.keys(s)).not.toContain('pathLocks')
  })
})

describe('R7 · 持久化：RECORD_PATH_QUIZ', () => {
  it('记录测验结果并写入 pathQuizzes；通过时产生 Evidence(source=path)', () => {
    let s = { ...initialState, evidence: [] }
    s = reducer(s, { type: 'RECORD_PATH_QUIZ', stageKey: 's1', stageName: '认知启蒙', passed: true, score: 80 })
    expect(s.pathQuizzes.s1.passed).toBe(true)
    expect(s.pathQuizzes.s1.score).toBe(80)
    expect(s.pathQuizzes.s1.best).toBe(80)
    const ev = s.evidence[s.evidence.length - 1]
    expect(ev.source).toBe('path')
    expect(ev.action).toBe('pass')
    expect(ev.targetType).toBe('stage')
    expect(ev.targetId).toBe('s1')
  })

  it('重复测验取 best 高分，不覆盖低分', () => {
    let s = { ...initialState, evidence: [] }
    s = reducer(s, { type: 'RECORD_PATH_QUIZ', stageKey: 's1', stageName: '认知启蒙', passed: false, score: 60 })
    s = reducer(s, { type: 'RECORD_PATH_QUIZ', stageKey: 's1', stageName: '认知启蒙', passed: true, score: 80 })
    expect(s.pathQuizzes.s1.best).toBe(80)
    expect(s.pathQuizzes.s1.score).toBe(80)
    expect(s.pathQuizzes.s1.passed).toBe(true)
  })
})

describe('R7 · Agent 联动', () => {
  it('空状态：legacy 推荐指向求学之路第 1 段第一个核心节点（v3-obs-fact）', () => {
    const out = runAgent(initialState)
    expect(out.nextActionSource).toBe('legacy')
    expect(out.nextAction.type).toBe('lesson')
    expect(out.nextAction.nodeId).toBe('obs-fact')
    expect(out.nextAction.pathPriority).toBe(true)
  })

  it('证据推荐路径不受影响（不插入 pathPriority）', () => {
    // 构造 WEAK_EVIDENCE 信号（最近 7 天 ≥3 次 construct、0 次 evidence）→ 证据推荐命中
    const now = Date.now()
    const s = {
      ...initialState,
      evidence: [1, 2, 3].map((i) => createEvidence({
        source: 'workshop',
        action: 'construct',
        targetType: 'hexagram',
        targetId: 1,
        timestamp: now - i * 1000,
      })),
    }
    const out = runAgent(s)
    expect(out.nextActionSource).toBe('evidence')
    expect(out.nextAction.pathPriority).not.toBe(true)
  })
})
