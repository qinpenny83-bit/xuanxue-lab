// ============================================================
// 🌀 大六壬学院（Phase 7 建设）
// 学习路径：壬式之基 → 课式之构 → 神将六亲 → 课中符号 → 断课入门
// 从「天地盘」到看懂一个完整课例。
// ============================================================

import { LIUREN_ORIGIN_CHAPTER } from './liuren-origin'
import { LIUREN_CORE_CHAPTER } from './liuren-core'
import { LIUREN_SHENJIANG_CHAPTER } from './liuren-shenjiang'
import { LIUREN_SPECIAL_CHAPTER } from './liuren-special'
import { LIUREN_JUDGE_CHAPTER } from './liuren-judge'

export const LIUREN_COLLEGE = {
  id: 'liuren',
  title: '大六壬学院',
  emoji: '🌀',
  tagline: '从天地盘到看懂一个完整课例。',
  chapters: [
    LIUREN_ORIGIN_CHAPTER,
    LIUREN_CORE_CHAPTER,
    LIUREN_SHENJIANG_CHAPTER,
    LIUREN_SPECIAL_CHAPTER,
    LIUREN_JUDGE_CHAPTER,
  ],
}
