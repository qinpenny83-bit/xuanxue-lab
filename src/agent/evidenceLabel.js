// ============================================================
// Evidence 可读标签（依赖底层知识库）：
//   从 learningEvidence.js 拆出——只有真正渲染标签的页面/引擎
//   才会 import 本模块，避免 hexagramProfile/termData/lessons
//   被 reducer 等壳层静态引用拉进首包。
// ============================================================

import { getHexagramProfile } from '../data/iching/hexagramProfile'
import { getTerm } from '../data/iching/termData'
import { getLesson } from '../data/lessons'
import { getRecentEvidence, summarizeEvidence } from './learningEvidence'

// ── targetId → 可读标签（复用底层知识库，不复制数据）──────────
export function targetLabel(targetType, targetId) {
  try {
    if (targetType === 'hexagram') {
      const p = getHexagramProfile(Number(targetId))
      return p ? `${p.name}卦` : `#${targetId}`
    }
    if (targetType === 'yao') {
      // targetId 形如 `${seq}-${pos}`
      const [seq, pos] = String(targetId).split('-')
      const p = getHexagramProfile(Number(seq))
      if (!p) return `#${targetId}`
      const yao = p.yao[Number(pos)]
      return yao ? `${p.name}·${yao.positionLabel}` : `${p.name}卦`
    }
    if (targetType === 'term') {
      const t = getTerm(targetId)
      return t ? t.term : targetId
    }
    if (targetType === 'question') {
      // questionId 形如 `${lessonId}:s${stepIndex}:v${seed}`（lessonProgress 结构）
      const parts = String(targetId).split(':')
      const lesson = parts[0] ? getLesson(parts[0]) : null
      if (lesson) {
        const stepIndex = Number((parts[1] || '').replace(/^s/, ''))
        const step = Number.isInteger(stepIndex) && lesson.steps ? lesson.steps[stepIndex] : null
        return step ? `${lesson.title} · 第${stepIndex + 1}步` : lesson.title
      }
      return parts[0] || targetId
    }
  } catch {
    /* label 解析失败不影响主流程 */
  }
  return targetId
}

// 把「近 7 天」行为汇总渲染成一段可解释的中文（验收示例同构）。
export function renderRecentSummary(list, opts = {}) {
  const days = opts.days ?? 7
  const recent = getRecentEvidence(list, { days, now: opts.now })
  const sum = summarizeEvidence(recent)

  const lines = []
  const targetLines = sum.recentTargets
    .slice(0, 3)
    .map((t) => targetLabel(t.targetType, t.targetId))
  if (targetLines.length) lines.push(`近期高频对象：${targetLines.join('、')}`)

  const parts = []
  if (sum.workshopActions) parts.push(`分析了 ${sum.workshopActions} 个卦/爻`)
  if (sum.experimentActions) parts.push(`做了 ${sum.experimentActions} 次实验`)
  if (sum.doubtActions) parts.push(`完成 ${sum.doubtActions} 次怀疑训练`)
  if (sum.hypothesisCount) parts.push(`提出 ${sum.hypothesisCount} 个假设`)
  if (sum.counterexampleCount) parts.push(`发现 ${sum.counterexampleCount} 个反例`)
  if (sum.evidenceCheckCount) parts.push(`检查 ${sum.evidenceCheckCount} 次证据`)
  if (sum.revisionCount) parts.push(`修改 ${sum.revisionCount} 次结论`)
  if (parts.length) lines.push(parts.join('，'))

  if (sum.repeatedErrors.length) {
    lines.push(`重复出现 ${sum.repeatedErrors.map((e) => e.code).join('、')}`)
  }
  if (sum.weakBehaviors.length) {
    const labels = { evidence: '证据判断', counterexample: '反例', uncertainty: '不确定性管理' }
    lines.push(`当前明显薄弱：${sum.weakBehaviors.map((b) => labels[b.skill] || b.skill).join('、')}`)
  }
  return lines.length ? lines.join('\n') : '最近还没有留下学习行为记录。'
}
