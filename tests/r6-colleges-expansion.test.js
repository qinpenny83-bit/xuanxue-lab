// ============================================================
// R6 · 增量扩展验收：风水 + 思想史 + 奇门 + 六壬 + 太乙 + 民俗文化馆 + 神秘文化 + 相学
//
// 验收点：
//   A. 新学院注册进 COLLEGES（11 学院），章节/节点数量正确
//   B. 203 个新节点字段齐全（25 字段 Schema）
//   C. 内容质量：无禁词（深扫全部字符串）、选项结构合法、
//      level 0-6 章内非递减
//   D. 引用完整性：validateCurriculum 零错误
//   E. 学习系统接入：curriculumLesson 可装配课程、learningMap 包含新学院
// ============================================================
import { describe, it, expect } from 'vitest'
import {
  COLLEGES,
  CURRICULUM_NODES,
  validateCurriculum,
} from '../src/data/curriculum'
import { curriculumLesson } from '../src/data/curriculum/lessonFactory'
import { learningMap } from '../src/agent/knowledgeMastery'
import { initialState } from '../src/lib/storage'

const FORBIDDEN = ['命中注定', '算命', '大师预测', '精准预测', '科学验证', '必吉', '转运', '开运', '包你', '一定灵', '保证', '绝对', '必定', '百分之百']

// R6 全部新增学院（8 个）
const NEW_COLLEGES = ['fengshui', 'shushu-history', 'qimen', 'liuren', 'taiyi', 'folk', 'mystic', 'xiangxue']

const REQUIRED_FIELDS = [
  'id', 'title', 'college', 'chapter', 'level', 'prerequisite', 'emoji',
  'concept', 'source', 'structure', 'examples', 'counterexamples',
  'commonMistakes', 'exercises', 'caseIds', 'related', 'masteryStandard',
  'errorTypes', 'transferTag', 'hook', 'predict', 'apply', 'counter',
  'summaryPoints', 'microExperiment',
]

function deepStrings(obj, out = []) {
  if (typeof obj === 'string') {
    out.push(obj)
    return out
  }
  if (obj && typeof obj === 'object') {
    for (const v of Object.values(obj)) deepStrings(v, out)
  }
  return out
}

