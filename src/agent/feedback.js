// ============================================================
// 反馈引擎：把「对了/错了」变成结构化的导师式反馈，
// 而不是一句廉价的对错提示。
// ============================================================

import { ERROR_TYPES } from './errors'
import { DIMENSION_LABELS } from '../lib/caseScoring'

// 课堂步骤反馈
export function composeStepFeedback(step, option) {
  if (option.correct) {
    return {
      tone: 'good',
      title: '✓ 你做对了',
      detail: option.feedback || step.explain || '你的选择符合正确的推理方向。',
      errorType: null,
      remember: step.remember || null,
    }
  }
  return {
    tone: 'warn',
    title: '⚠️ 你容易犯的错误',
    detail: option.feedback || step.explain || '这里有一个思维偏差，值得停下来想一想。',
    errorType: option.errorType || null,
    remember: step.remember || null,
    errorName: option.errorType ? ERROR_TYPES[option.errorType]?.name : null,
  }
}

// 案例完成后的个性化反馈
export function composeCaseFeedback(result) {
  const weakest = Object.entries(result.dimensions).sort((a, b) => a[1] - b[1])[0]
  const [key, val] = weakest
  const label = DIMENSION_LABELS[key] || key
  let advice = '你现在最大的问题不是不会看，而是需要更完整地走完「观察 → 分析 → 结论」的过程。'
  if (val < 50) {
    advice = `你现在最大的问题是「${label}」偏弱（${val}），建议回到地图重点练习相关的知识点。`
  } else if (val < 75) {
    advice = `整体不错，但「${label}」还有明显提升空间（${val}），针对性地练一练。`
  } else {
    advice = `各项能力都比较稳健，「${label}」稍微突出一点，继续挑战更高难度的案例吧。`
  }
  return { weakest: label, weakestValue: val, advice, biggestIssue: result.biggestIssue }
}

// 成长页 / 首页的一句总评
export function composeAgentFeedback(state) {
  const errors = state.errorPatterns || {}
  const totalErrors = Object.values(errors).reduce((a, b) => a + b, 0)
  const mastered = Object.values(state.mastery || {}).filter((v) => v >= 4).length
  if (mastered === 0) {
    return '你还在起步阶段。别急着「算」，先完成第一节课，把手感建立起来。'
  }
  if (totalErrors > 0 && Object.keys(errors).length >= 2) {
    const top = Object.entries(errors).sort((a, b) => b[1] - a[1])[0]
    return `你最容易出现的模式是「${ERROR_TYPES[top[0]]?.name}」。建议做一次针对性训练，把它磨掉。`
  }
  if (mastered >= 3) {
    return `你已经掌握了 ${mastered} 个核心概念，可以开始更完整地推理案例、并把判断带进现实。`
  }
  return '基础在稳步建立。继续保持「先结构、后结论」的节奏。'
}