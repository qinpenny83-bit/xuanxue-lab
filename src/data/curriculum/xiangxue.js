// ============================================================
// 👁️ 相学观察实验室（相学学院）
// 学习路径：相学是什么 → 面相 → 手相 → 相学的边界与方法
// 定位：把「看相」作为传统文化知识来学习——理解相术的语言、
//       源流、流派差异与内部批判，并把「观察人」变成推理训练。
// 全章语言：现代学术实验室风格，不编造典籍原文，明确标注
//       传统说法 / 民间观念 / 文献线索 / 产品自身教学解释。
// ============================================================

import { XIANG_BASIC_CHAPTER } from './xiang-basic'
import { XIANG_FACE_CHAPTER } from './xiang-face'
import { XIANG_PALM_CHAPTER } from './xiang-palm'
import { XIANG_BOUNDARY_CHAPTER } from './xiang-boundary'

export const XIANG_COLLEGE = {
  id: 'xiangxue',
  title: '相学观察实验室',
  emoji: '👁️',
  tagline: '面相、手相与「看人」的传统——理解相术的语言、源流与边界，把相学变成观察训练。',
  chapters: [
    XIANG_BASIC_CHAPTER,
    XIANG_FACE_CHAPTER,
    XIANG_PALM_CHAPTER,
    XIANG_BOUNDARY_CHAPTER,
  ],
}