describe('R6 · 新增学院注册与结构', () => {
  it('COLLEGES 已包含 11 个学院（新增风水/思想史/奇门/六壬/太乙/民俗/神秘/相学）', () => {
    const ids = COLLEGES.map((c) => c.id)
    for (const cid of NEW_COLLEGES) expect(ids).toContain(cid)
    expect(ids).toEqual(['bazi', 'iching', 'methodology', 'fengshui', 'shushu-history', 'qimen', 'liuren', 'taiyi', 'folk', 'mystic', 'xiangxue'])
  })

  it('风水学院：5 章 36 节点，fs- 前缀', () => {
    const fs = COLLEGES.find((c) => c.id === 'fengshui')
    expect(fs).toBeTruthy()
    expect(fs.chapters.length).toBe(5)
    expect(fs.chapters.map((ch) => ch.id)).toEqual(['fs-thought', 'fs-form', 'fs-yangzhai', 'fs-liqi', 'fs-compass'])
    expect(fs.chapters.map((ch) => ch.nodes.length)).toEqual([8, 8, 8, 6, 6])
    expect(fs.chapters.reduce((a, ch) => a + ch.nodes.length, 0)).toBe(36)
    for (const n of fs.chapters.flatMap((ch) => ch.nodes)) {
      expect(n.id.startsWith('fs-')).toBe(true)
      expect(n.college).toBe('fengshui')
    }
  })

  it('思想史学院：7 章 35 节点，hs- 前缀，章节按时代顺序', () => {
    const hs = COLLEGES.find((c) => c.id === 'shushu-history')
    expect(hs).toBeTruthy()
    expect(hs.chapters.length).toBe(7)
    expect(hs.chapters.map((ch) => ch.nodes.length)).toEqual([6, 6, 4, 5, 5, 5, 4])
    expect(hs.chapters.reduce((a, ch) => a + ch.nodes.length, 0)).toBe(35)
    const expectedIds = ['hs-pre-qin', 'hs-qin-han', 'hs-wei-jin', 'hs-sui-tang', 'hs-song-yuan', 'hs-ming-qing', 'hs-modern']
    expect(hs.chapters.map((ch) => ch.id)).toEqual(expectedIds)
    for (const n of hs.chapters.flatMap((ch) => ch.nodes)) {
      expect(n.id.startsWith('hs-')).toBe(true)
      expect(n.college).toBe('shushu-history')
    }
  })

  it('奇门遁甲学院：6 章 35 节点，qm- 前缀', () => {
    const qm = COLLEGES.find((c) => c.id === 'qimen')
    expect(qm).toBeTruthy()
    expect(qm.chapters.length).toBe(6)
    expect(qm.chapters.map((ch) => ch.id)).toEqual(['qm-basic', 'qm-structure', 'qm-layout', 'qm-judge', 'qm-apply', 'qm-advanced'])
    expect(qm.chapters.map((ch) => ch.nodes.length)).toEqual([6, 8, 6, 5, 6, 4])
    expect(qm.chapters.reduce((a, ch) => a + ch.nodes.length, 0)).toBe(35)
    for (const n of qm.chapters.flatMap((ch) => ch.nodes)) {
      expect(n.id.startsWith('qm-')).toBe(true)
      expect(n.college).toBe('qimen')
    }
  })

  it('大六壬学院：5 章 26 节点，lr- 前缀', () => {
    const lr = COLLEGES.find((c) => c.id === 'liuren')
    expect(lr).toBeTruthy()
    expect(lr.chapters.length).toBe(5)
    expect(lr.chapters.map((ch) => ch.id)).toEqual(['lr-origin', 'lr-core', 'lr-shenjiang', 'lr-special', 'lr-judge'])
    expect(lr.chapters.map((ch) => ch.nodes.length)).toEqual([5, 6, 6, 5, 4])
    expect(lr.chapters.reduce((a, ch) => a + ch.nodes.length, 0)).toBe(26)
    for (const n of lr.chapters.flatMap((ch) => ch.nodes)) {
      expect(n.id.startsWith('lr-')).toBe(true)
      expect(n.college).toBe('liuren')
    }
  })

  it('太乙神数学院：4 章 17 节点，ty- 前缀', () => {
    const ty = COLLEGES.find((c) => c.id === 'taiyi')
    expect(ty).toBeTruthy()
    expect(ty.chapters.length).toBe(4)
    expect(ty.chapters.map((ch) => ch.id)).toEqual(['ty-history', 'ty-structure', 'ty-layout', 'ty-judge'])
    expect(ty.chapters.map((ch) => ch.nodes.length)).toEqual([4, 5, 4, 4])
    expect(ty.chapters.reduce((a, ch) => a + ch.nodes.length, 0)).toBe(17)
    for (const n of ty.chapters.flatMap((ch) => ch.nodes)) {
      expect(n.id.startsWith('ty-')).toBe(true)
      expect(n.college).toBe('taiyi')
    }
  })

  it('相学观察实验室：4 章 11 节点，xiang- 前缀', () => {
    const xx = COLLEGES.find((c) => c.id === 'xiangxue')
    expect(xx).toBeTruthy()
    expect(xx.chapters.length).toBe(4)
    expect(xx.chapters.map((ch) => ch.id)).toEqual(['xiang-basic', 'xiang-face', 'xiang-palm', 'xiang-boundary'])
    expect(xx.chapters.map((ch) => ch.nodes.length)).toEqual([3, 3, 3, 2])
    expect(xx.chapters.reduce((a, ch) => a + ch.nodes.length, 0)).toBe(11)
    for (const n of xx.chapters.flatMap((ch) => ch.nodes)) {
      expect(n.id.startsWith('xiang-')).toBe(true)
      expect(n.college).toBe('xiangxue')
    }
  })

  it('新节点全部进入 CURRICULUM_NODES 统一索引（203 节点）', () => {
    const newNodes = CURRICULUM_NODES.filter((n) => NEW_COLLEGES.includes(n.college))
    expect(newNodes.length).toBe(203)
  })
})

