// ============================================================
// 🔮 玄学大学 V3 —— 课程目录（Curriculum）
// 三大知识学院 + 综合研究院：
//   🏯 八字学院 / ☯️ 易经学院 / 🧠 方法论学院 / 🎓 综合研究院
//
// 知识节点 Schema（每个节点十项属性 + 教学交互内容）：
//   1  concept        概念
//   2  source         来源 / 传统语境
//   3  structure      结构关系（这个知识点在体系里怎么和其他部分配合）
//   4  examples       例子
//   5  counterexamples 反例
//   6  commonMistakes 常见误区
//   7  exercises      练习（认识/理解/应用/综合/迁移/陌生）
//   8  caseIds        关联案例
//   9  related        关联知识
//   10 masteryStandard 掌握标准
// 教学交互（课程工厂装配成 V1.5 八段闭环，逐节点手写保证质量）：
//   hook { question, tease }     ① 好奇
//   predict { prompt, options }  ② 预测（先猜）
//   apply { prompt, options }    ⑤ 应用判断（应用题）
//   counter { prompt, options }  ⑥ 反例挑战
//   summaryPoints []             ⑦ 总结
//   microExperiment              ⑧ 微实验（可选）
// 其他：
//   level(0-6) 难度 / prerequisite[] 前置 / transferTag 跨学院迁移标签
//   errorTypes[] 该知识常见的错误模式（供错误博物馆与 Agent 使用）
// ============================================================

import { BAZI_COLLEGE } from './bazi'
import { ICHING_COLLEGE } from './iching'
import { METHODOLOGY_COLLEGE } from './methodology'
import { FENGSHUI_COLLEGE } from './fengshui'
import { SHUSHU_HISTORY_COLLEGE } from './shushu-history'
import { QIMEN_COLLEGE } from './qimen'
import { LIUREN_COLLEGE } from './liuren'
import { TAIYI_COLLEGE } from './taiyi'
import { FOLK_COLLEGE } from './folk'
import { MYSTIC_COLLEGE } from './mystic'
import { XIANG_COLLEGE } from './xiangxue'

// 学院定义（顺序即学习顺序）
export const COLLEGES = [
  BAZI_COLLEGE,
  ICHING_COLLEGE,
  METHODOLOGY_COLLEGE,
  FENGSHUI_COLLEGE,
  SHUSHU_HISTORY_COLLEGE,
  QIMEN_COLLEGE,
  LIUREN_COLLEGE,
  TAIYI_COLLEGE,
  FOLK_COLLEGE,
  MYSTIC_COLLEGE,
  XIANG_COLLEGE,
]

// 综合研究院：面向高阶段（L4-L6），由综合案例 + 研究问题组成，不是一门课
export const RESEARCH_INSTITUTE = {
  id: 'research',
  title: '综合研究院',
  emoji: '🎓',
  tagline: '跨知识综合、迁移、独立研究与出师挑战。',
  requireLevel: 4, // 至少能力 L4 才建议进入
  topics: [
    { id: 'synthesis', title: '跨知识综合分析', desc: '天干地支 + 十神 + 藏干 + 关系 + 强弱 + 时间变化，不给提示，自己决定从哪里开始。' },
    { id: 'transfer', title: '迁移挑战', desc: '把在一个学院学到的结构，迁移到另一个学院的陌生案例里。' },
    { id: 'research', title: '研究模式', desc: '给一个问题（如流派差异），阅读资料 → 提取观点 → 比较 → 证据 → 自己的解释 → 指出局限。' },
    { id: 'master', title: '出师挑战', desc: '完全陌生复杂案例，全程不主动提示，完成后生成出师能力报告。' },
  ],
}

// 扁平化全部知识节点
export const CURRICULUM_NODES = COLLEGES.flatMap((c) => c.chapters.flatMap((ch) => ch.nodes))

export const NODE_BY_ID = CURRICULUM_NODES.reduce((acc, n) => {
  acc[n.id] = n
  return acc
}, {})

export function getCurriculumNode(id) {
  return NODE_BY_ID[id] || null
}

// 章节索引（nodeId -> chapter）
export const CHAPTER_OF_NODE = CURRICULUM_NODES.reduce((acc, n) => {
  acc[n.id] = n.chapter
  return acc
}, {})

export function getChapter(id) {
  for (const c of COLLEGES) {
    const ch = c.chapters.find((x) => x.id === id)
    if (ch) return { ...ch, college: c.id }
  }
  return null
}

// 学院内章节顺序
export function collegeOf(nodeId) {
  const n = getCurriculumNode(nodeId)
  return n ? n.college : null
}

// 前置链解析（返回完整前置 id 列表，顺序即依赖顺序）
export function resolvePrereqs(id, acc = []) {
  const n = getCurriculumNode(id)
  if (!n || !n.prerequisite || !n.prerequisite.length) return acc
  for (const p of n.prerequisite) {
    if (!acc.includes(p)) {
      resolvePrereqs(p, acc)
      acc.push(p)
    }
  }
  return acc
}

// 迁移候选：在其他学院中，与本节点共享 transferTag 的节点
// 用于「迁移挑战」：把这里的结构搬到陌生场景
export function transferCandidates(nodeId) {
  const n = getCurriculumNode(nodeId)
  if (!n || !n.transferTag) return []
  return CURRICULUM_NODES.filter(
    (x) => x.college !== n.college && x.transferTag === n.transferTag && x.id !== nodeId
  )
}

// 图谱完整性校验（开发期与测试用）：
// 前置/关联/案例引用必须全部可解析
export function validateCurriculum() {
  const errors = []
  const caseIds = new Set()
  // 收集现有案例 id（通过动态导入不可行，改为由调用方传入 CASES）
  const all = CURRICULUM_NODES
  const ids = new Set(all.map((n) => n.id))
  for (const n of all) {
    for (const p of n.prerequisite || []) if (!ids.has(p)) errors.push(`node ${n.id}: prerequisite ${p} 不存在`)
    for (const r of n.related || []) if (!ids.has(r)) errors.push(`node ${n.id}: related ${r} 不存在`)
    for (const c of n.caseIds || []) caseIds.add(c)
  }
  return { errors, caseIds }
}

// 学习地图上的节点状态标签（由知识掌握状态推导，UI 与 Agent 共用）
export const NODE_STATUS = {
  fresh: { key: 'fresh', label: '🌱 未接触', color: 'var(--text-3)' },
  practicing: { key: 'practicing', label: '📖 练习中', color: 'var(--amber)' },
  unstable: { key: 'unstable', label: '🌊 不稳定', color: 'var(--orange)' },
  stable: { key: 'stable', label: '✅ 已理解', color: 'var(--teal)' },
  mastered: { key: 'mastered', label: '🏆 掌握', color: 'var(--teal-deep)' },
  review: { key: 'review', label: '🔁 长期未复习', color: 'var(--indigo-deep)' },
}
