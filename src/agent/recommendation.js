// ============================================================
// 推荐引擎：根据学习状态推荐「下一步学什么 + 为什么」。
// 思路：先补前提 → 按难度递进 → 优先薄弱点。
// ============================================================

import { KNOWLEDGE_NODES, getNode } from '../data/knowledge'
import { LESSONS } from '../data/lessons'
import { CASES } from '../data/cases'
import { EXPERIMENTS } from '../data/experiments'
import { levelForXp } from '../game/levels'

function masteryOf(state, id) {
  return (state.mastery && state.mastery[id]) || 0
}

export function nextLesson(state) {
  const sorted = [...LESSONS].sort((a, b) => a.difficulty - b.difficulty || a.minutes - b.minutes)
  for (const l of sorted) {
    if (masteryOf(state, l.nodeId) >= 4) continue
    const prereq = getNode(l.nodeId)?.prerequisite
    if (prereq && masteryOf(state, prereq) < 1) {
      const preLesson = LESSONS.find((x) => x.nodeId === prereq)
      return { item: preLesson || l, why: `你还没解锁「${getNode(l.nodeId)?.title}」的前置「${getNode(prereq)?.title}」，先补上它。` }
    }
    return { item: l, why: `「${l.title}」是你当前进度里还没掌握、且难度合适的下一课。` }
  }
  return null
}

export function nextCase(state) {
  const lvl = levelForXp(state.xp).level
  const cap = Math.min(3, Math.max(1, Math.ceil(lvl / 3)))
  const done = state.completedCases || {}
  const candidates = CASES.filter((c) => !done[c.id] && c.difficulty <= cap)
  if (!candidates.length) {
    const any = CASES.filter((c) => !done[c.id])
    return any.length ? { item: any[0], why: '更高难度的案例需要先升级能力，先试一个当前范围内未完成的。' } : null
  }
  candidates.sort((a, b) => b.difficulty - a.difficulty || a.minutes - b.minutes)
  const item = candidates[0]
  return { item, why: `「${item.title}」与你的等级匹配，能练到 ${item.relatedNodes.map((n) => getNode(n)?.title).join('、')}。` }
}

export function nextExperiment(state, force = false) {
  const started = state.experiments || {}
  const pool = EXPERIMENTS.filter((e) => !started[e.id] || !started[e.id].completed)
  if (!pool.length) return null
  // 优先：其知识点已「能解释」（>=2）
  const ready = pool.filter((e) => masteryOf(state, e.nodeId) >= (force ? 0 : 2))
  const item = (ready.length ? ready : pool)[0]
  return { item, why: force ? '现在去现实里试试，学以致用。' : `学完「${getNode(item.nodeId)?.title}」后，用这个实验到现实里验证。` }
}

// 薄弱点复盘：优先「已接触但掌握最低」的节点，或出现错误的节点
export function weakestNode(state) {
  const touched = Object.entries(state.mastery || {}).filter(([, v]) => v > 0 && v < 4)
  if (touched.length) {
    touched.sort((a, b) => a[1] - b[1])
    return { node: getNode(touched[0][0]), level: touched[0][1] }
  }
  return { node: null, level: 0 }
}

export function recommend(state) {
  const lesson = nextLesson(state)
  const cs = nextCase(state)
  const exp = nextExperiment(state)
  const weak = weakestNode(state)
  return { lesson, case: cs, experiment: exp, weakest: weak }
}