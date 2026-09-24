// ============================================================
// 🏛️ 太乙神数学院（Phase 6 建设）
// 学习路径：太乙之源（历史与传统）→ 太乙的结构（九宫与式盘）
//          → 太乙起局（传统与差异）→ 太乙判断（语境与边界）
// 定位：三式之一的太乙，以历史与文献研究为主，理解传统而非立刻应用。
// 内容纪律：传本稀少、版本与流派差异大，任何结论必须标注，不制造统一标准。
// ============================================================

import { TAIYI_HISTORY_CHAPTER } from './taiyi-history'
import { TAIYI_STRUCTURE_CHAPTER } from './taiyi-structure'
import { TAIYI_LAYOUT_CHAPTER } from './taiyi-layout'
import { TAIYI_JUDGE_CHAPTER } from './taiyi-judge'

export const TAIYI_COLLEGE = {
  id: 'taiyi',
  title: '太乙神数学院',
  emoji: '🏛️',
  tagline: '三式之一的太乙：历史、结构与传统。',
  chapters: [
    TAIYI_HISTORY_CHAPTER,
    TAIYI_STRUCTURE_CHAPTER,
    TAIYI_LAYOUT_CHAPTER,
    TAIYI_JUDGE_CHAPTER,
  ],
}
