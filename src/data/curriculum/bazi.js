// ============================================================
// 🏯 八字学院（V3 第一主线）
// 学习路径：基础 → 理解 → 单项分析 → 综合分析 → 高阶案例 → 独立研究
// 章节建设进度：
//   基础篇（Phase 2 已完成前六章）：阴阳/五行/干支/十神/藏干/十二长生
//   中级篇（Phase 2 已完成）：干支关系（9 节点）/日主强弱（8 节点）
//   高级篇（Phase 3 已完成）：格局（8 节点）/用神喜忌调候（9 节点）
//                         大运流年流月（7 节点）/综合分析（4 节点）
// 未建设章节 nodes 为空数组，Map 显示「建设中」，避免注水。
// ============================================================

import { BAZI_BASIC_CHAPTERS } from './bazi-basic'
import { RELATIONS_CHAPTER } from './bazi-relations'
import { STRENGTH_CHAPTER } from './bazi-strength'
import { PATTERN_CHAPTER } from './bazi-pattern'
import { USEFUL_GOD_CHAPTER } from './bazi-usefulgod'
import { LUCK_CYCLE_CHAPTER } from './bazi-luck'
import { SYNTHESIS_CHAPTER } from './bazi-synthesis'

export const BAZI_COLLEGE = {
  id: 'bazi',
  title: '八字学院',
  emoji: '🏯',
  tagline: '从「阴阳」到「看懂一个八字结构」，再到综合分析与独立研究。',
  chapters: [
    ...BAZI_BASIC_CHAPTERS,
    RELATIONS_CHAPTER,
    STRENGTH_CHAPTER,
    PATTERN_CHAPTER,
    USEFUL_GOD_CHAPTER,
    LUCK_CYCLE_CHAPTER,
    SYNTHESIS_CHAPTER,
  ],
}
