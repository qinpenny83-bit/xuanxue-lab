// ============================================================
// 🏮 中国民俗文化馆（民俗学院）
// 学习路径：民间信仰 → 岁时节日 → 诞生礼俗 → 婚姻礼俗 → 丧葬礼俗
// 从「民间怎么说、文献怎么记」出发，理解中国人的日常文化传统。
// ============================================================

import { FK_BELIEF_CHAPTER } from './folk-belief'
import { FK_FESTIVAL_CHAPTER } from './folk-festival'
import { FK_BIRTH_CHAPTER } from './folk-birth'
import { FK_MARRIAGE_CHAPTER } from './folk-marriage'
import { FK_FUNERAL_CHAPTER } from './folk-funeral'

export const FOLK_COLLEGE = {
  id: 'folk',
  title: '中国民俗文化馆',
  emoji: '🏮',
  tagline: '从门神灶神到岁时节令，读懂中国人日常里的文化传统。',
  chapters: [
    FK_BELIEF_CHAPTER,
    FK_FESTIVAL_CHAPTER,
    FK_BIRTH_CHAPTER,
    FK_MARRIAGE_CHAPTER,
    FK_FUNERAL_CHAPTER,
  ],
}
