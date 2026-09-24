// ============================================================
// 🧠 玄学方法论学院（V3 第三主线，R6-5 补齐建设）
// 这是整个产品区别于普通玄学网站的部分：
//   如何观察 / 如何推理 / 如何处理不确定性 / 常见认知偏差 / 经典文本
// 5 章 25 节点，全部符合统一 Schema 并接入课程工厂。
// ============================================================

import observeChapter from './methodology-observe'
import reasonChapter from './methodology-reason'
import uncertaintyChapter from './methodology-uncertainty'
import { biasChapterA } from './methodology-bias-1'
import { biasChapterB } from './methodology-bias-2'
import classicsChapter from './methodology-classics'

export const METHODOLOGY_COLLEGE = {
  id: 'methodology',
  title: '方法论学院',
  emoji: '🧠',
  tagline: '不是教更多玄学结论，而是训练「怎么观察、怎么推理、怎么承认不知道」。',
  chapters: [
    { ...observeChapter, nodes: observeChapter.nodes },
    { ...reasonChapter, nodes: reasonChapter.nodes },
    { ...uncertaintyChapter, nodes: uncertaintyChapter.nodes },
    { ...biasChapterA, nodes: [...biasChapterA.nodes, ...biasChapterB.nodes] },
    { ...classicsChapter, nodes: classicsChapter.nodes },
  ],
}

// 兼容导出：若其它模块需要方法论章节明细
export const METHODOLOGY_CHAPTERS = METHODOLOGY_COLLEGE.chapters
