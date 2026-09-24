// ============================================================
// 🌙 民俗·神秘文化学院（纯数据聚合）
// 学习路径：观念之源 → 护佑之道 → 禁忌之网 → 传说与叙事
// 从「阴阳观」到「道教相关文化」：用四层结构读懂神秘文化——
// 民间怎么说 / 历史文献怎么记载 / 宗教文化传统怎么理解 /
// 现代社会如何解释。传说与灵异内容一律标注「民间传说/未证实」。
// ============================================================

import { MYSTIC_CONCEPT_CHAPTER } from './mystic-concept'
import { MYSTIC_PROTECT_CHAPTER } from './mystic-protect'
import { MYSTIC_TABOO_CHAPTER } from './mystic-taboo'
import { MYSTIC_STORY_CHAPTER } from './mystic-story'

export const MYSTIC_COLLEGE = {
  id: 'mystic',
  title: '民俗·神秘文化',
  emoji: '🌙',
  tagline: '把「神秘」放回文化语境里，四层读懂：民间说法、文献记载、宗教传统与现代解释。',
  chapters: [
    MYSTIC_CONCEPT_CHAPTER,
    MYSTIC_PROTECT_CHAPTER,
    MYSTIC_TABOO_CHAPTER,
    MYSTIC_STORY_CHAPTER,
  ],
}
