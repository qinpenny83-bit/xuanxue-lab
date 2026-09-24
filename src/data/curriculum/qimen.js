// ============================================================
// 🧭 奇门遁甲学院（V3 新学院）
// 学习路径：奇门之基 → 奇门之构 → 奇门之局 → 奇门之断 →
//           奇门之用 → 奇门之阶
// 从「九宫八门」到读懂一个完整奇门盘。
// 全学院语言：现代学术实验室风格，强调「传统说法/流派观点」，
// 不编造古籍原文，不把传统解释当事实断言。
// ============================================================

import { QIMEN_BASIC_CHAPTER } from './qimen-basic'
import { QIMEN_STRUCTURE_CHAPTER } from './qimen-structure'
import { QIMEN_LAYOUT_CHAPTER } from './qimen-layout'
import { QIMEN_JUDGE_CHAPTER } from './qimen-judge'
import { QIMEN_APPLY_CHAPTER } from './qimen-apply'
import { QIMEN_ADVANCED_CHAPTER } from './qimen-advanced'

export const QIMEN_COLLEGE = {
  id: 'qimen',
  title: '奇门遁甲学院',
  emoji: '🧭',
  tagline: '从九宫八门到读懂一个完整奇门盘。',
  chapters: [
    QIMEN_BASIC_CHAPTER,
    QIMEN_STRUCTURE_CHAPTER,
    QIMEN_LAYOUT_CHAPTER,
    QIMEN_JUDGE_CHAPTER,
    QIMEN_APPLY_CHAPTER,
    QIMEN_ADVANCED_CHAPTER,
  ],
}
