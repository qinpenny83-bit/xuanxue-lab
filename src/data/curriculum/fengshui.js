// ============================================================
// 🏔️ 风水学院（Phase 5 建设）
// 学习路径：风水之思 → 形势之法 → 阳宅之道 → 理气之学 → 罗盘之器
// 从「形与气」到读懂一座宅院。
// 未建设章节 nodes 为空数组，Map 显示「建设中」，避免注水。
// ============================================================

import { FENGSHUI_THOUGHT_CHAPTER } from './fengshui-thought'
import { FENGSHUI_FORM_CHAPTER } from './fengshui-form'
import { FENGSHUI_YANGZHAI_CHAPTER } from './fengshui-yangzhai'
import { FENGSHUI_LIQI_CHAPTER } from './fengshui-liqi'
import { FENGSHUI_COMPASS_CHAPTER } from './fengshui-compass'

export const FENGSHUI_COLLEGE = {
  id: 'fengshui',
  title: '风水学院',
  emoji: '🏔️',
  tagline: '从「形与气」到读懂一座宅院。',
  chapters: [
    FENGSHUI_THOUGHT_CHAPTER,
    FENGSHUI_FORM_CHAPTER,
    FENGSHUI_YANGZHAI_CHAPTER,
    FENGSHUI_LIQI_CHAPTER,
    FENGSHUI_COMPASS_CHAPTER,
  ],
}
