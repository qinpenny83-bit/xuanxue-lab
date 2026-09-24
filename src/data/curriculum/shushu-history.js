// ============================================================
// 📜 术数思想史学院（V3 新增第四学院 · Phase 6 建设）
// 学习路径：先秦 → 秦汉 → 魏晋 → 隋唐 → 宋元 → 明清 → 近现代
// 定位：术数思想的两千年流变，为八字、易经等学院提供
//       「观念从哪来、文本如何层累、流派为何分化」的历史底座。
// 本学院全部节点 college 字段为 'shushu-history'。
// ============================================================

import { HISTORY_PRE_QIN_CHAPTER } from './history-pre-qin'
import { HISTORY_QIN_HAN_CHAPTER } from './history-qin-han'
import { HISTORY_WEI_JIN_CHAPTER } from './history-wei-jin'
import { HISTORY_SUI_TANG_CHAPTER } from './history-sui-tang'
import { HISTORY_SONG_YUAN_CHAPTER } from './history-song-yuan'
import { HISTORY_MING_QING_CHAPTER } from './history-ming-qing'
import { HISTORY_MODERN_CHAPTER } from './history-modern'

export const SHUSHU_HISTORY_COLLEGE = {
  id: 'shushu-history',
  title: '术数思想史学院',
  emoji: '📜',
  tagline: '从先秦到现代，术数思想的两千年流变。',
  chapters: [
    HISTORY_PRE_QIN_CHAPTER,
    HISTORY_QIN_HAN_CHAPTER,
    HISTORY_WEI_JIN_CHAPTER,
    HISTORY_SUI_TANG_CHAPTER,
    HISTORY_SONG_YUAN_CHAPTER,
    HISTORY_MING_QING_CHAPTER,
    HISTORY_MODERN_CHAPTER,
  ],
}