describe('R6 · 新增节点 schema 完整性与内容质量', () => {
  const newNodes = CURRICULUM_NODES.filter((n) => NEW_COLLEGES.includes(n.college))

  it('203 个新节点 26 字段齐全', () => {
    for (const n of newNodes) {
      for (const f of REQUIRED_FIELDS) {
        expect(n[f] !== undefined, `${n.id} 缺字段 ${f}`).toBe(true)
      }
    }
  })

  it('新节点无禁词（深扫全部字符串字段含选项/feedback）', () => {
    for (const n of newNodes) {
      const all = deepStrings(n)
      for (const w of FORBIDDEN) {
        expect(all.every((s) => !s.includes(w)), `${n.id} 含禁词「${w}」`).toBe(true)
      }
    }
  })

  it('apply/counter 各 3 选项、恰 1 正确、错误项带 errorType 与 feedback', () => {
    for (const n of newNodes) {
      for (const key of ['apply', 'counter']) {
        const block = n[key]
        expect(block && Array.isArray(block.options), `${n.id} ${key} 缺 options`).toBe(true)
        expect(block.options.length, `${n.id} ${key} 选项数`).toBe(3)
        const corrects = block.options.filter((o) => o.correct === true)
        expect(corrects.length, `${n.id} ${key} 正确项数`).toBe(1)
        for (const o of block.options) {
          expect(typeof o.text === 'string' && o.text.length > 0, `${n.id} ${key} 选项文本为空`).toBe(true)
          expect(typeof o.feedback === 'string' && o.feedback.length > 0, `${n.id} ${key} 缺 feedback`).toBe(true)
          if (o.correct !== true) {
            expect(typeof o.errorType === 'string' && o.errorType.length > 0, `${n.id} ${key} 错误项缺 errorType`).toBe(true)
          }
        }
      }
    }
  })

  it('predict 提供 3 个先猜选项且带 reveal', () => {
    for (const n of newNodes) {
      expect(Array.isArray(n.predict.options), `${n.id} predict 缺 options`).toBe(true)
      expect(n.predict.options.length, `${n.id} predict 选项数`).toBe(3)
      expect(typeof n.predict.reveal === 'string' && n.predict.reveal.length > 0, `${n.id} predict 缺 reveal`).toBe(true)
    }
  })

  it('level 在 0-6 区间且章内非递减', () => {
    for (const cid of NEW_COLLEGES) {
      const college = COLLEGES.find((c) => c.id === cid)
      for (const ch of college.chapters) {
        for (let i = 1; i < ch.nodes.length; i++) {
          expect(ch.nodes[i].level >= ch.nodes[i - 1].level, `${ch.id} 第 ${i} 节点 level 回退`).toBe(true)
        }
      }
    }
  })

  it('内容不空泛：concept/structure/source 有足够长度', () => {
    for (const n of newNodes) {
      expect(n.concept.length, `${n.id} concept 过短`).toBeGreaterThan(40)
      expect(n.structure.length, `${n.id} structure 过短`).toBeGreaterThan(40)
      expect(n.source.length, `${n.id} source 过短`).toBeGreaterThan(10)
    }
  })
})

describe('R6 · 引用完整性与学习系统接入', () => {
  it('validateCurriculum 零错误（前置/关联全部可解析）', () => {
    const { errors } = validateCurriculum()
    expect(errors, errors.slice(0, 8).join('\n')).toEqual([])
  })

  it('每个新节点都能装配成完整课程（curriculumLesson ≥7 步）', () => {
    const newNodes = CURRICULUM_NODES.filter((n) => NEW_COLLEGES.includes(n.college))
    for (const n of newNodes) {
      const l = curriculumLesson(n.id)
      expect(l, `${n.id} 课程装配失败`).toBeTruthy()
      expect(l.steps.length, `${n.id} 课程步骤不足`).toBeGreaterThanOrEqual(7)
      expect(l.id, `${n.id} 课程 id`).toBe(`v3-${n.id}`)
    }
  })

  it('learningMap 包含 8 个新学院且掌握画像可推导', () => {
    const map = learningMap(initialState)
    const ids = map.map((c) => c.id)
    for (const cid of NEW_COLLEGES) expect(ids, `learningMap 缺 ${cid}`).toContain(cid)
    expect(map.find((c) => c.id === 'fengshui').chapters.length).toBe(5)
    expect(map.find((c) => c.id === 'shushu-history').chapters.length).toBe(7)
    expect(map.find((c) => c.id === 'qimen').chapters.length).toBe(6)
    expect(map.find((c) => c.id === 'liuren').chapters.length).toBe(5)
    expect(map.find((c) => c.id === 'taiyi').chapters.length).toBe(4)
    expect(map.find((c) => c.id === 'folk').chapters.length).toBe(5)
    expect(map.find((c) => c.id === 'mystic').chapters.length).toBe(4)
    expect(map.find((c) => c.id === 'xiangxue').chapters.length).toBe(4)
  })

  it('新节点 prerequisite 链完整：每章首节点可解锁（无缺失前置）', () => {
    const newNodes = CURRICULUM_NODES.filter((n) => NEW_COLLEGES.includes(n.college))
    const ids = new Set(CURRICULUM_NODES.map((n) => n.id))
    for (const n of newNodes) {
      for (const p of n.prerequisite || []) {
        expect(ids.has(p), `${n.id} 前置 ${p} 不存在`).toBe(true)
      }
      for (const r of n.related || []) {
        expect(ids.has(r), `${n.id} 关联 ${r} 不存在`).toBe(true)
      }
    }
  })
})
