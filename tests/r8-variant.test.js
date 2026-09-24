// ============================================================
// R7 · 变式题结构验收
// 72 个核心必修节点必须全部具备 applyB + counterB 变式题；
// 每题恰好 4 选项、恰好 1 个 correct:true、干扰项 feedback 非空、
// errorType 取自节点 errorTypes 白名单（或空串）。
// ============================================================
import { describe, it, expect } from 'vitest'
import { ALL_CORE_IDS } from '../src/data/pathStages'
import { getCurriculumNode, CURRICULUM_NODES } from '../src/data/curriculum'
import { stageQuiz } from '../src/agent/pathEngine'

describe('R7 · 核心节点变式题完整性', () => {
  it('72 个核心节点全部具备 applyB 与 counterB', () => {
    const missing = []
    for (const id of ALL_CORE_IDS) {
      const n = getCurriculumNode(id)
      if (!n) { missing.push(`${id}(节点不存在)`); continue }
      if (!n.applyB) missing.push(`${id}(缺applyB)`)
      if (!n.counterB) missing.push(`${id}(缺counterB)`)
    }
    expect(missing, `缺失节点：${missing.join(', ')}`).toEqual([])
  })

  it('每题恰好 4 选项、恰好 1 个 correct:true、干扰项 feedback 非空、explain 非空', () => {
    const problems = []
    for (const id of ALL_CORE_IDS) {
      const n = getCurriculumNode(id)
      for (const kind of ['applyB', 'counterB']) {
        const q = n && n[kind]
        if (!q) { problems.push(`${id}.${kind} 缺失`); continue }
        if (!Array.isArray(q.options) || q.options.length !== 4) { problems.push(`${id}.${kind} 选项数!=4`); continue }
        const correct = q.options.filter((o) => o.correct)
        if (correct.length !== 1) problems.push(`${id}.${kind} correct数!=1`)
        for (const o of q.options) {
          if (!o.correct && (!o.feedback || !o.feedback.trim())) problems.push(`${id}.${kind} 干扰项缺feedback`)
        }
        if (!q.explain || !q.explain.trim()) problems.push(`${id}.${kind} 缺explain`)
        if (correct[0] && !correct[0].feedback) problems.push(`${id}.${kind} 正确项缺feedback`)
      }
    }
    expect(problems, problems.join('\n')).toEqual([])
  })

  it('结业测验优先抽取变式题（第一题 qId 带 applyB）', () => {
    const q1 = stageQuiz('s1')
    expect(q1.length).toBe(5)
    expect(q1[0].qId).toBe('obs-fact:applyB')
  })
})

describe('R9 · 全量题库结构合规', () => {
  it('所有节点的所有题字段结构合法（选项数/正确数/反馈/explain）', () => {
    const problems = []
    for (const n of CURRICULUM_NODES) {
      for (const kind of ['apply', 'applyB', 'counter', 'counterB', 'masteryCheck']) {
        const q = n[kind]
        if (!q) continue
        const expectLen = kind === 'applyB' || kind === 'counterB' ? 4 : null
        if (!Array.isArray(q.options) || !q.options.length) { problems.push(`${n.id}.${kind} 无选项`); continue }
        if (expectLen && q.options.length !== expectLen) { problems.push(`${n.id}.${kind} 选项数=${q.options.length}!=${expectLen}`); continue }
        if (!expectLen && (q.options.length < 3 || q.options.length > 4)) { problems.push(`${n.id}.${kind} 选项数=${q.options.length}`); continue }
        const correct = q.options.filter((o) => o.correct)
        if (correct.length !== 1) problems.push(`${n.id}.${kind} correct数=${correct.length}!=1`)
        for (const o of q.options) {
          if (!o.correct) {
            if (!o.feedback || !o.feedback.trim()) problems.push(`${n.id}.${kind} 干扰项缺feedback`)
            // 变式题的 errorType 必须取自节点白名单（空串表示无标注）
            if ((kind === 'applyB' || kind === 'counterB') && o.errorType && !(n.errorTypes || []).includes(o.errorType)) {
              problems.push(`${n.id}.${kind} errorType=${o.errorType} 不在白名单`)
            }
          }
          if (o.correct && !o.feedback) problems.push(`${n.id}.${kind} 正确项缺feedback`)
        }
        if (!q.explain || !q.explain.trim()) problems.push(`${n.id}.${kind} 缺explain`)
      }
    }
    expect(problems, problems.join('\n')).toEqual([])
  })

  it('不存在残缺变式题（applyB/counterB 只出现一半视为残缺）', () => {
    const problems = []
    for (const n of CURRICULUM_NODES) {
      const hasA = !!n.applyB
      const hasC = !!n.counterB
      if (hasA !== hasC) problems.push(`${n.id} applyB=${hasA} counterB=${hasC} 不对称`)
    }
    expect(problems, problems.join('\n')).toEqual([])
  })
})
