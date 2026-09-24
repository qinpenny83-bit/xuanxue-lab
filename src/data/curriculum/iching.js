// ============================================================
// ☯️ 易经学院（V3 第二主线，Phase 4 建设）
// 学习路径：易学之门 → 阴阳与爻 → 八卦 → 卦象结构 → 六十四卦 →
//           卦辞爻辞 → 变化与关系 → 起卦体系 → 易经推理
// 已建设章节引入独立文件；未建设章节 nodes 为空数组，
// Map 显示「建设中」，避免注水。
// ============================================================

import { ICHING_BASICS_CHAPTER } from './iching-basics'
import { ICHING_YINYANG_CHAPTER } from './iching-yinyang'
import { ICHING_BAGUA_CHAPTER } from './iching-bagua'
import { ICHING_STRUCTURE_CHAPTER } from './iching-structure'
import { ICHING_SIXTYFOUR_CHAPTER } from './iching-sixtyfour'
import { ICHING_TEXT_CHAPTER } from './iching-text'
import { ICHING_LINEPOSITION_CHAPTER } from './iching-lineposition'
import { ICHING_CHANGE_CHAPTER } from './iching-change'
import { ICHING_DIVINATION_CHAPTER } from './iching-divination'
import { ICHING_REASONING_CHAPTER } from './iching-reasoning'
import { ICHING_YIZHUAN_CHAPTER } from './iching-yizhuan'
import { ICHING_YIXUESHI_CHAPTER } from './iching-yixueshi'

export const ICHING_COLLEGE = {
  id: 'iching',
  title: '易经学院',
  emoji: '☯️',
  tagline: '从「一阴一阳之谓道」到看懂一卦的结构、变化与解释边界。',
  chapters: [
    ICHING_BASICS_CHAPTER,
    ICHING_YINYANG_CHAPTER,
    ICHING_BAGUA_CHAPTER,
    ICHING_STRUCTURE_CHAPTER,
    ICHING_SIXTYFOUR_CHAPTER,
    ICHING_TEXT_CHAPTER,
    ICHING_LINEPOSITION_CHAPTER,
    ICHING_CHANGE_CHAPTER,
    ICHING_DIVINATION_CHAPTER,
    ICHING_REASONING_CHAPTER,
    ICHING_YIZHUAN_CHAPTER,
    ICHING_YIXUESHI_CHAPTER,
  ],
}
