// ============================================================
// 🏭 课程工厂（V3）：知识节点 → 八段闭环微课程
// 装配闭环：①好奇 → ②预测 → ③概念学习 → ④应用判断 → ⑤反例挑战
//          → ⑥总结 → ⑦微实验 → ⑧掌握确认
// 与 V1.5 Lesson.jsx 的步骤类型完全兼容，纯确定性装配。
// ============================================================

import { getCurriculumNode, CURRICULUM_NODES } from './index'

export const V3_LESSON_PREFIX = 'v3-'

// 由节点生成课程 id（确定性）
export function lessonIdForNode(nodeId) {
  return `${V3_LESSON_PREFIX}${nodeId}`
}

// 节点 → 课程（若节点缺少教学交互字段，则只生成该节点具备的步骤，不注水）
export function curriculumLesson(nodeId) {
  const n = getCurriculumNode(nodeId)
  if (!n) return null
  const steps = []

  if (n.hook) {
    steps.push({ type: 'curiosity', question: n.hook.question, tease: n.hook.tease })
  }
  if (n.predict) {
    steps.push({
      type: 'predict',
      prompt: n.predict.prompt,
      options: n.predict.options.map((o) => ({ text: o.text })),
      reveal: n.predict.reveal,
      remember: n.predict.remember,
    })
  }
  if (n.concept || n.source) {
    steps.push({
      type: 'info',
      title: n.concept ? `${n.title}：核心概念` : n.title,
      body: n.concept || '',
      highlight: n.source ? `📜 ${n.source}` : undefined,
      tip: n.structure ? n.structure : undefined,
    })
  }
  if (n.apply) {
    steps.push({ type: 'choice', prompt: n.apply.prompt, options: n.apply.options, explain: n.apply.explain })
  }
  // R7 变式题：同一知识点的应用变式（更精准检验掌握），紧随原题之后
  if (n.applyB) {
    steps.push({ type: 'choice', prompt: n.applyB.prompt, options: n.applyB.options, explain: n.applyB.explain, variant: true })
  }
  if (n.counter) {
    steps.push({ type: 'counter', prompt: n.counter.prompt, options: n.counter.options, explain: n.counter.explain })
  }
  if (n.counterB) {
    steps.push({ type: 'counter', prompt: n.counterB.prompt, options: n.counterB.options, explain: n.counterB.explain, variant: true })
  }
  if (n.summaryPoints && n.summaryPoints.length) {
    steps.push({ type: 'summary', title: '这一节，真正该记住的', points: n.summaryPoints, remember: n.remember })
  }
  if (n.microExperiment) {
    steps.push({
      type: 'microexperiment',
      title: n.microExperiment.title,
      text: n.microExperiment.text,
      experimentId: n.microExperiment.experimentId,
    })
  }
  if (n.masteryCheck) {
    steps.push({ type: 'mastery', prompt: n.masteryCheck.prompt, options: n.masteryCheck.options, explain: n.masteryCheck.explain })
  }

  return {
    id: lessonIdForNode(nodeId),
    nodeId,
    title: n.title,
    subtitle: n.masteryStandard || '',
    emoji: n.emoji || '📘',
    minutes: Math.max(4, Math.round(steps.length * 1.2)),
    difficulty: n.level || 1,
    college: n.college,
    chapter: n.chapter,
    hook: n.hook,
    steps,
  }
}

// 全部 V3 课程（仅包含有步骤的节点）
export function curriculumLessons() {
  const out = []
  for (const n of CURRICULUM_NODES) {
    const l = curriculumLesson(n.id)
    if (l && l.steps.length) out.push(l)
  }
  return out
}
